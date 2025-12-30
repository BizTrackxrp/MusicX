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
                <a href="${profile.website}" target="_blank" class="profile-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </a>
              ` : ''}
              ${profile.twitter ? `
                <a href="https://twitter.com/${profile.twitter}" target="_blank" class="profile-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
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
          <button class="tab-btn ${this.activeTab === 'posted' ? 'active' : ''}" data-tab="posted">
            My Releases
            <span class="tab-count">${this.releases.length}</span>
          </button>
          <button class="tab-btn ${this.activeTab === 'collected' ? 'active' : ''}" data-tab="collected">
            Collected
            <span class="tab-count" id="collected-count">...</span>
          </button>
        </div>
        
        <!-- Tab Content -->
        <div class="profile-tab-content">
          ${this.activeTab === 'posted' ? this.renderPostedTab() : this.renderCollectedTab()}
        </div>
      </div>
      
      <style>
        .profile-banner {
          height: 200px;
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-bottom: -60px;
        }
        .profile-banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-card {
          display: flex;
          align-items: flex-end;
          gap: 20px;
          padding: 0 24px;
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
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid var(--bg-primary);
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          overflow: hidden;
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-info {
          flex: 1;
          min-width: 0;
          padding-bottom: 16px;
        }
        .profile-name {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .profile-genres {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
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
          margin-bottom: 8px;
        }
        .profile-bio {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .profile-links {
          display: flex;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .profile-links {
            justify-content: center;
          }
        }
        .profile-link {
          color: var(--text-muted);
          transition: color 150ms;
        }
        .profile-link:hover {
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
  
  renderCollectedNFT(nft) {
    return `
      <div class="collected-nft-card">
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
        </div>
        <div class="collected-nft-info">
          <div class="collected-nft-title">${nft.trackTitle || nft.releaseTitle}</div>
          <div class="collected-nft-artist">${nft.artistName || 'Unknown Artist'}</div>
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
