/**
 * XRP Music - Audiobooks Page
 * Browse and discover audiobooks on the platform
 */

const AudiobooksPage = {
  audiobooks: [],
  isLoading: false,

  async render() {
    return `
      ${this.getStyles()}
      <div class="audiobooks-page">
        <div class="audiobooks-header">
          <div class="section-title-group">
            <div class="section-icon audiobooks">📚</div>
            <div>
              <h1>Audiobooks</h1>
              <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
                Discover audiobooks on XRP Music
              </p>
            </div>
          </div>
        </div>

        <div id="audiobooks-content">
          <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading audiobooks...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadAudiobooks();
  },

  async loadAudiobooks() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(`/api/releases?contentType=audiobook`);
      if (!response.ok) throw new Error('Failed to load audiobooks');
      
      const data = await response.json();
      this.audiobooks = data.releases || [];
      
      this.renderContent();
    } catch (error) {
      console.error('Error loading audiobooks:', error);
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  },

  renderContent() {
    const container = document.getElementById('audiobooks-content');
    if (!container) return;

    if (this.audiobooks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No audiobooks yet</h3>
          <p>Be the first to upload an audiobook!</p>
          ${AppState.user?.address ? `
            <button class="btn-primary" onclick="Modals.showCreate()">
              Upload Audiobook
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="audiobooks-grid">
        ${this.audiobooks.map(audiobook => this.renderAudiobookCard(audiobook)).join('')}
      </div>
    `;

    this.bindEvents();
  },

  renderAudiobookCard(audiobook) {
    const coverUrl = audiobook.cover_url || '/placeholder.png';
    const editionsLeft = audiobook.total_editions - (audiobook.sold_editions || 0);
    
    return `
      <div class="audiobook-card" data-release-id="${audiobook.id}">
        <div class="audiobook-cover">
          <img src="${coverUrl}" alt="${audiobook.title}" loading="lazy">
          ${editionsLeft > 0 ? `
            <div class="editions-badge">${editionsLeft} left</div>
          ` : `
            <div class="sold-out-badge">Sold Out</div>
          `}
        </div>
        <div class="audiobook-info">
          <div class="audiobook-title">${audiobook.title}</div>
          <div class="audiobook-artist">${audiobook.artist_name || 'Unknown Artist'}</div>
          ${audiobook.description ? `
            <div class="audiobook-description">${audiobook.description.substring(0, 100)}${audiobook.description.length > 100 ? '...' : ''}</div>
          ` : ''}
          <div class="audiobook-footer">
            <div class="audiobook-price">${audiobook.album_price || audiobook.song_price || 0} XRP</div>
            <button class="btn-secondary btn-sm play-audiobook-btn" data-release-id="${audiobook.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Preview
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderError() {
    const container = document.getElementById('audiobooks-content');
    if (!container) return;

    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to load audiobooks</h3>
        <p>Please try again later</p>
        <button class="btn-primary" onclick="AudiobooksPage.loadAudiobooks()">
          Retry
        </button>
      </div>
    `;
  },

  bindEvents() {
    // Card clicks - open release modal
    document.querySelectorAll('.audiobook-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-audiobook-btn')) return;
        const releaseId = card.dataset.releaseId;
        Modals.showRelease(releaseId);
      });
    });

    // Play preview buttons
    document.querySelectorAll('.play-audiobook-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const releaseId = btn.dataset.releaseId;
        const audiobook = this.audiobooks.find(a => a.id === releaseId);
        if (audiobook?.tracks?.length > 0) {
          StreamPage.playRelease(audiobook);
        }
      });
    });
  },

  getStyles() {
    return `
      <style>
        .audiobooks-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .audiobooks-header {
          margin-bottom: 32px;
        }

        .section-icon.audiobooks {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        .audiobooks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 24px;
        }

        .audiobook-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .audiobook-card:hover {
          border-color: var(--accent);
          transform: translateY(-4px);
        }

        .audiobook-cover {
          position: relative;
          aspect-ratio: 1;
          background: var(--bg-hover);
        }

        .audiobook-cover img {
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

        .audiobook-info {
          padding: 12px;
        }

        .audiobook-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .audiobook-artist {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .audiobook-description {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 12px;
        }

        .audiobook-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }

        .audiobook-price {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent);
        }

        .play-audiobook-btn {
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
          .audiobooks-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 16px;
          }
        }
      </style>
    `;
  },
};
