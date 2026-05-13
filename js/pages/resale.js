/**
 * XRP Music - Resale Market Page
 * Secondary marketplace — peer-to-peer NFT resale listings
 *
 * Music-only filter applied (films/audiobooks/podcasts/games have dedicated pages)
 */

const ResalePage = {
  listings: [],
  searchQuery: '',
  
  _NON_MUSIC_TYPES: ['film', 'video', 'audiobook', 'podcast', 'game'],
  
  isMusicListing(listing) {
    const ct = (listing?.content_type || listing?.contentType || '').toLowerCase();
    return !this._NON_MUSIC_TYPES.includes(ct);
  },
  
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    return typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(url) : url;
  },
  
  async render() {
    UI.showLoading();
    
    try {
      const response = await fetch('/api/listings').then(r => r.json()).catch(() => ({ listings: [] }));
      const allListings = response.listings || [];
      
      // Music-only filter
      this.listings = allListings.filter(l => this.isMusicListing(l));
      
      console.log(`🔄 Resale: ${allListings.length} listings → ${this.listings.length} music`);
      
      this.renderContent();
    } catch (error) {
      console.error('Failed to load resale listings:', error);
      this.renderError();
    }
  },
  
  renderContent() {
    if (this.listings.length === 0) {
      this.renderEmpty();
      return;
    }
    
    const filtered = this.getFilteredListings();
    
    const html = `
      <div class="resale-page animate-fade-in">
        <div class="resale-header">
          <div class="resale-title-group">
            <div class="resale-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 1l4 4-4 4"></path>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <path d="M7 23l-4-4 4-4"></path>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </div>
            <div>
              <h2 class="resale-title">Resale Market</h2>
              <p class="resale-subtitle">Peer-to-peer NFT listings from collectors · ${this.listings.length} listing${this.listings.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        
        <div class="resale-search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="resale-search-input" id="resale-search" placeholder="Search resale listings..." value="${this.searchQuery}">
        </div>
        
        ${filtered.length === 0 ? `
          <div class="empty-section" style="margin-top: 24px;">No listings match your search</div>
        ` : `
          <div class="resale-grid">
            ${filtered.map(listing => this.renderListingCard(listing)).join('')}
          </div>
        `}
      </div>
      
      ${this.getStyles()}
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  getFilteredListings() {
    if (!this.searchQuery) return this.listings;
    const q = this.searchQuery.toLowerCase();
    return this.listings.filter(l => {
      const title = (l.track_title || l.release_title || '').toLowerCase();
      const artist = (l.artist_name || '').toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
  },
  
  renderListingCard(listing) {
    const title = listing.track_title || listing.release_title || 'NFT';
    const artist = listing.artist_name || 'Unknown Artist';
    const price = parseFloat(listing.price);
    const coverUrl = this.getImageUrl(listing.cover_url);
    const seller = listing.seller_address || '';
    const sellerShort = seller ? `${seller.slice(0, 6)}...${seller.slice(-4)}` : 'Unknown';
    
    return `
      <div class="resale-card" data-listing-id="${listing.id}">
        <div class="resale-cover">
          ${listing.cover_url 
            ? `<img src="${coverUrl}" alt="${title}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder">🎵</div>`
          }
          <div class="resale-price-badge">${price} XRP</div>
          <div class="resale-type-badge">Resale</div>
        </div>
        <div class="resale-info">
          <div class="resale-card-title">${title}</div>
          <div class="resale-card-artist">${artist}</div>
          <div class="resale-seller">Seller: ${sellerShort}</div>
          <button class="btn btn-primary resale-buy-btn" data-listing='${JSON.stringify(listing).replace(/'/g, "&#39;")}'>
            Buy Now · ${price} XRP
          </button>
        </div>
      </div>
    `;
  },
  
  renderEmpty() {
    UI.renderPage(`
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 1l4 4-4 4"></path>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <path d="M7 23l-4-4 4-4"></path>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <h3>No Resale Listings Yet</h3>
        <p>When collectors list their NFTs for sale, they'll appear here.</p>
        <p style="margin-top: 16px;">
          <button class="btn btn-primary" onclick="Router.navigate('stream')">Browse Music</button>
        </p>
      </div>
    `);
  },
  
  renderError() {
    UI.renderPage(`
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Failed to Load</h3>
        <p>Could not load resale listings. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="ResalePage.render()">Retry</button>
      </div>
    `);
  },
  
  bindEvents() {
    // Search input
    document.getElementById('resale-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      // Live re-render of just the grid
      const filtered = this.getFilteredListings();
      const grid = document.querySelector('.resale-grid');
      if (grid) {
        grid.innerHTML = filtered.length === 0
          ? '<div class="empty-section" style="grid-column: 1/-1;">No listings match your search</div>'
          : filtered.map(l => this.renderListingCard(l)).join('');
        this.bindBuyButtons();
      }
    });
    
    this.bindBuyButtons();
  },
  
  bindBuyButtons() {
    document.querySelectorAll('.resale-buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listingData = btn.dataset.listing.replace(/&#39;/g, "'");
        const listing = JSON.parse(listingData);
        Modals.showSecondaryPurchase(listing);
      });
    });
  },
  
  getStyles() {
    return `
      <style>
        .resale-page { padding: 0; }
        
        .resale-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .resale-title-group { display: flex; align-items: center; gap: 16px; }
        .resale-icon {
          width: 56px; height: 56px; border-radius: 14px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          display: flex; align-items: center; justify-content: center;
          color: white;
        }
        .resale-title {
          font-size: 24px; font-weight: 700;
          color: var(--text-primary); margin: 0;
        }
        .resale-subtitle {
          font-size: 13px; color: var(--text-muted);
          margin: 4px 0 0 0;
        }
        
        .resale-search-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          margin-bottom: 24px; max-width: 480px;
        }
        .resale-search-bar svg { color: var(--text-muted); flex-shrink: 0; }
        .resale-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-primary); font-size: 14px;
        }
        .resale-search-input::placeholder { color: var(--text-muted); }
        
        .resale-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }
        @media (max-width: 640px) {
          .resale-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        
        .resale-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all 200ms ease;
        }
        .resale-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .resale-cover {
          position: relative; aspect-ratio: 1;
          background: var(--bg-hover);
        }
        .resale-cover img { width: 100%; height: 100%; object-fit: cover; }
        .resale-cover .placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 48px;
        }
        .resale-price-badge {
          position: absolute; top: 10px; left: 10px;
          padding: 6px 14px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 100px;
          font-size: 14px; font-weight: 700; color: white;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
        }
        .resale-type-badge {
          position: absolute; top: 10px; right: 10px;
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.95);
          border-radius: 6px;
          font-size: 11px; font-weight: 700; color: white;
          letter-spacing: 0.5px;
        }
        
        .resale-info { padding: 14px; }
        .resale-card-title {
          font-size: 15px; font-weight: 600;
          color: var(--text-primary); margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .resale-card-artist {
          font-size: 13px; color: var(--text-muted);
          margin-bottom: 8px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .resale-seller {
          font-size: 11px; color: var(--text-muted);
          margin-bottom: 12px;
          font-family: monospace;
        }
        .resale-buy-btn {
          width: 100%;
          padding: 10px;
          font-size: 13px;
          font-weight: 600;
        }
        
        .empty-section {
          padding: 40px; text-align: center; color: var(--text-muted);
          background: var(--bg-card); border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
        }
      </style>
    `;
  },
};
