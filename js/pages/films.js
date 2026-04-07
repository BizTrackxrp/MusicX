/**
 * XRP Music - Films Page
 * Upload, mint, and distribute films/videos as NFTs on XRPL.
 * Videos live on IPFS forever — no platform can delete them.
 */

const FilmsPage = {
  films: [],
  isLoading: false,

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') return IpfsHelper.toProxyUrl(url);
    return url;
  },

  async render() {
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
            Videos on XRP Music live on IPFS — permanently, unstoppably, on-chain.
          </p>
          <div class="films-actions">
            <button class="btn btn-primary films-upload-btn" style="font-size:15px;padding:14px 32px;">
              🎬 Upload Your Film
            </button>
            <button class="btn films-learn-btn" style="padding:14px 28px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);">
              How It Works
            </button>
          </div>
          <p class="films-hero-sub">Mint as an NFT · Set your price · Fans own what they watch · You earn on every resale</p>
        </div>
      </div>

      <!-- Why on-chain -->
      <div class="films-features">
        <div class="films-feature">
          <div class="films-feature-icon">🛡️</div>
          <h3>Can't Be Deleted</h3>
          <p>IPFS + XRPL means no platform, no company, no government can pull your content. It exists as long as the network does.</p>
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
          <p>Upload once. Live on IPFS permanently. No subscriptions, no platform risk, no takedowns. The XRP Ledger doesn't forget.</p>
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
        this.showUploadModal();
      });
    });

    document.querySelector('.films-learn-btn')?.addEventListener('click', () => {
      document.querySelector('.films-features')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelectorAll('.film-card').forEach(card => {
      card.addEventListener('click', () => {
        const film = this.films.find(f => f.id === card.dataset.releaseId);
        if (film) Modals.showRelease(film);
      });
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

              <button type="button" class="btn btn-primary btn-full" id="film-next-1">Next: Upload Files</button>
            </div>

            <!-- Step 2: Files -->
            <div class="film-step hidden" id="film-step-2">
              <h3 class="film-step-title">Upload Files</h3>

              <!-- Thumbnail -->
              <div class="form-group">
                <label class="form-label">Thumbnail / Poster *</label>
                <div class="upload-zone" id="film-thumb-zone">
                  <input type="file" id="film-thumb-input" accept="image/*" style="display:none;">
                  <div class="upload-placeholder" id="film-thumb-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>Click to upload thumbnail</span>
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
                  <input type="file" id="film-video-input" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" style="display:none;">
                  <div class="upload-placeholder" id="film-video-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"></rect><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon></svg>
                    <span id="film-video-cta">Click to upload video</span>
                    <span class="upload-hint">MP4, MOV, AVI, WebM — up to 10GB</span>
                  </div>
                  <div id="film-video-status" class="hidden"></div>
                </div>
              </div>

              <div class="film-nav">
                <button type="button" class="btn btn-secondary" id="film-back-2">Back</button>
                <button type="button" class="btn btn-primary" id="film-next-2">Next: Review</button>
              </div>
            </div>

            <!-- Step 3: Review & Mint -->
            <div class="film-step hidden" id="film-step-3">
              <h3 class="film-step-title">Review & Mint</h3>

              <div class="film-review-card" id="film-review-card"></div>

              <div class="review-details">
                <div class="review-row"><span>Price</span><span id="film-review-price"></span></div>
                <div class="review-row"><span>Editions</span><span id="film-review-editions"></span></div>
                <div class="review-row"><span>Resale Royalty</span><span id="film-review-royalty"></span></div>
                <div class="review-row"><span>Mint Fee</span><span id="film-review-fee"></span></div>
              </div>

              <div class="film-mint-status hidden" id="film-mint-status">
                <div class="mint-status-icon"><div class="spinner"></div></div>
                <div class="film-mint-status-text" id="film-mint-status-text">Preparing...</div>
              </div>

              <div class="film-nav" id="film-nav-3">
                <button type="button" class="btn btn-secondary" id="film-back-3">Back</button>
                <button type="button" class="btn btn-primary" id="film-mint-btn" style="flex:2;display:flex;align-items:center;justify-content:center;gap:8px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                  Pay & Go Live
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>
        .film-upload-modal { max-width: 520px; }
        .film-step-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
        .film-step.hidden { display: none; }
        .film-nav { display: flex; gap: 12px; margin-top: 24px; }
        .film-nav .btn { flex: 1; }
        .film-video-zone { min-height: 120px; }
        .film-upload-progress { margin-top: 12px; }
        .film-progress-bar { height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
        .film-progress-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 4px; transition: width 300ms ease; }
        .film-progress-text { font-size: 13px; color: var(--text-muted); text-align: center; }
        .film-review-card { display: flex; gap: 16px; padding: 16px; background: var(--bg-hover); border-radius: var(--radius-lg); margin-bottom: 20px; }
        .film-review-thumb { width: 120px; height: 68px; border-radius: 8px; overflow: hidden; background: var(--bg-card); flex-shrink: 0; }
        .film-review-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .film-review-info { flex: 1; }
        .film-review-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .film-review-artist { font-size: 13px; color: var(--text-muted); }
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
        .review-details { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; }
        .review-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid var(--border-color); }
        .review-row:last-child { border-bottom: none; }
        .review-row span:first-child { color: var(--text-secondary); }
        .review-row span:last-child { color: var(--text-primary); font-weight: 500; }
      </style>
    `;

    Modals.show(html);
    this.bindUploadEvents();
  },

  bindUploadEvents() {
    let thumbFile = null;
    let videoFile = null;
    let videoCid = null;
    let videoUrl = null;
    let videoUploading = false;

    // ── Close ──
    document.querySelector('.modal-close')?.addEventListener('click', () => Modals.close());
    document.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget && !videoUploading) Modals.close();
    });

    // ── Step 1 → 2 ──
    document.getElementById('film-next-1')?.addEventListener('click', () => {
      const title = document.getElementById('film-title').value.trim();
      if (!title) { alert('Please enter a title'); return; }
      document.getElementById('film-step-1').classList.add('hidden');
      document.getElementById('film-step-2').classList.remove('hidden');
    });

    document.getElementById('film-back-2')?.addEventListener('click', () => {
      document.getElementById('film-step-2').classList.add('hidden');
      document.getElementById('film-step-1').classList.remove('hidden');
    });

    // ── Thumbnail ──
    const thumbZone = document.getElementById('film-thumb-zone');
    const thumbInput = document.getElementById('film-thumb-input');
    thumbZone?.addEventListener('click', () => thumbInput?.click());
    thumbInput?.addEventListener('change', () => {
      const file = thumbInput.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      thumbFile = file;
      document.getElementById('film-thumb-img').src = URL.createObjectURL(file);
      document.getElementById('film-thumb-placeholder').classList.add('hidden');
      document.getElementById('film-thumb-preview').classList.remove('hidden');
      thumbZone.classList.add('has-file');
    });
    document.getElementById('film-thumb-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      thumbFile = null;
      document.getElementById('film-thumb-placeholder').classList.remove('hidden');
      document.getElementById('film-thumb-preview').classList.add('hidden');
      thumbZone.classList.remove('has-file');
    });

    // ── Video upload ──
    const videoZone = document.getElementById('film-video-zone');
    const videoInput = document.getElementById('film-video-input');
    videoZone?.addEventListener('click', () => { if (!videoUploading && !videoCid) videoInput?.click(); });
    videoInput?.addEventListener('change', async () => {
      const file = videoInput.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024 * 1024) { alert('File too large (max 10GB)'); return; }

      videoFile = file;
      videoUploading = true;
      videoZone.classList.remove('has-file');
      document.getElementById('film-video-placeholder').classList.add('hidden');

      const statusEl = document.getElementById('film-video-status');
      statusEl.classList.remove('hidden');
      statusEl.innerHTML = `
        <div class="film-upload-progress">
          <div class="film-progress-bar"><div class="film-progress-fill" id="film-vpbar" style="width:0%"></div></div>
          <div class="film-progress-text" id="film-vpct">Uploading ${(file.size/1024/1024/1024).toFixed(2)}GB to IPFS...</div>
        </div>
      `;

      try {
        const result = await DirectUploader.upload(file, (pct) => {
          const bar = document.getElementById('film-vpbar');
          const txt = document.getElementById('film-vpct');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `Uploading... ${pct}% — please don't close this page`;
        });

        videoCid = result.cid;
        videoUrl = result.url;
        videoUploading = false;
        videoZone.classList.add('has-file');
        statusEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;">
            <span style="font-size:20px;">✅</span>
            <div>
              <div style="font-size:14px;font-weight:600;color:#22c55e;">Upload complete</div>
              <div style="font-size:12px;color:var(--text-muted);">${file.name} • On IPFS forever</div>
            </div>
          </div>
        `;
      } catch (err) {
        videoUploading = false;
        videoCid = null;
        statusEl.innerHTML = `<div style="color:var(--error);font-size:13px;padding:8px;">Upload failed: ${err.message}</div>`;
        document.getElementById('film-video-placeholder').classList.remove('hidden');
      }
    });

    // ── Step 2 → 3 ──
    document.getElementById('film-next-2')?.addEventListener('click', () => {
      if (!thumbFile) { alert('Please upload a thumbnail'); return; }
      if (!videoCid) { alert('Please wait for video upload to complete'); return; }

      const title = document.getElementById('film-title').value;
      const price = document.getElementById('film-price').value;
      const editions = document.getElementById('film-editions').value;
      const royalty = document.getElementById('film-royalty').value;
      const fee = ((parseInt(editions) * 0.000012) + 0.01).toFixed(6);

      document.getElementById('film-review-card').innerHTML = `
        <div class="film-review-thumb">
          <img src="${URL.createObjectURL(thumbFile)}" alt="${title}">
        </div>
        <div class="film-review-info">
          <div class="film-review-title">${title}</div>
          <div class="film-review-artist">${AppState.profile?.name || Helpers.truncateAddress(AppState.user.address)}</div>
        </div>
      `;
      document.getElementById('film-review-price').textContent = `${price} XRP`;
      document.getElementById('film-review-editions').textContent = `${editions} copies`;
      document.getElementById('film-review-royalty').textContent = `${royalty}%`;
      document.getElementById('film-review-fee').textContent = `~${fee} XRP`;

      document.getElementById('film-step-2').classList.add('hidden');
      document.getElementById('film-step-3').classList.remove('hidden');
    });

    document.getElementById('film-back-3')?.addEventListener('click', () => {
      document.getElementById('film-step-3').classList.add('hidden');
      document.getElementById('film-step-2').classList.remove('hidden');
    });

    // ── Mint ──
    document.getElementById('film-mint-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('film-mint-status');
      const navEl = document.getElementById('film-nav-3');
      statusEl.classList.remove('hidden');
      navEl.style.display = 'none';

      const showStatus = (msg) => {
        document.getElementById('film-mint-status-text').textContent = msg;
      };

      try {
        const title = document.getElementById('film-title').value;
        const description = document.getElementById('film-description').value;
        const price = parseFloat(document.getElementById('film-price').value) || 10;
        const editions = parseInt(document.getElementById('film-editions').value) || 100;
        const royaltyPercent = parseFloat(document.getElementById('film-royalty').value) || 10;

        // 1. Upload thumbnail
        showStatus('Uploading thumbnail...');
        const thumbResult = await API.uploadFile(thumbFile);

        // 2. Create metadata
        showStatus('Creating metadata...');
        const metadata = {
          name: title,
          description,
          image: `ipfs://${thumbResult.cid}`,
          animation_url: `ipfs://${videoCid}`,
          attributes: [
            { trait_type: 'Type', value: 'Film' },
            { trait_type: 'Content Type', value: 'film' },
            { trait_type: 'Artist', value: AppState.profile?.name || AppState.user.address },
          ],
          properties: { video: videoUrl, thumbnail: thumbResult.url },
        };
        const metaResult = await API.uploadJSON(metadata, `${title}-metadata.json`);

        // 3. Save release
        showStatus('Creating release...');
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
            audioCid: videoCid,
            audioUrl: videoUrl,
            price,
            soldEditions: 0,
            availableEditions: editions,
          }],
          sellOfferIndex: null,
        };
        const createResult = await API.saveRelease(releaseData);
        const releaseId = createResult.releaseId;

        // 4. Pay mint fee
        const mintFee = ((editions * 0.000012) + 0.01).toFixed(6);
        statusEl.innerHTML = `
          <div class="mint-status-icon"><div class="spinner"></div></div>
          <div class="film-mint-status-text" style="font-size:15px;font-weight:600;">Pay Mint Fee</div>
          <p style="font-size:13px;color:var(--accent);margin-top:12px;">📱 Sign in Xaman</p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">~${mintFee} XRP one-time fee</p>
        `;

        const configRes = await fetch('/api/batch-mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getConfig' }) });
        const { platformAddress } = await configRes.json();
        if (!platformAddress) throw new Error('Platform not configured');

        const payResult = await XamanWallet.sendPayment(platformAddress, parseFloat(mintFee), `XRP Music Films: ${title}`);
        if (!payResult.success) throw new Error(payResult.error || 'Payment cancelled');

        // 5. Go live
        showStatus('Publishing...');
        await API.updateRelease(releaseId, {
          mintFeePaid: true,
          mintFeeTxHash: payResult.txHash,
          mintFeeAmount: parseFloat(mintFee),
          status: 'live',
        });

        // Success
        statusEl.innerHTML = `
          <div style="text-align:center;">
            <div style="font-size:56px;margin-bottom:16px;">🎬</div>
            <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${title} is live!</div>
            <p style="font-size:14px;color:var(--text-muted);margin-bottom:24px;">Your film is on IPFS forever. No one can delete it.</p>
            <div style="display:flex;gap:12px;justify-content:center;">
              <button class="btn btn-secondary" onclick="window.open('https://x.com/intent/tweet?text=${encodeURIComponent('Just uploaded my film to @XRP_MUSIC and minted it as an NFT on XRPL. No platform can delete it. 🎬⚡')}','_blank')">Share on X</button>
              <button class="btn btn-primary" id="film-success-done">View Film</button>
            </div>
          </div>
        `;

        document.getElementById('film-success-done')?.addEventListener('click', () => {
          Modals.close();
          FilmsPage.loadFilms();
        });

      } catch (err) {
        console.error('Film mint failed:', err);
        statusEl.innerHTML = `
          <div class="mint-status-icon" style="color:var(--error);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <div class="film-mint-status-text" style="color:var(--error);">${err.message || 'Minting failed'}</div>
        `;
        navEl.style.display = 'flex';
      }
    });
  },

  getStyles() {
    return `
      <style>
        .films-page { max-width: 1100px; margin: 0 auto; padding: 0 24px 120px; }

        /* ── Hero ── */
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

        /* ── Features ── */
        .films-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 56px; }
        .films-feature { padding: 28px 24px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; }
        .films-feature-icon { font-size: 36px; margin-bottom: 14px; }
        .films-feature h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .films-feature p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }

        /* ── Empty state ── */
        .films-empty { text-align: center; padding: 80px 24px; margin-bottom: 48px; }
        .films-empty-icon { font-size: 72px; margin-bottom: 20px; }
        .films-empty h2 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .films-empty p { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }

        /* ── Grid ── */
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

        /* ── CTA Banner ── */
        .films-cta-banner { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 36px 40px; background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.05)); border: 1px solid rgba(239,68,68,0.25); border-radius: 20px; }
        @media (max-width: 700px) { .films-cta-banner { flex-direction: column; text-align: center; padding: 28px 24px; } }
        .films-cta-text h2 { font-size: 22px; font-weight: 700; margin: 0 0 10px; }
        .films-cta-text p { font-size: 14px; color: var(--text-muted); margin: 0; line-height: 1.6; max-width: 520px; }
      </style>
    `;
  },
};
