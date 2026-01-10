/**
 * XRP Music - Playlist Picker Modal
 * Shows user's playlists and allows adding tracks or creating new playlists
 */

const PlaylistPicker = {
  currentTrack: null,
  playlists: [],
  isCreating: false,
  
  /**
   * Show the playlist picker modal
   * @param {Object} track - Track to add { trackId, releaseId, title, artist, cover }
   */
  async show(track) {
    if (!AppState.user?.address) {
      Modals.showToast('Connect wallet to add to playlist');
      return;
    }
    
    if (!track) {
      Modals.showToast('No track selected');
      return;
    }
    
    this.currentTrack = track;
    this.isCreating = false;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'playlist-picker-overlay';
    modal.id = 'playlist-picker-modal';
    modal.innerHTML = `
      <div class="playlist-picker-modal">
        <div class="playlist-picker-header">
          <h3>Add to playlist</h3>
          <button class="playlist-picker-close" id="playlist-picker-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="playlist-picker-track">
          <img class="playlist-picker-track-cover" src="${track.cover || '/placeholder.png'}" alt="" onerror="this.src='/placeholder.png'">
          <div class="playlist-picker-track-info">
            <span class="playlist-picker-track-title">${track.title || 'Unknown Track'}</span>
            <span class="playlist-picker-track-artist">${track.artist || 'Unknown Artist'}</span>
          </div>
        </div>
        
        <div class="playlist-picker-content">
          <button class="playlist-picker-create-btn" id="playlist-picker-create-btn">
            <div class="playlist-picker-create-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <span>Create new playlist</span>
          </button>
          
          <div class="playlist-picker-create-form hidden" id="playlist-picker-create-form">
            <input type="text" class="playlist-picker-input" id="playlist-picker-input" placeholder="Playlist name" maxlength="50">
            <div class="playlist-picker-form-actions">
              <button class="btn btn-secondary btn-sm" id="playlist-picker-cancel">Cancel</button>
              <button class="btn btn-primary btn-sm" id="playlist-picker-save">Create</button>
            </div>
          </div>
          
          <div class="playlist-picker-divider" id="playlist-picker-divider"></div>
          
          <div class="playlist-picker-list" id="playlist-picker-list">
            <div class="playlist-picker-loading">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add styles if not already added
    this.addStyles();
    
    // Bind events
    this.bindEvents();
    
    // Load playlists
    await this.loadPlaylists();
  },
  
  /**
   * Load user's playlists
   */
  async loadPlaylists() {
    const listEl = document.getElementById('playlist-picker-list');
    if (!listEl) return;
    
    try {
      const response = await fetch(`/api/playlists?user=${AppState.user.address}`);
      const data = await response.json();
      
      // Filter out system playlists (Liked Songs is handled separately)
      this.playlists = (data.playlists || []).filter(p => !p.is_system);
      
      if (this.playlists.length === 0) {
        listEl.innerHTML = `
          <div class="playlist-picker-empty">
            <p>No playlists yet</p>
            <p class="text-muted">Create your first playlist above!</p>
          </div>
        `;
        document.getElementById('playlist-picker-divider').style.display = 'none';
        return;
      }
      
      listEl.innerHTML = this.playlists.map(playlist => `
        <button class="playlist-picker-item" data-playlist-id="${playlist.id}">
          <div class="playlist-picker-item-cover">
            ${playlist.cover_url 
              ? `<img src="${playlist.cover_url}" alt="">`
              : `<div class="playlist-picker-item-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                  </svg>
                </div>`
            }
          </div>
          <div class="playlist-picker-item-info">
            <span class="playlist-picker-item-name">${playlist.name}</span>
            <span class="playlist-picker-item-count">${playlist.track_count || 0} songs</span>
          </div>
        </button>
      `).join('');
      
      // Bind playlist click events
      listEl.querySelectorAll('.playlist-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const playlistId = item.dataset.playlistId;
          this.addToPlaylist(playlistId);
        });
      });
      
    } catch (error) {
      console.error('Failed to load playlists:', error);
      listEl.innerHTML = `
        <div class="playlist-picker-empty">
          <p>Failed to load playlists</p>
        </div>
      `;
    }
  },
  
  /**
   * Add track to existing playlist
   */
  async addToPlaylist(playlistId) {
    const playlist = this.playlists.find(p => p.id == playlistId);
    const track = this.currentTrack;
    
    if (!playlist || !track) {
      Modals.showToast('Unable to add track');
      return;
    }
    
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addTrack',
          playlistId: playlistId,
          ownerAddress: AppState.user.address,
          trackId: track.trackId || track.id,
          releaseId: track.releaseId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.close();
        Modals.showToast(`Added "${track.title}" to ${playlist.name}`);
      } else if (data.message === 'Track already in playlist') {
        Modals.showToast('Track already in this playlist');
      } else {
        throw new Error(data.error || 'Failed to add');
      }
      
    } catch (error) {
      console.error('Failed to add to playlist:', error);
      Modals.showToast('Failed to add to playlist');
    }
  },
  
  /**
   * Create new playlist and add track
   */
  async createAndAdd() {
    const input = document.getElementById('playlist-picker-input');
    const name = input?.value?.trim();
    
    if (!name) {
      input?.focus();
      Modals.showToast('Please enter a playlist name');
      return;
    }
    
    // IMPORTANT: Save track reference locally before any async operations
    // This prevents issues if this.currentTrack gets cleared
    const track = this.currentTrack;
    if (!track) {
      Modals.showToast('No track selected');
      return;
    }
    
    const saveBtn = document.getElementById('playlist-picker-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating...';
    }
    
    try {
      // Create playlist
      const createResponse = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: name,
          ownerAddress: AppState.user.address,
        }),
      });
      
      const createData = await createResponse.json();
      
      if (!createData.success || !createData.playlistId) {
        throw new Error(createData.error || 'Failed to create playlist');
      }
      
      // Add track to new playlist using local track reference
      const addResponse = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addTrack',
          playlistId: createData.playlistId,
          ownerAddress: AppState.user.address,
          trackId: track.trackId || track.id,
          releaseId: track.releaseId,
        }),
      });
      
      const addData = await addResponse.json();
      
      if (addData.success) {
        this.close();
        Modals.showToast(`Added "${track.title}" to ${name}`);
        
        // Refresh sidebar playlists if function exists
        if (typeof UI !== 'undefined' && UI.loadUserPlaylists) {
          UI.loadUserPlaylists();
        }
      } else {
        throw new Error(addData.error || 'Failed to add track');
      }
      
    } catch (error) {
      console.error('Failed to create playlist:', error);
      Modals.showToast('Failed to create playlist: ' + error.message);
      
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create';
      }
    }
  },
  
  /**
   * Toggle create form visibility
   */
  toggleCreateForm(show) {
    this.isCreating = show;
    const form = document.getElementById('playlist-picker-create-form');
    const btn = document.getElementById('playlist-picker-create-btn');
    
    if (form) form.classList.toggle('hidden', !show);
    if (btn) btn.classList.toggle('hidden', show);
    
    if (show) {
      setTimeout(() => {
        const input = document.getElementById('playlist-picker-input');
        input?.focus();
      }, 50);
    }
  },
  
  /**
   * Bind modal events
   */
  bindEvents() {
    const modal = document.getElementById('playlist-picker-modal');
    if (!modal) return;
    
    // Close button
    document.getElementById('playlist-picker-close')?.addEventListener('click', () => this.close());
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });
    
    // Escape to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Create button
    document.getElementById('playlist-picker-create-btn')?.addEventListener('click', () => {
      this.toggleCreateForm(true);
    });
    
    // Cancel create
    document.getElementById('playlist-picker-cancel')?.addEventListener('click', () => {
      this.toggleCreateForm(false);
    });
    
    // Save/create playlist
    document.getElementById('playlist-picker-save')?.addEventListener('click', () => {
      this.createAndAdd();
    });
    
    // Enter to save
    document.getElementById('playlist-picker-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.createAndAdd();
      }
    });
  },
  
  /**
   * Close modal
   */
  close() {
    const modal = document.getElementById('playlist-picker-modal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 200);
    }
    this.currentTrack = null;
    this.isCreating = false;
  },
  
  /**
   * Add styles to document
   */
  addStyles() {
    if (document.getElementById('playlist-picker-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'playlist-picker-styles';
    style.textContent = `
      .playlist-picker-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: ppFadeIn 200ms ease;
        padding: 20px;
      }
      .playlist-picker-overlay.closing {
        animation: ppFadeOut 200ms ease forwards;
      }
      @keyframes ppFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ppFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      .playlist-picker-modal {
        background: #282828;
        border-radius: 8px;
        width: 100%;
        max-width: 400px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: ppSlideUp 200ms ease;
      }
      @keyframes ppSlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .playlist-picker-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .playlist-picker-header h3 {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
        color: white;
      }
      .playlist-picker-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .playlist-picker-close:hover {
        color: white;
        background: rgba(255,255,255,0.1);
      }
      
      .playlist-picker-track {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: rgba(255,255,255,0.05);
      }
      .playlist-picker-track-cover {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        object-fit: cover;
        background: #333;
      }
      .playlist-picker-track-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      .playlist-picker-track-title {
        font-size: 14px;
        font-weight: 500;
        color: white;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .playlist-picker-track-artist {
        font-size: 13px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .playlist-picker-content {
        padding: 12px;
        overflow-y: auto;
        flex: 1;
      }
      
      .playlist-picker-create-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background 100ms;
      }
      .playlist-picker-create-btn:hover {
        background: rgba(255,255,255,0.1);
      }
      .playlist-picker-create-btn.hidden {
        display: none;
      }
      .playlist-picker-create-icon {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
      }
      
      .playlist-picker-create-form {
        padding: 12px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
        margin-bottom: 8px;
      }
      .playlist-picker-create-form.hidden {
        display: none;
      }
      .playlist-picker-input {
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px;
        background: rgba(0,0,0,0.3);
        color: white;
        font-size: 14px;
        margin-bottom: 12px;
        box-sizing: border-box;
      }
      .playlist-picker-input:focus {
        outline: none;
        border-color: var(--accent, #1db954);
      }
      .playlist-picker-input::placeholder {
        color: var(--text-muted);
      }
      .playlist-picker-form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .playlist-picker-form-actions .btn-sm {
        padding: 8px 16px;
        font-size: 13px;
      }
      
      .playlist-picker-divider {
        height: 1px;
        background: rgba(255,255,255,0.1);
        margin: 8px 0;
      }
      
      .playlist-picker-list {
        display: flex;
        flex-direction: column;
      }
      .playlist-picker-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .playlist-picker-empty {
        text-align: center;
        padding: 24px;
        color: var(--text-muted);
      }
      .playlist-picker-empty p {
        margin: 4px 0;
      }
      .playlist-picker-empty .text-muted {
        color: var(--text-muted);
        font-size: 13px;
      }
      
      .playlist-picker-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        text-align: left;
        transition: background 100ms;
      }
      .playlist-picker-item:hover {
        background: rgba(255,255,255,0.1);
      }
      .playlist-picker-item-cover {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
      }
      .playlist-picker-item-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .playlist-picker-item-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #450af5, #8e8ee5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
      .playlist-picker-item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      .playlist-picker-item-name {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .playlist-picker-item-count {
        font-size: 13px;
        color: var(--text-muted);
      }
    `;
    document.head.appendChild(style);
  },
};

// Make it globally available
if (typeof window !== 'undefined') {
  window.PlaylistPicker = PlaylistPicker;
}
