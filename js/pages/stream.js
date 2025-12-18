/**
 * XRP Music - Stream Page
 * Main discovery page with releases and tracks
 */

const StreamPage = {
  releases: [],
  
  /**
   * Render stream page
   */
  async render() {
    UI.showLoading();
    
    try {
      this.releases = await API.getReleases();
      setReleases(this.releases);
      
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
   * Render main content
   */
  renderContent() {
    const allTracks = this.getAllTracks();
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
        
        <!-- All Tracks -->
        ${allTracks.length > 0 ? `
          <section style="margin-bottom: 32px;">
            <h2 class="section-title">All Tracks</h2>
            <div class="track-list">
              ${allTracks.map((track, index) => this.renderTrackItem(track, index)).join('')}
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
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * Render empty state
   */
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
        <div style="margin-top: 24px; padding: 16px; background: var(--bg-hover); border-radius: 12px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="margin-bottom: 8px;">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <p style="color: var(--text-muted);">Connect your Xaman wallet to get started</p>
        </div>
      </div>
    `;
    
    UI.renderPage(html);
  },
  
  /**
   * Render error state
   */
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
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="StreamPage.render()">
          Retry
        </button>
      </div>
    `;
    
    UI.renderPage(html);
  },
  
  /**
   * Render release card
   */
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover" style="${isSoldOut ? 'opacity: 0.5;' : ''}">
          ${release.coverUrl 
            ? `<img src="${release.coverUrl}" alt="${release.title}">`
            : `<div class="placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
          <span class="release-availability">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          ${isSoldOut ? `
            <div class="release-sold-out">
              <span>SOLD OUT</span>
            </div>
          ` : `
            <div class="release-play-overlay">
              <button class="release-play-btn" data-release-id="${release.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            </div>
          `}
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
  
  /**
   * Render track item
   */
  renderTrackItem(track, index) {
    const isPlaying = AppState.player.currentTrack?.trackId === track.id || 
                      AppState.player.currentTrack?.id === parseInt(track.id);
    const available = track.release.totalEditions - track.release.soldEditions;
    const isSoldOut = available <= 0;
    
    return `
      <div class="track-item ${isPlaying ? 'playing' : ''} ${isSoldOut ? 'sold-out' : ''}" 
           data-track-index="${index}"
           style="${isSoldOut ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        <div class="track-cover" style="position: relative;">
          <img src="${track.release.coverUrl || '/placeholder.png'}" alt="${track.displayTitle}">
          ${isPlaying && AppState.player.isPlaying ? `
            <div class="track-playing-indicator">
              <div class="track-playing-bars">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="track-info">
          <div class="track-title">${track.displayTitle}</div>
          <div class="track-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
        </div>
        <div class="track-meta">
          ${isSoldOut ? `
            <span style="color: var(--error); font-weight: 500;">Sold</span>
          ` : `
            <div>
              <div class="track-price">${track.release.songPrice} XRP</div>
              <div class="track-availability ${available < 10 ? 'low' : ''}">${available} left</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          `}
        </div>
      </div>
    `;
  },
  
  /**
   * Get all tracks from releases
   */
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
  
  /**
   * Get stats
   */
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
  
  /**
   * Bind events
   */
  bindEvents() {
    // Release cards - click to open modal
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking play button
        if (e.target.closest('.release-play-btn')) return;
        
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
        }
      });
    });
    
    // Play buttons
    document.querySelectorAll('.release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release && release.tracks?.length > 0) {
          this.playRelease(release);
        }
      });
    });
    
    // Track items
    document.querySelectorAll('.track-item:not(.sold-out)').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const allTracks = this.getAllTracks();
        const track = allTracks[index];
        
        if (track) {
          this.playTrack(track, allTracks, index);
        }
      });
    });
  },
  
  /**
   * Play a release (first track)
   */
  playRelease(release) {
    if (!release.tracks?.length) return;
    
    const track = release.tracks[0];
    const playTrack = {
      id: parseInt(track.id) || 0,
      trackId: track.id,
      title: release.type === 'single' ? release.title : track.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: release.coverUrl,
      ipfsHash: track.audioCid,
      audioUrl: track.audioUrl,
      releaseId: release.id,
      duration: track.duration,
    };
    
    // Create queue from all tracks in this release
    const queue = release.tracks.map((t, idx) => ({
      id: parseInt(t.id) || idx,
      trackId: t.id,
      title: release.type === 'single' ? release.title : t.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: release.coverUrl,
      ipfsHash: t.audioCid,
      audioUrl: t.audioUrl,
      releaseId: release.id,
      duration: t.duration,
    }));
    
    Player.playTrack(playTrack, queue, 0);
  },
  
  /**
   * Play a track from the all tracks list
   */
  playTrack(trackData, allTracks, index) {
    const playTrack = {
      id: parseInt(trackData.id) || 0,
      trackId: trackData.id,
      title: trackData.displayTitle,
      artist: trackData.release.artistName || Helpers.truncateAddress(trackData.release.artistAddress),
      cover: trackData.release.coverUrl,
      ipfsHash: trackData.audioCid,
      audioUrl: trackData.audioUrl,
      releaseId: trackData.release.id,
      duration: trackData.duration,
    };
    
    // Create queue from all tracks
    const queue = allTracks.map(t => ({
      id: parseInt(t.id) || 0,
      trackId: t.id,
      title: t.displayTitle,
      artist: t.release.artistName || Helpers.truncateAddress(t.release.artistAddress),
      cover: t.release.coverUrl,
      ipfsHash: t.audioCid,
      audioUrl: t.audioUrl,
      releaseId: t.release.id,
      duration: t.duration,
    }));
    
    Player.playTrack(playTrack, queue, index);
  },
};
