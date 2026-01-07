/**
 * XRP Music - Profile Page
 * User profile with releases, collection, genres, and settings
 */

const ProfilePage = {
  releases: [],
  activeTab: 'posted',
  
  // Genre definitions (must match modals.js)
  genres: [
    { id: 'hiphop', name: 'Hip Hop', color: '#f97316' },
    { id: 'rap', name: 'Rap', color: '#ef4444' },
    { id: 'electronic', name: 'Electronic', color: '#3b82f6' },
    { id: 'rnb', name: 'R&B', color: '#a855f7' },
    { id: 'pop', name: 'Pop', color: '#ec4899' },
    { id: 'rock', name: 'Rock', color: '#84cc16' },
    { id: 'country', name: 'Country', color: '#f59e0b' },
    { id: 'jazz', name: 'Jazz', color: '#06b6d4' },
    { id: 'lofi', name: 'Lo-Fi', color: '#8b5cf6' },
    { id: 'other', name: 'Other', color: '#6b7280' },
  ],
  
  async render() {
    if (!AppState.user?.address) {
      this.renderNotLoggedIn();
      return;
    }
    
    UI.showLoading();
    
    try {
      // Add timeout to prevent infinite loading
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const [releases, profile] = await Promise.race([
        Promise.all([
          API.getReleasesByArtist(AppState.user.address),
          API.getProfile(AppState.user.address)
        ]),
        timeout
      ]);
      
      this.releases = releases;
      if (profile) {
        setProfile(profile);
      }
      
      this.renderContent();
    } catch (error) {
      console.error('Failed to load profile:', error);
      this.renderError();
    }
  },
  
  renderNotLoggedIn() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
        <h3>Connect Your Wallet</h3>
        <p>Connect your Xaman wallet to view your profile.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="Modals.showAuth()">Connect Wallet</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  getGenreInfo(id) {
    return this.genres.find(g => g.id === id) || null;
  },
  
  renderGenreBadges(profile) {
    // Only show genres if user is an artist
    if (!profile.isArtist) return '';
    
    const badges = [];
    
    if (profile.genrePrimary) {
      const genre = this.getGenreInfo(profile.genrePrimary);
      if (genre) {
        badges.push(`<span class="profile-genre-badge" style="--genre-color: ${genre.color}">${genre.name}</span>`);
      }
    }
    
    if (profile.genreSecondary) {
      const genre = this.getGenreInfo(profile.genreSecondary);
      if (genre) {
        badges.push(`<span class="profile-genre-badge" style="--genre-color: ${genre.color}">${genre.name}</span>`);
      }
    }
    
    if (badges.length === 0) return '';
    
    return `<div class="profile-genres">${badges.join('')}</div>`;
  },
  
  renderContent() {
    const profile = AppState.profile || {};
    const displayName = getDisplayName();
    const address = AppState.user.address;
    
    // Set default tab based on whether user is an artist
    const isArtist = profile.isArtist || this.releases.length > 0;
    if (!isArtist && this.activeTab === 'posted') {
      this.activeTab = 'collected';
    }
    
    const html = `
      <div class="profile-page animate-fade-in">
        <!-- Banner -->
        <div class="profile-banner">
          ${profile.bannerUrl ? `<img src="${profile.bannerUrl}" alt="Banner">` : ''}
        </div>
        
        <!-- Profile Card -->
        <div class="profile-card">
          <div class="profile-avatar">
            ${profile.avatarUrl 
              ? `<img src="${profile.avatarUrl}" alt="Avatar">`
              : `<span>${getUserInitial()}</span>`
            }
          </div>
          
          <div class="profile-info">
            <h1 class="profile-name">${displayName}</h1>
            ${this.renderGenreBadges(profile)}
            <p class="profile-address">${Helpers.truncateAddress(address, 8, 6)}</p>
            ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}
            
            <div class="profile-links">
              ${profile.website ? `
                <a href="${profile.website}" target="_blank" class="profile-website">${profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
              ` : ''}
              ${profile.twitter ? `
                <a href="https://twitter.com/${profile.twitter}" target="_blank" class="profile-social-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  @${profile.twitter}
                </a>
              ` : ''}
            </div>
          </div>
          
          <button class="btn btn-secondary" id="edit-profile-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Profile
          </button>
        </div>
        
        <!-- Tabs -->
        <div class="profile-tabs">
          ${profile.isArtist || this.releases.length > 0 ? `
            <button class="tab-btn ${this.activeTab === 'posted' ? 'active' : ''}" data-tab="posted">
              My Releases
              <span class="tab-count">${this.releases.length}</span>
            </button>
          ` : ''}
          <button class="tab-btn ${this.activeTab === 'collected' ? 'active' : ''}" data-tab="collected">
            ${profile.isArtist || this.releases.length > 0 ? 'Collected' : 'My Collection'}
            <span class="tab-count" id="collected-count">...</span>
          </button>
          <button class="tab-btn ${this.activeTab === 'forsale' ? 'active' : ''}" data-tab="forsale">
            For Sale
            <span class="tab-count" id="forsale-count">0</span>
          </button>
        </div>
        
        <!-- Tab Content -->
        <div class="profile-tab-content">
          ${this.activeTab === 'posted' ? this.renderPostedTab() : 
            this.activeTab === 'forsale' ? this.renderForSaleTab() :
            this.renderCollectedTab()}
        </div>
      </div>
      
      <style>
        .profile-banner {
          height: 200px;
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          border-radius: var(--radius-xl);
          overflow: hidden;
          position: relative;
        }
        .profile-banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
        }
        .profile-card {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          padding: 0 24px;
          margin-top: 20px;
          margin-bottom: 32px;
        }
        @media (max-width: 640px) {
          .profile-card {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0 16px;
          }
        }
        .profile-avatar {
          width: 156px;
          height: 156px;
          border-radius: 50%;
          border: 5px solid var(--bg-primary);
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 52px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-info {
          flex: 1;
          min-width: 0;
          padding-top: 8px;
        }
        .profile-name {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .profile-genres {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .profile-genres {
            justify-content: center;
          }
        }
        .profile-genre-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 14px;
          background: color-mix(in srgb, var(--genre-color) 15%, transparent);
          border: 1.5px solid var(--genre-color);
          border-radius: 16px;
          font-size: 11px;
          font-weight: 600;
          color: var(--genre-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .profile-address {
          color: var(--text-muted);
          font-size: 14px;
          margin-bottom: 10px;
        }
        .profile-bio {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 14px;
          line-height: 1.5;
          max-width: 500px;
        }
        .profile-links {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .profile-links {
            justify-content: center;
          }
        }
        .profile-website {
          color: var(--accent);
          font-size: 14px;
          text-decoration: none;
          transition: opacity 150ms;
        }
        .profile-website:hover {
          opacity: 0.8;
          text-decoration: underline;
        }
        .profile-social-link {
          color: var(--text-muted);
          transition: color 150ms;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          text-decoration: none;
        }
        .profile-social-link:hover {
          color: var(--accent);
        }
        .profile-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--border-color);
          padding: 0 24px 4px;
          margin-bottom: 24px;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 12px 12px 0 0;
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }
        .tab-btn:hover {
          color: var(--text-secondary);
        }
        .tab-btn.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .tab-count {
          padding: 2px 8px;
          background: var(--bg-hover);
          border-radius: 10px;
          font-size: 12px;
        }
        .profile-tab-content {
          padding: 0 24px;
        }
        
        /* Listing Status Styles */
        .listing-status-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .listing-status-badge.red {
          background: rgba(239, 68, 68, 0.9);
          color: white;
        }
        .listing-status-badge.green {
          background: rgba(34, 197, 94, 0.9);
          color: white;
        }
        .listing-status-badge.gold {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }
        
        /* Card overlay states */
        .release-card.not-listed .release-card-cover::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(239, 68, 68, 0.15);
          border-radius: inherit;
          pointer-events: none;
        }
        .release-card.sold-out .release-card-cover::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1));
          border-radius: inherit;
          pointer-events: none;
        }
        
        /* Listing overlay for "List Now" button */
        .listing-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          border-radius: inherit;
          opacity: 0;
          transition: opacity 200ms;
        }
        .release-card.not-listed:hover .listing-overlay {
          opacity: 1;
        }
        .list-now-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 150ms, background 150ms;
        }
        .list-now-btn:hover {
          background: var(--accent-hover);
          transform: scale(1.05);
        }
        
        /* Listing card action buttons */
        .listing-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .listing-card-actions .btn {
          flex: 1;
          justify-content: center;
        }
        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }
        .listing-price-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 10px;
          background: rgba(34, 197, 94, 0.9);
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  renderPostedTab() {
    if (this.releases.length === 0) {
      return `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <h3>No Releases Yet</h3>
          <p>Create your first release and start selling your music as NFTs!</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="Modals.showCreate()">Create Release</button>
        </div>
      `;
    }
    
    // Count unlisted releases
    const unlistedCount = this.releases.filter(r => !r.sellOfferIndex && (r.totalEditions - r.soldEditions) > 0).length;
    
    return `
      ${unlistedCount > 0 ? `
        <div class="list-all-banner">
          <div class="list-all-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span><strong>${unlistedCount}</strong> release${unlistedCount > 1 ? 's' : ''} not listed for sale</span>
          </div>
          <button class="btn btn-primary btn-sm" id="list-all-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            List All for Sale
          </button>
        </div>
        <style>
          .list-all-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 16px 20px;
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: var(--radius-lg);
            margin-bottom: 24px;
          }
          .list-all-info {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text-secondary);
            font-size: 14px;
          }
          .list-all-info svg {
            color: var(--error);
            flex-shrink: 0;
          }
          @media (max-width: 500px) {
            .list-all-banner {
              flex-direction: column;
              text-align: center;
            }
          }
        </style>
      ` : ''}
      <div class="release-grid">
        ${this.releases.map(release => this.renderReleaseCard(release)).join('')}
      </div>
    `;
  },
  
  renderCollectedTab() {
    // Show loading initially
    setTimeout(() => this.loadCollectedNFTs(), 0);
    
    return `
      <div id="collected-content">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
      </div>
    `;
  },
  
  async fetchCollectedCount() {
    const countEl = document.getElementById('collected-count');
    if (!countEl || !AppState.user?.address) return;
    
    try {
      const response = await fetch(`/api/user-nfts?address=${AppState.user.address}`);
      const data = await response.json();
      countEl.textContent = data.nfts?.length || 0;
    } catch (e) {
      countEl.textContent = '?';
    }
  },
  
  async fetchForSaleCount() {
    const countEl = document.getElementById('forsale-count');
    if (!countEl || !AppState.user?.address) return;
    
    try {
      const response = await fetch(`/api/listings?seller=${AppState.user.address}`);
      const data = await response.json();
      countEl.textContent = data.listings?.length || 0;
    } catch (e) {
      countEl.textContent = '?';
    }
  },
  
  async loadCollectedNFTs() {
    const container = document.getElementById('collected-content');
    const countEl = document.getElementById('collected-count');
    if (!container) return;
    
    try {
      const response = await fetch(`/api/user-nfts?address=${AppState.user.address}`);
      const data = await response.json();
      
      // Update the counter
      if (countEl) countEl.textContent = data.nfts?.length || 0;
      
      if (!data.nfts || data.nfts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <h3>No Collected NFTs</h3>
            <p>NFTs you purchase will appear here.</p>
            <button class="btn btn-primary" style="margin-top: 16px;" onclick="Router.navigate('marketplace')">Browse Marketplace</button>
          </div>
        `;
        return;
      }
      
      container.innerHTML = `
        <div class="collected-grid">
          ${data.nfts.map(nft => this.renderCollectedNFT(nft)).join('')}
        </div>
      `;
      
      // Bind play buttons
      container.querySelectorAll('.nft-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const nftData = JSON.parse(btn.dataset.nft);
          if (nftData.audioUrl) {
            Player.play({
              id: nftData.trackId || nftData.releaseId,
              title: nftData.trackTitle || nftData.releaseTitle,
              artist: nftData.artistName,
              coverUrl: nftData.coverUrl,
              audioUrl: nftData.audioUrl,
            });
          }
        });
      });
      
      // Bind list for sale buttons
      container.querySelectorAll('.nft-list-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const nftData = JSON.parse(btn.dataset.nft);
          Modals.showListNFTForSale(nftData);
        });
      });
      
    } catch (error) {
      console.error('Failed to load NFTs:', error);
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <h3>Failed to Load</h3>
          <p>Couldn't fetch your NFTs. Please try again.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="ProfilePage.loadCollectedNFTs()">Retry</button>
        </div>
      `;
    }
  },
  
  renderForSaleTab() {
    // Show loading initially
    setTimeout(() => this.loadForSaleNFTs(), 0);
    
    return `
      <div id="forsale-content">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
      </div>
    `;
  },
  
  async loadForSaleNFTs() {
    const container = document.getElementById('forsale-content');
    const countEl = document.getElementById('forsale-count');
    if (!container) return;
    
    try {
      const response = await fetch(`/api/listings?seller=${AppState.user.address}`);
      const data = await response.json();
      
      // Update the counter
      if (countEl) countEl.textContent = data.listings?.length || 0;
      
      if (!data.listings || data.listings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <h3>No Active Listings</h3>
            <p>NFTs you list for sale will appear here.</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = `
        <div class="collected-grid">
          ${data.listings.map(listing => this.renderListingCard(listing)).join('')}
        </div>
      `;
      
      // Bind cancel buttons
      container.querySelectorAll('.cancel-listing-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const listingData = JSON.parse(btn.dataset.listing);
          await this.cancelListing(listingData);
        });
      });
      
      // Bind edit price buttons
      container.querySelectorAll('.edit-price-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const listingData = JSON.parse(btn.dataset.listing);
          await this.showEditPriceModal(listingData);
        });
      });
      
    } catch (error) {
      console.error('Failed to load listings:', error);
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <h3>Failed to Load</h3>
          <p>Couldn't fetch your listings. Please try again.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="ProfilePage.loadForSaleNFTs()">Retry</button>
        </div>
      `;
    }
  },
  
  renderListingCard(listing) {
    // Store listing data for buttons
    const listingData = JSON.stringify({
      id: listing.id,
      nftTokenId: listing.nft_token_id,
      offerIndex: listing.offer_index,
      price: listing.price,
      trackTitle: listing.track_title,
      releaseTitle: listing.release_title,
      artistName: listing.artist_name,
      coverUrl: listing.cover_url
    }).replace(/'/g, "\\'");
    
    return `
      <div class="collected-nft-card listing-card">
        <div class="collected-nft-cover">
          ${listing.cover_url 
            ? `<img src="${listing.cover_url}" alt="${listing.track_title || listing.release_title}">`
            : `<div class="cover-placeholder">🎵</div>`
          }
          <div class="listing-price-badge">${parseFloat(listing.price)} XRP</div>
        </div>
        <div class="collected-nft-info">
          <div class="collected-nft-title">${listing.track_title || listing.release_title || 'NFT'}</div>
          <div class="collected-nft-artist">${listing.artist_name || 'Unknown Artist'}</div>
          <div class="listing-card-actions">
            <button class="btn btn-sm btn-secondary edit-price-btn" data-listing='${listingData}'>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Price
            </button>
            <button class="btn btn-sm btn-danger cancel-listing-btn" data-listing='${listingData}'>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  },
  
  async cancelListing(listing) {
    if (!listing.offerIndex) {
      alert('Cannot cancel: No offer index found. The listing may already be cancelled on XRPL.');
      // Still try to remove from database
      try {
        await fetch(`/api/listings?listingId=${listing.id}`, { method: 'DELETE' });
        this.loadForSaleNFTs();
      } catch (e) {
        console.error('Failed to remove from database:', e);
      }
      return;
    }
    
    if (!confirm(`Cancel listing for "${listing.trackTitle || listing.releaseTitle}"?\n\nThis will require signing a transaction in Xaman.`)) {
      return;
    }
    
    try {
      // Show loading state
      const btn = document.querySelector(`.cancel-listing-btn[data-listing*="${listing.id}"]`);
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;"></div> Cancelling...';
      }
      
      // Cancel on XRPL first
      const result = await XamanWallet.cancelSellOffer(listing.offerIndex);
      
      if (result.success) {
        // Then remove from database
        await fetch(`/api/listings?listingId=${listing.id}`, { method: 'DELETE' });
        
        // Refresh the listings
        this.loadForSaleNFTs();
        this.fetchForSaleCount();
      } else {
        throw new Error(result.error || 'Failed to cancel on XRPL');
      }
    } catch (error) {
      console.error('Cancel listing error:', error);
      alert('Failed to cancel listing: ' + error.message);
      // Restore button state
      const btn = document.querySelector(`.cancel-listing-btn[data-listing*="${listing.id}"]`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cancel
        `;
      }
    }
  },
  
  async showEditPriceModal(listing) {
    const currentPrice = parseFloat(listing.price);
    
    // Create a simple modal for editing price
    const modalHtml = `
      <div class="modal-overlay" id="edit-price-modal" style="display:flex;">
        <div class="modal-container" style="max-width: 400px;">
          <div class="modal-header">
            <h2>Edit Listing Price</h2>
            <button class="modal-close" id="close-edit-price">&times;</button>
          </div>
          <div class="modal-body">
            <div style="text-align: center; margin-bottom: 20px;">
              ${listing.coverUrl ? `<img src="${listing.coverUrl}" style="width:100px;height:100px;border-radius:8px;object-fit:cover;">` : ''}
              <h3 style="margin-top:12px;">${listing.trackTitle || listing.releaseTitle}</h3>
              <p style="color:var(--text-muted);">Current price: ${currentPrice} XRP</p>
            </div>
            <div class="form-group">
              <label>New Price (XRP)</label>
              <input type="number" id="new-price-input" class="form-input" value="${currentPrice}" min="0.000001" step="0.1">
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">
              ⚠️ This will require 2 signatures in Xaman: one to cancel the old listing, and one to create the new listing.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-edit-price">Cancel</button>
            <button class="btn btn-primary" id="confirm-edit-price">Update Price</button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('edit-price-modal');
    const closeBtn = document.getElementById('close-edit-price');
    const cancelBtn = document.getElementById('cancel-edit-price');
    const confirmBtn = document.getElementById('confirm-edit-price');
    const priceInput = document.getElementById('new-price-input');
    
    // Focus input
    priceInput.focus();
    priceInput.select();
    
    // Close handlers
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Confirm handler
    confirmBtn.addEventListener('click', async () => {
      const newPrice = parseFloat(priceInput.value);
      
      if (isNaN(newPrice) || newPrice <= 0) {
        alert('Please enter a valid price');
        return;
      }
      
      if (newPrice === currentPrice) {
        alert('New price is the same as current price');
        return;
      }
      
      try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;"></div> Updating...';
        
        // Use the editListingPrice function from XamanWallet
        const result = await XamanWallet.editListingPrice(listing.nftTokenId, listing.offerIndex, newPrice);
        
        if (result.success) {
          // Update database with new offer index
          await fetch('/api/listings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nftTokenId: listing.nftTokenId,
              sellerAddress: AppState.user.address,
              price: newPrice,
              offerIndex: result.offerIndex,
              releaseId: listing.releaseId,
              trackId: listing.trackId
            })
          });
          
          closeModal();
          this.loadForSaleNFTs();
        } else {
          throw new Error(result.error || 'Failed to update price');
        }
      } catch (error) {
        console.error('Edit price error:', error);
        alert('Failed to update price: ' + error.message);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Update Price';
      }
    });
  },

  renderCollectedNFT(nft) {
    const isOneOfOne = nft.totalEditions === 1;
    const editionText = isOneOfOne 
      ? '1/1' 
      : nft.editionNumber 
        ? `#${nft.editionNumber} of ${nft.totalEditions}` 
        : `of ${nft.totalEditions}`;
    
    // Special styling for 1/1s and early editions
    let editionClass = '';
    let editionIcon = '';
    if (isOneOfOne) {
      editionClass = 'edition-one-of-one';
      editionIcon = '💎';
    } else if (nft.editionNumber === 1) {
      editionClass = 'edition-first';
      editionIcon = '🥇';
    } else if (nft.editionNumber && nft.editionNumber <= 10) {
      editionClass = 'edition-early';
      editionIcon = '⭐';
    }
    
    return `
      <div class="collected-nft-card" data-nft-id="${nft.nftTokenId}">
        <div class="collected-nft-cover">
          ${nft.coverUrl 
            ? `<img src="${nft.coverUrl}" alt="${nft.trackTitle || nft.releaseTitle}">`
            : `<div class="cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <div class="collected-nft-overlay">
            <button class="nft-play-btn" data-nft='${JSON.stringify(nft).replace(/'/g, "\\'")}'>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          </div>
          <div class="collected-nft-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Owned
          </div>
          ${editionText ? `<div class="edition-badge ${editionClass}">${editionIcon} ${editionText}</div>` : ''}
        </div>
        <div class="collected-nft-info">
          <div class="collected-nft-title">${nft.trackTitle || nft.releaseTitle}</div>
          <div class="collected-nft-artist">${nft.artistName || 'Unknown Artist'}</div>
          <div class="collected-nft-actions">
            <button class="btn btn-sm btn-secondary nft-list-btn" data-nft='${JSON.stringify(nft).replace(/'/g, "\\'")}'>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              List for Sale
            </button>
          </div>
        </div>
      </div>
    `;
  },
  
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const price = release.albumPrice || release.songPrice;
    const isOwner = AppState.user?.address === release.artistAddress;
    
    // Determine listing status
    let statusClass = '';
    let statusBadge = '';
    let statusOverlay = '';
    
    if (isOwner) {
      if (available === 0) {
        // Sold out - gold
        statusClass = 'sold-out';
        statusBadge = `<span class="listing-status-badge gold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Sold Out
        </span>`;
      } else if (release.sellOfferIndex) {
        // Listed for sale - green
        statusClass = 'listed';
        statusBadge = `<span class="listing-status-badge green">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          For Sale
        </span>`;
      } else {
        // Not listed - red (needs action)
        statusClass = 'not-listed';
        statusBadge = `<span class="listing-status-badge red">List for Sale</span>`;
        statusOverlay = `
          <div class="listing-overlay" data-release-id="${release.id}">
            <button class="btn btn-sm list-now-btn" data-release='${JSON.stringify(release).replace(/'/g, "\\'")}'>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              List Now
            </button>
          </div>
        `;
      }
    }
    
    return `
      <div class="release-card ${statusClass}" data-release-id="${release.id}">
        <div class="release-card-cover">
          ${release.coverUrl 
            ? `<img src="${release.coverUrl}" alt="${release.title}">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
          <span class="release-availability">${available} left</span>
          ${statusBadge}
          ${statusOverlay}
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title}</div>
          <div class="release-card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            <span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderError() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Failed to Load</h3>
        <p>There was an error loading your profile.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="ProfilePage.render()">Retry</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.renderContent();
      });
    });
    
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      Modals.showEditProfile();
    });
    
    // Fetch collected NFT count (even if on Posted tab)
    this.fetchCollectedCount();
    this.fetchForSaleCount();
    
    // List All button
    document.getElementById('list-all-btn')?.addEventListener('click', () => {
      const unlistedReleases = this.releases.filter(r => !r.sellOfferIndex && (r.totalEditions - r.soldEditions) > 0);
      Modals.showListAllForSale(unlistedReleases);
    });
    
    // Release card click (open modal)
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't open modal if clicking "List Now" button
        if (e.target.closest('.list-now-btn') || e.target.closest('.listing-overlay')) {
          return;
        }
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // List Now button click - open modal
    document.querySelectorAll('.list-now-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const release = JSON.parse(btn.dataset.release);
        Modals.showListForSale(release);
      });
    });
  },
};
