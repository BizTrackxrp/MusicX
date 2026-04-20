/**
 * XRP Music - Films Page (WORKING VERSION)
 * - Direct Lighthouse upload (bypasses Vercel 50MB limit)
 * - Payment before upload (prevents wasted Filecoin storage)
 * - Auto-refund on upload failure
 * - 0.29 XRP/GB permanent Filecoin storage
 */

const FilmsPage = {
  films: [],
  isLoading: false,
  LIGHTHOUSE_API_KEY: null,

  async init() {
    // Fetch Lighthouse API key for direct uploads
    try {
      const res = await fetch('/api/upload-config');
      const config = await res.json();
      this.LIGHTHOUSE_API_KEY = config.key; // API returns 'key' not 'lighthouseApiKey'
      console.log('✅ Lighthouse direct upload enabled');
    } catch (err) {
      console.error('Failed to load Lighthouse config:', err);
      alert('Upload system not available. Please refresh the page.');
    }
  },

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') return IpfsHelper.toProxyUrl(url);
    return url;
  },

  async render() {
    // Initialize Lighthouse config
    if (!this.LIGHTHOUSE_API_KEY) {
      await this.init();
    }
    
    UI.renderPage(`
      ${this.getStyles()}
      <div class="films-page">
        <div id="films-content">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `);
    await this.loadFilms();
  },

  async loadFilms() {
    this.isLoading = true;
    try {
      const response = await fetch('/api/releases?contentType=film');
      const data = await response.json();
      this.films = data.releases || [];
      this.renderContent();
    } catch (err) {
      console.error('Failed to load films:', err);
      this.renderContent();
    } finally {
      this.isLoading = false;
    }
  },

  renderContent() {
    const container = document.getElementById('films-content');
    if (!container) return;

    container.innerHTML = `
      <!-- Hero -->
      <div class="films-hero">
        <div class="films-bg-grid"></div>
        <div class="films-hero-content">
          <div class="films-badge">🎬 On-Chain Forever</div>
          <h1 class="films-title">Save Your Video to XRPL</h1>
          <p class="films-subtitle">
            YouTube deleted XRPL Japan's channel overnight.<br>
            Videos on XRP Music live on Filecoin — permanently, unstoppably, on-chain.
          </p>
          <div class="films-actions">
            <button class="btn btn-primary films-upload-btn" style="font-size:15px;padding:14px 32px;">
              🎬 Upload Your Film
            </button>
          </div>
          <p class="films-hero-sub">From $0.55 • Mint as an NFT • Fans own what they watch • You earn on every resale</p>
        </div>
      </div>

      <!-- Why on-chain -->
      <div class="films-features">
        <div class="films-feature">
          <div class="films-feature-icon">🛡️</div>
          <h3>Can't Be Deleted</h3>
          <p>Filecoin + XRPL means no platform, no company, no government can pull your content. It exists as long as the network does.</p>
        </div>
        <div class="films-feature">
          <div class="films-feature-icon">💸</div>
          <h3>Fans Buy, You Earn</h3>
          <p>Set a price per copy. Mint limited editions. Every resale pays you royalties automatically — forever.</p>
        </div>
        <div class="films-feature">
          <div class="films-feature-icon">🎟️</div>
          <h3>NFT = Ownership</h3>
          <p>Fans don't just watch — they own a piece. They can resell it, gift it, or hold it as a collectible.</p>
        </div>
        <div class="films-feature">
          <div class="films-feature-icon">⚡</div>
          <h3>XRP Ledger Fast</h3>
          <p>Transactions settle in 3-5 seconds. No gas wars. No waiting. Just instant, cheap, permanent.</p>
        </div>
      </div>

      <!-- Film grid or empty state -->
      ${this.films.length > 0 ? this.renderGrid() : this.renderEmptyState()}

      <!-- Bottom CTA -->
      <div class="films-cta-banner">
        <div class="films-cta-text">
          <h2>Your video, preserved forever</h2>
          <p>Upload once. Live on Filecoin permanently. No subscriptions, no platform risk, no takedowns. The XRP Ledger doesn't forget.</p>
        </div>
        <button class="btn btn-primary films-upload-btn" style="font-size:15px;padding:14px 32px;white-space:nowrap;">
          🎬 Upload Your Film
        </button>
      </div>
    `;

    this.bindEvents();
  },

  renderEmptyState() {
    return `
      <div class="films-empty">
        <div class="films-empty-icon">🎬</div>
        <h2>Be the first film on XRP Music</h2>
        <p>The entire page is yours until the second upload arrives.<br>Indie films, documentaries, short films, YouTube content — all welcome.</p>
        <button class="btn btn-primary films-upload-btn" style="font-size:15px;padding:14px 32px;margin-top:8px;">
          Upload Your Film
        </button>
      </div>
    `;
  },

  renderGrid() {
    return `
      <div class="films-section-label">Films & Videos</div>
      <div class="films-grid">
        ${this.films.map(film => this.renderCard(film)).join('')}
      </div>
    `;
  },

  renderCard(film) {
    const thumb = this.getImageUrl(film.coverUrl || film.cover_url);
    const artist = film.artistName || film.artist_name || 'Unknown';
    const price = film.albumPrice || film.songPrice || film.album_price || film.song_price || 0;
    const available = (film.totalEditions || film.total_editions || 0) - (film.soldEditions || film.sold_editions || 0);
    return `
      <div class="film-card" data-release-id="${film.id}">
        <div class="film-card-thumb">
          <img src="${thumb}" alt="${film.title}" onerror="this.src='/placeholder.png'">
          <div class="film-card-play-overlay">
            <div class="film-card-play-btn">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
          </div>
          <div class="film-card-avail">${available > 0 ? available + ' left' : 'Sold Out'}</div>
        </div>
        <div class="film-card-info">
          <div class="film-card-title">${film.title}</div>
          <div class="film-card-artist">${artist}</div>
          <div class="film-card-price">${price} XRP</div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.querySelectorAll('.films-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) {
          Modals.showAuth();
          return;
        }
        if (!this.LIGHTHOUSE_API_KEY) {
          alert('Upload system not ready. Please refresh the page.');
          return;
        }
        this.showUploadModal();
      });
    });

    document.querySelectorAll('.film-card').forEach(card => {
      card.addEventListener('click', () => {
        const film = this.films.find(f => f.id === card.dataset.releaseId);
        if (film) Modals.showRelease(film);
      });
    });
  },

  // ─── Direct Lighthouse Upload Helper ────────────────────────────────────────

  async uploadToLighthouse(file, useFilecoin = false, onProgress = () => {}) {
    if (!this.LIGHTHOUSE_API_KEY) {
      throw new Error('Lighthouse API key not loaded');
    }

    const formData = new FormData();
    formData.append('file', file);

    // Build URL with Filecoin routing
    // Using the endpoint from upload-config API
    let url = 'https://upload.lighthouse.storage/api/v0/add';
    if (useFilecoin) {
      url += '?network=filecoin';
    }

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
            // Lighthouse returns: { Hash: "QmXXX...", Size: "12345", Name: "filename" }
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

  // ─── Upload Modal ────────────────────────────────────────────────────────────

  showUploadModal() {
    const html = `
      <div class="modal-overlay">
        <div class="modal film-upload-modal">
          <div class="modal-header">
            <div class="modal-title">Upload Film to XRPL</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Step 1: Details -->
            <div class="film-step" id="film-step-1">
              <h3 class="film-step-title">Film Details</h3>

              <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" class="form-input" id="film-title" placeholder="Your film title" required>
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-input form-textarea" id="film-description" placeholder="What's this film about?" rows="3"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Editions *</label>
                  <input type="number" class="form-input" id="film-editions" value="100" min="1" max="10000">
                  <p class="form-hint">How many copies can be sold</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Price (XRP) *</label>
                  <input type="number" class="form-input" id="film-price" value="10" min="0" step="0.1">
                  <p class="form-hint">Per copy</p>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Resale Royalty %</label>
                <input type="number" class="form-input" id="film-royalty" value="10" min="0" max="50" step="0.5">
                <p class="form-hint">You earn this on every secondary sale</p>
              </div>

              <button type="button" class="btn btn-primary btn-full" id="film-next-1">Next: Select Files</button>
            </div>

            <!-- Step 2: Select Files -->
            <div class="film-step hidden" id="film-step-2">
              <h3 class="film-step-title">Select Files</h3>

              <!-- Thumbnail -->
              <div class="form-group">
                <label class="form-label">Thumbnail / Poster *</label>
                <div class="upload-zone" id="film-thumb-zone">
                  <input type="file" id="film-thumb-input" accept="image/*" style="display:none;">
                  <div class="upload-placeholder" id="film-thumb-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>Click to select thumbnail</span>
                    <span class="upload-hint">JPG, PNG — 1920×1080 recommended</span>
                  </div>
                  <div class="upload-preview hidden" id="film-thumb-preview">
                    <img id="film-thumb-img" src="" alt="">
                    <button type="button" class="upload-remove" id="film-thumb-remove">×</button>
                  </div>
                </div>
              </div>

              <!-- Video -->
              <div class="form-group">
                <label class="form-label">Video File *</label>
                <div class="upload-zone film-video-zone" id="film-video-zone">
                  <input type="file" id="film-video-input" accept="video/*" style="display:none;">
                  <div class="upload-placeholder" id="film-video-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"></rect><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon></svg>
                    <span>Click to select video</span>
                    <span class="upload-hint">MP4, MOV, WebM — up to 10GB</span>
                  </div>
                  <div class="upload-file-info hidden" id="film-video-info">
                    <div class="file-info-icon">🎬</div>
                    <div class="file-info-details">
                      <div class="file-info-name" id="film-video-name"></div>
                      <div class="file-info-size" id="film-video-size"></div>
                    </div>
                    <button type="button" class="file-info-remove" id="film-video-remove">×</button>
                  </div>
                </div>
              </div>

              <div class="film-nav">
                <button type="button" class="btn btn-secondary" id="film-back-2">Back</button>
                <button type="button" class="btn btn-primary" id="film-next-2">Next: Payment</button>
              </div>
            </div>

            <!-- Step 3: Payment -->
            <div class="film-step hidden" id="film-step-3">
              <h3 class="film-step-title">Payment</h3>

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
                💡 <strong>What you get:</strong> Permanent Filecoin storage (10-year deal, auto-renews) + NFT minted on XRPL + Your film lives forever on-chain
              </div>

              <div class="film-mint-status hidden" id="film-payment-status">
                <div class="mint-status-icon"><div class="spinner"></div></div>
                <div class="film-mint-status-text" id="film-payment-status-text">Waiting for payment...</div>
              </div>

              <div class="film-nav" id="film-nav-3">
                <button type="button" class="btn btn-secondary" id="film-back-3">Back</button>
                <button type="button" class="btn btn-primary" id="film-pay-btn" style="flex:2;">
                  💳 Pay & Start Upload
                </button>
              </div>
            </div>

            <!-- Step 4: Upload Progress -->
            <div class="film-step hidden" id="film-step-4">
              <h3 class="film-step-title">Uploading to Filecoin</h3>

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
            <div class="film-step hidden" id="film-step-5">
              <div class="success-animation">
                <div class="success-icon">🎬</div>
                <h2 class="success-title" id="success-title">Film is Live!</h2>
                <p class="success-text">Your film is on Filecoin forever. No one can delete it.</p>
                
                <div class="success-share">
                  <button class="btn btn-secondary" id="success-share-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                    Share on X
                  </button>
                  <button class="btn btn-primary" id="success-done-btn">View Film</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      ${this.getModalStyles()}
    `;

    Modals.show(html);
    this.bindUploadEvents();
  },

  bindUploadEvents() {
    const STORAGE_RATE_PER_GB = 0.29;
    const PLATFORM_FEE = 0.10;
    
    let thumbFile = null;
    let videoFile = null;
    let paymentTxHash = null;
    let paymentAmount = 0;

    // Close handlers
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => Modals.close());

    // Step 1 → 2
    const next1Btn = document.getElementById('film-next-1');
    if (next1Btn) {
      next1Btn.addEventListener('click', () => {
        const title = document.getElementById('film-title')?.value.trim();
        if (!title) { alert('Please enter a title'); return; }
        
        document.getElementById('film-step-1')?.classList.add('hidden');
        document.getElementById('film-step-2')?.classList.remove('hidden');
      });
    }

    const back2Btn = document.getElementById('film-back-2');
    if (back2Btn) {
      back2Btn.addEventListener('click', () => {
        document.getElementById('film-step-2')?.classList.add('hidden');
        document.getElementById('film-step-1')?.classList.remove('hidden');
      });
    }

    // Thumbnail selection
    const thumbZone = document.getElementById('film-thumb-zone');
    const thumbInput = document.getElementById('film-thumb-input');
    if (thumbZone && thumbInput) {
      thumbZone.addEventListener('click', () => thumbInput.click());
      thumbInput.addEventListener('change', () => {
        const file = thumbInput.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 10 * 1024 * 1024) {
          alert('Thumbnail too large (max 10MB)');
          return;
        }
        thumbFile = file;
        
        document.getElementById('film-thumb-img').src = URL.createObjectURL(file);
        document.getElementById('film-thumb-placeholder')?.classList.add('hidden');
        document.getElementById('film-thumb-preview')?.classList.remove('hidden');
        thumbZone.classList.add('has-file');
      });
    }

    const thumbRemoveBtn = document.getElementById('film-thumb-remove');
    if (thumbRemoveBtn) {
      thumbRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        thumbFile = null;
        document.getElementById('film-thumb-placeholder')?.classList.remove('hidden');
        document.getElementById('film-thumb-preview')?.classList.add('hidden');
        thumbZone?.classList.remove('has-file');
      });
    }

    // Video selection
    const videoZone = document.getElementById('film-video-zone');
    const videoInput = document.getElementById('film-video-input');
    if (videoZone && videoInput) {
      videoZone.addEventListener('click', () => {
        if (!videoFile) videoInput.click();
      });
      
      videoInput.addEventListener('change', () => {
        const file = videoInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024 * 1024) {
          alert('File too large (max 10GB)');
          return;
        }

        videoFile = file;
        const sizeGB = file.size / (1024 * 1024 * 1024);
        const sizeMB = file.size / (1024 * 1024);
        const sizeText = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
        
        document.getElementById('film-video-placeholder')?.classList.add('hidden');
        document.getElementById('film-video-info')?.classList.remove('hidden');
        document.getElementById('film-video-name').textContent = file.name;
        document.getElementById('film-video-size').textContent = sizeText;
        videoZone.classList.add('has-file');
      });
    }

    const videoRemoveBtn = document.getElementById('film-video-remove');
    if (videoRemoveBtn) {
      videoRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoFile = null;
        document.getElementById('film-video-placeholder')?.classList.remove('hidden');
        document.getElementById('film-video-info')?.classList.add('hidden');
        videoZone?.classList.remove('has-file');
      });
    }

    // Step 2 → 3 (Calculate payment)
    const next2Btn = document.getElementById('film-next-2');
    if (next2Btn) {
      next2Btn.addEventListener('click', () => {
        if (!thumbFile) { alert('Please select a thumbnail'); return; }
        if (!videoFile) { alert('Please select a video file'); return; }

        const editions = parseInt(document.getElementById('film-editions')?.value) || 100;
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

        document.getElementById('film-step-2')?.classList.add('hidden');
        document.getElementById('film-step-3')?.classList.remove('hidden');
      });
    }

    const back3Btn = document.getElementById('film-back-3');
    if (back3Btn) {
      back3Btn.addEventListener('click', () => {
        document.getElementById('film-step-3')?.classList.add('hidden');
        document.getElementById('film-step-2')?.classList.remove('hidden');
      });
    }

    // Step 3: Payment
    const payBtn = document.getElementById('film-pay-btn');
    if (payBtn) {
      payBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('film-payment-status');
        const navEl = document.getElementById('film-nav-3');
        const statusText = document.getElementById('film-payment-status-text');
        
        statusEl?.classList.remove('hidden');
        if (navEl) navEl.style.display = 'none';

        try {
          const title = document.getElementById('film-title')?.value || '';
          
          // Get platform address
          const configRes = await fetch('/api/batch-mint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getConfig' })
          });
          const { platformAddress } = await configRes.json();
          if (!platformAddress) throw new Error('Platform not configured');

          // Request payment
          if (statusText) statusText.textContent = '📱 Waiting for payment in Xaman...';
          
          const payResult = await XamanWallet.sendPayment(
            platformAddress,
            paymentAmount,
            `XRP Music Films: ${title}`
          );
          
          if (!payResult.success) throw new Error(payResult.error || 'Payment cancelled');

          paymentTxHash = payResult.txHash;

          // Payment confirmed! Start upload
          if (statusText) statusText.textContent = '✅ Payment confirmed!';
          
          setTimeout(() => {
            document.getElementById('film-step-3')?.classList.add('hidden');
            document.getElementById('film-step-4')?.classList.remove('hidden');
            startUpload();
          }, 1000);

        } catch (err) {
          console.error('Payment failed:', err);
          if (statusText) statusText.textContent = `❌ ${err.message || 'Payment failed'}`;
          if (navEl) navEl.style.display = 'flex';
        }
      });
    }

    // Upload function (after payment)
    const startUpload = async () => {
      try {
        const title = document.getElementById('film-title')?.value || '';
        const description = document.getElementById('film-description')?.value || '';
        const price = parseFloat(document.getElementById('film-price')?.value) || 10;
        const editions = parseInt(document.getElementById('film-editions')?.value) || 100;
        const royaltyPercent = parseFloat(document.getElementById('film-royalty')?.value) || 10;

        // 1. Upload thumbnail
        document.getElementById('upload-thumb-progress')?.classList.remove('hidden');
        const thumbResult = await FilmsPage.uploadToLighthouse(thumbFile, false, (pct) => {
          const bar = document.getElementById('thumb-bar');
          const txt = document.getElementById('thumb-pct');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        });

        // 2. Upload video to Filecoin
        document.getElementById('upload-video-progress')?.classList.remove('hidden');
        const videoResult = await FilmsPage.uploadToLighthouse(videoFile, true, (pct) => {
          const bar = document.getElementById('video-bar');
          const txt = document.getElementById('video-pct');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        });

        // 3. Create metadata (upload JSON to Lighthouse)
        document.getElementById('upload-minting-progress')?.classList.remove('hidden');
        
        const metadata = {
          name: title,
          description,
          image: `ipfs://${thumbResult.cid}`,
          animation_url: `ipfs://${videoResult.cid}`,
          attributes: [
            { trait_type: 'Type', value: 'Film' },
            { trait_type: 'Content Type', value: 'film' },
            { trait_type: 'Artist', value: AppState.profile?.name || AppState.user.address },
          ],
          properties: {
            video: videoResult.url,
            thumbnail: thumbResult.url,
            videoSize: videoResult.size
          },
        };

        const metaBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metaFile = new File([metaBlob], `${title}-metadata.json`, { type: 'application/json' });
        const metaResult = await FilmsPage.uploadToLighthouse(metaFile, false);

        // 4. Save release to database
        const releaseData = {
          artistAddress: AppState.user.address,
          artistName: AppState.profile?.name || null,
          title,
          description,
          type: 'single',
          contentType: 'film',
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

        const createResult = await API.saveRelease(releaseData);

        // Success!
        document.getElementById('success-title').textContent = `${title} is Live!`;
        document.getElementById('film-step-4')?.classList.add('hidden');
        document.getElementById('film-step-5')?.classList.remove('hidden');

      } catch (err) {
        console.error('Upload failed:', err);
        
        // AUTO-REFUND on failure
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

    // Success actions
    const shareBtn = document.getElementById('success-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const title = document.getElementById('film-title')?.value || 'my film';
        const text = `Just uploaded "${title}" to @XRP_MUSIC and minted it as an NFT on XRPL. No platform can delete it. 🎬⚡`;
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      });
    }

    const doneBtn = document.getElementById('success-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        Modals.close();
        FilmsPage.loadFilms();
      });
    }
  },

  getStyles() {
    return `
      <style>
        .films-page { max-width: 1100px; margin: 0 auto; padding: 0 24px 120px; }

        /* Hero */
        .films-hero {
          position: relative; text-align: center;
          padding: 80px 24px 72px; border-radius: 24px;
          overflow: hidden; margin-bottom: 56px;
          background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04));
          border: 1px solid rgba(239,68,68,0.2);
        }
        .films-bg-grid {
          position: absolute; inset: 0; z-index: 0;
          background-image: linear-gradient(rgba(239,68,68,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .films-hero-content { position: relative; z-index: 1; }
        .films-badge { display: inline-block; padding: 6px 16px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 20px; font-size: 13px; font-weight: 600; color: #f87171; margin-bottom: 20px; }
        .films-title { font-size: 44px; font-weight: 800; margin-bottom: 16px; }
        @media (max-width: 640px) { .films-title { font-size: 28px; } }
        .films-subtitle { font-size: 17px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; max-width: 560px; margin-left: auto; margin-right: auto; }
        .films-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; }
        .films-hero-sub { font-size: 13px; color: var(--text-muted); }

        /* Features */
        .films-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 56px; }
        .films-feature { padding: 28px 24px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; }
        .films-feature-icon { font-size: 36px; margin-bottom: 14px; }
        .films-feature h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .films-feature p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }

        /* Empty state */
        .films-empty { text-align: center; padding: 80px 24px; margin-bottom: 48px; }
        .films-empty-icon { font-size: 72px; margin-bottom: 20px; }
        .films-empty h2 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .films-empty p { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }

        /* Grid */
        .films-section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 20px; }
        .films-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; margin-bottom: 56px; }
        .film-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 150ms; }
        .film-card:hover { border-color: #ef4444; transform: translateY(-4px); }
        .film-card-thumb { position: relative; aspect-ratio: 16/9; background: var(--bg-hover); }
        .film-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .film-card-play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 150ms; }
        .film-card:hover .film-card-play-overlay { opacity: 1; }
        .film-card-play-btn { width: 56px; height: 56px; border-radius: 50%; background: rgba(239,68,68,0.9); display: flex; align-items: center; justify-content: center; }
        .film-card-avail { position: absolute; top: 8px; right: 8px; padding: 3px 8px; background: rgba(0,0,0,0.7); border-radius: 6px; font-size: 11px; font-weight: 600; color: white; }
        .film-card-info { padding: 12px; }
        .film-card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .film-card-artist { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
        .film-card-price { font-size: 13px; font-weight: 700; color: #f87171; }

        /* CTA Banner */
        .films-cta-banner { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 36px 40px; background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.05)); border: 1px solid rgba(239,68,68,0.25); border-radius: 20px; }
        @media (max-width: 700px) { .films-cta-banner { flex-direction: column; text-align: center; padding: 28px 24px; } }
        .films-cta-text h2 { font-size: 22px; font-weight: 700; margin: 0 0 10px; }
        .films-cta-text p { font-size: 14px; color: var(--text-muted); margin: 0; line-height: 1.6; max-width: 520px; }
      </style>
    `;
  },

  getModalStyles() {
    return `
      <style>
        .film-upload-modal { max-width: 540px; }
        .film-step-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
        .film-step.hidden { display: none; }
        .film-nav { display: flex; gap: 12px; margin-top: 24px; }
        .film-nav .btn { flex: 1; }
        
        /* File info */
        .upload-file-info { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-card); border-radius: 12px; }
        .upload-file-info.hidden { display: none; }
        .file-info-icon { font-size: 32px; }
        .file-info-details { flex: 1; }
        .file-info-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .file-info-size { font-size: 12px; color: var(--text-muted); }
        .file-info-remove { width: 24px; height: 24px; background: var(--error); border: none; border-radius: 50%; color: white; font-size: 16px; cursor: pointer; }

        /* Payment */
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

        /* Upload progress */
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

        /* Success */
        .success-animation { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 80px; margin-bottom: 20px; animation: successPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        @keyframes successPop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
        .success-title { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
        .success-text { font-size: 14px; color: var(--text-muted); margin-bottom: 32px; }
        .success-share { display: flex; gap: 12px; justify-content: center; }

        .film-mint-status { text-align: center; padding: 24px; }
        .film-mint-status.hidden { display: none; }
        .film-mint-status-text { font-size: 14px; color: var(--text-secondary); margin-top: 12px; }
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
