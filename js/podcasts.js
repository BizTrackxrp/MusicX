/**
 * XRP Music - Podcasts Page
 * Browse and discover podcasts on the platform
 */

const PodcastsPage = {
  podcasts: [],
  isLoading: false,

  async render() {
    return `
      ${this.getStyles()}
      <div class="podcasts-page">
        <div class="podcasts-header">
          <div class="section-title-group">
            <div class="section-icon podcasts">🎙️</div>
            <div>
              <h1>Podcasts</h1>
              <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
                Discover podcasts on XRP Music
              </p>
            </div>
          </div>
        </div>

        <div id="podcasts-content">
          <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading podcasts...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadPodcasts();
  },

  async loadPodcasts() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(`/api/releases?contentType=podcast`);
      if (!response.ok) throw new Error('Failed to load podcasts');
      
      const data = await response.json();
      this.podcasts = data.releases || [];
      
      this.renderContent();
    } catch (error) {
      console.error('Error loading podcasts:', error);
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  },

  renderContent() {
    const container = document.getElementById('podcasts-content');
    if (!container) return;

    if (this.podcasts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎙️</div>
          <h3>No podcasts yet</h3>
          <p>Be the first to upload a podcast!</p>
          ${AppState.user?.address ? `
            <button class="btn-primary" onclick="Modals.showCreate()">
              Upload Podcast
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="podcasts-grid">
        ${this.podcasts.map(podcast => this.renderPodcastCard(podcast)).join('')}
      </div>
    `;

    this.bindEvents();
  },

  renderPodcastCard(podcast) {
    const coverUrl = podcast.cover_url || '/placeholder.png';
    const editionsLeft = podcast.total_editions - (podcast.sold_editions || 0);
    
    return `
      <div class="podcast-card" data-release-id="${podcast.id}">
        <div class="podcast-cover">
          <img src="${coverUrl}" alt="${podcast.title}" loading="lazy">
          ${editionsLeft > 0 ? `
            <div class="editions-badge">${editionsLeft} left</div>
          ` : `
            <div class="sold-out-badge">Sold Out</div>
          `}
        </div>
        <div class="podcast-info">
          <div class="podcast-title">${podcast.title}</div>
          <div class="podcast-host">${podcast.artist_name || 'Unknown Host'}</div>
          ${podcast.description ? `
            <div class="podcast-description">${podcast.description.substring(0, 100)}${podcast.description.length > 100 ? '...' : ''}</div>
          ` : ''}
          <div class="podcast-footer">
            <div class="podcast-price">${podcast.album_price || podcast.song_price || 0} XRP</div>
            <button class="btn-secondary btn-sm play-podcast-btn" data-release-id="${podcast.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Listen
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderError() {
    const container = document.getElementById('podcasts-content');
    if (!container) return;

    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to load podcasts</h3>
        <p>Please try again later</p>
        <button class="btn-primary" onclick="PodcastsPage.loadPodcasts()">
          Retry
        </button>
      </div>
    `;
  },

  bindEvents() {
    // Card clicks - open release modal
    document.querySelectorAll('.podcast-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-podcast-btn')) return;
        const releaseId = card.dataset.releaseId;
        Modals.showRelease(releaseId);
      });
    });

    // Play buttons
    document.querySelectorAll('.play-podcast-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const podcast = this.podcasts.find(p => p.id === releaseId);
        if (podcast?.tracks?.length > 0) {
          StreamPage.playRelease(podcast);
        }
      });
    });
  },

  getStyles() {
    return `
      <style>
        .podcasts-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .podcasts-header {
          margin-bottom: 32px;
        }

        .section-icon.podcasts {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        .podcasts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 24px;
        }

        .podcast-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .podcast-card:hover {
          border-color: var(--accent);
          transform: translateY(-4px);
        }

        .podcast-cover {
          position: relative;
          aspect-ratio: 1;
          background: var(--bg-hover);
        }

        .podcast-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .editions-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 8px;
          background: rgba(59, 130, 246, 0.9);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .sold-out-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 8px;
          background: rgba(239, 68, 68, 0.9);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .podcast-info {
          padding: 12px;
        }

        .podcast-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podcast-host {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .podcast-description {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 12px;
        }

        .podcast-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }

        .podcast-price {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent);
        }

        .play-podcast-btn {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .empty-state, .error-state {
          text-align: center;
          padding: 80px 20px;
        }

        .empty-icon, .error-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h3, .error-state h3 {
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .empty-state p, .error-state p {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        @media (max-width: 640px) {
          .podcasts-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 16px;
          }
        }
      </style>
    `;
  },
};
