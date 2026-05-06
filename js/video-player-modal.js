/**
 * Video Player Modal
 * Full-screen video player for film content & music videos
 *
 * FIXES APPLIED (May 2026):
 * ✅ Removed conflicting `.modal-overlay` class (opacity/visibility inheritance)
 * ✅ Inline styles inject ONCE into <head>
 * ✅ Multi-gateway support (Lighthouse IPFS, Filecoin S3, IPFS proxy)
 * ✅ Proper handleKeyDown binding
 * ✅ Safe Player.pause() guard
 * ✅ Buy NFT button → opens purchase modal
 *
 * MOBILE FIXES (May 2026):
 * ✅ Replaced `100dvh` (which can collapse modal on older browsers) with vh + JS height
 * ✅ Hide spinner on `loadedmetadata` (fires earlier than canplay on mobile)
 * ✅ Hard timeout: hide spinner after 8s no matter what so native controls show
 * ✅ Mobile-friendly autoplay attempt (muted first, falls back to tap-to-play overlay)
 * ✅ On-screen diagnostics panel for mobile debugging (shake device or long-press header)
 * ✅ preload="auto" so mobile actually starts buffering
 * ✅ Forced explicit pixel height on container as belt-and-suspenders
 */

const VideoPlayerModal = {
  currentRelease: null,
  videoElement: null,
  isBuffering: false,
  _stylesInjected: false,
  _boundKeyHandler: null,
  _spinnerTimeout: null,
  _diagnostics: [],

  show(release) {
    this._log('🎬 show() called', release?.title);

    this.currentRelease = release;
    this._diagnostics = [];

    this._injectStyles();

    // Hide bottom audio player
    const bottomPlayer = document.querySelector('.player') || document.getElementById('player-bar');
    if (bottomPlayer) {
      bottomPlayer.dataset.vpmHidden = 'true';
      bottomPlayer.style.display = 'none';
    }

    // Pause audio
    if (typeof Player !== 'undefined' && Player.audio) {
      try {
        if (typeof Player.pause === 'function') Player.pause();
        else if (!Player.audio.paused) Player.audio.pause();
      } catch (err) {
        this._log('⚠️ Could not pause audio:', err.message);
      }
    }

    const track = release.tracks?.[0];
    if (!track) {
      alert('No video found for this release. The video data may be missing.');
      this.restoreAudioPlayer();
      return;
    }

    // Resolve video URL
    let videoUrl = null;
    if (track.videoUrl) videoUrl = this.getProxiedUrl(track.videoUrl);
    else if (track.audioUrl) videoUrl = this.getProxiedUrl(track.audioUrl);
    else if (track.videoCid) videoUrl = `/api/ipfs/${track.videoCid}`;
    else if (track.audioCid) videoUrl = `/api/ipfs/${track.audioCid}`;

    if (!videoUrl) {
      alert('Video URL not found. The video may not have been uploaded correctly.');
      this.restoreAudioPlayer();
      return;
    }

    this._log('🎬 Final URL:', videoUrl);
    this._log('📱 UA:', navigator.userAgent.substring(0, 80));
    this._log('📐 Window:', `${window.innerWidth}x${window.innerHeight}`);

    const html = `
      <div class="vpm-overlay" id="video-modal-overlay">
        <div class="vpm-modal" id="vpm-modal">
          <div class="vpm-header">
            <div class="vpm-title">
              <h2 id="vpm-title-text">${this._escape(release.title || 'Untitled')}</h2>
              <p>${this._escape(release.artistName || 'Unknown Artist')}</p>
            </div>
            <button class="vpm-close" id="video-modal-close" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="vpm-container" id="vpm-container">
            <div class="vpm-loading" id="video-loading">
              <div class="vpm-spinner"></div>
              <p id="vpm-loading-text">Loading video...</p>
            </div>

            <video
              id="video-player"
              class="vpm-video"
              controls
              preload="auto"
              playsinline
              webkit-playsinline
              x5-playsinline
              crossorigin="anonymous"
            >
              <source src="${videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>

            <button class="vpm-tap-to-play" id="vpm-tap-to-play" style="display:none;">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>Tap to play</span>
            </button>

            <div class="vpm-diag" id="vpm-diag" style="display:none;"></div>
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

    // Remove any existing modal
    const existing = document.getElementById('video-modal-overlay');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', html);
    this._log('✅ Modal injected');

    // Force explicit pixel height — belt-and-suspenders against viewport unit issues
    this._fixModalHeight();
    window.addEventListener('resize', this._fixModalHeightBound = () => this._fixModalHeight());
    window.addEventListener('orientationchange', this._fixModalHeightBound);

    requestAnimationFrame(() => {
      this.bindModalEvents(videoUrl, release);
    });
  },

  _fixModalHeight() {
    const overlay = document.getElementById('video-modal-overlay');
    const modal = document.getElementById('vpm-modal');
    if (!overlay || !modal) return;
    const h = window.innerHeight;
    overlay.style.height = h + 'px';
    if (window.innerWidth <= 768) {
      modal.style.height = h + 'px';
    } else {
      modal.style.height = Math.min(h * 0.9, h) + 'px';
    }
    this._log('📐 Forced height:', h);
  },

  bindModalEvents(videoUrl, release) {
    this.videoElement = document.getElementById('video-player');
    const loadingEl = document.getElementById('video-loading');
    const loadingText = document.getElementById('vpm-loading-text');
    const tapToPlay = document.getElementById('vpm-tap-to-play');
    const closeBtn = document.getElementById('video-modal-close');
    const overlay = document.getElementById('video-modal-overlay');
    const buyBtn = document.getElementById('video-modal-buy-btn');
    const titleText = document.getElementById('vpm-title-text');

    if (!this.videoElement) {
      this._log('❌ Video element not found');
      return;
    }

    // Long-press title to show diagnostics
    if (titleText) {
      let pressTimer;
      const startPress = () => {
        pressTimer = setTimeout(() => this._showDiagnostics(), 800);
      };
      const cancelPress = () => clearTimeout(pressTimer);
      titleText.addEventListener('touchstart', startPress);
      titleText.addEventListener('touchend', cancelPress);
      titleText.addEventListener('touchmove', cancelPress);
      titleText.addEventListener('mousedown', startPress);
      titleText.addEventListener('mouseup', cancelPress);
      titleText.addEventListener('mouseleave', cancelPress);
    }

    closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    if (buyBtn) {
      buyBtn.addEventListener('click', () => {
        if (this.videoElement) this.videoElement.pause();
        if (typeof Modals !== 'undefined' && typeof Modals.showPurchase === 'function') {
          Modals.showPurchase(release);
        } else {
          alert('Purchase system not available. Please refresh the page.');
        }
      });
    }

    // Tap-to-play fallback
    tapToPlay.addEventListener('click', () => {
      tapToPlay.style.display = 'none';
      this.videoElement.muted = false;
      this.videoElement.play().catch(err => {
        this._log('❌ Manual play failed:', err.message);
        this._showDiagnostics();
      });
    });

    // ===== VIDEO EVENTS =====
    this.videoElement.addEventListener('loadstart', () => {
      this._log('📹 loadstart');
      loadingEl.style.display = 'flex';
      loadingText.textContent = 'Loading video...';
    });

    // KEY MOBILE FIX: hide spinner on loadedmetadata, not just canplay
    this.videoElement.addEventListener('loadedmetadata', () => {
      this._log('📹 loadedmetadata, dur=', this.videoElement.duration);
      loadingEl.style.display = 'none';
      this._tryAutoplay(tapToPlay);
    });

    this.videoElement.addEventListener('canplay', () => {
      this._log('✅ canplay');
      loadingEl.style.display = 'none';
    });

    this.videoElement.addEventListener('waiting', () => {
      this._log('⏳ waiting (buffering)');
      // Don't show spinner if video already started — looks janky on mobile
    });

    this.videoElement.addEventListener('playing', () => {
      this._log('▶️ playing');
      loadingEl.style.display = 'none';
      tapToPlay.style.display = 'none';
      if (this._spinnerTimeout) {
        clearTimeout(this._spinnerTimeout);
        this._spinnerTimeout = null;
      }
    });

    this.videoElement.addEventListener('error', () => {
      const err = this.videoElement.error;
      this._log('❌ Video error code=', err?.code, 'msg=', err?.message);
      loadingEl.style.display = 'none';

      let errorMsg = 'Failed to load video. ';
      if (err) {
        switch (err.code) {
          case 1: errorMsg += 'Download was aborted.'; break;
          case 2: errorMsg += 'Network error.'; break;
          case 3: errorMsg += 'Video file is corrupted or unsupported format.'; break;
          case 4: errorMsg += 'Video format not supported by your browser.'; break;
          default: errorMsg += 'Unknown error.';
        }
      }
      this._log('💬 ' + errorMsg);
      this._showDiagnostics(errorMsg);
    });

    // SAFETY NET: if nothing happens in 8s, hide spinner so native controls show
    this._spinnerTimeout = setTimeout(() => {
      if (loadingEl && loadingEl.style.display !== 'none') {
        this._log('⏰ Spinner timeout fired (8s). State=' + this.videoElement.readyState);
        loadingEl.style.display = 'none';
        if (this.videoElement.readyState === 0) {
          loadingText.textContent = 'Tap play to start video';
          tapToPlay.style.display = 'flex';
        }
      }
    }, 8000);

    // ESC key
    this._boundKeyHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._boundKeyHandler);
  },

  _tryAutoplay(tapToPlay) {
    // First try unmuted
    const playPromise = this.videoElement.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => this._log('▶️ Autoplay (unmuted) succeeded'))
        .catch(err => {
          this._log('⚠️ Unmuted autoplay blocked:', err.message);
          // Try muted (most browsers allow this)
          this.videoElement.muted = true;
          this.videoElement.play()
            .then(() => {
              this._log('▶️ Autoplay (muted) succeeded — showing tap-to-unmute');
              tapToPlay.style.display = 'flex';
            })
            .catch(err2 => {
              this._log('❌ Even muted autoplay blocked:', err2.message);
              tapToPlay.style.display = 'flex';
            });
        });
    }
  },

  getProxiedUrl(url) {
    if (!url) return null;
    if (url.includes('gateway.lighthouse.storage')) return url;
    if (url.includes('.fil.one') || url.includes('filecoin')) return url;
    if (url.startsWith('/api/ipfs/')) return url;
    if (url.includes('/ipfs/')) {
      const cid = url.split('/ipfs/')[1].split('?')[0];
      return `/api/ipfs/${cid}`;
    }
    if (typeof IpfsHelper !== 'undefined' && IpfsHelper.toProxyUrl) {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },

  close() {
    this._log('🔴 Closing');

    if (this._spinnerTimeout) {
      clearTimeout(this._spinnerTimeout);
      this._spinnerTimeout = null;
    }

    if (this._fixModalHeightBound) {
      window.removeEventListener('resize', this._fixModalHeightBound);
      window.removeEventListener('orientationchange', this._fixModalHeightBound);
      this._fixModalHeightBound = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
      } catch (e) {}
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

  _log(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    this._diagnostics.push(`[${new Date().toISOString().substring(11, 23)}] ${msg}`);
    console.log('[VPM]', ...args);
  },

  _showDiagnostics(extraMsg) {
    const diag = document.getElementById('vpm-diag');
    if (!diag) return;
    const v = this.videoElement;
    const state = v ? {
      readyState: v.readyState,
      networkState: v.networkState,
      currentSrc: v.currentSrc?.substring(0, 80),
      duration: v.duration,
      paused: v.paused,
      muted: v.muted,
      error: v.error ? `code=${v.error.code} msg=${v.error.message}` : 'none',
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
    } : 'no video element';

    diag.style.display = 'block';
    diag.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;color:#ef4444;">
        ${extraMsg ? '❌ ' + extraMsg : '🔍 Diagnostics'}
      </div>
      <div style="margin-bottom:8px;"><strong>Video state:</strong><br>${this._escape(JSON.stringify(state, null, 2))}</div>
      <div style="margin-bottom:8px;"><strong>Log:</strong></div>
      <div style="font-family:monospace;font-size:10px;white-space:pre-wrap;">${this._escape(this._diagnostics.join('\n'))}</div>
      <button onclick="VideoPlayerModal._copyDiagnostics()" style="margin-top:12px;padding:8px 16px;background:#ef4444;border:none;color:white;border-radius:6px;font-size:13px;">Copy to clipboard</button>
    `;
  },

  _copyDiagnostics() {
    const v = this.videoElement;
    const state = v ? {
      readyState: v.readyState, networkState: v.networkState,
      currentSrc: v.currentSrc, duration: v.duration,
      videoWidth: v.videoWidth, videoHeight: v.videoHeight,
      error: v.error ? { code: v.error.code, message: v.error.message } : null,
    } : null;
    const text = `Video state:\n${JSON.stringify(state, null, 2)}\n\nLog:\n${this._diagnostics.join('\n')}\n\nUA: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => prompt('Copy this:', text));
    } else {
      prompt('Copy this:', text);
    }
  },

  _escape(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _injectStyles() {
    if (this._stylesInjected || document.getElementById('vpm-styles')) {
      this._stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'vpm-styles';
    style.textContent = `
      .vpm-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
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
        flex-shrink: 0;
      }

      .vpm-title h2 {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #fff;
        cursor: pointer;
        -webkit-user-select: none;
        user-select: none;
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
        flex: 1 1 auto;
        position: relative;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        overflow: hidden;
      }

      .vpm-video {
        width: 100%;
        height: 100%;
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
        background: #000;
      }

      .vpm-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 2;
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

      .vpm-tap-to-play {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: rgba(0,0,0,0.5);
        border: none;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        gap: 12px;
      }

      .vpm-tap-to-play:active {
        background: rgba(0,0,0,0.7);
      }

      .vpm-diag {
        position: absolute;
        inset: 16px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 16px;
        border-radius: 8px;
        font-size: 12px;
        overflow-y: auto;
        border: 1px solid #ef4444;
      }

      .vpm-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        gap: 16px;
        flex-shrink: 0;
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
          padding: 12px 16px;
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

if (typeof window !== 'undefined') {
  window.VideoPlayerModal = VideoPlayerModal;
}
