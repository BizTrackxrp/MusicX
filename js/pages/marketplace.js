/**
 * XRP Music - Marketplace Page
 * NFT marketplace with featured sections and analytics
 * 
 * SECTIONS:
 * 1. Top Selling - Most sales in last 7 days
 * 2. Newest Drops - Most recently released
 * 3. Get Them Before They're Gone - Fewest copies remaining
 * 
 * UPDATED: Recognizes lazy mint releases (mintFeePaid/status='live')
 */

const MarketplacePage = {
  releases: [],
  secondaryListings: [],
  viewMode: 'featured', // 'featured', 'all', 'analytics'
  analyticsSort: 'top-selling', // 'top-selling', 'newest', 'scarce'
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
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
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
   * Get releases that are for sale and have availability
   */
  getAvailableReleases() {
    return this.releases.filter(r => 
      this.isForSale(r) && (r.totalEditions - r.soldEditions) > 0
    );
  },
  
  /**
   * Get top selling releases (most sales)
   */
  getTopSelling(limit = 5) {
    return [...this.getAvailableReleases()]
      .sort((a, b) => (b.soldEditions || 0) - (a.soldEditions || 0))
      .slice(0, limit);
  },
  
  /**
   * Get newest drops (most recent first)
   */
  getNewestDrops(limit = 5) {
    return [...this.getAvailableReleases()]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },
  
  /**
   * Get scarce releases (fewest copies remaining)
   */
  getScarceReleases(limit = 5) {
    return [...this.getAvailableReleases()]
      .map(r => ({
        ...r,
        remaining: r.totalEditions - r.soldEditions
      }))
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, limit);
  },
  
  /**
   * Render main content
   */
  renderContent() {
    const available = this.getAvailableReleases();
    
    const html = `
      <div class="marketplace-page animate-fade-in">
        <!-- Header -->
        <div class="marketplace-header">
          <h2 class="section-title">NFT Marketplace</h2>
          <div class="market-type-tabs">
            <button class="market-type-btn ${this.marketType === 'primary' ? 'active' : ''}" data-market="primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              From Artists
              <span class="market-count">${available.length}</span>
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
        </div>
        
        ${this.marketType === 'primary' ? this.renderPrimaryMarket() : this.renderSecondaryMarket()}
      </div>
      
      ${this.getMarketplaceStyles()}
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * Render primary market with featured sections or analytics view
   */
  renderPrimaryMarket() {
    if (this.viewMode === 'analytics') {
      return this.renderAnalyticsView();
    }
    
    const topSelling = this.getTopSelling(5);
    const newestDrops = this.getNewestDrops(5);
    const scarce = this.getScarceReleases(5);
    
    return `
      <!-- Top Selling Section -->
      <section class="featured-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon hot">🔥</div>
            <div>
              <h3 class="section-name">Top Selling</h3>
              <p class="section-subtitle">Most popular releases</p>
            </div>
          </div>
          <button class="view-all-btn" data-view="top-selling">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="featured-grid">
          ${topSelling.length > 0 
            ? topSelling.map((r, i) => this.renderFeaturedCard(r, i + 1, 'sales')).join('')
            : '<div class="empty-section">No sales yet - be the first to buy!</div>'
          }
        </div>
      </section>
      
      <!-- Newest Drops Section -->
      <section class="featured-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon new">✨</div>
            <div>
              <h3 class="section-name">Newest Drops</h3>
              <p class="section-subtitle">Fresh releases from artists</p>
            </div>
          </div>
          <button class="view-all-btn" data-view="newest">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="featured-grid">
          ${newestDrops.length > 0 
            ? newestDrops.map((r, i) => this.renderFeaturedCard(r, i + 1, 'date')).join('')
            : '<div class="empty-section">No releases yet</div>'
          }
        </div>
      </section>
      
      <!-- Scarce Section -->
      <section class="featured-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon scarce">⚡</div>
            <div>
              <h3 class="section-name">Get Them Before They're Gone</h3>
              <p class="section-subtitle">Limited copies remaining</p>
            </div>
          </div>
          <button class="view-all-btn" data-view="scarce">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="featured-grid">
          ${scarce.length > 0 
            ? scarce.map((r, i) => this.renderFeaturedCard(r, i + 1, 'scarce')).join('')
            : '<div class="empty-section">All releases have plenty of copies</div>'
          }
        </div>
      </section>
    `;
  },
  
  /**
   * Render analytics/list view for "View All"
   */
  renderAnalyticsView() {
    let releases = this.getAvailableReleases();
    let sortLabel = '';
    let sortIcon = '';
    
    switch (this.analyticsSort) {
      case 'top-selling':
        releases = releases.sort((a, b) => (b.soldEditions || 0) - (a.soldEditions || 0));
        sortLabel = 'Top Selling';
        sortIcon = '🔥';
        break;
      case 'newest':
        releases = releases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sortLabel = 'Newest Drops';
        sortIcon = '✨';
        break;
      case 'scarce':
        releases = releases.sort((a, b) => 
          (a.totalEditions - a.soldEditions) - (b.totalEditions - b.soldEditions)
        );
        sortLabel = 'Most Scarce';
        sortIcon = '⚡';
        break;
    }
    
    return `
      <div class="analytics-view">
        <div class="analytics-header">
          <button class="back-btn" id="back-to-featured">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </button>
          <h3 class="analytics-title">${sortIcon} ${sortLabel}</h3>
          <div class="analytics-sort-tabs">
            <button class="sort-tab ${this.analyticsSort === 'top-selling' ? 'active' : ''}" data-sort="top-selling">🔥 Top Selling</button>
            <button class="sort-tab ${this.analyticsSort === 'newest' ? 'active' : ''}" data-sort="newest">✨ Newest</button>
            <button class="sort-tab ${this.analyticsSort === 'scarce' ? 'active' : ''}" data-sort="scarce">⚡ Scarce</button>
          </div>
        </div>
        
        <div class="analytics-table">
          <div class="table-header">
            <span class="col-rank">#</span>
            <span class="col-cover"></span>
            <span class="col-title">Title</span>
            <span class="col-artist">Artist</span>
            <span class="col-price">Price</span>
            <span class="col-sold">Sold</span>
            <span class="col-remaining">Left</span>
            <span class="col-date">Dropped</span>
          </div>
          <div class="table-body">
            ${releases.map((r, i) => this.renderAnalyticsRow(r, i + 1)).join('')}
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Render a featured card for the grid sections
   */
  renderFeaturedCard(release, rank, type) {
    const available = release.totalEditions - release.soldEditions;
    const price = release.albumPrice || release.songPrice;
    const coverUrl = this.getImageUrl(release.coverUrl);
    const soldPercent = Math.round((release.soldEditions / release.totalEditions) * 100);
    
    // Badge content based on type
    let badge = '';
    if (type === 'sales') {
      badge = `<span class="card-badge sales">${release.soldEditions} sold</span>`;
    } else if (type === 'date') {
      const date = new Date(release.createdAt);
      const isNew = (Date.now() - date.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 days
      badge = `<span class="card-badge date ${isNew ? 'new' : ''}">${isNew ? 'NEW' : this.formatDate(date)}</span>`;
    } else if (type === 'scarce') {
      const urgency = available <= 5 ? 'critical' : available <= 20 ? 'low' : '';
      badge = `<span class="card-badge scarce ${urgency}">${available} left</span>`;
    }
    
    return `
      <div class="featured-card" data-release-id="${release.id}">
        <div class="featured-card-cover">
          ${release.coverUrl 
            ? `<img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder">🎵</div>`
          }
          <span class="rank-badge rank-${rank}">#${rank}</span>
          ${badge}
          <div class="card-overlay">
            <button class="play-btn" data-release-id="${release.id}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          </div>
        </div>
        <div class="featured-card-info">
          <div class="card-title">${release.title}</div>
          <div class="card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="card-footer">
            <span class="card-price">${price} XRP</span>
            <div class="card-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${soldPercent}%"></div>
              </div>
              <span class="progress-text">${soldPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Render analytics table row
   */
  renderAnalyticsRow(release, rank) {
    const available = release.totalEditions - release.soldEditions;
    const price = release.albumPrice || release.songPrice;
    const coverUrl = this.getImageUrl(release.coverUrl);
    const date = new Date(release.createdAt);
    
    return `
      <div class="table-row" data-release-id="${release.id}">
        <span class="col-rank">${rank}</span>
        <span class="col-cover">
          <img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">
        </span>
        <span class="col-title">
          <div class="title-text">${release.title}</div>
          <span class="type-badge ${release.type}">${release.type}</span>
        </span>
        <span class="col-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</span>
        <span class="col-price">${price} XRP</span>
        <span class="col-sold">${release.soldEditions || 0}</span>
        <span class="col-remaining ${available <= 10 ? 'low' : ''}">${available}</span>
        <span class="col-date">${this.formatDate(date)}</span>
      </div>
    `;
  },
  
  /**
   * Render secondary market
   */
  renderSecondaryMarket() {
    return `
      <div style="margin-bottom: 24px;">
        <input type="text" class="form-input" id="secondary-search" placeholder="Search resale listings..." style="max-width: 400px;">
      </div>
      ${this.secondaryListings.length === 0 
        ? this.renderEmptyState('No resale listings yet. When collectors list their NFTs for sale, they appear here.')
        : `<div class="release-grid">${this.secondaryListings.map(listing => this.renderSecondaryCard(listing)).join('')}</div>`
      }
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
   * Format date for display
   */
  formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        <p>${message || 'No music is currently listed for sale. Check back soon!'}</p>
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
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="MarketplacePage.render()">Retry</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  /**
   * Get all styles
   */
  getMarketplaceStyles() {
    return `
      <style>
        .marketplace-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 32px;
        }
        
        .market-type-tabs {
          display: flex;
          gap: 12px;
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
        
        /* Featured Sections */
        .featured-section {
          margin-bottom: 40px;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .section-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .section-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .section-icon.hot {
          background: linear-gradient(135deg, #f97316, #ef4444);
        }
        .section-icon.new {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
        }
        .section-icon.scarce {
          background: linear-gradient(135deg, #eab308, #f59e0b);
        }
        .section-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .section-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin: 2px 0 0 0;
        }
        .view-all-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }
        .view-all-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        
        /* Featured Grid */
        .featured-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .featured-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 900px) {
          .featured-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        
        /* Featured Card */
        .featured-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all 200ms ease;
        }
        .featured-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .featured-card-cover {
          position: relative;
          aspect-ratio: 1;
          background: var(--bg-hover);
        }
        .featured-card-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rank-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 800;
          border-radius: 6px;
          color: white;
          z-index: 2;
        }
        .rank-badge.rank-1 { background: linear-gradient(135deg, #ffd700, #ffaa00); }
        .rank-badge.rank-2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); }
        .rank-badge.rank-3 { background: linear-gradient(135deg, #cd7f32, #b87333); }
        .rank-badge.rank-4, .rank-badge.rank-5 { background: rgba(59, 130, 246, 0.9); }
        
        .card-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          color: white;
        }
        .card-badge.sales { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .card-badge.date { background: rgba(139, 92, 246, 0.9); }
        .card-badge.date.new { background: linear-gradient(135deg, #8b5cf6, #6366f1); animation: pulse 2s infinite; }
        .card-badge.scarce { background: rgba(234, 179, 8, 0.9); }
        .card-badge.scarce.low { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .card-badge.scarce.critical { background: linear-gradient(135deg, #ef4444, #dc2626); animation: pulse 1.5s infinite; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 200ms;
        }
        .featured-card:hover .card-overlay { opacity: 1; }
        .play-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 150ms;
        }
        .play-btn:hover { transform: scale(1.1); }
        
        .featured-card-info {
          padding: 12px;
        }
        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-artist {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .card-price {
          font-size: 14px;
          font-weight: 700;
          color: var(--success);
        }
        .card-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          max-width: 80px;
        }
        .progress-bar {
          flex: 1;
          height: 4px;
          background: var(--bg-hover);
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
        }
        .progress-text {
          font-size: 10px;
          color: var(--text-muted);
        }
        
        .empty-section {
          grid-column: 1 / -1;
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
          background: var(--bg-card);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
        }
        
        /* Analytics View */
        .analytics-view {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }
        .analytics-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: var(--bg-hover);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .back-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .analytics-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          flex: 1;
        }
        .analytics-sort-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .sort-tab {
          padding: 8px 14px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }
        .sort-tab:hover { color: var(--text-primary); }
        .sort-tab.active {
          background: var(--accent);
          color: white;
        }
        
        /* Analytics Table */
        .analytics-table {
          overflow-x: auto;
        }
        .table-header {
          display: grid;
          grid-template-columns: 50px 50px 2fr 1.5fr 80px 60px 60px 100px;
          gap: 12px;
          padding: 12px 20px;
          background: var(--bg-hover);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .table-row {
          display: grid;
          grid-template-columns: 50px 50px 2fr 1.5fr 80px 60px 60px 100px;
          gap: 12px;
          padding: 12px 20px;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 150ms;
        }
        .table-row:hover { background: var(--bg-hover); }
        .table-row:last-child { border-bottom: none; }
        
        .col-rank {
          font-weight: 700;
          color: var(--text-muted);
        }
        .col-cover img {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: cover;
        }
        .col-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .title-text {
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .type-badge {
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .type-badge.single { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .type-badge.album { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
        
        .col-artist {
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-price { font-weight: 600; color: var(--success); }
        .col-sold { font-weight: 600; color: var(--text-primary); }
        .col-remaining { font-weight: 600; color: var(--text-primary); }
        .col-remaining.low { color: var(--warning); }
        .col-date { color: var(--text-muted); font-size: 12px; }
        
        @media (max-width: 900px) {
          .table-header, .table-row {
            grid-template-columns: 40px 40px 1.5fr 1fr 70px 50px 50px;
          }
          .col-date { display: none; }
        }
        @media (max-width: 640px) {
          .table-header, .table-row {
            grid-template-columns: 30px 36px 1fr 60px 50px;
          }
          .col-artist, .col-remaining { display: none; }
          .analytics-sort-tabs { width: 100%; }
          .sort-tab { flex: 1; text-align: center; font-size: 11px; padding: 8px 8px; }
        }
        
        /* Secondary Market Styles */
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
        .secondary-info { padding: 12px; }
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
        .secondary-seller { font-size: 11px; color: var(--text-muted); }
        .secondary-buy-btn { width: 100%; margin-top: 8px; }
      </style>
    `;
  },
  
  /**
   * Bind events
   */
  bindEvents() {
    // Market type toggle
    document.querySelectorAll('.market-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.marketType = btn.dataset.market;
        this.viewMode = 'featured';
        this.renderContent();
      });
    });
    
    // View All buttons
    document.querySelectorAll('.view-all-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.analyticsSort = btn.dataset.view;
        this.viewMode = 'analytics';
        this.renderContent();
      });
    });
    
    // Back button
    document.getElementById('back-to-featured')?.addEventListener('click', () => {
      this.viewMode = 'featured';
      this.renderContent();
    });
    
    // Sort tabs in analytics view
    document.querySelectorAll('.sort-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.analyticsSort = tab.dataset.sort;
        this.renderContent();
      });
    });
    
    // Featured cards - click to open modal
    document.querySelectorAll('.featured-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-btn')) return;
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // Play buttons
    document.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release?.tracks?.length > 0) {
          StreamPage.playRelease(release);
        }
      });
    });
    
    // Table rows - click to open modal
    document.querySelectorAll('.table-row').forEach(row => {
      row.addEventListener('click', () => {
        const releaseId = row.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
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
