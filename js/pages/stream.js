/**
 * XRP Music - Stream Page
 * Main discovery page with releases, tracks, sorting, and artists
 */

const StreamPage = {
  releases: [],
  artists: [],
  currentSort: 'alphabetical',
  selectedGenre: null,
  
  genres: [
    { id: 'hiphop', name: 'Hip Hop', color: '#f97316' },
    { id: 'rap', name: 'Rap', color: '#ef4444' },
    { id: 'electronic', name: 'Electronic', color: '#3b82f6' },
    { id: 'rnb', name: 'R&B', color: '#a855f7' },
    { id: 'pop', name: 'Pop', color: '#ec4899' },
    { id: 'rock', name: 'Rock', color: '#84cc16' },
    { id: 'country', name: 'Country', color: '#f59e0b' },
    { id: 'jazz', name: 'Jazz', color: '#06b6d4' },
    { id: 'lofi', name: 'Lo-Fi', color: '#8b5cf6' },
    { id: 'other', name: 'Other', color: '#6b7280' },
  ],
  
  async render() {
    UI.showLoading();
    
    try {
      // Add timeout to prevent infinite loading
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      this.releases = await Promise.race([API.getReleases(), timeout]);
      setReleases(this.releases);
      this.extractArtists();
      
      if (this.releases.length === 0) {
        this.renderEmpty();
        return;
      }
      
      this.renderContent();
    } catch (error) {
      console.error('Failed to load releases:', error);
      this.renderError();
    }
  },
  
  extractArtists() {
    const artistMap = new Map();
    
    this.releases.forEach(release => {
      if (!artistMap.has(release.artistAddress)) {
        artistMap.set(release.artistAddress, {
          address: release.artistAddress,
          name: release.artistName || Helpers.truncateAddress(release.artistAddress),
          avatar: release.artistAvatar || null,
          releaseCount: 1,
          trackCount: release.tracks?.length || 0,
        });
      } else {
        const artist = artistMap.get(release.artistAddress);
        artist.releaseCount++;
        artist.trackCount += release.tracks?.length || 0;
      }
    });
    
    this.artists = Array.from(artistMap.values());
  },
  
  renderContent() {
    const allTracks = this.getAllTracks();
    const sortedTracks = this.sortTracks(allTracks);
    const stats = this.getStats();
    
    const html = `
      <div class="stream-page animate-fade-in">
        <!-- Latest Releases -->
        <section style="margin-bottom: 32px;">
          <h2 class="section-title">Latest Releases</h2>
          <div class="release-grid">
            ${this.releases.slice(0, 12).map(release => this.renderReleaseCard(release)).join('')}
          </div>
        </section>
        
        <!-- All Tracks with Sorting -->
        ${allTracks.length > 0 ? `
          <section style="margin-bottom: 32px;">
            <div class="section-header">
              <h2 class="section-title" style="margin-bottom: 0;">All Tracks</h2>
              <div class="sort-controls">
                <span class="sort-label">Sort by:</span>
                <div class="sort-buttons">
                  <button class="sort-btn ${this.currentSort === 'alphabetical' ? 'active' : ''}" data-sort="alphabetical">A-Z</button>
                  <button class="sort-btn ${this.currentSort === 'mostPlayed' ? 'active' : ''}" data-sort="mostPlayed">Popular</button>
                  <button class="sort-btn ${this.currentSort === 'genre' ? 'active' : ''}" data-sort="genre">Genre</button>
                </div>
              </div>
            </div>
            
            ${this.currentSort === 'genre' ? `
              <div class="genre-filter">
                ${this.genres.map(genre => `
                  <button class="genre-box ${this.selectedGenre === genre.id ? 'active' : ''}" 
                          data-genre="${genre.id}"
                          style="--genre-color: ${genre.color}">
                    <span class="genre-name">${genre.name}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
            
            <div class="track-list">
              ${sortedTracks.length > 0 
                ? sortedTracks.map((track, index) => this.renderTrackItem(track, index)).join('')
                : '<div style="padding: 32px; text-align: center; color: var(--text-muted);">No tracks found for this genre yet</div>'
              }
            </div>
          </section>
        ` : ''}
        
        <!-- All Artists -->
        ${this.artists.length > 0 ? `
          <section style="margin-bottom: 32px;">
            <div class="section-header">
              <h2 class="section-title" style="margin-bottom: 0;">All Artists</h2>
              <span class="artist-count">${this.artists.length} artist${this.artists.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="artists-grid">
              ${this.artists.map(artist => this.renderArtistCard(artist)).join('')}
            </div>
          </section>
        ` : ''}
        
        <!-- Stats -->
        <section>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value" style="color: var(--accent);">${stats.releases}</div>
              <div class="stat-label">Releases</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #a855f7;">${stats.tracks}</div>
              <div class="stat-label">Tracks</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--success);">${stats.artists}</div>
              <div class="stat-label">Artists</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--warning);">${stats.sold}</div>
              <div class="stat-label">Sold</div>
            </div>
          </div>
        </section>
      </div>
      
      <style>
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }
        .sort-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sort-label {
          font-size: 13px;
          color: var(--text-muted);
        }
        .sort-buttons {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .sort-btn {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }
        .sort-btn:hover {
          color: var(--text-primary);
        }
        .sort-btn.active {
          background: var(--accent);
          color: white;
        }
        .genre-filter {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
        }
        @media (min-width: 640px) {
          .genre-filter {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        .genre-box {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 8px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--bg-hover);
          cursor: pointer;
          transition: all 150ms;
        }
        .genre-box:hover {
          border-color: var(--genre-color);
          transform: translateY(-2px);
        }
        .genre-box.active {
          border-color: var(--genre-color);
          background: color-mix(in srgb, var(--genre-color) 20%, var(--bg-hover));
        }
        .genre-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .genre-box.active .genre-name {
          color: var(--genre-color);
        }
        .artist-count {
          font-size: 13px;
          color: var(--text-muted);
        }
        .artists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
        }
        @media (min-width: 640px) {
          .artists-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 20px;
          }
        }
        .artist-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: all 150ms;
        }
        .artist-card:hover {
          transform: translateY(-4px);
          border-color: var(--border-light);
          box-shadow: var(--shadow-lg);
        }
        .artist-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: white;
          margin-bottom: 12px;
          overflow: hidden;
        }
        .artist-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .artist-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 4px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .artist-stats {
          font-size: 12px;
          color: var(--text-muted);
        }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  sortTracks(tracks) {
    let sorted = [...tracks];
    
    switch (this.currentSort) {
      case 'alphabetical':
        sorted.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
        break;
      case 'mostPlayed':
        sorted.sort((a, b) => (b.release.soldEditions || 0) - (a.release.soldEditions || 0));
        break;
      case 'genre':
        if (this.selectedGenre) {
          sorted = sorted.filter(track => {
            const artistGenres = track.release.artistGenres || [];
            return artistGenres.includes(this.selectedGenre);
          });
        }
        sorted.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
        break;
    }
    
    return sorted;
  },
  
  renderArtistCard(artist) {
    return `
      <div class="artist-card" data-artist-address="${artist.address}">
        <div class="artist-avatar">
          ${artist.avatar 
            ? `<img src="${artist.avatar}" alt="${artist.name}">`
            : artist.name[0].toUpperCase()
          }
        </div>
        <div class="artist-name">${artist.name}</div>
        <div class="artist-stats">${artist.releaseCount} release${artist.releaseCount !== 1 ? 's' : ''}</div>
      </div>
    `;
  },
  
  renderEmpty() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <h3>Welcome to XRP Music</h3>
        <p>The decentralized music platform on the XRP Ledger</p>
      </div>
    `;
    UI.renderPage(html);
  },
  
  renderError() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Failed to Load</h3>
        <p>There was an error loading releases. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="StreamPage.render()">Retry</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover" style="${isSoldOut ? 'opacity: 0.5;' : ''}">
          ${release.coverUrl 
            ? `<img src="${release.coverUrl}" alt="${release.title}">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
          <span class="release-availability">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          ${!isSoldOut ? `
            <div class="release-play-overlay">
              <button class="release-play-btn" data-release-id="${release.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title}</div>
          <div class="release-card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            <span class="release-card-tracks">${release.tracks?.length || 0} track${release.tracks?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderTrackItem(track, index) {
    const isPlaying = AppState.player.currentTrack?.trackId === track.id || 
                      AppState.player.currentTrack?.id === parseInt(track.id);
    const available = track.release.totalEditions - track.release.soldEditions;
    
    return `
      <div class="track-item ${isPlaying ? 'playing' : ''}" data-track-index="${index}">
        <div class="track-cover">
          <img src="${track.release.coverUrl || '/placeholder.png'}" alt="${track.displayTitle}">
          ${isPlaying && AppState.player.isPlaying ? `
            <div class="track-playing-indicator">
              <div class="track-playing-bars"><span></span><span></span><span></span></div>
            </div>
          ` : ''}
        </div>
        <div class="track-info">
          <div class="track-title">${track.displayTitle}</div>
          <div class="track-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
        </div>
        <div class="track-meta">
          <div>
            <div class="track-price">${track.release.songPrice} XRP</div>
            <div class="track-availability ${available < 10 ? 'low' : ''}">${available} left</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;
  },
  
  getAllTracks() {
    return this.releases.flatMap(release => 
      (release.tracks || []).map((track, idx) => ({
        ...track,
        release,
        trackIndex: idx,
        displayTitle: release.type === 'single' ? release.title : track.title,
      }))
    );
  },
  
  getStats() {
    const uniqueArtists = new Set(this.releases.map(r => r.artistAddress));
    const totalTracks = this.releases.reduce((sum, r) => sum + (r.tracks?.length || 0), 0);
    const totalSold = this.releases.reduce((sum, r) => sum + r.soldEditions, 0);
    
    return {
      releases: this.releases.length,
      tracks: totalTracks,
      artists: uniqueArtists.size,
      sold: totalSold,
    };
  },
  
  bindEvents() {
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newSort = btn.dataset.sort;
        if (newSort !== this.currentSort) {
          this.currentSort = newSort;
          this.selectedGenre = null;
          this.renderContent();
        }
      });
    });
    
    // Genre boxes
    document.querySelectorAll('.genre-box').forEach(box => {
      box.addEventListener('click', () => {
        const genre = box.dataset.genre;
        this.selectedGenre = this.selectedGenre === genre ? null : genre;
        this.renderContent();
      });
    });
    
    // Release cards
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // Play buttons
    document.querySelectorAll('.release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release?.tracks?.length > 0) this.playRelease(release);
      });
    });
    
    // Track items
    document.querySelectorAll('.track-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const allTracks = this.sortTracks(this.getAllTracks());
        const track = allTracks[index];
        if (track) this.playTrack(track, allTracks, index);
      });
    });
    
    // Artist cards
    document.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        const address = card.dataset.artistAddress;
        if (address) Router.navigate('artist', { address });
      });
    });
  },
  
  playRelease(release) {
    if (!release.tracks?.length) return;
    const queue = release.tracks.map((t, idx) => ({
      id: parseInt(t.id) || idx,
      trackId: t.id,
      title: release.type === 'single' ? release.title : t.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: release.coverUrl,
      ipfsHash: t.audioCid,
      releaseId: release.id,
      duration: t.duration,
    }));
    Player.playTrack(queue[0], queue, 0);
  },
  
  playTrack(trackData, allTracks, index) {
    const queue = allTracks.map(t => ({
      id: parseInt(t.id) || 0,
      trackId: t.id,
      title: t.displayTitle,
      artist: t.release.artistName || Helpers.truncateAddress(t.release.artistAddress),
      cover: t.release.coverUrl,
      ipfsHash: t.audioCid,
      releaseId: t.release.id,
      duration: t.duration,
    }));
    Player.playTrack(queue[index], queue, index);
  },
};
