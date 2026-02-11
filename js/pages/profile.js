/**
 * XRP Music - Profile Page
 * User profile with releases, collection, genres, and settings
 * 
 * UPDATED: Uses IpfsHelper for proxied IPFS images
 * UPDATED: Recognizes lazy mint releases (mintFeePaid/status='live') as "for sale"
 * UPDATED: Added share profile button
 * UPDATED: Fixed banner image scaling on desktop vs mobile
 * UPDATED: Fixed bio text overflow for long bios
 * UPDATED: Fixed mobile player positioning
 * UPDATED: Collection overhaul — dedup, filters, multi-copy popups, send NFT
 */

const ProfilePage = {
  releases: [],
  activeTab: 'posted',
  
  // Collection state (for filter switching)
  _collectionGrouped: [],
  _collectionArtists: [],
  _collectionRawNfts: [],
  _activeCollectionFilter: 'all',
  _needsRefresh: false,
  
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
      if (this._needsRefresh) {
        this.activeTab = 'collected';
        this._needsRefresh = false;
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
    
    const bannerUrl = this.getImageUrl(profile.bannerUrl);
    const avatarUrl = this.getImageUrl(profile.avatarUrl);
    
    const html = `
      <div class="profile-page animate-fade-in">
        <!-- Banner -->
        <div class="profile-banner">
          ${profile.bannerUrl ? `<img src="${bannerUrl}" alt="Banner" onerror="this.style.display='none'">` : ''}
        </div>
        
        <!-- Profile Card -->
        <div class="profile-card">
          <div class="profile-avatar">
            ${profile.avatarUrl 
              ? `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none'">`
              : `<span>${getUserInitial()}</span>`
            }
          </div>
          
          <div class="profile-info">
            <h1 class="profile-name">${displayName}</h1>
            ${this.renderGenreBadges(profile)}
            <p class="profile-address">${Helpers.truncateAddress(address, 8, 6)}</p>
            ${profile.bio ? `<div class="profile-bio-container"><p class="profile-bio">${profile.bio}</p></div>` : ''}
            
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
          
          <div class="profile-actions">
            <button class="btn btn-secondary" id="share-profile-btn" title="Share Profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span class="btn-text-desktop">Share</span>
            </button>
            <button class="btn btn-secondary" id="edit-profile-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span class="btn-text-desktop">Edit Profile</span>
            </button>
          </div>
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
        /* ============================================
           Profile Banner - FIXED for desktop/mobile
           ============================================ */
        .profile-banner {
          width: 100%;
          height: 180px;
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
        
        /* Desktop: taller banner to show more of the image */
        @media (min-width: 768px) {
          .profile-banner {
            height: 220px;
          }
        }
        
        @media (min-width: 1024px) {
          .profile-banner {
            height: 260px;
          }
        }
        
        @media (min-width: 1280px) {
          .profile-banner {
            height: 300px;
          }
        }
        
        /* ============================================
           Profile Card Layout
           ============================================ */
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
        
        /* ============================================
           Profile Bio - FIXED overflow for long text
           ============================================ */
        .profile-bio-container {
          max-width: 500px;
          margin-bottom: 14px;
        }
        
        .profile-bio {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          max-height: 100px;
          overflow-y: auto;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
          padding-right: 8px;
          margin: 0;
        }
        
        /* Custom scrollbar for bio */
        .profile-bio::-webkit-scrollbar {
          width: 4px;
        }
        
        .profile-bio::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .profile-bio::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 2px;
        }
        
        .profile-bio::-webkit-scrollbar-thumb:hover {
          background: var(--border-light);
        }
        
        @media (max-width: 640px) {
          .profile-bio-container {
            max-width: 100%;
            width: 100%;
          }
          
          .profile-bio {
            max-height: 120px;
            text-align: center;
            padding-right: 0;
          }
        }
        
        /* ============================================
           Profile Links
           ============================================ */
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
        
        /* ============================================
           Profile Actions
           ============================================ */
        .profile-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        
        @media (max-width: 640px) {
          .profile-actions {
            width: 100%;
            justify-content: center;
          }
          .profile-actions .btn {
            flex: 1;
            max-width: 140px;
            justify-content: center;
          }
        }
        
        @media (max-width: 400px) {
          .btn-text-desktop {
            display: none;
          }
          .profile-actions .btn {
            padding: 10px 14px;
            max-width: none;
            flex: 0;
          }
        }
        
        /* ============================================
           Profile Tabs
           ============================================ */
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
        
        /* ============================================
           Profile Tab Content - FIXED bottom padding
           ============================================ */
        .profile-tab-content {
          padding: 0 24px;
          padding-bottom: 120px;
        }
        
        @media (max-width: 1024px) {
          .profile-tab-content {
            padding: 0 16px;
            padding-bottom: 140px;
          }
        }
        
        /* ============================================
           Listing Status Styles
           ============================================ */
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
        
        /* ============================================
           Collection Filter Bar (NEW)
           ============================================ */
        .collection-filter-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          padding: 4px;
          background: var(--bg-hover, rgba(255, 255, 255, 0.04));
          border-radius: var(--radius-lg, 12px);
          width: fit-content;
        }
        
        .collection-filter-btn {
          padding: 8px 18px;
          border: none;
          border-radius: var(--radius, 8px);
          background: transparent;
          color: var(--text-muted, rgba(255, 255, 255, 0.5));
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .collection-filter-btn:hover {
          color: var(--text-secondary, rgba(255, 255, 255, 0.8));
          background: rgba(255, 255, 255, 0.04);
        }
        
        .collection-filter-btn.active {
          color: var(--text-primary, #fff);
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        /* Multi-copy badge on card cover (NEW) */
        .collection-multi-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          right: 8px;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 8px;
          color: #00ff88;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          transition: background 0.2s;
          z-index: 2;
        }
        
        .collection-multi-badge:hover {
          background: rgba(0, 0, 0, 0.88);
        }
        
        /* Artist count badge on artist cards (NEW) */
        .collection-artist-count {
          position: absolute;
          bottom: 8px;
          left: 8px;
          padding: 4px 10px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 11px;
          font-weight: 600;
        }
        
        .collection-artist-card {
          cursor: pointer;
        }
        
        /* ⋯ button on single-copy cards (NEW) */
        .nft-actions-btn {
          padding: 4px 10px !important;
          font-size: 16px !important;
          min-width: unset !important;
          letter-spacing: 2px;
        }
        /* External NFT badge (blue) */
        .collected-nft-badge.external {
          background: rgba(59, 130, 246, 0.85);
        }
        
        /* ============================================
           Copies & Artist Songs Popup (NEW)
           ============================================ */
        .copies-popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: copiesFadeIn 0.15s ease;
        }
        
        @keyframes copiesFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .copies-popup {
          background: var(--bg-primary, #16162a);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          border-radius: var(--radius-xl, 16px);
          width: 90%;
          max-width: 400px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: copiesSlideUp 0.2s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        
        @keyframes copiesSlideUp {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .copies-popup-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
          position: relative;
        }
        
        .copies-popup-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary, #fff);
          padding-right: 30px;
        }
        
        .copies-popup-subtitle {
          font-size: 13px;
          color: var(--text-muted, rgba(255, 255, 255, 0.4));
          margin-top: 2px;
        }
        
        .copies-popup-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 50%;
          background: var(--bg-hover, rgba(255, 255, 255, 0.06));
          color: var(--text-muted, rgba(255, 255, 255, 0.5));
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .copies-popup-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #fff);
        }
        
        .copies-popup-list {
          overflow-y: auto;
          flex: 1;
        }
        
        .copies-popup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 0.15s;
        }
        
        .copies-popup-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        
        .copies-popup-row:last-child {
          border-bottom: none;
        }
        
        .copies-popup-row-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .copies-popup-row-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        .copies-popup-row-edition {
          font-size: 12px;
          color: var(--text-muted, rgba(255, 255, 255, 0.35));
        }
        
        .copies-popup-row-actions {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: var(--bg-hover, rgba(255, 255, 255, 0.06));
          color: var(--text-muted, rgba(255, 255, 255, 0.6));
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        
        .copies-popup-row-actions:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #fff);
        }
        
        /* Artist songs playlist rows (NEW) */
        .artist-song-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 0.15s;
          cursor: pointer;
        }
        
        .artist-song-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        
        .artist-song-row:last-child {
          border-bottom: none;
        }
        
        .artist-song-row-cover {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }
        
        .artist-song-row-info {
          flex: 1;
          min-width: 0;
        }
        
        .artist-song-row-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .artist-song-row-copies {
          font-size: 12px;
          color: var(--text-muted, rgba(255, 255, 255, 0.35));
          margin-top: 1px;
        }
        
        .artist-song-row-expand {
          flex-shrink: 0;
          padding: 6px 12px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, rgba(255, 255, 255, 0.6));
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        
        .artist-song-row-expand:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-primary, #fff);
        }
        
        /* ============================================
           Actions Dropdown (⋯ → sell / send) (NEW)
           ============================================ */
        .collection-actions-dropdown {
          position: fixed;
          min-width: 200px;
          background: var(--bg-primary, #1a1a2e);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          z-index: 10001;
          animation: copiesFadeIn 0.12s ease;
        }
        
        .collection-actions-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--text-secondary, rgba(255, 255, 255, 0.85));
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }
        
        .collection-actions-item:hover {
          background: var(--bg-hover, rgba(255, 255, 255, 0.06));
        }
        
        .collection-actions-item:first-child {
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        
        .collection-actions-item svg {
          flex-shrink: 0;
          opacity: 0.6;
        }
        
        /* ============================================
           Send NFT Popup (NEW)
           ============================================ */
        .send-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, rgba(255, 255, 255, 0.6));
          margin-bottom: 8px;
        }
        
        .send-input {
          width: 100%;
          padding: 12px 14px;
          background: var(--bg-hover, rgba(255, 255, 255, 0.06));
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          border-radius: var(--radius, 10px);
          color: var(--text-primary, #fff);
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        
        .send-input:focus {
          border-color: var(--accent, rgba(255, 255, 255, 0.25));
        }
        
        .send-input::placeholder {
          color: var(--text-muted, rgba(255, 255, 255, 0.25));
        }
        
        .send-warning {
          margin-top: 12px;
          padding: 10px 12px;
          background: rgba(255, 200, 0, 0.06);
          border: 1px solid rgba(255, 200, 0, 0.15);
          border-radius: 8px;
          color: rgba(255, 200, 0, 0.8);
          font-size: 12px;
          line-height: 1.4;
        }

        /* ============================================
           Album Badge on Collection Cards
           ============================================ */
        .collection-album-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          right: 8px;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          z-index: 2;
        }
        .collection-album-badge.complete { color: #00ff88; }
        .collection-album-badge.partial { color: #f59e0b; }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  // ============================================
  // POSTED TAB (unchanged)
  // ============================================
  
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
   // Count unlisted releases - now uses isForSale() helper
    const unlistedCount = this.releases.filter(r => !this.isForSale(r) && (r.totalEditions - r.soldEditions) > 0).length;
    
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

  markNeedsRefresh() {
    this._needsRefresh = true;
  },
  
  // ============================================
  // COLLECTED TAB (OVERHAULED)
  // ============================================
  
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
      const platformCount = data.nfts?.length || 0;
      const externalCount = (AppState.externalNfts || []).length;
      countEl.textContent = platformCount + externalCount;
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
      
      // Merge external music NFTs into collection
      const externalNfts = (AppState.externalNfts || []).map(ext => ({
        nftTokenId: ext.nftTokenId,
        trackId: ext.id,
        releaseId: null,
        trackTitle: ext.title,
        releaseTitle: ext.collectionName || ext.title,
        artistName: ext.artist || ext.artistName,
        artistAddress: ext.issuer || '',
        coverUrl: ext.cover || ext.coverUrl,
        audioUrl: ext.audioUrl,
        duration: ext.duration || null,
        price: null,
        totalEditions: null,
        releaseType: 'single',
        totalTracks: 1,
        editionNumber: null,
        purchaseDate: null,
        issuer: ext.issuer,
        isExternal: true,
      }));

      const allNfts = [...(data.nfts || []), ...externalNfts];
      
      // Update the counter
      if (countEl) countEl.textContent = allNfts.length;
      
      if (allNfts.length === 0) {
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
      
      // Process and deduplicate
      const grouped = this.processCollectionData(allNfts);
      const artists = this.getUniqueArtists(grouped);
      
      // Store for filter switching
      this._collectionGrouped = grouped;
      this._collectionArtists = artists;
      this._collectionRawNfts = allNfts;
      this._activeCollectionFilter = 'all';
      
      container.innerHTML = `
        <div class="collection-filter-bar">
          <button class="collection-filter-btn active" data-filter="all">All</button>
          <button class="collection-filter-btn" data-filter="by-artist">By Artist</button>
          <button class="collection-filter-btn" data-filter="by-songs">By Songs</button>
        </div>
        <div class="collected-grid" id="collectionGrid"></div>
      `;
      
      // Bind filter buttons
      container.querySelectorAll('.collection-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.collection-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._activeCollectionFilter = btn.dataset.filter;
          const grid = document.getElementById('collectionGrid');
          if (!grid) return;
          
          switch (btn.dataset.filter) {
            case 'all':
              this.renderAllCards(this._collectionGrouped, grid);
              break;
            case 'by-artist':
              this.renderArtistCards(this._collectionArtists, grid);
              break;
            case 'by-songs':
              this.renderSongCards(this._collectionGrouped, grid);
              break;
          }
        });
      });
      
      // Initial render
      this.renderAllCards(grouped, document.getElementById('collectionGrid'));
      
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
  
  // ============================================
  // COLLECTION DATA PROCESSING (NEW)
  // ============================================
  
  processCollectionData(nfts) {
    const releaseGroups = {};
    
    nfts.forEach(nft => {
      const releaseId = nft.releaseId || nft.trackId || nft.nftTokenId;
      const isAlbumOrEP = (nft.releaseType === 'album' || nft.releaseType === 'ep') && (nft.totalTracks || 0) > 1;
      
      if (!releaseGroups[releaseId]) {
        releaseGroups[releaseId] = {
          releaseId: nft.releaseId,
          releaseTitle: nft.releaseTitle || nft.trackTitle || 'Unknown',
          artist: nft.artistName || 'Unknown Artist',
          artistAddress: nft.artistAddress || '',
          coverUrl: nft.coverUrl || '',
          price: nft.price || null,
          albumPrice: nft.albumPrice || null,
          totalEditions: nft.totalEditions || null,
          releaseType: nft.releaseType || 'single',
          totalTracks: nft.totalTracks || 1,
          isAlbum: isAlbumOrEP,
          tracks: {},
          copies: [],
        };
      }
      
      const group = releaseGroups[releaseId];
      
      if (group.isAlbum && nft.trackId) {
        if (!group.tracks[nft.trackId]) {
          group.tracks[nft.trackId] = {
            trackId: nft.trackId,
            trackTitle: nft.trackTitle || 'Unknown Track',
            trackNumber: nft.trackNumber || null,
            audioUrl: nft.audioUrl || '',
            duration: nft.duration || null,
            copies: [],
          };
        }
        group.tracks[nft.trackId].copies.push({
          nftTokenId: nft.nftTokenId,
          editionNumber: nft.editionNumber || null,
          purchaseDate: nft.purchaseDate || null,
          issuer: nft.issuer || null,
          _raw: nft,
        });
      } else {
        group.copies.push({
          nftTokenId: nft.nftTokenId,
          editionNumber: nft.editionNumber || null,
          purchaseDate: nft.purchaseDate || null,
          issuer: nft.issuer || null,
          _raw: nft,
        });
        if (!group.audioUrl) {
          group.audioUrl = nft.audioUrl;
          group.duration = nft.duration;
          group.trackId = nft.trackId;
        }
      }
    });
    
    return Object.values(releaseGroups).map(group => {
      if (group.isAlbum) {
        group.tracksArray = Object.values(group.tracks).sort((a, b) => {
          if (a.trackNumber && b.trackNumber) return a.trackNumber - b.trackNumber;
          return (a.trackTitle || '').localeCompare(b.trackTitle || '');
        });
        group.ownedTrackCount = group.tracksArray.length;
        group.totalNftCount = group.tracksArray.reduce((sum, t) => sum + t.copies.length, 0);
      }
      return group;
    });
  },
getUniqueArtists(grouped) {
    const artistMap = {};
    grouped.forEach(item => {
      const key = item.artistAddress || item.artist;
      if (!artistMap[key]) {
        artistMap[key] = {
          name: item.artist,
          address: item.artistAddress,
          coverUrl: item.coverUrl,
          songCount: 0,
          songs: []
        };
      }
      artistMap[key].songCount++;
      artistMap[key].songs.push(item);
    });
    return Object.values(artistMap);
  },
  // ============================================
  // COLLECTION CARD RENDERERS (NEW)
  // ============================================
  
  renderAllCards(grouped, grid) {
    if (!grid) return;
    
    grid.innerHTML = grouped.map((item, idx) => {
      const coverUrl = this.getImageUrl(item.coverUrl);
      const isExternal = item.copies[0]?._raw?.isExternal || false;
      
      if (item.isAlbum) {
        const owned = item.ownedTrackCount;
        const total = item.totalTracks;
        const isComplete = owned >= total;
        const typeLabel = item.releaseType === 'ep' ? 'EP' : 'Album';
        
        return `
          <div class="collected-nft-card collection-album-card" data-group-idx="${idx}" style="cursor:pointer;">
            <div class="collected-nft-cover">
              ${item.coverUrl
                ? `<img src="${coverUrl}" alt="${item.releaseTitle}" onerror="this.src='/placeholder.png'">`
                : `<div class="cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
              }
              <div class="collected-nft-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Owned
              </div>
              <div class="collection-album-badge ${isComplete ? 'complete' : 'partial'}">
                ${typeLabel} • ${owned}/${total} tracks owned
              </div>
            </div>
            <div class="collected-nft-info">
              <div class="collected-nft-title">${item.releaseTitle}</div>
              <div class="collected-nft-artist">${item.artist}</div>
            </div>
          </div>
        `;
      } else {
        const hasMultiple = item.copies.length > 1;
        const isOneOfOne = item.totalEditions === 1;
        
        let editionText = '';
        let editionClass = '';
        let editionIcon = '';
        if (!hasMultiple && item.copies[0]) {
          const copy = item.copies[0];
          if (isOneOfOne) { editionText = '1/1'; editionClass = 'edition-one-of-one'; editionIcon = '💎'; }
          else if (copy.editionNumber === 1) { editionText = `#1 of ${item.totalEditions}`; editionClass = 'edition-first'; editionIcon = '🥇'; }
          else if (copy.editionNumber && copy.editionNumber <= 10) { editionText = `#${copy.editionNumber} of ${item.totalEditions}`; editionClass = 'edition-early'; editionIcon = '⭐'; }
          else if (copy.editionNumber) { editionText = `#${copy.editionNumber} of ${item.totalEditions}`; }
        }
        
        return `
          <div class="collected-nft-card" data-group-idx="${idx}">
            <div class="collected-nft-cover">
              ${item.coverUrl
                ? `<img src="${coverUrl}" alt="${item.releaseTitle}" onerror="this.src='/placeholder.png'">`
                : `<div class="cover-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
              }
              <div class="collected-nft-overlay">
                <button class="nft-play-btn" data-group-idx="${idx}">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
              </div>
              <div class="collected-nft-badge${isExternal ? ' external' : ''}">
                ${isExternal ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> External` : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Owned`}
              </div>
              ${hasMultiple ? `
                <div class="collection-multi-badge" data-group-idx="${idx}">${item.copies.length} copies owned</div>
              ` : editionText ? `
                <div class="edition-badge ${editionClass}">${editionIcon} ${editionText}</div>
              ` : ''}
            </div>
            <div class="collected-nft-info">
              <div class="collected-nft-title">${item.releaseTitle || item.copies[0]?._raw?.trackTitle || 'Unknown'}</div>
              <div class="collected-nft-artist">${item.artist}</div>
              <div class="collected-nft-actions">
                ${hasMultiple ? `
                  <button class="btn btn-sm btn-secondary collection-multi-btn" data-group-idx="${idx}">${item.copies.length} copies ▾</button>
                ` : `
                  <button class="btn btn-sm btn-secondary nft-actions-btn" data-group-idx="${idx}" data-copy-idx="0">⋯</button>
                `}
              </div>
            </div>
          </div>
        `;
      }
    }).join('');
    
    this.bindCollectionCardEvents(grouped, grid);
  },
  
  renderSongCards(grouped, grid) {
    const sorted = [...grouped].sort((a, b) => (a.releaseTitle || '').localeCompare(b.releaseTitle || ''));
    this.renderAllCards(sorted, grid);
  },
  
  renderArtistCards(artists, grid) {
    if (!grid) return;
    
    grid.innerHTML = artists.map((artist, idx) => {
      const coverUrl = this.getImageUrl(artist.coverUrl);
      return `
        <div class="collected-nft-card collection-artist-card" data-artist-idx="${idx}">
          <div class="collected-nft-cover">
            ${artist.coverUrl
              ? `<img src="${coverUrl}" alt="${artist.name}" onerror="this.src='/placeholder.png'">`
              : `<div class="cover-placeholder" style="font-size:40px;">🎤</div>`
            }
            <div class="collection-artist-count">
              ${artist.songCount} song${artist.songCount > 1 ? 's' : ''}
            </div>
          </div>
          <div class="collected-nft-info">
            <div class="collected-nft-title">${artist.name}</div>
          </div>
        </div>
      `;
    }).join('');
    // Click artist → show their songs popup
    grid.querySelectorAll('.collection-artist-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.artistIdx);
        const artist = artists[idx];
        if (artist) this.showArtistSongsPopup(artist);
      });
    });
  },
  bindCollectionCardEvents(grouped, grid) {
    // Album card click → album popup
    grid.querySelectorAll('.collection-album-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const idx = parseInt(card.dataset.groupIdx);
        const item = grouped[idx];
        if (item) this.showAlbumPopup(item);
      });
    });
    
    // Play buttons (singles only)
    grid.querySelectorAll('.nft-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.groupIdx);
        const item = grouped[idx];
        if (item && item.audioUrl) {
          Player.playTrack({
            id: item.trackId || item.releaseId,
            trackId: item.trackId || item.releaseId,
            title: item.releaseTitle,
            artist: item.artist,
            cover: this.getImageUrl(item.coverUrl),
            coverUrl: this.getImageUrl(item.coverUrl),
            audioUrl: item.audioUrl,
            ipfsHash: typeof IpfsHelper !== 'undefined' ? IpfsHelper.extractCid(item.audioUrl) : null,
            releaseId: item.releaseId,
            isExternal: item.copies[0]?._raw?.isExternal || false,
          });
        }
      });
    });
    
    grid.querySelectorAll('.collection-multi-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(badge.dataset.groupIdx);
        const item = grouped[idx];
        if (item) this.showCopiesPopup(item);
      });
    });
    
    grid.querySelectorAll('.collection-multi-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.groupIdx);
        const item = grouped[idx];
        if (item) this.showCopiesPopup(item);
      });
    });
    
    grid.querySelectorAll('.nft-actions-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupIdx = parseInt(btn.dataset.groupIdx);
        const copyIdx = parseInt(btn.dataset.copyIdx);
        const item = grouped[groupIdx];
        if (item && item.copies[copyIdx]) {
          this.showNftActionsDropdown(btn, item, item.copies[copyIdx]);
        }
      });
    });
  },
  showAlbumPopup(item) {
    document.querySelector('.copies-popup-overlay')?.remove();
    
    const coverUrl = this.getImageUrl(item.coverUrl);
    const owned = item.ownedTrackCount;
    const total = item.totalTracks;
    const typeLabel = item.releaseType === 'ep' ? 'EP' : 'Album';
    
    const overlay = document.createElement('div');
    overlay.className = 'copies-popup-overlay';
    overlay.innerHTML = `
      <div class="copies-popup" style="max-width:480px;">
        <div class="copies-popup-header" style="display:flex;gap:16px;align-items:center;padding:20px;">
          <img src="${coverUrl}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;" onerror="this.src='/placeholder.png'" />
          <div style="flex:1;min-width:0;">
            <div class="copies-popup-title">${item.releaseTitle}</div>
            <div class="copies-popup-subtitle">${item.artist} • ${typeLabel} • ${owned}/${total} tracks owned</div>
          </div>
          <button class="copies-popup-close" style="position:static;flex-shrink:0;">✕</button>
        </div>
        <div class="copies-popup-list">
          ${item.tracksArray.map((track, i) => {
            const copyCount = track.copies.length;
            const firstCopy = track.copies[0];
            const edNum = firstCopy?.editionNumber;
            
            let metaHtml = '';
            if (copyCount > 1) {
              metaHtml = `<span style="color:#f59e0b;font-weight:600;cursor:pointer;" class="multi-click" data-track-idx="${i}">${copyCount} copies — tap to see editions</span>`;
            } else if (edNum) {
              metaHtml = `<span style="color:#00ff88;font-weight:600;">Edition #${edNum}</span>${item.totalEditions ? ` of ${item.totalEditions}` : ''}`;
            }
            
            return `
              <div class="album-track-row" data-track-idx="${i}" style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;">
                <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.08);color:var(--text-muted);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${track.trackTitle}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${metaHtml}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  <button class="album-sell-btn" data-track-idx="${i}" style="padding:6px 12px;border:1px solid rgba(34,197,94,0.4);border-radius:8px;background:rgba(34,197,94,0.1);color:#22c55e;font-size:12px;font-weight:600;cursor:pointer;">Sell</button>
                  <button class="album-send-btn" data-track-idx="${i}" style="padding:6px 10px;border:1px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('.copies-popup-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    
    // Play track on row click
    overlay.querySelectorAll('.album-track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.multi-click')) return;
        const trackIdx = parseInt(row.dataset.trackIdx);
        const track = item.tracksArray[trackIdx];
        if (track && track.audioUrl) {
          Player.playTrack({
            id: track.trackId, trackId: track.trackId,
            title: track.trackTitle, artist: item.artist,
            cover: this.getImageUrl(item.coverUrl), coverUrl: this.getImageUrl(item.coverUrl),
            audioUrl: track.audioUrl,
            ipfsHash: typeof IpfsHelper !== 'undefined' ? IpfsHelper.extractCid(track.audioUrl) : null,
            releaseId: item.releaseId,
          });
        }
      });
    });
    
    // Multi-copy click
    overlay.querySelectorAll('.multi-click').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackIdx = parseInt(el.dataset.trackIdx);
        const track = item.tracksArray[trackIdx];
        if (track) {
          overlay.remove();
          this.showCopiesPopup({ title: track.trackTitle, releaseTitle: track.trackTitle, artist: item.artist, totalEditions: item.totalEditions, copies: track.copies });
        }
      });
    });
    
    // Sell buttons
    overlay.querySelectorAll('.album-sell-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackIdx = parseInt(btn.dataset.trackIdx);
        const track = item.tracksArray[trackIdx];
        if (!track) return;
        if (track.copies.length > 1) {
          // TODO: edition picker
          alert('Multiple copies — pick which edition to sell (coming soon)');
        } else {
          Modals.showListNFTForSale(track.copies[0]._raw);
        }
      });
    });
    
    // Send buttons
    overlay.querySelectorAll('.album-send-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackIdx = parseInt(btn.dataset.trackIdx);
        const track = item.tracksArray[trackIdx];
        if (!track) return;
        if (track.copies.length > 1) {
          alert('Multiple copies — pick which edition to send (coming soon)');
        } else {
          this.handleSendNft({ title: track.trackTitle, totalEditions: item.totalEditions }, track.copies[0]);
        }
      });
    });
  },
  // ============================================
  // COLLECTION POPUPS (NEW)
  // ============================================
  
  showCopiesPopup(item) {
    // Remove existing
    document.querySelector('.copies-popup-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'copies-popup-overlay';
    overlay.innerHTML = `
      <div class="copies-popup">
        <div class="copies-popup-header">
          <div class="copies-popup-title">${item.releaseTitle || item.title}</div>
          <div class="copies-popup-subtitle">${item.artist} — ${item.copies.length} copies</div>
          <button class="copies-popup-close">✕</button>
        </div>
        <div class="copies-popup-list">
          ${item.copies.map((copy, i) => `
            <div class="copies-popup-row">
              <div class="copies-popup-row-info">
                <span class="copies-popup-row-label">Copy ${i + 1}</span>
                <span class="copies-popup-row-edition">
                  ${copy.editionNumber ? `Edition #${copy.editionNumber}` : ''}
                  ${item.totalEditions ? ` of ${item.totalEditions}` : ''}
                </span>
              </div>
              <button class="copies-popup-row-actions" data-copy-idx="${i}">⋯</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close handlers
    overlay.querySelector('.copies-popup-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    
    // Action buttons per copy
    overlay.querySelectorAll('.copies-popup-row-actions').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const copyIdx = parseInt(btn.dataset.copyIdx);
        this.showNftActionsDropdown(btn, item, item.copies[copyIdx]);
      });
    });
  },
  
  showArtistSongsPopup(artist) {
    document.querySelector('.copies-popup-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'copies-popup-overlay';
    overlay.innerHTML = `
      <div class="copies-popup">
        <div class="copies-popup-header">
          <div class="copies-popup-title">${artist.name}</div>
          <div class="copies-popup-subtitle">${artist.songCount} song${artist.songCount > 1 ? 's' : ''} in your collection</div>
          <button class="copies-popup-close">✕</button>
        </div>
        <div class="copies-popup-list">
          ${artist.songs.map((song, idx) => {
            const coverUrl = this.getImageUrl(song.coverUrl);
            return `
              <div class="artist-song-row" data-song-idx="${idx}">
                <img class="artist-song-row-cover" src="${coverUrl}" alt="" 
                     onerror="this.src='/placeholder.png'" />
                <div class="artist-song-row-info">
                  <div class="artist-song-row-title">${song.releaseTitle || song.title}</div>
                  <div class="artist-song-row-copies">
                    ${song.copies.length > 1
                      ? `${song.copies.length} copies`
                      : song.copies[0]?.editionNumber
                        ? `Edition #${song.copies[0].editionNumber}`
                        : ''
                    }
                  </div>
                </div>
                ${song.copies.length > 1 ? `
                  <button class="artist-song-row-expand" data-song-idx="${idx}">
                    ${song.copies.length} copies ▾
                  </button>
                ` : `
                  <button class="copies-popup-row-actions" data-song-idx="${idx}" data-copy-idx="0">⋯</button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('.copies-popup-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    
    // Expand multi-copy songs → copies popup
    overlay.querySelectorAll('.artist-song-row-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const songIdx = parseInt(btn.dataset.songIdx);
        const song = artist.songs[songIdx];
        if (song) {
          overlay.remove();
          this.showCopiesPopup(song);
        }
      });
    });
    
    // Single-copy actions
    overlay.querySelectorAll('.copies-popup-row-actions').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const songIdx = parseInt(btn.dataset.songIdx);
        const copyIdx = parseInt(btn.dataset.copyIdx);
        const song = artist.songs[songIdx];
        if (song && song.copies[copyIdx]) {
          this.showNftActionsDropdown(btn, song, song.copies[copyIdx]);
        }
      });
    });
    
    // Play on row click (not on buttons)
    overlay.querySelectorAll('.artist-song-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const songIdx = parseInt(row.dataset.songIdx);
        const song = artist.songs[songIdx];
        if (song && song.audioUrl) {
         Player.playTrack({
            id: song.trackId || song.releaseId,
            trackId: song.trackId || song.releaseId,
           title: song.releaseTitle || song.title,
            artist: song.artist,
            cover: this.getImageUrl(song.coverUrl),
            coverUrl: this.getImageUrl(song.coverUrl),
            audioUrl: song.audioUrl,
            ipfsHash: typeof IpfsHelper !== 'undefined' ? IpfsHelper.extractCid(song.audioUrl) : null,
            releaseId: song.releaseId,
            isExternal: song.copies[0]?._raw?.isExternal || false,
          });
        }
      });
    });
  },
  
  // ============================================
  // ACTIONS DROPDOWN & SEND NFT (NEW)
  // ============================================
  
  showNftActionsDropdown(anchorEl, item, copy) {
    // Remove existing
    document.querySelector('.collection-actions-dropdown')?.remove();
    
    const dropdown = document.createElement('div');
    dropdown.className = 'collection-actions-dropdown';
    const isExternal = copy._raw?.isExternal;
    dropdown.innerHTML = `
      ${!isExternal ? `<button class="collection-actions-item" data-action="sell">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        Put up for sale
      </button>` : ''}
      <button class="collection-actions-item" data-action="send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Send NFT to someone
      </button>
    `;
    
    // Position near anchor
    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    
    document.body.appendChild(dropdown);
    
    // Sell → reuse existing Modals.showListNFTForSale
    const sellBtn = dropdown.querySelector('[data-action="sell"]');
    if (sellBtn) sellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.remove();
      Modals.showListNFTForSale(copy._raw);
    });
    
    // Send
    dropdown.querySelector('[data-action="send"]').addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.remove();
      this.handleSendNft(item, copy);
    });
    
    // Close on outside click
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  },
  
  handleSendNft(item, copy) {
    // Remove any existing send overlay
    document.querySelector('.copies-popup-overlay.send-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'copies-popup-overlay send-overlay';
    overlay.innerHTML = `
      <div class="copies-popup" style="max-width:380px;">
        <div class="copies-popup-header">
          <div class="copies-popup-title">Send NFT</div>
          <div class="copies-popup-subtitle">
            ${item.releaseTitle || item.title}${copy.editionNumber ? ` — Edition #${copy.editionNumber}` : ''}
          </div>
          <button class="copies-popup-close">✕</button>
        </div>
        <div style="padding:20px;">
          <label class="send-label">Recipient's XRP address</label>
          <input type="text" class="send-input" id="sendAddressInput" 
                 placeholder="rXXXXXXXXX..." autocomplete="off" />
          <div class="send-warning">
            ⚠️ This will transfer the NFT permanently. Double-check the address.
          </div>
          <button class="btn btn-primary" id="sendSubmitBtn" style="width:100%;margin-top:16px;">
            Send NFT
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('.copies-popup-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    
    // Focus input
    document.getElementById('sendAddressInput')?.focus();
    
    document.getElementById('sendSubmitBtn').addEventListener('click', async () => {
      const recipient = document.getElementById('sendAddressInput').value.trim();
      
      if (!recipient || !recipient.startsWith('r') || recipient.length < 25) {
        alert('Please enter a valid XRP address');
        return;
      }
      
      if (recipient === AppState.user.address) {
        alert('You cannot send an NFT to yourself');
        return;
      }
      
      const btn = document.getElementById('sendSubmitBtn');
      btn.textContent = 'Creating transfer...';
      btn.disabled = true;
      
      try {
        // Create a 0-XRP sell offer with a specific destination = direct transfer
        const result = await XamanWallet.createSellOffer(
          copy.nftTokenId,
          0,           // price = 0 for transfer
          recipient    // destination = specific recipient
        );
        
        if (result.success) {
          alert(`NFT sent to ${Helpers.truncateAddress(recipient)}!`);
          overlay.remove();
          // Refresh collection
          this.loadCollectedNFTs();
        } else {
          throw new Error(result.error || 'Transfer failed');
        }
      } catch (err) {
        console.error('Send NFT error:', err);
        alert('Failed to send NFT: ' + err.message);
        btn.textContent = 'Send NFT';
        btn.disabled = false;
      }
    });
  },
  
  // ============================================
  // FOR SALE TAB (unchanged)
  // ============================================
  
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
    const coverUrl = this.getImageUrl(listing.cover_url);
    
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
            ? `<img src="${coverUrl}" alt="${listing.track_title || listing.release_title}" onerror="this.src='/placeholder.png'">`
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
    const coverUrl = this.getImageUrl(listing.coverUrl);
    
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
              ${listing.coverUrl ? `<img src="${coverUrl}" style="width:100px;height:100px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
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
  
  // ============================================
  // RELEASE CARD (unchanged)
  // ============================================
  
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const price = release.albumPrice || release.songPrice;
    const isOwner = AppState.user?.address === release.artistAddress;
    const coverUrl = this.getImageUrl(release.coverUrl);
    
    // Determine listing status - NOW RECOGNIZES LAZY MINT!
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
      } else if (this.isForSale(release)) {
        // Listed for sale (pre-minted OR lazy mint) - green
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
            ? `<img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
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
  
  // ============================================
  // ERROR & EVENTS (unchanged)
  // ============================================
  
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
    
    // Share profile button
    document.getElementById('share-profile-btn')?.addEventListener('click', () => {
      const profile = AppState.profile || {};
      ShareUtils.shareArtistProfile({
        address: AppState.user.address,
        displayName: getDisplayName(),
        artistName: profile.displayName || profile.artistName,
        avatarUrl: profile.avatarUrl
      });
    });
    
    // Fetch collected NFT count (even if on Posted tab)
    this.fetchCollectedCount();
    this.fetchForSaleCount();
    
    // List All button - only show releases that are truly not for sale
    document.getElementById('list-all-btn')?.addEventListener('click', () => {
      const unlistedReleases = this.releases.filter(r => !this.isForSale(r) && (r.totalEditions - r.soldEditions) > 0);
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
