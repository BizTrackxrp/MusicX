/**
 * XRP Music - Artist Sales Page
 * Shows artists their sold tracks and buyer details
 */

const ArtistSalesPage = {
  /**
   * Render the sales page
   */
  async render() {
    if (!AppState.user?.address) {
      UI.renderPage(`
        <div class="empty-state" style="min-height: 60vh;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <h3>Sales Analytics</h3>
          <p>Connect your wallet to view your sales.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="Modals.showAuth()">
            Connect Wallet
          </button>
        </div>
      `);
      return;
    }

    UI.showLoading();

    try {
      const data = await API.getArtistSoldTracks(AppState.user.address);
      const tracks = data.tracks || [];

      if (tracks.length === 0) {
        UI.renderPage(`
          <div class="animate-fade-in">
            <h2 class="section-title">Sales</h2>
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <h3>No Sales Yet</h3>
              <p>When collectors buy your music, you'll see the details here.</p>
            </div>
          </div>
        `);
        return;
      }

      // Calculate total sales
      const totalCopies = tracks.reduce((sum, t) => sum + parseInt(t.copies_sold || 0), 0);

      UI.renderPage(`
        <div class="animate-fade-in">
          <div class="sales-header">
            <h2 class="section-title">Sales</h2>
            <div class="sales-summary">
              <span class="sales-stat">${tracks.length} track${tracks.length !== 1 ? 's' : ''} sold</span>
              <span class="sales-stat">${totalCopies} total copies</span>
            </div>
          </div>
          
          <p class="sales-subtitle">Click a track to see who bought it</p>
          
          <div class="release-grid">
            ${tracks.map(track => this.renderTrackCard(track)).join('')}
          </div>
        </div>
        
        <style>
          .sales-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 8px;
          }
          
          .sales-summary {
            display: flex;
            gap: 16px;
          }
          
          .sales-stat {
            background: var(--bg-tertiary);
            padding: 8px 16px;
            border-radius: var(--radius-lg);
            font-size: 14px;
            color: var(--text-secondary);
          }
          
          .sales-subtitle {
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: 24px;
          }
          
          .copies-sold-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--accent);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            margin-top: 8px;
          }
          
          .copies-sold-badge svg {
            width: 14px;
            height: 14px;
          }
          
          .release-card {
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          
          .release-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          }
          
          /* Buyers Modal Styles */
          .buyers-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }
          
          .buyers-modal {
            background: var(--bg-secondary);
            border-radius: var(--radius-xl);
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .buyers-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-color);
          }
          
          .buyers-modal-header h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
          }
          
          .buyers-modal-close {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .buyers-modal-close:hover {
            color: var(--text-primary);
          }
          
          .buyers-modal-content {
            padding: 16px 24px 24px;
            overflow-y: auto;
          }
          
          .buyers-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          .buyer-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
          }
          
          .buyer-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 600;
            color: white;
            flex-shrink: 0;
            overflow: hidden;
          }
          
          .buyer-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .buyer-info {
            flex: 1;
            min-width: 0;
          }
          
          .buyer-name {
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 2px;
          }
          
          .buyer-address-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .buyer-address {
            font-size: 13px;
            color: var(--text-muted);
            font-family: monospace;
          }
          
          .copy-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
          }
          
          .copy-btn:hover {
            color: var(--accent);
            background: rgba(59, 130, 246, 0.1);
          }
          
          .copy-btn.copied {
            color: var(--success);
          }
          
          .buyer-copies {
            font-size: 13px;
            color: var(--accent);
            font-weight: 500;
            white-space: nowrap;
          }
          
          .buyers-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
          
          .buyers-empty {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
          }
        </style>
      `);

      // Bind click events to cards
      document.querySelectorAll('.release-card[data-track-id]').forEach(card => {
        card.addEventListener('click', () => {
          const trackId = card.dataset.trackId;
          const track = tracks.find(t => t.track_id === trackId);
          if (track) {
            this.showBuyersModal(track);
          }
        });
      });

    } catch (error) {
      console.error('Failed to load sales:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Failed to Load</h3>
          <p>There was an error loading your sales data.</p>
        </div>
      `);
    }
  },

  /**
   * Render a track card
   */
  renderTrackCard(track) {
    const coverUrl = track.cover_url ? 
      (typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(track.cover_url) : track.cover_url) : 
      '/placeholder.png';
    
    const copiesSold = parseInt(track.copies_sold || 0);
    
    return `
      <div class="release-card" data-track-id="${track.track_id}">
        <div class="release-card-cover">
          <img src="${coverUrl}" alt="${track.track_title}" onerror="this.src='/placeholder.png'">
          <span class="release-type-badge ${track.type || 'single'}">${track.type || 'single'}</span>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${track.track_title}</div>
          <div class="release-card-artist">${track.release_title}</div>
          <div class="copies-sold-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${copiesSold} ${copiesSold === 1 ? 'copy' : 'copies'} sold
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Show modal with buyer details
   */
  async showBuyersModal(track) {
    // Create modal
    const overlay = document.createElement('div');
    overlay.className = 'buyers-modal-overlay';
    overlay.innerHTML = `
      <div class="buyers-modal">
        <div class="buyers-modal-header">
          <h3>Buyers - ${track.track_title}</h3>
          <button class="buyers-modal-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="buyers-modal-content">
          <div class="buyers-loading">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const closeModal = () => overlay.remove();
    
    overlay.querySelector('.buyers-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Fetch buyers
    try {
      const data = await API.getTrackBuyers(AppState.user.address, track.track_id);
      const buyers = data.buyers || [];

      const content = overlay.querySelector('.buyers-modal-content');
      
      if (buyers.length === 0) {
        content.innerHTML = `<div class="buyers-empty">No buyer details available</div>`;
        return;
      }

      content.innerHTML = `
        <div class="buyers-list">
          ${buyers.map(buyer => this.renderBuyerRow(buyer)).join('')}
        </div>
      `;

      // Bind copy buttons
      content.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const address = btn.dataset.address;
          try {
            await navigator.clipboard.writeText(address);
            btn.classList.add('copied');
            btn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            setTimeout(() => {
              btn.classList.remove('copied');
              btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              `;
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        });
      });

    } catch (error) {
      console.error('Failed to load buyers:', error);
      const content = overlay.querySelector('.buyers-modal-content');
      content.innerHTML = `<div class="buyers-empty">Failed to load buyer details</div>`;
    }
  },

  /**
   * Render a buyer row
   */
  renderBuyerRow(buyer) {
    const displayName = buyer.profile_name || 'Anonymous';
    const initial = displayName[0].toUpperCase();
    const truncatedAddress = `${buyer.buyer_address.slice(0, 6)}...${buyer.buyer_address.slice(-4)}`;
    const copies = buyer.copies_bought || 1;
    
    return `
      <div class="buyer-row">
        <div class="buyer-avatar">
          ${buyer.avatar_url 
            ? `<img src="${buyer.avatar_url}" alt="${displayName}" onerror="this.style.display='none'; this.parentElement.textContent='${initial}'">` 
            : initial
          }
        </div>
        <div class="buyer-info">
          <div class="buyer-name">${displayName}</div>
          <div class="buyer-address-row">
            <span class="buyer-address">${truncatedAddress}</span>
            <button class="copy-btn" data-address="${buyer.buyer_address}" title="Copy address">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="buyer-copies">${copies}x</div>
      </div>
    `;
  }
};
