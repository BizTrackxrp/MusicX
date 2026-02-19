/**
 * XRP Music — Unlockable Content Tab
 * 
 * Plugs into artist profile as a new tab.
 * 
 * VIEWS:
 *   1. Artist Setup (only artist sees) — configure private page + create rewards
 *   2. Private Page (NFT holders) — gated content feed with posts/comments
 *   3. Rewards (NFT holders) — claimable rewards list
 *   4. Locked Landing (non-holders) — teaser + what you need to unlock
 * 
 * TAB VISIBILITY:
 *   - Artist always sees the tab (with ! badge if not set up)
 *   - Others see the tab ONLY if the artist has set it up
 *   - Tab label: "Unlockable" with 🔓 or 🔑 icon
 * 
 * INTEGRATION:
 *   In profile.js, add this tab to the tab bar and call:
 *     UnlockableTab.render(artistAddress, viewerAddress, containerEl)
 */

const UnlockableTab = {
  config: null,
  rewards: [],
  posts: [],
  hasAccess: false,
  isOwner: false,
  artistAddress: null,
  viewerAddress: null,
  container: null,
  rewardCount: 0,
  postCount: 0,

  // ─── Main Entry ──────────────────────────────────────

  async render(artistAddress, viewerAddress, containerEl) {
    this.artistAddress = artistAddress;
    this.viewerAddress = viewerAddress;
    this.container = containerEl;
    this.isOwner = viewerAddress && viewerAddress.toLowerCase() === artistAddress.toLowerCase();

    containerEl.innerHTML = '<div class="unlockable-loading"><div class="spinner"></div> Loading...</div>';

    try {
      // Fetch config
      const configResp = await fetch(`/api/unlockables?artist=${artistAddress}`);
      const configData = await configResp.json();
      this.config = configData.config;
      this.rewardCount = configData.rewardCount || 0;
      this.postCount = configData.postCount || 0;

      // Fetch rewards for this artist
      const rewardsResp = await fetch(`/api/rewards?artist=${artistAddress}`);
      const rewardsData = await rewardsResp.json();
      this.rewards = rewardsData.rewards || [];

      // Check access
      if (viewerAddress && !this.isOwner) {
        const accessResp = await fetch(`/api/unlockables?artist=${artistAddress}&check=${viewerAddress}`);
        const accessData = await accessResp.json();
        this.hasAccess = accessData.hasAccess;
      } else if (this.isOwner) {
        this.hasAccess = true;
      }

      this.renderContent();
    } catch (error) {
      console.error('Unlockable tab error:', error);
      containerEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Failed to load unlockable content</div>';
    }
  },

  renderContent() {
    if (this.isOwner) {
      this.renderOwnerView();
    } else if (this.hasAccess) {
      this.renderHolderView();
    } else {
      this.renderLockedView();
    }
  },

  // ─── OWNER VIEW (Artist's management dashboard) ──────

  renderOwnerView() {
    const hasPrivatePage = this.config?.private_page_enabled;
    const activeRewards = this.rewards.filter(r => r.status === 'active');

    const html = `
      <div class="unlockable-owner animate-fade-in">
        
        <!-- Setup Banner (if not configured yet) -->
        ${!this.config?.tab_setup_complete ? `
          <div class="unlock-setup-banner">
            <div class="setup-icon">🔑</div>
            <div>
              <h3>Set Up Unlockable Content</h3>
              <p>Give your NFT holders exclusive access to rewards, private posts, and more.</p>
            </div>
            <button class="btn btn-primary" id="unlock-setup-btn">Get Started</button>
          </div>
        ` : ''}

        <!-- Quick Actions -->
        <div class="unlock-actions">
          <button class="unlock-action-card" id="unlock-create-reward">
            <div class="action-icon">🎁</div>
            <div class="action-label">Create Reward</div>
            <div class="action-desc">Offer merch, experiences, or access</div>
          </button>
          <button class="unlock-action-card" id="unlock-create-post">
            <div class="action-icon">📝</div>
            <div class="action-label">New Post</div>
            <div class="action-desc">Share exclusive content with holders</div>
          </button>
          <button class="unlock-action-card" id="unlock-edit-settings">
            <div class="action-icon">⚙️</div>
            <div class="action-label">Settings</div>
            <div class="action-desc">Access rules & landing page</div>
          </button>
        </div>

        <!-- Stats -->
        <div class="unlock-stats">
          <div class="stat-pill"><span class="stat-num">${activeRewards.length}</span> Active Rewards</div>
          <div class="stat-pill"><span class="stat-num">${this.postCount}</span> Posts</div>
          <div class="stat-pill"><span class="stat-num">${this.rewards.reduce((s, r) => s + (r.claim_count || 0), 0)}</span> Total Claims</div>
        </div>

        <!-- My Rewards -->
        ${activeRewards.length > 0 ? `
          <div class="unlock-section">
            <h3 class="unlock-section-title">Your Rewards</h3>
            <div class="rewards-list">
              ${activeRewards.map(r => this.renderRewardCard(r, true)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Paused/Completed Rewards -->
        ${this.rewards.filter(r => r.status !== 'active').length > 0 ? `
          <div class="unlock-section">
            <h3 class="unlock-section-title" style="color:var(--text-muted);">Inactive Rewards</h3>
            <div class="rewards-list">
              ${this.rewards.filter(r => r.status !== 'active').map(r => this.renderRewardCard(r, true)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Private Page Posts Preview -->
        ${hasPrivatePage && this.postCount > 0 ? `
          <div class="unlock-section">
            <h3 class="unlock-section-title">Recent Posts</h3>
            <div id="unlock-posts-container">
              <button class="btn btn-secondary" id="unlock-load-posts">Load Posts</button>
            </div>
          </div>
        ` : ''}

        <!-- Claims Activity -->
        <div class="unlock-section">
          <h3 class="unlock-section-title">Recent Claims</h3>
          <div id="unlock-claims-container">
            <button class="btn btn-secondary" id="unlock-load-claims">View Claims</button>
          </div>
        </div>
      </div>
      ${this.getStyles()}
    `;

    this.container.innerHTML = html;
    this.bindOwnerEvents();
  },

  // ─── HOLDER VIEW (NFT owner sees everything) ──────

  async renderHolderView() {
    const activeRewards = this.rewards.filter(r => r.status === 'active');
    const hasPrivatePage = this.config?.private_page_enabled;
    const artistName = this.rewards[0]?.artist_name || 'this artist';

    // Load posts if private page is enabled
    let posts = [];
    if (hasPrivatePage && this.viewerAddress) {
      try {
        const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true&viewer=${this.viewerAddress}`);
        const data = await resp.json();
        posts = data.posts || [];
      } catch (e) {
        console.error('Failed to load posts:', e);
      }
    }
    this.posts = posts;

    const html = `
      <div class="unlockable-holder animate-fade-in">
        <div class="unlock-access-banner">
          <div class="access-icon">🔑</div>
          <span>You have access to ${artistName}'s exclusive content</span>
        </div>

        <!-- Sub-tabs: Posts | Rewards -->
        <div class="unlock-subtabs">
          ${hasPrivatePage ? `<button class="unlock-subtab active" data-subtab="posts">Posts ${posts.length > 0 ? `<span class="subtab-count">${posts.length}</span>` : ''}</button>` : ''}
          <button class="unlock-subtab ${!hasPrivatePage ? 'active' : ''}" data-subtab="rewards">Rewards ${activeRewards.length > 0 ? `<span class="subtab-count">${activeRewards.length}</span>` : ''}</button>
        </div>

        <div id="unlock-subtab-content">
          ${hasPrivatePage ? this.renderPostsFeed(posts) : this.renderRewardsList(activeRewards)}
        </div>
      </div>
      ${this.getStyles()}
    `;

    this.container.innerHTML = html;
    this.bindHolderEvents();
  },

  // ─── LOCKED VIEW (non-holders see teaser) ──────

  renderLockedView() {
    const activeRewards = this.rewards.filter(r => r.status === 'active');
    const artistName = this.rewards[0]?.artist_name || this.config?.private_page_title || 'This Artist';
    const description = this.config?.private_page_description || 'Own an NFT to unlock exclusive content, rewards, and a private community.';
    const hasPrivatePage = this.config?.private_page_enabled;

    const html = `
      <div class="unlockable-locked animate-fade-in">
        <div class="locked-hero">
          <div class="locked-icon">🔒</div>
          <h2 class="locked-title">Exclusive Content</h2>
          <p class="locked-desc">${description}</p>
          
          <div class="locked-what-you-get">
            ${hasPrivatePage ? `
              <div class="locked-perk">
                <span class="perk-icon">📝</span>
                <span>Private posts & community</span>
              </div>
            ` : ''}
            ${activeRewards.length > 0 ? `
              <div class="locked-perk">
                <span class="perk-icon">🎁</span>
                <span>${activeRewards.length} reward${activeRewards.length !== 1 ? 's' : ''} available</span>
              </div>
            ` : ''}
            <div class="locked-perk">
              <span class="perk-icon">🔑</span>
              <span>Own ${this.config?.private_page_access_type === 'specific_release' ? 'a specific release' : 'any NFT'} to unlock</span>
            </div>
          </div>

          ${!this.viewerAddress ? `
            <button class="btn btn-primary btn-lg" onclick="if(typeof XamanAuth!=='undefined')XamanAuth.connect()">
              Sign In to Check Access
            </button>
          ` : `
            <p class="locked-cta">Browse their releases and grab an NFT to unlock everything!</p>
          `}
        </div>

        <!-- Show rewards preview (visible but not claimable) -->
        ${activeRewards.length > 0 ? `
          <div class="unlock-section" style="margin-top: 32px;">
            <h3 class="unlock-section-title">Available Rewards</h3>
            <p class="unlock-section-desc">Own the right NFT to claim these</p>
            <div class="rewards-list">
              ${activeRewards.map(r => this.renderRewardCard(r, false)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      ${this.getStyles()}
    `;

    this.container.innerHTML = html;
  },

  // ─── Sub-renderers ──────────────────────────────────

  renderPostsFeed(posts) {
    if (posts.length === 0) {
      return '<div class="unlock-empty">No posts yet. Check back soon!</div>';
    }

    return `
      <div class="posts-feed">
        ${posts.map(p => `
          <div class="private-post" data-post-id="${p.id}">
            <div class="post-header">
              <span class="post-date">${this.timeAgo(p.created_at)}</span>
            </div>
            ${p.content ? `<div class="post-content">${this.escapeHtml(p.content)}</div>` : ''}
            ${p.image_url ? `<img class="post-image" src="${this.proxyUrl(p.image_url)}" alt="Post image" onerror="this.style.display='none'">` : ''}
            ${p.video_url ? `<video class="post-video" src="${this.proxyUrl(p.video_url)}" controls playsinline preload="metadata"></video>` : ''}
            
            <!-- Comments -->
            <div class="post-comments">
              ${(p.comments || []).map(c => `
                <div class="post-comment">
                  <span class="comment-author">${c.commenter_name || this.truncAddr(c.commenter_address)}</span>
                  <span class="comment-text">${this.escapeHtml(c.content)}</span>
                  <span class="comment-time">${this.timeAgo(c.created_at)}</span>
                </div>
              `).join('')}
              <div class="comment-input-wrap">
                <input type="text" class="comment-input" placeholder="Add a comment..." data-post-id="${p.id}">
                <button class="comment-send-btn" data-post-id="${p.id}">Send</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderRewardsList(rewards) {
    if (rewards.length === 0) {
      return '<div class="unlock-empty">No rewards available right now.</div>';
    }

    return `
      <div class="rewards-list">
        ${rewards.map(r => this.renderRewardCard(r, false)).join('')}
      </div>
    `;
  },

  renderRewardCard(reward, isManage) {
    const remaining = reward.max_claims ? (reward.max_claims - (reward.claim_count || 0)) : null;
    const expired = reward.expires_at && new Date(reward.expires_at) < new Date();
    const typeBadge = { physical: '📦', digital: '💾', experience: '🎟️', access: '🔑' }[reward.reward_type] || '🎁';

    return `
      <div class="reward-card ${reward.status !== 'active' ? 'inactive' : ''} ${expired ? 'expired' : ''}" data-reward-id="${reward.id}">
        ${reward.image_url ? `
          <div class="reward-image">
            <img src="${this.proxyUrl(reward.image_url)}" alt="${reward.title}" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
        <div class="reward-info">
          <div class="reward-header">
            <span class="reward-type-badge">${typeBadge}</span>
            <h4 class="reward-title">${reward.title}</h4>
            ${reward.status !== 'active' ? `<span class="reward-status-badge ${reward.status}">${reward.status}</span>` : ''}
          </div>
          ${reward.description ? `<p class="reward-desc">${reward.description}</p>` : ''}
          <div class="reward-meta">
            ${remaining !== null ? `<span class="reward-remaining">${remaining} remaining</span>` : ''}
            ${reward.expires_at ? `<span class="reward-expires">${expired ? 'Expired' : 'Ends ' + this.formatDate(reward.expires_at)}</span>` : ''}
            <span class="reward-claimed">${reward.claim_count || 0} claimed</span>
          </div>

          ${isManage ? `
            <div class="reward-manage-actions">
              <button class="btn btn-sm btn-secondary reward-edit-btn" data-reward-id="${reward.id}">Edit</button>
              ${reward.status === 'active' ? `
                <button class="btn btn-sm btn-secondary reward-pause-btn" data-reward-id="${reward.id}">Pause</button>
              ` : reward.status === 'paused' ? `
                <button class="btn btn-sm btn-secondary reward-activate-btn" data-reward-id="${reward.id}">Reactivate</button>
              ` : ''}
              <button class="btn btn-sm btn-secondary reward-complete-btn" data-reward-id="${reward.id}">Mark Complete</button>
              <button class="btn btn-sm reward-delete-btn" data-reward-id="${reward.id}" style="color:var(--error);">Delete</button>
            </div>
          ` : `
            <button class="btn btn-primary btn-sm reward-claim-btn" data-reward-id="${reward.id}" 
              ${!this.hasAccess || expired || (remaining !== null && remaining <= 0) ? 'disabled' : ''}>
              ${!this.hasAccess ? '🔒 Own NFT to Claim' : expired ? 'Expired' : (remaining !== null && remaining <= 0) ? 'Fully Claimed' : '✋ Claim Now'}
            </button>
          `}
        </div>
      </div>
    `;
  },

  // ─── Modals ─────────────────────────────────────────

  showSetupModal() {
    const config = this.config || {};
    const releases = typeof getArtistReleases === 'function' ? getArtistReleases(this.artistAddress) : [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'unlock-setup-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>🔑 Unlockable Content Setup</h3>
          <button class="modal-close" onclick="document.getElementById('unlock-setup-modal')?.remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          
          <div class="form-group">
            <label class="form-label">What do visitors see when they don't have access?</label>
            <textarea class="form-input" id="setup-description" rows="3" 
              placeholder="e.g., Own one of my NFTs to unlock exclusive content, behind-the-scenes posts, and special rewards!"
            >${config.private_page_description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Enable Private Page?</label>
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px;">A gated feed where you can post text, images, and videos only NFT holders can see.</p>
            <label class="toggle-label">
              <input type="checkbox" id="setup-private-page" ${config.private_page_enabled ? 'checked' : ''}>
              <span>Enable private posts feed</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">Private Page Title</label>
            <input type="text" class="form-input" id="setup-title" 
              placeholder="e.g., Inner Circle, VIP Lounge, Backstage"
              value="${config.private_page_title || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Who gets access?</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="setup-access" value="any_nft" ${config.private_page_access_type !== 'specific_release' ? 'checked' : ''}>
                Anyone who owns any of my NFTs
              </label>
              <label class="radio-label">
                <input type="radio" name="setup-access" value="specific_release" ${config.private_page_access_type === 'specific_release' ? 'checked' : ''}>
                Only holders of a specific release
              </label>
            </div>
          </div>

          <div class="form-group" id="setup-release-select" style="display:${config.private_page_access_type === 'specific_release' ? 'block' : 'none'};">
            <label class="form-label">Which release?</label>
            <select class="form-input" id="setup-release-id">
              <option value="">Select a release...</option>
            </select>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Release ID: <input type="text" class="form-input" id="setup-release-id-manual" placeholder="Paste release ID" value="${config.private_page_release_id || ''}" style="display:inline;width:auto;font-size:11px;padding:2px 8px;"></p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('unlock-setup-modal')?.remove()">Cancel</button>
          <button class="btn btn-primary" id="setup-save-btn">Save Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Toggle release select
    document.querySelectorAll('input[name="setup-access"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById('setup-release-select').style.display =
          document.querySelector('input[name="setup-access"]:checked').value === 'specific_release' ? 'block' : 'none';
      });
    });

    // Save
    document.getElementById('setup-save-btn').addEventListener('click', async () => {
      const btn = document.getElementById('setup-save-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const resp = await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setup',
            artistAddress: this.artistAddress,
            privatePageEnabled: document.getElementById('setup-private-page').checked,
            privatePageTitle: document.getElementById('setup-title').value.trim() || null,
            privatePageDescription: document.getElementById('setup-description').value.trim() || null,
            privatePageAccessType: document.querySelector('input[name="setup-access"]:checked').value,
            privatePageReleaseId: document.getElementById('setup-release-id-manual').value.trim() || null,
          }),
        });
        const data = await resp.json();
        if (data.success) {
          modal.remove();
          this.render(this.artistAddress, this.viewerAddress, this.container);
        } else {
          alert(data.error || 'Failed to save');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
      btn.disabled = false;
      btn.textContent = 'Save Settings';
    });
  },

  showCreateRewardModal(existingReward = null) {
    const isEdit = !!existingReward;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'reward-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>${isEdit ? '✏️ Edit' : '🎁 Create'} Reward</h3>
          <button class="modal-close" onclick="document.getElementById('reward-modal')?.remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="reward-title" 
              placeholder="e.g., Signed plushie, Exclusive merch, VIP meetup"
              value="${existingReward?.title || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-input" id="reward-desc" rows="3" 
              placeholder="What do fans get? How does it work? Any details they need to know."
            >${existingReward?.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Image URL (optional)</label>
            <input type="text" class="form-input" id="reward-image" 
              placeholder="https://... or IPFS CID"
              value="${existingReward?.image_url || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-input" id="reward-type">
              <option value="physical" ${existingReward?.reward_type === 'physical' ? 'selected' : ''}>📦 Physical (merch, vinyl, etc)</option>
              <option value="digital" ${existingReward?.reward_type === 'digital' ? 'selected' : ''}>💾 Digital (bonus track, wallpaper)</option>
              <option value="experience" ${existingReward?.reward_type === 'experience' ? 'selected' : ''}>🎟️ Experience (meetup, video call)</option>
              <option value="access" ${existingReward?.reward_type === 'access' ? 'selected' : ''}>🔑 Access (private channel, early release)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Who can claim?</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="reward-access" value="any_nft" ${existingReward?.access_type !== 'specific_release' ? 'checked' : ''}>
                Anyone who owns any of my NFTs
              </label>
              <label class="radio-label">
                <input type="radio" name="reward-access" value="specific_release" ${existingReward?.access_type === 'specific_release' ? 'checked' : ''}>
                Only holders of a specific release
              </label>
            </div>
          </div>

          <div class="form-group" id="reward-release-select" style="display:${existingReward?.access_type === 'specific_release' ? 'block' : 'none'};">
            <label class="form-label">Release ID</label>
            <input type="text" class="form-input" id="reward-release-id" 
              placeholder="Paste release ID"
              value="${existingReward?.required_release_id || ''}">
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Max Claims (optional)</label>
              <input type="number" class="form-input" id="reward-max" min="1"
                placeholder="Unlimited" value="${existingReward?.max_claims || ''}">
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Expires (optional)</label>
              <input type="date" class="form-input" id="reward-expires"
                value="${existingReward?.expires_at ? existingReward.expires_at.split('T')[0] : ''}">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('reward-modal')?.remove()">Cancel</button>
          <button class="btn btn-primary" id="reward-save-btn">${isEdit ? 'Update' : 'Create'} Reward</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Toggle release select
    document.querySelectorAll('input[name="reward-access"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById('reward-release-select').style.display =
          document.querySelector('input[name="reward-access"]:checked').value === 'specific_release' ? 'block' : 'none';
      });
    });

    // Save
    document.getElementById('reward-save-btn').addEventListener('click', async () => {
      const btn = document.getElementById('reward-save-btn');
      const title = document.getElementById('reward-title').value.trim();
      if (!title) return alert('Title is required');

      btn.disabled = true;
      btn.textContent = 'Saving...';

      const payload = {
        action: isEdit ? 'update' : 'create',
        artistAddress: this.artistAddress,
        title,
        description: document.getElementById('reward-desc').value.trim() || null,
        imageUrl: document.getElementById('reward-image').value.trim() || null,
        rewardType: document.getElementById('reward-type').value,
        accessType: document.querySelector('input[name="reward-access"]:checked').value,
        requiredReleaseId: document.getElementById('reward-release-id').value.trim() || null,
        maxClaims: document.getElementById('reward-max').value ? parseInt(document.getElementById('reward-max').value) : null,
        expiresAt: document.getElementById('reward-expires').value || null,
      };

      if (isEdit) payload.id = existingReward.id;

      try {
        const resp = await fetch('/api/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (data.success || data.id) {
          modal.remove();
          this.render(this.artistAddress, this.viewerAddress, this.container);
        } else {
          alert(data.error || 'Failed');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
      btn.disabled = false;
      btn.textContent = isEdit ? 'Update' : 'Create';
    });
  },

  showCreatePostModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'post-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>📝 New Private Post</h3>
          <button class="modal-close" onclick="document.getElementById('post-modal')?.remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div class="form-group">
            <label class="form-label">What's on your mind?</label>
            <textarea class="form-input" id="post-content" rows="4" 
              placeholder="Share something exclusive with your NFT holders..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Image URL (optional)</label>
            <input type="text" class="form-input" id="post-image" placeholder="https://... or IPFS CID">
          </div>
          <div class="form-group">
            <label class="form-label">Video URL (optional)</label>
            <input type="text" class="form-input" id="post-video" placeholder="https://... or IPFS CID">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('post-modal')?.remove()">Cancel</button>
          <button class="btn btn-primary" id="post-save-btn">Post</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('post-save-btn').addEventListener('click', async () => {
      const btn = document.getElementById('post-save-btn');
      const content = document.getElementById('post-content').value.trim();
      const imageUrl = document.getElementById('post-image').value.trim();
      const videoUrl = document.getElementById('post-video').value.trim();

      if (!content && !imageUrl && !videoUrl) return alert('Add some content');

      btn.disabled = true;
      btn.textContent = 'Posting...';

      try {
        const resp = await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_post',
            artistAddress: this.artistAddress,
            content: content || null,
            imageUrl: imageUrl || null,
            videoUrl: videoUrl || null,
          }),
        });
        const data = await resp.json();
        if (data.success) {
          modal.remove();
          this.render(this.artistAddress, this.viewerAddress, this.container);
        } else {
          alert(data.error || 'Failed');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
      btn.disabled = false;
      btn.textContent = 'Post';
    });
  },

  // ─── Events ─────────────────────────────────────────

  bindOwnerEvents() {
    document.getElementById('unlock-setup-btn')?.addEventListener('click', () => this.showSetupModal());
    document.getElementById('unlock-edit-settings')?.addEventListener('click', () => this.showSetupModal());
    document.getElementById('unlock-create-reward')?.addEventListener('click', () => this.showCreateRewardModal());
    document.getElementById('unlock-create-post')?.addEventListener('click', () => this.showCreatePostModal());

    // Load claims
    document.getElementById('unlock-load-claims')?.addEventListener('click', async () => {
      const container = document.getElementById('unlock-claims-container');
      container.innerHTML = '<div class="spinner"></div>';
      try {
        const resp = await fetch(`/api/rewards?claims=true&artist=${this.artistAddress}`);
        const data = await resp.json();
        const claims = data.claims || [];
        if (claims.length === 0) {
          container.innerHTML = '<div class="unlock-empty">No claims yet</div>';
        } else {
          container.innerHTML = claims.map(c => `
            <div class="claim-row">
              <span class="claim-who">${c.claimer_name || this.truncAddr(c.claimer_address)}</span>
              <span class="claim-what">claimed <strong>${c.reward_title}</strong></span>
              <span class="claim-when">${this.timeAgo(c.claimed_at)}</span>
            </div>
          `).join('');
        }
      } catch (e) {
        container.innerHTML = '<div class="unlock-empty">Failed to load claims</div>';
      }
    });

    // Load posts
    document.getElementById('unlock-load-posts')?.addEventListener('click', async () => {
      const container = document.getElementById('unlock-posts-container');
      container.innerHTML = '<div class="spinner"></div>';
      try {
        const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true&viewer=${this.viewerAddress}`);
        const data = await resp.json();
        container.innerHTML = this.renderPostsFeed(data.posts || []);
        this.bindCommentEvents();
      } catch (e) {
        container.innerHTML = '<div class="unlock-empty">Failed to load posts</div>';
      }
    });

    // Reward management buttons
    this.container.querySelectorAll('.reward-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reward = this.rewards.find(r => r.id === btn.dataset.rewardId);
        if (reward) this.showCreateRewardModal(reward);
      });
    });

    this.container.querySelectorAll('.reward-pause-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateRewardStatus(btn.dataset.rewardId, 'paused');
      });
    });

    this.container.querySelectorAll('.reward-activate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateRewardStatus(btn.dataset.rewardId, 'active');
      });
    });

    this.container.querySelectorAll('.reward-complete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Mark this reward as completed? Fans will no longer be able to claim it.')) {
          this.updateRewardStatus(btn.dataset.rewardId, 'completed');
        }
      });
    });

    this.container.querySelectorAll('.reward-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this reward? This cannot be undone.')) return;
        try {
          await fetch(`/api/rewards?id=${btn.dataset.rewardId}&artist=${this.artistAddress}`, { method: 'DELETE' });
          this.render(this.artistAddress, this.viewerAddress, this.container);
        } catch (e) {
          alert('Failed to delete');
        }
      });
    });
  },

  bindHolderEvents() {
    // Sub-tab switching
    this.container.querySelectorAll('.unlock-subtab').forEach(tab => {
      tab.addEventListener('click', async () => {
        this.container.querySelectorAll('.unlock-subtab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const subtab = tab.dataset.subtab;
        const content = document.getElementById('unlock-subtab-content');

        if (subtab === 'posts') {
          if (this.posts.length === 0) {
            content.innerHTML = '<div class="spinner"></div>';
            try {
              const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true&viewer=${this.viewerAddress}`);
              const data = await resp.json();
              this.posts = data.posts || [];
            } catch (e) { /* */ }
          }
          content.innerHTML = this.renderPostsFeed(this.posts);
          this.bindCommentEvents();
        } else {
          const activeRewards = this.rewards.filter(r => r.status === 'active');
          content.innerHTML = this.renderRewardsList(activeRewards);
          this.bindClaimEvents();
        }
      });
    });

    this.bindCommentEvents();
    this.bindClaimEvents();
  },

  bindCommentEvents() {
    this.container.querySelectorAll('.comment-send-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.postId;
        const input = this.container.querySelector(`.comment-input[data-post-id="${postId}"]`);
        const content = input?.value?.trim();
        if (!content || !this.viewerAddress) return;

        btn.disabled = true;
        try {
          await fetch('/api/unlockables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'comment',
              postId,
              commenterAddress: this.viewerAddress,
              content,
            }),
          });
          input.value = '';
          // Refresh posts
          const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true&viewer=${this.viewerAddress}`);
          const data = await resp.json();
          this.posts = data.posts || [];
          document.getElementById('unlock-subtab-content').innerHTML = this.renderPostsFeed(this.posts);
          this.bindCommentEvents();
        } catch (e) {
          alert('Failed to comment');
        }
        btn.disabled = false;
      });
    });
  },

  bindClaimEvents() {
    this.container.querySelectorAll('.reward-claim-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!this.viewerAddress) return;
        btn.disabled = true;
        btn.textContent = 'Claiming...';

        try {
          const resp = await fetch('/api/rewards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'claim',
              rewardId: btn.dataset.rewardId,
              claimerAddress: this.viewerAddress,
            }),
          });
          const data = await resp.json();
          if (data.success) {
            btn.textContent = '✅ Claimed!';
            btn.classList.add('claimed');
          } else {
            btn.textContent = data.error || 'Failed';
            setTimeout(() => { btn.textContent = '✋ Claim Now'; btn.disabled = false; }, 2000);
          }
        } catch (e) {
          btn.textContent = 'Error';
          setTimeout(() => { btn.textContent = '✋ Claim Now'; btn.disabled = false; }, 2000);
        }
      });
    });
  },

  // ─── Helpers ────────────────────────────────────────

  async updateRewardStatus(rewardId, status) {
    try {
      await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          id: rewardId,
          artistAddress: this.artistAddress,
          status,
        }),
      });
      this.render(this.artistAddress, this.viewerAddress, this.container);
    } catch (e) {
      alert('Failed to update status');
    }
  },

  proxyUrl(url) {
    if (!url) return '/placeholder.png';
    return typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(url) : url;
  },

  truncAddr(addr) {
    if (!addr) return 'Unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  },

  timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Static: check if the Unlockable tab should be visible for an artist
   * Call from profile.js tab rendering
   */
  async shouldShowTab(artistAddress, viewerAddress) {
    try {
      const resp = await fetch(`/api/unlockables?artist=${artistAddress}`);
      const data = await resp.json();
      const isOwner = viewerAddress && viewerAddress.toLowerCase() === artistAddress.toLowerCase();
      // Always show for owner, show for others only if setup complete
      return isOwner || data.config?.tab_setup_complete;
    } catch (e) {
      return false;
    }
  },

  /**
   * Static: check if the tab should show a ! badge (unviewed new tab for artist)
   */
  shouldShowBadge(config) {
    return config && !config.tab_setup_complete;
  },

  // ─── Styles ─────────────────────────────────────────

  getStyles() {
    return `
      <style>
        .unlockable-loading { padding: 60px; text-align: center; color: var(--text-muted); }

        /* Setup Banner */
        .unlock-setup-banner {
          display: flex; align-items: center; gap: 16px; padding: 20px 24px;
          background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1));
          border: 1px solid rgba(139,92,246,0.3); border-radius: var(--radius-lg); margin-bottom: 24px;
        }
        .setup-icon { font-size: 36px; }
        .unlock-setup-banner h3 { margin: 0; font-size: 16px; color: var(--text-primary); }
        .unlock-setup-banner p { margin: 4px 0 0; font-size: 13px; color: var(--text-muted); }

        /* Quick Actions */
        .unlock-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .unlock-action-card {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 20px 12px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-lg); cursor: pointer; transition: all 150ms; text-align: center;
        }
        .unlock-action-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .action-icon { font-size: 28px; }
        .action-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .action-desc { font-size: 11px; color: var(--text-muted); }

        /* Stats */
        .unlock-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .stat-pill {
          padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 100px; font-size: 13px; color: var(--text-secondary);
        }
        .stat-num { font-weight: 700; color: var(--accent); margin-right: 4px; }

        /* Section */
        .unlock-section { margin-bottom: 28px; }
        .unlock-section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 12px; }
        .unlock-section-desc { font-size: 13px; color: var(--text-muted); margin: -8px 0 12px; }
        .unlock-empty { padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); }

        /* Reward Cards */
        .rewards-list { display: grid; gap: 12px; }
        .reward-card {
          display: flex; gap: 16px; padding: 16px; background: var(--bg-card);
          border: 1px solid var(--border-color); border-radius: var(--radius-lg); transition: all 150ms;
        }
        .reward-card:hover { border-color: rgba(139,92,246,0.4); }
        .reward-card.inactive { opacity: 0.6; }
        .reward-card.expired { opacity: 0.5; }
        .reward-image { width: 100px; min-width: 100px; border-radius: var(--radius-md); overflow: hidden; }
        .reward-image img { width: 100%; height: 100%; object-fit: cover; }
        .reward-info { flex: 1; min-width: 0; }
        .reward-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .reward-type-badge { font-size: 18px; }
        .reward-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
        .reward-status-badge {
          padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600; text-transform: uppercase;
        }
        .reward-status-badge.paused { background: rgba(234,179,8,0.2); color: #eab308; }
        .reward-status-badge.completed { background: rgba(34,197,94,0.2); color: #22c55e; }
        .reward-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 8px; line-height: 1.4; }
        .reward-meta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .reward-meta span { font-size: 11px; color: var(--text-muted); }
        .reward-remaining { color: var(--warning) !important; }
        .reward-expires { color: var(--error) !important; }
        .reward-manage-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .reward-claim-btn { margin-top: 4px; }
        .reward-claim-btn.claimed { background: var(--success); border-color: var(--success); }

        /* Access Banner */
        .unlock-access-banner {
          display: flex; align-items: center; gap: 10px; padding: 12px 20px;
          background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.1));
          border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radius-lg); margin-bottom: 20px;
          font-size: 14px; color: var(--text-primary);
        }
        .access-icon { font-size: 20px; }

        /* Sub-tabs */
        .unlock-subtabs { display: flex; gap: 4px; margin-bottom: 20px; }
        .unlock-subtab {
          padding: 10px 20px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-md); font-size: 13px; font-weight: 500;
          color: var(--text-secondary); cursor: pointer; transition: all 150ms;
        }
        .unlock-subtab:hover { border-color: var(--accent); }
        .unlock-subtab.active { border-color: var(--accent); background: rgba(59,130,246,0.1); color: var(--accent); }
        .subtab-count {
          display: inline-block; padding: 1px 7px; background: var(--bg-hover);
          border-radius: 100px; font-size: 11px; margin-left: 4px;
        }
        .unlock-subtab.active .subtab-count { background: var(--accent); color: white; }

        /* Locked View */
        .locked-hero { text-align: center; padding: 48px 24px; }
        .locked-icon { font-size: 56px; margin-bottom: 16px; }
        .locked-title { font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0 0 12px; }
        .locked-desc { font-size: 15px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 24px; line-height: 1.5; }
        .locked-what-you-get { display: flex; flex-direction: column; gap: 10px; max-width: 320px; margin: 0 auto 24px; }
        .locked-perk {
          display: flex; align-items: center; gap: 10px; padding: 10px 16px;
          background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);
          font-size: 13px; color: var(--text-secondary);
        }
        .perk-icon { font-size: 18px; }
        .locked-cta { font-size: 14px; color: var(--accent); font-weight: 500; }

        /* Posts Feed */
        .posts-feed { display: flex; flex-direction: column; gap: 16px; }
        .private-post {
          padding: 16px 20px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        .post-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .post-date { font-size: 12px; color: var(--text-muted); }
        .post-content { font-size: 14px; color: var(--text-primary); line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap; }
        .post-image { max-width: 100%; border-radius: var(--radius-md); margin-bottom: 12px; }
        .post-video { max-width: 100%; border-radius: var(--radius-md); margin-bottom: 12px; }

        /* Comments */
        .post-comments { border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 4px; }
        .post-comment { display: flex; gap: 6px; align-items: baseline; margin-bottom: 6px; flex-wrap: wrap; }
        .comment-author { font-size: 12px; font-weight: 600; color: var(--accent); }
        .comment-text { font-size: 13px; color: var(--text-secondary); }
        .comment-time { font-size: 10px; color: var(--text-muted); }
        .comment-input-wrap { display: flex; gap: 8px; margin-top: 8px; }
        .comment-input { flex: 1; padding: 8px 12px; background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: 13px; }
        .comment-send-btn {
          padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-md);
          color: white; font-size: 13px; font-weight: 500; cursor: pointer;
        }

        /* Claims */
        .claim-row {
          display: flex; align-items: center; gap: 8px; padding: 10px 0;
          border-bottom: 1px solid var(--border-color); font-size: 13px;
        }
        .claim-who { font-weight: 600; color: var(--accent); }
        .claim-what { color: var(--text-secondary); }
        .claim-when { margin-left: auto; color: var(--text-muted); font-size: 12px; }

        /* Form helpers */
        .form-row { display: flex; gap: 12px; }
        .radio-group { display: flex; flex-direction: column; gap: 8px; }
        .radio-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
        .toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }

        /* Responsive */
        @media (max-width: 640px) {
          .unlock-actions { grid-template-columns: 1fr; }
          .reward-card { flex-direction: column; }
          .reward-image { width: 100%; height: 160px; }
          .unlock-setup-banner { flex-direction: column; text-align: center; }
          .locked-perk { font-size: 12px; }
        }
      </style>
    `;
  },
};
