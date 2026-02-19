/**
 * XRP Music — Global Rewards Page
 * 
 * Sidebar nav item: "Rewards"
 * Shows all active rewards from all artists, chronological by default.
 * 
 * SORT OPTIONS:
 *   - Newest (default) — most recently created
 *   - Ending Soon — soonest expiry date
 *   - Most Claimed — highest claim count (most popular)
 * 
 * Each reward card links to the artist's profile Unlockable tab.
 * Users can claim directly from this page if they have the right NFT.
 */

const RewardsPage = {
  rewards: [],
  sort: 'newest',
  loading: false,

  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    return typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(url) : url;
  },

  async render() {
    UI.showLoading();
    this.loading = true;

    try {
      const resp = await fetch(`/api/rewards?page=global&sort=${this.sort}`);
      const data = await resp.json();
      this.rewards = data.rewards || [];
    } catch (error) {
      console.error('Failed to load rewards:', error);
      this.rewards = [];
    }

    this.loading = false;
    this.renderContent();
  },

  renderContent() {
    const html = `
      <div class="rewards-page animate-fade-in">
        <div class="rewards-header">
          <div>
            <h2 class="section-title">🎁 Rewards</h2>
            <p class="rewards-subtitle">Exclusive offers from artists — own their NFTs to claim</p>
          </div>
          <div class="rewards-sort-tabs">
            <button class="sort-btn ${this.sort === 'newest' ? 'active' : ''}" data-sort="newest">Newest</button>
            <button class="sort-btn ${this.sort === 'ending_soon' ? 'active' : ''}" data-sort="ending_soon">Ending Soon</button>
            <button class="sort-btn ${this.sort === 'most_claimed' ? 'active' : ''}" data-sort="most_claimed">Most Popular</button>
          </div>
        </div>

        ${this.rewards.length === 0 ? `
          <div class="rewards-empty">
            <div class="empty-icon">🎁</div>
            <h3>No rewards yet</h3>
            <p>When artists offer rewards to their NFT holders, they'll appear here.</p>
          </div>
        ` : `
          <div class="rewards-global-grid">
            ${this.rewards.map(r => this.renderGlobalRewardCard(r)).join('')}
          </div>
        `}
      </div>
      ${this.getStyles()}
    `;

    UI.renderPage(html);
    this.bindEvents();
  },

  renderGlobalRewardCard(reward) {
    const remaining = reward.max_claims ? (reward.max_claims - (reward.claim_count || 0)) : null;
    const expired = reward.expires_at && new Date(reward.expires_at) < new Date();
    const typeBadges = { physical: '📦 Physical', digital: '💾 Digital', experience: '🎟️ Experience', access: '🔑 Access' };
    const typeBadge = typeBadges[reward.reward_type] || '🎁 Reward';
    const artistName = reward.artist_name || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(reward.artist_address) : reward.artist_address?.slice(0, 8) + '...');
    const avatarUrl = this.getImageUrl(reward.artist_avatar);

    return `
      <div class="global-reward-card" data-reward-id="${reward.id}" data-artist="${reward.artist_address}">
        ${reward.image_url ? `
          <div class="global-reward-image">
            <img src="${this.getImageUrl(reward.image_url)}" alt="${reward.title}" onerror="this.parentElement.style.display='none'">
            <span class="global-reward-type">${typeBadge}</span>
          </div>
        ` : `
          <div class="global-reward-image no-image">
            <div class="reward-placeholder-icon">🎁</div>
            <span class="global-reward-type">${typeBadge}</span>
          </div>
        `}
        <div class="global-reward-body">
          <div class="global-reward-artist" data-artist="${reward.artist_address}">
            ${reward.artist_avatar ? `<img src="${avatarUrl}" class="reward-artist-avatar" onerror="this.style.display='none'">` : ''}
            <span>${artistName}</span>
          </div>
          <h4 class="global-reward-title">${reward.title}</h4>
          ${reward.description ? `<p class="global-reward-desc">${reward.description.length > 120 ? reward.description.slice(0, 120) + '...' : reward.description}</p>` : ''}
          <div class="global-reward-meta">
            ${remaining !== null ? `<span class="meta-remaining">${remaining} left</span>` : ''}
            ${reward.expires_at ? `<span class="meta-expires">${expired ? 'Expired' : 'Ends ' + this.formatDate(reward.expires_at)}</span>` : ''}
            <span class="meta-claimed">${reward.claim_count || 0} claimed</span>
          </div>
        </div>
      </div>
    `;
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  bindEvents() {
    // Sort tabs
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sort = btn.dataset.sort;
        this.render();
      });
    });

    // Card clicks → navigate to artist profile unlockable tab
    document.querySelectorAll('.global-reward-card').forEach(card => {
      card.addEventListener('click', () => {
        const address = card.dataset.artist;
        if (address && typeof Router !== 'undefined') {
          Router.navigate('artist', { address, tab: 'unlockable' });
        }
      });
    });

    // Artist name clicks
    document.querySelectorAll('.global-reward-artist').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const address = el.dataset.artist;
        if (address && typeof Router !== 'undefined') {
          Router.navigate('artist', { address });
        }
      });
    });
  },

  getStyles() {
    return `
      <style>
        .rewards-page { max-width: 1200px; margin: 0 auto; }
        .rewards-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: 16px; margin-bottom: 28px;
        }
        .rewards-subtitle { font-size: 14px; color: var(--text-muted); margin: 4px 0 0; }
        .rewards-sort-tabs { display: flex; gap: 8px; }
        .sort-btn {
          padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-md); font-size: 13px; font-weight: 500;
          color: var(--text-secondary); cursor: pointer; transition: all 150ms;
        }
        .sort-btn:hover { border-color: var(--accent); color: var(--text-primary); }
        .sort-btn.active { border-color: var(--accent); background: rgba(59,130,246,0.1); color: var(--accent); }

        .rewards-empty {
          text-align: center; padding: 80px 24px; color: var(--text-muted);
        }
        .empty-icon { font-size: 64px; margin-bottom: 16px; }
        .rewards-empty h3 { color: var(--text-secondary); margin: 0 0 8px; }
        .rewards-empty p { font-size: 14px; }

        .rewards-global-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;
        }

        .global-reward-card {
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-lg); overflow: hidden; cursor: pointer; transition: all 200ms;
        }
        .global-reward-card:hover { transform: translateY(-3px); border-color: rgba(139,92,246,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }

        .global-reward-image { position: relative; height: 180px; background: var(--bg-hover); overflow: hidden; }
        .global-reward-image img { width: 100%; height: 100%; object-fit: cover; }
        .global-reward-image.no-image { display: flex; align-items: center; justify-content: center; }
        .reward-placeholder-icon { font-size: 48px; opacity: 0.3; }
        .global-reward-type {
          position: absolute; top: 10px; left: 10px; padding: 4px 10px;
          background: rgba(0,0,0,0.7); border-radius: 100px; font-size: 11px; color: white; font-weight: 500;
        }

        .global-reward-body { padding: 16px; }
        .global-reward-artist {
          display: flex; align-items: center; gap: 6px; font-size: 12px;
          color: var(--text-muted); margin-bottom: 6px; cursor: pointer;
        }
        .global-reward-artist:hover { color: var(--accent); }
        .reward-artist-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
        .global-reward-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 6px; }
        .global-reward-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.4; }
        .global-reward-meta { display: flex; gap: 12px; flex-wrap: wrap; }
        .global-reward-meta span { font-size: 11px; }
        .meta-remaining { color: var(--warning); font-weight: 600; }
        .meta-expires { color: var(--error); }
        .meta-claimed { color: var(--text-muted); }

        @media (max-width: 640px) {
          .rewards-header { flex-direction: column; }
          .rewards-sort-tabs { width: 100%; }
          .sort-btn { flex: 1; text-align: center; font-size: 12px; padding: 8px 10px; }
          .rewards-global-grid { grid-template-columns: 1fr; }
        }
      </style>
    `;
  },
};
