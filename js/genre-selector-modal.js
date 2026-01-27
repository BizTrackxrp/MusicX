/**
 * XRP Music - Genre Selector Modal
 * Used during upload flow when track genre differs from artist profile
 */

const GenreSelectorModal = {
  callback: null,
  
  /**
   * Show the genre selector modal
   * @param {object} options - Configuration options
   * @param {string[]} options.artistGenres - The artist's profile genres
   * @param {string} options.trackTitle - The track title being uploaded
   * @param {function} options.onSelect - Callback when genre is selected
   * @param {function} options.onCancel - Callback when cancelled
   */
  show(options = {}) {
    const { artistGenres = [], trackTitle = 'this track', onSelect, onCancel } = options;
    
    this.callback = onSelect;
    
    const artistGenreNames = artistGenres.map(id => Genres.get(id).name).join(' & ');
    
    const html = `
      <div class="modal-overlay genre-selector-modal-overlay">
        <div class="modal genre-selector-modal">
          <div class="modal-header">
            <div class="modal-title">Select Track Genre</div>
            <button class="modal-close" id="genre-modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="genre-modal-info">
              <p>Your profile genres are <strong>${artistGenreNames || 'not set'}</strong>.</p>
              <p>What genre is <strong>"${trackTitle}"</strong>?</p>
            </div>
            
            <div class="genre-modal-selector" id="genre-modal-selector">
              ${this.renderGenreGrid()}
            </div>
            
            <div class="genre-modal-actions">
              <button class="btn btn-secondary" id="genre-modal-cancel">Cancel</button>
              <button class="btn btn-primary" id="genre-modal-confirm" disabled>
                Select Genre
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .genre-selector-modal {
          max-width: 600px;
          max-height: 80vh;
        }
        
        .genre-modal-info {
          margin-bottom: 20px;
          padding: 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
        }
        
        .genre-modal-info p {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary);
        }
        
        .genre-modal-info p:first-child {
          margin-bottom: 8px;
        }
        
        .genre-modal-info strong {
          color: var(--text-primary);
        }
        
        .genre-modal-selector {
          max-height: 400px;
          overflow-y: auto;
          margin-bottom: 20px;
        }
        
        .genre-group {
          margin-bottom: 20px;
        }
        
        .genre-group-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-left: 4px;
        }
        
        .genre-group-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .genre-modal-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid var(--border-color);
          border-radius: 100px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .genre-modal-chip:hover {
          border-color: var(--genre-color);
          color: var(--genre-color);
        }
        
        .genre-modal-chip.selected {
          border-color: var(--genre-color);
          background: color-mix(in srgb, var(--genre-color) 15%, transparent);
          color: var(--genre-color);
        }
        
        .genre-modal-chip .genre-icon {
          font-size: 14px;
        }
        
        .genre-modal-actions {
          display: flex;
          gap: 12px;
        }
        
        .genre-modal-actions .btn {
          flex: 1;
        }
      </style>
    `;
    
    // Create modal container
    const container = document.getElementById('modals');
    if (!container) return;
    
    container.innerHTML = html;
    
    // Show with animation
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    
    // Bind events
    this.bindEvents(onCancel);
  },
  
  renderGenreGrid() {
    const grouped = Genres.getGrouped();
    
    return Object.entries(grouped).map(([category, genres]) => `
      <div class="genre-group">
        <div class="genre-group-title">${category}</div>
        <div class="genre-group-chips">
          ${genres.map(genre => `
            <button type="button" 
              class="genre-modal-chip" 
              data-genre="${genre.id}"
              style="--genre-color: ${genre.color}">
              <span class="genre-icon">${genre.icon}</span>
              <span>${genre.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  },
  
  bindEvents(onCancel) {
    let selectedGenre = null;
    
    // Genre chip clicks
    document.querySelectorAll('.genre-modal-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // Deselect others
        document.querySelectorAll('.genre-modal-chip').forEach(c => c.classList.remove('selected'));
        
        // Select this one
        chip.classList.add('selected');
        selectedGenre = chip.dataset.genre;
        
        // Enable confirm button
        document.getElementById('genre-modal-confirm').disabled = false;
      });
    });
    
    // Confirm button
    document.getElementById('genre-modal-confirm')?.addEventListener('click', () => {
      if (selectedGenre && this.callback) {
        this.callback(selectedGenre);
      }
      this.close();
    });
    
    // Cancel button
    document.getElementById('genre-modal-cancel')?.addEventListener('click', () => {
      if (onCancel) onCancel();
      this.close();
    });
    
    // Close button
    document.getElementById('genre-modal-close')?.addEventListener('click', () => {
      if (onCancel) onCancel();
      this.close();
    });
    
    // Click outside to close
    document.querySelector('.genre-selector-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('genre-selector-modal-overlay')) {
        if (onCancel) onCancel();
        this.close();
      }
    });
  },
  
  close() {
    const container = document.getElementById('modals');
    if (!container) return;
    
    const overlay = container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        container.innerHTML = '';
      }, 200);
    }
    
    this.callback = null;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenreSelectorModal;
}
