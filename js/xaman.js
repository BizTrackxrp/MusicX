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
   * Open Xaman URL in a popup window instead of a tab
   */
  openXamanPopup(url) {
    // Calculate popup position (centered)
    const width = 420;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    // Open as popup window
    const popup = window.open(
      url,
      'XamanSign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    
    // Focus the popup if it opened
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
      
      // Wait for SDK to be ready (with timeout)
      const readyTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SDK ready timeout')), 10000)
      );
      
      try {
        await Promise.race([this.sdk.environment.ready, readyTimeout]);
      } catch (err) {
        console.warn('SDK ready timeout, continuing anyway');
      }
      
      // Check for existing session (don't block on this)
      this.checkSession().catch(err => {
        console.warn('Session check failed:', err);
      });
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Xaman:', error);
    }
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
      
      // Timeout after 10 seconds
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
   * @param {string} metadataUri - Single track metadata URI
   * @param {object} options - Minting options
   * @param {number} options.quantity - Number of editions per track
   * @param {number} options.transferFee - Royalty in basis points (500 = 5%)
   * @param {number} options.taxon - NFT taxon
   * @param {function} options.onProgress - Progress callback
   * @param {string[]} options.tracks - Array of track metadata URIs (for albums)
   * @param {string[]} options.trackIds - Array of track database IDs (for nfts table)
   * @param {string} options.releaseId - Release database ID (for nfts table)
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
    
    const { 
      quantity = 1, 
      transferFee = 500, 
      taxon = 0, 
      onProgress, 
      tracks = null, 
      trackIds = null,   // NEW: track database IDs
      releaseId = null   // NEW: release database ID
    } = options;
    
    // Calculate total NFTs: tracks × editions
    const trackCount = tracks ? tracks.length : 1;
    const totalNFTs = trackCount * quantity;
    
    // Calculate mint fee: (totalNFTs × 0.000012) + 0.001 buffer
    const mintFee = (totalNFTs * 0.000012) + 0.001;
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
    
    console.log('Starting mint process...', { platformAddress, trackCount, quantity, totalNFTs, mintFee, trackIds, releaseId });
    
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
      
      // STEP 3: Backend batch mints
      if (onProgress) {
        onProgress({
          stage: 'minting',
          message: `Minting ${totalNFTs} NFTs... Please don't refresh!`,
          quantity: totalNFTs,
        });
      }
      
      const mintResponse = await fetch('/api/batch-mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'mint',
    artistAddress: AppState.user.address,
    metadataUri: metadataUri,
    tracks: tracks,
    trackIds: trackIds,
    releaseId: releaseId,
    quantity: quantity,
    transferFee: transferFee,
    taxon: taxon,
  }),
});

// Handle non-JSON responses
const mintText = await mintResponse.text();
let mintData;
try {
  mintData = JSON.parse(mintText);
} catch {
  console.error('Batch mint response not JSON:', mintText);
  throw new Error(mintText || 'Minting failed - server error');
}
      
      if (!mintData.success) {
        throw new Error(mintData.error || 'Batch minting failed');
      }
      
      return {
        success: true,
        txHash: authResult.txHash,
        paymentTxHash: paymentResult.txHash,
        nftTokenIds: mintData.nftTokenIds,
        totalMinted: mintData.totalMinted,
        tracks: mintData.tracks,
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
    
    // Push notification is sent to user's Xaman app automatically
    // No need to open browser popup - user checks their phone
    console.log('Payment payload created, push notification sent:', payload.uuid);
    
    // Wait for result
    return this.waitForPayload(payload.uuid);
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
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    const result = await this.waitForPayload(payload.uuid);
    
    if (result.success && result.txHash) {
      // Try to get the actual offer index
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
    
    // Push notification is sent to user's Xaman app automatically
    // No need to open browser popup - user checks their phone
    
    // Wait for result
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Create a sell offer for an NFT (secondary market listing)
   * @param {string} nftTokenId - The NFT token ID to sell
   * @param {number} price - Price in XRP
   */
  async createSellOffer(nftTokenId, price) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Creating sell offer for:', nftTokenId, 'at', price, 'XRP');
    
    // Convert XRP to drops
    const amountInDrops = Math.floor(price * 1000000).toString();
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenCreateOffer',
        NFTokenID: nftTokenId,
        Amount: amountInDrops,
        Flags: 1, // tfSellNFToken
      },
      custom_meta: {
        instruction: `List your NFT for sale at ${price} XRP`,
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create sell offer payload');
    }
    
    console.log('Create sell offer payload:', payload);
    
    // Open Xaman for signing
    if (payload.next?.always) {
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    const result = await this.waitForPayload(payload.uuid);
    
    // If successful, fetch the actual offer index from XRPL
    if (result.success && result.txHash) {
      try {
        const offerIndex = await this.getOfferIndexFromTx(result.txHash);
        if (offerIndex) {
          result.offerIndex = offerIndex;
          console.log('Got offer index from transaction:', offerIndex);
        } else {
          // Fallback: look up sell offers for this NFT
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
   * @param {string} offerIndex - The offer index to cancel
   */
  async cancelSellOffer(offerIndex) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Cancelling sell offer:', offerIndex);
    
    const payload = await this.sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenCancelOffer',
        NFTokenOffers: [offerIndex],
      },
      custom_meta: {
        instruction: 'Cancel your NFT listing',
      },
    });
    
    if (!payload) {
      throw new Error('Failed to create cancel offer payload');
    }
    
    console.log('Cancel offer payload:', payload);
    
    // Open Xaman for signing
    if (payload.next?.always) {
      this.openXamanPopup(payload.next.always);
    } else {
      throw new Error('No sign URL returned from Xaman');
    }
    
    // Wait for result
    return this.waitForPayload(payload.uuid);
  },
  
  /**
   * Edit listing price (cancel old offer + create new one)
   * @param {string} nftTokenId - The NFT token ID
   * @param {string} oldOfferIndex - The existing offer to cancel
   * @param {number} newPrice - New price in XRP
   */
  async editListingPrice(nftTokenId, oldOfferIndex, newPrice) {
    if (!this.sdk) throw new Error('SDK not initialized');
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    
    console.log('Editing listing price:', { nftTokenId, oldOfferIndex, newPrice });
    
    // Step 1: Cancel old offer
    const cancelResult = await this.cancelSellOffer(oldOfferIndex);
    
    if (!cancelResult.success) {
      throw new Error('Failed to cancel old listing: ' + (cancelResult.error || 'Unknown error'));
    }
    
    console.log('Old offer cancelled, creating new offer...');
    
    // Step 2: Create new offer at new price
    const newOfferResult = await this.createSellOffer(nftTokenId, newPrice);
    
    return newOfferResult;
  },
  
  /**
   * Get offer index from transaction metadata
   */
  async getOfferIndexFromTx(txHash) {
    // Wait a moment for transaction to be fully validated
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
            // Pad to 64 characters to preserve leading zeros
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
          // Get the LAST offer (most recent), not the first
          let offerIndex = ownerOffers[ownerOffers.length - 1].nft_offer_index;
          // Pad to 64 characters to preserve leading zeros
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
