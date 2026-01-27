/**
 * XRP Music - Genre Page
 * Displays all tracks in a specific genre as an auto-generated playlist
 */

const GenrePage = {
  currentGenre: null,
  tracks: [],
  isLoading: false,
  offset: 0,
  limit: 50,
  hasMore: true,
  
  async render(params = {}) {
    const genreId = params.id || 'hiphop';
    this.currentGenre = Genres.get(genreId);
    this.tracks = [];
    this.offset = 0;
    this.hasMore = true;
    
    const container = document.getElementById('page-content');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
      <div class="genre-page">
        <div class="genre-header" style="--genre-color: ${this.currentGenre.color}">
          <div class="genre-header-bg"></div>
          <div class="genre-header-content">
            <div class="genre-icon-large">${this.currentGenre.icon}</div>
            <div class="genre-info">
              <span class="genre-label">GENRE PLAYLIST</span>
              <h1 class="genre-title">${this.currentGenre.name}</h1>
              <p class="genre-description">All ${this.currentGenre.name.toLowerCase()} tracks on XRP Music</p>
              <div class="genre-stats" id="genre-stats">
                <span class="loading-dots">Loading</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="genre-actions">
          <button class="btn-play-large" id="genre-play-btn" title="Play All">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="btn-icon-circle" id="genre-shuffle-btn" title="Shuffle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
          </button>
        </div>
        
        <div class="genre-tracks" id="genre-tracks">
          <div class="tracks-loading">
            <div class="spinner"></div>
            <p>Loading tracks...</p>
          </div>
        </div>
      </div>
      
      <style>
        .genre-page {
          padding-bottom: 120px;
        }
        
        .genre-header {
          position: relative;
          padding: 60px 24px 40px;
          overflow: hidden;
        }
        
        .genre-header-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, 
            color-mix(in srgb, var(--genre-color) 40%, transparent) 0%, 
            var(--bg-primary) 100%
          );
          z-index: 0;
        }
        
        .genre-header-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .genre-icon-large {
          font-size: 120px;
          line-height: 1;
          filter: drop-shadow(0 4px 20px rgba(0,0,0,0.3));
        }
        
        .genre-info {
          flex: 1;
        }
        
        .genre-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-primary);
          opacity: 0.8;
        }
        
        .genre-title {
          font-size: 64px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 8px 0 12px;
          line-height: 1;
        }
        
        .genre-description {
          font-size: 16px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        
        .genre-stats {
          font-size: 14px;
          color: var(--text-muted);
        }
        
        .genre-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .btn-play-large {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--success);
          border: none;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 100ms, background 100ms;
        }
        
        .btn-play-large:hover {
          transform: scale(1.05);
          background: #3be477;
        }
        
        .btn-play-large svg {
          margin-left: 3px;
        }
        
        .btn-icon-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms;
        }
        
        .btn-icon-circle:hover {
          border-color: var(--text-primary);
          color: var(--text-primary);
        }
        
        .genre-tracks {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        
        .tracks-loading {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-muted);
        }
        
        .tracks-loading .spinner {
          width: 32px;
          height: 32px;
          margin: 0 auto 16px;
        }
        
        .genre-track-list {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        
        .track-list-header {
          display: grid;
          grid-template-columns: 48px 1fr 200px 80px;
          gap: 16px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .genre-track-row {
          display: grid;
          grid-template-columns: 48px 1fr 200px 80px;
          gap: 16px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 100ms;
          border-bottom: 1px solid var(--border-color);
        }
        
        .genre-track-row:last-child {
          border-bottom: none;
        }
        
        .genre-track-row:hover {
          background: var(--bg-hover);
        }
        
        .genre-track-row:hover .track-num {
          display: none;
        }
        
        .genre-track-row:hover .track-play-btn {
          display: flex;
        }
        
        .genre-track-row.playing {
          background: rgba(59, 130, 246, 0.1);
        }
        
        .genre-track-row.playing .track-title {
          color: var(--accent);
        }
        
        .track-num-col {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        
        .track-play-btn {
          display: none;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0;
        }
        
        .track-info-col {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        
        .track-cover {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          overflow: hidden;
          flex-shrink: 0;
        }
        
        .track-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .track-details {
          min-width: 0;
        }
        
        .track-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .track-artist {
          font-size: 13px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .track-artist-link {
          color: var(--text-muted);
          text-decoration: none;
        }
        
        .track-artist-link:hover {
          color: var(--text-primary);
          text-decoration: underline;
        }
        
        .track-release-col {
          display: flex;
          align-items: center;
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .track-release-link {
          color: var(--text-muted);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .track-release-link:hover {
          color: var(--text-primary);
        }
        
        .track-duration-col {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .load-more-container {
          text-align: center;
          padding: 24px;
        }
        
        .empty-genre {
          text-align: center;
          padding: 80px 20px;
          color: var(--text-muted);
        }
        
        .empty-genre-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .empty-genre h3 {
          font-size: 20px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        
        @media (max-width: 768px) {
          .genre-header-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .genre-icon-large {
            font-size: 80px;
          }
          
          .genre-title {
            font-size: 36px;
          }
          
          .track-list-header {
            display: none;
          }
          
          .genre-track-row {
            grid-template-columns: 40px 1fr 60px;
          }
          
          .track-release-col {
            display: none;
          }
        }
      </style>
    `;
    
    // Bind events
    this.bindEvents();
    
    // Load tracks
    await this.loadTracks();
  },
  
  bindEvents() {
    // Play all button
    document.getElementById('genre-play-btn')?.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        this.playTrack(0);
      }
    });
    
    // Shuffle button
    document.getElementById('genre-shuffle-btn')?.addEventListener('click', () => {
      GenrePlaylists.shuffleGenre(this.currentGenre.id);
    });
  },
  
  async loadTracks() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;
    
    try {
      const newTracks = await GenrePlaylists.getTracksForGenre(this.currentGenre.id, {
        limit: this.limit,
        offset: this.offset
      });
      
      this.tracks = [...this.tracks, ...newTracks];
      this.offset += newTracks.length;
      this.hasMore = newTracks.length === this.limit;
      
      this.renderTracks();
      this.updateStats();
      
    } catch (error) {
      console.error('Failed to load genre tracks:', error);
    }
    
    this.isLoading = false;
  },
  
  renderTracks() {
    const container = document.getElementById('genre-tracks');
    if (!container) return;
    
    if (this.tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-genre">
          <div class="empty-genre-icon">${this.currentGenre.icon}</div>
          <h3>No ${this.currentGenre.name} tracks yet</h3>
          <p>Be the first to upload ${this.currentGenre.name.toLowerCase()} music!</p>
        </div>
      `;
      return;
    }
    
    const currentTrack = AppState.player.currentTrack;
    
    container.innerHTML = `
      <div class="genre-track-list">
        <div class="track-list-header">
          <span>#</span>
          <span>Title</span>
          <span>Release</span>
          <span style="text-align: right;">Duration</span>
        </div>
        ${this.tracks.map((track, idx) => {
          const isPlaying = currentTrack && currentTrack.trackId === track.id?.toString();
          return `
            <div class="genre-track-row ${isPlaying ? 'playing' : ''}" data-idx="${idx}">
              <div class="track-num-col">
                <span class="track-num">${isPlaying ? '▶' : idx + 1}</span>
                <button class="track-play-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>
              <div class="track-info-col">
                <div class="track-cover">
                  <img src="${track.coverUrl || '/placeholder.png'}" alt="${track.title}" onerror="this.src='/placeholder.png'">
                </div>
                <div class="track-details">
                  <div class="track-title">${track.title}</div>
                  <a class="track-artist-link" href="#" data-artist="${track.artistAddress}">${track.artistName || 'Unknown Artist'}</a>
                </div>
              </div>
              <div class="track-release-col">
                <a class="track-release-link" href="#" data-release="${track.releaseId}">${track.releaseTitle || ''}</a>
              </div>
              <div class="track-duration-col">
                ${Helpers.formatDuration(track.duration || 0)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ${this.hasMore ? `
        <div class="load-more-container">
          <button class="btn btn-secondary" id="load-more-btn">Load More</button>
        </div>
      ` : ''}
    `;
    
    // Bind track row clicks
    container.querySelectorAll('.genre-track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.track-artist-link')) {
          e.preventDefault();
          const artistAddress = e.target.dataset.artist;
          if (artistAddress) Router.navigate('artist', { address: artistAddress });
          return;
        }
        if (e.target.closest('.track-release-link')) {
          e.preventDefault();
          const releaseId = e.target.dataset.release;
          if (releaseId) this.openRelease(releaseId);
          return;
        }
        
        const idx = parseInt(row.dataset.idx);
        this.playTrack(idx);
      });
    });
    
    // Load more button
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
      this.loadTracks();
    });
  },
  
  async updateStats() {
    const statsEl = document.getElementById('genre-stats');
    if (!statsEl) return;
    
    const count = await GenrePlaylists.getGenreTrackCount(this.currentGenre.id);
    const totalDuration = this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    
    statsEl.innerHTML = `
      <span>${count} track${count !== 1 ? 's' : ''}</span>
      ${totalDuration > 0 ? `<span> • ${this.formatTotalDuration(totalDuration)}</span>` : ''}
    `;
  },
  
  formatTotalDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  },
  
  playTrack(index) {
    if (index < 0 || index >= this.tracks.length) return;
    
    const queue = this.tracks.map(track => ({
      id: track.id,
      trackId: track.id?.toString(),
      title: track.title,
      artist: track.artistName || 'Unknown Artist',
      cover: track.coverUrl || '/placeholder.png',
      ipfsHash: track.audioCid,
      releaseId: track.releaseId,
      duration: track.duration,
    }));
    
    Player.playTrack(queue[index], queue, index);
    this.renderTracks(); // Re-render to show playing state
  },
  
  async openRelease(releaseId) {
    try {
      const data = await API.getRelease(releaseId);
      if (data?.release) {
        Modals.showRelease(data.release);
      }
    } catch (error) {
      console.error('Failed to open release:', error);
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenrePage;
}
