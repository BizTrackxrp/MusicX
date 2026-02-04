/**
 * XRP Music - Stream Page
 * Main discovery page with top played tracks, all tracks, sorting, and artists
 * 
 * UPDATED: Now fetches real play data from /api/plays endpoint
 * UPDATED: Uses IpfsHelper for proxied IPFS images
 * UPDATED: View All navigates to Analytics page
 * UPDATED: Cleaned up - removed sort buttons, defaults to Artists tab
 * UPDATED: Uses unfiltered releases for artists/stats; plays API handles feed filtering
 */

const StreamPage = {
  releases: [],
  artists: [],
  topTracks: [],
  currentTab: 'artists', // 'tracks' or 'artists' - default to artists for cleaner view
  currentTopPeriod: '7d', // '1d', '7d', '30d', '365d'
  
  // Helper to get proxied image URL
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },
  
  async render() {
    UI.showLoading();
    
    try {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      // Fetch ALL live releases (unfiltered) for artists list, tracks list, and stats
      this.releases = await Promise.race([API.getReleases(), timeout]);
      setReleases(this.releases);
      this.extractArtists();
      
      // Load top played tracks (plays API already filters by 20 XRP threshold)
      await this.loadTopTracks();
      
      if (this.releases.length === 0) {
        this.renderEmpty();
        return;
      }
      
      this.renderContent();
    } catch (error) {
      console.error('Failed to load releases:', error);
      this.renderError();
    }
  },
  
  /**
   * Load top played tracks for current period from the API
   * The /api/plays endpoint already filters out artists with < 20 XRP sales
   */
  async loadTopTracks() {
    try {
      // Fetch real play data from /api/plays endpoint (already filtered)
      if (typeof API.getTopTracks === 'function') {
        const topTracks = await API.getTopTracks(this.currentTopPeriod, 10);
        
        if (topTracks && topTracks.length > 0) {
          // Format the API response for our UI
          this.topTracks = topTracks.map(item => ({
            id: item.trackId,
            trackId: item.trackId,
            displayTitle: item.track?.title || item.release?.title || 'Unknown',
            audioCid: item.track?.audioCid,
            duration: item.track?.duration,
            plays: item.plays || 0,
            release: {
              id: item.releaseId,
              title: item.release?.title,
              artistName: item.release?.artistName,
              artistAddress: item.release?.artistAddress,
              coverUrl: item.release?.coverUrl,
              songPrice: item.release?.songPrice || 0,
              totalEditions: item.release?.totalEditions || 0,
              soldEditions: item.release?.soldEditions || 0,
              type: item.release?.type || 'single',
            }
          }));
          
          console.log(`📊 Loaded ${this.topTracks.length} top tracks for ${this.currentTopPeriod}`);
          return;
        }
      }
    } catch (e) {
      console.log('Top tracks API not available or returned no data:', e.message);
    }
    
    // Fallback: If no play data exists yet, show tracks sorted by sales
    // Only include tracks from artists that pass the feed filter
    console.log('📊 No play data yet, showing tracks by sales as fallback');
    
    try {
      // Use feed-filtered releases for the fallback so spam artists don't appear
      const feedReleases = await API.getReleasesFeed();
      const feedTracks = feedReleases.flatMap(release =>
        (release.tracks || []).map((track, idx) => ({
          ...track,
          release,
          trackIndex: idx,
          displayTitle: release.type === 'single' ? release.title : track.title,
        }))
      );
      
      this.topTracks = feedTracks
        .map(track => ({
          ...track,
          plays: track.release.soldEditions || 0,
        }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);
    } catch (e) {
      // If feed call also fails, use unfiltered as last resort
      const allTracks = this.getAllTracks();
      this.topTracks = allTracks
        .map(track => ({
          ...track,
          plays: track.release.soldEditions || 0,
        }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);
    }
  },
  
  extractArtists() {
    const artistMap = new Map();
    
    this.releases.forEach(release => {
      if (!artistMap.has(release.artistAddress)) {
        artistMap.set(release.artistAddress, {
          address: release.artistAddress,
          name: release.artistName || Helpers.truncateAddress(release.artistAddress),
          avatar: release.artistAvatar || null,
          releaseCount: 1,
          trackCount: release.tracks?.length || 0,
          totalSold: release.soldEditions || 0,
          totalStreams: release.soldEditions || 0,
        });
      } else {
        const artist = artistMap.get(release.artistAddress);
        artist.releaseCount++;
        artist.trackCount += release.tracks?.length || 0;
        artist.totalSold += release.soldEditions || 0;
        artist.totalStreams += release.soldEditions || 0;
      }
    });
    
    this.artists = Array.from(artistMap.values());
  },
  
  renderContent() {
    const allTracks = this.getAllTracks();
    const sortedTracks = this.sortTracks(allTracks);
    const sortedArtists = this.sortArtists();
    const stats = this.getStats();
    
    const html = `
      <div class="stream-page animate-fade-in">
        <!-- Top Played Section - 2 ROWS OF 5 CARDS -->
        <section class="stream-section">
          <div class="section-header">
            <div class="section-title-with-tabs">
              <h2 class="section-title">Top Played</h2>
              <div class="period-tabs">
                <button class="period-tab ${this.currentTopPeriod === '1d' ? 'active' : ''}" data-period="1d">1D</button>
                <button class="period-tab ${this.currentTopPeriod === '7d' ? 'active' : ''}" data-period="7d">7D</button>
                <button class="period-tab ${this.currentTopPeriod === '30d' ? 'active' : ''}" data-period="30d">30D</button>
                <button class="period-tab ${this.currentTopPeriod === '365d' ? 'active' : ''}" data-period="365d">365D</button>
              </div>
            </div>
            <button class="view-all-btn" id="view-all-top-tracks">
              View All
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
          
          <div class="top-tracks-grid">
            ${this.topTracks.length > 0 
              ? this.topTracks.map((track, index) => this.renderTopTrackCard(track, index)).join('')
              : '<div class="empty-message" style="grid-column: 1/-1;">No play data available yet. Start listening to build the charts!</div>'
            }
          </div>
        </section>
        
        <!-- Tracks / Artists Tabbed Section -->
        <section class="stream-section">
          <div class="section-header">
            <div class="tab-toggle">
              <button class="tab-btn ${this.currentTab === 'tracks' ? 'active' : ''}" data-tab="tracks">
                All Tracks
                <span class="tab-count">${allTracks.length}</span>
              </button>
              <button class="tab-btn ${this.currentTab === 'artists' ? 'active' : ''}" data-tab="artists">
                All Artists
                <span class="tab-count">${this.artists.length}</span>
              </button>
            </div>
          </div>
          
          ${this.currentTab === 'tracks' ? `
            <div class="track-list">
              ${sortedTracks.length > 0 
                ? sortedTracks.map((track, index) => this.renderTrackItem(track, index)).join('')
                : '<div class="empty-message">No tracks found</div>'
              }
            </div>
          ` : `
            <div class="artists-grid">
              ${sortedArtists.map(artist => this.renderArtistCard(artist)).join('')}
            </div>
          `}
        </section>
        
        <!-- Stats -->
        <section class="stream-section">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value" style="color: var(--accent);">${stats.releases}</div>
              <div class="stat-label">Releases</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #a855f7;">${stats.tracks}</div>
              <div class="stat-label">Tracks</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--success);">${stats.artists}</div>
              <div class="stat-label">Artists</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--warning);">${stats.sold}</div>
              <div class="stat-label">Sold</div>
            </div>
          </div>
        </section>
      </div>
      
      <style>
        .stream-section {
          margin-bottom: 32px;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .section-title-with-tabs {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .view-all-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .view-all-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        
        /* Top Tracks Grid - 2 rows of 5 cards */
        .top-tracks-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .top-tracks-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 900px) {
          .top-tracks-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 640px) {
          .top-tracks-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }
        
        /* Rank Badge */
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
        .rank-badge.rank-1 {
          background: linear-gradient(135deg, #ffd700, #ffaa00);
          box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
        }
        .rank-badge.rank-2 {
          background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
          box-shadow: 0 2px 8px rgba(192, 192, 192, 0.4);
        }
        .rank-badge.rank-3 {
          background: linear-gradient(135deg, #cd7f32, #b87333);
          box-shadow: 0 2px 8px rgba(205, 127, 50, 0.4);
        }
        .rank-badge.rank-4,
        .rank-badge.rank-5,
        .rank-badge.rank-6,
        .rank-badge.rank-7,
        .rank-badge.rank-8,
        .rank-badge.rank-9,
        .rank-badge.rank-10 {
          background: rgba(59, 130, 246, 0.9);
        }
        
        /* Play count in card footer */
        .release-card-plays {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .release-card-plays svg {
          color: var(--accent);
        }
        
        /* Period Tabs for Top Played */
        .period-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .period-tab {
          padding: 6px 12px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        .period-tab:hover {
          color: var(--text-primary);
        }
        .period-tab.active {
          background: var(--accent);
          color: white;
        }
        
        /* Tab Toggle */
        .tab-toggle {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          background: var(--accent);
          color: white;
        }
        .tab-count {
          padding: 2px 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }
        .tab-btn:not(.active) .tab-count {
          background: var(--bg-hover);
          color: var(--text-muted);
        }
        
        /* Artists Grid */
        .artists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }
        @media (min-width: 640px) {
          .artists-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 20px;
          }
        }
        .artist-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: all 150ms;
        }
        .artist-card:hover {
          transform: translateY(-4px);
          border-color: var(--border-light);
          box-shadow: var(--shadow-lg);
        }
        .artist-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: white;
          margin-bottom: 12px;
          overflow: hidden;
        }
        .artist-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .artist-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 4px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .artist-stats {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        /* Empty Message */
        .empty-message {
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
        }
        
        /* Responsive */
        @media (max-width: 640px) {
          .section-header {
            flex-direction: column;
            align-items: stretch;
          }
          .section-title-with-tabs {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .period-tabs {
            width: 100%;
          }
          .period-tab {
            flex: 1;
            text-align: center;
          }
          .tab-toggle {
            width: 100%;
          }
          .tab-btn {
            flex: 1;
            justify-content: center;
          }
          .top-track-item {
            grid-template-columns: 32px 48px 1fr auto;
            gap: 8px;
            padding: 10px 12px;
          }
          .top-track-cover {
            width: 48px;
            height: 48px;
          }
          .top-track-plays span {
            display: none;
          }
        }
      </style>
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * View all top tracks - Navigate to Analytics page with streams sort
   */
  viewAllTopTracks() {
    // Map period tabs to analytics period format
    const periodMap = {
      '1d': '24h',
      '7d': '7d',
      '30d': '30d',
      '365d': 'all'
    };
    const analyticsPeriod = periodMap[this.currentTopPeriod] || '7d';
    
    // Navigate to analytics page with streams sort
    Router.navigate('analytics', { sort: 'streams', period: analyticsPeriod });
  },
  
  sortTracks(tracks) {
    let sorted = [...tracks];
    sorted.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
    return sorted;
  },
  
  sortArtists() {
    let sorted = [...this.artists];
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  },
  
  renderArtistCard(artist) {
    const avatarUrl = this.getImageUrl(artist.avatar);
    return `
      <div class="artist-card" data-artist-address="${artist.address}">
        <div class="artist-avatar">
          ${artist.avatar 
            ? `<img src="${avatarUrl}" alt="${artist.name}">`
            : artist.name[0].toUpperCase()
          }
        </div>
        <div class="artist-name">${artist.name}</div>
        <div class="artist-stats">${artist.releaseCount} release${artist.releaseCount !== 1 ? 's' : ''}</div>
      </div>
    `;
  },
  
  renderEmpty() {
    const html = `
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <h3>Welcome to XRP Music</h3>
        <p>The decentralized music platform on the XRP Ledger</p>
      </div>
    `;
    UI.renderPage(html);
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
        <p>There was an error loading releases. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="StreamPage.render()">Retry</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  /**
   * Render a top track as a CARD with rank badge (like release cards)
   */
  renderTopTrackCard(track, index) {
    const rank = index + 1;
    // Get fresh release data from AppState (has latest soldEditions) instead of stale track.release
    const release = this.releases.find(r => r.id === track.release?.id) || track.release || {};
    const available = (release.totalEditions || 0) - (release.soldEditions || 0);
    const isSoldOut = available <= 0;
    const price = release.songPrice || release.albumPrice || 0;
    const hasCover = release.coverUrl && release.coverUrl.length > 0 && release.coverUrl !== 'null';
    const coverUrl = this.getImageUrl(release.coverUrl);
    
    return `
      <div class="release-card top-track-card" data-top-track-index="${index}">
        <div class="release-card-cover">
          ${hasCover 
            ? `<img src="${coverUrl}" alt="${track.displayTitle || 'Track'}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="rank-badge rank-${rank}">#${rank}</span>
          <span class="release-availability ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          <div class="release-play-overlay">
            <button class="release-play-btn" data-top-track-index="${index}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${track.displayTitle || 'Untitled'}</div>
          <div class="release-card-artist">${release.artistName || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(release.artistAddress) : 'Unknown Artist')}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price} XRP</span>
            <span class="release-card-plays">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              ${typeof Helpers !== 'undefined' && Helpers.formatNumber ? Helpers.formatNumber(track.plays || 0) : (track.plays || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render a top track item with rank and play count (list view - kept for View All page)
   */
  renderTopTrackItem(track, index) {
    const rank = index + 1;
    const isPlaying = AppState.player.currentTrack?.trackId === track.id || 
                      AppState.player.currentTrack?.id === parseInt(track.id);
    const coverUrl = this.getImageUrl(track.release.coverUrl);
    
    return `
      <div class="top-track-item ${isPlaying ? 'playing' : ''}" data-top-track-index="${index}">
        <div class="top-track-rank ${rank <= 3 ? 'top-3' : ''}">${rank}</div>
        <div class="top-track-cover">
          <img src="${coverUrl}" alt="${track.displayTitle}" onerror="this.src='/placeholder.png'">
          ${isPlaying && AppState.player.isPlaying ? `
            <div class="track-playing-indicator">
              <div class="track-playing-bars"><span></span><span></span><span></span></div>
            </div>
          ` : ''}
        </div>
        <div class="top-track-info">
          <div class="top-track-title">${track.displayTitle}</div>
          <div class="top-track-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
        </div>
        <div class="top-track-meta">
          <div class="top-track-plays">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            ${Helpers.formatNumber ? Helpers.formatNumber(track.plays) : track.plays.toLocaleString()}
            <span>plays</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderReleaseCard(release) {
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    const hasCover = release.coverUrl && release.coverUrl.length > 0 && release.coverUrl !== 'null';
    const coverUrl = this.getImageUrl(release.coverUrl);
    
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover">
          ${hasCover 
            ? `<img src="${coverUrl}" alt="${release.title || 'Release'}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="release-type-badge ${release.type || 'single'}">${release.type || 'single'}</span>
          <span class="release-availability ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          <div class="release-play-overlay">
            <button class="release-play-btn" data-release-id="${release.id}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title || 'Untitled'}</div>
          <div class="release-card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${price || 0} XRP</span>
            ${release.type !== 'single' ? `<span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },
  
  renderTrackItem(track, index) {
    const currentTrack = AppState.player.currentTrack;
    const trackId = track.trackId || track.id;
    const isPlaying = currentTrack && (
      currentTrack.trackId === trackId ||
      currentTrack.trackId === track.id ||
      String(currentTrack.trackId) === String(trackId) ||
      String(currentTrack.id) === String(track.id) ||
      (currentTrack.title === track.displayTitle && currentTrack.releaseId === track.release?.id)
    );
    const available = track.release.totalEditions - track.release.soldEditions;
    const isSoldOut = available <= 0;
    const coverUrl = this.getImageUrl(track.release.coverUrl);
    
    return `
      <div class="track-item ${isPlaying ? 'playing' : ''}" data-track-index="${index}">
        <div class="track-cover">
          <img src="${coverUrl}" alt="${track.displayTitle}" onerror="this.src='/placeholder.png'">
          ${isPlaying && AppState.player.isPlaying ? `
            <div class="track-playing-indicator">
              <div class="track-playing-bars"><span></span><span></span><span></span></div>
            </div>
          ` : ''}
        </div>
        <div class="track-info">
          <div class="track-title">${track.displayTitle}</div>
          <div class="track-artist">${track.release.artistName || Helpers.truncateAddress(track.release.artistAddress)}</div>
        </div>
        <div class="track-meta">
          <div>
            <div class="track-price">${track.release.songPrice} XRP</div>
            <div class="track-availability ${isSoldOut ? 'sold-out' : ''} ${available < 10 && !isSoldOut ? 'low' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;
  },
  
  getAllTracks() {
    return this.releases.flatMap(release => 
      (release.tracks || []).map((track, idx) => ({
        ...track,
        release,
        trackIndex: idx,
        displayTitle: release.type === 'single' ? release.title : track.title,
      }))
    );
  },
  
  getStats() {
    const uniqueArtists = new Set(this.releases.map(r => r.artistAddress));
    const totalTracks = this.releases.reduce((sum, r) => sum + (r.tracks?.length || 0), 0);
    const totalSold = this.releases.reduce((sum, r) => sum + r.soldEditions, 0);
    
    return {
      releases: this.releases.length,
      tracks: totalTracks,
      artists: uniqueArtists.size,
      sold: totalSold,
    };
  },
  
  bindEvents() {
    // Period tabs for Top Played
    document.querySelectorAll('.period-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        const newPeriod = tab.dataset.period;
        if (newPeriod !== this.currentTopPeriod) {
          this.currentTopPeriod = newPeriod;
          await this.loadTopTracks();
          this.renderContent();
        }
      });
    });
    
    // View All button for Top Tracks - Navigate to Analytics
    document.getElementById('view-all-top-tracks')?.addEventListener('click', () => {
      this.viewAllTopTracks();
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTab = btn.dataset.tab;
        if (newTab !== this.currentTab) {
          this.currentTab = newTab;
          this.renderContent();
        }
      });
    });
    
    // Release cards (if any exist on page)
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // Play buttons on release cards
    document.querySelectorAll('.release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release?.tracks?.length > 0) this.playRelease(release);
      });
    });
    
    // Top track cards (click card to open release modal)
    document.querySelectorAll('.top-track-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.release-play-btn')) return;
        const index = parseInt(card.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track?.release) {
          const fullRelease = this.releases.find(r => r.id === track.release.id);
          Modals.showRelease(fullRelease || track.release);
        }
      });
    });
    
    // Play buttons on top track cards
    document.querySelectorAll('.top-track-card .release-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track) this.playTrack(track, this.topTracks, index);
      });
    });
    
    // Track items (list view)
    document.querySelectorAll('.track-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const allTracks = this.sortTracks(this.getAllTracks());
        const track = allTracks[index];
        if (track) this.playTrack(track, allTracks, index);
      });
    });
    
    // Artist cards
    document.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        const address = card.dataset.artistAddress;
        if (address) Router.navigate('artist', { address });
      });
    });
  },
  
  playRelease(release) {
    if (!release.tracks?.length) return;
    const coverUrl = this.getImageUrl(release.coverUrl);
    const queue = release.tracks.map((t, idx) => ({
      id: parseInt(t.id) || idx,
      trackId: t.id,
      title: release.type === 'single' ? release.title : t.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: coverUrl,
      ipfsHash: t.audioCid,
      releaseId: release.id,
      duration: t.duration,
    }));
    Player.playTrack(queue[0], queue, 0);
  },
  
  playTrack(trackData, allTracks, index) {
    const queue = allTracks.map(t => ({
      id: parseInt(t.id) || 0,
      trackId: t.trackId || t.id,
      title: t.displayTitle || t.title,
      artist: t.release?.artistName || Helpers.truncateAddress(t.release?.artistAddress),
      cover: this.getImageUrl(t.release?.coverUrl),
      ipfsHash: t.audioCid,
      releaseId: t.release?.id || t.releaseId,
      duration: t.duration,
    }));
    Player.playTrack(queue[index], queue, index);
  },
};
