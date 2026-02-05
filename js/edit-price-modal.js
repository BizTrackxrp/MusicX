/**
 * Edit Price Modal
 * Allows artists to update the price of their releases (per-track + album)
 */

const EditPriceModal = {
  currentRelease: null,
  
  show(release) {
    this.currentRelease = release;
    
    const trackCount = release.tracks?.length || 1;
    const defaultTrackPrice = parseFloat(release.songPrice) || 0;
    const currentAlbumPrice = parseFloat(release.albumPrice) || (defaultTrackPrice * trackCount);
    const isAlbum = release.type !== 'single' && trackCount > 1;
    
    // Calculate individual total from per-track prices
    const individualTotal = release.tracks?.reduce((sum, t) => sum + (parseFloat(t.price) || defaultTrackPrice), 0) || defaultTrackPrice;
    
    const html = `
      <div class="modal-overlay edit-price-modal-overlay">
        <div class="modal edit-price-modal">
          <div class="modal-header">
            <div class="modal-title">Edit Pricing</div>
            <button class="modal-close" onclick="EditPriceModal.close()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Release Preview -->
            <div class="edit-price-preview">
              <div class="edit-price-cover">
                ${release.coverUrl 
                  ? `<img src="${Modals.getImageUrl(release.coverUrl)}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
                  : `<div class="cover-placeholder">🎵</div>`
                }
              </div>
              <div class="edit-price-info">
                <div class="edit-price-title">${release.title}</div>
                <div class="edit-price-meta">${isAlbum ? 'Album' : 'Single'} • ${trackCount} track${trackCount > 1 ? 's' : ''}</div>
              </div>
            </div>
            
            ${isAlbum ? `
              <!-- Per-Track Pricing Section -->
              <div class="track-pricing-section">
                <div class="section-label">Track Prices</div>
                <p class="section-hint">Set individual prices for each track</p>
                
                <div class="track-price-list" id="track-price-list">
                  ${release.tracks.map((track, idx) => {
                    const trackPrice = parseFloat(track.price) || defaultTrackPrice;
                    return `
                      <div class="track-price-row" data-track-idx="${idx}">
                        <span class="track-price-num">${idx + 1}</span>
                        <span class="track-price-name">${track.title}</span>
                        <div class="track-price-input-wrap">
                          <input type="number" class="track-price-input" 
                                 data-track-id="${track.id}" 
                                 data-track-idx="${idx}"
                                 value="${trackPrice}" 
                                 step="0.01" min="0.01">
                          <span class="track-price-currency">XRP</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                
                <div class="tracks-total-row">
                  <span>Individual tracks total:</span>
                  <span id="tracks-total">${individualTotal.toFixed(2)} XRP</span>
                </div>
              </div>
              
              <!-- Album Bundle Price -->
              <div class="album-pricing-section">
                <div class="section-label">Album Bundle Price</div>
                <p class="section-hint">Discounted price when fans buy all tracks together</p>
                
                <div class="album-price-input-row">
                  <input type="number" class="form-input album-price-input" 
                         id="album-price-input" 
                         value="${currentAlbumPrice}" 
                         step="0.01" min="0.01">
                  <span class="album-price-currency">XRP</span>
                </div>
                
                <div class="album-savings-display" id="album-savings-display">
                  ${currentAlbumPrice < individualTotal 
                    ? `<span class="savings-active">Fans save ${(individualTotal - currentAlbumPrice).toFixed(2)} XRP (${Math.round((1 - currentAlbumPrice / individualTotal) * 100)}% off)</span>`
                    : `<span class="savings-none">Set lower than ${individualTotal.toFixed(2)} XRP for a discount</span>`
                  }
                </div>
              </div>
            ` : `
              <!-- Single Track Pricing -->
              <div class="single-pricing-section">
                <div class="section-label">Track Price</div>
                <div class="single-price-input-row">
                  <input type="number" class="form-input" 
                         id="single-price-input" 
                         value="${defaultTrackPrice}" 
                         step="0.01" min="0.01">
                  <span class="single-price-currency">XRP</span>
                </div>
              </div>
            `}
            
            <!-- Warning -->
            <div class="edit-price-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>Price changes apply to future sales only. Already sold NFTs are not affected.</span>
            </div>
            
            <!-- Status -->
            <div class="edit-price-status" id="edit-price-status" style="display: none;">
              <div class="spinner"></div>
              <span id="edit-price-status-text">Updating...</span>
            </div>
            
            <!-- Actions -->
            <div class="edit-price-actions" id="edit-price-actions">
              <button class="btn btn-secondary" onclick="EditPriceModal.close()">Cancel</button>
              <button class="btn btn-primary" id="save-price-btn" onclick="EditPriceModal.save()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Prices
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .edit-price-modal { max-width: 480px; }
        .edit-price-preview {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .edit-price-cover {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
        }
        .edit-price-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .edit-price-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .edit-price-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .edit-price-meta {
          font-size: 13px;
          color: var(--text-muted);
          text-transform: capitalize;
        }
        
        .section-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .section-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0 0 12px 0;
        }
        
        /* Track pricing list */
        .track-pricing-section {
          margin-bottom: 20px;
        }
        .track-price-list {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .track-price-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .track-price-row:last-child {
          border-bottom: none;
        }
        .track-price-num {
          width: 24px;
          height: 24px;
          background: var(--accent);
          border-radius: 50%;
          color: white;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .track-price-name {
          flex: 1;
          font-size: 14px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-price-input-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .track-price-input {
          width: 80px;
          padding: 8px 10px;
          background: var(--bg-hover);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          text-align: right;
          outline: none;
        }
        .track-price-input:focus {
          border-color: var(--accent);
        }
        .track-price-currency {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .tracks-total-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-md);
          margin-top: 12px;
          font-size: 14px;
        }
        .tracks-total-row span:first-child {
          color: var(--text-secondary);
        }
        #tracks-total {
          font-weight: 600;
          color: var(--text-primary);
        }
        
        /* Album pricing */
        .album-pricing-section {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: var(--radius-lg);
        }
        .album-price-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .album-price-input {
          width: 120px !important;
          font-size: 18px !important;
          font-weight: 700 !important;
          text-align: center;
        }
        .album-price-currency {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .album-savings-display {
          margin-top: 12px;
          font-size: 13px;
        }
        .savings-active {
          color: #22c55e;
          font-weight: 600;
        }
        .savings-none {
          color: var(--text-muted);
        }
        
        /* Single track pricing */
        .single-pricing-section {
          margin-bottom: 20px;
        }
        .single-price-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .single-price-input-row .form-input {
          width: 120px;
          font-size: 18px;
          font-weight: 700;
          text-align: center;
        }
        .single-price-currency {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        
        .edit-price-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-md);
          font-size: 13px;
          color: #f59e0b;
          margin-bottom: 20px;
        }
        .edit-price-warning svg {
          flex-shrink: 0;
          margin-top: 1px;
        }
        .edit-price-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .edit-price-status .spinner {
          width: 20px;
          height: 20px;
        }
        .edit-price-actions {
          display: flex;
          gap: 12px;
        }
        .edit-price-actions .btn {
          flex: 1;
        }
      </style>
    `;
    
    // Insert modal into DOM
    const container = document.getElementById('modals');
    if (container) {
      container.innerHTML = html;
      requestAnimationFrame(() => {
        container.querySelector('.modal-overlay')?.classList.add('visible');
      });
    }
    
    // Bind events for album pricing
    if (isAlbum) {
      this.bindAlbumPricingEvents(release);
    }
    
    // Close on backdrop click
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.close();
      }
    });
    
    // Close on escape
    document.addEventListener('keydown', this.handleEsc);
  },
  
  bindAlbumPricingEvents(release) {
    const trackInputs = document.querySelectorAll('.track-price-input');
    const albumInput = document.getElementById('album-price-input');
    const tracksTotal = document.getElementById('tracks-total');
    const savingsDisplay = document.getElementById('album-savings-display');
    
    const updateTotals = () => {
      // Calculate tracks total
      let total = 0;
      trackInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
      });
      tracksTotal.textContent = `${total.toFixed(2)} XRP`;
      
      // Update savings display
      const albumPrice = parseFloat(albumInput.value) || 0;
      if (albumPrice < total && albumPrice > 0) {
        const saved = (total - albumPrice).toFixed(2);
        const pct = Math.round((1 - albumPrice / total) * 100);
        savingsDisplay.innerHTML = `<span class="savings-active">Fans save ${saved} XRP (${pct}% off)</span>`;
      } else {
        savingsDisplay.innerHTML = `<span class="savings-none">Set lower than ${total.toFixed(2)} XRP for a discount</span>`;
      }
    };
    
    // Bind track price inputs
    trackInputs.forEach(input => {
      input.addEventListener('input', updateTotals);
    });
    
    // Bind album price input
    albumInput.addEventListener('input', updateTotals);
  },
  
  handleEsc(e) {
    if (e.key === 'Escape') {
      EditPriceModal.close();
    }
  },
  
  close() {
    const container = document.getElementById('modals');
    if (container) {
      const overlay = container.querySelector('.modal-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
          // Restore the release modal if it was open
          if (this.currentRelease) {
            Modals.showRelease(this.currentRelease);
          }
        }, 200);
      }
    }
    document.removeEventListener('keydown', this.handleEsc);
    this.currentRelease = null;
  },
  
  async save() {
    const release = this.currentRelease;
    const isAlbum = release.type !== 'single' && (release.tracks?.length || 1) > 1;
    
    const statusEl = document.getElementById('edit-price-status');
    const actionsEl = document.getElementById('edit-price-actions');
    
    // Gather pricing data
    let trackPrices = [];
    let albumPrice = null;
    let songPrice = null;
    
    if (isAlbum) {
      // Get per-track prices
      document.querySelectorAll('.track-price-input').forEach(input => {
        const trackId = input.dataset.trackId;
        const price = parseFloat(input.value);
        if (trackId && price > 0) {
          trackPrices.push({ trackId, price });
        }
      });
      
      // Get album price
      albumPrice = parseFloat(document.getElementById('album-price-input').value);
      
      // Use first track price as songPrice fallback
      songPrice = trackPrices[0]?.price || albumPrice / release.tracks.length;
      
      if (!albumPrice || albumPrice <= 0) {
        alert('Please enter a valid album price');
        return;
      }
    } else {
      // Single track
      songPrice = parseFloat(document.getElementById('single-price-input').value);
      
      if (!songPrice || songPrice <= 0) {
        alert('Please enter a valid price');
        return;
      }
    }
    
    // Show loading
    statusEl.style.display = 'flex';
    actionsEl.style.display = 'none';
    
    try {
      // Call API to update prices
      const response = await fetch('/api/releases/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          artistAddress: AppState.user.address,
          songPrice: songPrice,
          albumPrice: albumPrice,
          trackPrices: trackPrices,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update prices');
      }
      
      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span style="color: var(--success); font-weight: 600;">Prices Updated!</span>
      `;
      
      // Update the release in memory
      this.currentRelease.songPrice = songPrice;
      if (albumPrice) {
        this.currentRelease.albumPrice = albumPrice;
      }
      if (trackPrices.length > 0 && this.currentRelease.tracks) {
        trackPrices.forEach(tp => {
          const track = this.currentRelease.tracks.find(t => t.id === tp.trackId);
          if (track) track.price = tp.price;
        });
      }
      
      // Refresh releases in AppState
      if (typeof AppState !== 'undefined' && AppState.releases) {
        const idx = AppState.releases.findIndex(r => r.id === release.id);
        if (idx !== -1) {
          AppState.releases[idx].songPrice = songPrice;
          if (albumPrice) AppState.releases[idx].albumPrice = albumPrice;
        }
      }
      
      // Close after short delay and reopen release modal
      setTimeout(() => {
        const container = document.getElementById('modals');
        if (container) {
          container.innerHTML = '';
        }
        document.removeEventListener('keydown', this.handleEsc);
        Modals.showRelease(this.currentRelease);
        this.currentRelease = null;
      }, 1500);
      
    } catch (error) {
      console.error('Failed to update prices:', error);
      
      statusEl.innerHTML = `
        <div style="color: var(--error);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <span style="color: var(--error);">${error.message}</span>
      `;
      
      statusEl.style.display = 'flex';
      actionsEl.style.display = 'flex';
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EditPriceModal = EditPriceModal;
}
