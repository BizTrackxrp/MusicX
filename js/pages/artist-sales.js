/**
 * XRP Music - Artist Sales Page
 * Shows tracks the artist has sold with buyer analytics
 */

const ArtistSalesPage = {
  /**
   * Render the sales analytics page
   */
  async render() {
    // Must be logged in
    if (!AppState.user?.address) {
      UI.renderPage(`
        <div class="empty-state" style="min-height: 60vh;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <h3>Sales Analytics</h3>
          <p>Connect your wallet to view your sales data.</p>
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
            <h2 class="section-title">Sales Analytics</h2>
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <h3>No Sales Yet</h3>
              <p>When fans purchase your music, you'll see the details here.</p>
              <button class="btn btn-secondary" style="margin-top: 16px;" onclick="Router.navigate('stream')">
                Browse Music
              </button>
            </div>
          </div>
        `);
        return;
      }
      
      // Calculate totals
      const totalCopies = tracks.reduce((sum, t) => sum + parseInt(t.copies_sold || 0), 0);
      
      UI.renderPage(`
        <div class="animate-fade-in artist-sales-page">
          <div class="sales-header">
            <h2 class="section-title">Sales Analytics</h2>
            <div class="sales-summary">
              <span class="summary-stat">${tracks.length} track${tracks.length !== 1 ? 's' : ''} sold</span>
              <span class="summary-divider">•</span>
              <span class="summary-stat">${totalCopies} total copies</span>
            </div>
          </div>
          
          <div class="release-grid sales-grid">
            ${tracks.map(track => this.renderTrackCard(track)).join('')}
          </div>
        </div>
        
        <style>
          .artist-sales-page {
            padding-bottom: 120px;
          }
          
          .sales-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 24px;
          }
          
          .sales-header .section-title {
            margin-bottom: 0;
          }
          
          .sales-summary {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-muted);
            font-size: 14px;
          }
          
          .summary-divider {
            opacity: 0.5;
          }
          
          .sales-grid .release-card {
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          
          .sales-grid .release-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          }
          
          .copies-sold-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: var(--accent);
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          
          .copies-sold-badge svg {
            width: 12px;
            height: 12px;
          }
          
          @media (max-width: 640px) {
            .sales-header {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        </style>
      `);
      
      // Bind click events
      document.querySelectorAll('.sales-track-card').forEach(card => {
        card.addEventListener('click', () => {
          const trackId = card.dataset.trackId;
          const track = tracks.find(t => t.track_id === trackId);
          if (track) {
            this.showBuyersModal(track);
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load sales data:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Failed to Load</h3>
          <p>There was an error loading your sales data.</p>
          <button class="btn btn-secondary" style="margin-top: 16px;" onclick="ArtistSalesPage.render()">
            Try Again
          </button>
        </div>
      `);
    }
  },
  
  /**
   * Render a single track card
   */
  renderTrackCard(track) {
    const coverUrl = track.cover_url 
      ? (typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(track.cover_url) : track.cover_url)
      : '/placeholder.png';
    
    const copiesSold = parseInt(track.copies_sold || 0);
    
    return `
      <div class="release-card sales-track-card" data-track-id="${track.track_id}">
        <div class="release-card-cover">
          ${track.cover_url 
            ? `<img src="${coverUrl}" alt="${track.track_title}" onerror="this.src='/placeholder.png'">`
            : `<div class="placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>`
          }
          <span class="release-type-badge ${track.release_type}">${track.release_type}</span>
        </div>
        <div class="release-card-info">
          <div class="release-card-title">${track.track_title}</div>
          <div class="release-card-artist">${track.release_title}</div>
          <div class="release-card-footer" style="margin-top: 8px;">
            <span class="copies-sold-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              ${copiesSold} ${copiesSold === 1 ? 'copy' : 'copies'} sold
            </span>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Show modal with buyer details
   */
  async showBuyersModal(track) {
    // Show loading state in modal
    const loadingHtml = `
      <div class="modal-overlay buyers-modal" onclick="if(event.target===this)this.remove()">
        <div class="modal buyers-modal-content">
          <div class="modal-header">
            <div class="modal-title">Buyers - ${track.track_title}</div>
            <button class="modal-close" onclick="document.querySelector('.buyers-modal').remove()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="loading-spinner" style="padding: 40px;">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
    
    try {
      const data = await API.getTrackBuyers(AppState.user.address, track.track_id);
      const buyers = data.buyers || [];
      
      const modalBody = document.querySelector('.buyers-modal .modal-body');
      if (!modalBody) return;
      
      if (buyers.length === 0) {
        modalBody.innerHTML = `
          <div class="empty-state" style="padding: 40px;">
            <p>No buyer data available.</p>
          </div>
        `;
        return;
      }
      
      modalBody.innerHTML = `
        <div class="buyers-list">
          ${buyers.map((buyer, idx) => this.renderBuyerRow(buyer, idx)).join('')}
        </div>
        
        <style>
          .buyers-modal-content {
            max-width: 500px;
            max-height: 80vh;
          }
          
          .buyers-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 400px;
            overflow-y: auto;
          }
          
          .buyer-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: var(--radius-md);
            transition: background 0.15s ease;
          }
          
          .buyer-row:hover {
            background: var(--bg-hover);
          }
          
          .buyer-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: white;
            font-size: 14px;
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
            gap: 6px;
          }
          
          .buyer-address {
            font-size: 13px;
            color: var(--text-muted);
            font-family: monospace;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            transition: all 0.15s ease;
          }
          
          .buyer-address:hover {
            background: var(--bg-card);
            color: var(--accent);
          }
          
          .copy-feedback {
            font-size: 11px;
            color: var(--accent);
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          
          .copy-feedback.show {
            opacity: 1;
          }
          
          .buyer-meta {
            font-size: 12px;
            color: var(--text-muted);
            text-align: right;
            flex-shrink: 0;
          }
          
          .buyer-edition {
            color: var(--accent);
            font-weight: 500;
          }
        </style>
      `;
      
      // Bind copy events
      document.querySelectorAll('.buyer-address').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const fullAddress = el.dataset.fullAddress;
          const feedbackEl = el.parentElement.querySelector('.copy-feedback');
          
          try {
            await navigator.clipboard.writeText(fullAddress);
            if (feedbackEl) {
              feedbackEl.textContent = 'Copied!';
              feedbackEl.classList.add('show');
              setTimeout(() => feedbackEl.classList.remove('show'), 2000);
            }
          } catch (err) {
            console.error('Copy failed:', err);
            if (feedbackEl) {
              feedbackEl.textContent = 'Failed to copy';
              feedbackEl.classList.add('show');
              setTimeout(() => feedbackEl.classList.remove('show'), 2000);
            }
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load buyers:', error);
      const modalBody = document.querySelector('.buyers-modal .modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="empty-state" style="padding: 40px;">
            <p>Failed to load buyer data.</p>
          </div>
        `;
      }
    }
  },
  
  /**
   * Render a single buyer row
   */
  renderBuyerRow(buyer, idx) {
    const address = buyer.buyer_address || '';
    const truncatedAddress = address.length > 8 
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : address;
    
    const displayName = buyer.profile_name || truncatedAddress;
    const initial = (buyer.profile_name || address || 'U')[0].toUpperCase();
    
    const purchaseDate = buyer.purchased_at 
      ? new Date(buyer.purchased_at).toLocaleDateString()
      : '';
    
    const avatarUrl = buyer.avatar_url 
      ? (typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(buyer.avatar_url) : buyer.avatar_url)
      : null;
    
    return `
      <div class="buyer-row">
        <div class="buyer-avatar">
          ${avatarUrl 
            ? `<img src="${avatarUrl}" alt="${displayName}" onerror="this.style.display='none';this.parentElement.textContent='${initial}'">`
            : initial
          }
        </div>
        <div class="buyer-info">
          <div class="buyer-name">${buyer.profile_name || 'Anonymous'}</div>
          <div class="buyer-address-row">
            <span class="buyer-address" data-full-address="${address}" title="Click to copy full address">
              ${truncatedAddress}
            </span>
            <span class="copy-feedback"></span>
          </div>
        </div>
        <div class="buyer-meta">
          ${buyer.edition_number ? `<div class="buyer-edition">#${buyer.edition_number}</div>` : ''}
          ${purchaseDate ? `<div>${purchaseDate}</div>` : ''}
        </div>
      </div>
    `;
  }
};

// Make available globally
window.ArtistSalesPage = ArtistSalesPage;
