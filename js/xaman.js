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
    if (!this.sdk) throw new Error('SDK not initialized');
    
    const { transferFee = 200, taxon = 0, flags = 8 } = options;
    
    // Convert URI to hex
    const uriHex = this.stringToHex(metadataUri);
    
    console.log('Creating NFT mint payload...');
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenMint',
        NFTokenTaxon: taxon,
        Flags: flags,
        TransferFee: transferFee,
        URI: uriHex,
      },
      custom_meta: {
        instruction: 'Sign to mint your music NFT on the XRP Ledger',
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create mint payload');
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
};
