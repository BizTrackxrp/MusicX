/**
 * XRP Music - Ownership Helper
 * Determines what action button to show for a track based on user's relationship:
 *   - Artist owns the release → "Edit Price" button
 *   - User owns the NFT → "List for Sale" / "Listed at X XRP" button
 *   - Neither → "Buy X XRP" button (default)
 * 
 * Caches user's owned NFT data at login and refreshes periodically.
 * Used by: Player mini drawer, expanded Now Playing, release modal, etc.
 * 
 * Usage:
 *   await OwnershipHelper.init();                    // Call once after login
 *   OwnershipHelper.getActionButton(track, release)  // Returns HTML string
 *   OwnershipHelper.owns(trackId)                    // Boolean check
 *   OwnershipHelper.isArtist(release)                // Boolean check
 */

const OwnershipHelper = {
  // Cache of user's owned NFTs: Map<trackId, { nftTokenId, releaseId, listed, listPrice }>
  _ownedNFTs: new Map(),
  // Cache of user's owned release IDs (for quick lookup)
  _ownedReleaseIds: new Set(),
  // Cache of user's owned NFT token IDs
  _ownedTokenIds: new Set(),
  // Last refresh timestamp
  _lastRefresh: 0,
  // Refresh interval (5 minutes)
  REFRESH_INTERVAL: 5 * 60 * 1000,
  // Is initialized
  _initialized: false,

  /**
   * Initialize — fetch user's NFTs and cache them
   * Call after login or when user address changes
   */
  async init() {
    if (!AppState.user?.address) {
      this._clear();
      return;
    }

    try {
      const response = await fetch(`/api/user-nfts?address=${AppState.user.address}`);
      const data = await response.json();

      this._ownedNFTs.clear();
      this._ownedReleaseIds.clear();
      this._ownedTokenIds.clear();

      const nfts = data.nfts || [];
      for (const nft of nfts) {
        const trackId = nft.trackId || nft.releaseId;
        if (trackId) {
          this._ownedNFTs.set(trackId, {
            nftTokenId: nft.nftTokenId,
            releaseId: nft.releaseId,
            trackId: nft.trackId,
          });
        }
        if (nft.releaseId) {
          this._ownedReleaseIds.add(nft.releaseId);
        }
        if (nft.nftTokenId) {
          this._ownedTokenIds.add(nft.nftTokenId);
        }
      }

      // Also cache external NFTs
      const external = data.external || [];
      for (const nft of external) {
        if (nft.nftTokenId) {
          this._ownedTokenIds.add(nft.nftTokenId);
        }
      }

      this._lastRefresh = Date.now();
      this._initialized = true;
      console.log(`📦 Ownership cache loaded: ${nfts.length} platform NFTs, ${external.length} external`);
    } catch (error) {
      console.error('Failed to load ownership data:', error);
    }
  },

  /**
   * Clear cache (on logout)
   */
  _clear() {
    this._ownedNFTs.clear();
    this._ownedReleaseIds.clear();
    this._ownedTokenIds.clear();
    this._initialized = false;
    this._lastRefresh = 0;
  },

  /**
   * Refresh if stale
   */
  async refreshIfNeeded() {
    if (!AppState.user?.address) return;
    if (Date.now() - this._lastRefresh > this.REFRESH_INTERVAL) {
      await this.init();
    }
  },

  /**
   * Force refresh (call after a purchase)
   */
  async refresh() {
    await this.init();
  },

  /**
   * Check if current user owns a specific track NFT
   */
  owns(trackId) {
    if (!trackId || !AppState.user?.address) return false;
    return this._ownedNFTs.has(trackId);
  },

  /**
   * Check if current user owns any track from a release
   */
  ownsRelease(releaseId) {
    if (!releaseId || !AppState.user?.address) return false;
    return this._ownedReleaseIds.has(releaseId);
  },

  /**
   * Check if current user owns a specific NFT token ID
   */
  ownsToken(nftTokenId) {
    if (!nftTokenId || !AppState.user?.address) return false;
    return this._ownedTokenIds.has(nftTokenId);
  },

  /**
   * Check if current user is the artist of a release
   */
  isArtist(releaseOrTrack) {
    if (!AppState.user?.address) return false;
    const artistAddress = releaseOrTrack?.artistAddress || releaseOrTrack?.artist_address;
    if (!artistAddress) return false;
    return artistAddress.toLowerCase() === AppState.user.address.toLowerCase();
  },

  /**
   * Get the ownership info for a track
   * Returns: { type: 'artist' | 'owner' | 'none', nftTokenId?, listed?, listPrice? }
   */
  getStatus(track, release) {
    if (!AppState.user?.address) {
      return { type: 'none' };
    }

    // Check if user is the artist
    const artistAddress = release?.artistAddress || release?.artist_address 
      || track?.artistAddress || track?.artist_address;
    if (artistAddress && artistAddress.toLowerCase() === AppState.user.address.toLowerCase()) {
      return { type: 'artist' };
    }

    // Check if user owns this track's NFT
    const trackId = track?.trackId || track?.id;
    if (trackId && this._ownedNFTs.has(trackId)) {
      const info = this._ownedNFTs.get(trackId);
      return {
        type: 'owner',
        nftTokenId: info.nftTokenId,
      };
    }

    // Check by release ID
    const releaseId = release?.id || track?.releaseId;
    if (releaseId && this._ownedReleaseIds.has(releaseId)) {
      return { type: 'owner' };
    }

    return { type: 'none' };
  },

  /**
   * Get the appropriate action button HTML for a track
   * Returns an HTML string for the button
   * 
   * @param {Object} track - Current track object
   * @param {Object} release - Release object (optional, for more context)
   * @param {Object} options - { size: 'sm'|'md'|'lg', style: 'mini'|'full' }
   */
  getActionButton(track, release = null, options = {}) {
    const { size = 'sm', style = 'mini' } = options;
    const status = this.getStatus(track, release);
    const price = track?.price || release?.songPrice || release?.price;
    const releaseId = release?.id || track?.releaseId;

    if (status.type === 'artist') {
      // Artist viewing their own track
      if (style === 'mini') {
        return `
          <button class="dnp-action-btn" onclick="if(typeof EditPriceModal!=='undefined'){
            const r=AppState.releases?.find(r=>r.id==='${releaseId}');
            if(r) EditPriceModal.show(r);
          }" title="Edit Price">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
        `;
      }
      return `
        <button class="btn btn-secondary btn-${size}" onclick="if(typeof EditPriceModal!=='undefined'){
          const r=AppState.releases?.find(r=>r.id==='${releaseId}');
          if(r) EditPriceModal.show(r);
        }">
          Edit Price
        </button>
      `;
    }

    if (status.type === 'owner') {
      // User owns this NFT
      if (style === 'mini') {
        return `
          <button class="dnp-action-btn" onclick="if(typeof Modals!=='undefined'){
            const r=AppState.releases?.find(r=>r.id==='${releaseId}');
            if(r) Modals.showRelease(r);
          }" title="You own this" style="color: var(--success); border-color: rgba(34,197,94,0.3);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Owned
          </button>
        `;
      }
      return `
        <button class="btn btn-secondary btn-${size}" style="color: var(--success); border-color: rgba(34,197,94,0.3);" onclick="if(typeof Modals!=='undefined'){
          const r=AppState.releases?.find(r=>r.id==='${releaseId}');
          if(r) Modals.showRelease(r);
        }">
          ✓ You Own This
        </button>
      `;
    }

    // Default: user doesn't own it — show Buy button
    const isExternal = track?.isExternal || (!releaseId || releaseId === 'null');
    
    if (isExternal) {
      // External NFT — no buy action on our platform
      return `
        <button class="dnp-action-btn" onclick="if(typeof Player!=='undefined') Player.openReleaseModal();" title="View NFT">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          View
        </button>
      `;
    }

    if (style === 'mini') {
      return `
        <button class="dnp-action-btn" id="dnp-buy" onclick="if(typeof Player!=='undefined') Player.openReleaseModal();" title="Buy">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          ${price ? price + ' XRP' : 'Buy'}
        </button>
      `;
    }

    return `
      <button class="btn btn-primary btn-${size}" onclick="if(typeof Player!=='undefined') Player.openReleaseModal();">
        Buy NFT${price ? ' • ' + price + ' XRP' : ''}
      </button>
    `;
  },

  /**
   * Get action button for the expanded Now Playing view
   */
  getNowPlayingButton(track, release = null) {
    return this.getActionButton(track, release, { size: 'md', style: 'full' });
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.OwnershipHelper = OwnershipHelper;
}
