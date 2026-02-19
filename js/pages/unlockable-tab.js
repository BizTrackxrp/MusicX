/**
 * XRP Music — Unlockable Content Tab v3
 *
 * Full artist dashboard for NFT-gated content:
 *   - Settings via small gear icon, dismissible with ✕
 *   - Create Reward page (multi-media, NFT picker, drafts, duration)
 *   - Instagram-style post feed with multi-media carousel
 *   - "View as others see it" mode on content feed
 *
 * VIEWS:
 *   Owner:  Dashboard → Create Reward | Content Feed | Settings inline
 *   Holder: Content feed + rewards list
 *   Locked: Teaser landing page
 *
 * FIXES (v3):
 *   - Upload: config.apiKey → config.key, uses config.endpoint
 *   - Removed Max Claims (implied by NFT supply when "until supplies run out")
 *   - Content feed: settings gear ⚙️ toggle + ✕ to dismiss
 *   - Better upload error handling with toast fallback
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
  artistReleases: [],   // cached for NFT picker

  // ─── Main Entry ──────────────────────────────────────

  async render(artistAddress, viewerAddress, containerEl) {
    this.artistAddress = artistAddress;
    this.viewerAddress = viewerAddress;
    this.container = containerEl;
    this.isOwner = viewerAddress && viewerAddress.toLowerCase() === artistAddress.toLowerCase();

    containerEl.innerHTML = '<div class="ut-loading"><div class="spinner"></div> Loading...</div>';

    try {
      const configResp = await fetch(`/api/unlockables?artist=${artistAddress}`);
      const configData = await configResp.json();
      this.config = configData.config;
      this.rewardCount = configData.rewardCount || 0;
      this.postCount = configData.postCount || 0;

      // Check access for non-owners
      if (!this.isOwner && viewerAddress) {
        this.hasAccess = await this.checkAccess(artistAddress, viewerAddress);
      } else if (this.isOwner) {
        this.hasAccess = true;
      }

      // Fetch artist releases for NFT picker (owner only)
      if (this.isOwner) {
        try {
          const relData = await API.getReleasesByArtist(artistAddress);
          this.artistReleases = relData || [];
        } catch (e) { this.artistReleases = []; }
      }

      if (this.isOwner) {
        const cfg = this.config || {};
        if (!cfg.tab_setup_complete) {
          this.renderOwnerContentPage(); // first-time setup only
        } else {
          this.renderOwnerContentPage(); // default: show content feed
        }
      } else if (this.hasAccess) {
        this.renderHolderView();
      } else {
        this.renderLockedView();
      }
    } catch (error) {
      console.error('Unlockable tab error:', error);
      containerEl.innerHTML = '<div class="ut-error">Failed to load unlockable content</div>';
    }
  },

  async checkAccess(artistAddress, viewerAddress) {
    if (typeof OwnershipHelper !== 'undefined') {
      const nfts = OwnershipHelper.getNFTsByArtist(artistAddress);
      return nfts && nfts.length > 0;
    }
    try {
      const resp = await fetch(`/api/user-nfts?address=${viewerAddress}`);
      const data = await resp.json();
      return (data.nfts || []).some(n => n.artistAddress === artistAddress);
    } catch (e) { return false; }
  },

  async checkPostAccess(post) {
    if (this.isOwner) return true;
    if (!post.access_type || post.access_type === 'page_default') return this.hasAccess;
    if (post.access_type === 'specific_release' && post.required_release_id) {
      if (typeof OwnershipHelper !== 'undefined') {
        return OwnershipHelper.ownsRelease(post.required_release_id);
      }
    }
    return this.hasAccess;
  },

  // ─── OWNER DASHBOARD ──────────────────────────────────

  renderOwnerDashboard() {
    const cfg = this.config || {};
    const isSetUp = cfg.tab_setup_complete;

    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-dashboard">
        ${!isSetUp ? `
          <div class="ut-setup-banner" id="ut-setup-banner">
            <div class="ut-setup-icon">🔑</div>
            <div class="ut-setup-info">
              <div class="ut-setup-title">Set Up Unlockable Content</div>
              <div class="ut-setup-desc">Give your NFT holders exclusive access to rewards, private posts, and more.</div>
            </div>
            <button class="btn btn-primary" id="ut-get-started">Get Started</button>
          </div>
        ` : ''}

        <!-- Action Cards -->
        <div class="ut-action-grid">
          <div class="ut-action-card" id="ut-go-rewards">
            <div class="ut-action-icon">🎁</div>
            <div class="ut-action-title">Create Reward</div>
            <div class="ut-action-desc">Offer merch, experiences, or access</div>
          </div>
          <div class="ut-action-card" id="ut-go-posts">
            <div class="ut-action-icon">📝</div>
            <div class="ut-action-title">New Post</div>
            <div class="ut-action-desc">Share exclusive content with holders</div>
          </div>
          <div class="ut-action-card" id="ut-go-content">
            <div class="ut-action-icon">🔓</div>
            <div class="ut-action-title">Unlockable Content</div>
            <div class="ut-action-desc">View & manage your gated page</div>
          </div>
        </div>

        <!-- Stats -->
        <div class="ut-stats-row">
          <div class="ut-stat"><span class="ut-stat-num">${this.rewardCount}</span> Active Rewards</div>
          <div class="ut-stat"><span class="ut-stat-num">${this.postCount}</span> Posts</div>
          <div class="ut-stat"><span class="ut-stat-num" id="ut-claims-count">0</span> Total Claims</div>
        </div>

        <!-- Recent Claims -->
        <div class="ut-section">
          <h3 class="ut-section-title">Recent Claims</h3>
          <div id="ut-recent-claims" class="ut-claims-list">
            <div class="ut-loading-sm"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Access Settings (inline) -->
        <div class="ut-section">
          <h3 class="ut-section-title">Access Settings</h3>
          <div class="ut-settings-card" id="ut-access-settings">
            <div class="ut-setting-row">
              <div class="ut-setting-label">Who can access your unlockable content?</div>
              <select class="ut-select" id="ut-access-type">
                <option value="any_nft" ${(cfg.private_page_access_type || 'any_nft') === 'any_nft' ? 'selected' : ''}>Anyone who owns any of my NFTs</option>
                <option value="specific_release" ${cfg.private_page_access_type === 'specific_release' ? 'selected' : ''}>Only owners of a specific release</option>
              </select>
            </div>
            <div class="ut-setting-row" id="ut-release-picker-row" style="display:${cfg.private_page_access_type === 'specific_release' ? 'block' : 'none'};">
              <div class="ut-setting-label">Which release?</div>
              <select class="ut-select" id="ut-access-release">
                <option value="">Select a release...</option>
                ${this.artistReleases.map(r => `
                  <option value="${r.id}" ${cfg.private_page_release_id === r.id ? 'selected' : ''}>${r.title}</option>
                `).join('')}
              </select>
            </div>
            <div class="ut-setting-row">
              <div class="ut-setting-label">Welcome message (shown to holders)</div>
              <textarea class="ut-textarea" id="ut-welcome-msg" rows="2" placeholder="Welcome to my private page!">${cfg.welcome_message || ''}</textarea>
            </div>
            <div class="ut-setting-row">
              <div class="ut-setting-label">Page description (shown to non-holders as teaser)</div>
              <textarea class="ut-textarea" id="ut-page-desc" rows="2" placeholder="Exclusive content for my NFT holders...">${cfg.private_page_description || ''}</textarea>
            </div>
            <button class="btn btn-primary btn-sm" id="ut-save-settings" style="margin-top:12px;">Save Settings</button>
          </div>
        </div>
      </div>
    `;

    this.bindOwnerEvents();
    this.loadRecentClaims();
  },

  async loadRecentClaims() {
    try {
      const resp = await fetch(`/api/rewards?claims=true&artist=${this.artistAddress}`);
      const data = await resp.json();
      const claims = data.claims || [];
      const container = document.getElementById('ut-recent-claims');
      const countEl = document.getElementById('ut-claims-count');
      if (countEl) countEl.textContent = claims.length;
      if (!container) return;

      if (claims.length === 0) {
        container.innerHTML = '<div class="ut-empty-sm">No claims yet. Create a reward to get started!</div>';
        return;
      }

      container.innerHTML = claims.slice(0, 10).map(c => `
        <div class="ut-claim-row">
          <div class="ut-claim-info">
            <span class="ut-claim-name">${c.claimer_name || Helpers.truncateAddress(c.claimer_address)}</span>
            <span class="ut-claim-action">claimed</span>
            <span class="ut-claim-reward">${c.reward_title}</span>
          </div>
          <div class="ut-claim-time">${Helpers.timeAgo ? Helpers.timeAgo(c.claimed_at) : new Date(c.claimed_at).toLocaleDateString()}</div>
        </div>
      `).join('');
    } catch (e) {
      const container = document.getElementById('ut-recent-claims');
      if (container) container.innerHTML = '<div class="ut-empty-sm">Failed to load claims</div>';
    }
  },

  bindOwnerEvents() {
    // Get Started → auto-save setup
    document.getElementById('ut-get-started')?.addEventListener('click', async () => {
      await this.saveSettings(true);
      const banner = document.getElementById('ut-setup-banner');
      if (banner) banner.style.display = 'none';
    });

    // Action cards
    document.getElementById('ut-go-rewards')?.addEventListener('click', () => this.showCreateRewardPage());
    document.getElementById('ut-go-posts')?.addEventListener('click', () => this.showCreatePostModal());
    document.getElementById('ut-go-content')?.addEventListener('click', () => this.showContentFeedPage());

    // Access type toggle
    document.getElementById('ut-access-type')?.addEventListener('change', (e) => {
      const row = document.getElementById('ut-release-picker-row');
      if (row) row.style.display = e.target.value === 'specific_release' ? 'block' : 'none';
    });

    // Save settings
    document.getElementById('ut-save-settings')?.addEventListener('click', () => this.saveSettings(false));
  },

  async saveSettings(isFirstSetup) {
    const accessType = document.getElementById('ut-access-type')?.value || 'any_nft';
    const releaseId = document.getElementById('ut-access-release')?.value || null;
    const welcomeMsg = document.getElementById('ut-welcome-msg')?.value || '';
    const pageDesc = document.getElementById('ut-page-desc')?.value || '';

    try {
      const btn = document.getElementById(isFirstSetup ? 'ut-get-started' : 'ut-save-settings');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

      await fetch('/api/unlockables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup',
          artist: this.artistAddress,
          private_page_enabled: true,
          private_page_access_type: accessType,
          private_page_release_id: releaseId,
          private_page_description: pageDesc,
          welcome_message: welcomeMsg,
          tab_setup_complete: true,
        })
      });

      if (btn) { btn.disabled = false; btn.textContent = isFirstSetup ? 'Get Started' : 'Save Settings'; }

      if (isFirstSetup) {
        this.config = { ...this.config, tab_setup_complete: true };
      }

      if (!isFirstSetup && typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast('Settings saved!');
      }
    } catch (e) {
      console.error('Save settings error:', e);
      alert('Failed to save settings');
    }
  },

  // ─── CREATE REWARD PAGE ────────────────────────────────

  showCreateRewardPage(existingReward = null) {
    const isEdit = !!existingReward;
    const r = existingReward || {};
    const existingReleaseIds = r.required_release_ids || (r.required_release_id ? [r.required_release_id] : []);
    const existingMedia = r.media_urls || [];
    const isAllNfts = (r.access_type || 'any_nft') === 'any_nft';

    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-page">
        <div class="ut-page-header">
          <button class="ut-back-btn" id="ut-back-dash">← Back</button>
          <h2 class="ut-page-title">${isEdit ? 'Edit Reward' : 'Create Reward'}</h2>
        </div>

        <div class="ut-form">
          <!-- Logo / Cover Image -->
          <div class="ut-form-group">
            <label class="ut-label">Reward Logo / Cover Image</label>
            <div class="ut-upload-zone" id="ut-reward-logo-zone">
              ${r.image_url ? `<img src="${r.image_url}" class="ut-upload-preview" />` : `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>Click or drag to upload</span>
              `}
              <input type="file" id="ut-reward-logo-input" accept="image/*" style="display:none" />
            </div>
          </div>

          <!-- Title -->
          <div class="ut-form-group">
            <label class="ut-label">Reward Title</label>
            <input type="text" class="ut-input" id="ut-reward-title" placeholder="e.g. Signed Vinyl, Backstage Pass..." value="${r.title || ''}" />
          </div>

          <!-- Description -->
          <div class="ut-form-group">
            <label class="ut-label">Description</label>
            <textarea class="ut-textarea" id="ut-reward-desc" rows="4" placeholder="Describe what holders will receive...">${r.description || ''}</textarea>
          </div>

          <!-- Additional Media (photos/videos) -->
          <div class="ut-form-group">
            <label class="ut-label">Additional Photos / Videos <span class="ut-label-hint">(optional, max 5)</span></label>
            <div class="ut-media-grid" id="ut-reward-media-grid">
              ${existingMedia.map((url, i) => `
                <div class="ut-media-thumb" data-idx="${i}">
                  ${url.match(/\.(mp4|mov|webm)/i) 
                    ? `<video src="${url}" class="ut-media-thumb-img"></video>`
                    : `<img src="${url}" class="ut-media-thumb-img" />`
                  }
                  <button class="ut-media-remove" data-idx="${i}">✕</button>
                </div>
              `).join('')}
              <div class="ut-media-add" id="ut-reward-media-add">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <input type="file" id="ut-reward-media-input" accept="image/*,video/*" multiple style="display:none" />
              </div>
            </div>
          </div>

          <!-- Reward Type -->
          <div class="ut-form-group">
            <label class="ut-label">Reward Type</label>
            <select class="ut-select" id="ut-reward-type">
              <option value="physical" ${r.reward_type === 'physical' ? 'selected' : ''}>Physical (merch, vinyl, etc)</option>
              <option value="digital" ${r.reward_type === 'digital' ? 'selected' : ''}>Digital (download, file, etc)</option>
              <option value="experience" ${r.reward_type === 'experience' ? 'selected' : ''}>Experience (meet & greet, etc)</option>
              <option value="access" ${r.reward_type === 'access' ? 'selected' : ''}>Access (Discord, group chat, etc)</option>
            </select>
          </div>

          <!-- Requirements Text -->
          <div class="ut-form-group">
            <label class="ut-label">Requirements / Instructions</label>
            <textarea class="ut-textarea" id="ut-reward-requirements" rows="3" placeholder="How should holders claim this? Any additional requirements?">${r.requirements_text || ''}</textarea>
          </div>

          <!-- NFT Picker -->
          <div class="ut-form-group">
            <label class="ut-label">Which NFT unlocks this reward?</label>
            <div class="ut-nft-picker">
              <label class="ut-radio-label">
                <input type="radio" name="ut-reward-access" value="any_nft" ${isAllNfts ? 'checked' : ''} /> 
                All my NFTs
              </label>
              <label class="ut-radio-label">
                <input type="radio" name="ut-reward-access" value="specific_release" ${!isAllNfts ? 'checked' : ''} /> 
                Specific releases only
              </label>
            </div>
            <div class="ut-release-checklist" id="ut-reward-release-list" style="display:${isAllNfts ? 'none' : 'block'};">
              ${this.artistReleases.map(rel => `
                <label class="ut-checkbox-label">
                  <input type="checkbox" value="${rel.id}" ${existingReleaseIds.includes(rel.id) ? 'checked' : ''} />
                  <img src="${typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(rel.coverUrl) : rel.coverUrl || '/placeholder.png'}" class="ut-release-thumb" onerror="this.src='/placeholder.png'" />
                  <span>${rel.title}</span>
                </label>
              `).join('')}
              ${this.artistReleases.length === 0 ? '<div class="ut-empty-sm">No releases found</div>' : ''}
            </div>
            <button class="ut-link-btn" id="ut-reward-no-song" style="margin-top:8px;">
              🎵 Song not released yet — I'll attach it later
            </button>
          </div>

          <!-- Duration -->
          <div class="ut-form-group">
            <label class="ut-label">Duration</label>
            <div class="ut-duration-row">
              <label class="ut-radio-label">
                <input type="radio" name="ut-reward-duration" value="unlimited" ${!r.expires_at ? 'checked' : ''} />
                Until supplies run out
              </label>
              <label class="ut-radio-label">
                <input type="radio" name="ut-reward-duration" value="timed" ${r.expires_at ? 'checked' : ''} />
                Ends on a date
              </label>
            </div>
            <div id="ut-reward-date-row" style="display:${r.expires_at ? 'block' : 'none'}; margin-top:8px;">
              <input type="datetime-local" class="ut-input" id="ut-reward-expires" value="${r.expires_at ? new Date(r.expires_at).toISOString().slice(0,16) : ''}" />
            </div>
          </div>

          <!-- Actions -->
          <div class="ut-form-actions">
            <button class="btn btn-secondary" id="ut-reward-save-draft">Save as Draft</button>
            <button class="btn btn-primary" id="ut-reward-publish">${isEdit ? 'Update Reward' : 'Create Reward'}</button>
          </div>
        </div>
      </div>
    `;

    this._rewardEditId = isEdit ? r.id : null;
    this._rewardLogoUrl = r.image_url || null;
    this._rewardMediaUrls = [...existingMedia];
    this.bindCreateRewardEvents();
  },

  bindCreateRewardEvents() {
    document.getElementById('ut-back-dash')?.addEventListener('click', () => this.renderOwnerContentPage());

    // Logo upload
    const logoZone = document.getElementById('ut-reward-logo-zone');
    const logoInput = document.getElementById('ut-reward-logo-input');
    logoZone?.addEventListener('click', () => logoInput?.click());
    logoInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      logoZone.innerHTML = '<div class="spinner"></div> Uploading...';
      const url = await this.uploadFile(file);
      if (url) {
        this._rewardLogoUrl = url;
        logoZone.innerHTML = `<img src="${url}" class="ut-upload-preview" />`;
      } else {
        logoZone.innerHTML = `
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <span style="color:var(--error);">Upload failed — tap to retry</span>
          <input type="file" id="ut-reward-logo-input" accept="image/*" style="display:none" />
        `;
      }
    });

    // Media add
    document.getElementById('ut-reward-media-add')?.addEventListener('click', () => {
      document.getElementById('ut-reward-media-input')?.click();
    });
    document.getElementById('ut-reward-media-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files.slice(0, 5 - this._rewardMediaUrls.length)) {
        const url = await this.uploadFile(file);
        if (url) this._rewardMediaUrls.push(url);
      }
      this.refreshMediaGrid('ut-reward-media-grid', this._rewardMediaUrls, 'reward');
    });

    // Media remove
    document.getElementById('ut-reward-media-grid')?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.ut-media-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx);
        this._rewardMediaUrls.splice(idx, 1);
        this.refreshMediaGrid('ut-reward-media-grid', this._rewardMediaUrls, 'reward');
      }
    });

    // Access type toggle
    document.querySelectorAll('input[name="ut-reward-access"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const list = document.getElementById('ut-reward-release-list');
        if (list) list.style.display = radio.value === 'specific_release' ? 'block' : 'none';
      });
    });

    // "Song not released yet" button
    document.getElementById('ut-reward-no-song')?.addEventListener('click', () => {
      const allRadio = document.querySelector('input[name="ut-reward-access"][value="any_nft"]');
      if (allRadio) allRadio.checked = true;
      document.getElementById('ut-reward-release-list').style.display = 'none';
      if (typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast('No worries! You can attach a specific NFT later by editing this reward.');
      }
    });

    // Duration toggle
    document.querySelectorAll('input[name="ut-reward-duration"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById('ut-reward-date-row').style.display = radio.value === 'timed' ? 'block' : 'none';
      });
    });

    // Save draft
    document.getElementById('ut-reward-save-draft')?.addEventListener('click', () => this.submitReward('draft'));
    // Publish
    document.getElementById('ut-reward-publish')?.addEventListener('click', () => this.submitReward('active'));
  },

  async submitReward(status) {
    const title = document.getElementById('ut-reward-title')?.value?.trim();
    if (!title) { alert('Please enter a reward title'); return; }

    const accessType = document.querySelector('input[name="ut-reward-access"]:checked')?.value || 'any_nft';
    const checkedReleases = Array.from(document.querySelectorAll('#ut-reward-release-list input[type="checkbox"]:checked')).map(cb => cb.value);
    const durationVal = document.querySelector('input[name="ut-reward-duration"]:checked')?.value || 'unlimited';
    const expiresAt = durationVal === 'timed' ? document.getElementById('ut-reward-expires')?.value || null : null;

    const payload = {
      action: this._rewardEditId ? 'update' : 'create',
      artist: this.artistAddress,
      title,
      description: document.getElementById('ut-reward-desc')?.value || '',
      image_url: this._rewardLogoUrl || null,
      media_urls: this._rewardMediaUrls,
      reward_type: document.getElementById('ut-reward-type')?.value || 'physical',
      requirements_text: document.getElementById('ut-reward-requirements')?.value || '',
      access_type: accessType,
      required_release_ids: accessType === 'specific_release' ? checkedReleases : [],
      expires_at: expiresAt,
      max_claims: null,
      status,
    };

    if (this._rewardEditId) payload.id = this._rewardEditId;

    const btn = document.getElementById(status === 'draft' ? 'ut-reward-save-draft' : 'ut-reward-publish');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const resp = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      if (typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast(status === 'draft' ? 'Reward saved as draft!' : 'Reward published!');
      }

      this.rewardCount = (this.rewardCount || 0) + (this._rewardEditId ? 0 : 1);
      this.renderOwnerContentPage();
    } catch (e) {
      console.error('Submit reward error:', e);
      alert('Failed to save reward: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = status === 'draft' ? 'Save as Draft' : (this._rewardEditId ? 'Update Reward' : 'Create Reward'); }
    }
  },

  // ─── OWNER CONTENT PAGE (default landing — feed + stats + gear) ──

  renderOwnerContentPage() {
    const cfg = this.config || {};
    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-page ut-page-wide">
        <div class="ut-page-header">
          <h2 class="ut-page-title">Unlockable Content</h2>
          <div class="ut-header-actions">
            <button class="btn btn-primary btn-sm" id="ut-new-post-btn">+ New Post</button>
            <button class="btn btn-secondary btn-sm" id="ut-create-reward-btn">🎁 Reward</button>
            <button class="ut-gear-btn" id="ut-toggle-settings" title="Page Settings">⚙️</button>
          </div>
        </div>

        <!-- Collapsible settings -->
        <div class="ut-inline-settings" id="ut-inline-settings" style="display:none;">
          <div class="ut-inline-settings-header">
            <span class="ut-inline-settings-title">Page Settings</span>
            <button class="ut-inline-settings-close" id="ut-close-settings">✕</button>
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Who can access?</div>
            <select class="ut-select ut-select-sm" id="ut-feed-access-type">
              <option value="any_nft" ${(cfg.private_page_access_type || 'any_nft') === 'any_nft' ? 'selected' : ''}>Any NFT holder</option>
              <option value="specific_release" ${cfg.private_page_access_type === 'specific_release' ? 'selected' : ''}>Specific release only</option>
            </select>
          </div>
          <div class="ut-setting-row" id="ut-feed-release-row" style="display:${cfg.private_page_access_type === 'specific_release' ? 'block' : 'none'};">
            <select class="ut-select ut-select-sm" id="ut-feed-access-release">
              <option value="">Select a release...</option>
              ${this.artistReleases.map(r => `<option value="${r.id}" ${cfg.private_page_release_id === r.id ? 'selected' : ''}>${r.title}</option>`).join('')}
            </select>
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Welcome message</div>
            <input type="text" class="ut-input ut-input-sm" id="ut-feed-welcome" value="${cfg.welcome_message || ''}" placeholder="Welcome to my private page!" />
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Teaser (non-holders see this)</div>
            <input type="text" class="ut-input ut-input-sm" id="ut-feed-desc" value="${cfg.private_page_description || ''}" placeholder="Exclusive content for NFT holders..." />
          </div>
          <button class="btn btn-primary btn-sm" id="ut-feed-save-settings" style="margin-top:8px;">Save</button>
        </div>

        <!-- Clickable stats -->
        <div class="ut-stats-row">
          <button class="ut-stat ut-stat-clickable" id="ut-stat-rewards"><span class="ut-stat-num">${this.rewardCount}</span> Active Rewards →</button>
          <div class="ut-stat"><span class="ut-stat-num">${this.postCount}</span> Posts</div>
          <div class="ut-stat"><span class="ut-stat-num" id="ut-claims-count">0</span> Total Claims</div>
        </div>

        <!-- Content feed -->
        <div id="ut-content-feed" class="ut-feed-grid">
          <div class="ut-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById('ut-new-post-btn')?.addEventListener('click', () => this.showCreatePostModal());
    document.getElementById('ut-create-reward-btn')?.addEventListener('click', () => this.showCreateRewardPage());
    document.getElementById('ut-stat-rewards')?.addEventListener('click', () => this.showOwnerRewardsList());
    document.getElementById('ut-toggle-settings')?.addEventListener('click', () => {
      const p = document.getElementById('ut-inline-settings');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('ut-close-settings')?.addEventListener('click', () => {
      document.getElementById('ut-inline-settings').style.display = 'none';
    });
    document.getElementById('ut-feed-access-type')?.addEventListener('change', (e) => {
      document.getElementById('ut-feed-release-row').style.display = e.target.value === 'specific_release' ? 'block' : 'none';
    });
    document.getElementById('ut-feed-save-settings')?.addEventListener('click', async () => {
      const btn = document.getElementById('ut-feed-save-settings');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
      try {
        await fetch('/api/unlockables', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setup', artist: this.artistAddress, private_page_enabled: true,
            private_page_access_type: document.getElementById('ut-feed-access-type')?.value || 'any_nft',
            private_page_release_id: document.getElementById('ut-feed-access-release')?.value || null,
            private_page_description: document.getElementById('ut-feed-desc')?.value || '',
            welcome_message: document.getElementById('ut-feed-welcome')?.value || '',
            tab_setup_complete: true,
          })
        });
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        document.getElementById('ut-inline-settings').style.display = 'none';
        if (typeof Modals !== 'undefined' && Modals.showToast) Modals.showToast('Settings saved!');
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        alert('Failed to save');
      }
    });

    this.loadContentFeed();
    // Load claims count
    fetch(`/api/rewards?claims=true&artist=${this.artistAddress}`)
      .then(r => r.json()).then(d => { const el = document.getElementById('ut-claims-count'); if (el) el.textContent = (d.claims || []).length; })
      .catch(() => {});
  },

  // ─── OWNER REWARDS LIST (big cards) ────────────────────

  async showOwnerRewardsList() {
    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-page ut-page-wide">
        <div class="ut-page-header">
          <button class="ut-back-btn" id="ut-back-feed">← Back</button>
          <h2 class="ut-page-title">My Rewards</h2>
          <button class="btn btn-primary btn-sm" id="ut-create-reward-btn2">+ Create Reward</button>
        </div>
        <div id="ut-owner-rewards-list"><div class="ut-loading"><div class="spinner"></div></div></div>
      </div>
    `;
    document.getElementById('ut-back-feed')?.addEventListener('click', () => this.renderOwnerContentPage());
    document.getElementById('ut-create-reward-btn2')?.addEventListener('click', () => this.showCreateRewardPage());

    try {
      const resp = await fetch(`/api/rewards?artist=${this.artistAddress}`);
      const data = await resp.json();
      const rewards = data.rewards || [];
      const container = document.getElementById('ut-owner-rewards-list');
      if (!container) return;

      if (rewards.length === 0) {
        container.innerHTML = '<div class="ut-empty-state"><div class="ut-empty-icon">🎁</div><h3>No Rewards Yet</h3><p>Create your first reward.</p><button class="btn btn-primary" id="ut-empty-cr">Create Reward</button></div>';
        document.getElementById('ut-empty-cr')?.addEventListener('click', () => this.showCreateRewardPage());
        return;
      }

      container.innerHTML = '<div class="ut-owner-rewards-grid">' + rewards.map(r => {
        const sc = r.status === 'active' ? '#22c55e' : r.status === 'paused' ? '#f59e0b' : '#6b7280';
        const sl = r.status.charAt(0).toUpperCase() + r.status.slice(1);
        return `
          <div class="ut-owner-reward-card">
            <div class="ut-owner-reward-img-wrap">
              ${r.image_url ? '<img src="' + r.image_url + '" class="ut-owner-reward-img" onerror="this.src=\'/placeholder.png\'" />' : '<div class="ut-owner-reward-placeholder">🎁</div>'}
              <div class="ut-owner-reward-status" style="background:${sc};">${sl}</div>
            </div>
            <div class="ut-owner-reward-body">
              <div class="ut-owner-reward-title">${r.title}</div>
              <div class="ut-owner-reward-type">${r.reward_type || 'Reward'}</div>
              ${r.description ? '<div class="ut-owner-reward-desc">' + r.description.slice(0, 160) + (r.description.length > 160 ? '...' : '') + '</div>' : ''}
              <div class="ut-owner-reward-meta">${r.claim_count || 0} claimed${r.expires_at ? ' · Ends ' + new Date(r.expires_at).toLocaleDateString() : ''}</div>
              <div class="ut-owner-reward-actions">
                <button class="btn btn-secondary btn-sm ut-edit-reward" data-id="${r.id}">Edit</button>
                <button class="btn btn-secondary btn-sm ut-toggle-reward" data-id="${r.id}" data-status="${r.status}">${r.status === 'active' ? 'Pause' : 'Activate'}</button>
                <button class="ut-link-btn ut-delete-reward" data-id="${r.id}" style="color:var(--error);margin-left:auto;">Delete</button>
              </div>
            </div>
          </div>`;
      }).join('') + '</div>';

      container.querySelectorAll('.ut-edit-reward').forEach(btn => {
        btn.addEventListener('click', () => { const rw = rewards.find(r => r.id === btn.dataset.id); if (rw) this.showCreateRewardPage(rw); });
      });
      container.querySelectorAll('.ut-toggle-reward').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ns = btn.dataset.status === 'active' ? 'paused' : 'active';
          try { await fetch('/api/rewards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', id: btn.dataset.id, artist: this.artistAddress, status: ns }) }); this.showOwnerRewardsList(); } catch (e) { alert('Failed'); }
        });
      });
      container.querySelectorAll('.ut-delete-reward').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this reward?')) return;
          try { await fetch('/api/rewards?id=' + btn.dataset.id + '&artist=' + this.artistAddress, { method: 'DELETE' }); this.rewardCount = Math.max(0, (this.rewardCount || 0) - 1); this.showOwnerRewardsList(); } catch (e) { alert('Failed'); }
        });
      });
    } catch (e) { document.getElementById('ut-owner-rewards-list').innerHTML = '<div class="ut-error">Failed to load rewards</div>'; }
  },

  // ─── CONTENT FEED (shared loader) ─────────────────────

  async showContentFeedPage() {
    const cfg = this.config || {};

    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-page">
        <div class="ut-page-header">
          <button class="ut-back-btn" id="ut-back-dash2">← Back</button>
          <h2 class="ut-page-title">Unlockable Content</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-sm" id="ut-new-post-btn">+ New Post</button>
            <button class="ut-gear-btn" id="ut-toggle-settings" title="Page Settings">⚙️</button>
          </div>
        </div>

        <!-- Collapsible settings panel -->
        <div class="ut-inline-settings" id="ut-inline-settings" style="display:none;">
          <div class="ut-inline-settings-header">
            <span class="ut-inline-settings-title">Page Settings</span>
            <button class="ut-inline-settings-close" id="ut-close-settings">✕</button>
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Who can access?</div>
            <select class="ut-select ut-select-sm" id="ut-feed-access-type">
              <option value="any_nft" ${(cfg.private_page_access_type || 'any_nft') === 'any_nft' ? 'selected' : ''}>Any NFT holder</option>
              <option value="specific_release" ${cfg.private_page_access_type === 'specific_release' ? 'selected' : ''}>Specific release only</option>
            </select>
          </div>
          <div class="ut-setting-row" id="ut-feed-release-row" style="display:${cfg.private_page_access_type === 'specific_release' ? 'block' : 'none'};">
            <select class="ut-select ut-select-sm" id="ut-feed-access-release">
              <option value="">Select a release...</option>
              ${this.artistReleases.map(r => `
                <option value="${r.id}" ${cfg.private_page_release_id === r.id ? 'selected' : ''}>${r.title}</option>
              `).join('')}
            </select>
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Welcome message</div>
            <input type="text" class="ut-input ut-input-sm" id="ut-feed-welcome" placeholder="Welcome to my private page!" value="${cfg.welcome_message || ''}" />
          </div>
          <div class="ut-setting-row">
            <div class="ut-setting-label">Teaser description (non-holders see this)</div>
            <input type="text" class="ut-input ut-input-sm" id="ut-feed-desc" placeholder="Exclusive content for my NFT holders..." value="${cfg.private_page_description || ''}" />
          </div>
          <button class="btn btn-primary btn-sm" id="ut-feed-save-settings" style="margin-top:8px;">Save</button>
        </div>

        <div id="ut-content-feed" class="ut-feed-grid">
          <div class="ut-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    // Back
    document.getElementById('ut-back-dash2')?.addEventListener('click', () => this.renderOwnerContentPage());
    // New post
    document.getElementById('ut-new-post-btn')?.addEventListener('click', () => this.showCreatePostModal());

    // Settings gear toggle
    document.getElementById('ut-toggle-settings')?.addEventListener('click', () => {
      const panel = document.getElementById('ut-inline-settings');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    // Settings close ✕
    document.getElementById('ut-close-settings')?.addEventListener('click', () => {
      const panel = document.getElementById('ut-inline-settings');
      if (panel) panel.style.display = 'none';
    });
    // Access type toggle in settings
    document.getElementById('ut-feed-access-type')?.addEventListener('change', (e) => {
      const row = document.getElementById('ut-feed-release-row');
      if (row) row.style.display = e.target.value === 'specific_release' ? 'block' : 'none';
    });
    // Save settings from feed page
    document.getElementById('ut-feed-save-settings')?.addEventListener('click', async () => {
      const btn = document.getElementById('ut-feed-save-settings');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
      try {
        await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setup',
            artist: this.artistAddress,
            private_page_enabled: true,
            private_page_access_type: document.getElementById('ut-feed-access-type')?.value || 'any_nft',
            private_page_release_id: document.getElementById('ut-feed-access-release')?.value || null,
            private_page_description: document.getElementById('ut-feed-desc')?.value || '',
            welcome_message: document.getElementById('ut-feed-welcome')?.value || '',
            tab_setup_complete: true,
          })
        });
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        // Close settings panel after save
        const panel = document.getElementById('ut-inline-settings');
        if (panel) panel.style.display = 'none';
        if (typeof Modals !== 'undefined' && Modals.showToast) {
          Modals.showToast('Settings saved!');
        }
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        alert('Failed to save settings');
      }
    });

    await this.loadContentFeed();
  },

  async loadContentFeed() {
    const container = document.getElementById('ut-content-feed');
    if (!container) return;

    try {
      const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true`);
      const data = await resp.json();
      const posts = data.posts || [];
      this.posts = posts;

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="ut-empty-state">
            <div class="ut-empty-icon">📝</div>
            <h3>No Posts Yet</h3>
            <p>Share exclusive content with your NFT holders.</p>
            <button class="btn btn-primary" id="ut-empty-new-post">Create First Post</button>
          </div>
        `;
        document.getElementById('ut-empty-new-post')?.addEventListener('click', () => this.showCreatePostModal());
        return;
      }

      // Instagram-style grid
      container.innerHTML = posts.map((post, idx) => {
        const media = post.media_urls || [];
        const firstMedia = media[0] || post.image_url;
        const isVideo = firstMedia && firstMedia.match(/\.(mp4|mov|webm)/i);
        const hasMultiple = media.length > 1;
        const isLocked = post.access_type === 'specific_release';

        return `
          <div class="ut-grid-card" data-post-idx="${idx}">
            <div class="ut-grid-card-media">
              ${firstMedia
                ? isVideo
                  ? `<video src="${firstMedia}" class="ut-grid-card-img" preload="metadata"></video>`
                  : `<img src="${firstMedia}" class="ut-grid-card-img" onerror="this.src='/placeholder.png'" />`
                : `<div class="ut-grid-card-text-preview">${(post.content || '').slice(0, 120)}</div>`
              }
              ${hasMultiple ? '<div class="ut-grid-card-multi">📷 ' + media.length + '</div>' : ''}
              ${isLocked ? '<div class="ut-grid-card-key">🔑</div>' : ''}
              ${post.pinned ? '<div class="ut-grid-card-pin">📌</div>' : ''}
            </div>
          </div>
        `;
      }).join('');

      // Click to expand
      container.querySelectorAll('.ut-grid-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.postIdx);
          this.showPostDetail(posts[idx]);
        });
      });

    } catch (e) {
      console.error('Load feed error:', e);
      container.innerHTML = '<div class="ut-error">Failed to load posts</div>';
    }
  },

  showPostDetail(post) {
    const media = post.media_urls || [];
    if (media.length === 0 && post.image_url) media.push(post.image_url);
    if (media.length === 0 && post.video_url) media.push(post.video_url);

    const overlay = document.createElement('div');
    overlay.className = 'ut-post-overlay';
    overlay.innerHTML = `
      <div class="ut-post-modal">
        <button class="ut-post-close">✕</button>
        
        <!-- Media Carousel -->
        ${media.length > 0 ? `
          <div class="ut-carousel" id="ut-carousel">
            <div class="ut-carousel-track" id="ut-carousel-track" style="width:${media.length * 100}%;">
              ${media.map(url => {
                const isVid = url.match(/\.(mp4|mov|webm)/i);
                return `
                  <div class="ut-carousel-slide" style="width:${100 / media.length}%;">
                    ${isVid
                      ? `<video src="${url}" controls class="ut-carousel-media"></video>`
                      : `<img src="${url}" class="ut-carousel-media" />`
                    }
                  </div>
                `;
              }).join('')}
            </div>
            ${media.length > 1 ? `
              <button class="ut-carousel-prev" id="ut-carousel-prev">‹</button>
              <button class="ut-carousel-next" id="ut-carousel-next">›</button>
              <div class="ut-carousel-dots">
                ${media.map((_, i) => `<div class="ut-carousel-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Post Content -->
        <div class="ut-post-body">
          <div class="ut-post-content">${post.content || ''}</div>
          <div class="ut-post-meta">
            ${post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            ${post.access_type === 'specific_release' ? ' • 🔑 Requires specific NFT' : ''}
          </div>

          ${this.isOwner ? `
            <div class="ut-post-owner-actions">
              <button class="ut-link-btn ut-edit-post" data-post-id="${post.id}">Edit</button>
              <button class="ut-link-btn ut-delete-post" data-post-id="${post.id}" style="color:var(--error);">Delete</button>
              <button class="ut-link-btn ut-pin-post" data-post-id="${post.id}">${post.pinned ? 'Unpin' : 'Pin'}</button>
            </div>
          ` : ''}

          <!-- Comments -->
          <div class="ut-comments-section">
            <h4 class="ut-comments-title">Comments</h4>
            <div class="ut-comments-list" id="ut-comments-list">
              ${(post.comments || []).map(c => `
                <div class="ut-comment">
                  <span class="ut-comment-name">${c.commenter_name || Helpers.truncateAddress(c.commenter_address)}</span>
                  <span class="ut-comment-text">${c.content}</span>
                  <span class="ut-comment-time">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              `).join('')}
              ${(post.comments || []).length === 0 ? '<div class="ut-empty-sm">No comments yet</div>' : ''}
            </div>
            ${this.hasAccess ? `
              <div class="ut-comment-form">
                <input type="text" class="ut-input" id="ut-comment-input" placeholder="Write a comment..." />
                <button class="btn btn-primary btn-sm" id="ut-comment-submit">Post</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close
    overlay.querySelector('.ut-post-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Carousel navigation
    let currentSlide = 0;
    const track = overlay.querySelector('#ut-carousel-track');
    const dots = overlay.querySelectorAll('.ut-carousel-dot');
    const goTo = (idx) => {
      currentSlide = Math.max(0, Math.min(idx, media.length - 1));
      if (track) track.style.transform = `translateX(-${currentSlide * (100 / media.length)}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    };
    overlay.querySelector('#ut-carousel-prev')?.addEventListener('click', () => goTo(currentSlide - 1));
    overlay.querySelector('#ut-carousel-next')?.addEventListener('click', () => goTo(currentSlide + 1));
    dots.forEach(dot => dot.addEventListener('click', () => goTo(parseInt(dot.dataset.idx))));

    // Comment submit
    overlay.querySelector('#ut-comment-submit')?.addEventListener('click', async () => {
      const input = overlay.querySelector('#ut-comment-input');
      const text = input?.value?.trim();
      if (!text) return;
      try {
        await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'comment',
            post_id: post.id,
            commenter_address: this.viewerAddress,
            content: text,
          })
        });
        input.value = '';
        const list = overlay.querySelector('#ut-comments-list');
        const emptyMsg = list.querySelector('.ut-empty-sm');
        if (emptyMsg) emptyMsg.remove();
        const profile = (typeof AppState !== 'undefined' && AppState.profile) ? AppState.profile : {};
        list.innerHTML += `
          <div class="ut-comment">
            <span class="ut-comment-name">${profile.name || Helpers.truncateAddress(this.viewerAddress)}</span>
            <span class="ut-comment-text">${text}</span>
            <span class="ut-comment-time">Just now</span>
          </div>
        `;
      } catch (e) { console.error('Comment error:', e); }
    });

    // Owner actions
    overlay.querySelector('.ut-delete-post')?.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      try {
        await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_post', id: post.id, artist: this.artistAddress })
        });
        overlay.remove();
        this.showContentFeedPage();
      } catch (e) { alert('Failed to delete'); }
    });

    overlay.querySelector('.ut-edit-post')?.addEventListener('click', () => {
      overlay.remove();
      this.showCreatePostModal(post);
    });

    overlay.querySelector('.ut-pin-post')?.addEventListener('click', async () => {
      try {
        await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_post',
            id: post.id,
            artist: this.artistAddress,
            content: post.content,
            media_urls: post.media_urls,
            image_url: post.image_url,
            access_type: post.access_type,
            required_release_id: post.required_release_id,
            pinned: !post.pinned,
          })
        });
        overlay.remove();
        this.showContentFeedPage();
      } catch (e) { alert('Failed to update pin'); }
    });
  },

  // ─── CREATE POST MODAL (multi-media carousel) ─────────

  showCreatePostModal(existingPost = null) {
    const isEdit = !!existingPost;
    const p = existingPost || {};
    const existingMedia = p.media_urls || [];
    if (!existingMedia.length && p.image_url) existingMedia.push(p.image_url);
    if (!existingMedia.length && p.video_url) existingMedia.push(p.video_url);

    document.querySelector('.ut-post-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ut-post-overlay';
    overlay.innerHTML = `
      <div class="ut-post-modal" style="max-width:520px;">
        <button class="ut-post-close">✕</button>
        <div class="ut-post-body">
          <h3 style="margin-bottom:16px;">${isEdit ? 'Edit Post' : 'New Post'}</h3>

          <!-- Text -->
          <div class="ut-form-group">
            <textarea class="ut-textarea" id="ut-post-content" rows="4" placeholder="What do you want to share with your holders?">${p.content || ''}</textarea>
          </div>

          <!-- Media Upload -->
          <div class="ut-form-group">
            <label class="ut-label">Photos / Videos <span class="ut-label-hint">(up to 10)</span></label>
            <div class="ut-media-grid" id="ut-post-media-grid">
              ${existingMedia.map((url, i) => `
                <div class="ut-media-thumb" data-idx="${i}">
                  ${url.match(/\.(mp4|mov|webm)/i)
                    ? `<video src="${url}" class="ut-media-thumb-img"></video>`
                    : `<img src="${url}" class="ut-media-thumb-img" />`
                  }
                  <button class="ut-media-remove" data-idx="${i}">✕</button>
                </div>
              `).join('')}
              <div class="ut-media-add" id="ut-post-media-add">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <input type="file" id="ut-post-media-input" accept="image/*,video/*" multiple style="display:none" />
              </div>
            </div>
          </div>

          <!-- Per-post access control -->
          <div class="ut-form-group">
            <label class="ut-label">Access</label>
            <select class="ut-select" id="ut-post-access">
              <option value="page_default" ${(p.access_type || 'page_default') === 'page_default' ? 'selected' : ''}>Page default (any NFT holder)</option>
              <option value="specific_release" ${p.access_type === 'specific_release' ? 'selected' : ''}>Requires specific NFT</option>
            </select>
          </div>
          <div id="ut-post-release-row" style="display:${p.access_type === 'specific_release' ? 'block' : 'none'};">
            <select class="ut-select" id="ut-post-release">
              <option value="">Select a release...</option>
              ${this.artistReleases.map(r => `
                <option value="${r.id}" ${p.required_release_id === r.id ? 'selected' : ''}>${r.title}</option>
              `).join('')}
            </select>
          </div>

          <!-- Pin option -->
          <label class="ut-checkbox-label" style="margin-top:12px;">
            <input type="checkbox" id="ut-post-pinned" ${p.pinned ? 'checked' : ''} />
            <span>Pin this post to top</span>
          </label>

          <div class="ut-form-actions" style="margin-top:20px;">
            <button class="btn btn-secondary" id="ut-post-cancel">Cancel</button>
            <button class="btn btn-primary" id="ut-post-submit">${isEdit ? 'Update Post' : 'Post'}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._postMediaUrls = [...existingMedia];
    this._postEditId = isEdit ? p.id : null;

    // Close
    overlay.querySelector('.ut-post-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ut-post-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Media add
    overlay.querySelector('#ut-post-media-add')?.addEventListener('click', () => {
      overlay.querySelector('#ut-post-media-input')?.click();
    });
    overlay.querySelector('#ut-post-media-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files.slice(0, 10 - this._postMediaUrls.length)) {
        const url = await this.uploadFile(file);
        if (url) this._postMediaUrls.push(url);
      }
      this.refreshMediaGrid('ut-post-media-grid', this._postMediaUrls, 'post');
    });

    // Media remove
    overlay.querySelector('#ut-post-media-grid')?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.ut-media-remove');
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.idx);
        this._postMediaUrls.splice(idx, 1);
        this.refreshMediaGrid('ut-post-media-grid', this._postMediaUrls, 'post');
      }
    });

    // Access toggle
    overlay.querySelector('#ut-post-access')?.addEventListener('change', (e) => {
      overlay.querySelector('#ut-post-release-row').style.display = e.target.value === 'specific_release' ? 'block' : 'none';
    });

    // Submit
    overlay.querySelector('#ut-post-submit')?.addEventListener('click', async () => {
      const content = overlay.querySelector('#ut-post-content')?.value?.trim() || '';
      if (!content && this._postMediaUrls.length === 0) {
        alert('Please add some text or media');
        return;
      }

      const accessType = overlay.querySelector('#ut-post-access')?.value || 'page_default';
      const releaseId = overlay.querySelector('#ut-post-release')?.value || null;
      const pinned = overlay.querySelector('#ut-post-pinned')?.checked || false;

      const payload = {
        action: this._postEditId ? 'update_post' : 'create_post',
        artist: this.artistAddress,
        content,
        media_urls: this._postMediaUrls,
        image_url: this._postMediaUrls[0] || null,
        access_type: accessType,
        required_release_id: accessType === 'specific_release' ? releaseId : null,
        pinned,
      };
      if (this._postEditId) payload.id = this._postEditId;

      const btn = overlay.querySelector('#ut-post-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

      try {
        const resp = await fetch('/api/unlockables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        overlay.remove();
        this.postCount = (this.postCount || 0) + (this._postEditId ? 0 : 1);
        // If we're on the feed page, refresh it; otherwise go to dashboard
        const feedContainer = document.getElementById('ut-content-feed');
        if (feedContainer) {
          this.loadContentFeed();
        } else {
          this.renderOwnerContentPage();
        }
      } catch (e) {
        console.error('Post submit error:', e);
        alert('Failed to save post: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = this._postEditId ? 'Update Post' : 'Post'; }
      }
    });
  },

  // ─── HOLDER VIEW (sees content + rewards) ──────────────

  async renderHolderView() {
    const cfg = this.config || {};

    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-holder-page">
        ${cfg.welcome_message ? `<div class="ut-welcome-msg">${cfg.welcome_message}</div>` : ''}

        <!-- Sub-tabs: Posts | Rewards -->
        <div class="ut-sub-tabs">
          <button class="ut-sub-tab active" data-subtab="posts">Posts</button>
          <button class="ut-sub-tab" data-subtab="rewards">Rewards</button>
        </div>

        <div id="ut-holder-content">
          <div class="ut-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    // Sub-tab switching
    this.container.querySelectorAll('.ut-sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('.ut-sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.subtab === 'posts') this.loadHolderPosts();
        else this.loadHolderRewards();
      });
    });

    await this.loadHolderPosts();
  },

  async loadHolderPosts() {
    const content = document.getElementById('ut-holder-content');
    if (!content) return;
    content.innerHTML = '<div class="ut-loading"><div class="spinner"></div></div>';

    try {
      const resp = await fetch(`/api/unlockables?artist=${this.artistAddress}&posts=true`);
      const data = await resp.json();

      // Check which posts the user has access to
      const allPosts = data.posts || [];
      const accessiblePosts = [];
      for (const post of allPosts) {
        if (await this.checkPostAccess(post)) {
          accessiblePosts.push(post);
        }
      }

      if (accessiblePosts.length === 0) {
        content.innerHTML = '<div class="ut-empty-state"><div class="ut-empty-icon">📝</div><h3>No Posts Yet</h3><p>The artist hasn\'t posted any exclusive content yet.</p></div>';
        return;
      }

      // Instagram grid
      content.innerHTML = `<div class="ut-feed-grid">${accessiblePosts.map((post, idx) => {
        const media = post.media_urls || [];
        const firstMedia = media[0] || post.image_url;
        const isVideo = firstMedia && firstMedia.match(/\.(mp4|mov|webm)/i);
        return `
          <div class="ut-grid-card" data-holder-post-idx="${idx}">
            <div class="ut-grid-card-media">
              ${firstMedia
                ? isVideo
                  ? `<video src="${firstMedia}" class="ut-grid-card-img" preload="metadata"></video>`
                  : `<img src="${firstMedia}" class="ut-grid-card-img" onerror="this.src='/placeholder.png'" />`
                : `<div class="ut-grid-card-text-preview">${(post.content || '').slice(0, 120)}</div>`
              }
              ${media.length > 1 ? '<div class="ut-grid-card-multi">📷 ' + media.length + '</div>' : ''}
              ${post.pinned ? '<div class="ut-grid-card-pin">📌</div>' : ''}
            </div>
          </div>
        `;
      }).join('')}</div>`;

      content.querySelectorAll('.ut-grid-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.holderPostIdx);
          this.showPostDetail(accessiblePosts[idx]);
        });
      });

    } catch (e) {
      content.innerHTML = '<div class="ut-error">Failed to load posts</div>';
    }
  },

  async loadHolderRewards() {
    const content = document.getElementById('ut-holder-content');
    if (!content) return;
    content.innerHTML = '<div class="ut-loading"><div class="spinner"></div></div>';

    try {
      const resp = await fetch(`/api/rewards?artist=${this.artistAddress}`);
      const data = await resp.json();
      const rewards = (data.rewards || []).filter(r => r.status === 'active');

      if (rewards.length === 0) {
        content.innerHTML = '<div class="ut-empty-state"><div class="ut-empty-icon">🎁</div><h3>No Rewards Available</h3><p>Check back later for exclusive rewards!</p></div>';
        return;
      }

      content.innerHTML = `<div class="ut-rewards-grid">${rewards.map(r => `
        <div class="ut-reward-card" data-reward-id="${r.id}">
          ${r.image_url ? `<img src="${r.image_url}" class="ut-reward-card-img" onerror="this.src='/placeholder.png'" />` : `<div class="ut-reward-card-placeholder">🎁</div>`}
          <div class="ut-reward-card-body">
            <div class="ut-reward-card-title">${r.title}</div>
            <div class="ut-reward-card-type">${r.reward_type || 'Reward'}</div>
            ${r.description ? `<div class="ut-reward-card-desc">${r.description.slice(0, 100)}${r.description.length > 100 ? '...' : ''}</div>` : ''}
            <div class="ut-reward-card-meta">
              ${r.claim_count || 0} claimed
              ${r.expires_at ? ` • Ends ${new Date(r.expires_at).toLocaleDateString()}` : ''}
            </div>
            <button class="btn btn-primary btn-sm ut-claim-btn" data-reward-id="${r.id}" style="margin-top:10px;">Claim Reward</button>
          </div>
        </div>
      `).join('')}</div>`;

      content.querySelectorAll('.ut-claim-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.claimReward(btn.dataset.rewardId, btn);
        });
      });

    } catch (e) {
      content.innerHTML = '<div class="ut-error">Failed to load rewards</div>';
    }
  },

  async claimReward(rewardId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Claiming...'; }
    try {
      const resp = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          reward_id: rewardId,
          claimer_address: this.viewerAddress,
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (btn) { btn.textContent = '✓ Claimed!'; btn.style.background = '#22c55e'; }
    } catch (e) {
      alert('Failed to claim: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Claim Reward'; }
    }
  },

  // ─── LOCKED VIEW (non-holders see teaser) ──────────────

  renderLockedView() {
    const cfg = this.config || {};

    this.container.innerHTML = `
      ${this.getStyles()}
      <div class="ut-locked-page">
        <div class="ut-locked-icon">🔒</div>
        <h2 class="ut-locked-title">Exclusive Content</h2>
        <p class="ut-locked-desc">${cfg.private_page_description || 'This content is exclusively available to NFT holders.'}</p>
        <div class="ut-locked-stats">
          ${this.postCount > 0 ? `<span>${this.postCount} exclusive post${this.postCount > 1 ? 's' : ''}</span>` : ''}
          ${this.rewardCount > 0 ? `<span>${this.rewardCount} reward${this.rewardCount > 1 ? 's' : ''} available</span>` : ''}
        </div>
        <button class="btn btn-primary" onclick="Router.navigate('marketplace')">Browse Music to Unlock</button>
      </div>
    `;
  },

  // ─── HELPERS ───────────────────────────────────────────

  async uploadFile(file) {
    try {
      // Get upload config (returns { key, endpoint })
      const configResp = await fetch('/api/upload-config');
      const config = await configResp.json();

      if (!config.key) {
        throw new Error('Upload service not configured');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Use the endpoint from config, fallback to default
      const endpoint = config.endpoint || 'https://node.lighthouse.storage/api/v0/add';

      const uploadResp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.key}` },
        body: formData
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => 'Unknown error');
        throw new Error(`Upload failed (${uploadResp.status}): ${errText}`);
      }

      const uploadData = await uploadResp.json();
      if (uploadData.Hash) {
        return `/api/ipfs/${uploadData.Hash}`;
      }
      throw new Error('No hash returned from upload service');
    } catch (e) {
      console.error('Upload error:', e);
      if (typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast('Upload failed — try a smaller file or try again');
      } else {
        alert('Failed to upload file: ' + e.message);
      }
      return null;
    }
  },

  refreshMediaGrid(gridId, urls, prefix) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const thumbs = urls.map((url, i) => {
      const isVid = url.match(/\.(mp4|mov|webm)/i);
      return `
        <div class="ut-media-thumb" data-idx="${i}">
          ${isVid
            ? `<video src="${url}" class="ut-media-thumb-img"></video>`
            : `<img src="${url}" class="ut-media-thumb-img" />`
          }
          <button class="ut-media-remove" data-idx="${i}">✕</button>
        </div>
      `;
    }).join('');

    const maxItems = prefix === 'post' ? 10 : 5;
    const addBtn = urls.length < maxItems ? `
      <div class="ut-media-add" id="ut-${prefix}-media-add">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <input type="file" id="ut-${prefix}-media-input" accept="image/*,video/*" multiple style="display:none" />
      </div>
    ` : '';

    grid.innerHTML = thumbs + addBtn;

    // Rebind add button
    grid.querySelector(`#ut-${prefix}-media-add`)?.addEventListener('click', () => {
      grid.querySelector(`#ut-${prefix}-media-input`)?.click();
    });
    grid.querySelector(`#ut-${prefix}-media-input`)?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const targetArr = prefix === 'post' ? this._postMediaUrls : this._rewardMediaUrls;
      for (const file of files.slice(0, maxItems - targetArr.length)) {
        const url = await this.uploadFile(file);
        if (url) targetArr.push(url);
      }
      this.refreshMediaGrid(gridId, targetArr, prefix);
    });
  },

  // ─── STYLES ────────────────────────────────────────────

  getStyles() {
    return `<style>
      /* Loading & Error */
      .ut-loading { text-align:center; padding:40px; color:var(--text-muted); }
      .ut-loading-sm { text-align:center; padding:20px; }
      .ut-error { text-align:center; padding:40px; color:var(--error); }
      .ut-empty-sm { color:var(--text-muted); font-size:13px; padding:12px 0; }

      /* Dashboard */
      .ut-dashboard { max-width:800px; margin:0 auto; }
      .ut-setup-banner {
        display:flex; align-items:center; gap:20px; padding:24px;
        background:linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1));
        border:1px solid rgba(139,92,246,0.3); border-radius:16px; margin-bottom:24px;
      }
      .ut-setup-icon { font-size:40px; }
      .ut-setup-info { flex:1; }
      .ut-setup-title { font-size:18px; font-weight:700; margin-bottom:4px; }
      .ut-setup-desc { font-size:14px; color:var(--text-muted); }
      @media(max-width:600px) { .ut-setup-banner { flex-direction:column; text-align:center; } }

      /* Action Grid */
      .ut-action-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px; }
      @media(max-width:600px) { .ut-action-grid { grid-template-columns:1fr; } }
      .ut-action-card {
        display:flex; flex-direction:column; align-items:center; gap:10px;
        padding:28px 16px; background:var(--bg-secondary, rgba(255,255,255,0.03));
        border:1px solid var(--border-color); border-radius:16px;
        cursor:pointer; transition:all 0.2s; text-align:center;
      }
      .ut-action-card:hover { background:var(--bg-hover); border-color:var(--accent); transform:translateY(-2px); }
      .ut-action-icon { font-size:32px; }
      .ut-action-title { font-size:15px; font-weight:700; }
      .ut-action-desc { font-size:12px; color:var(--text-muted); }

      /* Stats row */
      .ut-stats-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
      .ut-stat {
        padding:10px 16px; background:var(--bg-secondary, rgba(255,255,255,0.03));
        border:1px solid var(--border-color); border-radius:12px;
        font-size:13px; color:var(--text-secondary);
      }
      .ut-stat-clickable { cursor:pointer; transition:all 0.15s; }
      .ut-stat-clickable:hover { border-color:var(--accent); background:var(--bg-hover); }
      .ut-stat-num { font-weight:700; color:var(--accent); margin-right:4px; }

      /* Sections */
      .ut-section { margin-bottom:28px; }
      .ut-section-title { font-size:16px; font-weight:700; margin-bottom:12px; }

      /* Claims */
      .ut-claims-list { display:flex; flex-direction:column; gap:4px; }
      .ut-claim-row {
        display:flex; justify-content:space-between; align-items:center;
        padding:10px 16px; background:var(--bg-secondary, rgba(255,255,255,0.02));
        border-radius:10px; font-size:13px;
      }
      .ut-claim-info { display:flex; gap:6px; flex-wrap:wrap; }
      .ut-claim-name { font-weight:600; color:var(--text-primary); }
      .ut-claim-action { color:var(--text-muted); }
      .ut-claim-reward { color:var(--accent); }
      .ut-claim-time { color:var(--text-muted); font-size:12px; white-space:nowrap; }

      /* Settings Card */
      .ut-settings-card {
        padding:20px; background:var(--bg-secondary, rgba(255,255,255,0.02));
        border:1px solid var(--border-color); border-radius:14px;
      }
      .ut-setting-row { margin-bottom:16px; }
      .ut-setting-label { font-size:13px; font-weight:600; color:var(--text-muted); margin-bottom:6px; }

      /* Gear button for settings toggle */
      .ut-gear-btn {
        width:36px; height:36px; border:1px solid var(--border-color); border-radius:10px;
        background:transparent; font-size:18px; cursor:pointer; transition:all 0.15s;
        display:flex; align-items:center; justify-content:center;
      }
      .ut-gear-btn:hover { background:var(--bg-hover); border-color:var(--accent); }

      /* Inline settings panel (collapsible) */
      .ut-inline-settings {
        margin-bottom:20px; padding:16px 20px;
        background:var(--bg-secondary, rgba(255,255,255,0.02));
        border:1px solid var(--border-color); border-radius:14px;
        animation:utSlideDown 0.15s ease;
      }
      @keyframes utSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      .ut-inline-settings-header {
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;
      }
      .ut-inline-settings-title { font-size:14px; font-weight:700; }
      .ut-inline-settings-close {
        width:28px; height:28px; border:none; border-radius:50%;
        background:rgba(255,255,255,0.06); color:var(--text-muted);
        font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;
        transition:all 0.15s;
      }
      .ut-inline-settings-close:hover { background:rgba(255,255,255,0.12); color:var(--text-primary); }
      .ut-select-sm { padding:8px 10px; font-size:13px; }
      .ut-input-sm { padding:8px 10px; font-size:13px; }

      /* Forms */
      .ut-page { max-width:680px; margin:0 auto; }
      .ut-page-header { display:flex; align-items:center; gap:16px; margin-bottom:24px; }
      .ut-page-title { font-size:22px; font-weight:700; flex:1; }
      .ut-back-btn {
        padding:8px 14px; border:1px solid var(--border-color); border-radius:10px;
        background:transparent; color:var(--text-secondary); font-size:13px;
        cursor:pointer; transition:all 0.15s; white-space:nowrap;
      }
      .ut-back-btn:hover { background:var(--bg-hover); color:var(--text-primary); }
      .ut-form { display:flex; flex-direction:column; gap:20px; }
      .ut-form-group { display:flex; flex-direction:column; gap:6px; }
      .ut-label { font-size:13px; font-weight:700; color:var(--text-secondary); }
      .ut-label-hint { font-weight:400; color:var(--text-muted); }
      .ut-input, .ut-textarea, .ut-select {
        width:100%; padding:12px 14px; background:var(--bg-hover, rgba(255,255,255,0.04));
        border:1px solid var(--border-color); border-radius:10px;
        color:var(--text-primary); font-size:14px; outline:none;
        transition:border-color 0.2s; box-sizing:border-box;
      }
      .ut-input:focus, .ut-textarea:focus, .ut-select:focus { border-color:var(--accent); }
      .ut-textarea { resize:vertical; font-family:inherit; }
      .ut-select { cursor:pointer; }

      /* Upload zone */
      .ut-upload-zone {
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
        padding:32px; border:2px dashed var(--border-color); border-radius:14px;
        cursor:pointer; transition:all 0.2s; color:var(--text-muted);
        min-height:120px; text-align:center;
      }
      .ut-upload-zone:hover { border-color:var(--accent); background:rgba(139,92,246,0.05); }
      .ut-upload-preview { max-width:100%; max-height:200px; border-radius:10px; object-fit:contain; }

      /* Media grid */
      .ut-media-grid { display:flex; gap:10px; flex-wrap:wrap; }
      .ut-media-thumb {
        position:relative; width:80px; height:80px; border-radius:10px;
        overflow:hidden; border:1px solid var(--border-color);
      }
      .ut-media-thumb-img { width:100%; height:100%; object-fit:cover; }
      .ut-media-remove {
        position:absolute; top:4px; right:4px; width:20px; height:20px;
        border:none; border-radius:50%; background:rgba(0,0,0,0.7); color:white;
        font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      }
      .ut-media-add {
        width:80px; height:80px; border:2px dashed var(--border-color); border-radius:10px;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; transition:all 0.2s; color:var(--text-muted);
      }
      .ut-media-add:hover { border-color:var(--accent); }

      /* NFT Picker */
      .ut-nft-picker { display:flex; gap:16px; flex-wrap:wrap; }
      .ut-radio-label { display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer; }
      .ut-checkbox-label { display:flex; align-items:center; gap:10px; font-size:14px; cursor:pointer; padding:6px 0; }
      .ut-release-checklist {
        max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;
        padding:12px; background:var(--bg-secondary, rgba(255,255,255,0.02));
        border:1px solid var(--border-color); border-radius:10px; margin-top:8px;
      }
      .ut-release-thumb { width:32px; height:32px; border-radius:6px; object-fit:cover; flex-shrink:0; }
      .ut-duration-row { display:flex; gap:16px; flex-wrap:wrap; }
      .ut-link-btn {
        padding:0; border:none; background:none; color:var(--accent);
        font-size:13px; cursor:pointer; text-decoration:underline;
      }
      .ut-form-actions { display:flex; gap:12px; justify-content:flex-end; padding-top:8px; }

      /* Content Feed Grid */
      .ut-feed-grid {
        display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;
      }
      @media(max-width:600px) { .ut-feed-grid { grid-template-columns:repeat(2, 1fr); } }
      .ut-grid-card { position:relative; cursor:pointer; overflow:hidden; border-radius:4px; }
      .ut-grid-card::before { content:''; display:block; padding-top:100%; }
      .ut-grid-card-media { position:absolute; inset:0; }
      .ut-grid-card-img { width:100%; height:100%; object-fit:cover; }
      .ut-grid-card-text-preview {
        padding:16px; font-size:13px; color:var(--text-secondary); line-height:1.5;
        background:var(--bg-secondary, rgba(255,255,255,0.03)); height:100%;
        overflow:hidden;
      }
      .ut-grid-card-multi {
        position:absolute; top:8px; right:8px; padding:3px 8px;
        background:rgba(0,0,0,0.7); border-radius:6px; font-size:11px; color:white;
      }
      .ut-grid-card-key {
        position:absolute; bottom:8px; right:8px; padding:3px 8px;
        background:rgba(0,0,0,0.7); border-radius:6px; font-size:11px;
      }
      .ut-grid-card-pin {
        position:absolute; top:8px; left:8px; font-size:14px;
      }
      .ut-grid-card:hover { opacity:0.85; }

      /* Post Detail Overlay */
      .ut-post-overlay {
        position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; animation:utFadeIn 0.15s ease;
      }
      @keyframes utFadeIn { from{opacity:0} to{opacity:1} }
      .ut-post-modal {
        background:var(--bg-primary, #16162a); border:1px solid var(--border-color);
        border-radius:16px; width:92%; max-width:600px; max-height:90vh;
        overflow-y:auto; position:relative;
      }
      .ut-post-close {
        position:absolute; top:12px; right:12px; z-index:10;
        width:32px; height:32px; border:none; border-radius:50%;
        background:rgba(0,0,0,0.5); color:white; font-size:16px;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
      }

      /* Carousel */
      .ut-carousel { position:relative; overflow:hidden; background:#000; }
      .ut-carousel-track { display:flex; transition:transform 0.3s ease; }
      .ut-carousel-slide { flex-shrink:0; }
      .ut-carousel-media { width:100%; max-height:500px; object-fit:contain; display:block; }
      .ut-carousel-prev, .ut-carousel-next {
        position:absolute; top:50%; transform:translateY(-50%);
        width:36px; height:36px; border:none; border-radius:50%;
        background:rgba(0,0,0,0.6); color:white; font-size:20px;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        z-index:5;
      }
      .ut-carousel-prev { left:8px; }
      .ut-carousel-next { right:8px; }
      .ut-carousel-dots { display:flex; justify-content:center; gap:6px; padding:10px; }
      .ut-carousel-dot {
        width:8px; height:8px; border-radius:50%;
        background:rgba(255,255,255,0.3); cursor:pointer; transition:background 0.2s;
      }
      .ut-carousel-dot.active { background:white; }

      /* Post Body */
      .ut-post-body { padding:20px; }
      .ut-post-content { font-size:15px; line-height:1.6; white-space:pre-wrap; margin-bottom:12px; }
      .ut-post-meta { font-size:12px; color:var(--text-muted); margin-bottom:16px; }
      .ut-post-owner-actions { display:flex; gap:16px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border-color); }

      /* Comments */
      .ut-comments-section { border-top:1px solid var(--border-color); padding-top:16px; }
      .ut-comments-title { font-size:14px; font-weight:700; margin-bottom:12px; }
      .ut-comments-list { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; max-height:300px; overflow-y:auto; }
      .ut-comment { font-size:14px; line-height:1.4; }
      .ut-comment-name { font-weight:700; margin-right:6px; }
      .ut-comment-text { color:var(--text-secondary); }
      .ut-comment-time { color:var(--text-muted); font-size:11px; margin-left:6px; }
      .ut-comment-form { display:flex; gap:8px; }
      .ut-comment-form .ut-input { flex:1; padding:10px 12px; }

      /* Rewards Grid */
      .ut-rewards-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:16px; }
      .ut-reward-card {
        background:var(--bg-secondary, rgba(255,255,255,0.03));
        border:1px solid var(--border-color); border-radius:14px; overflow:hidden;
      }
      .ut-reward-card-img { width:100%; height:180px; object-fit:cover; }
      .ut-reward-card-placeholder {
        height:120px; display:flex; align-items:center; justify-content:center;
        font-size:40px; background:rgba(139,92,246,0.08);
      }
      .ut-reward-card-body { padding:16px; }
      .ut-reward-card-title { font-size:16px; font-weight:700; margin-bottom:4px; }
      .ut-reward-card-type {
        font-size:11px; font-weight:600; text-transform:uppercase;
        color:var(--accent); letter-spacing:0.5px; margin-bottom:8px;
      }
      .ut-reward-card-desc { font-size:13px; color:var(--text-muted); margin-bottom:10px; line-height:1.4; }
      .ut-reward-card-meta { font-size:12px; color:var(--text-muted); }

      /* Holder View */
      .ut-holder-page { max-width:680px; margin:0 auto; }
      .ut-welcome-msg {
        padding:16px 20px; background:linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.05));
        border:1px solid rgba(139,92,246,0.2); border-radius:12px;
        font-size:14px; color:var(--text-secondary); margin-bottom:20px;
      }
      .ut-sub-tabs { display:flex; gap:4px; margin-bottom:20px; }
      .ut-sub-tab {
        padding:10px 20px; border:none; border-radius:10px;
        background:transparent; color:var(--text-muted);
        font-size:14px; font-weight:600; cursor:pointer; transition:all 0.15s;
      }
      .ut-sub-tab:hover { color:var(--text-secondary); }
      .ut-sub-tab.active { background:var(--bg-hover); color:var(--text-primary); }

      /* Locked View */
      .ut-locked-page { text-align:center; padding:60px 20px; }
      .ut-locked-icon { font-size:64px; margin-bottom:16px; }
      .ut-locked-title { font-size:24px; font-weight:700; margin-bottom:8px; }
      .ut-locked-desc { color:var(--text-muted); font-size:15px; margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto; }
      .ut-locked-stats { display:flex; gap:16px; justify-content:center; margin-bottom:24px; font-size:13px; color:var(--text-muted); }

      /* Page layout */
      .ut-page-wide { max-width:800px; }
      .ut-header-actions { display:flex; gap:8px; align-items:center; flex-shrink:0; }

      /* Gear button */
      .ut-gear-btn {
        width:36px; height:36px; border:1px solid var(--border-color); border-radius:10px;
        background:transparent; font-size:18px; cursor:pointer; transition:all 0.15s;
        display:flex; align-items:center; justify-content:center; flex-shrink:0;
      }
      .ut-gear-btn:hover { background:var(--bg-hover); border-color:var(--accent); }

      /* Inline settings panel */
      .ut-inline-settings {
        margin-bottom:20px; padding:16px 20px;
        background:var(--bg-secondary, rgba(255,255,255,0.02));
        border:1px solid var(--border-color); border-radius:14px;
        animation:utSlideDown 0.15s ease;
      }
      @keyframes utSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      .ut-inline-settings-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
      .ut-inline-settings-title { font-size:14px; font-weight:700; }
      .ut-inline-settings-close {
        width:28px; height:28px; border:none; border-radius:50%;
        background:rgba(255,255,255,0.06); color:var(--text-muted);
        font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      }
      .ut-inline-settings-close:hover { background:rgba(255,255,255,0.12); color:var(--text-primary); }
      .ut-select-sm, .ut-input-sm { padding:8px 10px; font-size:13px; }

      /* Owner Rewards List (big cards) */
      .ut-owner-rewards-grid { display:flex; flex-direction:column; gap:16px; }
      .ut-owner-reward-card {
        display:flex; gap:0;
        background:var(--bg-secondary, rgba(255,255,255,0.03));
        border:1px solid var(--border-color); border-radius:16px; overflow:hidden;
        transition:border-color 0.15s;
      }
      .ut-owner-reward-card:hover { border-color:var(--accent); }
      .ut-owner-reward-img-wrap { position:relative; width:200px; min-height:180px; flex-shrink:0; }
      @media(max-width:600px) {
        .ut-owner-reward-card { flex-direction:column; }
        .ut-owner-reward-img-wrap { width:100%; min-height:160px; }
      }
      .ut-owner-reward-img { width:100%; height:100%; object-fit:cover; }
      .ut-owner-reward-placeholder {
        width:100%; height:100%; display:flex; align-items:center; justify-content:center;
        font-size:48px; background:rgba(139,92,246,0.08);
      }
      .ut-owner-reward-status {
        position:absolute; top:10px; left:10px; padding:4px 10px;
        border-radius:8px; font-size:11px; font-weight:700; color:white; text-transform:uppercase;
      }
      .ut-owner-reward-body { padding:20px; flex:1; display:flex; flex-direction:column; }
      .ut-owner-reward-title { font-size:18px; font-weight:700; margin-bottom:4px; }
      .ut-owner-reward-type {
        font-size:11px; font-weight:600; text-transform:uppercase;
        color:var(--accent); letter-spacing:0.5px; margin-bottom:10px;
      }
      .ut-owner-reward-desc { font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:12px; flex:1; }
      .ut-owner-reward-meta { font-size:12px; color:var(--text-muted); margin-bottom:14px; }
      .ut-owner-reward-actions { display:flex; gap:8px; align-items:center; }

      /* Empty State */
      .ut-empty-state { text-align:center; padding:40px 20px; }
      .ut-empty-icon { font-size:48px; margin-bottom:12px; }
      .ut-empty-state h3 { margin-bottom:8px; }
      .ut-empty-state p { color:var(--text-muted); font-size:14px; margin-bottom:16px; }
    </style>`;
  },
};
