/**
 * XRP Music - Browse Playlists Page
 * Shows all public playlists with composite album art grid covers
 */

const BrowsePlaylistsPage = {
  playlists: [],
  isLoading: false,
  
  async render() {
    const main = document.getElementById('main-content');
    if (!main) return;
    
    main.innerHTML = `
      <div class="browse-playlists-page">
        <div class="browse-playlists-header">
          <h1>Browse Playlists</h1>
          <p>Discover playlists created by the community</p>
        </div>
        
        <div class="browse-playlists-grid" id="browse-playlists-grid">
          <div class="browse-playlists-loading">
            <div class="spinner"></div>
            <p>Loading playlists...</p>
          </div>
        </div>
      </div>
      
      <style>
        .browse-playlists-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .browse-playlists-header {
          margin-bottom: 32px;
        }
        .browse-playlists-header h1 {
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }
        .browse-playlists-header p {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }
        .browse-playlists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 24px;
        }
        .browse-playlists-loading {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: var(--text-muted);
        }
        .browse-playlists-loading .spinner {
          margin-bottom: 16px;
        }
        .browse-playlists-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px;
          color: var(--text-muted);
        }
        .browse-playlists-empty h3 {
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        
        /* Playlist Card */
        .playlist-card {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: 16px;
          cursor: pointer;
          transition: all 200ms ease;
        }
        .playlist-card:hover {
          background: var(--bg-hover);
          transform: translateY(-4px);
        }
        .playlist-card:hover .playlist-card-play {
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Composite Album Art Cover */
        .playlist-card-cover {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: 16px;
          background: var(--bg-secondary);
        }
        
        /* Single image */
        .playlist-card-cover.single img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* 2 images side by side */
        .playlist-card-cover.duo {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .playlist-card-cover.duo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* 3 images - 2 on top, 1 on bottom spanning full width */
        .playlist-card-cover.trio {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }
        .playlist-card-cover.trio img:nth-child(1) {
          grid-column: 1;
          grid-row: 1;
        }
        .playlist-card-cover.trio img:nth-child(2) {
          grid-column: 2;
          grid-row: 1;
        }
        .playlist-card-cover.trio img:nth-child(3) {
          grid-column: 1 / -1;
          grid-row: 2;
        }
        .playlist-card-cover.trio img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* 4 images in grid */
        .playlist-card-cover.quad {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }
        .playlist-card-cover.quad img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* Empty playlist placeholder */
        .playlist-card-cover.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #450af5, #8e8ee5);
        }
        .playlist-card-cover.empty svg {
          width: 48px;
          height: 48px;
          color: rgba(255,255,255,0.7);
        }
        
        /* Play button overlay */
        .playlist-card-play {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px);
          transition: all 200ms ease;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        }
        .playlist-card-play:hover {
          transform: translateY(0) scale(1.05);
          background: var(--accent-hover);
        }
        .playlist-card-play svg {
          margin-left: 2px;
        }
        
        /* Card info */
        .playlist-card-info {
          min-height: 60px;
        }
        .playlist-card-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .playlist-card-meta {
          font-size: 13px;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .playlist-card-owner {
          color: var(--text-secondary);
        }
        
        @media (max-width: 600px) {
          .browse-playlists-page {
            padding: 16px;
          }
          .browse-playlists-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .playlist-card {
            padding: 12px;
          }
          .playlist-card-name {
            font-size: 14px;
          }
        }
      </style>
    `;
    
    await this.loadPlaylists();
  },
  
  async loadPlaylists() {
    const grid = document.getElementById('browse-playlists-grid');
    if (!grid) return;
    
    this.isLoading = true;
    
    try {
      // Fetch all public playlists
      const response = await fetch('/api/playlists?browse=true');
      const data = await response.json();
      
      this.playlists = data.playlists || [];
      
      if (this.playlists.length === 0) {
        grid.innerHTML = `
          <div class="browse-playlists-empty">
            <h3>No playlists yet</h3>
            <p>Be the first to create a playlist!</p>
          </div>
        `;
        return;
      }
      
      grid.innerHTML = this.playlists.map(playlist => this.renderPlaylistCard(playlist)).join('');
      
      // Bind click events
      grid.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.playlist-card-play')) return;
          const playlistId = card.dataset.playlistId;
          Router.navigate('playlist', { id: playlistId });
        });
      });
      
      // Bind play button events
      grid.querySelectorAll('.playlist-card-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const playlistId = btn.dataset.playlistId;
          this.playPlaylist(playlistId);
        });
      });
      
    } catch (error) {
      console.error('Failed to load playlists:', error);
      grid.innerHTML = `
        <div class="browse-playlists-empty">
          <h3>Failed to load playlists</h3>
          <p>Please try again later</p>
        </div>
      `;
    }
    
    this.isLoading = false;
  },
  
  /**
   * Render a playlist card with composite album art
   */
  renderPlaylistCard(playlist) {
    const covers = playlist.track_covers || [];
    const trackCount = playlist.track_count || 0;
    const ownerName = playlist.owner_name || Helpers.truncateAddress(playlist.owner_address || '');
    
    // Determine cover layout based on number of unique covers
    let coverHTML = '';
    let coverClass = 'empty';
    
    if (covers.length === 0) {
      coverClass = 'empty';
      coverHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      `;
    } else if (covers.length === 1) {
      coverClass = 'single';
      coverHTML = `<img src="${covers[0]}" alt="" onerror="this.src='/placeholder.png'">`;
    } else if (covers.length === 2) {
      coverClass = 'duo';
      coverHTML = covers.slice(0, 2).map(c => `<img src="${c}" alt="" onerror="this.src='/placeholder.png'">`).join('');
    } else if (covers.length === 3) {
      coverClass = 'trio';
      coverHTML = covers.slice(0, 3).map(c => `<img src="${c}" alt="" onerror="this.src='/placeholder.png'">`).join('');
    } else {
      coverClass = 'quad';
      coverHTML = covers.slice(0, 4).map(c => `<img src="${c}" alt="" onerror="this.src='/placeholder.png'">`).join('');
    }
    
    return `
      <div class="playlist-card" data-playlist-id="${playlist.id}">
        <div class="playlist-card-cover ${coverClass}">
          ${coverHTML}
          <button class="playlist-card-play" data-playlist-id="${playlist.id}" title="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
        <div class="playlist-card-info">
          <div class="playlist-card-name">${playlist.name}</div>
          <div class="playlist-card-meta">
            <span class="playlist-card-owner">By ${ownerName}</span>
            <span>${trackCount} song${trackCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Play all tracks in a playlist
   */
  async playPlaylist(playlistId) {
    try {
      const response = await fetch(`/api/playlists?id=${playlistId}`);
      const data = await response.json();
      
      if (!data.playlist || !data.tracks || data.tracks.length === 0) {
        Modals.showToast('Playlist is empty');
        return;
      }
      
      // Build queue from tracks
      const queue = data.tracks.map(t => ({
        id: t.track_id,
        trackId: t.track_id?.toString(),
        title: t.title,
        artist: t.artist_name || 'Unknown Artist',
        cover: t.cover_url,
        ipfsHash: t.audio_cid,
        releaseId: t.release_id,
        duration: t.duration,
      }));
      
      Player.playTrack(queue[0], queue, 0);
      Modals.showToast(`Playing ${data.playlist.name}`);
      
    } catch (error) {
      console.error('Failed to play playlist:', error);
      Modals.showToast('Failed to play playlist');
    }
  },
};

// Make globally available
if (typeof window !== 'undefined') {
  window.BrowsePlaylistsPage = BrowsePlaylistsPage;
}
