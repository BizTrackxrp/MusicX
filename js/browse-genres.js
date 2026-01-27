/**
 * XRP Music - Browse Genres Page
 * Shows all genre categories with track counts
 */

const BrowseGenresPage = {
  genreCounts: {},
  
  async render() {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
      <div class="browse-genres-page">
        <div class="browse-genres-header">
          <h1 class="browse-genres-title">Browse by Genre</h1>
          <p class="browse-genres-subtitle">Discover music across all genres on XRP Music</p>
        </div>
        
        <div class="genre-categories-loading">
          <div class="spinner"></div>
          <p>Loading genres...</p>
        </div>
      </div>
      
      <style>
        .browse-genres-page {
          padding: 40px 24px 120px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .browse-genres-header {
          margin-bottom: 40px;
        }
        
        .browse-genres-title {
          font-size: 48px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        
        .browse-genres-subtitle {
          font-size: 16px;
          color: var(--text-secondary);
        }
        
        .genre-categories-loading {
          text-align: center;
          padding: 60px;
          color: var(--text-muted);
        }
        
        .genre-categories-loading .spinner {
          width: 32px;
          height: 32px;
          margin: 0 auto 16px;
        }
        
        .genre-category-section {
          margin-bottom: 48px;
        }
        
        .genre-category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        
        .genre-category-name {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .genre-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .genre-card {
          position: relative;
          aspect-ratio: 1.5;
          border-radius: var(--radius-xl);
          overflow: hidden;
          cursor: pointer;
          transition: transform 200ms, box-shadow 200ms;
          background: linear-gradient(135deg, var(--genre-color) 0%, color-mix(in srgb, var(--genre-color) 60%, black) 100%);
        }
        
        .genre-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px color-mix(in srgb, var(--genre-color) 30%, transparent);
        }
        
        .genre-card-content {
          position: absolute;
          inset: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        
        .genre-card-icon {
          font-size: 48px;
          position: absolute;
          top: 16px;
          right: 16px;
          opacity: 0.3;
        }
        
        .genre-card-name {
          font-size: 22px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }
        
        .genre-card-count {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
        }
        
        .genre-card-play {
          position: absolute;
          bottom: 16px;
          right: 16px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--success);
          border: none;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 200ms, transform 200ms;
        }
        
        .genre-card:hover .genre-card-play {
          opacity: 1;
          transform: translateY(0);
        }
        
        .genre-card-play:hover {
          transform: scale(1.1);
        }
        
        .genre-card-play svg {
          margin-left: 2px;
        }
        
        .empty-genres {
          text-align: center;
          padding: 80px 20px;
          color: var(--text-muted);
        }
        
        @media (max-width: 768px) {
          .browse-genres-page {
            padding: 24px 16px 120px;
          }
          
          .browse-genres-title {
            font-size: 32px;
          }
          
          .genre-cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          
          .genre-card {
            aspect-ratio: 1.2;
          }
          
          .genre-card-name {
            font-size: 16px;
          }
          
          .genre-card-icon {
            font-size: 32px;
          }
        }
      </style>
    `;
    
    // Load genre counts
    await this.loadGenreCounts();
    this.renderGenres();
  },
  
  async loadGenreCounts() {
    try {
      const counts = await GenrePlaylists.getAllGenresWithCounts();
      this.genreCounts = {};
      counts.forEach(item => {
        this.genreCounts[item.genre] = item.count;
      });
    } catch (error) {
      console.error('Failed to load genre counts:', error);
      this.genreCounts = {};
    }
  },
  
  renderGenres() {
    const container = document.querySelector('.browse-genres-page');
    if (!container) return;
    
    const grouped = Genres.getGrouped();
    
    // Filter out categories with no tracks (optional - you might want to show all)
    const hasAnyTracks = Object.values(this.genreCounts).some(count => count > 0);
    
    let html = `
      <div class="browse-genres-header">
        <h1 class="browse-genres-title">Browse by Genre</h1>
        <p class="browse-genres-subtitle">Discover music across all genres on XRP Music</p>
      </div>
    `;
    
    Object.entries(grouped).forEach(([category, genres]) => {
      // Calculate total tracks in category
      const categoryTotal = genres.reduce((sum, g) => sum + (this.genreCounts[g.id] || 0), 0);
      
      html += `
        <div class="genre-category-section">
          <div class="genre-category-header">
            <h2 class="genre-category-name">${category}</h2>
          </div>
          <div class="genre-cards-grid">
            ${genres.map(genre => {
              const count = this.genreCounts[genre.id] || 0;
              return `
                <div class="genre-card" style="--genre-color: ${genre.color}" data-genre="${genre.id}">
                  <div class="genre-card-content">
                    <span class="genre-card-icon">${genre.icon}</span>
                    <div class="genre-card-name">${genre.name}</div>
                    <div class="genre-card-count">${count} track${count !== 1 ? 's' : ''}</div>
                  </div>
                  <button class="genre-card-play" data-genre="${genre.id}" title="Play ${genre.name}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // Bind events
    container.querySelectorAll('.genre-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.genre-card-play')) {
          // Play button clicked
          e.stopPropagation();
          const genreId = e.target.closest('.genre-card-play').dataset.genre;
          GenrePlaylists.playGenre(genreId);
        } else {
          // Card clicked - navigate to genre page
          const genreId = card.dataset.genre;
          Router.navigate('genre', { id: genreId });
        }
      });
    });
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowseGenresPage;
}
