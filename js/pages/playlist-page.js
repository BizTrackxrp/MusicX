/**
 * XRP Music - Playlist Page
 * Shows a single playlist with its tracks
 * 
 * UPDATED: Track row click opens release modal, play button plays track
 */

const PlaylistPage = {
  playlist: null,
  tracks: [],
  isLoading: false,
  
  async render(params = {}) {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    const playlistId = params.id;
    
    if (!playlistId) {
      container.innerHTML = `
        <div class="playlist-page-error">
          <h2>Playlist Not Found</h2>
          <p>No playlist ID provided</p>
          <button class="btn btn-primary" onclick="Router.navigate('stream')">Go Home</button>
        </div>
      `;
      return;
    }
    
    // Show loading state
    container.innerHTML = `
      <div class="playlist-page-loading">
        <div class="spinner"></div>
        <p>Loading playlist...</p>
      </div>
    `;
    
    await this.loadPlaylist(playlistId);
  },
  
  async loadPlaylist(playlistId) {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    this.isLoading = true;
    
    try {
      const response = await fetch(`/api/playlists?id=${playlistId}&withTracks=true`);
      const data = await response.json();
      
      console.log('Playlist API response:', data);
      
      if (!data.playlist) {
        container.innerHTML = `
          <div class="playlist-page-error">
            <h2>Playlist Not Found</h2>
            <p>This playlist doesn't exist or has been deleted.</p>
            <button class="btn btn-primary" onclick="Router.navigate('stream')">Go Home</button>
          </div>
        `;
        return;
      }
      
      this.playlist = data.playlist;
      this.tracks = data.tracks || data.playlist.tracks || [];
      
      console.log('Loaded tracks:', this.tracks);
      
      this.renderPlaylist();
      
    } catch (error) {
      console.error('Failed to load playlist:', error);
      container.innerHTML = `
        <div class="playlist-page-error">
          <h2>Error Loading Playlist</h2>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="Router.navigate('stream')">Go Home</button>
        </div>
      `;
    }
    
    this.isLoading = false;
  },
  
  renderPlaylist() {
    const container = document.getElementById('page-content');
    if (!container || !this.playlist) return;
    
    const playlist = this.playlist;
    const tracks = this.tracks;
    const ownerName = playlist.owner_name || Helpers.truncateAddress(playlist.owner_address || '');
    const isOwner = AppState.user?.address === playlist.owner_address;
    
    // Build composite cover
    const covers = tracks.slice(0, 4).map(t => t.cover_url).filter(Boolean);
    const coverHTML = this.buildCompositeCover(covers);
    
    // Calculate total duration
    const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const durationText = totalDuration > 3600 
      ? `${Math.floor(totalDuration / 3600)} hr ${Math.floor((totalDuration % 3600) / 60)} min`
      : `${Math.floor(totalDuration / 60)} min ${totalDuration % 60} sec`;
    
    container.innerHTML = `
      <div class="playlist-page">
        <!-- Header -->
        <div class="playlist-header">
          <div class="playlist-header-cover">
            ${coverHTML}
          </div>
          <div class="playlist-header-info">
            <span class="playlist-type-label">PLAYLIST</span>
            <h1 class="playlist-title">${playlist.name}</h1>
            ${playlist.description ? `<p class="playlist-description">${playlist.description}</p>` : ''}
            <div class="playlist-meta">
              <span class="playlist-owner">${ownerName}</span>
              <span class="playlist-meta-dot">•</span>
              <span>${tracks.length} track${tracks.length !== 1 ? 's' : ''}</span>
              ${totalDuration > 0 ? `<span class="playlist-meta-dot">•</span><span>${durationText}</span>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Actions Bar -->
        <div class="playlist-actions-bar">
          <button class="btn-play-large" id="play-playlist-btn" ${tracks.length === 0 ? 'disabled' : ''}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="btn-icon-circle" id="shuffle-playlist-btn" title="Shuffle" ${tracks.length === 0 ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
          </button>
          ${isOwner ? `
            <button class="btn-icon-circle" id="edit-playlist-btn" title="Edit Playlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon-circle" id="delete-playlist-btn" title="Delete Playlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          ` : ''}
        </div>
        
        <!-- Track List -->
        <div class="playlist-track-list">
          ${tracks.length === 0 ? `
            <div class="playlist-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              <h3>Empty Playlist</h3>
              <p>This playlist has no tracks yet.</p>
            </div>
          ` : `
            <div class="track-list-header">
              <span class="track-col-num">#</span>
              <span class="track-col-title">TITLE</span>
              <span class="track-col-album">ALBUM</span>
              <span class="track-col-duration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
              ${isOwner ? '<span class="track-col-actions"></span>' : ''}
            </div>
            ${tracks.map((track, idx) => this.renderTrackRow(track, idx, isOwner)).join('')}
          `}
        </div>
      </div>
      
      <style>
        .playlist-page { padding-bottom: 100px; }
        .playlist-page-loading, .playlist-page-error {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 400px; color: var(--text-muted); text-align: center;
        }
        .playlist-page-error h2 { color: var(--text-primary); margin-bottom: 8px; }
        .playlist-page-error .btn { margin-top: 20px; }
        .playlist-header {
          display: flex; gap: 24px; padding: 40px 32px;
          background: linear-gradient(180deg, rgba(80, 80, 80, 0.6) 0%, var(--bg-primary) 100%);
        }
        .playlist-header-cover {
          width: 232px; height: 232px; border-radius: var(--radius-lg); overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5); flex-shrink: 0; background: var(--bg-secondary);
        }
        .playlist-header-info { display: flex; flex-direction: column; justify-content: flex-end; min-width: 0; }
        .playlist-type-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-primary); margin-bottom: 8px; }
        .playlist-title { font-size: 48px; font-weight: 800; color: var(--text-primary); margin: 0 0 16px 0; line-height: 1.1; }
        .playlist-description { font-size: 14px; color: var(--text-secondary); margin: 0 0 16px 0; max-width: 600px; }
        .playlist-meta { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); }
        .playlist-meta-dot { opacity: 0.5; }
        .playlist-owner { font-weight: 600; color: var(--text-primary); }
        .playlist-header-cover.single img, .playlist-header-cover img.single-cover { width: 100%; height: 100%; object-fit: cover; }
        .playlist-header-cover.duo, .playlist-header-cover.quad { display: grid; grid-template-columns: 1fr 1fr; }
        .playlist-header-cover.quad { grid-template-rows: 1fr 1fr; }
        .playlist-header-cover.duo img, .playlist-header-cover.quad img { width: 100%; height: 100%; object-fit: cover; }
        .playlist-header-cover.empty { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #450af5, #8e8ee5); }
        .playlist-header-cover.empty svg { width: 64px; height: 64px; color: rgba(255,255,255,0.7); }
        .playlist-actions-bar { display: flex; align-items: center; gap: 16px; padding: 24px 32px; }
        .btn-play-large {
          width: 56px; height: 56px; border-radius: 50%; background: var(--success); border: none;
          color: black; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: transform 100ms, background 100ms;
        }
        .btn-play-large:hover:not(:disabled) { transform: scale(1.05); background: #3be477; }
        .btn-play-large:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-play-large svg { margin-left: 2px; }
        .btn-icon-circle {
          width: 40px; height: 40px; border-radius: 50%; background: transparent;
          border: 1px solid var(--text-muted); color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 150ms;
        }
        .btn-icon-circle:hover:not(:disabled) { border-color: var(--text-primary); color: var(--text-primary); }
        .btn-icon-circle:disabled { opacity: 0.5; cursor: not-allowed; }
        .playlist-track-list { padding: 0 32px; }
        .playlist-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-muted); text-align: center; }
        .playlist-empty svg { margin-bottom: 16px; opacity: 0.5; }
        .playlist-empty h3 { font-size: 18px; color: var(--text-primary); margin: 0 0 8px 0; }
        .playlist-empty p { margin: 0; }
        .track-list-header {
          display: grid; grid-template-columns: 48px 1fr 1fr 80px 48px; gap: 16px; padding: 8px 16px;
          border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .track-list-header .track-col-duration { display: flex; justify-content: flex-end; }
        .playlist-track-row {
          display: grid; grid-template-columns: 48px 1fr 1fr 80px 48px; gap: 16px; padding: 8px 16px;
          border-radius: var(--radius-md); cursor: pointer; transition: background 100ms;
        }
        .playlist-track-row:hover { background: var(--bg-hover); }
        .playlist-track-row:hover .track-num { display: none; }
        .playlist-track-row:hover .track-play-btn { display: flex; }
        .track-col-num { display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .track-play-btn { display: none; align-items: center; justify-content: center; background: none; border: none; color: var(--text-primary); cursor: pointer; }
        .track-col-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .track-cover { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
        .track-info { display: flex; flex-direction: column; min-width: 0; }
        .track-name { font-size: 14px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .track-artist { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .track-col-album { display: flex; align-items: center; font-size: 14px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .track-col-duration { display: flex; align-items: center; justify-content: flex-end; font-size: 14px; color: var(--text-muted); }
        .track-col-actions { display: flex; align-items: center; justify-content: center; }
        .track-remove-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; opacity: 0; transition: all 150ms; }
        .playlist-track-row:hover .track-remove-btn { opacity: 1; }
        .track-remove-btn:hover { color: var(--error); }
        @media (max-width: 768px) {
          .playlist-header { flex-direction: column; align-items: center; text-align: center; padding: 24px; }
          .playlist-header-cover { width: 180px; height: 180px; }
          .playlist-title { font-size: 32px; }
          .playlist-meta { justify-content: center; flex-wrap: wrap; }
          .playlist-actions-bar { justify-content: center; }
          .track-list-header { display: none; }
          .playlist-track-row { grid-template-columns: 32px 1fr 60px; }
          .track-col-album { display: none; }
          .track-col-actions { display: none; }
        }
      </style>
    `;
    
    this.bindEvents();
  },
  
  buildCompositeCover(covers) {
    // Proxy all cover URLs
    var fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23333' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-size='48' text-anchor='middle' dy='.3em'%3E♪%3C/text%3E%3C/svg%3E";
    var proxiedCovers = covers.map(c => this.getProxiedImageUrl(c)).filter(Boolean);
    
    if (proxiedCovers.length === 0) {
      return '<div class="playlist-header-cover empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>';
    } else if (proxiedCovers.length === 1) {
      return '<img class="single-cover" src="' + proxiedCovers[0] + '" alt="" onerror="this.src=\'' + fallbackImg + '\'">';
    } else if (proxiedCovers.length < 4) {
      return '<div class="playlist-header-cover duo" style="display:grid;grid-template-columns:1fr 1fr;">' + proxiedCovers.slice(0, 2).map(function(c) { return '<img src="' + c + '" alt="" onerror="this.src=\'' + fallbackImg + '\'">'; }).join('') + '</div>';
    } else {
      return '<div class="playlist-header-cover quad" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;">' + proxiedCovers.slice(0, 4).map(function(c) { return '<img src="' + c + '" alt="" onerror="this.src=\'' + fallbackImg + '\'">'; }).join('') + '</div>';
    }
  },
  
  renderTrackRow(track, idx, isOwner) {
    var playlistTrackId = track.playlist_track_id || track.id || track.track_id;
    // Use IPFS proxy for cover images
    var coverUrl = this.getProxiedImageUrl(track.cover_url);
    var fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23333' width='40' height='40'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-size='16' text-anchor='middle' dy='.3em'%3E♪%3C/text%3E%3C/svg%3E";
    return '<div class="playlist-track-row" data-track-idx="' + idx + '" data-release-id="' + (track.release_id || '') + '">' +
      '<span class="track-col-num"><span class="track-num">' + (idx + 1) + '</span><button class="track-play-btn" data-track-idx="' + idx + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button></span>' +
      '<div class="track-col-title"><img class="track-cover" src="' + coverUrl + '" alt="" onerror="this.src=\'' + fallbackImg + '\'"><div class="track-info"><span class="track-name">' + (track.title || 'Unknown Track') + '</span><span class="track-artist">' + (track.artist_name || 'Unknown Artist') + '</span></div></div>' +
      '<span class="track-col-album">' + (track.release_title || '') + '</span>' +
      '<span class="track-col-duration">' + Helpers.formatDuration(track.duration || 0) + '</span>' +
      (isOwner ? '<span class="track-col-actions"><button class="track-remove-btn" data-playlist-track-id="' + playlistTrackId + '" title="Remove from playlist"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></span>' : '<span class="track-col-actions"></span>') +
      '</div>';
  },
  
  /**
   * Convert IPFS URL to proxied URL
   */
  getProxiedImageUrl(url) {
    if (!url) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23333' width='40' height='40'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-size='16' text-anchor='middle' dy='.3em'%3E♪%3C/text%3E%3C/svg%3E";
    }
    // Already proxied
    if (url.startsWith('/api/ipfs/')) {
      return url;
    }
    // Extract CID from IPFS gateway URL
    if (url.includes('/ipfs/')) {
      var cid = url.split('/ipfs/')[1].split('?')[0].split('/')[0];
      return '/api/ipfs/' + cid;
    }
    // Raw CID (starts with Qm or bafy)
    if (url.startsWith('Qm') || url.startsWith('bafy')) {
      return '/api/ipfs/' + url.split('?')[0].split('/')[0];
    }
    // ipfs:// protocol
    if (url.startsWith('ipfs://')) {
      var cid = url.replace('ipfs://', '').split('?')[0].split('/')[0];
      return '/api/ipfs/' + cid;
    }
    // Regular URL, return as-is
    return url;
  },
  
  bindEvents() {
    var self = this;
    
    // Play all button
    document.getElementById('play-playlist-btn')?.addEventListener('click', function() { 
      self.playAll(false); 
    });
    
    // Shuffle button
    document.getElementById('shuffle-playlist-btn')?.addEventListener('click', function() { 
      self.playAll(true); 
    });
    
    // Delete button
    document.getElementById('delete-playlist-btn')?.addEventListener('click', function() { 
      self.confirmDelete(); 
    });
    
    // Track row click - OPEN RELEASE MODAL (not play)
    document.querySelectorAll('.playlist-track-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        // Skip if clicking remove button or play button
        if (e.target.closest('.track-remove-btn')) return;
        if (e.target.closest('.track-play-btn')) return;
        
        // Open release modal to show details
        var releaseId = row.dataset.releaseId;
        if (releaseId) {
          self.openReleaseModal(releaseId);
        }
      });
    });
    
    // Play button - PLAYS the track
    document.querySelectorAll('.track-play-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.trackIdx, 10);
        self.playFromIndex(idx);
      });
    });
    
    // Remove button
    document.querySelectorAll('.track-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var playlistTrackId = btn.dataset.playlistTrackId;
        await self.removeTrack(playlistTrackId);
      });
    });
  },
  
  /**
   * Open release modal to show track details and purchase options
   */
  async openReleaseModal(releaseId) {
    try {
      // First check if we have releases loaded in AppState
      if (typeof getReleases === 'function') {
        const releases = getReleases();
        const release = releases.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
          return;
        }
      }
      
      // Otherwise fetch from API
      const response = await fetch(`/api/releases?id=${releaseId}`);
      const data = await response.json();
      if (data.release) {
        Modals.showRelease(data.release);
      }
    } catch (error) {
      console.error('Failed to load release:', error);
      if (typeof showToast === 'function') {
        showToast('Failed to load track details');
      }
    }
  },
  
  playAll(shuffle) {
    if (this.tracks.length === 0) return;
    var queue = this.tracks.map(function(t) {
      return { 
        id: t.track_id, 
        trackId: t.track_id?.toString(), 
        title: t.title, 
        artist: t.artist_name || 'Unknown Artist', 
        cover: t.cover_url, 
        ipfsHash: t.audio_cid, 
        releaseId: t.release_id, 
        duration: t.duration 
      };
    });
    if (shuffle) {
      for (var i = queue.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = queue[i]; 
        queue[i] = queue[j]; 
        queue[j] = temp;
      }
      AppState.player.isShuffled = true;
    }
    Player.playTrack(queue[0], queue, 0);
  },
  
  playFromIndex(idx) {
    if (idx < 0 || idx >= this.tracks.length) return;
    var queue = this.tracks.map(function(t) {
      return { 
        id: t.track_id, 
        trackId: t.track_id?.toString(), 
        title: t.title, 
        artist: t.artist_name || 'Unknown Artist', 
        cover: t.cover_url, 
        ipfsHash: t.audio_cid, 
        releaseId: t.release_id, 
        duration: t.duration 
      };
    });
    Player.playTrack(queue[idx], queue, idx);
  },
  
  async removeTrack(playlistTrackId) {
    if (!this.playlist) return;
    try {
      var response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'removeTrack', 
          playlistId: this.playlist.id, 
          ownerAddress: AppState.user.address, 
          playlistTrackId: playlistTrackId 
        })
      });
      var data = await response.json();
      if (data.success) {
        await this.loadPlaylist(this.playlist.id);
        showToast('Track removed from playlist');
        if (typeof UI !== 'undefined' && UI.updatePlaylists) UI.updatePlaylists();
      } else {
        throw new Error(data.error || 'Failed to remove track');
      }
    } catch (error) {
      console.error('Failed to remove track:', error);
      showToast('Failed to remove track');
    }
  },
  
  async confirmDelete() {
    if (!this.playlist) return;
    var confirmed = confirm('Delete "' + this.playlist.name + '"? This cannot be undone.');
    if (!confirmed) return;
    try {
      var response = await fetch('/api/playlists?id=' + this.playlist.id + '&owner=' + AppState.user.address, { method: 'DELETE' });
      var data = await response.json();
      if (data.success) {
        showToast('Playlist deleted');
        Router.navigate('stream');
        if (typeof UI !== 'undefined' && UI.updatePlaylists) UI.updatePlaylists();
      } else {
        throw new Error(data.error || 'Failed to delete playlist');
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      showToast('Failed to delete playlist');
    }
  }
};

if (typeof window !== 'undefined') window.PlaylistPage = PlaylistPage;
