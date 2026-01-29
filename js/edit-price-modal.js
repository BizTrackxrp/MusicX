/**
 * Edit Price Modal
 * Allows artists to update the price of their releases
 */

const EditPriceModal = {
  currentRelease: null,
  
  show(release) {
    this.currentRelease = release;
    
    const trackCount = release.tracks?.length || 1;
    const currentTrackPrice = parseFloat(release.songPrice) || 0;
    const currentAlbumPrice = currentTrackPrice * trackCount;
    const isAlbum = release.type !== 'single' && trackCount > 1;
    
    const html = `
      <div class="modal-overlay edit-price-modal-overlay">
        <div class="modal edit-price-modal">
          <div class="modal-header">
            <div class="modal-title">Edit Price</div>
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
                <div class="edit-price-meta">${release.type} • ${trackCount} track${trackCount > 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <!-- Current Price Display -->
            <div class="current-price-box">
              <div class="current-price-label">Current Price</div>
              <div class="current-price-values">
                <span class="current-track-price">${currentTrackPrice} XRP per track</span>
                ${isAlbum ? `<span class="current-album-price">${currentAlbumPrice} XRP total for album</span>` : ''}
              </div>
            </div>
            
            <!-- New Price Input -->
            <div class="form-group">
              <label class="form-label">New Price per Track (XRP)</label>
              <input type="number" class="form-input" id="new-track-price" 
                     value="${currentTrackPrice}" step="0.01" min="0.01" 
                     placeholder="Enter price per track">
              <p class="form-hint">This is the price buyers pay for each individual track NFT</p>
            </div>
            
            ${isAlbum ? `
              <div class="new-album-price-display">
                <span>New album total:</span>
                <span id="new-album-total">${currentAlbumPrice} XRP</span>
                <span class="album-calc">(${trackCount} tracks × <span id="calc-track-price">${currentTrackPrice}</span> XRP)</span>
              </div>
            ` : ''}
            
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
                Save Price
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .edit-price-modal { max-width: 420px; }
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
        .current-price-box {
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .current-price-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .current-price-values {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .current-track-price {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .current-album-price {
          font-size: 14px;
          color: var(--accent);
        }
        .new-album-price-display {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: var(--radius-md);
          margin-bottom: 20px;
          font-size: 14px;
        }
        .new-album-price-display span:first-child {
          color: var(--text-secondary);
        }
        #new-album-total {
          font-weight: 700;
          color: var(--accent);
          font-size: 16px;
        }
        .album-calc {
          font-size: 12px;
          color: var(--text-muted);
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
    
    // Bind price input to update album total
    const priceInput = document.getElementById('new-track-price');
    if (priceInput && isAlbum) {
      priceInput.addEventListener('input', () => {
        const newPrice = parseFloat(priceInput.value) || 0;
        const newTotal = (newPrice * trackCount).toFixed(2);
        document.getElementById('new-album-total').textContent = `${newTotal} XRP`;
        document.getElementById('calc-track-price').textContent = newPrice;
      });
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
    const newPrice = parseFloat(document.getElementById('new-track-price').value);
    
    if (!newPrice || newPrice <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    const statusEl = document.getElementById('edit-price-status');
    const actionsEl = document.getElementById('edit-price-actions');
    
    // Show loading
    statusEl.style.display = 'flex';
    actionsEl.style.display = 'none';
    
    try {
      // Call API to update price
      const response = await fetch('/api/releases/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: this.currentRelease.id,
          artistAddress: AppState.user.address,
          newPrice: newPrice,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update price');
      }
      
      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span style="color: var(--success); font-weight: 600;">Price Updated!</span>
      `;
      
      // Update the release in memory
      this.currentRelease.songPrice = newPrice;
      if (this.currentRelease.type !== 'single') {
        this.currentRelease.albumPrice = newPrice * (this.currentRelease.tracks?.length || 1);
      }
      
      // Refresh releases in AppState
      if (typeof AppState !== 'undefined' && AppState.releases) {
        const idx = AppState.releases.findIndex(r => r.id === this.currentRelease.id);
        if (idx !== -1) {
          AppState.releases[idx].songPrice = newPrice;
          if (AppState.releases[idx].type !== 'single') {
            AppState.releases[idx].albumPrice = newPrice * (AppState.releases[idx].tracks?.length || 1);
          }
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
      console.error('Failed to update price:', error);
      
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
      
      actionsEl.style.display = 'flex';
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EditPriceModal = EditPriceModal;
}
