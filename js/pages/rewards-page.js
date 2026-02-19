/**
 * XRP Music — Global Rewards Discovery Page
 * Shows all active rewards across all artists.
 * Users can browse, filter, and claim rewards they're eligible for.
 */

const RewardsPage = {
  rewards: [],
  filteredRewards: [],
  loading: false,
  filter: 'all', // all | eligible | physical | digital | experience | access

  async render() {
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = `
      <style>
        .rewards-page { padding: 0; }
        .rewards-page-header {
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 24px; flex-wrap: wrap;
        }
        .rewards-page-title { font-size: 28px; font-weight: 800; flex: 1; }
        .rewards-filter-row {
          display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;
        }
        .rewards-filter-btn {
          padding: 8px 16px; border: 1px solid var(--border-color);
          border-radius: 20px; background: transparent;
          color: var(--text-secondary); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .rewards-filter-btn:hover { border-color: var(--accent); color: var(--text-primary); }
        .rewards-filter-btn.active {
          background: var(--accent); color: white; border-color: var(--accent);
        }

        .rewards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        @media(max-width: 640px) {
          .rewards-grid { grid-template-columns: 1fr; }
        }

        .reward-discovery-card {
          background: var(--bg-card, rgba(255,255,255,0.03));
          border: 1px solid var(--border-color);
          border-radius: 16px; overflow: hidden;
          transition: border-color 0.15s, transform 0.15s;
          cursor: pointer;
        }
        .reward-discovery-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
        }
        .reward-card-img {
          width: 100%; height: 200px; object-fit: cover;
          background: rgba(139,92,246,0.06);
        }
        .reward-card-placeholder {
          width: 100%; height: 200px;
          display: flex; align-items: center; justify-content: center;
          font-size: 56px; background: rgba(139,92,246,0.06);
        }
        .reward-card-body { padding: 18px; }
        .reward-card-artist-row {
          display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
        }
        .reward-card-artist-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--bg-hover); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: var(--accent);
          flex-shrink: 0;
        }
        .reward-card-artist-avatar img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .reward-card-artist-name {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
        }
        .reward-card-artist-name:hover { color: var(--accent); }
        .reward-card-type {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; color: var(--accent);
          background: rgba(139,92,246,0.1); padding: 3px 8px;
          border-radius: 6px; display: inline-block; margin-left: auto;
        }
        .reward-card-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
        .reward-card-desc {
          font-size: 13px; color: var(--text-muted); line-height: 1.5;
          margin-bottom: 12px;
          display: -webkit-box; -webkit-line-clamp: 3;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .reward-card-footer {
          display: flex; align-items: center; gap: 12px;
          font-size: 12px; color: var(--text-muted);
        }
        .reward-card-badge {
          padding: 3px 8px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
        }
        .reward-badge-eligible {
          background: rgba(34,197,94,0.15); color: #22c55e;
        }
        .reward-badge-locked {
          background: rgba(107,114,128,0.15); color: #9ca3af;
        }

        /* Detail modal */
        .reward-detail-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: rewardFadeIn 0.15s ease;
        }
        @keyframes rewardFadeIn { from{opacity:0} to{opacity:1} }
        .reward-detail-modal {
          background: var(--bg-primary, #16162a);
          border: 1px solid var(--border-color);
          border-radius: 16px; width: 92%; max-width: 560px;
          max-height: 90vh; overflow-y: auto; position: relative;
        }
        .reward-detail-close {
          position: absolute; top: 12px; right: 12px; z-index: 10;
          width: 32px; height: 32px; border: none; border-radius: 50%;
          background: rgba(0,0,0,0.5); color: white; font-size: 16px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .reward-detail-img { width: 100%; max-height: 300px; object-fit: cover; }
        .reward-detail-body { padding: 24px; }
        .reward-detail-type {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          color: var(--accent); letter-spacing: 0.5px; margin-bottom: 6px;
        }
        .reward-detail-title { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
        .reward-detail-artist {
          font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;
          cursor: pointer;
        }
        .reward-detail-artist:hover { color: var(--accent); }
        .reward-detail-desc {
          font-size: 14px; color: var(--text-muted); line-height: 1.6;
          margin-bottom: 16px; white-space: pre-wrap;
        }
        .reward-detail-requirements {
          padding: 14px 16px; background: var(--bg-hover, rgba(255,255,255,0.04));
          border-radius: 10px; margin-bottom: 16px;
          font-size: 13px; color: var(--text-secondary); line-height: 1.5;
        }
        .reward-detail-requirements-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          color: var(--text-muted); margin-bottom: 6px;
        }
        .reward-detail-meta {
          display: flex; gap: 16px; font-size: 12px; color: var(--text-muted);
          margin-bottom: 20px;
        }
        .reward-detail-actions { display: flex; gap: 12px; }

        .rewards-empty {
          text-align: center; padding: 60px 20px;
        }
        .rewards-empty-icon { font-size: 56px; margin-bottom: 16px; }
        .rewards-empty h3 { font-size: 20px; margin-bottom: 8px; }
        .rewards-empty p { color: var(--text-muted); font-size: 14px; }
      </style>

      <div class="rewards-page">
        <div class="rewards-page-header">
          <h1 class="rewards-page-title">🎁 Rewards</h1>
        </div>

        <div class="rewards-filter-row" id="rewards-filters">
          <button class="rewards-filter-btn active" data-filter="all">All</button>
          <button class="rewards-filter-btn" data-filter="eligible">Eligible for Me</button>
          <button class="rewards-filter-btn" data-filter="physical">Physical</button>
          <button class="rewards-filter-btn" data-filter="digital">Digital</button>
          <button class="rewards-filter-btn" data-filter="experience">Experience</button>
          <button class="rewards-filter-btn" data-filter="access">Access</button>
        </div>

        <div id="rewards-content">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    this.bindFilters();
    await this.loadRewards();
  },

  bindFilters() {
    document.getElementById('rewards-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.rewards-filter-btn');
      if (!btn) return;
      document.querySelectorAll('.rewards-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.filter = btn.dataset.filter;
      this.renderRewards();
    });
  },

  async loadRewards() {
    const container = document.getElementById('rewards-content');
    if (!container) return;

    try {
      const resp = await fetch('/api/rewards?page=global');
      const data = await resp.json();
      this.rewards = (data.rewards || []).filter(r => r.status === 'active');

      // Check eligibility for each reward if user is logged in
      if (AppState.user?.address) {
        await this.checkEligibility();
      }

      this.renderRewards();
    } catch (e) {
      console.error('Failed to load global rewards:', e);
      container.innerHTML = '<div class="rewards-empty"><div class="rewards-empty-icon">⚠️</div><h3>Failed to Load</h3><p>Could not load rewards. Try refreshing.</p></div>';
    }
  },

  async checkEligibility() {
    // Get all NFTs the user owns
    try {
      let ownedArtists = new Set();
      let ownedReleases = new Set();

      if (typeof OwnershipHelper !== 'undefined' && OwnershipHelper.nfts) {
        OwnershipHelper.nfts.forEach(nft => {
          if (nft.artistAddress) ownedArtists.add(nft.artistAddress.toLowerCase());
          if (nft.releaseId) ownedReleases.add(nft.releaseId);
        });
      } else {
        const resp = await fetch(`/api/user-nfts?address=${AppState.user.address}`);
        const data = await resp.json();
        (data.nfts || []).forEach(nft => {
          if (nft.artistAddress) ownedArtists.add(nft.artistAddress.toLowerCase());
          if (nft.releaseId) ownedReleases.add(nft.releaseId);
        });
      }

      this.rewards.forEach(r => {
        if (r.access_type === 'any_nft') {
          r._eligible = ownedArtists.has((r.artist_address || r.artistAddress || '').toLowerCase());
        } else if (r.access_type === 'specific_release') {
          const reqIds = r.required_release_ids || (r.required_release_id ? [r.required_release_id] : []);
          r._eligible = reqIds.some(id => ownedReleases.has(id));
        } else {
          r._eligible = ownedArtists.has((r.artist_address || r.artistAddress || '').toLowerCase());
        }
      });
    } catch (e) {
      console.error('Eligibility check failed:', e);
    }
  },

  renderRewards() {
    const container = document.getElementById('rewards-content');
    if (!container) return;

    let list = [...this.rewards];

    // Apply filter
    if (this.filter === 'eligible') {
      list = list.filter(r => r._eligible);
    } else if (['physical', 'digital', 'experience', 'access'].includes(this.filter)) {
      list = list.filter(r => r.reward_type === this.filter);
    }

    if (list.length === 0) {
      const msg = this.filter === 'eligible'
        ? "You're not eligible for any rewards yet. Collect some NFTs to unlock rewards!"
        : this.filter !== 'all'
          ? `No ${this.filter} rewards available right now.`
          : 'No rewards available yet. Check back soon!';
      container.innerHTML = `<div class="rewards-empty"><div class="rewards-empty-icon">🎁</div><h3>No Rewards Found</h3><p>${msg}</p></div>`;
      return;
    }

    container.innerHTML = `<div class="rewards-grid">${list.map(r => {
      const artistAddr = r.artist_address || r.artistAddress || '';
      const artistName = r.artist_name || r.artistName || Helpers.truncateAddress(artistAddr);
      const artistAvatar = r.artist_avatar || r.artistAvatar;
      const eligible = r._eligible;
      const isLoggedIn = !!AppState.user?.address;

      return `
        <div class="reward-discovery-card" data-reward-id="${r.id}">
          ${r.image_url
            ? `<img src="${r.image_url}" class="reward-card-img" onerror="this.src='/placeholder.png'" />`
            : `<div class="reward-card-placeholder">🎁</div>`
          }
          <div class="reward-card-body">
            <div class="reward-card-artist-row">
              <div class="reward-card-artist-avatar" data-address="${artistAddr}">
                ${artistAvatar
                  ? `<img src="${typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(artistAvatar) : artistAvatar}" onerror="this.parentElement.textContent='${artistName.charAt(0).toUpperCase()}'" />`
                  : artistName.charAt(0).toUpperCase()
                }
              </div>
              <span class="reward-card-artist-name" data-address="${artistAddr}">${artistName}</span>
              <span class="reward-card-type">${r.reward_type || 'reward'}</span>
            </div>
            <div class="reward-card-title">${r.title}</div>
            ${r.description ? `<div class="reward-card-desc">${r.description}</div>` : ''}
            <div class="reward-card-footer">
              <span>${r.claim_count || 0} claimed</span>
              ${r.expires_at ? `<span>Ends ${new Date(r.expires_at).toLocaleDateString()}</span>` : ''}
              ${isLoggedIn
                ? eligible
                  ? '<span class="reward-card-badge reward-badge-eligible">✓ Eligible</span>'
                  : '<span class="reward-card-badge reward-badge-locked">🔒 NFT Required</span>'
                : ''
              }
            </div>
          </div>
        </div>
      `;
    }).join('')}</div>`;

    // Bind card clicks → detail modal
    container.querySelectorAll('.reward-discovery-card').forEach(card => {
      card.addEventListener('click', () => {
        const reward = list.find(r => r.id === card.dataset.rewardId);
        if (reward) this.showRewardDetail(reward);
      });
    });

    // Bind artist name clicks → navigate to artist profile
    container.querySelectorAll('.reward-card-artist-name, .reward-card-artist-avatar').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const addr = el.dataset.address;
        if (addr) Router.navigate('artist', { address: addr });
      });
    });
  },

  showRewardDetail(r) {
    const artistAddr = r.artist_address || r.artistAddress || '';
    const artistName = r.artist_name || r.artistName || Helpers.truncateAddress(artistAddr);
    const eligible = r._eligible;
    const isLoggedIn = !!AppState.user?.address;
    const media = r.media_urls || [];

    document.querySelector('.reward-detail-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'reward-detail-overlay';
    overlay.innerHTML = `
      <div class="reward-detail-modal">
        <button class="reward-detail-close">✕</button>
        ${r.image_url ? `<img src="${r.image_url}" class="reward-detail-img" onerror="this.style.display='none'" />` : ''}
        <div class="reward-detail-body">
          <div class="reward-detail-type">${r.reward_type || 'Reward'}</div>
          <div class="reward-detail-title">${r.title}</div>
          <div class="reward-detail-artist" data-address="${artistAddr}">by ${artistName}</div>
          ${r.description ? `<div class="reward-detail-desc">${r.description}</div>` : ''}
          ${r.requirements_text ? `
            <div class="reward-detail-requirements">
              <div class="reward-detail-requirements-label">How to Claim</div>
              ${r.requirements_text}
            </div>
          ` : ''}
          ${media.length > 0 ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
              ${media.map(url => {
                const isVid = url.match(/\.(mp4|mov|webm)/i);
                return isVid
                  ? `<video src="${url}" controls style="max-width:200px;border-radius:10px;"></video>`
                  : `<img src="${url}" style="max-width:200px;border-radius:10px;cursor:pointer;" onclick="window.open('${url}','_blank')" />`;
              }).join('')}
            </div>
          ` : ''}
          <div class="reward-detail-meta">
            <span>${r.claim_count || 0} claimed</span>
            ${r.expires_at ? `<span>Ends ${new Date(r.expires_at).toLocaleDateString()}</span>` : '<span>No expiration</span>'}
            ${r.access_type === 'specific_release' ? '<span>Requires specific NFT</span>' : '<span>Any NFT by this artist</span>'}
          </div>
          <div class="reward-detail-actions">
            ${!isLoggedIn
              ? '<button class="btn btn-primary" onclick="Modals.showAuth()">Connect Wallet to Claim</button>'
              : eligible
                ? `<button class="btn btn-primary" id="reward-claim-btn">Claim Reward</button>`
                : `<button class="btn btn-secondary" data-address="${artistAddr}" id="reward-browse-btn">Browse Artist's Music</button>`
            }
            <button class="btn btn-secondary" data-address="${artistAddr}" id="reward-view-artist">View Artist</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.reward-detail-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('.reward-detail-artist')?.addEventListener('click', () => {
      overlay.remove();
      Router.navigate('artist', { address: artistAddr });
    });

    overlay.querySelector('#reward-view-artist')?.addEventListener('click', () => {
      overlay.remove();
      Router.navigate('artist', { address: artistAddr });
    });

    overlay.querySelector('#reward-browse-btn')?.addEventListener('click', () => {
      overlay.remove();
      Router.navigate('artist', { address: artistAddr });
    });

    overlay.querySelector('#reward-claim-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Claiming...';
      try {
        const resp = await fetch('/api/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'claim', reward_id: r.id, claimer_address: AppState.user.address })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        btn.textContent = '✓ Claimed!';
        btn.style.background = '#22c55e';
        // Update count locally
        r.claim_count = (r.claim_count || 0) + 1;
      } catch (e) {
        alert('Failed to claim: ' + e.message);
        btn.disabled = false; btn.textContent = 'Claim Reward';
      }
    });
  },
};
