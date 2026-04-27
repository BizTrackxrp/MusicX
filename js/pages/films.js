/**
 * XRP Music - Films Page (Combined Feed + Upload)
 * 
 * FIXES APPLIED (April 2026):
 * ✅ Issue 1: Added Public vs NFT Holders access toggle
 * ✅ Issue 2: Upload defaults to LIVE status (not draft)
 * ✅ Issue 3: Improved thumbnail upload + storage
 * ✅ Issue 4: Proper video URL storage (videoUrl + audioUrl fallback)
 */

const FilmsPage = {
  videos: [],
  isLoading: false,
  sortBy: 'newest',
  LIGHTHOUSE_API_KEY: null,

  async init() {
    try {
      const res = await fetch('/api/upload-config');
      const config = await res.json();
      this.LIGHTHOUSE_API_KEY = config.key;
      console.log('✅ Lighthouse direct upload enabled');
    } catch (err) {
      console.error('Failed to load Lighthouse config:', err);
    }
  },

  async render() {
    if (!this.LIGHTHOUSE_API_KEY) {
      await this.init();
    }

    UI.renderPage(`
      ${this.getStyles()}
      <div class="videos-page">
        <div class="videos-header">
          <div class="videos-header-left">
            <h1 class="videos-title">Videos</h1>
            <p class="videos-subtitle">Films, documentaries, and video content on XRPL</p>
          </div>
          <div class="videos-header-right">
            <button class="btn btn-primary" id="videos-upload-btn">🎬 Upload Video</button>
          </div>
        </div>
        <div class="videos-controls">
          <div class="videos-sort-tabs">
            <button class="sort-tab active" data-sort="newest">Newest</button>
            <button class="sort-tab" data-sort="popular">Most Played</button>
            <button class="sort-tab" data-sort="trending">Trending</button>
          </div>
        </div>
        <div id="videos-content">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `);
    
    await this.loadVideos();
    this.bindEvents();
  },

  async loadVideos() {
    this.isLoading = true;
    const container = document.getElementById('videos-content');
    
    try {
      const response = await fetch('/api/releases?contentType=film');
      const data = await response.json();
      this.videos = data.releases || [];
      
      this.sortVideos();
      this.renderGrid();
    } catch (err) {
      console.error('Failed to load videos:', err);
      if (container) {
        container.innerHTML = `
          <div class="videos-error">
            <div class="videos-error-icon">⚠️</div>
            <h3>Failed to load videos</h3>
            <p>Please refresh the page to try again.</p>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
    }
  },

  sortVideos() {
    switch (this.sortBy) {
      case 'newest':
        this.videos.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        break;
      case 'popular':
        this.videos.sort((a, b) => (b.totalPlays || b.total_plays || 0) - (a.totalPlays || a.total_plays || 0));
        break;
      case 'trending':
        this.videos.sort((a, b) => {
          const aRecent = (a.recentPlays || a.recent_plays || 0);
          const bRecent = (b.recentPlays || b.recent_plays || 0);
          return bRecent - aRecent;
        });
        break;
    }
  },

  renderGrid() {
    const container = document.getElementById('videos-content');
    if (!container) return;

    if (this.videos.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    container.innerHTML = `
      <div class="videos-grid">
        ${this.videos.map(video => this.renderCard(video)).join('')}
      </div>
    `;

    document.querySelectorAll('.video-card').forEach(card => {
      card.addEventListener('click', () => {
        const videoData = card.dataset.video;
        if (!videoData) return;
        
        try {
          const video = JSON.parse(videoData);
          if (typeof VideoPlayerModal !== 'undefined') {
            VideoPlayerModal.show(video);
          } else {
            console.error('VideoPlayerModal not loaded');
            alert('Video player not available. Please refresh the page.');
          }
        } catch (err) {
          console.error('Failed to parse video data:', err);
        }
      });
    });
  },

  renderEmptyState() {
    return `
      <div class="videos-empty">
        <div class="videos-empty-icon">🎬</div>
        <h2>No videos yet</h2>
        <p>Be the first to upload a video to XRP Music.<br>Your content, preserved forever on Filecoin and XRPL.</p>
        <button class="btn btn-primary videos-upload-btn" style="margin-top:16px;font-size:15px;padding:12px 28px;">
          Upload Video
        </button>
      </div>
    `;
  },

  renderCard(video) {
    const thumb = this.getImageUrl(video.coverUrl || video.cover_url);
    const artist = video.artistName || video.artist_name || 'Unknown';
    const price = video.albumPrice || video.songPrice || video.album_price || video.song_price || 0;
    const sold = video.soldEditions || video.sold_editions || 0;
    const total = video.totalEditions || video.total_editions || 0;
    const available = total - sold;
    const plays = video.totalPlays || video.total_plays || 0;
    
    const track = video.tracks?.[0];
    const duration = track?.duration || 0;
    const durationText = duration > 0 ? this.formatDuration(duration) : '';

    return `
      <div class="video-card" data-video-id="${video.id}" data-video='${JSON.stringify(video).replace(/'/g, "&apos;")}'>
        <div class="video-card-thumb">
          <img src="${thumb}" alt="${video.title}" onerror="this.src='/placeholder.png'">
          <div class="video-card-overlay">
            <div class="video-card-play">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
          ${durationText ? `<div class="video-card-duration">${durationText}</div>` : ''}
          <div class="video-card-badge">${available > 0 ? `${available} left` : 'Sold Out'}</div>
        </div>
        <div class="video-card-info">
          <div class="video-card-title">${video.title}</div>
          <div class="video-card-meta">
            <span class="video-card-artist">${artist}</span>
            ${plays > 0 ? `<span class="video-card-plays">• ${this.formatPlays(plays)} plays</span>` : ''}
          </div>
          <div class="video-card-price">${price === 0 ? 'FREE' : price + ' XRP'}</div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.querySelectorAll('#videos-upload-btn, .videos-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) {
          if (typeof Modals !== 'undefined') Modals.showAuth();
          return;
        }
        if (!this.LIGHTHOUSE_API_KEY) {
          alert('Upload system not ready. Please refresh the page.');
          return;
        }
        this.showUploadModal();
      });
    });

    document.querySelectorAll('.sort-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const sort = tab.dataset.sort;
        if (sort === this.sortBy) return;
        
        document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        this.sortBy = sort;
        this.sortVideos();
        this.renderGrid();
      });
    });
  },

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') return IpfsHelper.toProxyUrl(url);
    return url;
  },

  formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  formatPlays(plays) {
    if (plays >= 1000000) return `${(plays / 1000000).toFixed(1)}M`;
    if (plays >= 1000) return `${(plays / 1000).toFixed(1)}K`;
    return plays.toString();
  },

  async uploadToLighthouse(file, useFilecoin = false, onProgress = () => {}) {
    if (!this.LIGHTHOUSE_API_KEY) {
      throw new Error('Lighthouse API key not loaded');
    }

    const formData = new FormData();
    formData.append('file', file);

    let url = 'https://upload.lighthouse.storage/api/v0/add';
    if (useFilecoin) url += '?network=filecoin';

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve({
              cid: result.Hash,
              url: `https://gateway.lighthouse.storage/ipfs/${result.Hash}`,
              size: result.Size,
              name: result.Name
            });
          } catch (err) {
            reject(new Error('Invalid response from Lighthouse'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${this.LIGHTHOUSE_API_KEY}`);
      xhr.send(formData);
    });
  },

  showUploadModal() {
    const html = `
      <div class="modal-overlay">
        <div class="modal video-upload-modal">
          <div class="modal-header">
            <div class="modal-title">Upload Video to XRPL</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Step 1: Details with Access Toggle -->
            <div class="video-step" id="video-step-1">
              <h3 class="video-step-title">Video Details</h3>

              <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" class="form-input" id="video-title" placeholder="Your video title" required>
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-input form-textarea" id="video-description" placeholder="What's this video about?" rows="3"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Editions *</label>
                  <input type="number" class="form-input" id="video-editions" value="100" min="1" max="10000">
                  <p class="form-hint">How many copies can be sold</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Price (XRP) *</label>
                  <input type="number" class="form-input" id="video-price" value="10" min="0" step="0.1">
                  <p class="form-hint">Per copy</p>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Resale Royalty %</label>
                <input type="number" class="form-input" id="video-royalty" value="10" min="0" max="50" step="0.5">
                <p class="form-hint">You earn this on every secondary sale</p>
              </div>

              <!-- ✅ NEW: PUBLIC VS NFT HOLDERS TOGGLE -->
              <div class="form-group">
                <label class="form-label">Who Can Watch This Video? *</label>
                <div class="access-toggle-group">
                  <label class="access-option">
                    <input type="radio" name="video-access" value="public" checked>
                    <div class="access-option-card">
                      <div class="access-option-icon">🌍</div>
                      <div class="access-option-title">Public</div>
                      <div class="access-option-desc">Anyone can watch (they still need to buy the NFT to own it)</div>
                    </div>
                  </label>
                  <label class="access-option">
                    <input type="radio" name="video-access" value="nft_holders">
                    <div class="access-option-card">
                      <div class="access-option-icon">🎫</div>
                      <div class="access-option-title">NFT Holders Only</div>
                      <div class="access-option-desc">Must own an NFT to watch (NFTs = tickets)</div>
                    </div>
                  </label>
                </div>
                <p class="form-hint">💡 NFT Holders mode is great for exclusive films, behind-the-scenes content, or ticketed events</p>
              </div>

              <button type="button" class="btn btn-primary btn-full" id="video-next-1">Next: Select Files</button>
            </div>

            <!-- Step 2: Select Files -->
            <div class="video-step hidden" id="video-step-2">
              <h3 class="video-step-title">Select Files</h3>

              <!-- Thumbnail -->
              <div class="form-group">
                <label class="form-label">Thumbnail *</label>
                <div class="upload-zone" id="video-thumb-zone">
                  <input type="file" id="video-thumb-input" accept="image/*" style="display:none;">
                  <div class="upload-placeholder" id="video-thumb-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>Click to select thumbnail</span>
                    <span class="upload-hint">JPG, PNG — 1920×1080 recommended</span>
                  </div>
                  <div class="upload-preview hidden" id="video-thumb-preview">
                    <img id="video-thumb-img" src="" alt="">
                    <button type="button" class="upload-remove" id="video-thumb-remove">×</button>
                  </div>
                </div>
              </div>

              <!-- Video File -->
              <div class="form-group">
                <label class="form-label">Video File *</label>
                <div class="upload-zone video-video-zone" id="video-video-zone">
                  <input type="file" id="video-video-input" accept="video/*" style="display:none;">
                  <div class="upload-placeholder" id="video-video-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"></rect><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon></svg>
                    <span>Click to select video</span>
                    <span class="upload-hint">MP4, MOV, WebM — up to 10GB</span>
                  </div>
                  <div class="upload-file-info hidden" id="video-video-info">
                    <div class="file-info-icon">🎬</div>
                    <div class="file-info-details">
                      <div class="file-info-name" id="video-video-name"></div>
                      <div class="file-info-size" id="video-video-size"></div>
                    </div>
                    <button type="button" class="file-info-remove" id="video-video-remove">×</button>
                  </div>
                </div>
              </div>

              <div class="video-nav">
                <button type="button" class="btn btn-secondary" id="video-back-2">Back</button>
                <button type="button" class="btn btn-primary" id="video-next-2">Next: Payment</button>
              </div>
            </div>

            <!-- Step 3-5: Payment, Upload, Success (unchanged) -->
            ${this.getPaymentSteps()}

          </div>
        </div>
      </div>

      ${this.getModalStyles()}
    `;

    Modals.show(html);
    this.bindUploadEvents();
  },

  getPaymentSteps() {
    return `
            <!-- Step 3: Payment -->
            <div class="video-step hidden" id="video-step-3">
              <h3 class="video-step-title">Payment</h3>

              <div class="payment-warning">
                <div class="payment-warning-icon">⚠️</div>
                <div>
                  <div class="payment-warning-title">Payment Required Before Upload</div>
                  <p class="payment-warning-text">Filecoin storage is permanent. Pay upfront to cover storage + minting. <strong>Auto-refund if upload fails.</strong></p>
                </div>
              </div>

              <div class="payment-breakdown">
                <div class="payment-row">
                  <span>Permanent Filecoin Storage</span>
                  <span id="payment-storage-fee">-</span>
                </div>
                <div class="payment-row">
                  <span>Video Size</span>
                  <span id="payment-video-size">-</span>
                </div>
                <div class="payment-row">
                  <span>Thumbnail Storage</span>
                  <span>0.01 XRP</span>
                </div>
                <div class="payment-row">
                  <span>Platform Fee</span>
                  <span>0.10 XRP</span>
                </div>
                <div class="payment-row">
                  <span>Mint Fee (<span id="payment-editions-count">-</span> ed)</span>
                  <span id="payment-mint-fee">-</span>
                </div>
                <div class="payment-row payment-total">
                  <span>TOTAL</span>
                  <span id="payment-total">-</span>
                </div>
              </div>

              <div class="payment-note">
                💡 <strong>What you get:</strong> Permanent Filecoin storage + NFT minted on XRPL + Your video lives forever on-chain
              </div>

              <div class="video-mint-status hidden" id="video-payment-status">
                <div class="mint-status-icon"><div class="spinner"></div></div>
                <div class="video-mint-status-text" id="video-payment-status-text">Waiting for payment...</div>
              </div>

              <div class="video-nav" id="video-nav-3">
                <button type="button" class="btn btn-secondary" id="video-back-3">Back</button>
                <button type="button" class="btn btn-primary" id="video-pay-btn" style="flex:2;">
                  💳 Pay & Start Upload
                </button>
              </div>
            </div>

            <!-- Step 4: Upload Progress -->
            <div class="video-step hidden" id="video-step-4">
              <h3 class="video-step-title">Uploading to Filecoin</h3>

              <div class="upload-status-card">
                <div class="upload-status-icon">✅</div>
                <div class="upload-status-text">Payment confirmed!</div>
              </div>

              <div class="upload-progress-section">
                <div class="upload-progress-item" id="upload-thumb-progress">
                  <div class="upload-progress-label">
                    <span>Uploading thumbnail...</span>
                    <span class="upload-progress-pct" id="thumb-pct">0%</span>
                  </div>
                  <div class="upload-progress-bar">
                    <div class="upload-progress-fill" id="thumb-bar" style="width:0%"></div>
                  </div>
                </div>

                <div class="upload-progress-item hidden" id="upload-video-progress">
                  <div class="upload-progress-label">
                    <span>Uploading video to Filecoin...</span>
                    <span class="upload-progress-pct" id="video-pct">0%</span>
                  </div>
                  <div class="upload-progress-bar">
                    <div class="upload-progress-fill" id="video-bar" style="width:0%"></div>
                  </div>
                </div>

                <div class="upload-progress-item hidden" id="upload-minting-progress">
                  <div class="upload-progress-label">
                    <span>Creating NFT metadata...</span>
                    <span class="upload-progress-pct">⏳</span>
                  </div>
                </div>
              </div>

              <div class="upload-warning">
                ⚠️ <strong>Do not close this page</strong> — upload in progress
              </div>
            </div>

            <!-- Step 5: Success -->
            <div class="video-step hidden" id="video-step-5">
              <div class="success-animation">
                <div class="success-icon">🎬</div>
                <h2 class="success-title" id="success-title">Video is Live!</h2>
                <p class="success-text">Your video is on Filecoin forever. No one can delete it.</p>
                
                <div class="success-share">
                  <button class="btn btn-secondary" id="success-share-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                    Share on X
                  </button>
                  <button class="btn btn-primary" id="success-done-btn">View Video</button>
                </div>
              </div>
            </div>
    `;
  },

  bindUploadEvents() {
    const STORAGE_RATE_PER_GB = 0.29;
    const PLATFORM_FEE = 0.10;
    
    let thumbFile = null;
    let videoFile = null;
    let paymentTxHash = null;
    let paymentAmount = 0;
    let accessType = 'public';

    document.querySelector('.modal-close')?.addEventListener('click', () => Modals.close());

    document.getElementById('video-next-1')?.addEventListener('click', () => {
      const title = document.getElementById('video-title')?.value.trim();
      if (!title) { alert('Please enter a title'); return; }
      
      const selectedAccess = document.querySelector('input[name="video-access"]:checked');
      accessType = selectedAccess ? selectedAccess.value : 'public';
      console.log('📹 Video access type:', accessType);
      
      document.getElementById('video-step-1')?.classList.add('hidden');
      document.getElementById('video-step-2')?.classList.remove('hidden');
    });

    document.getElementById('video-back-2')?.addEventListener('click', () => {
      document.getElementById('video-step-2')?.classList.add('hidden');
      document.getElementById('video-step-1')?.classList.remove('hidden');
    });

    const thumbZone = document.getElementById('video-thumb-zone');
    const thumbInput = document.getElementById('video-thumb-input');
    if (thumbZone && thumbInput) {
      thumbZone.addEventListener('click', () => thumbInput.click());
      thumbInput.addEventListener('change', () => {
        const file = thumbInput.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 10 * 1024 * 1024) { alert('Thumbnail too large (max 10MB)'); return; }
        
        thumbFile = file;
        document.getElementById('video-thumb-img').src = URL.createObjectURL(file);
        document.getElementById('video-thumb-placeholder')?.classList.add('hidden');
        document.getElementById('video-thumb-preview')?.classList.remove('hidden');
        thumbZone.classList.add('has-file');
        console.log('✅ Thumbnail selected:', file.name);
      });
    }

    document.getElementById('video-thumb-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      thumbFile = null;
      document.getElementById('video-thumb-placeholder')?.classList.remove('hidden');
      document.getElementById('video-thumb-preview')?.classList.add('hidden');
      thumbZone?.classList.remove('has-file');
    });

    const videoZone = document.getElementById('video-video-zone');
    const videoInput = document.getElementById('video-video-input');
    if (videoZone && videoInput) {
      videoZone.addEventListener('click', () => { if (!videoFile) videoInput.click(); });
      
      videoInput.addEventListener('change', () => {
        const file = videoInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024 * 1024) { alert('File too large (max 10GB)'); return; }

        videoFile = file;
        const sizeGB = file.size / (1024 * 1024 * 1024);
        const sizeMB = file.size / (1024 * 1024);
        const sizeText = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
        
        document.getElementById('video-video-placeholder')?.classList.add('hidden');
        document.getElementById('video-video-info')?.classList.remove('hidden');
        document.getElementById('video-video-name').textContent = file.name;
        document.getElementById('video-video-size').textContent = sizeText;
        videoZone.classList.add('has-file');
        console.log('✅ Video selected:', file.name, sizeText);
      });
    }

    document.getElementById('video-video-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      videoFile = null;
      document.getElementById('video-video-placeholder')?.classList.remove('hidden');
      document.getElementById('video-video-info')?.classList.add('hidden');
      videoZone?.classList.remove('has-file');
    });

    document.getElementById('video-next-2')?.addEventListener('click', () => {
      if (!thumbFile) { alert('Please select a thumbnail'); return; }
      if (!videoFile) { alert('Please select a video file'); return; }

      const editions = parseInt(document.getElementById('video-editions')?.value) || 100;
      const videoSizeGB = videoFile.size / (1024 * 1024 * 1024);
      const storageFee = (videoSizeGB * STORAGE_RATE_PER_GB).toFixed(4);
      const thumbFee = 0.01;
      const mintFee = ((editions * 0.000012) + 0.002).toFixed(6);
      const totalCost = (parseFloat(storageFee) + thumbFee + PLATFORM_FEE + parseFloat(mintFee)).toFixed(4);

      document.getElementById('payment-storage-fee').textContent = `${storageFee} XRP`;
      document.getElementById('payment-video-size').textContent = `${videoSizeGB.toFixed(2)} GB @ 0.29 XRP/GB`;
      document.getElementById('payment-editions-count').textContent = editions;
      document.getElementById('payment-mint-fee').textContent = `${mintFee} XRP`;
      document.getElementById('payment-total').textContent = `${totalCost} XRP`;

      paymentAmount = parseFloat(totalCost);

      document.getElementById('video-step-2')?.classList.add('hidden');
      document.getElementById('video-step-3')?.classList.remove('hidden');
    });

    document.getElementById('video-back-3')?.addEventListener('click', () => {
      document.getElementById('video-step-3')?.classList.add('hidden');
      document.getElementById('video-step-2')?.classList.remove('hidden');
    });

    document.getElementById('video-pay-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('video-payment-status');
      const navEl = document.getElementById('video-nav-3');
      const statusText = document.getElementById('video-payment-status-text');
      
      statusEl?.classList.remove('hidden');
      if (navEl) navEl.style.display = 'none';

      try {
        const title = document.getElementById('video-title')?.value || '';
        
        const configRes = await fetch('/api/batch-mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getConfig' })
        });
        const { platformAddress } = await configRes.json();
        if (!platformAddress) throw new Error('Platform not configured');

        if (statusText) statusText.textContent = '📱 Waiting for payment in Xaman...';
        
        const payResult = await XamanWallet.sendPayment(platformAddress, paymentAmount, `XRP Music Videos: ${title}`);
        
        if (!payResult.success) throw new Error(payResult.error || 'Payment cancelled');

        paymentTxHash = payResult.txHash;

        if (statusText) statusText.textContent = '✅ Payment confirmed!';
        
        setTimeout(() => {
          document.getElementById('video-step-3')?.classList.add('hidden');
          document.getElementById('video-step-4')?.classList.remove('hidden');
          startUpload();
        }, 1000);

      } catch (err) {
        console.error('Payment failed:', err);
        if (statusText) statusText.textContent = `❌ ${err.message || 'Payment failed'}`;
        if (navEl) navEl.style.display = 'flex';
      }
    });

    const startUpload = async () => {
      try {
        const title = document.getElementById('video-title')?.value || '';
        const description = document.getElementById('video-description')?.value || '';
        const price = parseFloat(document.getElementById('video-price')?.value) || 10;
        const editions = parseInt(document.getElementById('video-editions')?.value) || 100;
        const royaltyPercent = parseFloat(document.getElementById('video-royalty')?.value) || 10;

        console.log('🎬 Starting upload with access type:', accessType);

        document.getElementById('upload-thumb-progress')?.classList.remove('hidden');
        const thumbResult = await FilmsPage.uploadToLighthouse(thumbFile, false, (pct) => {
          const bar = document.getElementById('thumb-bar');
          const txt = document.getElementById('thumb-pct');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        });
        console.log('✅ Thumbnail uploaded:', thumbResult.cid);

        document.getElementById('upload-video-progress')?.classList.remove('hidden');
        const videoResult = await FilmsPage.uploadToLighthouse(videoFile, true, (pct) => {
          const bar = document.getElementById('video-bar');
          const txt = document.getElementById('video-pct');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        });
        console.log('✅ Video uploaded:', videoResult.cid);

        document.getElementById('upload-minting-progress')?.classList.remove('hidden');
        
        const metadata = {
          name: title,
          description,
          image: `ipfs://${thumbResult.cid}`,
          animation_url: `ipfs://${videoResult.cid}`,
          attributes: [
            { trait_type: 'Type', value: 'Video' },
            { trait_type: 'Content Type', value: 'film' },
            { trait_type: 'Access Type', value: accessType },
            { trait_type: 'Artist', value: AppState.profile?.name || AppState.user.address },
          ],
          properties: {
            video: videoResult.url,
            thumbnail: thumbResult.url,
            videoSize: videoResult.size,
            accessType: accessType,
          },
        };

        const metaBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metaFile = new File([metaBlob], `${title}-metadata.json`, { type: 'application/json' });
        const metaResult = await FilmsPage.uploadToLighthouse(metaFile, false);
        console.log('✅ Metadata uploaded:', metaResult.cid);

        const releaseData = {
          artistAddress: AppState.user.address,
          artistName: AppState.profile?.name || null,
          title,
          description,
          type: 'single',
          contentType: 'film',
          accessType: accessType,
          coverUrl: thumbResult.url,
          coverCid: thumbResult.cid,
          metadataCid: metaResult.cid,
          songPrice: price,
          albumPrice: null,
          totalEditions: editions,
          editionsPerTrack: editions,
          royaltyPercent,
          nftTokenIds: [],
          txHash: null,
          tracks: [{
            title,
            trackNumber: 1,
            duration: 0,
            audioCid: videoResult.cid,
            audioUrl: videoResult.url,
            videoCid: videoResult.cid,
            videoUrl: videoResult.url,
            price,
            soldEditions: 0,
            availableEditions: editions,
          }],
          sellOfferIndex: null,
          mintFeePaid: true,
          mintFeeTxHash: paymentTxHash,
          paymentAmount: paymentAmount,
          status: 'live',
        };

        console.log('💾 Saving release to database:', releaseData);
        await API.saveRelease(releaseData);

        document.getElementById('success-title').textContent = `${title} is Live!`;
        document.getElementById('video-step-4')?.classList.add('hidden');
        document.getElementById('video-step-5')?.classList.remove('hidden');

        console.log('🎉 Video upload complete!');

      } catch (err) {
        console.error('Upload failed:', err);
        
        alert(`Upload failed: ${err.message}\n\nRefunding ${paymentAmount} XRP...`);
        
        try {
          await fetch('/api/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentTxHash,
              userAddress: AppState.user.address,
              amount: paymentAmount,
              reason: err.message
            })
          });
          alert(`Refund sent! ${paymentAmount} XRP returned to your wallet.`);
        } catch (refundErr) {
          console.error('Refund failed:', refundErr);
          alert(`Upload failed AND refund failed. Please contact support with tx: ${paymentTxHash}`);
        }
        
        Modals.close();
      }
    };

    document.getElementById('success-share-btn')?.addEventListener('click', () => {
      const title = document.getElementById('video-title')?.value || 'my video';
      const text = `Just uploaded "${title}" to @XRP_MUSIC and minted it as an NFT on XRPL. No platform can delete it. 🎬⚡`;
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });

    document.getElementById('success-done-btn')?.addEventListener('click', () => {
      Modals.close();
      FilmsPage.loadVideos();
    });
  },

  getStyles() {
    return `
      <style>
        .videos-page { max-width: 1200px; margin: 0 auto; padding: 0 24px 120px; }
        .videos-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; gap: 24px; }
        @media (max-width: 640px) { .videos-header { flex-direction: column; align-items: flex-start; } .videos-header-right { width: 100%; } .videos-header-right .btn { width: 100%; } }
        .videos-title { font-size: 32px; font-weight: 800; margin: 0 0 4px; }
        .videos-subtitle { font-size: 14px; color: var(--text-muted); margin: 0; }
        .videos-controls { margin-bottom: 32px; }
        .videos-sort-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 0; }
        .sort-tab { padding: 12px 20px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 150ms; position: relative; bottom: -1px; }
        .sort-tab:hover { color: var(--text-primary); }
        .sort-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .videos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        @media (max-width: 640px) { .videos-grid { grid-template-columns: 1fr; } }
        .video-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; cursor: pointer; transition: all 150ms; }
        .video-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .video-card-thumb { position: relative; aspect-ratio: 16 / 9; background: var(--bg-hover); overflow: hidden; }
        .video-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .video-card-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 150ms; }
        .video-card:hover .video-card-overlay { opacity: 1; }
        .video-card-play { width: 64px; height: 64px; border-radius: 50%; background: rgba(239, 68, 68, 0.9); display: flex; align-items: center; justify-content: center; transform: scale(0.9); transition: transform 150ms; }
        .video-card:hover .video-card-play { transform: scale(1); }
        .video-card-duration { position: absolute; bottom: 8px; right: 8px; padding: 4px 8px; background: rgba(0, 0, 0, 0.8); border-radius: 4px; font-size: 12px; font-weight: 600; color: white; }
        .video-card-badge { position: absolute; top: 8px; right: 8px; padding: 4px 10px; background: rgba(0, 0, 0, 0.8); border-radius: 6px; font-size: 11px; font-weight: 600; color: white; }
        .video-card-info { padding: 16px; }
        .video-card-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
        .video-card-meta { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
        .video-card-artist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .video-card-plays { flex-shrink: 0; }
        .video-card-price { font-size: 14px; font-weight: 700; color: #f87171; }
        .videos-empty { text-align: center; padding: 80px 24px; }
        .videos-empty-icon { font-size: 80px; margin-bottom: 20px; opacity: 0.5; }
        .videos-empty h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .videos-empty p { font-size: 15px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.6; }
        .videos-error { text-align: center; padding: 80px 24px; }
        .videos-error-icon { font-size: 64px; margin-bottom: 16px; }
        .videos-error h3 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .videos-error p { font-size: 14px; color: var(--text-muted); }
        .loading-spinner { display: flex; justify-content: center; padding: 80px 24px; }
        .spinner { width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
  },

  getModalStyles() {
    return `
      <style>
        .video-upload-modal { max-width: 540px; }
        .video-step-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
        .video-step.hidden { display: none; }
        .video-nav { display: flex; gap: 12px; margin-top: 24px; }
        .video-nav .btn { flex: 1; }
        
        .access-toggle-group { display: grid; gap: 12px; margin-bottom: 8px; }
        .access-option { cursor: pointer; }
        .access-option input[type="radio"] { display: none; }
        .access-option-card {
          padding: 16px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-lg);
          transition: all 150ms;
          background: var(--bg-card);
        }
        .access-option input:checked + .access-option-card {
          border-color: var(--accent);
          background: rgba(239, 68, 68, 0.05);
        }
        .access-option-card:hover {
          border-color: var(--accent);
        }
        .access-option-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .access-option-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--text-primary);
        }
        .access-option-desc {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        
        .upload-file-info { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-card); border-radius: 12px; }
        .upload-file-info.hidden { display: none; }
        .file-info-icon { font-size: 32px; }
        .file-info-details { flex: 1; }
        .file-info-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .file-info-size { font-size: 12px; color: var(--text-muted); }
        .file-info-remove { width: 24px; height: 24px; background: var(--error); border: none; border-radius: 50%; color: white; font-size: 16px; cursor: pointer; }
        .payment-warning { display: flex; gap: 12px; padding: 16px; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; margin-bottom: 20px; }
        .payment-warning-icon { font-size: 24px; }
        .payment-warning-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; color: #fbbf24; }
        .payment-warning-text { font-size: 13px; color: var(--text-muted); margin: 0; line-height: 1.5; }
        .payment-breakdown { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .payment-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; border-bottom: 1px solid var(--border-color); }
        .payment-row:last-child { border-bottom: none; }
        .payment-row span:first-child { color: var(--text-secondary); }
        .payment-row span:last-child { font-weight: 500; }
        .payment-total { padding-top: 16px; margin-top: 8px; border-top: 2px solid var(--border-color) !important; font-size: 16px; font-weight: 700; }
        .payment-note { font-size: 13px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 20px; line-height: 1.5; }
        .upload-status-card { text-align: center; padding: 20px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; margin-bottom: 24px; }
        .upload-status-icon { font-size: 48px; margin-bottom: 8px; }
        .upload-status-text { font-size: 16px; font-weight: 600; color: #22c55e; }
        .upload-progress-section { margin-bottom: 20px; }
        .upload-progress-item { margin-bottom: 16px; }
        .upload-progress-item.hidden { display: none; }
        .upload-progress-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .upload-progress-pct { color: var(--text-muted); }
        .upload-progress-bar { height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; }
        .upload-progress-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 4px; transition: width 300ms ease; }
        .upload-warning { text-align: center; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-size: 13px; }
        .success-animation { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 80px; margin-bottom: 20px; animation: successPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        @keyframes successPop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
        .success-title { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
        .success-text { font-size: 14px; color: var(--text-muted); margin-bottom: 32px; }
        .success-share { display: flex; gap: 12px; justify-content: center; }
        .video-mint-status { text-align: center; padding: 24px; }
        .video-mint-status.hidden { display: none; }
        .video-mint-status-text { font-size: 14px; color: var(--text-secondary); margin-top: 12px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .btn-full { width: 100%; margin-top: 24px; }
        .upload-zone { border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 24px; text-align: center; cursor: pointer; transition: all 150ms; }
        .upload-zone:hover { border-color: #ef4444; background: rgba(239,68,68,0.05); }
        .upload-zone.has-file { border-style: solid; border-color: var(--success); }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-muted); }
        .upload-hint { font-size: 12px; }
        .upload-preview { position: relative; }
        .upload-preview img { width: 100%; max-width: 240px; border-radius: 8px; }
        .upload-preview.hidden { display: none; }
        .upload-remove { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--error); border: none; border-radius: 50%; color: white; font-size: 16px; cursor: pointer; }
      </style>
    `;
  },
};
