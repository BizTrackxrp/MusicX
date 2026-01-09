/**
 * XRP Music - Liked Songs Page
 * Spotify-style liked songs playlist view
 */

const LikedSongsPage = {
  tracks: [],
  isLoading: true,
  
  async render() {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    // Check if logged in
    if (!AppState.user?.address) {
      container.innerHTML = `
        <div class="liked-empty">
          <div class="liked-empty-icon">💜</div>
          <h2>Liked Songs</h2>
          <p>Connect your wallet to see your liked songs</p>
          <button class="btn btn-primary" onclick="Modals.showAuth()">Connect Wallet</button>
        </div>
      `;
      return;
    }
    
    // Show loading state
    container.innerHTML = `
      <div class="liked-page">
        <div class="liked-header">
          <div class="liked-header-gradient"></div>
          <div class="liked-header-content">
            <div class="liked-cover">
              <div class="liked-cover-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="white">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </div>
            </div>
            <div class="liked-info">
              <span class="liked-label">Playlist</span>
              <h1 class="liked-title">Liked Songs</h1>
              <div class="liked-meta">
                <img class="liked-user-avatar" src="${AppState.profile?.avatarUrl || ''}" alt="" onerror="this.style.display='none'">
                <span class="liked-user-name">${AppState.profile?.name || Helpers.truncateAddress(AppState.user.address)}</span>
                <span class="liked-dot">•</span>
                <span class="liked-count" id="liked-count">0 songs</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="liked-body">
          <div class="liked-actions">
            <button class="liked-play-btn" id="liked-play-btn" disabled>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
            <button class="liked-shuffle-btn" id="liked-shuffle-btn" disabled title="Shuffle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
          </div>
          
          <div class="liked-tracks-container">
            <div class="liked-tracks-header">
              <span class="col-num">#</span>
              <span class="col-title">Title</span>
              <span class="col-album">Album</span>
              <span class="col-date">Date added</span>
              <span class="col-duration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
              <span class="col-actions"></span>
            </div>
            
            <div class="liked-tracks-list" id="liked-tracks-list">
              <div class="liked-loading">
                <div class="spinner"></div>
                <p>Loading your liked songs...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .liked-page {
          min-height: 100%;
          padding-bottom: 100px;
        }
        
        /* Header */
        .liked-header {
          position: relative;
          padding: 80px 32px 24px;
          background: linear-gradient(180deg, #5038a0 0%, #1a1a2e 100%);
        }
        .liked-header-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(transparent 0, rgba(0,0,0,0.5) 100%);
        }
        .liked-header-content {
          position: relative;
          display: flex;
          align-items: flex-end;
          gap: 24px;
        }
        .liked-cover {
          width: 232px;
          height: 232px;
          background: linear-gradient(135deg, #450af5 0%, #8e8ee5 100%);
          border-radius: 4px;
          box-shadow: 0 4px 60px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .liked-cover-icon svg {
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
        }
        .liked-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .liked-label {
          font-size: 14px;
          font-weight: 500;
          color: white;
        }
        .liked-title {
          font-size: 72px;
          font-weight: 900;
          color: white;
          line-height: 1.1;
          margin: 0;
          letter-spacing: -0.04em;
        }
        .liked-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin-top: 8px;
        }
        .liked-user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }
        .liked-user-name {
          font-weight: 600;
          color: white;
        }
        .liked-dot {
          opacity: 0.6;
        }
        
        /* Body */
        .liked-body {
          padding: 24px 32px;
          background: linear-gradient(rgba(80, 56, 160, 0.2) 0%, var(--bg-primary) 200px);
        }
        .liked-actions {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 24px;
        }
        .liked-play-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #1db954;
          border: none;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 100ms, background 100ms;
        }
        .liked-play-btn:hover:not(:disabled) {
          transform: scale(1.06);
          background: #1ed760;
        }
        .liked-play-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .liked-play-btn svg {
          margin-left: 3px;
        }
        .liked-shuffle-btn {
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: color 100ms;
        }
        .liked-shuffle-btn:hover:not(:disabled) {
          color: white;
        }
        .liked-shuffle-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .liked-shuffle-btn.active {
          color: #1db954;
        }
        
        /* Track List */
        .liked-tracks-container {
          background: transparent;
        }
        .liked-tracks-header {
          display: grid;
          grid-template-columns: 48px 1fr 1fr 140px 80px 48px;
          gap: 16px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: var(--text-muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .col-num { text-align: center; }
        .col-duration { 
          display: flex; 
          justify-content: flex-end; 
          align-items: center; 
        }
        .col-actions { width: 48px; }
        
        .liked-tracks-list {
          margin-top: 8px;
        }
        
        /* Track Row */
        .liked-track-row {
          display: grid;
          grid-template-columns: 48px 1fr 1fr 140px 80px 48px;
          gap: 16px;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 100ms;
        }
        .liked-track-row:hover {
          background: rgba(255,255,255,0.1);
        }
        .liked-track-row:hover .track-num { display: none; }
        .liked-track-row:hover .track-play-icon { display: flex; }
        .liked-track-row:hover .track-actions-btn { opacity: 1; }
        .liked-track-row.playing {
          background: rgba(255,255,255,0.1);
        }
        .liked-track-row.playing .track-num { display: none; }
        .liked-track-row.playing .track-playing-icon { display: flex; }
        .liked-track-row.playing .track-title-text { color: #1db954; }
        
        .track-num-col {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 16px;
        }
        .track-play-icon, .track-playing-icon {
          display: none;
          color: white;
        }
        .track-playing-icon {
          color: #1db954;
        }
        
        .track-title-col {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .track-cover {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          flex-shrink: 0;
          background: var(--bg-secondary);
        }
        .track-title-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .track-title-text {
          font-size: 16px;
          font-weight: 400;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-artist-text {
          font-size: 14px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-artist-text:hover {
          color: white;
          text-decoration: underline;
        }
        
        .track-album-col {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-album-col:hover {
          color: white;
          text-decoration: underline;
        }
        
        .track-date-col {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          font-size: 14px;
        }
        
        .track-duration-col {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: var(--text-muted);
          font-size: 14px;
        }
        
        .track-actions-col {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .track-actions-btn {
          opacity: 0;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: opacity 100ms;
        }
        .track-actions-btn:hover {
          color: white;
        }
        
        /* Empty & Loading States */
        .liked-loading, .liked-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }
        .liked-loading p, .liked-empty p {
          color: var(--text-muted);
          margin-top: 16px;
        }
        .liked-empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        .liked-empty h2 {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .liked-empty .btn {
          margin-top: 24px;
        }
        
        /* Track Context Menu */
        .track-context-menu {
          position: fixed;
          background: #282828;
          border-radius: 4px;
          padding: 4px;
          min-width: 200px;
          box-shadow: 0 16px 24px rgba(0,0,0,0.3);
          z-index: 1000;
        }
        .track-context-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 12px;
          color: var(--text-secondary);
          font-size: 14px;
          border-radius: 2px;
          cursor: pointer;
          transition: background 100ms;
        }
        .track-context-menu-item:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .track-context-menu-item.danger:hover {
          color: #f15e6c;
        }
        .track-context-menu-divider {
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 4px 0;
        }
        
        /* Responsive */
        @media (max-width: 900px) {
          .liked-header-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .liked-cover {
            width: 192px;
            height: 192px;
          }
          .liked-title {
            font-size: 48px;
          }
          .liked-meta {
            justify-content: center;
          }
          .liked-tracks-header {
            display: none;
          }
          .liked-track-row {
            grid-template-columns: 48px 1fr 48px;
          }
          .track-album-col, .track-date-col, .track-duration-col {
            display: none;
          }
        }
        
        @media (max-width: 600px) {
          .liked-header {
            padding: 60px 16px 20px;
          }
          .liked-body {
            padding: 16px;
          }
          .liked-cover {
            width: 152px;
            height: 152px;
          }
          .liked-cover-icon svg {
            width: 48px;
            height: 48px;
          }
          .liked-title {
            font-size: 32px;
          }
        }
      </style>
    `;
    
    // Load tracks
    await this.loadTracks();
  },
  
  async loadTracks() {
    try {
      const response = await fetch(`/api/likes?user=${AppState.user.address}`);
      const data = await response.json();
      
      this.tracks = data.tracks || [];
      this.isLoading = false;
      
      // Calculate total duration
      const totalSeconds = this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      let durationText = '';
      if (hours > 0) {
        durationText = `${hours} hr ${minutes} min`;
      } else if (minutes > 0) {
        durationText = `${minutes} min`;
      }
      
      // Update count with duration
      const countEl = document.getElementById('liked-count');
      if (countEl) {
        const songText = `${this.tracks.length} song${this.tracks.length !== 1 ? 's' : ''}`;
        countEl.textContent = durationText ? `${songText}, ${durationText}` : songText;
      }
      
      // Enable buttons if we have tracks
      if (this.tracks.length > 0) {
        document.getElementById('liked-play-btn')?.removeAttribute('disabled');
        document.getElementById('liked-shuffle-btn')?.removeAttribute('disabled');
      }
      
      // Render tracks
      this.renderTracks();
      
      // Bind events
      this.bindEvents();
      
    } catch (error) {
      console.error('Failed to load liked songs:', error);
      document.getElementById('liked-tracks-list').innerHTML = `
        <div class="liked-empty">
          <p>Failed to load liked songs</p>
          <button class="btn btn-secondary" onclick="LikedSongsPage.loadTracks()">Try Again</button>
        </div>
      `;
    }
  },
  
  renderTracks() {
    const container = document.getElementById('liked-tracks-list');
    if (!container) return;
    
    if (this.tracks.length === 0) {
      container.innerHTML = `
        <div class="liked-empty">
          <div class="liked-empty-icon">💜</div>
          <h2>Songs you like will appear here</h2>
          <p>Save songs by tapping the heart icon</p>
          <button class="btn btn-primary" onclick="Router.navigate('stream')">Find Songs</button>
        </div>
      `;
      return;
    }
    
    const currentTrackId = AppState.player.currentTrack?.trackId;
    
    container.innerHTML = this.tracks.map((track, idx) => {
      const isPlaying = currentTrackId === track.track_id;
      const dateAdded = track.liked_at ? this.formatDateAdded(track.liked_at) : '';
      
      return `
        <div class="liked-track-row ${isPlaying ? 'playing' : ''}" 
             data-idx="${idx}" 
             data-track-id="${track.track_id}"
             data-release-id="${track.release_id}">
          <div class="track-num-col">
            <span class="track-num">${idx + 1}</span>
            <span class="track-play-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </span>
            <span class="track-playing-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="4" height="16"></rect>
                <rect x="12" y="4" width="4" height="16"></rect>
              </svg>
            </span>
          </div>
          
          <div class="track-title-col">
            <img class="track-cover" src="${track.cover_url || '/placeholder.png'}" alt="${track.title}" onerror="this.src='/placeholder.png'">
            <div class="track-title-info">
              <span class="track-title-text">${track.title}</span>
              <span class="track-artist-text" data-artist="${track.artist_address}">${track.artist_name || Helpers.truncateAddress(track.artist_address)}</span>
            </div>
          </div>
          
          <div class="track-album-col" data-release-id="${track.release_id}">${track.release_title || ''}</div>
          
          <div class="track-date-col">${dateAdded}</div>
          
          <div class="track-duration-col">${Helpers.formatDuration(track.duration || 0)}</div>
          
          <div class="track-actions-col">
            <button class="track-actions-btn" data-idx="${idx}" title="More options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },
  
  bindEvents() {
    // Play all button
    document.getElementById('liked-play-btn')?.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        this.playAll(false);
      }
    });
    
    // Shuffle button
    document.getElementById('liked-shuffle-btn')?.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        this.playAll(true);
      }
    });
    
    // Track row clicks
    document.querySelectorAll('.liked-track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking actions button or links
        if (e.target.closest('.track-actions-btn') || 
            e.target.closest('.track-artist-text') ||
            e.target.closest('.track-album-col')) return;
        
        const idx = parseInt(row.dataset.idx);
        this.playTrack(idx);
      });
    });
    
    // Artist links
    document.querySelectorAll('.track-artist-text').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const artistAddress = el.dataset.artist;
        if (artistAddress) {
          Router.navigate('artist', { address: artistAddress });
        }
      });
    });
    
    // Album links
    document.querySelectorAll('.track-album-col').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = el.dataset.releaseId;
        if (releaseId) {
          this.openRelease(releaseId);
        }
      });
    });
    
    // Actions menu
    document.querySelectorAll('.track-actions-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        this.showTrackMenu(idx, e);
      });
    });
  },
  
  playTrack(idx) {
    const track = this.tracks[idx];
    if (!track) return;
    
    const queue = this.tracks.map((t, i) => ({
      id: parseInt(t.track_id) || i,
      trackId: t.track_id,
      title: t.title,
      artist: t.artist_name || Helpers.truncateAddress(t.artist_address),
      cover: t.cover_url,
      ipfsHash: t.audio_cid,
      audioUrl: t.audio_url,
      releaseId: t.release_id,
      duration: t.duration,
    }));
    
    Player.playTrack(queue[idx], queue, idx);
    this.updatePlayingState();
  },
  
  playAll(shuffle = false) {
    if (this.tracks.length === 0) return;
    
    let queue = this.tracks.map((t, i) => ({
      id: parseInt(t.track_id) || i,
      trackId: t.track_id,
      title: t.title,
      artist: t.artist_name || Helpers.truncateAddress(t.artist_address),
      cover: t.cover_url,
      ipfsHash: t.audio_cid,
      audioUrl: t.audio_url,
      releaseId: t.release_id,
      duration: t.duration,
    }));
    
    if (shuffle) {
      // Shuffle the queue
      queue = this.shuffleArray([...queue]);
      // Turn on shuffle mode in player
      if (!AppState.player.isShuffled) {
        Player.toggleShuffle();
      }
    }
    
    Player.playTrack(queue[0], queue, 0);
    this.updatePlayingState();
    
    // Update shuffle button state
    document.getElementById('liked-shuffle-btn')?.classList.toggle('active', shuffle);
  },
  
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  
  updatePlayingState() {
    const currentTrackId = AppState.player.currentTrack?.trackId;
    document.querySelectorAll('.liked-track-row').forEach(row => {
      const trackId = row.dataset.trackId;
      row.classList.toggle('playing', trackId === currentTrackId);
    });
  },
  
  showTrackMenu(idx, event) {
    // Remove any existing menu
    document.querySelector('.track-context-menu')?.remove();
    
    const track = this.tracks[idx];
    if (!track) return;
    
    const menu = document.createElement('div');
    menu.className = 'track-context-menu';
    menu.innerHTML = `
      <div class="track-context-menu-item" data-action="add-to-playlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add to playlist
      </div>
      <div class="track-context-menu-item danger" data-action="remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        Remove from your Liked Songs
      </div>
      <div class="track-context-menu-divider"></div>
      <div class="track-context-menu-item" data-action="add-to-queue">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        Add to queue
      </div>
      <div class="track-context-menu-divider"></div>
      <div class="track-context-menu-item" data-action="go-to-artist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        Go to artist
      </div>
      <div class="track-context-menu-item" data-action="go-to-album">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Go to album
      </div>
    `;
    
    // Position menu - check viewport boundaries
    const btnRect = event.target.closest('.track-actions-btn').getBoundingClientRect();
    const menuHeight = 250; // Approximate menu height
    const menuWidth = 220;
    const padding = 8;
    const playerBarHeight = 80; // Account for player bar at bottom
    
    // Calculate available space
    const spaceBelow = window.innerHeight - btnRect.bottom - playerBarHeight - padding;
    const spaceAbove = btnRect.top - padding;
    
    // Append first to get actual dimensions
    document.body.appendChild(menu);
    const actualMenuHeight = menu.offsetHeight;
    
    // Position horizontally - keep within viewport
    let left = btnRect.left;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }
    menu.style.left = `${left}px`;
    
    // Position vertically - prefer below, but flip to above if not enough space
    if (spaceBelow >= actualMenuHeight) {
      // Enough space below - position below the button
      menu.style.top = `${btnRect.bottom + 4}px`;
    } else if (spaceAbove >= actualMenuHeight) {
      // Not enough below, but enough above - position above the button
      menu.style.top = `${btnRect.top - actualMenuHeight - 4}px`;
    } else {
      // Not enough space either way - position at top of viewport with scroll
      menu.style.top = `${padding}px`;
      menu.style.maxHeight = `${window.innerHeight - playerBarHeight - padding * 2}px`;
      menu.style.overflowY = 'auto';
    }
    
    // Handle menu actions
    menu.querySelectorAll('.track-context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleMenuAction(action, track, idx);
        menu.remove();
      });
    });
    
    // Close on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  },
  
  async handleMenuAction(action, track, idx) {
    switch (action) {
      case 'add-to-playlist':
        // TODO: Show playlist picker modal
        Modals.showToast('Playlist picker coming soon!');
        break;
        
      case 'remove':
        await this.removeTrack(track, idx);
        break;
        
      case 'add-to-queue':
        this.addToQueue(track);
        break;
        
      case 'go-to-artist':
        if (track.artist_address) {
          Router.navigate('artist', { address: track.artist_address });
        }
        break;
        
      case 'go-to-album':
        if (track.release_id) {
          this.openRelease(track.release_id);
        }
        break;
    }
  },
  
  async removeTrack(track, idx) {
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlike',
          userAddress: AppState.user.address,
          trackId: track.track_id,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        // Remove from local array
        this.tracks.splice(idx, 1);
        
        // Update state
        if (AppState.likes?.trackIds) {
          const trackIdx = AppState.likes.trackIds.indexOf(track.track_id);
          if (trackIdx > -1) AppState.likes.trackIds.splice(trackIdx, 1);
        }
        
        // Recalculate total duration
        const totalSeconds = this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        let durationText = '';
        if (hours > 0) {
          durationText = `${hours} hr ${minutes} min`;
        } else if (minutes > 0) {
          durationText = `${minutes} min`;
        }
        
        // Update UI with count and duration
        const songText = `${this.tracks.length} song${this.tracks.length !== 1 ? 's' : ''}`;
        document.getElementById('liked-count').textContent = durationText ? `${songText}, ${durationText}` : songText;
        
        this.renderTracks();
        this.bindEvents();
        
        Modals.showToast('Removed from your Liked Songs');
      }
    } catch (error) {
      console.error('Failed to remove track:', error);
      Modals.showToast('Failed to remove track');
    }
  },
  
  addToQueue(track) {
    const queueTrack = {
      id: parseInt(track.track_id),
      trackId: track.track_id,
      title: track.title,
      artist: track.artist_name || Helpers.truncateAddress(track.artist_address),
      cover: track.cover_url,
      ipfsHash: track.audio_cid,
      audioUrl: track.audio_url,
      releaseId: track.release_id,
      duration: track.duration,
    };
    
    // Add to queue
    AppState.player.queue.push(queueTrack);
    Modals.showToast(`Added to queue`);
  },
  
  async openRelease(releaseId) {
    try {
      const data = await API.getRelease(releaseId);
      if (data?.release) {
        Modals.showRelease(data.release);
      }
    } catch (error) {
      console.error('Failed to load release:', error);
    }
  },
  
  formatDateAdded(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  },
};

// Export for use
if (typeof window !== 'undefined') {
  window.LikedSongsPage = LikedSongsPage;
}
