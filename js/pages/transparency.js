/**
 * XRP Music - Transparency Page (In-App)
 * 
 * Public-facing mint provenance & royalty audit page.
 * Shows badge breakdown, secondary sales, release audit, and royalty liability.
 * 
 * Accessible to ALL users (logged in or not).
 * Logged-in users see personal stats + global view toggle.
 */

const TransparencyPage = {
  currentView: 'global', // 'global' or 'personal'
  cachedSummary: null,

  async render() {
    UI.showLoading();

    try {
      const wallet = AppState.user?.address;
      const walletParam = wallet ? `&wallet=${wallet}` : '';

      // If logged in, default to personal view
      this.currentView = wallet ? 'personal' : 'global';

      // Fetch summary + secondary sales + mint audit + liability in parallel
      const [summary, secondary, audit, liability] = await Promise.all([
        fetch(`/api/royalty-audit?action=summary${walletParam}`).then(r => r.json()),
        fetch(`/api/royalty-audit?action=secondary-sales${walletParam}`).then(r => r.json()),
        fetch(`/api/royalty-audit?action=mint-audit${walletParam}`).then(r => r.json()),
        fetch(`/api/royalty-audit?action=royalty-liability${walletParam}`).then(r => r.json()),
      ]);

      this.cachedSummary = summary;

      UI.renderPage(`
        <div class="animate-fade-in">
          <div class="transparency-header">
            <h2 class="section-title">Transparency</h2>
            ${wallet ? `
              <div class="transparency-toggle">
                <button class="toggle-btn ${this.currentView === 'personal' ? 'active' : ''}" onclick="TransparencyPage.switchView('personal')">My Releases</button>
                <button class="toggle-btn ${this.currentView === 'global' ? 'active' : ''}" onclick="TransparencyPage.switchView('global')">Platform</button>
              </div>
            ` : ''}
          </div>

          ${wallet && summary.personal ? this.renderPersonalBanner(summary.personal) : ''}

          ${this.renderAlertBanner(summary)}

          ${this.renderSummaryCards(summary)}

          ${this.renderTabs(secondary.totalCount)}

          <div id="transparency-tab-content">
            ${this.renderSecondarySales(secondary)}
          </div>
        </div>

        <!-- Hidden data for tab switching -->
        <script type="application/json" id="transparency-secondary-data">${JSON.stringify(secondary)}</script>
        <script type="application/json" id="transparency-audit-data">${JSON.stringify(audit)}</script>
        <script type="application/json" id="transparency-liability-data">${JSON.stringify(liability)}</script>

        ${this.getStyles()}
      `);

    } catch (error) {
      console.error('Failed to load transparency:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Failed to Load</h3>
          <p>There was an error loading transparency data.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="TransparencyPage.render()">Retry</button>
        </div>
      `);
    }
  },

  /**
   * Switch between personal/global view
   */
  async switchView(view) {
    this.currentView = view;
    await this.render();
  },

  /**
   * Switch tabs
   */
  showTab(tab, btn) {
    document.querySelectorAll('.tp-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const container = document.getElementById('transparency-tab-content');
    if (!container) return;

    if (tab === 'secondary') {
      const data = JSON.parse(document.getElementById('transparency-secondary-data')?.textContent || '{}');
      container.innerHTML = this.renderSecondarySales(data);
    } else if (tab === 'releases') {
      const data = JSON.parse(document.getElementById('transparency-audit-data')?.textContent || '{}');
      container.innerHTML = this.renderReleaseAudit(data);
    } else if (tab === 'liability') {
      const data = JSON.parse(document.getElementById('transparency-liability-data')?.textContent || '{}');
      container.innerHTML = this.renderLiability(data);
    }
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

  badgeHtml(type) {
    if (type === 'og') return '<span class="mint-badge mint-badge-sm mint-badge-og"><span class="mint-badge-icon">⛏</span>OG MINT</span>';
    if (type === 'legacy') return '<span class="mint-badge mint-badge-sm mint-badge-legacy"><span class="mint-badge-icon">⚠</span>LEGACY</span>';
    if (type === 'verified') return '<span class="mint-badge mint-badge-sm mint-badge-verified"><span class="mint-badge-icon">✓</span>VERIFIED</span>';
    return '';
  },

  issuerBadge(recipient) {
    if (recipient === 'platform_wallet') return '<span style="color:#fbbf24;">Platform ✗</span>';
    return '<span style="color:#4ade80;">Artist ✓</span>';
  },

  // ── Personal Banner ──
  renderPersonalBanner(personal) {
    if (this.currentView !== 'personal') return '';
    return `
      <div class="tp-personal-banner">
        <div class="tp-personal-stat">
          <div class="tp-personal-val">${personal.releases.total}</div>
          <div class="tp-personal-label">Your Releases</div>
        </div>
        <div class="tp-personal-stat tp-good">
          <div class="tp-personal-val">${personal.releases.preMint}</div>
          <div class="tp-personal-label">OG Mints</div>
        </div>
        <div class="tp-personal-stat tp-warn">
          <div class="tp-personal-val">${personal.releases.lazyMint}</div>
          <div class="tp-personal-label">Legacy</div>
        </div>
        <div class="tp-personal-stat">
          <div class="tp-personal-val">${personal.secondarySales.count}</div>
          <div class="tp-personal-label">Secondary Sales</div>
        </div>
        <div class="tp-personal-stat ${personal.royaltyOwed > 0 ? 'tp-warn' : 'tp-good'}">
          <div class="tp-personal-val">${personal.royaltyOwed > 0 ? this.xrpFmt(personal.royaltyOwed) + ' XRP' : '0'}</div>
          <div class="tp-personal-label">Royalty Owed</div>
        </div>
      </div>
    `;
  },

  // ── Alert Banner ──
  renderAlertBanner(summary) {
    const s = summary.royaltyIssue;
    if (!s || s.affectedSalesCount === 0) return '';
    return `
      <div class="audit-alert">
        <div class="audit-alert-icon">⚠️</div>
        <div class="audit-alert-text">
          <strong>${s.affectedSalesCount} secondary sale(s)</strong> on lazy-minted NFTs detected.
          Estimated <strong>${this.xrpFmt(s.estimatedRoyaltyOwed)} XRP</strong> in royalties
          may need manual forwarding to <strong>${s.affectedArtists} artist(s)</strong>.
        </div>
      </div>
    `;
  },

  // ── Summary Cards ──
  renderSummaryCards(summary) {
    const s = summary;
    return `
      <div class="audit-stats">
        <div class="audit-stat-card">
          <div class="audit-stat-badge"><span class="mint-badge mint-badge-sm mint-badge-og"><span class="mint-badge-icon">⛏</span>OG MINT</span></div>
          <div class="audit-stat-value">${s.releases.preMint}</div>
          <div class="audit-stat-label">Pre-Lazy-Mint Releases</div>
          <div class="audit-stat-sub">Artist = on-chain issuer ✓</div>
        </div>
        <div class="audit-stat-card">
          <div class="audit-stat-badge"><span class="mint-badge mint-badge-sm mint-badge-legacy"><span class="mint-badge-icon">⚠</span>LEGACY</span></div>
          <div class="audit-stat-value">${s.releases.lazyMint}</div>
          <div class="audit-stat-label">Lazy-Mint (Pre-Fix)</div>
          <div class="audit-stat-sub">Platform = on-chain issuer</div>
        </div>
        <div class="audit-stat-card">
          <div class="audit-stat-badge"><span class="mint-badge mint-badge-sm mint-badge-verified"><span class="mint-badge-icon">✓</span>VERIFIED</span></div>
          <div class="audit-stat-value">—</div>
          <div class="audit-stat-label">Lazy-Mint (Post-Fix)</div>
          <div class="audit-stat-sub">Artist = on-chain issuer ✓</div>
        </div>
        <div class="audit-stat-card">
          <div class="audit-stat-badge" style="font-size:16px;">📊</div>
          <div class="audit-stat-value">${s.secondarySales.count}</div>
          <div class="audit-stat-label">Secondary Sales</div>
          <div class="audit-stat-sub">${this.xrpFmt(s.secondarySales.volume)} XRP volume</div>
        </div>
      </div>
    `;
  },

  // ── Tabs ──
  renderTabs(secondaryCount) {
    return `
      <div class="tp-tabs">
        <button class="tp-tab-btn active" onclick="TransparencyPage.showTab('secondary', this)">
          Secondary Sales
          ${secondaryCount > 0 ? `<span class="tp-tab-count">${secondaryCount}</span>` : ''}
        </button>
        <button class="tp-tab-btn" onclick="TransparencyPage.showTab('releases', this)">Releases</button>
        <button class="tp-tab-btn" onclick="TransparencyPage.showTab('liability', this)">Royalty Liability</button>
      </div>
    `;
  },

  // ── Secondary Sales Tab ──
  renderSecondarySales(data) {
    if (!data.secondarySales || data.secondarySales.length === 0) {
      return `
        <div class="empty-state" style="min-height:200px;">
          <h3>🎉 No Secondary Sales Yet</h3>
          <p>When collectors resell NFTs, they'll show here with full transaction details.</p>
        </div>
      `;
    }

    let rows = '';
    for (const sale of data.secondarySales) {
      const trackName = sale.track_title || sale.release_title;
      const saleJson = JSON.stringify(sale).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      rows += `
        <tr class="tp-clickable-row" onclick='TransparencyPage.openSaleModal(${JSON.stringify(sale).replace(/'/g, "&#39;")})'>
          <td>${this.dateFmt(sale.created_at)}</td>
          <td>
            <span style="font-weight:500;color:var(--text-primary);">${trackName}</span><br>
            <span style="color:var(--text-muted);font-size:12px;">by ${sale.artist_name}</span>
          </td>
          <td><span style="color:#f59e0b;font-variant-numeric:tabular-nums;">${this.xrpFmt(sale.price)} XRP</span></td>
          <td>${this.badgeHtml(sale.badgeType)}</td>
          <td>${this.issuerBadge(sale.royaltyRecipient)}</td>
          <td style="font-variant-numeric:tabular-nums;">${this.xrpFmt(sale.estimatedRoyalty)} XRP</td>
          <td>
            <a href="https://bithomp.com/explorer/${sale.seller_address}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${this.truncAddr(sale.seller_address)}</a>
            <span style="color:var(--text-muted);"> → </span>
            <a href="https://bithomp.com/explorer/${sale.buyer_address}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${this.truncAddr(sale.buyer_address)}</a>
          </td>
          <td>${sale.tx_hash ? `<a href="https://bithomp.com/explorer/${sale.tx_hash}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${sale.tx_hash.slice(0, 8)}…</a>` : '—'}</td>
        </tr>
      `;
    }

    return `
      <div class="analytics-breakdown">
        <div class="analytics-breakdown-title">Secondary Market Sales · <span style="color:var(--text-muted);font-weight:400;">${data.totalCount} sale${data.totalCount !== 1 ? 's' : ''} · ${this.xrpFmt(data.totalRoyaltyOwedToArtists)} XRP owed</span></div>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Track</th>
              <th>Price</th>
              <th>Badge</th>
              <th>Royalty To</th>
              <th>Royalty</th>
              <th>Seller → Buyer</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:var(--text-muted);margin-top:12px;text-align:center;">Click any row for full transaction details</p>
      </div>
    `;
  },

  // ── Release Audit Tab ──
  renderReleaseAudit(data) {
    const preLazy = data.releases?.preLazyMint || [];
    const lazy = data.releases?.lazyMint || [];
    const verified = data.releases?.verified || [];

    if (preLazy.length === 0 && lazy.length === 0 && verified.length === 0) {
      return `
        <div class="empty-state" style="min-height:200px;">
          <h3>📀 No Releases Found</h3>
          <p>${this.currentView === 'personal' ? "You haven't released any music yet." : 'No releases found.'}</p>
        </div>
      `;
    }

    return this.buildReleaseTable(preLazy, 'Pre-Lazy-Mint Releases', 'og') +
           this.buildReleaseTable(lazy, 'Lazy-Mint Releases (Pre-Fix)', 'legacy') +
           this.buildReleaseTable(verified, 'Verified Releases (Post-Fix)', 'verified');
  },

  buildReleaseTable(releases, title, badgeType) {
    if (releases.length === 0) return '';

    let rows = '';
    for (const r of releases) {
      const sold = r.sold_editions || 0;
      const total = r.total_editions || '∞';
      rows += `
        <tr>
          <td>
            <span class="release-name">${r.title}</span>
            <span class="release-type-pill">${r.type || 'single'}</span>
          </td>
          <td>${r.artist_name || '—'}</td>
          <td>${r.track_count || 1}</td>
          <td>${sold} / ${total}</td>
          <td>${r.royalty_percent || 5}%</td>
          <td>${this.issuerBadge(r.royaltyRecipient)}</td>
          <td style="font-size:12px;color:var(--text-muted);">${this.dateFmt(r.created_at)}</td>
        </tr>
      `;
    }

    return `
      <div class="audit-table-section">
        <div class="audit-table-header" onclick="this.parentElement.classList.toggle('collapsed')">
          ${this.badgeHtml(badgeType)}
          <span class="audit-table-title">${title} (${releases.length})</span>
          <span class="audit-table-toggle">▾</span>
        </div>
        <div class="audit-table-body">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Release</th>
                <th>Artist</th>
                <th>Tracks</th>
                <th>Sold</th>
                <th>Royalty</th>
                <th>Issuer</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ── Royalty Liability Tab ──
  renderLiability(data) {
    if (!data.artists || data.artists.length === 0) {
      return `
        <div class="empty-state" style="min-height:200px;">
          <h3>✅ No Royalty Liability</h3>
          <p>No secondary sales on legacy-minted NFTs have occurred${this.currentView === 'personal' ? ' for your releases' : ''} yet.</p>
        </div>
      `;
    }

    let html = `
      <div class="tp-liability-total">
        <div>
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);font-weight:600;">Total Royalty Liability</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${data.totalSecondarySales} secondary sale(s) across ${data.artists.length} artist(s)</div>
        </div>
        <div style="font-size:24px;font-weight:700;color:#f59e0b;font-variant-numeric:tabular-nums;">${this.xrpFmt(data.grandTotalOwed)} XRP</div>
      </div>
    `;

    for (const artist of data.artists) {
      let saleRows = '';
      for (const s of artist.sales) {
        saleRows += `
          <tr class="tp-clickable-row" onclick='TransparencyPage.openSaleModal(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
            <td>${this.dateFmt(s.sale_date)}</td>
            <td>${s.track_title || s.release_title}</td>
            <td style="color:#f59e0b;">${this.xrpFmt(s.price)} XRP</td>
            <td>${s.royaltyPercent}%</td>
            <td style="color:#f59e0b;">${this.xrpFmt(s.royaltyOwed)} XRP</td>
            <td>
              <a href="https://bithomp.com/explorer/${s.seller_address}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${this.truncAddr(s.seller_address)}</a>
            </td>
            <td>${s.tx_hash ? `<a href="https://bithomp.com/explorer/${s.tx_hash}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${s.tx_hash.slice(0, 8)}…</a>` : '—'}</td>
          </tr>
        `;
      }

      html += `
        <div class="audit-table-section" style="margin-bottom:12px;">
          <div class="audit-table-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div style="flex:1;">
              <span style="font-weight:600;font-size:14px;color:var(--text-primary);">${artist.artistName}</span>
              <a href="https://bithomp.com/explorer/${artist.artistAddress}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);font-size:11px;text-decoration:none;font-family:monospace;margin-left:8px;">${this.truncAddr(artist.artistAddress)}</a>
              <span style="color:var(--text-muted);font-size:11px;margin-left:8px;">${artist.sales.length} sale(s)</span>
            </div>
            <span style="font-size:15px;font-weight:700;color:#f59e0b;margin-right:12px;">${this.xrpFmt(artist.totalOwed)} XRP</span>
            <span class="audit-table-toggle">▾</span>
          </div>
          <div class="audit-table-body">
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Track</th>
                  <th>Sale Price</th>
                  <th>Royalty %</th>
                  <th>Owed</th>
                  <th>Reseller</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>${saleRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    return html;
  },

  // ── Sale Detail Modal ──
  openSaleModal(sale) {
    const isIssue = sale.royaltyRecipient === 'platform_wallet';
    const trackName = sale.track_title || sale.release_title || 'Unknown Track';
    const royalty = sale.estimatedRoyalty || sale.royaltyOwed || 0;
    const date = sale.created_at || sale.sale_date;

    const overlay = document.createElement('div');
    overlay.className = 'buyers-modal-overlay';
    overlay.innerHTML = `
      <div class="buyers-modal" style="max-width:520px;">
        <div class="buyers-modal-header">
          <h3>Secondary Sale Details</h3>
          <button class="buyers-modal-close" onclick="this.closest('.buyers-modal-overlay').remove()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="buyers-modal-content">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${trackName}</div>
            <div style="color:var(--text-muted);font-size:13px;">by ${sale.artist_name || '—'}</div>
            <div style="margin-top:8px;">${this.badgeHtml(sale.badgeType || (sale.royaltyRecipient === 'platform_wallet' ? 'legacy' : 'og'))}</div>
          </div>

          <div class="tp-detail-rows">
            <div class="tp-detail-row">
              <span class="tp-detail-label">Sale Price</span>
              <span style="font-size:20px;font-weight:700;color:#f59e0b;">${this.xrpFmt(sale.price)} XRP</span>
            </div>
            <div class="tp-detail-row">
              <span class="tp-detail-label">Date</span>
              <span>${this.dateFmt(date)}</span>
            </div>
            <div class="tp-detail-row">
              <span class="tp-detail-label">Seller</span>
              <a href="https://bithomp.com/explorer/${sale.seller_address}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;word-break:break-all;">${sale.seller_address || '—'}</a>
            </div>
            <div class="tp-detail-row">
              <span class="tp-detail-label">Buyer</span>
              <a href="https://bithomp.com/explorer/${sale.buyer_address}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;word-break:break-all;">${sale.buyer_address || '—'}</a>
            </div>
            <div class="tp-detail-row">
              <span class="tp-detail-label">Artist</span>
              <a href="https://bithomp.com/explorer/${sale.artist_address}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;word-break:break-all;">${sale.artist_address || '—'}</a>
            </div>
            ${sale.nft_token_id ? `
              <div class="tp-detail-row">
                <span class="tp-detail-label">NFT ID</span>
                <a href="https://bithomp.com/nft/${sale.nft_token_id}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${this.truncAddr(sale.nft_token_id)}</a>
              </div>
            ` : ''}
            ${sale.tx_hash ? `
              <div class="tp-detail-row">
                <span class="tp-detail-label">Transaction</span>
                <a href="https://bithomp.com/explorer/${sale.tx_hash}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-family:monospace;">${sale.tx_hash.slice(0, 16)}…</a>
              </div>
            ` : ''}
            <div class="tp-detail-row">
              <span class="tp-detail-label">On-Chain Issuer</span>
              <span>${this.issuerBadge(sale.royaltyRecipient)}</span>
            </div>
          </div>

          <div class="tp-royalty-box ${isIssue ? 'tp-royalty-issue' : 'tp-royalty-ok'}">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px;">
              ${isIssue ? 'Royalty Owed to Artist' : 'Royalty Paid to Artist'}
            </div>
            <div style="font-size:22px;font-weight:700;color:${isIssue ? '#ef4444' : '#4ade80'};">
              ${this.xrpFmt(royalty)} XRP
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
              ${isIssue
                ? 'This is a LEGACY mint — royalty routed to platform wallet. Will be manually forwarded to artist.'
                : 'Royalty flowed directly to the artist on-chain. No action needed.'}
            </div>
          </div>
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
        .transparency-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
        }

        .transparency-toggle {
          display: flex;
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        .toggle-btn {
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
        .toggle-btn:hover { color: var(--text-primary); }
        .toggle-btn.active { background: var(--accent); color: #fff; }

        /* Personal banner */
        .tp-personal-banner {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          padding: 20px 24px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
          border: 1px solid rgba(59,130,246,0.15);
        }
        .tp-personal-stat { text-align: center; min-width: 80px; }
        .tp-personal-val {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .tp-personal-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .tp-good .tp-personal-val { color: #4ade80; }
        .tp-warn .tp-personal-val { color: #f59e0b; }

        /* Tabs */
        .tp-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
          width: fit-content;
        }
        .tp-tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 8px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s;
          position: relative;
        }
        .tp-tab-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }
        .tp-tab-btn.active { background: var(--accent); color: #fff; }

        .tp-tab-count {
          display: inline-flex; align-items: center; justify-content: center;
          background: #f59e0b; color: #000;
          font-size: 10px; font-weight: 700;
          min-width: 18px; height: 18px;
          border-radius: 9px; padding: 0 5px;
          margin-left: 6px;
          vertical-align: middle;
        }

        /* Clickable rows */
        .tp-clickable-row { cursor: pointer; transition: background 0.15s; }
        .tp-clickable-row:hover { background: rgba(59, 130, 246, 0.06) !important; }

        /* Liability total card */
        .tp-liability-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-xl);
          border: 1px solid rgba(245,158,11,0.2);
          margin-bottom: 20px;
        }

        /* Sale detail modal rows */
        .tp-detail-rows { margin-bottom: 16px; }
        .tp-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .tp-detail-row:last-child { border-bottom: none; }
        .tp-detail-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        /* Royalty box in modal */
        .tp-royalty-box {
          margin-top: 16px;
          padding: 16px;
          border-radius: var(--radius-xl);
          text-align: center;
        }
        .tp-royalty-issue {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
        }
        .tp-royalty-ok {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
        }

        /* Reuse audit styles from artist-sales */
        .audit-alert {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 16px 20px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
        }
        .audit-alert-icon { font-size: 20px; flex-shrink: 0; }
        .audit-alert-text { font-size: 14px; line-height: 1.5; color: var(--text-secondary); }
        .audit-alert-text strong { color: #fbbf24; }

        .audit-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px; margin-bottom: 32px;
        }
        .audit-stat-card {
          background: var(--bg-tertiary);
          border-radius: var(--radius-xl);
          padding: 20px; text-align: center;
        }
        .audit-stat-badge { margin-bottom: 12px; display: flex; justify-content: center; }
        .audit-stat-value { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .audit-stat-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
        .audit-stat-sub { font-size: 11px; color: var(--text-muted); }

        .audit-table-section {
          background: var(--bg-tertiary);
          border-radius: var(--radius-xl);
          overflow: hidden; margin-bottom: 16px;
        }
        .audit-table-header {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px; cursor: pointer; transition: background 0.15s;
        }
        .audit-table-header:hover { background: rgba(255,255,255,0.03); }
        .audit-table-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .audit-table-toggle { color: var(--text-muted); transition: transform 0.2s; }
        .audit-table-section.collapsed .audit-table-body { display: none; }
        .audit-table-section.collapsed .audit-table-toggle { transform: rotate(-90deg); }
        .audit-table-body { border-top: 1px solid var(--border-color); }

        @media (max-width: 600px) {
          .audit-stats { grid-template-columns: repeat(2, 1fr); }
          .audit-stat-value { font-size: 24px; }
          .tp-personal-banner { flex-direction: column; gap: 12px; align-items: flex-start; }
          .tp-tabs { overflow-x: auto; width: 100%; }
          .transparency-toggle { display: none; }
        }
      </style>
    `;
  },
};
