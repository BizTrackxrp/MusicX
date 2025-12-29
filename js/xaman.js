/**
 * XRP Music - Xaman Wallet Integration
 * Handles wallet connection, authentication, and signing
 */

const XAMAN_API_KEY = '619aefc9-660a-4120-9e22-e8afd2980c8c';

const XamanWallet = {
  sdk: null,
  initialized: false,
  isConnecting: false,
  
  /**
   * Initialize Xaman SDK
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Load Xumm SDK from CDN if not loaded
      if (typeof Xumm === 'undefined') {
        await this.loadSDK();
      }
      
      this.sdk = new Xumm(XAMAN_API_KEY);
      
      // Set up event listeners
      this.sdk.on('success', async () => {
        try {
          const account = await this.sdk.user.account;
          if (account) {
            saveSession(account);
            await this.loadUserData(account);
            UI.updateAuthUI();
            UI.showLoggedInState();
          }
        } catch (err) {
          console.error('Error getting account after success:', err);
        }
        this.isConnecting = false;
      });
      
      this.sdk.on('logout', () => {
        clearSession();
        UI.updateAuthUI();
        UI.showLoggedOutState();
      });
      
      this.sdk.on('error', (err) => {
        console.error('Xumm error:', err);
        this.isConnecting = false;
      });
      
      // Wait for SDK to be ready
      await this.sdk.environment.ready;
      
      // Check for existing session
      await this.checkSession();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Xaman:', error);
    }
  },
  
  /**
   * Load Xumm SDK from CDN
   */
  loadSDK() {
    return new Promise((resolve, reject) => {
      if (typeof Xumm !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://xumm.app/assets/cdn/xumm.min.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Xumm SDK'));
      document.head.appendChild(script);
    });
  },
  
  /**
   * Check for existing session
   */
  async checkSession() {
    // First check our local storage
    if (AppState.user?.address) {
      await this.loadUserData(AppState.user.address);
      UI.updateAuthUI();
      return;
    }
    
    // Then check SDK
    try {
      const account = await this.sdk.user.account;
      if (account) {
        saveSession(account);
        await this.loadUserData(account);
        UI.updateAuthUI();
      }
    } catch (err) {
      console.log('No existing SDK session');
    }
  },
  
  /**
   * Load user data (profile, liked tracks, playlists)
   */
  async loadUserData(address) {
    try {
      // Load profile
      const profile = await API.getProfile(address);
      if (profile) {
        setProfile(profile);
      }
      
      // Load liked track IDs
      const likedIds = await API.getLikedTrackIds(address);
      AppState.likedTrackIds = new Set(likedIds);
      
      // Load playlists
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
      // For desktop, the success event will fire
      // For mobile, we need to wait for redirect back
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
    clearSession();
    UI.updateAuthUI();
    UI.showLoggedOutState();
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
   * Mint NFT
   */
  async mintNFT(metadataUri, options = {}) {
    // Flow:
    // 1. Artist pays mint fee to platform
    // 2. Artist authorizes platform as minter
    // 3. Backend batch mints NFTs
    if (!this.sdk) {
      console.error('mintNFT: SDK not initialized');
      throw new Error('SDK not initialized');
    }
    
    if (!AppState.user?.address) {
      throw new Error('Wallet not connected');
    }
    
    const { quantity = 1, transferFee = 500, taxon = 0, onProgress } = options;
    
    // Calculate mint fee: (editions × 0.000012) + 0.001 buffer
    const mintFee = (quantity * 0.000012) + 0.001;
    const mintFeeDrops = Math.ceil(mintFee * 1000000).toString(); // Convert to drops
    
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
    
    console.log('Starting mint process...', { platformAddress, quantity, mintFee });
    
    try {
      // STEP 1: Pay mint fee
      if (onProgress) {
        onProgress({
          stage: 'paying',
          message: `Paying mint fee (${mintFee.toFixed(6)} XRP)...`,
          quantity: quantity,
        });
      }
      
      const paymentPayload = await this.sdk.payload?.create({
        txjson: {
          TransactionType: 'Payment',
          Destination: platformAddress,
          Amount: mintFeeDrops,
        },
        custom_meta: {
          instruction: `Pay ${mintFee.toFixed(6)} XRP mint fee for ${quantity} NFT editions`,
        },
      });
      
      if (!paymentPayload) {
        throw new Error('Failed to create payment payload');
      }
      
      // Open Xaman for fee payment
      if (paymentPayload.next?.always) {
        console.log('Opening Xaman for fee payment:', paymentPayload.next.always);
        window.open(paymentPayload.next.always, '_blank');
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
          message: 'Authorize minting in Xaman...',
          quantity: quantity,
        });
      }
      
      const authPayload = await this.sdk.payload?.create({
        txjson: {
          TransactionType: 'AccountSet',
          NFTokenMinter: platformAddress,
          SetFlag: 10, // asfAuthorizedNFTokenMinter
        },
        custom_meta: {
          instruction: `Authorize XRP Music to mint ${quantity} NFT copies for you`,
        },
      });
      
      if (!authPayload) {
        throw new Error('Failed to create authorization payload');
      }
      
      // Open Xaman for authorization
      if (authPayload.next?.always) {
        console.log('Opening Xaman for authorization:', authPayload.next.always);
        window.open(authPayload.next.always, '_blank');
      } else {
        throw new Error('No sign URL returned from Xaman');
      }
      
      // Wait for authorization
      const authResult = await this.waitForPayload(authPayload.uuid);
      
      if (!authResult.success) {
        throw new Error('Authorization cancelled');
      }
      
      console.log('Authorization successful:', authResult.txHash);
      
      // STEP 3: Backend batch mints
      if (onProgress) {
        onProgress({
          stage: 'minting',
          message: `Minting ${quantity} NFTs... Please don't refresh!`,
          quantity: quantity,
        });
      }
      
      const mintResponse = await fetch('/api/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mint',
          artistAddress: AppState.user.address,
          metadataUri: metadataUri,
          quantity: quantity,
          transferFee: transferFee,
          taxon: taxon,
        }),
      });
      
      const mintData = await mintResponse.json();
      
      if (!mintData.success) {
        throw new Error(mintData.error || 'Batch minting failed');
      }
      
      return {
        success: true,
        txHash: authResult.txHash,
        paymentTxHash: paymentResult.txHash,
        nftTokenIds: mintData.nftTokenIds,
        totalMinted: mintData.totalMinted,
      };
      
    } catch (error) {
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
          const status = await this.sdk.payload?.get(uuid);
          
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
    
    // Build transaction
    const txJson = {
      TransactionType: 'Payment',
      Destination: destination,
      Amount: this.xrpToDrops(amountXRP),
    };
    
    // Add memo if provided
    if (memo) {
      txJson.Memos = [{
        Memo: {
          MemoType: this.stringToHex('text/plain'),
          MemoData: this.stringToHex(memo),
        }
      }];
    }
    
    const payload = await this.sdk.payload?.create({
      txjson: txJson,
      custom_meta: {
        instruction: `Pay ${amountXRP} XRP for music NFT`,
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create payment payload');
    }
    
    // Open Xaman for signing
    if (payload.next?.always) {
      window.open(payload.next.always, '_blank');
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Create NFT sell offer with platform as destination (for brokered sales)
   * @param {string} nftTokenId - The NFT token ID
   * @param {number} amountDrops - Price in drops
   * @param {string} destination - Platform wallet address (broker)
   */
  async createSellOffer(nftTokenId, amountDrops, destination) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Creating sell offer:', { nftTokenId, amountDrops, destination });
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenCreateOffer',
        NFTokenID: nftTokenId,
        Amount: amountDrops.toString(),
        Flags: 1, // tfSellNFToken
        Destination: destination, // Platform can broker this offer
      },
      custom_meta: {
        instruction: 'Sign to list your music NFT for sale',
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create sell offer payload');
    }
    
    console.log('Sell offer payload:', payload);
    
    // Open Xaman for signing
    if (payload.next?.always) {
      window.open(payload.next.always, '_blank');
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    const result = await this.waitForPayload(payload.uuid);
    
    // Extract offer index from the result if available
    if (result.success && result.txHash) {
      // The offer index will be in the transaction result
      // For now, we'll store the tx hash and look up the offer later
      result.offerIndex = result.txHash; // Placeholder - actual offer index comes from tx meta
    }
    
    return result;
  },
  
  /**
   * Create NFT transfer offer (Amount: 0) to transfer NFT to platform
   * @param {string} nftTokenId - The NFT token ID
   * @param {string} destination - Platform wallet address to receive NFT
   */
  async createTransferOffer(nftTokenId, destination) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Creating transfer offer:', { nftTokenId, destination });
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenCreateOffer',
        NFTokenID: nftTokenId,
        Amount: '0', // Free transfer
        Flags: 1, // tfSellNFToken
        Destination: destination, // Only platform can accept this offer
      },
      custom_meta: {
        instruction: 'Sign to transfer your NFT to XRP Music for listing',
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create transfer payload');
    }
    
    console.log('Transfer offer payload:', payload);
    
    // Open Xaman for signing
    if (payload.next?.always) {
      window.open(payload.next.always, '_blank');
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    const result = await this.waitForPayload(payload.uuid);
    
    if (result.success && result.txHash) {
      result.offerIndex = result.txHash;
    }
    
    return result;
  },
  
  /**
   * Accept a sell offer to receive an NFT
   * @param {string} offerIndex - The sell offer index to accept
   */
  async acceptSellOffer(offerIndex) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Accepting sell offer:', offerIndex);
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenAcceptOffer',
        NFTokenSellOffer: offerIndex,
      },
      custom_meta: {
        instruction: 'Sign to receive your music NFT',
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create accept offer payload');
    }
    
    console.log('Accept offer payload:', payload);
    
    // Open Xaman for signing
    if (payload.next?.always) {
      window.open(payload.next.always, '_blank');
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    return this.waitForPayload(payload.uuid);
  },
};
