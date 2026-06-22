/**
 * XRP Music - Analytics Page
 * Site-wide viewership analytics, playlist-styled.
 *
 * Features:
 * - Metric toggle: Most Streamed ⇄ Most Bought
 * - Time period filters (24H, 7D, 30D, 1Y, ALL)
 * - Search/filter bar
 * - Playlist-style layout (big header + clean rows)
 * - Accessible from Music ("View All") and Marketplace
 */

const AnalyticsPage = {
  tracks: [],
  releases: [],
  playCounts: {},
  uniqueListeners: {},
  isLoading: true,

  // Current state
  sortBy: 'streams', // 'streams' | 'sales' (also supports 'newest','scarce','price','name','listeners' via search/sort)
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

    // Normalize incoming sort to a supported metric for the toggle
    if (this.sortBy !== 'streams' && this.sortBy !== 'sales') {
      // 'top-selling','newest','scarce' etc → default the visible metric sensibly
      if (this.sortBy === 'top-selling') this.sortBy = 'sales';
      else if (this.sortBy === 'streams') this.sortBy = 'streams';
      // anything else falls through to streams as the headline metric
      else if (this.sortBy !== 'sales') this.sortBy = 'streams';
    }

    UI.showLoading();
    this.isLoading = true;

    try {
      const [releases] = await Promise.all([
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

      this.playCounts = {};
      this.uniqueListeners = {};

      if (data.tracks) {
        data.tracks.forEach(t => {
          this.playCounts[t.trackId] = t.plays || 0;
        });
      }

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
      console.log('Unique listeners not available');
    }
  },

  /**
   * Build flat track list from releases
   */
  buildTrackList() {
    this.tracks = [];

    this.releases.forEach(release => {
      const isForSale = release.sellOfferIndex || release.mintFeePaid || release.status === 'live';
      if (!isForSale) return;

      (release.tracks || []).forEach((track) => {
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

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.artistName.toLowerCase().includes(query)
      );
    }

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
   * Period label for the header line
   */
  periodLabel() {
    switch (this.period) {
      case '1d': return 'past 24 hours';
      case '7d': return 'past 7 days';
      case '30d': return 'past 30 days';
      case '365d': return 'past year';
      case 'all': return 'all time';
      default: return '';
    }
  },

  /**
   * Render the page
   */
  renderContent() {
    const tracks = this.getSortedTracks();
    const totalStreams = this.tracks.reduce((sum, t) => sum + t.streams, 0);
    const totalSales = this.tracks.reduce((sum, t) => sum + t.soldEditions, 0);

    const metricVerb = this.sortBy === 'sales' ? 'Most Bought' : 'Most Streamed';
    const metaLine = `${this.tracks.length} tracks · ${totalStreams.toLocaleString()} streams · ${totalSales.toLocaleString()} sales · ${this.periodLabel()}`;

    const html = `
      <div class="analytics-page animate-fade-in">

        <!-- Playlist-style header -->
        <div class="al-hero">
          <div class="al-hero-art">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <div class="al-hero-info">
            <div class="al-eyebrow">Analytics</div>
            <h1 class="al-title">${metricVerb}</h1>
            <p class="al-meta">${metaLine}</p>
          </div>
        </div>

        <!-- Controls: metric toggle + period -->
        <div class="al-controls">
          <div class="al-metric-toggle">
            <button class="al-metric-btn ${this.sortBy === 'streams' ? 'active' : ''}" data-metric="streams">
              <span class="al-metric-icon">▶</span> Most Streamed
            </button>
            <button class="al-metric-btn ${this.sortBy === 'sales' ? 'active' : ''}" data-metric="sales">
              <span class="al-metric-icon">💰</span> Most Bought
            </button>
          </div>

          <div class="al-period-tabs">
            <button class="al-period-btn ${this.period === '1d' ? 'active' : ''}" data-period="1d">24H</button>
            <button class="al-period-btn ${this.period === '7d' ? 'active' : ''}" data-period="7d">7D</button>
            <button class="al-period-btn ${this.period === '30d' ? 'active' : ''}" data-period="30d">30D</button>
            <button class="al-period-btn ${this.period === '365d' ? 'active' : ''}" data-period="365d">1Y</button>
            <button class="al-period-btn ${this.period === 'all' ? 'active' : ''}" data-period="all">ALL</button>
          </div>
        </div>

        <!-- Search -->
        <div class="al-search-wrapper">
          <svg class="al-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            id="analytics-search"
            class="al-search-input"
            placeholder="Search tracks or artists..."
            value="${this.searchQuery.replace(/"/g, '&quot;')}"
          >
          ${this.searchQuery ? `
            <button class="al-search-clear" id="clear-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ` : ''}
          ${this.searchQuery ? `<span class="al-results-count">${tracks.length} results</span>` : ''}
        </div>

        <!-- Column header row -->
        <div class="al-list-head">
          <span class="al-h-rank">#</span>
          <span class="al-h-title">Title</span>
          <span class="al-h-secondary">${this.sortBy === 'sales' ? 'Streams' : 'Sold'}</span>
          <span class="al-h-metric">${this.sortBy === 'sales' ? 'Sold' : 'Plays'}</span>
        </div>

        <!-- Rows -->
        <div class="al-list">
          ${tracks.length > 0
            ? tracks.map((track, idx) => this.renderTrackRow(track, idx + 1)).join('')
            : `<div class="al-empty">No tracks found</div>`
          }
        </div>
      </div>

      ${this.getStyles()}
    `;

    UI.renderPage(html);
    this.bindEvents();
  },

  /**
   * Render a single playlist-style row
   */
  renderTrackRow(track, rank) {
    const coverUrl = this.getImageUrl(track.coverUrl);
    const isSales = this.sortBy === 'sales';

    // Primary metric (right-most, emphasized) + secondary metric
    const primaryVal = isSales ? track.soldEditions : track.streams;
    const primaryLabel = isSales ? 'sold' : 'plays';
    const secondaryVal = isSales ? track.streams : track.soldEditions;

    const isSoldOut = track.remaining === 0;

    return `
      <div class="al-row" data-track-id="${track.trackId}" data-release-id="${track.releaseId}" data-track-index="${rank - 1}">
        <div class="al-rank">
          <span class="al-rank-num ${rank <= 3 ? 'top-3' : ''}">${rank}</span>
          <button class="al-row-play" data-track-index="${rank - 1}" title="Play">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
        <div class="al-cell-title">
          <img src="${coverUrl}" alt="${track.title}" class="al-cover" onerror="this.src='/placeholder.png'">
          <div class="al-titles">
            <div class="al-track-title">${track.title}</div>
            <div class="al-track-artist">${track.artistName}</div>
          </div>
        </div>
        <div class="al-secondary">
          <span class="al-secondary-val">${secondaryVal.toLocaleString()}</span>
        </div>
        <div class="al-metric">
          <span class="al-metric-val">${primaryVal.toLocaleString()}</span>
          <span class="al-metric-unit">${primaryLabel}</span>
          ${isSales && isSoldOut ? `<span class="al-soldout">SOLD OUT</span>` : ''}
        </div>
      </div>
    `;
  },

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
    // Metric toggle (Most Streamed / Most Bought)
    document.querySelectorAll('.al-metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const metric = btn.dataset.metric;
        if (metric !== this.sortBy) {
          this.sortBy = metric;
          this.sortDir = 'desc';
          this.renderContent();
        }
      });
    });

    // Period tabs
    document.querySelectorAll('.al-period-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newPeriod = btn.dataset.period;
        if (newPeriod === this.period) return;
        this.period = newPeriod;
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

    // Row click → open release modal
    document.querySelectorAll('.al-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.al-row-play')) return;
        const releaseId = row.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
        }
      });
    });

    // Play buttons
    document.querySelectorAll('.al-row-play').forEach(btn => {
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

  playTrack(track) {
    const release = this.releases.find(r => r.id === track.releaseId);
    if (release) {
      StreamPage.playRelease(release);
    }
  },

  getStyles() {
    return `
      <style>
        .analytics-page { padding-bottom: 120px; }

        /* ── Hero ── */
        .al-hero {
          display: flex;
          align-items: flex-end;
          gap: 24px;
          margin-bottom: 28px;
        }
        .al-hero-art {
          width: 180px;
          height: 180px;
          border-radius: var(--radius-xl);
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
        }
        .al-hero-info { flex: 1; min-width: 0; }
        .al-eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 10px;
        }
        .al-title {
          font-size: 56px;
          line-height: 1.02;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 14px 0;
          letter-spacing: -1px;
        }
        .al-meta { font-size: 14px; color: var(--text-secondary); margin: 0; }

        @media (max-width: 640px) {
          .al-hero { flex-direction: column; align-items: flex-start; gap: 16px; }
          .al-hero-art { width: 140px; height: 140px; }
          .al-title { font-size: 36px; }
        }

        /* ── Controls ── */
        .al-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .al-metric-toggle {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .al-metric-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 18px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms;
        }
        .al-metric-btn:hover { color: var(--text-primary); }
        .al-metric-btn.active { background: var(--accent); color: white; }
        .al-metric-icon { font-size: 13px; }

        .al-period-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
        }
        .al-period-btn {
          padding: 8px 14px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 150ms;
        }
        .al-period-btn:hover { color: var(--text-primary); }
        .al-period-btn.active { background: var(--accent); color: white; }

        @media (max-width: 640px) {
          .al-controls { flex-direction: column; align-items: stretch; }
          .al-metric-toggle, .al-period-tabs { width: 100%; }
          .al-metric-btn, .al-period-btn { flex: 1; justify-content: center; }
        }

        /* ── Search ── */
        .al-search-wrapper {
          position: relative;
          max-width: 420px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
        }
        .al-search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .al-search-input {
          width: 100%;
          padding: 11px 40px 11px 42px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 14px;
          transition: all 150ms;
        }
        .al-search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .al-search-input::placeholder { color: var(--text-muted); }
        .al-search-clear {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          border-radius: 50%;
          transition: all 150ms;
        }
        .al-search-clear:hover { color: var(--text-primary); background: var(--bg-hover); }
        .al-results-count {
          position: absolute;
          right: 44px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* ── List header ── */
        .al-list-head {
          display: grid;
          grid-template-columns: 48px 1fr 110px 130px;
          align-items: center;
          gap: 12px;
          padding: 0 16px 10px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-muted);
        }
        .al-h-rank { text-align: center; }
        .al-h-secondary, .al-h-metric { text-align: right; }

        /* ── Rows ── */
        .al-list { display: flex; flex-direction: column; }
        .al-row {
          display: grid;
          grid-template-columns: 48px 1fr 110px 130px;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background 150ms;
        }
        .al-row:hover { background: var(--bg-hover); }

        .al-rank { position: relative; text-align: center; }
        .al-rank-num { font-size: 15px; font-weight: 700; color: var(--text-muted); }
        .al-rank-num.top-3 { color: var(--accent); }
        .al-row-play {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
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
        .al-row:hover .al-rank-num { opacity: 0; }
        .al-row:hover .al-row-play { opacity: 1; }

        .al-cell-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .al-cover {
          width: 44px; height: 44px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .al-titles { min-width: 0; }
        .al-track-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .al-track-artist {
          font-size: 13px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .al-secondary { text-align: right; }
        .al-secondary-val { font-size: 14px; color: var(--text-secondary); font-weight: 500; }

        .al-metric { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
        .al-metric-val { font-size: 16px; font-weight: 700; color: var(--text-primary); }
        .al-metric-unit { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
        .al-soldout { font-size: 10px; font-weight: 700; color: var(--error); }

        .al-empty {
          padding: 60px 20px;
          text-align: center;
          color: var(--text-muted);
          background: var(--bg-card);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
        }

        @media (max-width: 640px) {
          .al-list-head, .al-row { grid-template-columns: 36px 1fr 90px; }
          .al-h-secondary, .al-secondary { display: none; }
        }
      </style>
    `;
  }
};
