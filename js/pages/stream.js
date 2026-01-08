/**
 * XRP Music - Stream Page
 * Main discovery page with top played tracks, all tracks, sorting, and artists
 */

const StreamPage = {
  releases: [],
  artists: [],
  topTracks: [],
  currentTab: 'tracks', // 'tracks' or 'artists'
  currentSort: 'alphabetical',
  currentTopPeriod: '7d', // '1d', '7d', '30d', '365d'
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
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      this.releases = await Promise.race([API.getReleases(), timeout]);
      setReleases(this.releases);
      this.extractArtists();
      
      // Load top played tracks
      await this.loadTopTracks();
      
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
  
  /**
   * Load top played tracks for current period
   * TODO: Replace with actual API call to /api/tracks/top?period=7d&limit=10
   */
  async loadTopTracks() {
    try {
      // Try to fetch from API if endpoint exists
      if (typeof API.getTopTracks === 'function') {
        this.topTracks = await API.getTopTracks(this.currentTopPeriod, 10);
        return;
      }
    } catch (e) {
      console.log('Top tracks API not available, using fallback');
    }
    
    // Fallback: Calculate from releases data
    // In production, this should come from stream_events table aggregated by period
    const allTracks = this.getAllTracks();
    
    // Sort by play count (using soldEditions as proxy for now)
    // TODO: Replace with actual play counts from stream_events
    this.topTracks = allTracks
      .map(track => ({
        ...track,
        // Simulated play counts - REPLACE WITH REAL DATA
        plays: this.getTrackPlays(track, this.currentTopPeriod),
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);
  },
  
  /**
   * Get play count for a track in a given period
   * TODO: Replace with actual data from stream_events table
   */
  getTrackPlays(track, period) {
    // This is placeholder logic - replace with real stream counts
    // You'll want columns like: plays_1d, plays_7d, plays_30d, plays_365d
    // Or query stream_events table with date filters
    
    const basePlays = track.release.soldEditions || 0;
    
    // Simulate different counts for different periods (REMOVE THIS)
    // Just for demo - actual implementation should query real data
    switch (period) {
      case '1d':
        return Math.floor(basePlays * 0.1 + Math.random() * 50);
      case '7d':
        return Math.floor(basePlays * 0.4 + Math.random() * 200);
      case '30d':
        return Math.floor(basePlays * 0.7 + Math.random() * 500);
      case '365d':
        return Math.floor(basePlays + Math.random() * 1000);
      default:
        return basePlays;
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
          totalSold: release.soldEditions || 0,
          // TODO: Replace with actual stream count from stream_events table
          totalStreams: release.soldEditions || 0,
        });
      } else {
        const artist = artistMap.get(release.artistAddress);
        artist.releaseCount++;
        artist.trackCount += release.tracks?.length || 0;
        artist.totalSold += release.soldEditions || 0;
        artist.totalStreams += release.soldEditions || 0;
      }
    });
    
    this.artists = Array.from(artistMap.values());
  },
  
  renderContent() {
    const allTracks = this.getAllTracks();
    const sortedTracks = this.sortTracks(allTracks);
    const sortedArtists = this.sortArtists();
    const stats = this.getStats();
    
    const html = `
      <div class="stream-page animate-fade-in">
        <!-- Top Played Section - 2 ROWS OF 5 CARDS -->
        <section class="stream-section">
          <div class="section-header">
            <div class="section-title-with-tabs">
              <h2 class="section-title">Top Played</h2>
              <div class="period-tabs">
                <button class="period-tab ${this.currentTopPeriod === '1d' ? 'active' : ''}" data-period="1d">1D</button>
                <button class="period-tab ${this.currentTopPeriod === '7d' ? 'active' : ''}" data-period="7d">7D</button>
                <button class="period-tab ${this.currentTopPeriod === '30d' ? 'active' : ''}" data-period="30d">30D</button>
                <button class="period-tab ${this.currentTopPeriod === '365d' ? 'active' : ''}" data-period="365d">365D</button>
              </div>
            </div>
            <button class="view-all-btn" onclick="StreamPage.viewAllTopTracks()">
              View All
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
          
          <div class="top-tracks-grid">
            ${this.topTracks.length > 0 
              ? this.topTracks.map((track, index) => this.renderTopTrackCard(track, index)).join('')
              : '<div class="empty-message" style="grid-column: 1/-1;">No play data available yet</div>'
            }
          </div>
        </section>
        
        <!-- Tracks / Artists Tabbed Section -->
        <section class="stream-section">
          <div class="section-header">
            <div class="tab-toggle">
              <button class="tab-btn ${this.currentTab === 'tracks' ? 'active' : ''}" data-tab="tracks">
                All Tracks
                <span class="tab-count">${allTracks.length}</span>
              </button>
              <button class="tab-btn ${this.currentTab === 'artists' ? 'active' : ''}" data-tab="artists">
                All Artists
                <span class="tab-count">${this.artists.length}</span>
              </button>
            </div>
            <div class="sort-controls">
              <div class="sort-buttons">
                <button class="sort-btn ${this.currentSort === 'alphabetical' ? 'active' : ''}" data-sort="alphabetical">A-Z</button>
                <button class="sort-btn ${this.currentSort === 'genre' ? 'active' : ''}" data-sort="genre">Genre</button>
                <button class="sort-btn ${this.currentSort === 'popular' ? 'active' : ''}" data-sort="popular">Popular</button>
              </div>
            </div>
          </div>
          
          ${this.currentSort === 'genre' ? `
            <div class="genre-filter">
              ${this.genres.map(genre => `
                <button class="genre-chip ${this.selectedGenre === genre.id ? 'active' : ''}" 
                        data-genre="${genre.id}"
                        style="--genre-color: ${genre.color}">
                  ${genre.name}
                </button>
              `).join('')}
            </div>
          ` : ''}
          
          ${this.currentTab === 'tracks' ? `
            <div class="track-list">
              ${sortedTracks.length > 0 
                ? sortedTracks.map((track, index) => this.renderTrackItem(track, index)).join('')
                : '<div class="empty-message">No tracks found for this genre yet</div>'
              }
            </div>
          ` : `
            <div class="artists-grid">
              ${sortedArtists.map(artist => this.renderArtistCard(artist)).join('')}
            </div>
          `}
        </section>
        
        <!-- Stats -->
        <section class="stream-section">
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
        .stream-section {
          margin-bottom: 32px;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .section-title-with-tabs {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .view-all-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .view-all-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        
        /* Top Tracks Grid - 2 rows of 5 cards */
        .top-tracks-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .top-tracks-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 900px) {
          .top-tracks-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 640px) {
          .top-tracks-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }
        
        /* Rank Badge */
        .rank-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 800;
          border-radius: 6px;
          color: white;
          z-index: 2;
        }
        .rank-badge.rank-1 {
          background: linear-gradient(135deg, #ffd700, #ffaa00);
          box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
        }
        .rank-badge.rank-2 {
          background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
          box-shadow: 0 2px 8px rgba(192, 192, 192, 0.4);
        }
        .rank-badge.rank-3 {
          background: linear-gradient(135deg, #cd7f32, #b87333);
          box-shadow: 0 2px 8px rgba(205, 127, 50, 0.4);
        }
        .rank-badge.rank-4,
        .rank-badge.rank-5,
        .rank-badge.rank-6,
        .rank-badge.rank-7,
        .rank-badge.rank-8,
        .rank-badge.rank-9,
        .rank-badge.rank-10 {
          background: rgba(59, 130, 246, 0.9);
        }
        
        /* Play count in card footer */
        .release-card-plays {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .release-card-plays svg {
          color: var(--accent);
        }
        
        /* Period Tabs for Top Played */
        .period-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .period-tab {
          padding: 6px 12px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        .period-tab:hover {
          color: var(--text-primary);
        }
        .period-tab.active {
          background: var(--accent);
          color: white;
        }
        
        /* Tab Toggle */
        .tab-toggle {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          background: var(--accent);
          color: white;
        }
        .tab-count {
          padding: 2px 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }
        .tab-btn:not(.active) .tab-count {
          background: var(--bg-hover);
          color: var(--text-muted);
        }
        
        /* Sort Controls */
        .sort-controls {
          display: flex;
          align-items: center;
          gap: 12px;
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
        
        /* Genre Filter */
        .genre-filter {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        .genre-chip {
          padding: 6px 14px;
          border: 1px solid var(--border-color);
          border-radius: 20px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }
        .genre-chip:hover {
          border-color: var(--genre-color);
          color: var(--genre-color);
        }
        .genre-chip.active {
          background: var(--genre-color);
          border-color: var(--genre-color);
          color: white;
        }
        
        /* Artists Grid */
        .artists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }
        @media (min-width: 640px) {
          .artists-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
        
        /* Empty Message */
        .empty-message {
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
        }
        
        /* Responsive */
        @media (max-width: 640px) {
          .section-header {
            flex-direction: column;
            align-items: stretch;
          }
          .section-title-with-tabs {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .period-tabs {
            width: 100%;
          }
          .period-tab {
            flex: 1;
            text-align: center;
          }
          .tab-toggle {
            width: 100%;
          }
          .tab-btn {
            flex: 1;
            justify-content: center;
          }
          .sort-controls {
            width: 100%;
          }
          .sort-buttons {
            width: 100%;
          }
          .sort-btn {
            flex: 1;
            text-align: center;
          }
          .top-track-item {
            grid-template-columns: 32px 48px 1fr auto;
            gap: 8px;
            padding: 10px 12px;
          }
          .top-track-cover {
            width: 48px;
            height: 48px;
          }
          .top-track-plays span {
            display: none;
          }
        }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * View all top tracks (could open a modal or navigate to a page)
   */
  viewAllTopTracks() {
    // Option 1: Show a modal with full leaderboard
    // Option 2: Navigate to a dedicated page
    // For now, let's show an alert - you can implement the full page later
    console.log('View all top tracks for period:', this.currentTopPeriod);
    
    // TODO: Implement full leaderboard page or modal
    // Router.navigate('top-tracks', { period: this.currentTopPeriod });
    
    // Temporary: Show the tracks/popular view
    this.currentTab = 'tracks';
    this.currentSort = 'popular';
    this.renderContent();
  },
  
  sortTracks(tracks) {
    let sorted = [...tracks];
    
    switch (this.currentSort) {
      case 'alphabetical':
        sorted.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
        break;
      case 'popular':
        // TODO: Replace with actual stream count from stream_events table
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
  
  sortArtists() {
    let sorted = [...this.artists];
    
    switch (this.currentSort) {
      case 'alphabetical':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'popular':
        // Sort by total streams (or sold as proxy for now)
        sorted.sort((a, b) => b.totalStreams - a.totalStreams);
        break;
      case 'genre':
        // For genre filter on artists, we'd need to filter by releases with that genre
        // For now, just sort alphabetically
        sorted.sort((a, b) => a.name.localeCompare(b.name));
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
  
  /**
   * Render a top track as a CARD with rank badge (like release cards)
   */
  renderTopTrackCard(track, index) {
    const rank = index + 1;
    const available = track.release.totalEditions - track.release.soldEditions;
    const isSoldOut = available <= 0;
    const price = track.release.songPrice || track.release.albumPrice;
    
    return `
      <div class="release-card top-track-card" data-top-track-index="${index}">
        <div class="release-card-cover">
          ${track.release.coverUrl 
            ? `<img src="${track.release.coverUrl}" alt="${track.displayTitle}">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="rank-badge rank-${rank}">#${rank}</span>
          <span class="release-availability ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          <div class="release-play-overlay">
            <button class="release-play-btn" data-top-track-index="${index}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${track.displayTitle}</div>
          <div class="release-card-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            <span class="release-card-plays">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              ${Helpers.formatNumber ? Helpers.formatNumber(track.plays) : track.plays.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render a top track item with rank and play count (list view - kept for View All page)
   */
  renderTopTrackItem(track, index) {
    const rank = index + 1;
    const isPlaying = AppState.player.currentTrack?.trackId === track.id || 
                      AppState.player.currentTrack?.id === parseInt(track.id);
    
    return `
      <div class="top-track-item ${isPlaying ? 'playing' : ''}" data-top-track-index="${index}">
        <div class="top-track-rank ${rank <= 3 ? 'top-3' : ''}">${rank}</div>
        <div class="top-track-cover">
          <img src="${track.release.coverUrl || '/placeholder.png'}" alt="${track.displayTitle}">
          ${isPlaying && AppState.player.isPlaying ? `
            <div class="track-playing-indicator">
              <div class="track-playing-bars"><span></span><span></span><span></span></div>
            </div>
          ` : ''}
        </div>
        <div class="top-track-info">
          <div class="top-track-title">${track.displayTitle}</div>
          <div class="top-track-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
        </div>
        <div class="top-track-meta">
          <div class="top-track-plays">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            ${Helpers.formatNumber ? Helpers.formatNumber(track.plays) : track.plays.toLocaleString()}
            <span>plays</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover">
          ${release.coverUrl 
            ? `<img src="${release.coverUrl}" alt="${release.title}">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
          <span class="release-availability ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          <div class="release-play-overlay">
            <button class="release-play-btn" data-release-id="${release.id}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title}</div>
          <div class="release-card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            ${release.type !== 'single' ? `<span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },
  
  renderTrackItem(track, index) {
    const isPlaying = AppState.player.currentTrack?.trackId === track.id || 
                      AppState.player.currentTrack?.id === parseInt(track.id);
    const available = track.release.totalEditions - track.release.soldEditions;
    const isSoldOut = available <= 0;
    
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
            <div class="track-availability ${isSoldOut ? 'sold-out' : ''} ${available < 10 && !isSoldOut ? 'low' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</div>
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
    // Period tabs for Top Played
    document.querySelectorAll('.period-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        const newPeriod = tab.dataset.period;
        if (newPeriod !== this.currentTopPeriod) {
          this.currentTopPeriod = newPeriod;
          await this.loadTopTracks();
          this.renderContent();
        }
      });
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTab = btn.dataset.tab;
        if (newTab !== this.currentTab) {
          this.currentTab = newTab;
          this.renderContent();
        }
      });
    });
    
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
    
    // Genre chips
    document.querySelectorAll('.genre-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const genre = chip.dataset.genre;
        this.selectedGenre = this.selectedGenre === genre ? null : genre;
        this.renderContent();
      });
    });
    
    // Release cards (if any exist on page)
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // Play buttons on release cards
    document.querySelectorAll('.release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release?.tracks?.length > 0) this.playRelease(release);
      });
    });
    
    // Top track cards (click card to open release modal)
    document.querySelectorAll('.top-track-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        const index = parseInt(card.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track?.release) {
          Modals.showRelease(track.release);
        }
      });
    });
    
    // Play buttons on top track cards
    document.querySelectorAll('.top-track-card .release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track) this.playTrack(track, this.topTracks, index);
      });
    });
    
    // Track items (list view)
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
