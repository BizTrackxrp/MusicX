/**
 * XRP Music - Secondary Sales Page (In-App)
 * 
 * Shows secondary market activity with clean card-based UI.
 * Replaces the old "Transparency" page.
 * 
 * Accessible to ALL users (logged in or not).
 * Logged-in users see personal stats + global view toggle.
 */

const SecondarySalesPage = {
  currentView: 'global',
  cachedData: null,

  async render() {
    UI.showLoading();

    try {
      const wallet = AppState.user?.address;
      const walletParam = (wallet && this.currentView === 'personal') ? `&wallet=${wallet}` : '';
      // Only default to personal on first load, not when switching views
      if (!this.cachedData) {
        this.currentView = wallet ? 'personal' : 'global';
      }

      const [summary, secondary] = await Promise.all([
        fetch(`/api/royalty-audit?action=summary${walletParam}`).then(r => r.json()),
        fetch(`/api/royalty-audit?action=secondary-sales${walletParam}`).then(r => r.json()),
      ]);

      this.cachedData = { summary, secondary };

      UI.renderPage(`
        <div class="animate-fade-in">
          <div class="ss-header">
            <h2 class="section-title">Secondary Sales</h2>
            ${wallet ? `
              <div class="ss-toggle">
                <button class="ss-toggle-btn ${this.currentView === 'personal' ? 'active' : ''}" onclick="SecondarySalesPage.switchView('personal')">My Releases</button>
                <button class="ss-toggle-btn ${this.currentView === 'global' ? 'active' : ''}" onclick="SecondarySalesPage.switchView('global')">All Sales</button>
              </div>
            ` : ''}
          </div>

          ${this.renderStats(summary)}
          ${this.renderSalesList(secondary)}
        </div>
        ${this.getStyles()}
      `);

    } catch (error) {
      console.error('Failed to load secondary sales:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Failed to Load</h3>
          <p>There was an error loading secondary sales data.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="SecondarySalesPage.render()">Retry</button>
        </div>
      `);
    }
  },

  async switchView(view) {
    this.currentView = view;
    await this.render();
  },

  // ── Utilities ──
  truncAddr(addr) {
    if (!addr) return '—';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  },

  xrpFmt(val) {
    const n = parseFloat(val) || 0;
    return n < 0.01 && n > 0 ? n.toFixed(6) : n.toFixed(2);
  },

  dateFmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  timeFmt(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  // ── Stats Bar ──
  renderStats(summary) {
    const s = summary;
    return `
      <div class="ss-stats">
        <div class="ss-stat">
          <span class="ss-stat-value">${s.secondarySales?.count || 0}</span>
          <span class="ss-stat-label">Sales</span>
        </div>
        <div class="ss-stat-divider"></div>
        <div class="ss-stat">
          <span class="ss-stat-value ss-stat-xrp">${this.xrpFmt(s.secondarySales?.volume || 0)} XRP</span>
          <span class="ss-stat-label">Volume</span>
        </div>
        <div class="ss-stat-divider"></div>
        <div class="ss-stat">
          <span class="ss-stat-value">${s.releases?.total || 0}</span>
          <span class="ss-stat-label">Releases</span>
        </div>
      </div>
    `;
  },

  // ── Sales List (Stream-style cards) ──
  renderSalesList(data) {
    if (!data.secondarySales || data.secondarySales.length === 0) {
      return `
        <div class="empty-state" style="min-height:300px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <h3>No Secondary Sales Yet</h3>
          <p>When collectors resell NFTs on the marketplace, they'll appear here.</p>
        </div>
      `;
    }

    let cards = '';
    for (let i = 0; i < data.secondarySales.length; i++) {
      const sale = data.secondarySales[i];
      const trackName = sale.track_title || sale.release_title || 'Unknown';
      const artistName = sale.artist_name || '—';
      const coverUrl = sale.cover_url || '/placeholder.png';
      const price = this.xrpFmt(sale.price);
      const date = this.dateFmt(sale.created_at);
      const isLegacy = sale.royaltyRecipient === 'platform_wallet';
      const saleIdx = i;

      cards += `
        <div class="ss-sale-card" data-sale-idx="${saleIdx}" onclick="SecondarySalesPage.openDetail(${saleIdx})">
          <div class="ss-sale-rank">${i + 1}</div>
          <div class="ss-sale-cover">
            <img src="${coverUrl}" alt="${trackName}" onerror="this.src='/placeholder.png'">
          </div>
          <div class="ss-sale-info">
            <div class="ss-sale-title">${trackName}</div>
            <div class="ss-sale-artist">${artistName}</div>
          </div>
          <div class="ss-sale-meta">
            <div class="ss-sale-price">${price} XRP</div>
            <div class="ss-sale-date">${date}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="ss-sale-list">
        ${cards}
      </div>
      <script type="application/json" id="ss-sales-data">${JSON.stringify(data.secondarySales)}</script>
    `;
  },

  // ── Sale Detail Modal ──
  openDetail(idx) {
    const dataEl = document.getElementById('ss-sales-data');
    if (!dataEl) return;
    const sales = JSON.parse(dataEl.textContent);
    const sale = sales[idx];
    if (!sale) return;

    const trackName = sale.track_title || sale.release_title || 'Unknown';
    const coverUrl = sale.cover_url || '/placeholder.png';
    const isLegacy = sale.royaltyRecipient === 'platform_wallet';
    const royalty = sale.estimatedRoyalty || 0;

    const overlay = document.createElement('div');
    overlay.className = 'buyers-modal-overlay';
    overlay.innerHTML = `
      <div class="buyers-modal" style="max-width:480px;">
        <div class="buyers-modal-header">
          <h3>Sale Details</h3>
          <button class="buyers-modal-close" onclick="this.closest('.buyers-modal-overlay').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="buyers-modal-content">
          <!-- Track header -->
          <div class="ss-detail-track">
            <img src="${coverUrl}" alt="${trackName}" class="ss-detail-cover" onerror="this.src='/placeholder.png'">
            <div>
              <div class="ss-detail-title">${trackName}</div>
              <div class="ss-detail-artist">by ${sale.artist_name || '—'}</div>
            </div>
          </div>

          <!-- Price -->
          <div class="ss-detail-price">${this.xrpFmt(sale.price)} XRP</div>

          <!-- Info rows -->
          <div class="ss-detail-rows">
            <div class="ss-detail-row">
              <span>Date</span>
              <span>${this.dateFmt(sale.created_at)} ${this.timeFmt(sale.created_at)}</span>
            </div>
            <div class="ss-detail-row">
              <span>Seller</span>
              <a href="https://bithomp.com/explorer/${sale.seller_address}" target="_blank" class="ss-detail-link">${this.truncAddr(sale.seller_address)}</a>
            </div>
            <div class="ss-detail-row">
              <span>Buyer</span>
              <a href="https://bithomp.com/explorer/${sale.buyer_address}" target="_blank" class="ss-detail-link">${this.truncAddr(sale.buyer_address)}</a>
            </div>
            <div class="ss-detail-row">
              <span>Artist</span>
              <a href="https://bithomp.com/explorer/${sale.artist_address}" target="_blank" class="ss-detail-link">${this.truncAddr(sale.artist_address)}</a>
            </div>
            ${sale.nft_token_id ? `
              <div class="ss-detail-row">
                <span>NFT</span>
                <a href="https://bithomp.com/nft/${sale.nft_token_id}" target="_blank" class="ss-detail-link">${this.truncAddr(sale.nft_token_id)}</a>
              </div>
            ` : ''}
            ${sale.tx_hash ? `
              <div class="ss-detail-row">
                <span>Transaction</span>
                <a href="https://bithomp.com/explorer/${sale.tx_hash}" target="_blank" class="ss-detail-link">${sale.tx_hash.slice(0, 12)}…</a>
              </div>
            ` : ''}
            <div class="ss-detail-row">
              <span>Royalty</span>
              <span style="color:${isLegacy ? '#fbbf24' : '#4ade80'};">${this.xrpFmt(royalty)} XRP → ${isLegacy ? 'Platform' : 'Artist'}</span>
            </div>
          </div>

          ${isLegacy ? `
            <div class="ss-detail-note">
              This is a legacy mint — royalty was routed to the platform wallet and will be manually forwarded to the artist.
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  // ── Styles ──
  getStyles() {
    return `
      <style>
        .ss-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
        }

        .ss-toggle {
          display: flex;
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        .ss-toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 8px 18px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ss-toggle-btn:hover { color: var(--text-primary); }
        .ss-toggle-btn.active { background: var(--accent); color: #fff; }

        /* Stats bar */
        .ss-stats {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 24px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
          border: 1px solid var(--border-color);
        }
        .ss-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .ss-stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .ss-stat-xrp {
          color: #f59e0b;
        }
        .ss-stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .ss-stat-divider {
          width: 1px;
          height: 32px;
          background: var(--border-color);
        }

        /* Sale cards - stream style */
        .ss-sale-list {
          display: flex;
          flex-direction: column;
        }

        .ss-sale-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 8px;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: background 0.15s;
        }
        .ss-sale-card:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .ss-sale-rank {
          width: 24px;
          text-align: center;
          font-size: 14px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .ss-sale-cover {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--bg-tertiary);
        }
        .ss-sale-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ss-sale-info {
          flex: 1;
          min-width: 0;
        }
        .ss-sale-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ss-sale-artist {
          font-size: 13px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ss-sale-meta {
          text-align: right;
          flex-shrink: 0;
        }
        .ss-sale-price {
          font-size: 15px;
          font-weight: 700;
          color: #f59e0b;
          font-variant-numeric: tabular-nums;
        }
        .ss-sale-date {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* Detail modal */
        .ss-detail-track {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .ss-detail-cover {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-md);
          object-fit: cover;
          flex-shrink: 0;
        }
        .ss-detail-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .ss-detail-artist {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .ss-detail-price {
          text-align: center;
          font-size: 28px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 20px;
          font-variant-numeric: tabular-nums;
        }

        .ss-detail-rows {
          margin-bottom: 16px;
        }
        .ss-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 13px;
        }
        .ss-detail-row:last-child { border-bottom: none; }
        .ss-detail-row > span:first-child {
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }
        .ss-detail-link {
          color: var(--accent);
          text-decoration: none;
          font-family: monospace;
          font-size: 12px;
        }
        .ss-detail-link:hover {
          text-decoration: underline;
        }

        .ss-detail-note {
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: var(--radius-lg);
          padding: 12px 16px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        @media (max-width: 600px) {
          .ss-stats {
            gap: 12px;
            padding: 14px 16px;
          }
          .ss-stat-value {
            font-size: 16px;
          }
          .ss-sale-card {
            gap: 10px;
            padding: 10px 4px;
          }
          .ss-sale-rank {
            width: 20px;
            font-size: 12px;
          }
          .ss-sale-cover {
            width: 40px;
            height: 40px;
          }
          .ss-sale-title {
            font-size: 14px;
          }
          .ss-sale-price {
            font-size: 13px;
          }
          .ss-toggle { display: none; }
        }
      </style>
    `;
  },
};

// Alias for backward compatibility with existing routes
const TransparencyPage = SecondarySalesPage;
