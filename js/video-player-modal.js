/**
 * Video Player Modal
 * Full-screen video player for film content
 * 
 * FIXES APPLIED (April 2026):
 * ✅ Better error handling for missing video URLs
 * ✅ Proper videoUrl/audioUrl fallback chain
 * ✅ Filecoin gateway support for video files
 * ✅ IPFS proxy support for music videos
 * ✅ Clear error messages to user
 */

const VideoPlayerModal = {
  currentRelease: null,
  videoElement: null,
  isBuffering: false,

  show(release) {
    console.log('🎬 VideoPlayerModal.show() called with release:', release);
    
    this.currentRelease = release;
    
    // Hide the bottom audio player
    const bottomPlayer = document.querySelector('.player');
    if (bottomPlayer) {
      bottomPlayer.style.display = 'none';
    }

    // Pause any audio that might be playing
    if (typeof Player !== 'undefined' && Player.audio) {
      Player.pause();
    }

    // ✅ FIX: Better track access with fallback
    const track = release.tracks?.[0];
    if (!track) {
      console.error('❌ No track found in release:', release);
      alert('No video found for this release. The video data may be missing.');
      return;
    }

    console.log('📹 Track data:', track);

    // ✅ FIX: Better video URL resolution with Filecoin + IPFS support
    let videoUrl = null;
    
    // Try videoUrl first
    if (track.videoUrl) {
      videoUrl = this.getProxiedUrl(track.videoUrl);
      console.log('✅ Using track.videoUrl:', videoUrl);
    }
    // Fallback to audioUrl (films store video in both fields)
    else if (track.audioUrl) {
      videoUrl = this.getProxiedUrl(track.audioUrl);
      console.log('✅ Using track.audioUrl as fallback:', videoUrl);
    }
    // Fallback to videoCid
    else if (track.videoCid) {
      videoUrl = this.buildFilecoinUrl(track.videoCid);
      console.log('✅ Using track.videoCid:', videoUrl);
    }
    // Fallback to audioCid
    else if (track.audioCid) {
      videoUrl = this.buildFilecoinUrl(track.audioCid);
      console.log('✅ Using track.audioCid as fallback:', videoUrl);
    }

    if (!videoUrl) {
      console.error('❌ No video URL found. Track:', track);
      alert('Video URL not found. The video may not have been uploaded correctly.');
      this.restoreAudioPlayer();
      return;
    }

    console.log('🎬 Final video URL:', videoUrl);

    const html = `
      <div class="modal-overlay video-modal-overlay" id="video-modal-overlay">
        <div class="video-modal">
          <!-- Header -->
          <div class="video-modal-header">
            <div class="video-modal-title">
              <h2>${release.title || 'Untitled'}</h2>
              <p>${release.artistName || 'Unknown Artist'}</p>
            </div>
            <button class="video-modal-close" id="video-modal-close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Video Container -->
          <div class="video-modal-container">
            <!-- Loading Spinner -->
            <div class="video-loading" id="video-loading">
              <div class="video-spinner"></div>
              <p>Loading video...</p>
            </div>

            <!-- Video Element -->
            <video 
              id="video-player"
              class="video-player"
              controls
              preload="metadata"
              playsinline
            >
              <source src="${videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>

          <!-- Info Bar -->
          <div class="video-modal-info">
            <div class="video-modal-price">
              ${release.songPrice === 0 ? 'FREE' : (release.songPrice || release.albumPrice || 0) + ' XRP'}
            </div>
            <div class="video-modal-editions">
              ${(release.totalEditions || 0) - (release.soldEditions || 0)} / ${release.totalEditions || 0} available
            </div>
          </div>
        </div>
      </div>

      ${this.getStyles()}
    `;

    // Remove any existing video modal
    const existingModal = document.getElementById('video-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    // Add to page
    document.body.insertAdjacentHTML('beforeend', html);

    // Get elements
    this.videoElement = document.getElementById('video-player');
    const loadingEl = document.getElementById('video-loading');
    const closeBtn = document.getElementById('video-modal-close');
    const overlay = document.getElementById('video-modal-overlay');

    // Bind events
    closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Video events
    this.videoElement.addEventListener('loadstart', () => {
      loadingEl.style.display = 'flex';
      console.log('📹 Video loading started');
    });

    this.videoElement.addEventListener('canplay', () => {
      loadingEl.style.display = 'none';
      console.log('✅ Video can play');
    });

    this.videoElement.addEventListener('waiting', () => {
      loadingEl.style.display = 'flex';
    });

    this.videoElement.addEventListener('playing', () => {
      loadingEl.style.display = 'none';
      console.log('▶️ Video playing');
    });

    // ✅ FIX: Better error handling
    this.videoElement.addEventListener('error', (e) => {
      loadingEl.style.display = 'none';
      console.error('❌ Video error:', e);
      console.error('Video element error code:', this.videoElement.error?.code);
      console.error('Video element error message:', this.videoElement.error?.message);
      
      let errorMsg = 'Failed to load video. ';
      if (this.videoElement.error) {
        switch (this.videoElement.error.code) {
          case 1:
            errorMsg += 'The video download was aborted.';
            break;
          case 2:
            errorMsg += 'A network error occurred.';
            break;
          case 3:
            errorMsg += 'The video file is corrupted or in an unsupported format.';
            break;
          case 4:
            errorMsg += 'The video format is not supported by your browser.';
            break;
          default:
            errorMsg += 'An unknown error occurred.';
        }
      }
      
      alert(errorMsg + '\n\nVideo URL: ' + videoUrl);
      this.close();
    });

    // Auto-play when ready
    this.videoElement.addEventListener('loadeddata', () => {
      this.videoElement.play().catch(err => {
        console.log('Auto-play prevented:', err);
        // User needs to click play manually - this is normal browser behavior
      });
    });

    // ESC key to close
    document.addEventListener('keydown', this.handleKeyDown);
  },

  /**
   * Build Filecoin gateway URL from CID
   */
  buildFilecoinUrl(cid) {
    if (!cid) return null;
    
    // If it's already a full URL, return as-is
    if (cid.startsWith('http')) return cid;
    
    // Build Filecoin gateway URL
    return `https://eu-west-1.s3.fil.one/xrpmusic/${cid}`;
  },

  /**
   * Get video URL - use Filecoin for videos, IPFS proxy for music videos
   */
  getProxiedUrl(url) {
    if (!url) return null;
    
    // Already a proxy URL
    if (url.startsWith('/api/ipfs/')) {
      return url;
    }
    
    // Filecoin URLs (videos) - use directly, don't proxy
    if (url.includes('.fil.one') || url.includes('filecoin')) {
      return url;
    }
    
    // IPFS URLs (music videos) - extract CID and use proxy
    if (url.includes('/ipfs/')) {
      const cid = url.split('/ipfs/')[1].split('?')[0];
      return `/api/ipfs/${cid}`;
    }
    
    // Use IPFS helper if available
    if (typeof IpfsHelper !== 'undefined' && IpfsHelper.toProxyUrl) {
      return IpfsHelper.toProxyUrl(url);
    }
    
    // Return as-is (for direct URLs)
    return url;
  },

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      VideoPlayerModal.close();
    }
  },

  close() {
    // Stop video
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
    }

    // Remove modal
    const modal = document.getElementById('video-modal-overlay');
    if (modal) {
      modal.remove();
    }

    this.restoreAudioPlayer();

    // Remove ESC listener
    document.removeEventListener('keydown', this.handleKeyDown);

    this.currentRelease = null;
    this.videoElement = null;
  },

  /**
   * ✅ NEW: Restore audio player visibility
   */
  restoreAudioPlayer() {
    const bottomPlayer = document.querySelector('.player');
    if (bottomPlayer) {
      bottomPlayer.style.display = '';
    }
  },

  getStyles() {
    return `
      <style>
        .video-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 200ms ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .video-modal {
          width: 95vw;
          max-width: 1400px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary, #000);
          border-radius: 12px;
          overflow: hidden;
        }

        /* Header */
        .video-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(0, 0, 0, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .video-modal-title h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px;
          color: white;
        }

        .video-modal-title p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }

        .video-modal-close {
          width: 40px;
          height: 40px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms;
        }

        .video-modal-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        /* Video Container */
        .video-modal-container {
          flex: 1;
          position: relative;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-player {
          width: 100%;
          height: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        /* Loading Spinner */
        .video-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1;
        }

        .video-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: #ef4444;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .video-loading p {
          color: white;
          font-size: 14px;
          margin: 0;
        }

        /* Info Bar */
        .video-modal-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(0, 0, 0, 0.5);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .video-modal-price {
          font-size: 16px;
          font-weight: 700;
          color: #ef4444;
        }

        .video-modal-editions {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Mobile */
        @media (max-width: 768px) {
          .video-modal {
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            border-radius: 0;
          }

          .video-modal-header {
            padding: 12px 16px;
          }

          .video-modal-title h2 {
            font-size: 16px;
          }

          .video-modal-title p {
            font-size: 13px;
          }
        }
      </style>
    `;
  }
};

// Make globally available
if (typeof window !== 'undefined') {
  window.VideoPlayerModal = VideoPlayerModal;
}
