/**
 * XRP Music - Share Functionality
 * Handles sharing releases via link or native share API
 * 
 * USAGE:
 * - ShareUtils.shareRelease(release) - Share a release object
 * - ShareUtils.shareReleaseById(releaseId) - Share by ID (fetches if needed)
 * - ShareUtils.getReleaseUrl(releaseId) - Get shareable URL
 */

const ShareUtils = {
  /**
   * Get shareable URL for a release
   */
  getReleaseUrl(releaseId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/release/${releaseId}`;
  },
  
  /**
   * Share a release - uses native share if available, otherwise copies link
   */
  async shareRelease(release) {
    if (!release?.id) return;
    
    const url = this.getReleaseUrl(release.id);
    const title = release.title || 'Check out this release';
    const artist = release.artistName || 'Unknown Artist';
    const text = `${title} by ${artist} on XRP Music`;
    
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: url,
        });
        return { success: true, method: 'native' };
      } catch (err) {
        // User cancelled or share failed - fall through to copy
        if (err.name === 'AbortError') {
          return { success: false, cancelled: true };
        }
      }
    }
    
    // Fallback to clipboard copy
    return this.copyToClipboard(url);
  },
  
  /**
   * Copy URL to clipboard
   */
  async copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      Modals.showToast('Link copied to clipboard!');
      return { success: true, method: 'clipboard' };
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        Modals.showToast('Link copied to clipboard!');
        return { success: true, method: 'execCommand' };
      } catch (e) {
        Modals.showToast('Failed to copy link');
        return { success: false, error: e };
      } finally {
        document.body.removeChild(textArea);
      }
    }
  },
  
  /**
   * Create share button HTML
   */
  createShareButton(releaseId, size = 'normal') {
    const sizeClass = size === 'small' ? 'share-btn-sm' : '';
    return `
      <button class="share-btn ${sizeClass}" onclick="ShareUtils.shareReleaseById('${releaseId}')" title="Share">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        ${size !== 'small' ? '<span>Share</span>' : ''}
      </button>
    `;
  },
  
  /**
   * Share release by ID (for onclick handlers)
   */
  async shareReleaseById(releaseId) {
    // Try to find release in AppState first
    let release = AppState.releases?.find(r => r.id === releaseId);
    
    if (!release) {
      // Fetch it
      try {
        const data = await API.getRelease(releaseId);
        release = data?.release;
      } catch (e) {
        console.error('Failed to fetch release for sharing:', e);
      }
    }
    
    if (release) {
      await this.shareRelease(release);
    } else {
      // Just share the URL without metadata
      const url = this.getReleaseUrl(releaseId);
      await this.copyToClipboard(url);
    }
  },
  
  /**
   * Add styles for share button
   */
  addStyles() {
    if (document.getElementById('share-utils-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'share-utils-styles';
    style.textContent = `
      .share-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .share-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }
      .share-btn-sm {
        padding: 8px;
        border-radius: 50%;
      }
      .share-btn-sm span {
        display: none;
      }
      
      /* Share button in release modal header */
      .release-modal-actions .share-btn {
        background: transparent;
        border: none;
        padding: 8px;
        border-radius: 50%;
      }
      .release-modal-actions .share-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    `;
    document.head.appendChild(style);
  },
};

// Add styles on load
if (typeof window !== 'undefined') {
  window.ShareUtils = ShareUtils;
  
  // Add styles when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ShareUtils.addStyles());
  } else {
    ShareUtils.addStyles();
  }
}
