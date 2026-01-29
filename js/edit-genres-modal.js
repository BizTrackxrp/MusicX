/**
 * XRP Music - Edit Genres Modal
 * Allows artists to assign/edit genres for their tracks
 */

const EditGenresModal = {
  currentRelease: null,
  trackGenres: {}, // { trackId: [genre1, genre2] }
  
  /**
   * Show the edit genres modal for a release
   * @param {object} release - The release object
   */
  async show(release) {
    this.currentRelease = release;
    this.trackGenres = {};
    
    // Fetch current genres from database (not from stale release object)
    try {
      const response = await fetch(`/api/get-track-genres?releaseId=${release.id}`);
      const data = await response.json();
      
      if (data.success && data.tracks) {
        data.tracks.forEach(track => {
          const genres = [];
          if (track.genre) genres.push(track.genre);
          if (track.genreSecondary) genres.push(track.genreSecondary);
          this.trackGenres[track.id] = genres;
        });
      }
    } catch (error) {
      console.error('Failed to fetch track genres:', error);
      // Fall back to release data if fetch fails
      if (release.tracks) {
        release.tracks.forEach(track => {
          const genres = [];
          if (track.genre) genres.push(track.genre);
          if (track.genreSecondary) genres.push(track.genreSecondary);
          this.trackGenres[track.id] = genres;
        });
      }
    }
    
    const html = `
      <div class="modal-overlay edit-genres-modal-overlay">
        <div class="modal edit-genres-modal">
          <div class="modal-header">
            <div class="modal-title">Edit Genres</div>
            <button class="modal-close" id="edit-genres-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="edit-genres-release-info">
              <img src="${release.coverUrl || '/placeholder.png'}" alt="${release.title}" class="edit-genres-cover">
              <div class="edit-genres-release-details">
                <h3>${release.title}</h3>
                <p>${release.tracks?.length || 0} track${release.tracks?.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            
            <div class="edit-genres-tracks" id="edit-genres-tracks">
              ${this.renderTrackList(release.tracks || [])}
            </div>
            
            <div class="edit-genres-actions">
              <button class="btn btn-secondary" id="edit-genres-cancel">Cancel</button>
              <button class="btn btn-primary" id="edit-genres-save">
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .edit-genres-modal {
          max-width: 600px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
        }
        
        .edit-genres-modal .modal-body {
          overflow-y: auto;
          padding: 20px 24px 24px;
        }
        
        .edit-genres-release-info {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 20px;
        }
        
        .edit-genres-cover {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-md);
          object-fit: cover;
        }
        
        .edit-genres-release-details h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }
        
        .edit-genres-release-details p {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
        }
        
        .edit-genres-track {
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 12px;
        }
        
        .edit-genres-track-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .edit-genres-track-number {
          width: 24px;
          height: 24px;
          background: var(--bg-secondary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
        
        .edit-genres-track-title {
          flex: 1;
          font-weight: 500;
        }
        
        .edit-genres-track-current {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .edit-genres-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .edit-genre-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 100px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 12px;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .edit-genre-chip:hover {
          border-color: var(--genre-color, var(--accent-primary));
          background: color-mix(in srgb, var(--genre-color, var(--accent-primary)) 10%, transparent);
        }
        
        .edit-genre-chip.selected {
          border-color: var(--genre-color, var(--accent-primary));
          background: color-mix(in srgb, var(--genre-color, var(--accent-primary)) 25%, transparent);
          color: var(--genre-color, var(--accent-primary));
          font-weight: 500;
        }
        
        .edit-genre-chip .genre-icon {
          font-size: 14px;
        }
        
        .edit-genres-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 10px;
        }
        
        .edit-genres-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
        }
        
        .edit-genres-actions .btn {
          flex: 1;
        }
        
        .edit-genres-actions .btn-primary.saving {
          opacity: 0.7;
          pointer-events: none;
        }
        
        /* Expandable genre selector */
        .genre-selector-expand {
          background: none;
          border: 1px dashed var(--border-color);
          border-radius: 100px;
          padding: 6px 12px;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .genre-selector-expand:hover {
          border-color: var(--text-secondary);
          color: var(--text-secondary);
        }
        
        .genre-selector-expanded {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
        }
        
        .genre-selector-category {
          margin-bottom: 12px;
        }
        
        .genre-selector-category-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        
        @media (max-width: 640px) {
          .edit-genres-modal {
            max-height: 90vh;
          }
          
          .edit-genre-chip {
            padding: 5px 10px;
            font-size: 11px;
          }
        }
      </style>
    `;
    
    const container = document.getElementById('modals');
    if (!container) return;
    
    container.innerHTML = html;
    
    // Show with animation
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    
    this.bindEvents();
  },
  
  /**
   * Render the track list with genre selectors
   */
  renderTrackList(tracks) {
    // Get popular/common genres for quick selection
    const quickGenres = ['hiphop', 'rap', 'rnb', 'pop', 'rock', 'electronic', 'country', 'jazz', 'classical', 'lofi', 'ambient', 'instrumental'];
    
    return tracks.map((track, idx) => {
      const selectedGenres = this.trackGenres[track.id] || [];
      
      return `
        <div class="edit-genres-track" data-track-id="${track.id}">
          <div class="edit-genres-track-header">
            <span class="edit-genres-track-number">${idx + 1}</span>
            <span class="edit-genres-track-title">${track.title}</span>
            <span class="edit-genres-track-current">
              ${selectedGenres.length > 0 
                ? selectedGenres.map(g => Genres.get(g)?.name || g).join(', ')
                : 'No genre'
              }
            </span>
          </div>
          
          <div class="edit-genres-selector" data-track-id="${track.id}">
            ${quickGenres.map(genreId => {
              const genre = Genres.get(genreId);
              const isSelected = selectedGenres.includes(genreId);
              return `
                <button type="button" 
                  class="edit-genre-chip ${isSelected ? 'selected' : ''}" 
                  data-genre="${genreId}"
                  style="--genre-color: ${genre?.color || '#888'}">
                  <span class="genre-icon">${genre?.icon || '🎵'}</span>
                  <span>${genre?.name || genreId}</span>
                </button>
              `;
            }).join('')}
            <button type="button" class="genre-selector-expand" data-track-id="${track.id}">
              More...
            </button>
          </div>
          
          <div class="genre-selector-expanded" id="expanded-genres-${track.id}" style="display: none;">
            ${this.renderExpandedGenres(track.id, selectedGenres)}
          </div>
          
          <div class="edit-genres-hint">Select up to 2 genres</div>
        </div>
      `;
    }).join('');
  },
  
  /**
   * Render expanded genre selector with all genres grouped
   */
  renderExpandedGenres(trackId, selectedGenres) {
    const grouped = Genres.getGrouped();
    
    return Object.entries(grouped).map(([category, genres]) => `
      <div class="genre-selector-category">
        <div class="genre-selector-category-title">${category}</div>
        <div class="edit-genres-selector" data-track-id="${trackId}">
          ${genres.map(genre => {
            const isSelected = selectedGenres.includes(genre.id);
            return `
              <button type="button" 
                class="edit-genre-chip ${isSelected ? 'selected' : ''}" 
                data-genre="${genre.id}"
                style="--genre-color: ${genre.color}">
                <span class="genre-icon">${genre.icon}</span>
                <span>${genre.name}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  },
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Close button
    document.getElementById('edit-genres-close')?.addEventListener('click', () => this.close());
    document.getElementById('edit-genres-cancel')?.addEventListener('click', () => this.close());
    
    // Click outside to close
    document.querySelector('.edit-genres-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-genres-modal-overlay')) {
        this.close();
      }
    });
    
    // Save button
    document.getElementById('edit-genres-save')?.addEventListener('click', () => this.save());
    
    // Genre chip clicks
    document.querySelectorAll('.edit-genre-chip').forEach(chip => {
      chip.addEventListener('click', (e) => this.toggleGenre(e));
    });
    
    // Expand buttons
    document.querySelectorAll('.genre-selector-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackId = e.target.dataset.trackId;
        const expanded = document.getElementById(`expanded-genres-${trackId}`);
        if (expanded) {
          const isHidden = expanded.style.display === 'none';
          expanded.style.display = isHidden ? 'block' : 'none';
          e.target.textContent = isHidden ? 'Less...' : 'More...';
        }
      });
    });
  },
  
  /**
   * Toggle genre selection for a track
   */
  toggleGenre(e) {
    const chip = e.target.closest('.edit-genre-chip');
    if (!chip) return;
    
    const selector = chip.closest('.edit-genres-selector');
    const trackId = selector?.dataset.trackId;
    const genreId = chip.dataset.genre;
    
    if (!trackId || !genreId) return;
    
    // Initialize if needed
    if (!this.trackGenres[trackId]) {
      this.trackGenres[trackId] = [];
    }
    
    const currentGenres = this.trackGenres[trackId];
    const isSelected = currentGenres.includes(genreId);
    
    if (isSelected) {
      // Remove genre
      this.trackGenres[trackId] = currentGenres.filter(g => g !== genreId);
    } else {
      // Add genre (max 2)
      if (currentGenres.length >= 2) {
        // Remove oldest, add new
        this.trackGenres[trackId] = [currentGenres[1], genreId];
      } else {
        this.trackGenres[trackId] = [...currentGenres, genreId];
      }
    }
    
    // Update UI - find all chips with this genre for this track and update them
    const trackContainer = document.querySelector(`.edit-genres-track[data-track-id="${trackId}"]`);
    if (trackContainer) {
      // Update all chips in both quick selector and expanded
      trackContainer.querySelectorAll(`.edit-genre-chip[data-genre="${genreId}"]`).forEach(c => {
        if (this.trackGenres[trackId].includes(genreId)) {
          c.classList.add('selected');
        } else {
          c.classList.remove('selected');
        }
      });
      
      // Also update other chips if we removed one due to max 2 limit
      trackContainer.querySelectorAll('.edit-genre-chip').forEach(c => {
        const gId = c.dataset.genre;
        if (this.trackGenres[trackId].includes(gId)) {
          c.classList.add('selected');
        } else {
          c.classList.remove('selected');
        }
      });
      
      // Update the "current genre" text
      const currentText = trackContainer.querySelector('.edit-genres-track-current');
      if (currentText) {
        const selectedGenres = this.trackGenres[trackId];
        currentText.textContent = selectedGenres.length > 0 
          ? selectedGenres.map(g => Genres.get(g)?.name || g).join(', ')
          : 'No genre';
      }
    }
  },
  
  /**
   * Save genre changes
   */
  async save() {
    const saveBtn = document.getElementById('edit-genres-save');
    if (!saveBtn) return;
    
    saveBtn.classList.add('saving');
    saveBtn.innerHTML = '<span>Saving...</span>';
    
    try {
      // Prepare the data
      const updates = Object.entries(this.trackGenres).map(([trackId, genres]) => ({
        trackId: trackId,
        genre: genres[0] || null, // Primary genre goes in track.genre
        genreSecondary: genres[1] || null // Secondary (if we add this column later)
      }));
      
      // Call API to update
      const response = await fetch('/api/update-track-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: this.currentRelease.id,
          tracks: updates
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        Modals.showToast('Genres updated successfully!');
        
        // Clear genre playlist cache so it refreshes
        if (typeof GenrePlaylists !== 'undefined') {
          GenrePlaylists.clearCache();
        }
        
        this.close();
      } else {
        throw new Error(data.error || 'Failed to save');
      }
      
    } catch (error) {
      console.error('Failed to save genres:', error);
      Modals.showToast('Failed to save genres');
      saveBtn.classList.remove('saving');
      saveBtn.innerHTML = '<span>Save Changes</span>';
    }
  },
  
  /**
   * Close the modal
   */
  close() {
    const overlay = document.querySelector('.edit-genres-modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }
    this.currentRelease = null;
    this.trackGenres = {};
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditGenresModal;
}
