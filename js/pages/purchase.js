/**
 * XRP Music - Purchase Page (Single-Signature Flow)
 * 
 * NEW: Buyer only signs ONE transaction (NFTokenAcceptOffer)
 * The XRP payment is embedded in the sell offer amount.
 * 
 * Flow:
 * 1. Buyer clicks "Buy" → API prepares (mints NFT + creates priced sell offer)
 * 2. Buyer signs NFTokenAcceptOffer → pays XRP AND receives NFT in one tx
 * 3. API confirms → records sale, pays artist 98%
 * 
 * This fixes the Xaman 5.0 crash where the second signature
 * (NFTokenAcceptOffer for 0-amount offer) caused a React Native
 * "Text Strings must be rendered within a <Text> component" error.
 * 
 * ALBUM: Sequential prepare-and-accept for each track
 * MOBILE: Intermediate button tap between signatures for albums
 */

const PurchasePage = {
  release: null,
  track: null,
  isAlbum: false,
  
  async init() {
    const params = new URLSearchParams(window.location.search);
    const releaseId = params.get('release');
    const trackId = params.get('track');
    this.isAlbum = params.get('album') === 'true';
    
    if (!releaseId) {
      this.showError('No release specified');
      return;
    }
    
    if (!AppState.user?.address) {
      this.showLoginRequired();
      return;
    }
    
    try {
      const data = await API.getRelease(releaseId);
      this.release = data?.release;
      
      if (!this.release) {
        this.showError('Release not found');
        return;
      }
      
      if (trackId && !this.isAlbum) {
        this.track = this.release.tracks?.find(t => t.id == trackId);
        if (!this.track) {
          this.showError('Track not found');
          return;
        }
      }
      
      const availabilityCheck = await this.checkAvailability();
      if (!availabilityCheck.available) {
        this.showSoldOut(availabilityCheck.reason);
        return;
      }
      
      this.render();
      
    } catch (error) {
      console.error('Failed to load release:', error);
      this.showError('Failed to load release data');
    }
  },
  
  async checkAvailability() {
    try {
      const endpoint = this.isAlbum ? '/api/broker-album-sale' : '/api/broker-sale';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          releaseId: this.release.id,
          trackId: this.track?.id,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.available) {
        return { available: false, reason: result.error || 'Not available' };
      }
      return { available: true };
    } catch (error) {
      console.error('Availability check failed:', error);
      return { available: false, reason: 'Failed to check availability' };
    }
  },
  
  getAlbumPrice() {
    const release = this.release;
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    const individualTotal = trackPrice * trackCount;
    const albumPrice = parseFloat(release.albumPrice) || individualTotal;
    return { trackPrice, trackCount, individualTotal, albumPrice };
  },
  
  render() {
    const release = this.release;
    const track = this.track;
    const isAlbum = this.isAlbum;
    
    const { trackPrice, trackCount, individualTotal, albumPrice } = this.getAlbumPrice();
    const totalPrice = isAlbum ? albumPrice : trackPrice;
    const hasDiscount = isAlbum && albumPrice < individualTotal;
    
    // NEW: Only 1 signature for single tracks, N for albums
    const totalSignatures = isAlbum ? trackCount : 1;
    
    const itemTitle = isAlbum ? release.title : (track?.title || release.title);
    const itemType = isAlbum ? (release.type === 'album' ? 'Full Album' : 'Full EP') : 'Track';
    const available = release.totalEditions - release.soldEditions;
    
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page">
        <div class="purchase-container">
          
          <div class="purchase-header">
            <button class="back-btn" onclick="history.back()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <h1>Complete Purchase</h1>
          </div>
          
          <div class="purchase-main">
            
            <div class="purchase-item-section">
              <div class="purchase-cover">
                <img src="${release.coverUrl || '/placeholder.png'}" alt="${release.title}">
              </div>
              <div class="purchase-item-info">
                <span class="purchase-item-type">${itemType}</span>
                <h2 class="purchase-item-title">${itemTitle}</h2>
                <p class="purchase-item-artist">${release.artistName || 'Unknown Artist'}</p>
                ${isAlbum ? `<p class="purchase-item-tracks">${trackCount} tracks included</p>` : ''}
                <div class="purchase-availability">
                  <span class="availability-dot ${available <= 5 ? 'low' : ''}"></span>
                  <span>${available} of ${release.totalEditions} available</span>
                </div>
              </div>
            </div>
            
            <div class="purchase-flow-section">
              
              <div class="purchase-summary-card">
                <h3>Order Summary</h3>
                ${isAlbum && hasDiscount ? `
                  <div class="summary-row">
                    <span>${trackCount} tracks × ${trackPrice} XRP</span>
                    <span style="text-decoration: line-through; color: var(--text-muted);">${individualTotal} XRP</span>
                  </div>
                  <div class="summary-row discount">
                    <span>Album Discount</span>
                    <span>-${(individualTotal - albumPrice).toFixed(2)} XRP</span>
                  </div>
                ` : `
                  <div class="summary-row">
                    <span>${isAlbum ? `${trackCount} NFTs (Album Price)` : 'NFT Price'}</span>
                    <span>${totalPrice} XRP</span>
                  </div>
                `}
                <div class="summary-row small">
                  <span>Network Fee</span>
                  <span>~0.00001 XRP</span>
                </div>
                <div class="summary-row total">
                  <span>Total</span>
                  <span>${totalPrice} XRP</span>
                </div>
              </div>
              
              <div class="xaman-instructions">
                <div class="xaman-header">
                  <img src="/xaman-logo.png" alt="Xaman" class="xaman-logo" onerror="this.style.display='none'">
                  <div>
                    <h4>Xaman Wallet Required</h4>
                    <p>${totalSignatures} signature${totalSignatures > 1 ? 's' : ''} needed</p>
                  </div>
                </div>
                
                <div class="signature-steps">
                  ${isAlbum ? release.tracks.map((t, i) => `
                    <div class="sig-step">
                      <div class="sig-num">${i + 1}</div>
                      <div class="sig-info">
                        <strong>Buy & Receive NFT</strong>
                        <span>"${t.title}"</span>
                      </div>
                    </div>
                  `).join('') : `
                    <div class="sig-step">
                      <div class="sig-num">1</div>
                      <div class="sig-info">
                        <strong>Buy & Receive NFT</strong>
                        <span>Pay ${totalPrice} XRP and receive your NFT in one step</span>
                      </div>
                    </div>
                  `}
                </div>
                
                ${isAlbum ? `
                <div class="xaman-tip">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div>
                    <strong>Mobile Users</strong>
                    <p>You'll need to tap a button between each track to open Xaman. Pull down on the <strong>Events</strong> tab in Xaman to refresh.</p>
                  </div>
                </div>
                ` : ''}
              </div>
              
              <!-- Status Area -->
              <div class="purchase-status" id="purchase-status" style="display: none;">
                <div class="status-icon">
                  <div class="spinner"></div>
                </div>
                <div class="status-text" id="status-text">Preparing...</div>
                <div class="status-sub" id="status-sub">Please wait</div>
              </div>
              
              <button class="purchase-btn" id="purchase-btn" onclick="PurchasePage.startPurchase()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Buy for ${totalPrice} XRP
              </button>
              
              <p class="purchase-note">
                By purchasing, you agree to the terms of service. NFTs are non-refundable once transferred.
              </p>
              
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .purchase-page { min-height: 100vh; background: var(--bg-primary); padding: 24px; }
        .purchase-container { max-width: 1000px; margin: 0 auto; }
        .purchase-header { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }
        .back-btn {
          display: flex; align-items: center; gap: 8px; padding: 10px 16px;
          background: var(--bg-secondary); border: 1px solid var(--border-color);
          border-radius: var(--radius-lg); color: var(--text-secondary);
          font-size: 14px; cursor: pointer; transition: all 150ms;
        }
        .back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .purchase-header h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); }
        .purchase-main { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
        @media (max-width: 768px) { .purchase-main { grid-template-columns: 1fr; gap: 32px; } }
        .purchase-item-section { display: flex; flex-direction: column; gap: 24px; }
        .purchase-cover {
          width: 100%; max-width: 400px; aspect-ratio: 1;
          border-radius: var(--radius-xl); overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .purchase-cover img { width: 100%; height: 100%; object-fit: cover; }
        .purchase-item-info { display: flex; flex-direction: column; gap: 8px; }
        .purchase-item-type { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--accent); letter-spacing: 1px; }
        .purchase-item-title { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
        .purchase-item-artist { font-size: 16px; color: var(--text-secondary); }
        .purchase-item-tracks { font-size: 14px; color: var(--text-muted); }
        .purchase-availability { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 14px; color: var(--text-secondary); }
        .availability-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
        .availability-dot.low { background: var(--warning); }
        .purchase-flow-section { display: flex; flex-direction: column; gap: 24px; }
        .purchase-summary-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 24px; }
        .purchase-summary-card h3 { font-size: 14px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 15px; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); }
        .summary-row:last-child { border-bottom: none; }
        .summary-row.small { font-size: 13px; color: var(--text-muted); padding: 8px 0; }
        .summary-row.discount { color: var(--success); font-weight: 600; }
        .summary-row.total { font-size: 20px; font-weight: 700; color: var(--text-primary); padding-top: 16px; margin-top: 8px; border-top: 2px solid var(--border-color); border-bottom: none; }
        .xaman-instructions { background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(91, 33, 182, 0.1)); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: var(--radius-xl); padding: 24px; }
        .xaman-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .xaman-logo { width: 48px; height: 48px; border-radius: 12px; }
        .xaman-header h4 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
        .xaman-header p { font-size: 14px; color: var(--accent); font-weight: 500; }
        .signature-steps { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .sig-step { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: var(--radius-lg); }
        .sig-num { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sig-info { display: flex; flex-direction: column; }
        .sig-info strong { font-size: 14px; color: var(--text-primary); }
        .sig-info span { font-size: 13px; color: var(--text-muted); }
        .xaman-tip { display: flex; gap: 12px; padding: 16px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-lg); }
        .xaman-tip svg { flex-shrink: 0; color: var(--warning); }
        .xaman-tip strong { display: block; font-size: 14px; color: var(--warning); margin-bottom: 4px; }
        .xaman-tip p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .purchase-status { text-align: center; padding: 32px; background: var(--bg-secondary); border-radius: var(--radius-xl); }
        .status-icon { margin-bottom: 16px; }
        .status-icon .spinner { width: 48px; height: 48px; margin: 0 auto; }
        .status-icon.success svg { color: var(--success); }
        .status-icon.error svg { color: var(--error); }
        .status-icon.ready svg { color: var(--accent); }
        .status-text { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .status-sub { font-size: 14px; color: var(--text-muted); }
        .purchase-btn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          width: 100%; padding: 18px 32px;
          background: linear-gradient(135deg, #7c3aed, #5b21b6); border: none;
          border-radius: var(--radius-xl); color: white; font-size: 18px; font-weight: 600;
          cursor: pointer; transition: transform 150ms, box-shadow 150ms;
        }
        .purchase-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(124, 58, 237, 0.4); }
        .purchase-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .purchase-note { font-size: 12px; color: var(--text-muted); text-align: center; line-height: 1.5; }
        #accept-nft-btn { animation: pulse-btn 2s infinite; }
        @keyframes pulse-btn {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 30px rgba(124, 58, 237, 0.3); }
          50% { transform: scale(1.02); box-shadow: 0 12px 40px rgba(124, 58, 237, 0.5); }
        }
        .album-progress { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 20px; }
        .progress-header { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        #progress-label { color: var(--text-primary); font-weight: 500; }
        #progress-count { color: var(--accent); font-weight: 600; }
        .progress-bar { height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; margin-bottom: 12px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #8b5cf6); border-radius: 4px; transition: width 0.3s ease; }
        .progress-track { font-size: 13px; color: var(--text-muted); min-height: 20px; }
      </style>
    `;
  },
  
  updateStatus(text, sub, type = 'loading') {
    const statusEl = document.getElementById('purchase-status');
    if (!statusEl) return;
    
    statusEl.style.display = 'block';
    const iconEl = statusEl.querySelector('.status-icon');
    const textEl = document.getElementById('status-text');
    const subEl = document.getElementById('status-sub');
    
    if (type === 'loading') {
      iconEl.innerHTML = '<div class="spinner" style="width:48px;height:48px;"></div>';
      iconEl.className = 'status-icon';
    } else if (type === 'success') {
      iconEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      iconEl.className = 'status-icon success';
    } else if (type === 'error') {
      iconEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      iconEl.className = 'status-icon error';
    }
    
    textEl.textContent = text;
    subEl.textContent = sub;
  },
  
  updateAlbumProgress(current, total, trackTitle, phase = 'minting') {
    const progressEl = document.getElementById('album-progress');
    const labelEl = document.getElementById('progress-label');
    const countEl = document.getElementById('progress-count');
    const fillEl = document.getElementById('progress-fill');
    const trackEl = document.getElementById('progress-track');
    
    if (!progressEl) return;
    progressEl.style.display = 'block';
    
    const percent = Math.round((current / total) * 100);
    fillEl.style.width = `${percent}%`;
    countEl.textContent = `${current}/${total}`;
    
    const labels = {
      preparing: 'Preparing NFT...',
      ready: 'Ready to sign',
      signing: 'Signing in Xaman...',
      verifying: 'Verifying transfer...',
      complete: 'NFT received!',
    };
    labelEl.textContent = labels[phase] || 'Processing...';
    
    if (phase === 'complete') {
      trackEl.innerHTML = `<span style="color: var(--success)">✓</span> "${trackTitle}"`;
    } else {
      trackEl.textContent = `"${trackTitle}"`;
    }
  },
  
  /**
   * Show tap-to-sign button for mobile users (album flow)
   */
  showSignButton(current, total, trackTitle) {
    return new Promise((resolve) => {
      const statusEl = document.getElementById('purchase-status');
      const iconEl = statusEl.querySelector('.status-icon');
      const textEl = document.getElementById('status-text');
      const subEl = document.getElementById('status-sub');
      
      iconEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 12 15 16 10"/></svg>`;
      iconEl.className = 'status-icon ready';
      
      const label = trackTitle
        ? `Sign for NFT ${current}/${total}: "${trackTitle}"`
        : 'Sign to Buy & Receive NFT';
      
      textEl.innerHTML = `
        <span style="display:block;margin-bottom:16px;">${label}</span>
        <button id="accept-nft-btn" class="purchase-btn" style="margin:0 auto;max-width:300px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Tap to Open Xaman
        </button>
      `;
      subEl.textContent = 'Tap the button above to sign in Xaman';
      
      document.getElementById('accept-nft-btn').onclick = () => resolve();
    });
  },
  
  // ─── SINGLE TRACK PURCHASE (1 signature) ───────────────────────────
  
  async startPurchase() {
    const btn = document.getElementById('purchase-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Processing...';
    
    try {
      if (this.isAlbum) {
        await this.processAlbumPurchase();
      } else {
        await this.processSinglePurchase();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      this.updateStatus('Purchase Failed', error.message, 'error');
      
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Try Again
      `;
    }
  },
  
  async processSinglePurchase() {
    const totalPrice = parseFloat(this.release.songPrice) || 0;
    
    // STEP 1: Prepare (API mints NFT + creates priced sell offer)
    this.updateStatus('Preparing Your NFT', 'Minting and creating offer...');
    
    const prepareResponse = await fetch('/api/broker-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'prepare',
        releaseId: this.release.id,
        trackId: this.track?.id,
        buyerAddress: AppState.user.address,
      }),
    });
    
    const prepareResult = await prepareResponse.json();
    
    if (!prepareResult.success) {
      throw new Error(prepareResult.error || 'Failed to prepare purchase');
    }
    
    // STEP 2: Buyer signs NFTokenAcceptOffer (ONLY signature!)
    // This both pays the XRP AND transfers the NFT
    this.updateStatus('Sign in Xaman', `Accept NFT offer for ${totalPrice} XRP`);
    
    const acceptResult = await XamanWallet.acceptSellOffer(prepareResult.sellOfferIndex);
    
    if (!acceptResult.success) {
      throw new Error('Transaction cancelled or failed - check Xaman');
    }
    
    // STEP 3: Confirm sale (API records sale + pays artist)
    this.updateStatus('Finalizing', 'Recording sale and paying artist...');
    
    try {
      await fetch('/api/broker-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          pendingSale: prepareResult.pendingSale,
          acceptTxHash: acceptResult.txHash,
        }),
      });
    } catch (e) {
      console.error('Confirm failed (sale still completed):', e);
    }
    
    this.updateStatus('Purchase Complete! 🎉', 'NFT is now in your wallet', 'success');
    
    setTimeout(() => {
      if (typeof ProfilePage !== 'undefined') ProfilePage.markNeedsRefresh();
      Router.navigate('profile');
    }, 2000);
  },
  
  // ─── ALBUM PURCHASE (N signatures, 1 per track) ────────────────────
  
  async processAlbumPurchase() {
    const tracks = this.release.tracks || [];
    const trackCount = tracks.length;
    const { trackPrice, albumPrice } = this.getAlbumPrice();
    
    // For albums we still need the old flow since each track is a separate NFT
    // We use broker-album-sale which handles the payment + sequential minting
    // TODO: Migrate album flow to single-sig per track as well
    
    this.updateStatus('Initializing', 'Setting up album purchase...');
    
    // Get platform address
    const configResponse = await fetch('/api/batch-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getConfig' }),
    });
    const configData = await configResponse.json();
    const platformAddress = configData.platformAddress;
    if (!platformAddress) throw new Error('Platform not configured');
    
    // STEP 1: Buyer pays for the album (single payment signature)
    this.updateStatus('Sign Payment', `Send ${albumPrice} XRP in Xaman`);
    
    const paymentResult = await XamanWallet.sendPayment(
      platformAddress,
      albumPrice,
      `XRP Music: ${this.release.title}`
    );
    
    if (!paymentResult.success) {
      throw new Error(paymentResult.error || 'Payment cancelled');
    }
    
    // STEP 2: Init album session
    const initResponse = await fetch('/api/broker-album-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        releaseId: this.release.id,
        buyerAddress: AppState.user.address,
        paymentTxHash: paymentResult.txHash,
      }),
    });
    
    const initResult = await initResponse.json();
    if (!initResult.success) throw new Error(initResult.error || 'Failed to initialize');
    
    const { sessionId, artistAddress } = initResult;
    const confirmedSales = [];
    const failedTracks = [];
    
    // STEP 3: Process each track
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      this.updateStatus(`Preparing NFT ${i + 1}/${trackCount}`, `"${track.title}" - minting...`);
      
      const mintResponse = await fetch('/api/broker-album-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mint-single',
          releaseId: this.release.id,
          trackId: track.id,
          trackIndex: i,
          buyerAddress: AppState.user.address,
          sessionId: sessionId,
        }),
      });
      
      const mintResult = await mintResponse.json();
      
      if (!mintResult.success) {
        console.error(`Track ${i + 1} mint failed:`, mintResult.error);
        failedTracks.push(track.title);
        if (confirmedSales.length === 0 && failedTracks.length === 1) {
          throw new Error(mintResult.error || `Failed to prepare "${track.title}"`);
        }
        continue;
      }
      
      // Mobile: show tap button before signing
      await this.showSignButton(i + 1, trackCount, track.title);
      
      this.updateStatus(`Accepting NFT ${i + 1}/${trackCount}`, `"${track.title}" - sign in Xaman`);
      
      const acceptResult = await XamanWallet.acceptSellOffer(mintResult.offerIndex);
      
      if (!acceptResult.success) {
        console.error(`Accept failed for track ${i + 1}`);
        failedTracks.push(track.title);
        if (confirmedSales.length === 0 && failedTracks.length === 1) {
          throw new Error(`Failed to accept "${track.title}"`);
        }
        continue;
      }
      
      // Verify on-chain
      this.updateStatus(`Verifying NFT ${i + 1}/${trackCount}`, `"${track.title}" - confirming...`);
      
      let verified = false;
      for (let v = 0; v < 3; v++) {
        try {
          await new Promise(r => setTimeout(r, 2000));
          const verifyResponse = await fetch('/api/broker-album-sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'verify-transfer',
              nftTokenId: mintResult.nftTokenId,
              buyerAddress: AppState.user.address,
              offerIndex: mintResult.offerIndex,
            }),
          });
          const verifyResult = await verifyResponse.json();
          if (verifyResult.verified) { verified = true; break; }
        } catch (e) {
          console.warn('Verify failed:', e.message);
        }
      }
      
      if (!verified) {
        failedTracks.push(track.title);
        this.updateStatus(`Transfer Issue — Track ${i + 1}`, `"${track.title}" may not have transferred`, 'error');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      // Confirm
      try {
        await fetch('/api/broker-album-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm-single', pendingSale: mintResult.pendingSale, acceptTxHash: acceptResult.txHash }),
        });
        confirmedSales.push({ trackId: track.id, trackTitle: track.title, txHash: acceptResult.txHash });
      } catch (e) {
        console.error('Confirm failed:', e);
        confirmedSales.push({ trackId: track.id, trackTitle: track.title, txHash: acceptResult.txHash });
      }
    }
    
    // STEP 4: Finalize
    if (confirmedSales.length > 0) {
      this.updateStatus('Finalizing', 'Completing purchase...');
      const finalPrice = confirmedSales.length === trackCount ? albumPrice : trackPrice * confirmedSales.length;
      
      try {
        await fetch('/api/broker-album-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'finalize', releaseId: this.release.id, artistAddress,
            totalPrice: finalPrice, trackCount: confirmedSales.length, buyerAddress: AppState.user.address,
          }),
        });
      } catch (e) {
        console.error('Finalize failed:', e);
      }
    }
    
    if (confirmedSales.length === trackCount) {
      this.updateStatus('Album Purchased! 🎉', `${trackCount} NFTs are now in your wallet`, 'success');
    } else if (confirmedSales.length > 0) {
      this.updateStatus(`${confirmedSales.length}/${trackCount} NFTs Received`, `Failed: ${failedTracks.join(', ')}`, confirmedSales.length >= trackCount - 1 ? 'success' : 'error');
    } else {
      throw new Error('No NFTs were transferred');
    }
    
    setTimeout(() => {
      if (typeof ProfilePage !== 'undefined') ProfilePage.markNeedsRefresh();
      Router.navigate('profile');
    }, 3000);
  },
  
  // ─── Error / Status Pages ──────────────────────────────────────────
  
  showError(message) {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page"><div class="purchase-container"><div class="purchase-error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h2>Error</h2><p>${message}</p>
        <button class="btn btn-primary" onclick="history.back()">Go Back</button>
      </div></div></div>
      <style>.purchase-error{text-align:center;padding:64px;}.purchase-error h2{font-size:24px;margin:24px 0 12px;color:var(--text-primary);}.purchase-error p{color:var(--text-muted);margin-bottom:24px;}</style>`;
  },
  
  showSoldOut(reason) {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page"><div class="purchase-container"><div class="purchase-error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2>Sold Out</h2><p>${reason}</p>
        <p style="font-size:14px;margin-top:12px;">Check the <a href="#marketplace" style="color:var(--accent);">Resale Market</a> for available copies.</p>
        <button class="btn btn-primary" onclick="history.back()" style="margin-top:24px;">Go Back</button>
      </div></div></div>
      <style>.purchase-error{text-align:center;padding:64px;}.purchase-error h2{font-size:24px;margin:24px 0 12px;color:var(--text-primary);}.purchase-error p{color:var(--text-muted);}</style>`;
  },
  
  showLoginRequired() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page"><div class="purchase-container"><div class="purchase-error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
        <h2>Connect Wallet</h2><p>You need to connect your Xaman wallet to make purchases.</p>
        <button class="btn btn-primary" onclick="Modals.showAuth()" style="margin-top:24px;">Connect Wallet</button>
      </div></div></div>
      <style>.purchase-error{text-align:center;padding:64px;}.purchase-error h2{font-size:24px;margin:24px 0 12px;color:var(--text-primary);}.purchase-error p{color:var(--text-muted);}</style>`;
  },
};
