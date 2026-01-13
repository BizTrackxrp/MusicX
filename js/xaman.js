/**
 * XRP Music - Xaman Wallet Integration
 * Handles wallet connection, authentication, and signing
 * 
 * IMPORTANT: Sessions are NOT persisted across page closes.
 * Users must re-authenticate with Xaman each time they visit.
 * This prevents stale session issues and ensures fresh wallet connections.
 * 
 * MINTING: Uses Railway worker queue - no timeout limits!
 * Max 10,000 NFTs per batch. User can close page after signing.
 */

const XAMAN_API_KEY = '619aefc9-660a-4120-9e22-e8afd2980c8c';

// Session key for this browser tab only
const SESSION_KEY = 'xrpmusic_session';

const XamanWallet = {
  sdk: null,
  initialized: false,
  isConnecting: false,
  mintProgressInterval: null,
  
  /**
   * Open Xaman URL in a popup window instead of a tab
   */
  openXamanPopup(url) {
    const width = 420;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const popup = window.open(
      url,
      'XamanSign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    
    if (popup) {
      popup.focus();
    }
    
    return popup;
  },
  
  /**
   * Initialize Xaman SDK
   */
  async init() {
    if (this.initialized) return;
    
    try {
      if (typeof Xumm === 'undefined') {
        await this.loadSDK();
      }
      
      this.sdk = new Xumm(XAMAN_API_KEY);
      
      // Set up page unload handler to clear session
      this.setupAutoLogout();
      
      this.sdk.on('success', async () => {
        try {
          const account = await this.sdk.user.account;
          if (account) {
            // Use sessionStorage - dies when tab closes
            this.saveSessionToTab(account);
            saveSession(account);
            await this.loadUserData(account);
            UI.updateAuthUI();
            UI.showLoggedInState();
            
            // Initialize mint notifications
            if (typeof MintNotifications !== 'undefined') {
              MintNotifications.init();
            }
          }
        } catch (err) {
          console.error('Error getting account after success:', err);
        }
        this.isConnecting = false;
      });
      
      this.sdk.on('logout', () => {
        this.clearTabSession();
        clearSession();
        UI.updateAuthUI();
        UI.showLoggedOutState();
        
        // Cleanup notifications
        if (typeof MintNotifications !== 'undefined') {
          MintNotifications.cleanup();
        }
      });
      
      this.sdk.on('error', (err) => {
        console.error('Xumm error:', err);
        this.isConnecting = false;
      });
      
      const readyTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SDK ready timeout')), 10000)
      );
      
      try {
        await Promise.race([this.sdk.environment.ready, readyTimeout]);
      } catch (err) {
        console.warn('SDK ready timeout, continuing anyway');
      }
      
      // Clear any persisted localStorage sessions on fresh page load
      // Only restore if we have a valid sessionStorage session (same tab)
      this.handlePageLoad();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Xaman:', error);
    }
  },
  
  /**
   * Set up automatic logout on page close/unload
   */
  setupAutoLogout() {
    // Clear session when page is being unloaded (closed, refreshed, navigated away)
    window.addEventListener('beforeunload', () => {
      // Clear localStorage session so it doesn't persist
      localStorage.removeItem('xrpmusic_user');
      localStorage.removeItem('xrpmusic_profile');
    });
    
    // Also handle visibility change (tab hidden for too long)
    let hiddenTime = null;
    const MAX_HIDDEN_TIME = 30 * 60 * 1000; // 30 minutes
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else if (hiddenTime) {
        const elapsed = Date.now() - hiddenTime;
        if (elapsed > MAX_HIDDEN_TIME && AppState.user?.address) {
          console.log('Session expired due to inactivity, logging out...');
          this.disconnect();
        }
        hiddenTime = null;
      }
    });
  },
  
  /**
   * Handle page load - only restore session if it's a same-tab session
   */
  handlePageLoad() {
    // Check if this is a fresh page load or same-tab navigation
    const tabSession = sessionStorage.getItem(SESSION_KEY);
    
    if (!tabSession) {
      // Fresh page load (new tab or browser reopened) - clear any old sessions
      console.log('Fresh page load detected - clearing any stale sessions');
      localStorage.removeItem('xrpmusic_user');
      localStorage.removeItem('xrpmusic_profile');
      // clearSession may not exist yet if state.js hasn't fully initialized
      if (typeof clearSession === 'function') {
        clearSession();
      }
      // UI may not be loaded yet during init - it will check AppState on its own init
      if (typeof UI !== 'undefined' && UI.updateAuthUI) {
        UI.updateAuthUI();
        UI.showLoggedOutState();
      }
    } else {
      // Same tab navigation - restore session
      console.log('Same-tab session found, restoring...');
      this.checkSession().catch(err => {
        console.warn('Session check failed:', err);
      });
    }
  },
  
  /**
   * Save session marker to sessionStorage (tab-specific)
   */
  saveSessionToTab(address) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      address: address,
      timestamp: Date.now()
    }));
  },
  
  /**
   * Clear tab session
   */
  clearTabSession() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  
  /**
   * Load Xumm SDK from CDN with timeout
   */
  loadSDK() {
    return new Promise((resolve, reject) => {
      if (typeof Xumm !== 'undefined') {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Xumm SDK load timeout'));
      }, 10000);
      
      const script = document.createElement('script');
      script.src = 'https://xumm.app/assets/cdn/xumm.min.js';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Xumm SDK'));
      };
      document.head.appendChild(script);
    });
  },
  
  /**
   * Check for existing session
   */
  async checkSession() {
    // Only check if we have a tab session marker
    const tabSession = sessionStorage.getItem(SESSION_KEY);
    if (!tabSession) {
      console.log('No tab session, skipping session check');
      return;
    }
    
    if (AppState.user?.address) {
      await this.loadUserData(AppState.user.address);
      UI.updateAuthUI();
      
      // Initialize mint notifications
      if (typeof MintNotifications !== 'undefined') {
        MintNotifications.init();
      }
      return;
    }
    
    try {
      const account = await this.sdk.user.account;
      if (account) {
        this.saveSessionToTab(account);
        saveSession(account);
        await this.loadUserData(account);
        UI.updateAuthUI();
        
        // Initialize mint notifications
        if (typeof MintNotifications !== 'undefined') {
          MintNotifications.init();
        }
      }
    } catch (err) {
      console.log('No existing SDK session');
      // Clear stale tab session if SDK session is gone
      this.clearTabSession();
    }
  },
  
  /**
   * Load user data (profile, liked tracks, playlists)
   */
  async loadUserData(address) {
    try {
      const profile = await API.getProfile(address);
      if (profile) {
        setProfile(profile);
      }
      
      const likedIds = await API.getLikedTrackIds(address);
      AppState.likedTrackIds = new Set(likedIds);
      
      const playlists = await API.getPlaylists(address);
      setPlaylists(playlists);
      
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  },
  
  /**
   * Connect wallet
   */
  async connect() {
    if (!this.sdk || this.isConnecting) return;
    
    this.isConnecting = true;
    
    try {
      await this.sdk.authorize();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      this.isConnecting = false;
    }
  },
  
  /**
   * Disconnect wallet
   */
  disconnect() {
    if (this.sdk) {
      this.sdk.logout();
    }
    this.clearTabSession();
    clearSession();
    UI.updateAuthUI();
    UI.showLoggedOutState();
    
    // Cleanup notifications
    if (typeof MintNotifications !== 'undefined') {
      MintNotifications.cleanup();
    }
  },
  
  /**
   * Check if connected
   */
  isConnected() {
    return !!AppState.user?.address;
  },
  
  /**
   * Get current address
   */
  getAddress() {
    return AppState.user?.address || null;
  },
  
  /**
   * Stop any active polling
   */
  stopMintProgress() {
    if (this.mintProgressInterval) {
      clearInterval(this.mintProgressInterval);
      this.mintProgressInterval = null;
    }
  },
  
  /**
   * Mint NFT - Fire and Forget!
   * 
   * After user signs the 2 transactions (pay + authorize), the job is queued
   * and the user can close the page. The Railway worker handles the rest.
   * 
   * Max 10,000 NFTs per batch - no timeout limits!
   */
  async mintNFT(metadataUri, options = {}) {
    if (!this.sdk) {
      console.error('mintNFT: SDK not initialized');
      throw new Error('SDK not initialized');
    }
    
    if (!AppState.user?.address) {
      throw new Error('Wallet not connected');
    }
    
    const { 
      quantity = 1, 
      transferFee = 500, 
      taxon = 0, 
      onProgress, 
      tracks = null, 
      trackIds = null,
      releaseId = null
    } = options;
    
    // Validate quantity - max 10,000 NFTs
    if (quantity > 10000) {
      throw new Error('Maximum 10,000 NFTs per batch');
    }
    
    const trackCount = tracks ? tracks.length : 1;
    const totalNFTs = trackCount * quantity;
    
    if (totalNFTs > 10000) {
      throw new Error('Maximum 10,000 NFTs per batch (tracks × editions)');
    }
    
    const mintFee = (totalNFTs * 0.000012) + 0.001;
    const mintFeeDrops = Math.ceil(mintFee * 1000000).toString();
    
    // Get platform address from API
    const configResponse = await fetch('/api/batch-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getConfig' }),
    });
    const configData = await configResponse.json();
    const platformAddress = configData.platformAddress;
    
    if (!platformAddress) {
      throw new Error('Platform not configured');
    }
    
    console.log('Starting mint process...', { platformAddress, trackCount, quantity, totalNFTs, mintFee, trackIds, releaseId });
    
    try {
      // STEP 1: Pay mint fee
      if (onProgress) {
        onProgress({
          stage: 'paying',
          message: `Step 1/2: Pay mint fee (${mintFee.toFixed(6)} XRP)`,
          quantity: quantity,
          progress: 0,
        });
      }
      
      // Make sure SDK payload is available
      if (!this.sdk.payload) {
        console.error('SDK payload not available, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!this.sdk.payload) {
          throw new Error('Xaman SDK not fully loaded. Please refresh and try again.');
        }
      }
      
      console.log('Creating payment payload...');
      
      let paymentPayload;
      try {
        paymentPayload = await this.sdk.payload.create({
          txjson: {
            TransactionType: 'Payment',
            Destination: platformAddress,
            Amount: mintFeeDrops,
          },
          custom_meta: {
            instruction: `Pay ${mintFee.toFixed(6)} XRP mint fee for ${totalNFTs} NFT editions`,
          },
        });
      } catch (payloadError) {
        console.error('Failed to create payment payload:', payloadError);
        throw new Error('Session expired - please refresh the page and reconnect your wallet');
      }
      
      console.log('Payment payload created:', paymentPayload);
      
      if (!paymentPayload || !paymentPayload.uuid) {
        throw new Error('Failed to create Xaman request - please refresh and reconnect your wallet');
      }
      
      // Open Xaman for fee payment
      if (paymentPayload.next?.always) {
        console.log('Opening Xaman for fee payment:', paymentPayload.next.always);
        this.openXamanPopup(paymentPayload.next.always);
      } else {
        throw new Error('No sign URL returned from Xaman');
      }
      
      // Wait for fee payment
      const paymentResult = await this.waitForPayload(paymentPayload.uuid);
      
      if (!paymentResult.success) {
        throw new Error('Mint fee payment cancelled');
      }
      
      console.log('Mint fee paid:', paymentResult.txHash);
      
      // STEP 2: Authorize platform as minter
      if (onProgress) {
        onProgress({
          stage: 'authorizing',
          message: 'Step 2/2: Authorize minting in Xaman',
          quantity: quantity,
          progress: 25,
        });
      }
      
      console.log('Creating authorization payload...');
      
      let authPayload;
      try {
        authPayload = await this.sdk.payload.create({
          txjson: {
            TransactionType: 'AccountSet',
            NFTokenMinter: platformAddress,
            SetFlag: 10,
          },
          custom_meta: {
            instruction: `Authorize XRP Music to mint ${totalNFTs} NFT editions for you`,
          },
        });
      } catch (authError) {
        console.error('Failed to create auth payload:', authError);
        throw new Error('Session expired - please refresh the page and reconnect your wallet');
      }
      
      console.log('Auth payload created:', authPayload);
      
      if (!authPayload || !authPayload.uuid) {
        throw new Error('Failed to create Xaman request - please refresh and reconnect your wallet');
      }
      
      // Open Xaman for authorization
      if (authPayload.next?.always) {
        console.log('Opening Xaman for authorization:', authPayload.next.always);
        this.openXamanPopup(authPayload.next.always);
      } else {
        throw new Error('No sign URL returned from Xaman');
      }
      
      // Wait for authorization
      const authResult = await this.waitForPayload(authPayload.uuid);
      
      if (!authResult.success) {
        throw new Error('Authorization cancelled');
      }
      
      console.log('Authorization successful:', authResult.txHash);
      
      // STEP 3: Queue the mint job - FIRE AND FORGET!
      if (onProgress) {
        onProgress({
          stage: 'queuing',
          message: `Queuing ${totalNFTs} NFTs for minting...`,
          quantity: totalNFTs,
          progress: 50,
        });
      }
      
      console.log('Queuing mint job...');
      
      const queueResponse = await fetch('/api/queue-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistAddress: AppState.user.address,
          releaseId: releaseId,
          quantity: quantity,
          transferFee: transferFee,
        }),
      });
      
      const queueData = await queueResponse.json();
      
      if (!queueData.success) {
        throw new Error(queueData.error || 'Failed to queue mint job');
      }
      
      console.log('Mint job queued successfully:', queueData);
      
      const jobId = queueData.jobId;
      
      // Notify the bell service about the new job
      if (typeof MintNotifications !== 'undefined') {
        MintNotifications.addJob(jobId, releaseId, totalNFTs);
      }
      
      // DONE! User can close the page now
      if (onProgress) {
        onProgress({
          stage: 'queued',
          message: `✓ Minting queued! You can close this page.`,
          subMessage: `Check the 🔔 notification bell for progress.`,
          quantity: totalNFTs,
          jobId: jobId,
          canClose: true,
          progress: 100,
        });
      }
      
      return {
        success: true,
        queued: true,
        jobId: jobId,
        txHash: authResult.txHash,
        paymentTxHash: paymentResult.txHash,
        totalNFTs: totalNFTs,
        message: 'Mint job queued. Check notifications for progress.',
      };
      
    } catch (error) {
      this.stopMintProgress();
      console.error('mintNFT error:', error);
      throw error;
    }
  },
  
  /**
   * Wait for payload to be signed
   */
  waitForPayload(uuid) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 120;
      
      const checkStatus = async () => {
        attempts++;
        
        try {
          const status = await this.sdk.payload.get(uuid);
          
          if (status?.meta?.resolved) {
            if (status.meta.signed) {
              resolve({
                success: true,
                txHash: status.response?.txid,
              });
            } else {
              resolve({
                success: false,
                error: 'Transaction rejected by user',
              });
            }
            return;
          }
          
          if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Transaction timed out',
            });
            return;
          }
          
          setTimeout(checkStatus, 2000);
        } catch (err) {
          console.error('Error checking status:', err);
          if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Failed to check transaction status',
            });
          } else {
            setTimeout(checkStatus, 2000);
          }
        }
      };
      
      checkStatus();
    });
  },
  
  /**
   * Convert string to hex
   */
  stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
  },
  
  /**
   * Convert XRP to drops
   */
  xrpToDrops(xrp) {
    return Math.floor(xrp * 1_000_000).toString();
  },
  
  /**
   * Convert drops to XRP
   */
  dropsToXrp(drops) {
    return Number(drops) / 1_000_000;
  },
  
  /**
   * Send XRP payment to an address
   */
  async sendPayment(destination, amountXRP, memo = '') {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log(`Creating payment: ${amountXRP} XRP to ${destination}`);
    
    const txJson = {
      TransactionType: 'Payment',
      Destination: destination,
      Amount: this.xrpToDrops(amountXRP),
    };
    
    if (memo) {
      txJson.Memos = [{
        Memo: {
          MemoType: this.stringToHex('text/plain'),
          MemoData: this.stringToHex(memo),
        }
      }];
    }
    
    let payload;
    try {
      payload = await this.sdk.payload.create({
        txjson: txJson,
        custom_meta: {
          instruction: `Pay ${amountXRP} XRP for music NFT`,
        },
      });
    } catch (payloadError) {
      console.error('Failed to create payment payload:', payloadError);
      throw new Error('Session expired - please refresh the page and reconnect your wallet');
    }
    
    if (!payload || !payload.uuid) {
      throw new Error('Failed to create payment payload - please refresh and reconnect your wallet');
    }
    
    console.log('Payment payload created:', payload.uuid);
    
    // Open Xaman for payment signing
    if (payload.next?.always) {
      console.log('Opening Xaman for payment:', payload.next.always);
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Create NFT transfer offer (Amount: 0) to transfer NFT to platform
   */
  async createTransferOffer(nftTokenId, destination) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Creating transfer offer:', { nftTokenId, destination });
    
    let payload;
    try {
      payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'NFTokenCreateOffer',
          NFTokenID: nftTokenId,
          Amount: '0',
          Flags: 1,
          Destination: destination,
        },
        custom_meta: {
          instruction: 'Sign to transfer your NFT to XRP Music for listing',
        },
      });
    } catch (payloadError) {
      console.error('Failed to create transfer payload:', payloadError);
      throw new Error('Session expired - please refresh the page and reconnect your wallet');
    }
    
    if (!payload || !payload.uuid) {
      throw new Error('Failed to create transfer payload - please refresh and reconnect your wallet');
    }
    
    console.log('Transfer offer payload:', payload);
    
    if (payload.next?.always) {
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    const result = await this.waitForPayload(payload.uuid);
    
    if (result.success && result.txHash) {
      try {
        const offerIndex = await this.getOfferIndexFromTx(result.txHash);
        if (offerIndex) {
          result.offerIndex = offerIndex;
        } else {
          const fallbackIndex = await this.getLatestSellOffer(nftTokenId, AppState.user.address);
          if (fallbackIndex) {
            result.offerIndex = fallbackIndex;
          }
        }
      } catch (err) {
        console.error('Failed to get offer index for transfer:', err);
      }
    }
    
    return result;
  },
  
  /**
   * Accept a sell offer to receive an NFT
   */
  async acceptSellOffer(offerIndex) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Accepting sell offer:', offerIndex);
    
    let payload;
    try {
      payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'NFTokenAcceptOffer',
          NFTokenSellOffer: offerIndex,
        },
        custom_meta: {
          instruction: 'Sign to receive your music NFT',
        },
      });
    } catch (payloadError) {
      console.error('Failed to create accept offer payload:', payloadError);
      throw new Error('Session expired - please refresh the page and reconnect your wallet');
    }
    
    if (!payload || !payload.uuid) {
      throw new Error('Failed to create accept offer payload - please refresh and reconnect your wallet');
    }
    
    console.log('Accept offer payload:', payload);
    
    if (payload.next?.always) {
      console.log('Opening Xaman for accept offer:', payload.next.always);
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Create a sell offer for an NFT (secondary market listing)
   */
  async createSellOffer(nftTokenId, price) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Creating sell offer for:', nftTokenId, 'at', price, 'XRP');
    
    const amountInDrops = Math.floor(price * 1000000).toString();
    
    let payload;
    try {
      payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'NFTokenCreateOffer',
          NFTokenID: nftTokenId,
          Amount: amountInDrops,
          Flags: 1,
        },
        custom_meta: {
          instruction: `List your NFT for sale at ${price} XRP`,
        },
      });
    } catch (payloadError) {
      console.error('Failed to create sell offer payload:', payloadError);
      throw new Error('Session expired - please refresh the page and reconnect your wallet');
    }
    
    if (!payload || !payload.uuid) {
      throw new Error('Failed to create sell offer payload - please refresh and reconnect your wallet');
    }
    
    console.log('Create sell offer payload:', payload);
    
    if (payload.next?.always) {
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    const result = await this.waitForPayload(payload.uuid);
    
    if (result.success && result.txHash) {
      try {
        const offerIndex = await this.getOfferIndexFromTx(result.txHash);
        if (offerIndex) {
          result.offerIndex = offerIndex;
          console.log('Got offer index from transaction:', offerIndex);
        } else {
          const fallbackIndex = await this.getLatestSellOffer(nftTokenId, AppState.user.address);
          if (fallbackIndex) {
            result.offerIndex = fallbackIndex;
            console.log('Got offer index from fallback:', fallbackIndex);
          }
        }
      } catch (err) {
        console.error('Failed to get offer index:', err);
        try {
          const fallbackIndex = await this.getLatestSellOffer(nftTokenId, AppState.user.address);
          if (fallbackIndex) {
            result.offerIndex = fallbackIndex;
          }
        } catch (e) {
          console.error('Fallback also failed:', e);
        }
      }
    }
    
    return result;
  },
  
  /**
   * Cancel a sell offer on XRPL
   */
  async cancelSellOffer(offerIndex) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Cancelling sell offer:', offerIndex);
    
    let payload;
    try {
      payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'NFTokenCancelOffer',
          NFTokenOffers: [offerIndex],
        },
        custom_meta: {
          instruction: 'Cancel your NFT listing',
        },
      });
    } catch (payloadError) {
      console.error('Failed to create cancel offer payload:', payloadError);
      throw new Error('Session expired - please refresh the page and reconnect your wallet');
    }
    
    if (!payload || !payload.uuid) {
      throw new Error('Failed to create cancel offer payload - please refresh and reconnect your wallet');
    }
    
    console.log('Cancel offer payload:', payload);
    
    if (payload.next?.always) {
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Edit listing price (cancel old offer + create new one)
   */
  async editListingPrice(nftTokenId, oldOfferIndex, newPrice) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Editing listing price:', { nftTokenId, oldOfferIndex, newPrice });
    
    const cancelResult = await this.cancelSellOffer(oldOfferIndex);
    
    if (!cancelResult.success) {
      throw new Error('Failed to cancel old listing: ' + (cancelResult.error || 'Unknown error'));
    }
    
    console.log('Old offer cancelled, creating new offer...');
    
    const newOfferResult = await this.createSellOffer(nftTokenId, newPrice);
    
    return newOfferResult;
  },
  
  /**
   * Get offer index from transaction metadata
   */
  async getOfferIndexFromTx(txHash) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const response = await fetch('https://xrplcluster.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tx',
          params: [{ transaction: txHash, binary: false }]
        })
      });
      
      const data = await response.json();
      console.log('Transaction data for offer lookup:', data.result);
      
      if (data.result?.meta?.AffectedNodes) {
        for (const node of data.result.meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
            let offerIndex = node.CreatedNode.LedgerIndex;
            if (offerIndex && offerIndex.length < 64) {
              console.log(`Padding offer_index from ${offerIndex.length} to 64 chars`);
              offerIndex = offerIndex.padStart(64, '0');
            }
            console.log('Found offer index from transaction:', offerIndex);
            return offerIndex;
          }
        }
      }
      
      console.log('No NFTokenOffer found in transaction metadata');
      return null;
    } catch (err) {
      console.error('getOfferIndexFromTx error:', err);
      return null;
    }
  },
  
  /**
   * Get the latest sell offer for an NFT from a specific owner
   */
  async getLatestSellOffer(nftTokenId, ownerAddress) {
    try {
      const response = await fetch('https://xrplcluster.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'nft_sell_offers',
          params: [{ nft_id: nftTokenId }]
        })
      });
      
      const data = await response.json();
      
      if (data.result?.offers) {
        const ownerOffers = data.result.offers.filter(o => o.owner === ownerAddress);
        if (ownerOffers.length > 0) {
          let offerIndex = ownerOffers[ownerOffers.length - 1].nft_offer_index;
          if (offerIndex && offerIndex.length < 64) {
            console.log(`Padding offer_index from ${offerIndex.length} to 64 chars`);
            offerIndex = offerIndex.padStart(64, '0');
          }
          console.log('Fallback: using most recent offer:', offerIndex);
          return offerIndex;
        }
      }
      return null;
    } catch (err) {
      console.error('getLatestSellOffer error:', err);
      return null;
    }
  },
};
