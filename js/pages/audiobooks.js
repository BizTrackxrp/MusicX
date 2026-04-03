/**
 * XRP Music - Audiobooks Page
 * 
 * Solo spotlight mode: when only 1 audiobook exists, gives it the full hero page.
 * Grid mode: kicks in when 2+ audiobooks are on the platform.
 */

const AudiobooksPage = {
  audiobooks: [],
  isLoading: false,

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') return IpfsHelper.toProxyUrl(url);
    return url;
  },

  async render() {
    UI.renderPage(`
      ${this.getStyles()}
      <div class="audiobooks-page">
        <div id="audiobooks-content">
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `);
    await this.loadAudiobooks();
  },

  async loadAudiobooks() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const response = await fetch('/api/releases?contentType=audiobook');
      if (!response.ok) throw new Error('Failed to load audiobooks');
      const data = await response.json();
      this.audiobooks = data.releases || [];
      this.renderContent();
    } catch (error) {
      console.error('Error loading audiobooks:', error);
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  },

  renderContent() {
    const container = document.getElementById('audiobooks-content');
    if (!container) return;

    if (this.audiobooks.length === 0) {
      container.innerHTML = this.renderEmptyState();
      this.bindEmptyEvents();
      return;
    }

    if (this.audiobooks.length === 1) {
      container.innerHTML = this.renderHeroSpotlight(this.audiobooks[0]);
      this.bindHeroEvents(this.audiobooks[0]);
      return;
    }

    container.innerHTML = this.renderGrid();
    this.bindGridEvents();
  },

  renderEmptyState() {
    return `
      <div class="ab-empty">
        <div class="ab-empty-icon">📚</div>
        <h2>Audiobooks are coming to XRP Music</h2>
        <p>We're waiting for our first narrator to step up.<br>Could that be you?</p>
        <div class="ab-empty-actions">
          <button class="btn btn-primary ab-upload-btn" style="font-size:15px;padding:14px 32px;">
            🎙️ Upload Your Audiobook
          </button>
          <p class="ab-empty-sub">Mint as an NFT. Own your distribution. Keep your royalties.</p>
        </div>
      </div>
    `;
  },

  renderHeroSpotlight(book) {
    const cover = this.getImageUrl(book.coverUrl || book.cover_url);
    const artist = book.artistName || book.artist_name || 'Unknown Author';
    const price = book.albumPrice || book.songPrice || book.album_price || book.song_price || 0;
    const available = (book.totalEditions || book.total_editions || 0) - (book.soldEditions || book.sold_editions || 0);
    const description = book.description || '';
    const duration = book.tracks?.[0]?.duration || null;
    const artistAvatar = this.getImageUrl(book.artistAvatar || book.artist_avatar);
    const artistAddress = book.artistAddress || book.artist_address;

    return `
      <div class="ab-hero-wrap">
        <div class="ab-page-header">
          <div class="ab-page-icon">📚</div>
          <div>
            <h1>Audiobooks</h1>
            <p>The first title on XRP Music — exclusively available as an NFT</p>
          </div>
        </div>

        <div class="ab-hero">
          <div class="ab-hero-cover-wrap">
            <img src="${cover}" alt="${book.title}" class="ab-hero-cover" onerror="this.src='/placeholder.png'">
            <div class="ab-hero-cover-glow" style="background-image: url('${cover}')"></div>
          </div>
          <div class="ab-hero-info">
            <div class="ab-hero-eyebrow">🎧 Featured Audiobook</div>
            <h2 class="ab-hero-title">${book.title}</h2>
            <button class="ab-hero-author-btn" data-address="${artistAddress}">
              <div class="ab-hero-avatar">
                ${artistAvatar && artistAvatar !== '/placeholder.png'
                  ? `<img src="${artistAvatar}" alt="${artist}" onerror="this.style.display='none'">`
                  : `<span>${artist[0]?.toUpperCase() || '?'}</span>`
                }
              </div>
              <div>
                <div class="ab-hero-author-label">Author</div>
                <strong class="ab-hero-author-name">${artist}</strong>
              </div>
            </button>
            ${duration ? `<div class="ab-hero-meta">⏱ ${this.formatDuration(duration)}</div>` : ''}
            <div class="ab-hero-availability">
              <span class="ab-avail-badge">${available} of ${book.totalEditions || book.total_editions || 100} editions available</span>
            </div>
            ${description ? `<p class="ab-hero-desc">${description}</p>` : ''}
            <div class="ab-hero-actions">
              <button class="btn ab-play-btn" data-release-id="${book.id}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Preview
              </button>
              <button class="btn btn-primary ab-buy-btn" data-release-id="${book.id}" style="font-size:15px;padding:14px 28px;">
                🛒 Buy NFT · ${price} XRP
              </button>
            </div>
            <p class="ab-hero-footnote">Own this audiobook as an NFT on the XRP Ledger. Resell it. Gift it. It's yours.</p>
          </div>
        </div>

        <div class="ab-creator-cta">
          <div class="ab-creator-cta-text">
            <h3>Are you an author or narrator?</h3>
            <p>XRP Music is one of the first platforms to let you mint audiobooks as NFTs. Be early.</p>
          </div>
          <button class="btn btn-secondary ab-upload-btn" style="white-space:nowrap;">
            Upload Your Audiobook
          </button>
        </div>
      </div>
    `;
  },

  renderGrid() {
    return `
      <div class="ab-grid-wrap">
        <div class="ab-page-header">
          <div class="ab-page-icon">📚</div>
          <div>
            <h1>Audiobooks</h1>
            <p>Mint-owned audio stories on the XRP Ledger</p>
          </div>
        </div>
        <div class="ab-grid">
          ${this.audiobooks.map(b => this.renderCard(b)).join('')}
        </div>
        <div class="ab-creator-cta" style="margin-top:48px;">
          <div class="ab-creator-cta-text">
            <h3>Have an audiobook to share?</h3>
            <p>Mint it as an NFT and keep your royalties.</p>
          </div>
          <button class="btn btn-secondary ab-upload-btn" style="white-space:nowrap;">
            Upload Your Audiobook
          </button>
        </div>
      </div>
    `;
  },

  renderCard(book) {
    const cover = this.getImageUrl(book.coverUrl || book.cover_url);
    const artist = book.artistName || book.artist_name || 'Unknown';
    const price = book.albumPrice || book.songPrice || book.album_price || book.song_price || 0;
    const available = (book.totalEditions || book.total_editions || 0) - (book.soldEditions || book.sold_editions || 0);
    return `
      <div class="ab-card" data-release-id="${book.id}">
        <div class="ab-card-cover">
          <img src="${cover}" alt="${book.title}" onerror="this.src='/placeholder.png'">
          <div class="ab-card-overlay">
            <button class="ab-card-play" data-release-id="${book.id}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
          <div class="ab-card-avail">${available > 0 ? available + ' left' : 'Sold Out'}</div>
        </div>
        <div class="ab-card-info">
          <div class="ab-card-title">${book.title}</div>
          <div class="ab-card-artist">${artist}</div>
          <div class="ab-card-price">${price} XRP</div>
        </div>
      </div>
    `;
  },

  renderError() {
    const container = document.getElementById('audiobooks-content');
    if (!container) return;
    container.innerHTML = `
      <div class="ab-empty">
        <div class="ab-empty-icon">⚠️</div>
        <h2>Couldn't load audiobooks</h2>
        <button class="btn btn-primary" onclick="AudiobooksPage.loadAudiobooks()">Retry</button>
      </div>
    `;
  },

  bindEmptyEvents() {
    document.querySelectorAll('.ab-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) { Modals.showAuth(); return; }
        Modals.showCreate();
      });
    });
  },

  bindHeroEvents(book) {
    document.querySelector('.ab-play-btn')?.addEventListener('click', () => {
      Modals.showRelease(book);
    });
    document.querySelector('.ab-buy-btn')?.addEventListener('click', () => {
      Modals.showRelease(book);
    });
    document.querySelector('.ab-hero-author-btn')?.addEventListener('click', () => {
      const address = book.artistAddress || book.artist_address;
      if (address) Router.navigate('artist', { address });
    });
    document.querySelectorAll('.ab-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) { Modals.showAuth(); return; }
        Modals.showCreate();
      });
    });
  },

  bindGridEvents() {
    document.querySelectorAll('.ab-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ab-card-play')) return;
        const book = this.audiobooks.find(b => b.id === card.dataset.releaseId);
        if (book) Modals.showRelease(book);
      });
    });
    document.querySelectorAll('.ab-card-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const book = this.audiobooks.find(b => b.id === btn.dataset.releaseId);
        if (book) Modals.showRelease(book);
      });
    });
    document.querySelectorAll('.ab-upload-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.user?.address) { Modals.showAuth(); return; }
        Modals.showCreate();
      });
    });
  },

  formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  },

  getStyles() {
    return `
      <style>
        .audiobooks-page { max-width: 1200px; margin: 0 auto; padding: 0 24px 120px; }

        .ab-page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
        .ab-page-icon { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; }
        .ab-page-header h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
        .ab-page-header p { font-size: 14px; color: var(--text-muted); margin: 0; }

        .ab-empty { text-align: center; padding: 100px 24px; }
        .ab-empty-icon { font-size: 72px; margin-bottom: 24px; }
        .ab-empty h2 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
        .ab-empty p { font-size: 16px; color: var(--text-muted); margin-bottom: 32px; line-height: 1.6; }
        .ab-empty-actions { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .ab-empty-sub { font-size: 13px; color: var(--text-muted); margin: 0; }

        .ab-hero {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 48px;
          align-items: start;
          margin-bottom: 48px;
          background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(124,58,237,0.04));
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 24px;
          padding: 40px;
        }
        @media (max-width: 800px) {
          .ab-hero { grid-template-columns: 1fr; gap: 32px; padding: 24px; }
        }
        .ab-hero-cover-wrap { position: relative; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
        .ab-hero-cover { width: 100%; display: block; border-radius: 16px; }
        .ab-hero-cover-glow {
          position: absolute; inset: 0; border-radius: 16px;
          background-size: cover; background-position: center;
          filter: blur(40px); opacity: 0.3; transform: scale(1.1);
          z-index: -1;
        }
        .ab-hero-eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #a78bfa; margin-bottom: 12px; }
        .ab-hero-title { font-size: 30px; font-weight: 800; line-height: 1.2; margin-bottom: 12px; color: var(--text-primary); }
        .ab-hero-author-btn {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 40px; padding: 8px 16px 8px 8px;
          cursor: pointer; transition: all 150ms; margin-bottom: 16px;
          text-align: left;
        }
        .ab-hero-author-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
        .ab-hero-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0; font-size: 16px; font-weight: 700; color: white;
        }
        .ab-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ab-hero-author-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
        .ab-hero-author-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .ab-hero-meta { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
        .ab-avail-badge { display: inline-block; padding: 5px 12px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 20px; font-size: 12px; font-weight: 600; color: #a78bfa; margin-bottom: 16px; }
        .ab-hero-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 28px; max-height: 140px; overflow-y: auto; }
        .ab-hero-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .ab-play-btn { display: flex; align-items: center; gap: 8px; padding: 14px 24px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: var(--text-primary); font-size: 15px; cursor: pointer; transition: all 150ms; }
        .ab-play-btn:hover { background: rgba(255,255,255,0.14); }
        .ab-hero-footnote { font-size: 12px; color: var(--text-muted); margin: 0; }

        .ab-creator-cta {
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
          padding: 28px 32px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 16px;
        }
        @media (max-width: 640px) { .ab-creator-cta { flex-direction: column; text-align: center; } }
        .ab-creator-cta-text h3 { font-size: 17px; font-weight: 700; margin: 0 0 6px; }
        .ab-creator-cta-text p { font-size: 13px; color: var(--text-muted); margin: 0; }

        .ab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
        .ab-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 150ms; }
        .ab-card:hover { border-color: #8b5cf6; transform: translateY(-4px); }
        .ab-card-cover { position: relative; aspect-ratio: 1; background: var(--bg-hover); }
        .ab-card-cover img { width: 100%; height: 100%; object-fit: cover; }
        .ab-card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 150ms; }
        .ab-card:hover .ab-card-overlay { opacity: 1; }
        .ab-card-play { width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ab-card-avail { position: absolute; top: 8px; right: 8px; padding: 3px 8px; background: rgba(0,0,0,0.7); border-radius: 6px; font-size: 11px; font-weight: 600; color: white; }
        .ab-card-info { padding: 12px; }
        .ab-card-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ab-card-artist { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
        .ab-card-price { font-size: 13px; font-weight: 700; color: #a78bfa; }
      </style>
    `;
  },
};
