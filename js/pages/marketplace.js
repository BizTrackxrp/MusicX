/**
 * XRP Music - Marketplace Page
 * NFT marketplace with filtering and views
 * 
 * UPDATED: Uses IpfsHelper for proxied IPFS images
 * UPDATED: Recognizes lazy mint releases (mintFeePaid/status='live') as "for sale"
 */

const MarketplacePage = {
  releases: [],
  secondaryListings: [],
  viewMode: 'grid',
  activeTab: 'all',
  marketType: 'primary', // 'primary' or 'secondary'
  
  // Helper to get proxied image URL
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },
  
  /**
   * Check if a release is "for sale" (available for purchase)
   * With lazy minting, a release is for sale if:
   * - It has a sellOfferIndex (traditional pre-minted), OR
   * - It has mintFeePaid = true (lazy mint), OR
   * - It has status = 'live' (lazy mint)
   */
  isForSale(release) {
    return release.sellOfferIndex || release.mintFeePaid || release.status === 'live';
  },
  
  /**
   * Render marketplace page
   */
  async render() {
    UI.showLoading();
    
    try {
      // Add timeout to prevent infinite loading
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      // Fetch both primary releases and secondary listings
      const [releases, listingsResponse] = await Promise.all([
        Promise.race([API.getReleases(), timeout]),
        fetch('/api/listings').then(r => r.json()).catch(() => ({ listings: [] })),
      ]);
      
      this.releases = releases;
      this.secondaryListings = listingsResponse.listings || [];
      setReleases(this.releases);
      this.renderContent();
    } catch (error) {
      console.error('Failed to load releases:', error);
      this.renderError();
    }
  },
  
  /**
   * Render main content
   */
  renderContent() {
    const filteredReleases = this.getFilteredReleases();
    const availableReleases = filteredReleases.filter(r => (r.totalEditions - r.soldEditions) > 0);
    const soldOutReleases = filteredReleases.filter(r => (r.totalEditions - r.soldEditions) === 0);
    
    const html = `
      <div class="marketplace-page animate-fade-in">
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px;">
          <h2 class="section-title" style="margin-bottom: 0;">NFT Marketplace</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-ghost btn-sm view-mode-btn ${this.viewMode === 'grid' ? 'active' : ''}" data-view="grid">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm view-mode-btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Market Type Tabs -->
        <div class="market-type-tabs">
          <button class="market-type-btn ${this.marketType === 'primary' ? 'active' : ''}" data-market="primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
            From Artists
            <span class="market-count">${availableReleases.length}</span>
          </button>
          <button class="market-type-btn ${this.marketType === 'secondary' ? 'active' : ''}" data-market="secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 1l4 4-4 4"></path>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <path d="M7 23l-4-4 4-4"></path>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            Resale Market
            <span class="market-count">${this.secondaryListings.length}</span>
          </button>
        </div>
        
        ${this.marketType === 'primary' ? `
          <!-- Primary Market Tabs -->
          <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 24px; overflow-x: auto;">
            <button class="tab-btn ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all">Available</button>
            <button class="tab-btn ${this.activeTab === 'singles' ? 'active' : ''}" data-tab="singles">Singles</button>
            <button class="tab-btn ${this.activeTab === 'albums' ? 'active' : ''}" data-tab="albums">Albums</button>
            <button class="tab-btn ${this.activeTab === 'soldout' ? 'active' : ''}" data-tab="soldout">
              Sold Out
              <span style="margin-left: 4px; padding: 2px 6px; background: var(--bg-hover); border-radius: 8px; font-size: 11px;">${soldOutReleases.length}</span>
            </button>
          </div>
          
          <!-- Primary Content -->
          ${this.activeTab === 'soldout' 
            ? (soldOutReleases.length === 0 ? this.renderEmptyState('No sold out releases yet') : this.renderReleases(soldOutReleases))
            : (availableReleases.length === 0 ? this.renderEmptyState() : this.renderReleases(this.activeTab === 'all' ? availableReleases : availableReleases.filter(r => this.activeTab === 'singles' ? r.type === 'single' : r.type !== 'single')))}
        ` : `
          <!-- Secondary Market Content -->
          <div style="margin-bottom: 24px;">
            <input type="text" class="form-input" id="secondary-search" placeholder="Search resale listings..." style="max-width: 400px;">
          </div>
          ${this.secondaryListings.length === 0 
            ? this.renderEmptyState('No resale listings yet. When collectors list their NFTs for sale, they appear here.')
            : this.renderSecondaryListings()}
        `}
      </div>
      
      <style>
        .market-type-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .market-type-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .market-type-btn:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }
        .market-type-btn.active {
          border-color: var(--accent);
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent);
        }
        .market-count {
          padding: 2px 8px;
          background: var(--bg-hover);
          border-radius: 100px;
          font-size: 12px;
        }
        .market-type-btn.active .market-count {
          background: var(--accent);
          color: white;
        }
        .tab-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 12px 12px 0 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms ease;
          white-space: nowrap;
        }
        .tab-btn:hover {
          color: var(--text-secondary);
        }
        .tab-btn.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .view-mode-btn.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .secondary-listing-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .secondary-listing-card:hover {
          border-color: var(--accent);
          transform: translateY(-4px);
        }
        .secondary-cover {
          position: relative;
          aspect-ratio: 1;
          background: var(--bg-hover);
        }
        .secondary-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .secondary-price {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
          color: white;
        }
        .secondary-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 8px;
          background: rgba(139, 92, 246, 0.9);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }
        .secondary-info {
          padding: 12px;
        }
        .secondary-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .secondary-artist {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .secondary-seller {
          font-size: 11px;
          color: var(--text-muted);
        }
        .secondary-buy-btn {
          width: 100%;
          margin-top: 8px;
        }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * Render secondary market listings
   */
  renderSecondaryListings() {
    return `
      <div class="release-grid">
        ${this.secondaryListings.map(listing => this.renderSecondaryCard(listing)).join('')}
      </div>
    `;
  },
  
  /**
   * Render a secondary listing card
   */
  renderSecondaryCard(listing) {
    const title = listing.track_title || listing.release_title || 'NFT';
    const artist = listing.artist_name || 'Unknown Artist';
    const price = parseFloat(listing.price);
    const coverUrl = this.getImageUrl(listing.cover_url);
    
    return `
      <div class="secondary-listing-card" data-listing-id="${listing.id}">
        <div class="secondary-cover">
          ${listing.cover_url 
            ? `<img src="${coverUrl}" alt="${title}" onerror="this.src='/placeholder.png'">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;">🎵</div>`
          }
          <div class="secondary-price">${price} XRP</div>
          <div class="secondary-badge">Resale</div>
        </div>
        <div class="secondary-info">
          <div class="secondary-title">${title}</div>
          <div class="secondary-artist">${artist}</div>
          <div class="secondary-seller">Seller: ${listing.seller_address.slice(0, 6)}...${listing.seller_address.slice(-4)}</div>
          <button class="btn btn-primary btn-sm secondary-buy-btn" data-listing='${JSON.stringify(listing).replace(/'/g, "\\'")}'>
            Buy Now
          </button>
        </div>
      </div>
    `;
  },
  
  /**
   * Render releases based on view mode
   */
  renderReleases(releases) {
    if (this.viewMode === 'grid') {
      return `
        <div class="release-grid">
          ${releases.map(release => this.renderGridCard(release)).join('')}
        </div>
      `;
    } else {
      return `
        <div class="track-list">
          ${releases.map(release => this.renderListItem(release)).join('')}
        </div>
      `;
    }
  },
  
  /**
   * Render grid card
   */
  renderGridCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    const coverUrl = this.getImageUrl(release.coverUrl);
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover" style="${isSoldOut ? 'opacity: 0.5;' : ''}">
          ${release.coverUrl 
            ? `<img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
          <span class="release-availability">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          ${isSoldOut ? `
            <div class="release-sold-out">
              <span>SOLD OUT</span>
            </div>
          ` : `
            <div class="release-play-overlay">
              <button class="release-play-btn" data-release-id="${release.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            </div>
          `}
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title}</div>
          <div class="release-card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            <span class="release-card-tracks">${release.tracks?.length || 0} track${release.tracks?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Render list item
   */
  renderListItem(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    const coverUrl = this.getImageUrl(release.coverUrl);
    
    return `
      <div class="track-item" data-release-id="${release.id}" style="${isSoldOut ? 'opacity: 0.6;' : ''}">
        <div class="track-cover" style="position: relative;">
          <img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">
          ${!isSoldOut ? `
            <div class="release-play-overlay" style="border-radius: var(--radius-md);">
              <button class="release-play-btn" data-release-id="${release.id}" style="width: 36px; height: 36px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="track-info">
          <div class="track-title" style="display: flex; align-items: center; gap: 8px;">
            ${release.title}
            <span style="padding: 2px 8px; background: ${release.type === 'album' ? '#a855f7' : 'var(--success)'}20; color: ${release.type === 'album' ? '#a855f7' : 'var(--success)'}; font-size: 10px; font-weight: 600; border-radius: 4px; text-transform: uppercase;">
              ${release.type}
            </span>
          </div>
          <div class="track-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
        </div>
        <div class="track-meta">
          <div style="text-align: right;">
            <div class="track-price">${price} XRP</div>
            <div class="track-availability ${available < 10 ? 'low' : ''}" style="color: ${isSoldOut ? 'var(--error)' : ''}">
              ${isSoldOut ? 'Sold Out' : `${available} left`}
            </div>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Render empty state
   */
  renderEmptyState(message) {
    return `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <h3>No Releases For Sale</h3>
        <p>${message || (this.activeTab === 'all' 
          ? 'No music is currently listed for sale. Check back soon!' 
          : `No ${this.activeTab} listed for sale yet.`)}</p>
      </div>
    `;
  },
  
  /**
   * Render error state
   */
  renderError() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Failed to Load</h3>
        <p>There was an error loading the marketplace. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="MarketplacePage.render()">
          Retry
        </button>
      </div>
    `;
    
    UI.renderPage(html);
  },
  
  /**
   * Get filtered releases
   * NOW RECOGNIZES LAZY MINT RELEASES!
   */
  getFilteredReleases() {
    // Show releases that are for sale:
    // - Has sellOfferIndex (traditional pre-minted), OR
    // - Has mintFeePaid = true (lazy mint), OR  
    // - Has status = 'live' (lazy mint)
    const listedReleases = this.releases.filter(r => this.isForSale(r));
    
    if (this.activeTab === 'all') return listedReleases;
    if (this.activeTab === 'singles') return listedReleases.filter(r => r.type === 'single');
    if (this.activeTab === 'albums') return listedReleases.filter(r => r.type === 'album');
    if (this.activeTab === 'soldout') return listedReleases.filter(r => (r.totalEditions - r.soldEditions) <= 0);
    return listedReleases;
  },
  
  /**
   * Bind events
   */
  bindEvents() {
    // Market type toggle (Primary / Secondary)
    document.querySelectorAll('.market-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.marketType = btn.dataset.market;
        this.activeTab = 'all';
        this.renderContent();
      });
    });
    
    // View mode toggle
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.viewMode = btn.dataset.view;
        this.renderContent();
      });
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.renderContent();
      });
    });
    
    // Release cards/items - click to open modal
    document.querySelectorAll('.release-card, .track-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        
        const releaseId = item.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
        }
      });
    });
    
    // Play buttons
    document.querySelectorAll('.release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release && release.tracks?.length > 0) {
          StreamPage.playRelease(release);
        }
      });
    });
    
    // Secondary market buy buttons
    document.querySelectorAll('.secondary-buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listing = JSON.parse(btn.dataset.listing);
        Modals.showSecondaryPurchase(listing);
      });
    });
    
    // Secondary search
    document.getElementById('secondary-search')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.secondary-listing-card').forEach(card => {
        const title = card.querySelector('.secondary-title')?.textContent.toLowerCase() || '';
        const artist = card.querySelector('.secondary-artist')?.textContent.toLowerCase() || '';
        card.style.display = (title.includes(query) || artist.includes(query)) ? '' : 'none';
      });
    });
  },
};
