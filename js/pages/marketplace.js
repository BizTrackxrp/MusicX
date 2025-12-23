/**
 * XRP Music - Marketplace Page
 * NFT marketplace with filtering and views
 */

const MarketplacePage = {
  releases: [],
  viewMode: 'grid',
  activeTab: 'all',
  
  /**
   * Render marketplace page
   */
  async render() {
    UI.showLoading();
    
    try {
      this.releases = await API.getReleases();
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
        
        <!-- Tabs -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 24px; overflow-x: auto;">
          <button class="tab-btn ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all">All Releases</button>
          <button class="tab-btn ${this.activeTab === 'singles' ? 'active' : ''}" data-tab="singles">Singles</button>
          <button class="tab-btn ${this.activeTab === 'albums' ? 'active' : ''}" data-tab="albums">Albums</button>
        </div>
        
        <!-- Content -->
        ${filteredReleases.length === 0 ? this.renderEmptyState() : this.renderReleases(filteredReleases)}
      </div>
      
      <style>
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
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
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
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover" style="${isSoldOut ? 'opacity: 0.5;' : ''}">
          ${release.coverUrl 
            ? `<img src="${release.coverUrl}" alt="${release.title}">`
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
    
    return `
      <div class="track-item" data-release-id="${release.id}" style="${isSoldOut ? 'opacity: 0.6;' : ''}">
        <div class="track-cover" style="position: relative;">
          <img src="${release.coverUrl || '/placeholder.png'}" alt="${release.title}">
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
  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <h3>No Releases For Sale</h3>
        <p>${this.activeTab === 'all' 
          ? 'No music is currently listed for sale. Check back soon!' 
          : `No ${this.activeTab} listed for sale yet.`}</p>
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
   */
  getFilteredReleases() {
    // Only show releases that are listed for sale (have sellOfferIndex)
    const listedReleases = this.releases.filter(r => r.sellOfferIndex);
    
    if (this.activeTab === 'all') return listedReleases;
    if (this.activeTab === 'singles') return listedReleases.filter(r => r.type === 'single');
    if (this.activeTab === 'albums') return listedReleases.filter(r => r.type === 'album');
    return listedReleases;
  },
  
  /**
   * Bind events
   */
  bindEvents() {
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
  },
};
