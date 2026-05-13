/**
 * XRP Music - Music Page (formerly "Stream")
 * Unified discovery + marketplace for music
 *
 * v3 (May 2026):
 * ✅ Merged with Marketplace sections — one place for all music
 * ✅ Music-only filter (films/audiobooks/podcasts/games have dedicated pages)
 *
 * SECTION ORDER:
 *   1. Market Type Toggle  [From Artists | Resale Market]
 *   2. Top Played          (plays — discovery)
 *   3. Top Selling         (sales — marketplace)
 *   4. Newest Drops        (recent — marketplace)
 *   5. Top Artists         (volume — marketplace)
 *   6. Emerging Artists    (20+ XRP, low sales — marketplace)
 *   7. Get Them Before They're Gone  (scarcity — marketplace)
 *   8. All Tracks / All Artists  (full catalog — discovery)
 *   9. Stats
 */

const StreamPage = {
  releases: [],
  artists: [],
  topTracks: [],
  secondaryListings: [],
  currentTab: 'artists',
  currentTopPeriod: '7d',
  marketType: 'primary',
  
  // Content types EXCLUDED from this page (have dedicated pages elsewhere)
  _NON_MUSIC_TYPES: ['film', 'video', 'audiobook', 'podcast', 'game'],
  
  isMusicRelease(release) {
    const ct = (release?.contentType || release?.content_type || '').toLowerCase();
    return !this._NON_MUSIC_TYPES.includes(ct);
  },
  
  isMusicListing(listing) {
    const ct = (listing?.content_type || listing?.contentType || '').toLowerCase();
    return !this._NON_MUSIC_TYPES.includes(ct);
  },
  
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    return typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(url) : url;
  },
  
  isForSale(release) {
    return release.sellOfferIndex || release.mintFeePaid || release.status === 'live';
  },
  
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
      
      // ⚡ MUSIC-ONLY FILTER
      const allReleases = releases || [];
      this.releases = allReleases.filter(r => this.isMusicRelease(r));
      
      const allListings = listingsResponse.listings || [];
      this.secondaryListings = allListings.filter(l => this.isMusicListing(l));
      
      console.log(
        `🎵 Music: ${allReleases.length} releases → ${this.releases.length} music | ` +
        `${allListings.length} listings → ${this.secondaryListings.length} music resale`
      );
      
      setReleases(this.releases);
      this.extractArtists();
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
  
  async loadTopTracks() {
    try {
      if (typeof API.getTopTracks === 'function') {
        const topTracks = await API.getTopTracks(this.currentTopPeriod, 10);
        
        if (topTracks && topTracks.length > 0) {
          const musicTopTracks = topTracks.filter(item => this.isMusicRelease(item.release));
          
          this.topTracks = musicTopTracks.map(item => ({
            id: item.trackId,
            trackId: item.trackId,
            displayTitle: item.track?.title || item.release?.title || 'Unknown',
            audioCid: item.track?.audioCid,
            duration: item.track?.duration,
            videoUrl: item.track?.videoUrl || null,
            videoCid: item.track?.videoCid || null,
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
              tracks: item.release?.tracks || [],
              contentType: item.release?.contentType || item.release?.content_type,
              mintFeePaid: item.release?.mintFeePaid,
              mint_fee_paid: item.release?.mint_fee_paid,
              isMinted: item.release?.isMinted,
              is_minted: item.release?.is_minted,
              status: item.release?.status,
              createdAt: item.release?.createdAt,
              created_at: item.release?.created_at,
            }
          }));
          
          console.log(`📊 Loaded ${this.topTracks.length} top music tracks for ${this.currentTopPeriod}`);
          return;
        }
      }
    } catch (e) {
      console.log('Top tracks API not available:', e.message);
    }
    
    console.log('📊 No play data yet, showing tracks by sales as fallback');
    
    try {
      const feedReleases = await API.getReleasesFeed();
      const musicFeed = (feedReleases || []).filter(r => this.isMusicRelease(r));
      const feedTracks = musicFeed.flatMap(release =>
        (release.tracks || []).map((track, idx) => ({
          ...track,
          release,
          trackIndex: idx,
          displayTitle: release.type === 'single' ? release.title : track.title,
        }))
      );
      
      this.topTracks = feedTracks
        .map(track => ({ ...track, plays: track.release.soldEditions || 0 }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);
    } catch (e) {
      const allTracks = this.getAllTracks();
      this.topTracks = allTracks
        .map(track => ({ ...track, plays: track.release.soldEditions || 0 }))
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
        });
      } else {
        const artist = artistMap.get(release.artistAddress);
        artist.releaseCount++;
        artist.trackCount += release.tracks?.length || 0;
        artist.totalSold += release.soldEditions || 0;
      }
    });
    
    this.artists = Array.from(artistMap.values());
  },
  
  hasVideo(release) {
    return release?.tracks?.some(t => t.videoUrl || t.videoCid);
  },
  
  trackHasVideo(track) {
    if (track.videoUrl || track.videoCid) return true;
    const rel = track.release;
    if (rel?.tracks) {
      const match = rel.tracks.find(t => String(t.id) === String(track.trackId || track.id));
      if (match && (match.videoUrl || match.videoCid)) return true;
    }
    return false;
  },
  
  // ─── MARKETPLACE DATA METHODS ──────────────────────────────
  
  getAvailableReleases() {
    return this.releases.filter(r => 
      this.isForSale(r) && (r.totalEditions - r.soldEditions) > 0
    );
  },
  
  getTopSelling(limit = 5) {
    return [...this.getAvailableReleases()]
      .sort((a, b) => (b.soldEditions || 0) - (a.soldEditions || 0))
      .slice(0, limit);
  },
  
  getNewestDrops(limit = 5) {
    return [...this.getAvailableReleases()]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },
  
  getScarceReleases(limit = 5) {
    const available = [...this.getAvailableReleases()]
      .map(r => ({ ...r, remaining: r.totalEditions - r.soldEditions }))
      .sort((a, b) => a.remaining - b.remaining);
    
    const seen = new Set();
    const result = [];
    for (const r of available) {
      if (seen.has(r.artistAddress)) continue;
      seen.add(r.artistAddress);
      result.push(r);
      if (result.length >= limit) break;
    }
    return result;
  },
  
  _buildArtistMap() {
    const artistMap = {};
    this.releases.forEach(r => {
      const key = r.artistAddress;
      if (!key) return;
      if (!artistMap[key]) {
        artistMap[key] = {
          name: r.artistName || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(r.artistAddress) : r.artistAddress),
          address: r.artistAddress,
          avatar: r.artistAvatar || null,
          coverUrl: r.coverUrl,
          totalSold: 0,
          totalVolume: 0,
          releaseCount: 0,
          trackCount: 0,
        };
      }
      const a = artistMap[key];
      
      if (r.status === 'draft') return;
      
      a.releaseCount++;
      a.trackCount += r.tracks?.length || 0;
      if (r.coverUrl) a.coverUrl = r.coverUrl;
      if (r.artistAvatar) a.avatar = r.artistAvatar;
      
      if (r.tracks?.length > 0) {
        r.tracks.forEach(t => {
          const trackSold = t.soldCount || 0;
          const trackPrice = parseFloat(t.price) || parseFloat(r.songPrice) || 0;
          a.totalSold += trackSold;
          a.totalVolume += trackSold * trackPrice;
        });
      } else {
        a.totalSold += r.soldEditions || 0;
        a.totalVolume += (r.soldEditions || 0) * (parseFloat(r.songPrice) || 0);
      }
    });
    return artistMap;
  },
  
  getTopArtists(limit = 5) {
    const artistMap = this._buildArtistMap();
    return Object.values(artistMap)
      .filter(a => a.totalSold > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);
  },
  
  getEmergingArtists(limit = 5) {
    const artistMap = this._buildArtistMap();
    const topAddresses = new Set(this.getTopArtists(5).map(a => a.address));
    return Object.values(artistMap)
      .filter(a => a.totalVolume >= 20 && !topAddresses.has(a.address))
      .sort((a, b) => a.totalSold - b.totalSold)
      .slice(0, limit);
  },
  
  // ─── RENDER ────────────────────────────────────────────────
  
  renderContent() {
    const allTracks = this.getAllTracks();
    const sortedTracks = this.sortTracks(allTracks);
    const sortedArtists = this.sortArtists();
    const stats = this.getStats();
    const available = this.getAvailableReleases();
    
    const html = `
      <div class="stream-page animate-fade-in">
        
        <!-- ════════ MARKET TYPE TOGGLE ════════ -->
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
        
        ${this.marketType === 'primary'
          ? this.renderPrimaryContent(sortedTracks, sortedArtists, allTracks, stats)
          : this.renderSecondaryContent()
        }
      </div>
      
      ${this.getStyles()}
    `;
    
    UI.renderPage(html);
    this.bindEvents();
  },
  
  renderPrimaryContent(sortedTracks, sortedArtists, allTracks, stats) {
    const topSelling = this.getTopSelling(5);
    const newestDrops = this.getNewestDrops(5);
    const topArtists = this.getTopArtists(5);
    const emergingArtists = this.getEmergingArtists(5);
    const scarce = this.getScarceReleases(5);
    
    return `
      <!-- ════════ TOP PLAYED ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">▶</div>
            <div>
              <h3 class="section-name">Top Played</h3>
              <p class="section-subtitle">Most streamed by collectors</p>
            </div>
          </div>
          <div class="section-header-right">
            <div class="period-tabs">
              <button class="period-tab ${this.currentTopPeriod === '1d' ? 'active' : ''}" data-period="1d">1D</button>
              <button class="period-tab ${this.currentTopPeriod === '7d' ? 'active' : ''}" data-period="7d">7D</button>
              <button class="period-tab ${this.currentTopPeriod === '30d' ? 'active' : ''}" data-period="30d">30D</button>
              <button class="period-tab ${this.currentTopPeriod === '365d' ? 'active' : ''}" data-period="365d">365D</button>
            </div>
            <button class="view-all-btn" id="view-all-top-tracks">
              View All
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
        <div class="featured-grid">
          ${this.topTracks.length > 0 
            ? this.topTracks.slice(0, 5).map((track, i) => this.renderTopTrackCard(track, i)).join('')
            : '<div class="empty-section">No play data available yet. Start listening to build the charts!</div>'
          }
        </div>
      </section>
      
      <!-- ════════ TOP SELLING ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon hot">🔥</div>
            <div>
              <h3 class="section-name">Top Selling</h3>
              <p class="section-subtitle">Most popular releases</p>
            </div>
          </div>
          <button class="view-all-btn" data-sort="top-selling">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div class="featured-grid">
          ${topSelling.length > 0 
            ? topSelling.map((r, i) => this.renderFeaturedCard(r, i + 1, 'sales')).join('')
            : '<div class="empty-section">No sales yet — be the first to buy!</div>'
          }
        </div>
      </section>
      
      <!-- ════════ NEWEST DROPS ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon new">✨</div>
            <div>
              <h3 class="section-name">Newest Drops</h3>
              <p class="section-subtitle">Fresh releases from artists</p>
            </div>
          </div>
          <button class="view-all-btn" data-sort="newest">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div class="featured-grid">
          ${newestDrops.length > 0 
            ? newestDrops.map((r, i) => this.renderFeaturedCard(r, i + 1, 'date')).join('')
            : '<div class="empty-section">No releases yet</div>'
          }
        </div>
      </section>
      
      <!-- ════════ TOP ARTISTS ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon" style="background: linear-gradient(135deg, #8b5cf6, #6366f1);">👑</div>
            <div>
              <h3 class="section-name">Top Artists</h3>
              <p class="section-subtitle">Most collected artists on the platform</p>
            </div>
          </div>
        </div>
        <div class="featured-grid">
          ${topArtists.length > 0
            ? topArtists.map((a, i) => this.renderArtistFeatureCard(a, i + 1, 'top')).join('')
            : '<div class="empty-section">No artist data yet</div>'
          }
        </div>
      </section>
      
      <!-- ════════ EMERGING ARTISTS ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon" style="background: linear-gradient(135deg, #22c55e, #16a34a);">🌱</div>
            <div>
              <h3 class="section-name">Emerging Artists</h3>
              <p class="section-subtitle">Rising talent with 20+ XRP in sales volume</p>
            </div>
          </div>
        </div>
        <div class="featured-grid">
          ${emergingArtists.length > 0
            ? emergingArtists.map((a, i) => this.renderArtistFeatureCard(a, i + 1, 'emerging')).join('')
            : '<div class="empty-section">Artists need 20+ XRP in sales volume to appear here</div>'
          }
        </div>
      </section>
      
      <!-- ════════ SCARCE ════════ -->
      <section class="stream-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-icon scarce">⚡</div>
            <div>
              <h3 class="section-name">Get Them Before They're Gone</h3>
              <p class="section-subtitle">Limited copies remaining · 1 per artist</p>
            </div>
          </div>
        </div>
        <div class="featured-grid">
          ${scarce.length > 0
            ? scarce.map((r, i) => this.renderFeaturedCard(r, i + 1, 'scarce')).join('')
            : '<div class="empty-section">All releases have plenty of copies</div>'
          }
        </div>
      </section>
      
      <!-- ════════ ALL TRACKS / ALL ARTISTS ════════ -->
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
              ? sortedTracks.map((track, i) => this.renderTrackItem(track, i)).join('')
              : '<div class="empty-message">No tracks found</div>'
            }
          </div>
        ` : `
          <div class="artists-grid">
            ${sortedArtists.map(artist => this.renderArtistCard(artist)).join('')}
          </div>
        `}
      </section>
      
      <!-- ════════ STATS ════════ -->
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
    `;
  },
  
  renderSecondaryContent() {
    if (this.secondaryListings.length === 0) {
      return `
        <div class="empty-state" style="margin-top: 40px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 1l4 4-4 4"></path>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <path d="M7 23l-4-4 4-4"></path>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
          <h3>No Resale Listings Yet</h3>
          <p>When collectors list their NFTs for sale, they appear here.</p>
        </div>
      `;
    }
    
    return `
      <div style="margin: 20px 0;">
        <input type="text" class="form-input" id="secondary-search" placeholder="Search resale listings..." style="max-width: 400px;">
      </div>
      <div class="release-grid">
        ${this.secondaryListings.map(listing => this.renderSecondaryCard(listing)).join('')}
      </div>
    `;
  },
  
  // ─── CARD RENDERERS ────────────────────────────────────────
  
  renderTopTrackCard(track, index) {
    const rank = index + 1;
    const release = this.releases.find(r => r.id === track.release?.id) || track.release || {};
    const available = (release.totalEditions || 0) - (release.soldEditions || 0);
    const isSoldOut = available <= 0;
    const price = release.songPrice || release.albumPrice || 0;
    const hasCover = release.coverUrl && release.coverUrl.length > 0 && release.coverUrl !== 'null';
    const coverUrl = this.getImageUrl(release.coverUrl);
    const showMV = this.trackHasVideo(track) || this.hasVideo(release);
    
    return `
      <div class="featured-card top-track-card" data-top-track-index="${index}">
        <div class="featured-card-cover">
          ${hasCover 
            ? `<img src="${coverUrl}" alt="${track.displayTitle || 'Track'}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="rank-badge rank-${rank}">#${rank}</span>
          <span class="card-badge plays">${typeof Helpers !== 'undefined' && Helpers.formatNumber ? Helpers.formatNumber(track.plays || 0) : (track.plays || 0).toLocaleString()} plays</span>
          ${showMV ? `<span class="mv-badge mv-play-btn" data-top-track-index="${index}">▶ MV</span>` : ''}
          
          <div class="card-overlay">
            <button class="play-btn play-top-track-btn" data-top-track-index="${index}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="featured-card-info">
          <div class="card-title">${track.displayTitle || 'Untitled'}</div>
          <div class="card-artist">${release.artistName || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(release.artistAddress) : 'Unknown Artist')}</div>
          <div class="card-footer">
            <span class="card-price">${price} XRP</span>
            <span class="card-availability ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : `${available} left`}</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderFeaturedCard(release, rank, type) {
    const available = release.totalEditions - release.soldEditions;
    const price = release.albumPrice || release.songPrice;
    const coverUrl = this.getImageUrl(release.coverUrl);
    const soldPercent = release.totalEditions > 0 ? Math.round((release.soldEditions / release.totalEditions) * 100) : 0;
    const showMV = this.hasVideo(release);
    
    let badge = '';
    if (type === 'sales') {
      badge = `<span class="card-badge sales">${release.soldEditions} sold</span>`;
    } else if (type === 'date') {
      const date = new Date(release.createdAt);
      const isNew = (Date.now() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
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
          ${showMV ? `<span class="mv-badge mv-play-btn" data-release-id="${release.id}">▶ MV</span>` : ''}
          <div class="card-overlay">
            <button class="play-btn play-release-btn" data-release-id="${release.id}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        </div>
        <div class="featured-card-info">
          <div class="card-title">${release.title}</div>
          <div class="card-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
          <div class="card-footer">
            <span class="card-price">${price} XRP</span>
            <div class="card-progress">
              <div class="progress-bar"><div class="progress-fill" style="width: ${soldPercent}%"></div></div>
              <span class="progress-text">${soldPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  
  renderArtistFeatureCard(artist, rank, type) {
    const coverUrl = this.getImageUrl(artist.avatar || artist.coverUrl);
    const isTop = type === 'top';
    const statLabel = `${artist.totalVolume.toFixed(0)} XRP vol`;
    
    return `
      <div class="featured-card artist-feature-card" data-artist-address="${artist.address}">
        <div class="featured-card-cover">
          ${(artist.avatar || artist.coverUrl)
            ? `<img src="${coverUrl}" alt="${artist.name}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder" style="font-size:48px;">🎤</div>`
          }
          <span class="rank-badge rank-${rank}">#${rank}</span>
          <span class="card-badge ${isTop ? 'sales' : 'emerging'}">${statLabel}</span>
        </div>
        <div class="featured-card-info">
          <div class="card-title">${artist.name}</div>
          <div class="card-artist">${artist.releaseCount} release${artist.releaseCount !== 1 ? 's' : ''} · ${artist.trackCount} track${artist.trackCount !== 1 ? 's' : ''}</div>
          <div class="card-footer">
            <span class="card-price">${artist.totalVolume.toFixed(1)} XRP</span>
            <span class="card-volume-label">total volume</span>
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
    const showMV = this.trackHasVideo(track);
    
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
          <div class="track-title">
            ${track.displayTitle}
            ${showMV ? `<span class="mv-badge-inline mv-play-inline" data-track-index="${index}">MV</span>` : ''}
          </div>
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
  
  renderEmpty() {
    UI.renderPage(`
      <div class="empty-state" style="min-height: 60vh;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <h3>Welcome to XRP Music</h3>
        <p>The decentralized music platform on the XRP Ledger</p>
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
        <p>There was an error loading releases. Please try again.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="StreamPage.render()">Retry</button>
      </div>
    `);
  },
  
  // ─── HELPERS ───────────────────────────────────────────────
  
  viewAllTopTracks() {
    const periodMap = { '1d': '24h', '7d': '7d', '30d': '30d', '365d': 'all' };
    Router.navigate('analytics', { sort: 'streams', period: periodMap[this.currentTopPeriod] || '7d' });
  },
  
  sortTracks(tracks) {
    return [...tracks].sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  },
  
  sortArtists() {
    return [...this.artists].sort((a, b) => a.name.localeCompare(b.name));
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
  
  // ─── EVENTS ────────────────────────────────────────────────
  
  bindEvents() {
    // Market type toggle
    document.querySelectorAll('.market-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newMarket = btn.dataset.market;
        if (newMarket !== this.marketType) {
          this.marketType = newMarket;
          this.renderContent();
        }
      });
    });
    
    // Period tabs (Top Played)
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
    
    // View All (top tracks → analytics)
    document.getElementById('view-all-top-tracks')?.addEventListener('click', () => {
      this.viewAllTopTracks();
    });
    
    // View All (sort buttons → analytics)
    document.querySelectorAll('.view-all-btn[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sort = btn.dataset.sort;
        Router.navigate('analytics', { sort: sort, period: '7d' });
      });
    });
    
    // All Tracks / All Artists tab buttons
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTab = btn.dataset.tab;
        if (newTab !== this.currentTab) {
          this.currentTab = newTab;
          this.renderContent();
        }
      });
    });
    
    // Featured release cards → open release modal
    document.querySelectorAll('.featured-card:not(.artist-feature-card):not(.top-track-card)').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-btn') || e.target.closest('.mv-badge')) return;
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });
    
    // Top track cards → open release modal
    document.querySelectorAll('.top-track-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-btn') || e.target.closest('.mv-badge')) return;
        const index = parseInt(card.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track?.release) {
          const fullRelease = this.releases.find(r => r.id === track.release.id);
          Modals.showRelease(fullRelease || track.release);
        }
      });
    });
    
    // Play buttons on top track cards
    document.querySelectorAll('.play-top-track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.topTrackIndex, 10);
        const track = this.topTracks[index];
        if (track) this.playTrack(track, this.topTracks, index);
      });
    });
    
    // Play buttons on featured release cards
    document.querySelectorAll('.play-release-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release?.tracks?.length > 0) this.playRelease(release);
      });
    });
    
    // Artist feature cards → artist profile
    document.querySelectorAll('.artist-feature-card').forEach(card => {
      card.addEventListener('click', () => {
        const address = card.dataset.artistAddress;
        if (address) Router.navigate('artist', { address });
      });
    });
    
    // Track items (All Tracks tab)
    document.querySelectorAll('.track-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const allTracks = this.sortTracks(this.getAllTracks());
        const track = allTracks[index];
        if (track) this.playTrack(track, allTracks, index);
      });
    });
    
    // MV badge clicks - play + open video modal
    document.querySelectorAll('.mv-play-btn').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = badge.dataset.releaseId;
        const topIdx = badge.dataset.topTrackIndex;
        if (topIdx !== undefined) {
          const track = this.topTracks[parseInt(topIdx)];
          if (track) {
            this.playTrack(track, this.topTracks, parseInt(topIdx));
            setTimeout(() => Modals.showExpandedNowPlaying(), 300);
          }
        } else if (releaseId) {
          const release = this.releases.find(r => r.id === releaseId);
          if (release) {
            this.playRelease(release);
            setTimeout(() => Modals.showExpandedNowPlaying(), 300);
          }
        }
      });
    });
    
    document.querySelectorAll('.mv-play-inline').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(badge.dataset.trackIndex);
        const allTracks = this.sortTracks(this.getAllTracks());
        const track = allTracks[index];
        if (track) {
          this.playTrack(track, allTracks, index);
          setTimeout(() => Modals.showExpandedNowPlaying(), 300);
        }
      });
    });
    
    // Artist cards (All Artists tab)
    document.querySelectorAll('.artist-card:not(.artist-feature-card)').forEach(card => {
      card.addEventListener('click', () => {
        const address = card.dataset.artistAddress;
        if (address) Router.navigate('artist', { address });
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
  
  // ─── PLAYBACK ──────────────────────────────────────────────
  
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
      videoUrl: t.videoUrl || null,
      videoCid: t.videoCid || null,
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
      videoUrl: t.videoUrl || null,
      videoCid: t.videoCid || null,
    }));
    Player.playTrack(queue[index], queue, index);
  },
  
  // ─── STYLES ────────────────────────────────────────────────
  
  getStyles() {
    return `
      <style>
        .stream-section { margin-bottom: 40px; }
        
        /* ════════ MARKET TYPE TABS (at top of page) ════════ */
        .market-type-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
          padding: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          width: fit-content;
        }
        @media (max-width: 640px) {
          .market-type-tabs { width: 100%; }
        }
        .market-type-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: var(--radius-lg);
          background: transparent;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms ease;
        }
        @media (max-width: 640px) {
          .market-type-btn { flex: 1; justify-content: center; font-size: 13px; padding: 10px 12px; }
        }
        .market-type-btn:hover { color: var(--text-primary); }
        .market-type-btn.active {
          background: var(--accent);
          color: white;
        }
        .market-count {
          padding: 2px 8px;
          background: rgba(255,255,255,0.15);
          border-radius: 100px;
          font-size: 12px;
        }
        .market-type-btn.active .market-count { background: rgba(255,255,255,0.25); }
        .market-type-btn:not(.active) .market-count { background: var(--bg-hover); }
        
        /* ════════ SECTION HEADER ════════ */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
        }
        .section-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .section-icon {
          width: 48px; height: 48px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .section-icon.hot { background: linear-gradient(135deg, #f97316, #ef4444); }
        .section-icon.new { background: linear-gradient(135deg, #8b5cf6, #6366f1); }
        .section-icon.scarce { background: linear-gradient(135deg, #eab308, #f59e0b); }
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
        .section-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
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
        
        /* ════════ FEATURED GRID (5 cards) ════════ */
        .featured-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) { .featured-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 900px) { .featured-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
        
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
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
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
        
        /* ════════ RANK BADGE ════════ */
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
        .rank-badge.rank-1 { background: linear-gradient(135deg, #ffd700, #ffaa00); box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4); }
        .rank-badge.rank-2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); box-shadow: 0 2px 8px rgba(192, 192, 192, 0.4); }
        .rank-badge.rank-3 { background: linear-gradient(135deg, #cd7f32, #b87333); box-shadow: 0 2px 8px rgba(205, 127, 50, 0.4); }
        .rank-badge.rank-4, .rank-badge.rank-5 { background: rgba(59, 130, 246, 0.9); }
        
        /* ════════ CARD BADGES ════════ */
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
        .card-badge.plays { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .card-badge.sales { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .card-badge.date { background: rgba(139, 92, 246, 0.9); }
        .card-badge.date.new { background: linear-gradient(135deg, #8b5cf6, #6366f1); animation: pulse 2s infinite; }
        .card-badge.emerging { background: linear-gradient(135deg, #22c55e, #059669); }
        .card-badge.scarce { background: rgba(234, 179, 8, 0.9); }
        .card-badge.scarce.low { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .card-badge.scarce.critical { background: linear-gradient(135deg, #ef4444, #dc2626); animation: pulse 1.5s infinite; }
        
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        
        /* ════════ MV BADGE ════════ */
        .mv-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          border-radius: 4px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
          z-index: 3;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
          cursor: pointer;
          transition: transform 150ms, box-shadow 150ms;
        }
        .mv-badge:hover { transform: scale(1.1); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.6); }
        
        .mv-badge-inline {
          display: inline-block;
          padding: 1px 5px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          border-radius: 3px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
          margin-left: 6px;
          vertical-align: middle;
          cursor: pointer;
        }
        .mv-badge-inline:hover { opacity: 0.8; }
        
        /* ════════ CARD OVERLAY + PLAY ════════ */
        .card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
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
        
        /* ════════ CARD INFO ════════ */
        .featured-card-info { padding: 12px; }
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
        .card-availability {
          font-size: 12px;
          color: var(--text-muted);
        }
        .card-availability.sold-out { color: var(--error); font-weight: 600; }
        .card-volume-label {
          font-size: 11px;
          color: var(--text-muted);
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
        
        /* ════════ PERIOD TABS ════════ */
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
        .period-tab:hover { color: var(--text-primary); }
        .period-tab.active { background: var(--accent); color: white; }
        
        /* ════════ ALL TRACKS / ALL ARTISTS TOGGLE ════════ */
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
        .tab-btn:hover { color: var(--text-primary); }
        .tab-btn.active { background: var(--accent); color: white; }
        .tab-count {
          padding: 2px 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }
        .tab-btn:not(.active) .tab-count { background: var(--bg-hover); color: var(--text-muted); }
        
        /* ════════ ARTISTS GRID ════════ */
        .artists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }
        @media (min-width: 640px) {
          .artists-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; }
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
        .artist-avatar img { width: 100%; height: 100%; object-fit: cover; }
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
        
        /* ════════ EMPTY MESSAGE ════════ */
        .empty-message {
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
        }
        
        /* ════════ SECONDARY MARKET ════════ */
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
        .secondary-seller {
          font-size: 11px;
          color: var(--text-muted);
        }
        .secondary-buy-btn {
          width: 100%;
          margin-top: 8px;
        }
        
        /* ════════ RESPONSIVE ════════ */
        @media (max-width: 640px) {
          .section-header { flex-direction: column; align-items: stretch; }
          .section-header-right { width: 100%; justify-content: space-between; }
          .period-tabs { flex: 1; }
          .period-tab { flex: 1; text-align: center; }
          .tab-toggle { width: 100%; }
          .tab-btn { flex: 1; justify-content: center; }
        }
      </style>
    `;
  },
};
