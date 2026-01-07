/**
 * XRP Music - Purchase Page
 * Dedicated full-screen purchase flow
 * Clear Xaman instructions, can't accidentally close
 */

const PurchasePage = {
  release: null,
  track: null,
  isAlbum: false,
  
  async init() {
    // Get params from URL
    const params = new URLSearchParams(window.location.search);
    const releaseId = params.get('release');
    const trackId = params.get('track');
    this.isAlbum = params.get('album') === 'true';
    
    if (!releaseId) {
      this.showError('No release specified');
      return;
    }
    
    // Check if logged in
    if (!AppState.user?.address) {
      this.showLoginRequired();
      return;
    }
    
    // Fetch release data
    try {
      const data = await API.getRelease(releaseId);
      this.release = data?.release;
      
      if (!this.release) {
        this.showError('Release not found');
        return;
      }
      
      // If buying single track, find it
      if (trackId && !this.isAlbum) {
        this.track = this.release.tracks?.find(t => t.id == trackId);
        if (!this.track) {
          this.showError('Track not found');
          return;
        }
      }
      
      // Check availability BEFORE showing purchase UI
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
    const release = this.release;
    
    if (this.isAlbum) {
      // Check all tracks have availability
      const trackCount = release.tracks?.length || 1;
      const available = release.totalEditions - release.soldEditions;
      
      if (available < 1) {
        return { available: false, reason: 'This album is sold out' };
      }
      
      // TODO: Check each track individually if they have separate counts
      return { available: true };
      
    } else if (this.track) {
      // Single track purchase
      const trackSold = this.track.soldCount || 0;
      const trackRemaining = release.totalEditions - trackSold;
      
      if (trackRemaining < 1) {
        return { available: false, reason: `"${this.track.title}" is sold out` };
      }
      
      return { available: true };
      
    } else {
      // Single release (1 track)
      const available = release.totalEditions - release.soldEditions;
      if (available < 1) {
        return { available: false, reason: 'This release is sold out' };
      }
      return { available: true };
    }
  },
  
  render() {
    const release = this.release;
    const track = this.track;
    const isAlbum = this.isAlbum;
    
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    const totalPrice = isAlbum ? (trackPrice * trackCount) : trackPrice;
    const totalSignatures = isAlbum ? (1 + trackCount) : 2; // 1 payment + N accepts
    
    const itemTitle = isAlbum ? release.title : (track?.title || release.title);
    const itemType = isAlbum ? (release.type === 'album' ? 'Full Album' : 'Full EP') : 'Track';
    
    const available = release.totalEditions - release.soldEditions;
    
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page">
        <div class="purchase-container">
          
          <!-- Header -->
          <div class="purchase-header">
            <button class="back-btn" onclick="history.back()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <h1>Complete Purchase</h1>
          </div>
          
          <!-- Main Content -->
          <div class="purchase-main">
            
            <!-- Left: Item Info -->
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
            
            <!-- Right: Purchase Flow -->
            <div class="purchase-flow-section">
              
              <!-- Price Summary -->
              <div class="purchase-summary-card">
                <h3>Order Summary</h3>
                <div class="summary-row">
                  <span>${isAlbum ? `${trackCount} NFTs × ${trackPrice} XRP` : 'NFT Price'}</span>
                  <span>${totalPrice} XRP</span>
                </div>
                <div class="summary-row small">
                  <span>Network Fee</span>
                  <span>~0.00001 XRP</span>
                </div>
                <div class="summary-row total">
                  <span>Total</span>
                  <span>${totalPrice} XRP</span>
                </div>
              </div>
              
              <!-- Xaman Instructions -->
              <div class="xaman-instructions">
                <div class="xaman-header">
                  <img src="https://xumm.app/assets/icons/icon-512.png" alt="Xaman" class="xaman-logo">
                  <div>
                    <h4>Xaman Wallet Required</h4>
                    <p>${totalSignatures} signatures needed</p>
                  </div>
                </div>
                
                <div class="signature-steps">
                  <div class="sig-step">
                    <div class="sig-num">1</div>
                    <div class="sig-info">
                      <strong>Payment</strong>
                      <span>Send ${totalPrice} XRP to platform</span>
                    </div>
                  </div>
                  ${isAlbum ? release.tracks.map((t, i) => `
                    <div class="sig-step">
                      <div class="sig-num">${i + 2}</div>
                      <div class="sig-info">
                        <strong>Accept NFT</strong>
                        <span>"${t.title}"</span>
                      </div>
                    </div>
                  `).join('') : `
                    <div class="sig-step">
                      <div class="sig-num">2</div>
                      <div class="sig-info">
                        <strong>Accept NFT</strong>
                        <span>Receive your NFT</span>
                      </div>
                    </div>
                  `}
                </div>
                
                <div class="xaman-tip">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div>
                    <strong>Important!</strong>
                    <p>Pull down on the <strong>Events</strong> tab in Xaman to refresh after each signature. New requests may not appear automatically.</p>
                  </div>
                </div>
              </div>
              
              <!-- Status Area (hidden initially) -->
              <div class="purchase-status" id="purchase-status" style="display: none;">
                <div class="status-icon">
                  <div class="spinner"></div>
                </div>
                <div class="status-text" id="status-text">Preparing...</div>
                <div class="status-sub" id="status-sub">Please wait</div>
              </div>
              
              <!-- Action Button -->
              <button class="purchase-btn" id="purchase-btn" onclick="PurchasePage.startPurchase()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Pay ${totalPrice} XRP with Xaman
              </button>
              
              <p class="purchase-note">
                By purchasing, you agree to the terms of service. NFTs are non-refundable once transferred.
              </p>
              
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .purchase-page {
          min-height: 100vh;
          background: var(--bg-primary);
          padding: 24px;
        }
        
        .purchase-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .purchase-header {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 32px;
        }
        
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 150ms;
        }
        .back-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        
        .purchase-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .purchase-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
        }
        
        @media (max-width: 768px) {
          .purchase-main {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
        
        /* Left Section - Item Info */
        .purchase-item-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .purchase-cover {
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1;
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .purchase-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .purchase-item-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .purchase-item-type {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--accent);
          letter-spacing: 1px;
        }
        
        .purchase-item-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }
        
        .purchase-item-artist {
          font-size: 16px;
          color: var(--text-secondary);
        }
        
        .purchase-item-tracks {
          font-size: 14px;
          color: var(--text-muted);
        }
        
        .purchase-availability {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 14px;
          color: var(--text-secondary);
        }
        
        .availability-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--success);
        }
        .availability-dot.low {
          background: var(--warning);
        }
        
        /* Right Section - Purchase Flow */
        .purchase-flow-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .purchase-summary-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 24px;
        }
        
        .purchase-summary-card h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          font-size: 15px;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .summary-row:last-child {
          border-bottom: none;
        }
        .summary-row.small {
          font-size: 13px;
          color: var(--text-muted);
          padding: 8px 0;
        }
        .summary-row.total {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          padding-top: 16px;
          margin-top: 8px;
          border-top: 2px solid var(--border-color);
          border-bottom: none;
        }
        
        /* Xaman Instructions */
        .xaman-instructions {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(91, 33, 182, 0.1));
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: var(--radius-xl);
          padding: 24px;
        }
        
        .xaman-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .xaman-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
        }
        
        .xaman-header h4 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        
        .xaman-header p {
          font-size: 14px;
          color: var(--accent);
          font-weight: 500;
        }
        
        .signature-steps {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .sig-step {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.05);
          border-radius: var(--radius-lg);
        }
        
        .sig-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .sig-info {
          display: flex;
          flex-direction: column;
        }
        
        .sig-info strong {
          font-size: 14px;
          color: var(--text-primary);
        }
        
        .sig-info span {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .xaman-tip {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-lg);
        }
        
        .xaman-tip svg {
          flex-shrink: 0;
          color: var(--warning);
        }
        
        .xaman-tip strong {
          display: block;
          font-size: 14px;
          color: var(--warning);
          margin-bottom: 4px;
        }
        
        .xaman-tip p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        
        /* Purchase Status */
        .purchase-status {
          text-align: center;
          padding: 32px;
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
        }
        
        .status-icon {
          margin-bottom: 16px;
        }
        
        .status-icon .spinner {
          width: 48px;
          height: 48px;
          margin: 0 auto;
        }
        
        .status-icon.success svg {
          color: var(--success);
        }
        
        .status-icon.error svg {
          color: var(--error);
        }
        
        .status-text {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        
        .status-sub {
          font-size: 14px;
          color: var(--text-muted);
        }
        
        /* Purchase Button */
        .purchase-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 18px 32px;
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          border: none;
          border-radius: var(--radius-xl);
          color: white;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 150ms, box-shadow 150ms;
        }
        
        .purchase-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(124, 58, 237, 0.4);
        }
        
        .purchase-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        
        .purchase-note {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.5;
        }
      </style>
    `;
  },
  
  async startPurchase() {
    const btn = document.getElementById('purchase-btn');
    const statusEl = document.getElementById('purchase-status');
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Processing...';
    statusEl.style.display = 'block';
    
    const updateStatus = (text, sub, type = 'loading') => {
      const iconEl = statusEl.querySelector('.status-icon');
      const textEl = document.getElementById('status-text');
      const subEl = document.getElementById('status-sub');
      
      if (type === 'loading') {
        iconEl.innerHTML = '<div class="spinner" style="width:48px;height:48px;"></div>';
        iconEl.className = 'status-icon';
      } else if (type === 'success') {
        iconEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`;
        iconEl.className = 'status-icon success';
      } else if (type === 'error') {
        iconEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`;
        iconEl.className = 'status-icon error';
      }
      
      textEl.textContent = text;
      subEl.textContent = sub;
    };
    
    try {
      // Get platform address
      const configResponse = await fetch('/api/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConfig' }),
      });
      const configData = await configResponse.json();
      const platformAddress = configData.platformAddress;
      
      if (!platformAddress) throw new Error('Platform not configured');
      
      const trackPrice = parseFloat(this.release.songPrice) || 0;
      const trackCount = this.release.tracks?.length || 1;
      const totalPrice = this.isAlbum ? (trackPrice * trackCount) : trackPrice;
      
      // Step 1: Payment
      updateStatus('Sign Payment', `Send ${totalPrice} XRP in Xaman`);
      
      const paymentResult = await XamanWallet.sendPayment(
        platformAddress,
        totalPrice,
        `XRP Music: ${this.release.title}`
      );
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment cancelled');
      }
      
      // Step 2: Call appropriate API
      if (this.isAlbum) {
        await this.processAlbumPurchase(paymentResult.txHash, updateStatus);
      } else {
        await this.processSinglePurchase(paymentResult.txHash, updateStatus);
      }
      
    } catch (error) {
      console.error('Purchase failed:', error);
      updateStatus('Purchase Failed', error.message, 'error');
      
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Try Again
      `;
    }
  },
  
  async processSinglePurchase(paymentTxHash, updateStatus) {
    // Call broker-sale API
    updateStatus('Preparing NFT', 'Platform is creating transfer offer...');
    
    const purchaseResponse = await fetch('/api/broker-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        releaseId: this.release.id,
        trackId: this.track?.id,
        buyerAddress: AppState.user.address,
        paymentTxHash: paymentTxHash,
      }),
    });
    
    const purchaseResult = await purchaseResponse.json();
    
    if (!purchaseResult.success) {
      if (purchaseResult.refunded) {
        throw new Error('Sold out - payment refunded');
      }
      throw new Error(purchaseResult.error || 'Purchase failed');
    }
    
    // Accept NFT offer
    updateStatus('Accept NFT', 'Sign in Xaman to receive your NFT - Pull down Events to refresh!');
    
    const acceptResult = await XamanWallet.acceptSellOffer(purchaseResult.sellOfferIndex);
    
    if (!acceptResult.success) {
      throw new Error('Failed to accept NFT - check Xaman Requests');
    }
    
    // Confirm sale
    try {
      await fetch('/api/broker-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          pendingSale: purchaseResult.pendingSale,
          acceptTxHash: acceptResult.txHash,
        }),
      });
    } catch (e) {
      console.error('Failed to confirm:', e);
    }
    
    // Success!
    updateStatus('Purchase Complete! 🎉', 'NFT is now in your wallet', 'success');
    
    setTimeout(() => {
      Router.navigate('profile');
    }, 2000);
  },
  
  async processAlbumPurchase(paymentTxHash, updateStatus) {
    const trackCount = this.release.tracks?.length || 1;
    
    // Call broker-album-sale API
    updateStatus('Preparing NFTs', `Creating ${trackCount} transfer offers...`);
    
    const purchaseResponse = await fetch('/api/broker-album-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        releaseId: this.release.id,
        buyerAddress: AppState.user.address,
        paymentTxHash: paymentTxHash,
      }),
    });
    
    const purchaseResult = await purchaseResponse.json();
    
    if (!purchaseResult.success) {
      if (purchaseResult.refunded) {
        throw new Error('NFT unavailable - payment refunded');
      }
      throw new Error(purchaseResult.error || 'Purchase failed');
    }
    
    // Accept each NFT offer
    const acceptTxHashes = [];
    for (let i = 0; i < purchaseResult.offerIndexes.length; i++) {
      const trackTitle = this.release.tracks[i]?.title || `Track ${i + 1}`;
      updateStatus(
        `Accept NFT ${i + 1}/${purchaseResult.offerIndexes.length}`,
        `"${trackTitle}" - Pull down Events in Xaman to refresh!`
      );
      
      const acceptResult = await XamanWallet.acceptSellOffer(purchaseResult.offerIndexes[i]);
      
      if (!acceptResult.success) {
        throw new Error(`Failed to accept "${trackTitle}" - check Xaman Requests`);
      }
      acceptTxHashes.push(acceptResult.txHash);
    }
    
    // Confirm sales
    updateStatus('Finalizing', 'Recording purchase...');
    
    try {
      await fetch('/api/broker-album-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          pendingSales: purchaseResult.pendingSales,
          acceptTxHashes: acceptTxHashes,
        }),
      });
    } catch (e) {
      console.error('Failed to confirm:', e);
    }
    
    // Success!
    updateStatus('Album Purchased! 🎉', `${trackCount} NFTs are now in your wallet`, 'success');
    
    setTimeout(() => {
      Router.navigate('profile');
    }, 2000);
  },
  
  showError(message) {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page">
        <div class="purchase-container">
          <div class="purchase-error">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <h2>Error</h2>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="history.back()">Go Back</button>
          </div>
        </div>
      </div>
      <style>
        .purchase-error {
          text-align: center;
          padding: 64px;
        }
        .purchase-error h2 {
          font-size: 24px;
          margin: 24px 0 12px;
          color: var(--text-primary);
        }
        .purchase-error p {
          color: var(--text-muted);
          margin-bottom: 24px;
        }
      </style>
    `;
  },
  
  showSoldOut(reason) {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page">
        <div class="purchase-container">
          <div class="purchase-error">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2>Sold Out</h2>
            <p>${reason}</p>
            <p style="font-size: 14px; margin-top: 12px;">Check the <a href="#marketplace" style="color: var(--accent);">Resale Market</a> for available copies.</p>
            <button class="btn btn-primary" onclick="history.back()" style="margin-top: 24px;">Go Back</button>
          </div>
        </div>
      </div>
      <style>
        .purchase-error {
          text-align: center;
          padding: 64px;
        }
        .purchase-error h2 {
          font-size: 24px;
          margin: 24px 0 12px;
          color: var(--text-primary);
        }
        .purchase-error p {
          color: var(--text-muted);
        }
      </style>
    `;
  },
  
  showLoginRequired() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="purchase-page">
        <div class="purchase-container">
          <div class="purchase-error">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
            <h2>Connect Wallet</h2>
            <p>You need to connect your Xaman wallet to make purchases.</p>
            <button class="btn btn-primary" onclick="Modals.showAuth()" style="margin-top: 24px;">Connect Wallet</button>
          </div>
        </div>
      </div>
      <style>
        .purchase-error {
          text-align: center;
          padding: 64px;
        }
        .purchase-error h2 {
          font-size: 24px;
          margin: 24px 0 12px;
          color: var(--text-primary);
        }
        .purchase-error p {
          color: var(--text-muted);
        }
      </style>
    `;
  },
};
