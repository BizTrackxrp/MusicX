/**
 * XRP Music - Share Utilities
 * Handles sharing releases and artist profiles with a nice modal UI
 */

const ShareUtils = {
  
  /**
   * Get shareable URL for a release
   */
  getReleaseUrl(releaseId) {
    return `${window.location.origin}/release/${releaseId}`;
  },
  
  /**
   * Get shareable URL for an artist profile
   */
  getArtistUrl(artistAddress) {
    return `${window.location.origin}/artist/${artistAddress}`;
  },
  
  /**
   * Show share modal with link and copy button
   */
  shareRelease(release) {
    const url = this.getReleaseUrl(release.id);
    const title = release.title;
    const artist = release.artistName || 'Unknown Artist';
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'share-modal-overlay';
    overlay.innerHTML = `
      <div class="share-modal">
        <div class="share-modal-header">
          <h3>Share Release</h3>
          <button class="share-modal-close" id="share-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="share-modal-content">
          <!-- Release preview -->
          <div class="share-preview">
            <div class="share-preview-cover">
              ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${title}">` : '<div class="share-cover-placeholder">🎵</div>'}
            </div>
            <div class="share-preview-info">
              <div class="share-preview-title">${title}</div>
              <div class="share-preview-artist">${artist}</div>
            </div>
          </div>
          
          <!-- Link input with copy button -->
          <div class="share-link-container">
            <input type="text" class="share-link-input" id="share-link-input" value="${url}" readonly>
            <button class="share-copy-btn" id="share-copy-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
          
          <!-- Success message (hidden initially) -->
          <div class="share-success" id="share-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Copied to clipboard!
          </div>
          
          <!-- Native share button for mobile -->
          ${navigator.share ? `
            <button class="share-native-btn" id="share-native-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              More sharing options...
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    this._addShareModalStyles();
    document.body.appendChild(overlay);
    this._bindShareModalEvents(overlay, url, `${title} by ${artist}`, `Check out "${title}" by ${artist} on XRP Music!`);
  },
  
  /**
   * Show share modal for artist profile
   */
  shareArtistProfile(profile) {
    const address = profile.address || AppState.user?.address;
    const url = this.getArtistUrl(address);
    const displayName = profile.displayName || profile.artistName || Helpers.truncateAddress(address, 8, 6);
    const avatarUrl = profile.avatarUrl ? (typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(profile.avatarUrl) : profile.avatarUrl) : null;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'share-modal-overlay';
    overlay.innerHTML = `
      <div class="share-modal">
        <div class="share-modal-header">
          <h3>Share Artist Profile</h3>
          <button class="share-modal-close" id="share-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="share-modal-content">
          <!-- Artist preview -->
          <div class="share-preview">
            <div class="share-preview-avatar">
              ${avatarUrl 
                ? `<img src="${avatarUrl}" alt="${displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="share-avatar-placeholder" style="display:none;">${displayName.charAt(0).toUpperCase()}</div>`
                : `<div class="share-avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
              }
            </div>
            <div class="share-preview-info">
              <div class="share-preview-title">${displayName}</div>
              <div class="share-preview-artist">Artist on XRP Music</div>
            </div>
          </div>
          
          <!-- Link input with copy button -->
          <div class="share-link-container">
            <input type="text" class="share-link-input" id="share-link-input" value="${url}" readonly>
            <button class="share-copy-btn" id="share-copy-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
          
          <!-- Success message (hidden initially) -->
          <div class="share-success" id="share-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Copied to clipboard!
          </div>
          
          <!-- Native share button for mobile -->
          ${navigator.share ? `
            <button class="share-native-btn" id="share-native-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              More sharing options...
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    this._addShareModalStyles();
    document.body.appendChild(overlay);
    this._bindShareModalEvents(overlay, url, displayName, `Check out ${displayName} on XRP Music!`);
  },
  
  /**
   * Add share modal styles (only once)
   */
  _addShareModalStyles() {
    if (document.getElementById('share-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'share-modal-styles';
    style.textContent = `
      .share-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1003;
        animation: fadeIn 150ms ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .share-modal {
        background: var(--bg-card);
        border-radius: var(--radius-xl);
        width: 90%;
        max-width: 420px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: slideUp 200ms ease;
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .share-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color);
      }
      .share-modal-header h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      .share-modal-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: color 150ms;
      }
      .share-modal-close:hover {
        color: var(--text-primary);
      }
      .share-modal-content {
        padding: 20px;
      }
      .share-preview {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-hover);
        border-radius: var(--radius-lg);
        margin-bottom: 16px;
      }
      .share-preview-cover,
      .share-preview-avatar {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-md);
        overflow: hidden;
        flex-shrink: 0;
      }
      .share-preview-avatar {
        border-radius: 50%;
      }
      .share-preview-cover img,
      .share-preview-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .share-cover-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-card);
        font-size: 24px;
      }
      .share-avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--accent), #8b5cf6);
        color: white;
        font-size: 22px;
        font-weight: 700;
      }
      .share-preview-info {
        flex: 1;
        min-width: 0;
      }
      .share-preview-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .share-preview-artist {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 2px;
      }
      .share-link-container {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .share-link-input {
        flex: 1;
        padding: 12px 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: 13px;
        outline: none;
      }
      .share-link-input:focus {
        border-color: var(--accent);
      }
      .share-copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px 16px;
        background: var(--accent);
        border: none;
        border-radius: var(--radius-md);
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 150ms, transform 100ms;
        white-space: nowrap;
      }
      .share-copy-btn:hover {
        background: var(--accent-hover);
      }
      .share-copy-btn:active {
        transform: scale(0.98);
      }
      .share-copy-btn.copied {
        background: var(--success);
      }
      .share-success {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: var(--radius-md);
        color: var(--success);
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 12px;
      }
      .share-success.show {
        display: flex;
        animation: fadeIn 150ms ease;
      }
      .share-native-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px;
        background: transparent;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        font-size: 14px;
        cursor: pointer;
        transition: all 150ms;
      }
      .share-native-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--text-muted);
      }
    `;
    
    document.head.appendChild(style);
  },
  
  /**
   * Bind share modal events (reusable for both release and artist)
   */
  _bindShareModalEvents(overlay, url, shareTitle, shareText) {
    // Close modal function
    const closeModal = () => {
      overlay.remove();
    };
    
    // Close button
    document.getElementById('share-modal-close')?.addEventListener('click', closeModal);
    
    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    // Escape key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Copy button
    document.getElementById('share-copy-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('share-link-input');
      const btn = document.getElementById('share-copy-btn');
      const success = document.getElementById('share-success');
      
      try {
        await navigator.clipboard.writeText(url);
        
        // Show success state
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Copied!
        `;
        btn.classList.add('copied');
        success.classList.add('show');
        
        // Select the text
        input.select();
        
        // Reset after 2 seconds
        setTimeout(() => {
          btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          `;
          btn.classList.remove('copied');
        }, 2000);
        
      } catch (err) {
        // Fallback for older browsers
        input.select();
        document.execCommand('copy');
        success.classList.add('show');
      }
    });
    
    // Native share button (mobile)
    document.getElementById('share-native-btn')?.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: url,
        });
        closeModal();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    });
    
    // Auto-select input on click
    document.getElementById('share-link-input')?.addEventListener('click', function() {
      this.select();
    });
  },
  
  /**
   * Share by release ID (fetches release if needed)
   */
  async shareReleaseById(releaseId) {
    let release = AppState.releases?.find(r => r.id === releaseId);
    
    if (!release) {
      try {
        const data = await API.getRelease(releaseId);
        release = data?.release;
      } catch (err) {
        console.error('Failed to fetch release for sharing:', err);
        return;
      }
    }
    
    if (release) {
      this.shareRelease(release);
    }
  },
};
