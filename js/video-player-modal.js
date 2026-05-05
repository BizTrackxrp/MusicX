/**
 * Video Player Modal
 * Full-screen video player for film content & music videos
 *
 * FIXES APPLIED (May 2026):
 * ✅ Removed conflicting `.modal-overlay` class (was inheriting opacity:0 + visibility:hidden)
 * ✅ Inline styles inject ONCE into <head> (no per-open duplication)
 * ✅ Bulletproof override: opacity:1 + visibility:visible explicitly set
 * ✅ Multi-gateway support (Lighthouse IPFS, Filecoin S3, IPFS proxy)
 * ✅ Proper handleKeyDown binding so removeEventListener actually works
 * ✅ Safe Player.pause() guard (Player exposes togglePlayPause, not pause)
 * ✅ Buy NFT button → opens purchase modal
 * ✅ Better error handling for missing video URLs
 */

const VideoPlayerModal = {
  currentRelease: null,
  videoElement: null,
  isBuffering: false,
  _stylesInjected: false,
  _boundKeyHandler: null,

  show(release) {
    console.log('🎬 VideoPlayerModal.show() called with release:', release);

    this.currentRelease = release;

    // Inject styles into <head> ONCE (not into body each time)
    this._injectStyles();

    // Hide the bottom audio player
    const bottomPlayer = document.querySelector('.player') || document.getElementById('player-bar');
    if (bottomPlayer) {
      bottomPlayer.dataset.vpmHidden = 'true';
      bottomPlayer.style.display = 'none';
    }

    // Pause any audio that might be playing (guard against missing method)
    if (typeof Player !== 'undefined' && Player.audio) {
      try {
        if (typeof Player.pause === 'function') {
          Player.pause();
        } else if (!Player.audio.paused) {
          Player.audio.pause();
        }
      } catch (err) {
        console.warn('Could not pause audio player:', err);
      }
    }

    // Better track access with fallback
    const track = release.tracks?.[0];
    if (!track) {
      console.error('❌ No track found in release:', release);
      alert('No video found for this release. The video data may be missing.');
      this.restoreAudioPlayer();
      return;
    }

    console.log('📹 Track data:', track);

    // Resolve video URL with multi-gateway support
    let videoUrl = null;

    if (track.videoUrl) {
      videoUrl = this.getProxiedUrl(track.videoUrl);
      console.log('✅ Using track.videoUrl:', videoUrl);
    } else if (track.audioUrl) {
      videoUrl = this.getProxiedUrl(track.audioUrl);
      console.log('✅ Using track.audioUrl as fallback:', videoUrl);
    } else if (track.videoCid) {
      videoUrl = `/api/ipfs/${track.videoCid}`;
      console.log('✅ Using track.videoCid:', videoUrl);
    } else if (track.audioCid) {
      videoUrl = `/api/ipfs/${track.audioCid}`;
      console.log('✅ Using track.audioCid as fallback:', videoUrl);
    }

    if (!videoUrl) {
      console.error('❌ No video URL found. Track:', track);
      alert('Video URL not found. The video may not have been uploaded correctly.');
      this.restoreAudioPlayer();
      return;
    }

    console.log('🎬 Final video URL:', videoUrl);

    // NOTE: NO `modal-overlay` class — that class makes things invisible by default
    // (opacity:0 + visibility:hidden until `.visible` is added). We use our own scope.
    const html = `
      <div class="vpm-overlay" id="video-modal-overlay">
        <div class="vpm-modal">
          <div class="vpm-header">
            <div class="vpm-title">
              <h2>${this._escape(release.title || 'Untitled')}</h2>
              <p>${this._escape(release.artistName || 'Unknown Artist')}</p>
            </div>
            <button class="vpm-close" id="video-modal-close" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="vpm-container">
            <div class="vpm-loading" id="video-loading">
              <div class="vpm-spinner"></div>
              <p>Loading video...</p>
            </div>

            <video
              id="video-player"
              class="vpm-video"
              controls
              preload="metadata"
              playsinline
            >
              <source src="${videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>

          <div class="vpm-info">
            <div class="vpm-meta">
              <div class="vpm-price">
                ${release.songPrice === 0 ? 'FREE' : (release.songPrice || release.albumPrice || 0) + ' XRP'}
              </div>
              <div class="vpm-editions">
                ${(release.totalEditions || 0) - (release.soldEditions || 0)} / ${release.totalEditions || 0} available
              </div>
            </div>
            <button class="vpm-buy-btn" id="video-modal-buy-btn">
              🛒 Buy NFT
            </button>
          </div>
        </div>
      </div>
    `;

    // Remove any existing video modal
    const existingModal = document.getElementById('video-modal-overlay');
    if (existingModal) existingModal.remove();

    // Inject the modal
    document.body.insertAdjacentHTML('beforeend', html);
    console.log('✅ Modal HTML injected into DOM');

    // Wait for DOM to settle, then bind events
    requestAnimationFrame(() => {
      this.bindModalEvents(videoUrl, release);
    });
  },

  bindModalEvents(videoUrl, release) {
    this.videoElement = document.getElementById('video-player');
    const loadingEl = document.getElementById('video-loading');
    const closeBtn = document.getElementById('video-modal-close');
    const overlay = document.getElementById('video-modal-overlay');
    const buyBtn = document.getElementById('video-modal-buy-btn');

    if (!this.videoElement) {
      console.error('❌ Video element not found in DOM after injection');
      return;
    }

    console.log('✅ Binding events to video player');

    closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    if (buyBtn) {
      buyBtn.addEventListener('click', () => {
        console.log('🛒 Buy button clicked for release:', release);
        if (this.videoElement) this.videoElement.pause();
        if (typeof Modals !== 'undefined' && typeof Modals.showPurchase === 'function') {
          Modals.showPurchase(release);
        } else {
          alert('Purchase system not available. Please refresh the page.');
        }
      });
    }

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

    this.videoElement.addEventListener('error', () => {
      loadingEl.style.display = 'none';
      console.error('❌ Video error. Code:', this.videoElement.error?.code, 'Message:', this.videoElement.error?.message);

      let errorMsg = 'Failed to load video. ';
      if (this.videoElement.error) {
        switch (this.videoElement.error.code) {
          case 1: errorMsg += 'The video download was aborted.'; break;
          case 2: errorMsg += 'A network error occurred.'; break;
          case 3: errorMsg += 'The video file is corrupted or in an unsupported format.'; break;
          case 4: errorMsg += 'The video format is not supported by your browser.'; break;
          default: errorMsg += 'An unknown error occurred.';
        }
      }

      alert(errorMsg + '\n\nVideo URL: ' + videoUrl);
      this.close();
    });

    this.videoElement.addEventListener('loadeddata', () => {
      this.videoElement.play().catch(err => {
        console.log('Auto-play prevented (this is normal):', err.message);
      });
    });

    // ESC key — store bound reference so removeEventListener actually works
    this._boundKeyHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._boundKeyHandler);
  },

  /**
   * Get video URL — handle different storage gateways
   * - Lighthouse IPFS: Use directly
   * - Filecoin S3: Use directly
   * - Regular IPFS: Proxy through /api/ipfs (music videos)
   */
  getProxiedUrl(url) {
    if (!url) return null;

    if (url.includes('gateway.lighthouse.storage')) {
      console.log('🎬 Using Lighthouse IPFS gateway directly:', url);
      return url;
    }

    if (url.includes('.fil.one') || url.includes('filecoin')) {
      console.log('🎬 Using Filecoin gateway directly:', url);
      return url;
    }

    if (url.startsWith('/api/ipfs/')) return url;

    if (url.includes('/ipfs/')) {
      const cid = url.split('/ipfs/')[1].split('?')[0];
      console.log('🎬 Proxying IPFS CID for music video:', cid);
      return `/api/ipfs/${cid}`;
    }

    if (typeof IpfsHelper !== 'undefined' && IpfsHelper.toProxyUrl) {
      return IpfsHelper.toProxyUrl(url);
    }

    return url;
  },

  close() {
    console.log('🔴 Closing video player modal');

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
      } catch (e) {
        console.warn('Error stopping video:', e);
      }
    }

    const modal = document.getElementById('video-modal-overlay');
    if (modal) modal.remove();

    this.restoreAudioPlayer();

    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }

    this.currentRelease = null;
    this.videoElement = null;
  },

  restoreAudioPlayer() {
    const bottomPlayer = document.querySelector('.player') || document.getElementById('player-bar');
    if (bottomPlayer && bottomPlayer.dataset.vpmHidden) {
      bottomPlayer.style.display = '';
      delete bottomPlayer.dataset.vpmHidden;
    }
  },

  _escape(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _injectStyles() {
    if (this._stylesInjected) return;
    if (document.getElementById('vpm-styles')) {
      this._stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'vpm-styles';
    style.textContent = `
      /* ============================================
         VIDEO PLAYER MODAL — fully scoped, fullscreen
         z-index 999999 to sit above EVERYTHING (player bar, other modals)
         ============================================ */
      .vpm-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        background: rgba(0, 0, 0, 0.95) !important;
        z-index: 999999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        animation: vpm-fade-in 200ms ease;
      }

      @keyframes vpm-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      .vpm-modal {
        width: 95vw;
        max-width: 1400px;
        height: 90vh;
        display: flex;
        flex-direction: column;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
      }

      .vpm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.5);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .vpm-title h2 {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #fff;
      }

      .vpm-title p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }

      .vpm-close {
        width: 40px;
        height: 40px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 150ms;
        flex-shrink: 0;
      }

      .vpm-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }

      .vpm-container {
        flex: 1;
        position: relative;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
      }

      .vpm-video {
        width: 100%;
        height: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .vpm-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1;
      }

      .vpm-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top-color: #ef4444;
        border-radius: 50%;
        animation: vpm-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes vpm-spin {
        to { transform: rotate(360deg); }
      }

      .vpm-loading p {
        color: #fff;
        font-size: 14px;
        margin: 0;
      }

      .vpm-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        gap: 16px;
      }

      .vpm-meta {
        display: flex;
        align-items: center;
        gap: 24px;
        flex: 1;
      }

      .vpm-price {
        font-size: 16px;
        font-weight: 700;
        color: #ef4444;
      }

      .vpm-editions {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }

      .vpm-buy-btn {
        padding: 10px 24px;
        background: #ef4444;
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 150ms;
        white-space: nowrap;
      }

      .vpm-buy-btn:hover {
        background: #dc2626;
        transform: scale(1.05);
      }

      .vpm-buy-btn:active {
        transform: scale(0.98);
      }

      @media (max-width: 768px) {
        .vpm-modal {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          max-width: 100vw;
          border-radius: 0;
        }

        .vpm-header {
          padding: 12px 16px;
        }

        .vpm-title h2 {
          font-size: 16px;
        }

        .vpm-title p {
          font-size: 13px;
        }

        .vpm-info {
          flex-direction: column;
          align-items: stretch;
        }

        .vpm-meta {
          width: 100%;
          justify-content: space-between;
        }

        .vpm-buy-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    this._stylesInjected = true;
  }
};

// Make globally available
if (typeof window !== 'undefined') {
  window.VideoPlayerModal = VideoPlayerModal;
}
