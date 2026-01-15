/**
 * XRP Music - Analytics Page
 * Master data view for all tracks - "The Excel Sheet"
 * 
 * Features:
 * - Sortable columns (click headers)
 * - Time period filters (1D, 7D, 30D, 365D, All)
 * - Search/filter bar
 * - Accessible from Stream and Marketplace "View All"
 */

const AnalyticsPage = {
  tracks: [],
  releases: [],
  playCounts: {},
  uniqueListeners: {},
  isLoading: true,
  
  // Current state
  sortBy: 'streams', // 'streams', 'sales', 'newest', 'scarce', 'price', 'name'
  sortDir: 'desc',   // 'asc' or 'desc'
  period: '7d',      // '1d', '7d', '30d', '365d', 'all'
  searchQuery: '',
  
  // Helper to get proxied image URL
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },
  
  /**
   * Initialize with optional sort preset
   * Called from Router or other pages
   */
  async render(params = {}) {
    // Apply presets if provided
    if (params.sort) this.sortBy = params.sort;
    if (params.period) this.period = params.period;
    if (params.dir) this.sortDir = params.dir;
    
    UI.showLoading();
    this.isLoading = true;
    
    try {
      // Fetch releases and play data in parallel
      const [releases, playData] = await Promise.all([
        API.getReleases(),
        this.fetchPlayData()
      ]);
      
      this.releases = releases;
      this.buildTrackList();
      this.isLoading = false;
      this.renderContent();
    } catch (error) {
      console.error('Failed to load analytics:', error);
      this.renderError();
    }
  },
  
  /**
   * Fetch play counts for current period
   */
  async fetchPlayData() {
    try {
      const response = await fetch(`/api/plays?action=top&period=${this.period}&limit=1000`);
      const data = await response.json();
      
      // Build play count map
      this.playCounts = {};
      this.uniqueListeners = {};
      
      if (data.tracks) {
        data.tracks.forEach(t => {
          this.playCounts[t.trackId] = t.plays || 0;
        });
      }
      
      // Also fetch unique listener counts
      await this.fetchUniqueListeners();
      
      return data;
    } catch (e) {
      console.error('Failed to fetch play data:', e);
      return { tracks: [] };
    }
  },
  
  /**
   * Fetch unique listener counts per track
   */
  async fetchUniqueListeners() {
    try {
      const response = await fetch(`/api/plays?action=unique&period=${this.period}`);
      const data = await response.json();
      if (data.listeners) {
        this.uniqueListeners = data.listeners;
      }
    } catch (e) {
      // Unique listeners endpoint might not exist yet, that's ok
      console.log('Unique listeners not available');
    }
  },
  
  /**
   * Build flat track list from releases
   */
  buildTrackList() {
    this.tracks = [];
    
    this.releases.forEach(release => {
      // Only include releases that are for sale
      const isForSale = release.sellOfferIndex || release.mintFeePaid || release.status === 'live';
      if (!isForSale) return;
      
      (release.tracks || []).forEach((track, idx) => {
        const trackId = track.id;
        this.tracks.push({
          trackId: trackId,
          releaseId: release.id,
          title: release.type === 'single' ? release.title : track.title,
          artistName: release.artistName || 'Unknown',
          artistAddress: release.artistAddress,
          coverUrl: release.coverUrl,
          price: release.songPrice || release.albumPrice || 0,
          totalEditions: release.totalEditions || 0,
          soldEditions: release.soldEditions || 0,
          remaining: (release.totalEditions || 0) - (release.soldEditions || 0),
          streams: this.playCounts[trackId] || 0,
          uniqueListeners: this.uniqueListeners[trackId] || 0,
          createdAt: release.createdAt,
          type: release.type,
          audioCid: track.audioCid,
          duration: track.duration,
        });
      });
    });
  },
  
  /**
   * Get sorted and filtered tracks
   */
  getSortedTracks() {
    let filtered = [...this.tracks];
    
    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.artistName.toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (this.sortBy) {
        case 'streams':
          aVal = a.streams;
          bVal = b.streams;
          break;
        case 'sales':
          aVal = a.soldEditions;
          bVal = b.soldEditions;
          break;
        case 'newest':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'scarce':
          aVal = a.remaining;
          bVal = b.remaining;
          // For scarcity, lower is "more scarce" so we flip the comparison
          return this.sortDir === 'desc' ? aVal - bVal : bVal - aVal;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'name':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          return this.sortDir === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        case 'listeners':
          aVal = a.uniqueListeners;
          bVal = b.uniqueListeners;
          break;
        default:
          aVal = a.streams;
          bVal = b.streams;
      }
      
      return this.sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return filtered;
  },
  
  /**
   * Render the page
   */
  renderContent() {
    const tracks = this.getSortedTracks();
    const totalStreams = this.tracks.reduce((sum, t) => sum + t.streams, 0);
    const totalSales = this.tracks.reduce((sum, t) => sum + t.soldEditions, 0);
    
    const html = `
      <div class="analytics-page animate-fade-in">
        <!-- Header -->
        <div class="analytics-header">
          <div class="header-left">
            <h1 class="page-title">📊 Analytics</h1>
            <p class="page-subtitle">${this.tracks.length} tracks · ${totalStreams.toLocaleString()} streams · ${totalSales} sales</p>
          </div>
          
          <!-- Period Tabs -->
          <div class="period-tabs">
            <button class="period-btn ${this.period === '1d' ? 'active' : ''}" data-period="1d">24H</button>
            <button class="period-btn ${this.period === '7d' ? 'active' : ''}" data-period="7d">7D</button>
            <button class="period-btn ${this.period === '30d' ? 'active' : ''}" data-period="30d">30D</button>
            <button class="period-btn ${this.period === '365d' ? 'active' : ''}" data-period="365d">1Y</button>
            <button class="period-btn ${this.period === 'all' ? 'active' : ''}" data-period="all">ALL</button>
          </div>
        </div>
        
        <!-- Search Bar -->
        <div class="search-bar-container">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              id="analytics-search" 
              class="search-input" 
              placeholder="Search tracks or artists..."
              value="${this.searchQuery}"
            >
            ${this.searchQuery ? `
              <button class="search-clear" id="clear-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="search-results-count">
            ${this.searchQuery ? `${tracks.length} results` : ''}
          </div>
        </div>
        
        <!-- Data Table -->
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th class="col-cover"></th>
                <th class="col-title sortable ${this.sortBy === 'name' ? 'active' : ''}" data-sort="name">
                  Title
                  ${this.renderSortIcon('name')}
                </th>
                <th class="col-artist">Artist</th>
                <th class="col-streams sortable ${this.sortBy === 'streams' ? 'active' : ''}" data-sort="streams">
                  <span class="col-header-icon">▶</span> Streams
                  ${this.renderSortIcon('streams')}
                </th>
                <th class="col-sales sortable ${this.sortBy === 'sales' ? 'active' : ''}" data-sort="sales">
                  <span class="col-header-icon">💰</span> Sales
                  ${this.renderSortIcon('sales')}
                </th>
                <th class="col-remaining sortable ${this.sortBy === 'scarce' ? 'active' : ''}" data-sort="scarce">
                  <span class="col-header-icon">📦</span> Left
                  ${this.renderSortIcon('scarce')}
                </th>
                <th class="col-listeners sortable ${this.sortBy === 'listeners' ? 'active' : ''}" data-sort="listeners">
                  <span class="col-header-icon">👥</span> Listeners
                  ${this.renderSortIcon('listeners')}
                </th>
                <th class="col-price sortable ${this.sortBy === 'price' ? 'active' : ''}" data-sort="price">
                  Price
                  ${this.renderSortIcon('price')}
                </th>
                <th class="col-date sortable ${this.sortBy === 'newest' ? 'active' : ''}" data-sort="newest">
                  Dropped
                  ${this.renderSortIcon('newest')}
                </th>
              </tr>
            </thead>
            <tbody>
              ${tracks.length > 0 
                ? tracks.map((track, idx) => this.renderTrackRow(track, idx + 1)).join('')
                : `<tr><td colspan="10" class="empty-message">No tracks found</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      
      ${this.getStyles()}
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  /**
   * Render sort indicator icon
   */
  renderSortIcon(column) {
    if (this.sortBy !== column) {
      return `<span class="sort-icon inactive">↕</span>`;
    }
    return `<span class="sort-icon active">${this.sortDir === 'desc' ? '↓' : '↑'}</span>`;
  },
  
  /**
   * Render a track row
   */
  renderTrackRow(track, rank) {
    const coverUrl = this.getImageUrl(track.coverUrl);
    const date = new Date(track.createdAt);
    const isLowStock = track.remaining <= 10 && track.remaining > 0;
    const isSoldOut = track.remaining === 0;
    
    // Highlight class for search matches
    const highlightClass = this.searchQuery ? 'search-match' : '';
    
    return `
      <tr class="track-row ${highlightClass}" data-track-id="${track.trackId}" data-release-id="${track.releaseId}">
        <td class="col-rank">
          <span class="rank-number ${rank <= 3 ? 'top-3' : ''}">${rank}</span>
        </td>
        <td class="col-cover">
          <img src="${coverUrl}" alt="${track.title}" class="cover-thumb" onerror="this.src='/placeholder.png'">
          <button class="row-play-btn" data-track-index="${rank - 1}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </td>
        <td class="col-title">
          <div class="title-cell">
            <span class="track-title">${track.title}</span>
            <span class="track-type ${track.type}">${track.type}</span>
          </div>
        </td>
        <td class="col-artist">${track.artistName}</td>
        <td class="col-streams">
          <span class="stat-value">${track.streams.toLocaleString()}</span>
        </td>
        <td class="col-sales">
          <span class="stat-value">${track.soldEditions}</span>
        </td>
        <td class="col-remaining">
          <span class="stat-value ${isLowStock ? 'low-stock' : ''} ${isSoldOut ? 'sold-out' : ''}">
            ${isSoldOut ? 'SOLD OUT' : track.remaining.toLocaleString()}
          </span>
        </td>
        <td class="col-listeners">
          <span class="stat-value">${track.uniqueListeners.toLocaleString()}</span>
        </td>
        <td class="col-price">
          <span class="price-value">${track.price} XRP</span>
        </td>
        <td class="col-date">
          <span class="date-value">${this.formatDate(date)}</span>
        </td>
      </tr>
    `;
  },
  
  /**
   * Format date
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
        <p>There was an error loading analytics. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="AnalyticsPage.render()">Retry</button>
      </div>
    `;
    UI.renderPage(html);
  },
  
  /**
   * Bind events
   */
  bindEvents() {
    // Period tabs
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.period = btn.dataset.period;
        await this.fetchPlayData();
        this.buildTrackList();
        this.renderContent();
      });
    });
    
    // Search input
    const searchInput = document.getElementById('analytics-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderContent();
        // Re-focus and restore cursor position
        const newInput = document.getElementById('analytics-search');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
        }
      });
    }
    
    // Clear search
    document.getElementById('clear-search')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.renderContent();
      document.getElementById('analytics-search')?.focus();
    });
    
    // Sortable column headers
    document.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const newSort = th.dataset.sort;
        if (this.sortBy === newSort) {
          // Toggle direction
          this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          this.sortBy = newSort;
          // Default directions
          this.sortDir = (newSort === 'name' || newSort === 'scarce') ? 'asc' : 'desc';
        }
        this.renderContent();
      });
    });
    
    // Track rows - click to open release modal
    document.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking play button
        if (e.target.closest('.row-play-btn')) return;
        
        const releaseId = row.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
        }
      });
    });
    
    // Play buttons
    document.querySelectorAll('.row-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.trackIndex);
        const tracks = this.getSortedTracks();
        const track = tracks[index];
        if (track) {
          this.playTrack(track);
        }
      });
    });
  },
  
  /**
   * Play a track
   */
  playTrack(track) {
    const release = this.releases.find(r => r.id === track.releaseId);
    if (release) {
      StreamPage.playRelease(release);
    }
  },
  
  /**
   * Get styles
   */
  getStyles() {
    return `
      <style>
        .analytics-page {
          padding-bottom: 100px;
        }
        
        .analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        
        .header-left {
          flex: 1;
        }
        
        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }
        
        .page-subtitle {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }
        
        /* Period Tabs */
        .period-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        
        .period-btn {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .period-btn:hover {
          color: var(--text-primary);
        }
        
        .period-btn.active {
          background: var(--accent);
          color: white;
        }
        
        /* Search Bar */
        .search-bar-container {
          margin-bottom: 20px;
        }
        
        .search-input-wrapper {
          position: relative;
          max-width: 400px;
        }
        
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        
        .search-input {
          width: 100%;
          padding: 12px 40px 12px 44px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 14px;
          transition: all 150ms;
        }
        
        .search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .search-input::placeholder {
          color: var(--text-muted);
        }
        
        .search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 150ms;
        }
        
        .search-clear:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        
        .search-results-count {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 8px;
          height: 16px;
        }
        
        /* Data Table */
        .data-table-container {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .data-table thead {
          background: var(--bg-hover);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .data-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }
        
        .data-table th.sortable {
          cursor: pointer;
          user-select: none;
          transition: color 150ms;
        }
        
        .data-table th.sortable:hover {
          color: var(--text-primary);
        }
        
        .data-table th.sortable.active {
          color: var(--accent);
        }
        
        .sort-icon {
          margin-left: 4px;
          font-size: 10px;
        }
        
        .sort-icon.inactive {
          opacity: 0.3;
        }
        
        .sort-icon.active {
          color: var(--accent);
        }
        
        .col-header-icon {
          margin-right: 4px;
        }
        
        .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
        }
        
        .track-row {
          cursor: pointer;
          transition: background 150ms;
        }
        
        .track-row:hover {
          background: var(--bg-hover);
        }
        
        .track-row:last-child td {
          border-bottom: none;
        }
        
        /* Column styles */
        .col-rank {
          width: 50px;
          text-align: center;
        }
        
        .rank-number {
          font-weight: 700;
          color: var(--text-muted);
        }
        
        .rank-number.top-3 {
          color: var(--accent);
        }
        
        .col-cover {
          width: 56px;
          position: relative;
        }
        
        .cover-thumb {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: cover;
        }
        
        .row-play-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 150ms;
        }
        
        .track-row:hover .row-play-btn {
          opacity: 1;
        }
        
        .col-title {
          min-width: 200px;
        }
        
        .title-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .track-title {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .track-type {
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 600;
          border-radius: 4px;
          text-transform: uppercase;
        }
        
        .track-type.single {
          background: rgba(34, 197, 94, 0.2);
          color: var(--success);
        }
        
        .track-type.album {
          background: rgba(168, 85, 247, 0.2);
          color: #a855f7;
        }
        
        .col-artist {
          color: var(--text-secondary);
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .stat-value {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .stat-value.low-stock {
          color: var(--warning);
        }
        
        .stat-value.sold-out {
          color: var(--error);
          font-size: 10px;
        }
        
        .price-value {
          font-weight: 600;
          color: var(--success);
        }
        
        .date-value {
          color: var(--text-muted);
        }
        
        .empty-message {
          text-align: center;
          padding: 60px 20px !important;
          color: var(--text-muted);
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
          .col-listeners, .col-date {
            display: none;
          }
        }
        
        @media (max-width: 768px) {
          .analytics-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .period-tabs {
            width: 100%;
            justify-content: center;
          }
          
          .search-input-wrapper {
            max-width: 100%;
          }
          
          .col-artist, .col-price {
            display: none;
          }
          
          .data-table th, .data-table td {
            padding: 10px 8px;
          }
          
          .col-title {
            min-width: 120px;
          }
        }
        
        @media (max-width: 480px) {
          .col-remaining {
            display: none;
          }
          
          .page-title {
            font-size: 22px;
          }
        }
      </style>
    `;
  }
};
