/**
 * XRP Music - Podcasts Page
 * Empty state until first podcast is uploaded, then grid.
 */

const PodcastsPage = {
  podcasts: [],
  isLoading: false,

  async render() {
    UI.renderPage(`
      ${this.getStyles()}
      <div class="podcasts-page">
        <div id="podcasts-content">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `);
    await this.loadPodcasts();
  },

  async loadPodcasts() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const response = await fetch('/api/releases?contentType=podcast');
      if (!response.ok) throw new Error('Failed to load podcasts');
      const data = await response.json();
      this.podcasts = data.releases || [];
      this.renderContent();
    } catch (error) {
      console.error('Error loading podcasts:', error);
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  },

  renderContent() {
    const container = document.getElementById('podcasts-content');
    if (!container) return;

    if (this.podcasts.length === 0) {
      container.innerHTML = this.renderEmptyState();
      this.bindEmptyEvents();
      return;
    }

    container.innerHTML = this.renderGrid();
    this.bindGridEvents();
  },

  renderEmptyState() {
    return `
      <div class="pc-empty">
        <div class="pc-empty-visual">
          <div class="pc-mic-ring pc-ring-1"></div>
          <div class="pc-mic-ring pc-ring-2"></div>
          <div class="pc-mic-ring pc-ring-3"></div>
          <div class="pc-mic-icon">🎙️</div>
        </div>
        <h2>Awaiting our first podcast</h2>
        <p>XRP Music is ready to host your show.<br>Mint your episodes as NFTs and own your audience.</p>
        <div class="pc-empty-actions">
          <button class="btn btn-primary pc-upload-btn" style="font-size:15px;padding:14px 32px;">
            🎙️ Start Your Podcast Here
          </button>
          <p class="pc-empty-sub">Why not you? Be the first voice on XRP Music Podcasts.</p>
        </div>
        <div class="pc-perks">
          <div class="pc-perk">
            <span class="pc-perk-icon">🔒</span>
            <div>
              <strong>NFT-gated episodes</strong>
              <p>Charge per episode or bundle. Listeners own what they buy.</p>
            </div>
          </div>
          <div class="pc-perk">
            <span class="pc-perk-icon">💸</span>
            <div>
              <strong>Keep your royalties</strong>
              <p>No platform cut on secondary sales. Earn on resales forever.</p>
            </div>
          </div>
          <div class="pc-perk">
            <span class="pc-perk-icon">🌐</span>
            <div>
              <strong>On-chain forever</strong>
              <p>Your episodes live on IPFS + XRPL. No one can take them down.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderGrid() {
    return `
      <div class="pc-grid-wrap">
        <div class="pc-page-header">
          <div class="pc-page-icon">🎙️</div>
          <div>
            <h1>Podcasts</h1>
            <p>NFT-gated episodes on the XRP Ledger</p>
          </div>
        </div>

        <!-- Most recent row -->
        <div class="pc-section-label">Recently Added</div>
        <div class="pc-grid">
          ${this.podcasts.slice().sort((a,b) => new Date(b.createdAt||b.created_at) - new Date(a.createdAt||a.created_at)).slice(0,8).map(p => this.renderCard(p)).join('')}
        </div>

        <!-- All hosts -->
        ${this.renderHostsRow()}

        <div class="pc-creator-cta">
          <div class="pc-creator-cta-text">
            <h3>Have a show to share?</h3>
            <p>Mint your episodes as NFTs and build a paid listener base.</p>
          </div>
          <button class="btn btn-secondary pc-upload-btn" style="white-space:nowrap;">
            Start Your Podcast
          </button>
        </div>
      </div>
    `;
  },

  renderHostsRow() {
    const hosts = {};
    this.podcasts.forEach(p => {
      const key = p.artistAddress || p.artist_address;
      if (!hosts[key]) {
        hosts[key] = { name: p.artistName || p.artist_name || 'Unknown', count: 0, cover: p.coverUrl || p.cover_url };
      }
      hosts[key].count++;
    });
    const hostList = Object.entries(hosts);
    if (hostList.length < 2) return '';
    return `
      <div class="pc-section-label" style="margin-top:40px;">Hosts</div>
      <div class="pc-hosts-row">
        ${hostList.map(([addr, h]) => `
          <div class="pc-host-chip" data-address="${addr}">
            <div class="pc-host-avatar" style="background-image:url('${h.cover||'/placeholder.png'}')"></div>
            <div class="pc-host-info">
              <div class="pc-host-name">${h.name}</div>
              <div class="pc-host-count">${h.count} episode${h.count>1?'s':''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderCard(podcast) {
    const cover = podcast.coverUrl || podcast.cover_url || '/placeholder.png';
    const artist = podcast.artistName || podcast.artist_name || 'Unknown Host';
    const price = podcast.albumPrice || podcast.songPrice || podcast.album_price || podcast.song_price || 0;
    const available = (podcast.totalEditions || podcast.total_editions || 0) - (podcast.soldEditions || podcast.sold_editions || 0);
    return `
      <div class="pc-card" data-release-id="${podcast.id}">
        <div class="pc-card-cover">
          <img src="${cover}" alt="${podcast.title}" onerror="this.src='/placeholder.png'">
          <div class="pc-card-overlay">
            <button class="pc-card-play" data-release-id="${podcast.id}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
          <div class="pc-card-avail">${available > 0 ? available + ' left' : 'Sold Out'}</div>
        </div>
        <div class="pc-card-info">
          <div class="pc-card-title">${podcast.title}</div>
          <div class="pc-card-host">${artist}</div>
          <div class="pc-card-price">${price} XRP</div>
        </div>
      </div>
    `;
  },

  renderError() {
    const container = document.getElementById('podcasts-content');
    if (!container) return;
    container.innerHTML = `
      <div class="pc-empty">
        <div class="pc-empty-icon">⚠️</div>
        <h2>Couldn't load podcasts</h2>
        <button class="btn btn-primary" onclick="PodcastsPage.loadPodcasts()">Retry</button>
      </div>
    `;
  },

  bindEmptyEvents() {
    document.querySelectorAll('.pc-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) { Modals.showAuth(); return; }
        Modals.showCreate();
      });
    });
  },

  bindGridEvents() {
    document.querySelectorAll('.pc-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.pc-card-play')) return;
        const p = this.podcasts.find(x => x.id === card.dataset.releaseId);
        if (p) Modals.showRelease(p);
      });
    });
    document.querySelectorAll('.pc-card-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = this.podcasts.find(x => x.id === btn.dataset.releaseId);
        if (p) Modals.showRelease(p);
      });
    });
    document.querySelectorAll('.pc-host-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        Router.navigate('artist', { address: chip.dataset.address });
      });
    });
    document.querySelectorAll('.pc-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) { Modals.showAuth(); return; }
        Modals.showCreate();
      });
    });
  },

  getStyles() {
    return `
      <style>
        .podcasts-page { max-width: 1200px; margin: 0 auto; padding: 0 24px 120px; }

        /* ── Page header ── */
        .pc-page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
        .pc-page-icon { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; }
        .pc-page-header h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
        .pc-page-header p { font-size: 14px; color: var(--text-muted); margin: 0; }
        .pc-section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 16px; }

        /* ── Empty state ── */
        .pc-empty { text-align: center; padding: 80px 24px 40px; max-width: 600px; margin: 0 auto; }
        .pc-empty-visual { position: relative; width: 120px; height: 120px; margin: 0 auto 32px; display: flex; align-items: center; justify-content: center; }
        .pc-mic-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(245,158,11,0.3); animation: pc-pulse 2s ease-out infinite; }
        .pc-ring-1 { width: 120px; height: 120px; animation-delay: 0s; }
        .pc-ring-2 { width: 90px; height: 90px; animation-delay: 0.4s; }
        .pc-ring-3 { width: 60px; height: 60px; animation-delay: 0.8s; }
        @keyframes pc-pulse { 0% { opacity: 0.8; transform: scale(0.95); } 100% { opacity: 0; transform: scale(1.3); } }
        .pc-mic-icon { font-size: 48px; position: relative; z-index: 1; }
        .pc-empty h2 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
        .pc-empty p { font-size: 16px; color: var(--text-muted); margin-bottom: 32px; line-height: 1.6; }
        .pc-empty-actions { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 48px; }
        .pc-empty-sub { font-size: 13px; color: var(--text-muted); margin: 0; }
        .pc-perks { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; text-align: left; }
        .pc-perk { display: flex; gap: 14px; align-items: flex-start; padding: 18px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 14px; }
        .pc-perk-icon { font-size: 24px; flex-shrink: 0; }
        .pc-perk strong { display: block; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .pc-perk p { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5; }

        /* ── Grid ── */
        .pc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
        .pc-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 150ms; }
        .pc-card:hover { border-color: #f59e0b; transform: translateY(-4px); }
        .pc-card-cover { position: relative; aspect-ratio: 1; background: var(--bg-hover); }
        .pc-card-cover img { width: 100%; height: 100%; object-fit: cover; }
        .pc-card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 150ms; }
        .pc-card:hover .pc-card-overlay { opacity: 1; }
        .pc-card-play { width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pc-card-avail { position: absolute; top: 8px; right: 8px; padding: 3px 8px; background: rgba(0,0,0,0.7); border-radius: 6px; font-size: 11px; font-weight: 600; color: white; }
        .pc-card-info { padding: 12px; }
        .pc-card-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pc-card-host { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
        .pc-card-price { font-size: 13px; font-weight: 700; color: #f59e0b; }

        /* ── Hosts row ── */
        .pc-hosts-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .pc-host-chip { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 40px; cursor: pointer; transition: all 150ms; }
        .pc-host-chip:hover { border-color: #f59e0b; }
        .pc-host-avatar { width: 32px; height: 32px; border-radius: 50%; background-size: cover; background-position: center; background-color: var(--bg-hover); flex-shrink: 0; }
        .pc-host-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .pc-host-count { font-size: 11px; color: var(--text-muted); }

        /* ── Creator CTA ── */
        .pc-creator-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 32px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 16px; margin-top: 48px; }
        @media (max-width: 640px) { .pc-creator-cta { flex-direction: column; text-align: center; } }
        .pc-creator-cta-text h3 { font-size: 17px; font-weight: 700; margin: 0 0 6px; }
        .pc-creator-cta-text p { font-size: 13px; color: var(--text-muted); margin: 0; }
      </style>
    `;
  },
};
