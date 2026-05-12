/**
 * XRP Music - Public Artist Profile Page
 *
 * Loaded when someone visits /artist/<address>.
 * Shows another artist's profile (NOT logged-in user's own profile).
 *
 * Features:
 * - Content-type tabs: 🎵 Music · 🎬 Videos · 📚 Audiobooks · 🎙 Podcasts · 🎮 Games
 *   (only tabs with content are shown, Music first by default)
 * - 🔑 Unlockable tab shown when the artist has set up unlockable content
 * - Film cards: 16:9, opens VideoPlayerModal
 * - Music cards: 1:1, opens Modals.showRelease
 * - Banner, avatar, bio, website, share button
 *
 * Public view = NO drafts, NO For Sale management, NO Edit Profile
 */

const ArtistPage = {
  address: null,
  profile: null,
  releases: [],
  activeTab: 'music',
  unlockableConfig: null,
  showUnlockableTab: false,

  CONTENT_TYPES: [
    { key: 'music',       label: 'Music',      icon: '🎵', types: ['music', 'song'] },
    { key: 'films',       label: 'Videos',     icon: '🎬', types: ['film', 'video'] },
    { key: 'audiobooks',  label: 'Audiobooks', icon: '📚', types: ['audiobook'] },
    { key: 'podcasts',    label: 'Podcasts',   icon: '🎙', types: ['podcast'] },
    { key: 'games',       label: 'Games',      icon: '🎮', types: ['game'] },
  ],

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined' && IpfsHelper.toProxyUrl) {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },

  _getContentTypeKey(release) {
    const ct = (release.contentType || release.content_type || 'music').toLowerCase();
    for (const def of this.CONTENT_TYPES) {
      if (def.types.includes(ct)) return def.key;
    }
    return 'music';
  },

  _groupReleasesByType(releases) {
    const groups = {};
    for (const def of this.CONTENT_TYPES) groups[def.key] = [];
    for (const r of releases) {
      // Public view: never show drafts
      if (r.status === 'draft') continue;
      const key = this._getContentTypeKey(r);
      groups[key].push(r);
    }
    return groups;
  },

  _isContentTab(tabKey) {
    return this.CONTENT_TYPES.some(def => def.key === tabKey);
  },

  _pickDefaultTab() {
    const groups = this._groupReleasesByType(this.releases);
    if (this._isContentTab(this.activeTab) && groups[this.activeTab]?.length > 0) return;
    if (this.activeTab === 'unlockable' && this.showUnlockableTab) return;

    // Try content tabs in order (Music first)
    for (const def of this.CONTENT_TYPES) {
      if (groups[def.key].length > 0) {
        this.activeTab = def.key;
        return;
      }
    }

    // No content — fall back to unlockable if available, else music empty state
    if (this.showUnlockableTab) {
      this.activeTab = 'unlockable';
    } else {
      this.activeTab = 'music';
    }
  },

  async fetchUnlockableConfig(artistAddress) {
    try {
      const resp = await fetch(`/api/unlockables?artist=${artistAddress}`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.warn('Failed to fetch unlockable config:', e);
      return null;
    }
  },

  async render(address) {
    if (!address) {
      UI.renderPage(`
        <div class="empty-state">
          <h3>No artist specified</h3>
          <p>Try clicking on an artist from a release or the marketplace.</p>
        </div>
      `);
      return;
    }

    this.address = address;
    this.activeTab = 'music';
    UI.showLoading();

    try {
      const [profile, releases, unlockableData] = await Promise.all([
        API.getProfile(address),
        API.getReleasesByArtist(address),
        this.fetchUnlockableConfig(address),
      ]);

      this.profile = profile || {};
      this.releases = releases || [];
      this.unlockableConfig = unlockableData?.config || null;

      // Show unlockable tab only if the artist has actually set it up
      this.showUnlockableTab = this.unlockableConfig?.tab_setup_complete === true;

      // Handle URL tab parameter
      const urlTab = Router?.params?.tab;
      if (urlTab === 'unlockable' && this.showUnlockableTab) {
        this.activeTab = 'unlockable';
      } else if (urlTab && this._isContentTab(urlTab)) {
        this.activeTab = urlTab;
      }

      this._pickDefaultTab();
      this.renderContent();
    } catch (error) {
      console.error('Failed to load artist:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Artist Not Found</h3>
          <p>This artist profile doesn't exist.</p>
        </div>
      `);
    }
  },

  renderContent() {
    const profile = this.profile;
    const address = this.address;
    const displayName = profile?.name || Helpers.truncateAddress(address);
    const bannerUrl = this.getImageUrl(profile?.bannerUrl);
    const avatarUrl = this.getImageUrl(profile?.avatarUrl);

    const groups = this._groupReleasesByType(this.releases);

    const html = `
      <div class="artist-page animate-fade-in">
        <div class="artist-banner">
          ${profile?.bannerUrl ? `<img src="${bannerUrl}" alt="Banner" onerror="this.style.display='none'">` : ''}
        </div>

        <div class="artist-profile-card">
          <div class="artist-avatar">
            ${profile?.avatarUrl
              ? `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none'">`
              : `<span>${displayName[0].toUpperCase()}</span>`
            }
          </div>
          <div class="artist-info">
            <h1 class="artist-name">${displayName}</h1>
            <p class="artist-address">${Helpers.truncateAddress(address, 8, 6)}</p>
            ${profile?.bio ? `
              <div class="artist-bio-container">
                <p class="artist-bio" id="artist-bio-text">${profile.bio}</p>
                <button class="artist-bio-more" id="artist-bio-more-btn" style="display: none;">more</button>
              </div>
            ` : ''}
            ${profile?.website ? `<a href="${profile.website}" target="_blank" class="artist-website">${profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>` : ''}
          </div>
          <div class="artist-actions">
            <button class="btn btn-secondary" id="share-artist-btn" title="Share Artist Profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span class="btn-text">Share</span>
            </button>
          </div>
        </div>

        <!-- Tabs: content-type tabs (only with content), then unlockable -->
        <div class="artist-tabs">
          ${this.CONTENT_TYPES
            .filter(def => groups[def.key].length > 0)
            .map(def => `
              <button class="artist-tab-btn ${this.activeTab === def.key ? 'active' : ''}" data-tab="${def.key}">
                ${def.icon} ${def.label}
                <span class="artist-tab-count">${groups[def.key].length}</span>
              </button>
            `).join('')}

          ${this.showUnlockableTab ? `
            <button class="artist-tab-btn ${this.activeTab === 'unlockable' ? 'active' : ''}" data-tab="unlockable">
              🔑 Unlockable
            </button>
          ` : ''}
        </div>

        <div class="artist-tab-content" id="artist-tab-content">
          ${this._renderActiveTab(groups)}
        </div>
      </div>

      ${this.getStyles()}
    `;

    UI.renderPage(html);
    this.bindEvents();
  },

  _renderActiveTab(groups) {
    if (this.activeTab === 'unlockable') return this.renderUnlockableTab();
    if (this._isContentTab(this.activeTab)) {
      return this.renderContentTab(this.activeTab, groups[this.activeTab] || []);
    }
    return this.renderContentTab('music', groups.music || []);
  },

  renderContentTab(tabKey, items) {
    const def = this.CONTENT_TYPES.find(d => d.key === tabKey);
    const label = def?.label || 'Releases';

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <h3>No ${label}</h3>
          <p>This artist hasn't released any ${label.toLowerCase()} yet.</p>
        </div>
      `;
    }

    if (tabKey === 'films') {
      return `
        <div class="film-grid">
          ${items.map(r => this.renderFilmCard(r)).join('')}
        </div>
      `;
    }

    return `
      <div class="release-grid">
        ${items.map(r => this.renderReleaseCard(r)).join('')}
      </div>
    `;
  },

  renderReleaseCard(release) {
    const coverUrl = this.getImageUrl(release.coverUrl);
    return `
      <div class="release-card" data-release-id="${release.id}">
        <div class="release-card-cover">
          ${release.coverUrl
            ? `<img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`
          }
          <span class="release-type-badge ${release.type}">${release.type}</span>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${release.title}</div>
          <div class="release-card-footer">
            <span class="release-card-price">${release.songPrice || release.albumPrice} XRP</span>
            <span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>
          </div>
        </div>
      </div>
    `;
  },

  renderFilmCard(release) {
    const thumb = this.getImageUrl(release.coverUrl);
    const sold = release.soldEditions || 0;
    const total = release.totalEditions || 0;
    const available = total - sold;
    const price = release.albumPrice || release.songPrice || 0;
    const accessType = release.accessType || release.access_type || 'public';

    return `
      <div class="film-card" data-film-id="${release.id}">
        <div class="film-card-thumb">
          <img src="${thumb}" alt="${release.title}" onerror="this.src='/placeholder.png'">
          <div class="film-card-overlay">
            <div class="film-card-play">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
          <div class="film-card-badge">${available > 0 ? `${available} left` : 'Sold Out'}</div>
          ${accessType === 'nft_holders' ? `<div class="film-card-gated">🔒 NFT Holders</div>` : ''}
        </div>
        <div class="film-card-info">
          <div class="film-card-title">${release.title}</div>
          <div class="film-card-price">${price === 0 ? 'FREE' : price + ' XRP'}</div>
        </div>
      </div>
    `;
  },

  renderUnlockableTab() {
    const viewerAddress = AppState.user?.address || null;
    const artistAddress = this.address;

    setTimeout(() => {
      const container = document.getElementById('artist-tab-content');
      if (container && typeof UnlockableTab !== 'undefined') {
        UnlockableTab.render(artistAddress, viewerAddress, container);
      } else if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>Unlockable Content</h3>
            <p>This feature is loading. Please refresh the page.</p>
          </div>
        `;
      }
    }, 0);

    return `<div class="loading-spinner"><div class="spinner"></div></div>`;
  },

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.artist-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.renderContent();
      });
    });

    // Share button
    const displayName = this.profile?.name || Helpers.truncateAddress(this.address);
    document.getElementById('share-artist-btn')?.addEventListener('click', () => {
      ShareUtils.shareArtistProfile({
        address: this.address,
        displayName,
        artistName: this.profile?.name,
        avatarUrl: this.profile?.avatarUrl
      });
    });

    // Bio expand
    const bioText = document.getElementById('artist-bio-text');
    const bioMoreBtn = document.getElementById('artist-bio-more-btn');
    if (bioText && bioMoreBtn && bioText.scrollHeight > bioText.clientHeight) {
      bioMoreBtn.style.display = 'block';
      bioMoreBtn.addEventListener('click', () => this.showBioModal(displayName, this.profile.bio));
    }

    // Music/audio release cards → Modals.showRelease
    document.querySelectorAll('.release-card').forEach(card => {
      card.addEventListener('click', () => {
        const releaseId = card.dataset.releaseId;
        const release = this.releases.find(r => r.id === releaseId);
        if (release) Modals.showRelease(release);
      });
    });

    // Film cards → VideoPlayerModal
    document.querySelectorAll('.film-card').forEach(card => {
      card.addEventListener('click', () => {
        const filmId = card.dataset.filmId;
        const release = this.releases.find(r => r.id === filmId);
        if (!release) return;
        if (typeof VideoPlayerModal !== 'undefined' && typeof VideoPlayerModal.show === 'function') {
          VideoPlayerModal.show(release);
        } else {
          console.error('VideoPlayerModal not loaded');
          Modals.showRelease(release);
        }
      });
    });
  },

  showBioModal(artistName, bio) {
    const overlay = document.createElement('div');
    overlay.className = 'bio-modal-overlay';
    overlay.innerHTML = `
      <div class="bio-modal">
        <div class="bio-modal-header">
          <h3>About ${artistName}</h3>
          <button class="bio-modal-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="bio-modal-content">${bio}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.bio-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  getStyles() {
    return `
      <style>
        .artist-page { padding-bottom: 120px; }
        @media (max-width: 1024px) { .artist-page { padding-bottom: 140px; } }

        .artist-banner {
          width: 100%;
          height: 180px;
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-bottom: -60px;
        }
        .artist-banner img { width: 100%; height: 100%; object-fit: cover; object-position: center center; }
        @media (min-width: 768px) { .artist-banner { height: 220px; } }
        @media (min-width: 1024px) { .artist-banner { height: 260px; } }
        @media (min-width: 1280px) { .artist-banner { height: 300px; } }

        .artist-profile-card {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 0 24px;
          margin-bottom: 32px;
        }
        @media (max-width: 640px) {
          .artist-profile-card {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0 16px;
          }
        }
        .artist-avatar {
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
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .artist-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .artist-info { flex: 1; min-width: 0; padding-top: 60px; }
        @media (max-width: 640px) { .artist-info { padding-top: 0; width: 100%; } }
        .artist-name { font-size: 28px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary); }
        .artist-address { color: var(--text-muted); font-size: 14px; margin-bottom: 12px; }
        .artist-bio-container { margin-bottom: 12px; max-width: 700px; }
        .artist-bio {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .artist-bio-more {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 14px;
          padding: 4px 0;
          cursor: pointer;
          margin-top: 4px;
        }
        .artist-bio-more:hover { text-decoration: underline; }
        .artist-website { color: var(--accent); font-size: 14px; text-decoration: none; }
        .artist-website:hover { opacity: 0.8; text-decoration: underline; }
        .artist-actions { padding-top: 60px; flex-shrink: 0; }
        @media (max-width: 640px) {
          .artist-actions { padding-top: 16px; width: 100%; display: flex; justify-content: center; }
        }

        /* Tabs */
        .artist-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--border-color);
          padding: 0 24px 4px;
          margin-bottom: 24px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 640px) { .artist-tabs { padding: 0 16px 4px; } }
        .artist-tab-btn {
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
          white-space: nowrap;
        }
        .artist-tab-btn:hover { color: var(--text-secondary); }
        .artist-tab-btn.active { background: var(--bg-hover); color: var(--text-primary); }
        .artist-tab-count {
          padding: 2px 8px;
          background: var(--bg-hover);
          border-radius: 10px;
          font-size: 12px;
        }
        .artist-tab-btn.active .artist-tab-count { background: var(--bg-primary); }

        .artist-tab-content { padding: 0 24px; }
        @media (max-width: 640px) { .artist-tab-content { padding: 0 16px; } }

        /* Film card (16:9) */
        .film-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }
        @media (max-width: 640px) { .film-grid { grid-template-columns: 1fr; } }
        .film-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all 150ms;
        }
        .film-card:hover {
          border-color: var(--accent);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        .film-card-thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          background: var(--bg-hover);
          overflow: hidden;
        }
        .film-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .film-card-overlay {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity 150ms;
        }
        .film-card:hover .film-card-overlay { opacity: 1; }
        .film-card-play {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.9);
          display: flex; align-items: center; justify-content: center;
          transform: scale(0.9);
          transition: transform 150ms;
        }
        .film-card:hover .film-card-play { transform: scale(1); }
        .film-card-badge {
          position: absolute; top: 8px; right: 8px;
          padding: 4px 10px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 6px;
          font-size: 11px; font-weight: 600; color: white;
        }
        .film-card-gated {
          position: absolute; top: 8px; left: 8px;
          padding: 4px 10px;
          background: rgba(168, 85, 247, 0.9);
          border-radius: 6px;
          font-size: 11px; font-weight: 600; color: white;
        }
        .film-card-info { padding: 16px; }
        .film-card-title {
          font-size: 15px; font-weight: 600; margin-bottom: 6px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--text-primary);
        }
        .film-card-price {
          font-size: 14px; font-weight: 700; color: #f87171;
        }

        /* Bio modal */
        .bio-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .bio-modal {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          max-width: 600px; width: 100%;
          max-height: 80vh;
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .bio-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }
        .bio-modal-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
        .bio-modal-close {
          background: none; border: none;
          color: var(--text-muted);
          cursor: pointer; padding: 4px;
          display: flex; align-items: center; justify-content: center;
        }
        .bio-modal-close:hover { color: var(--text-primary); }
        .bio-modal-content {
          padding: 24px;
          overflow-y: auto;
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.7;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      </style>
    `;
  },
};
