/**
 * XRP Music - Modals
 * Auth, Release, Create, Edit Profile modals
 */

const Modals = {
  activeModal: null,
  
  /**
   * Show modal
   */
  show(html) {
    const container = document.getElementById('modals');
    if (!container) return;
    
    container.innerHTML = html;
    
    // Trigger animation
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    
    // Bind close events
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.close();
      }
    });
    
    container.querySelectorAll('.modal-close, .close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // ESC key to close
    document.addEventListener('keydown', this.handleEsc);
  },
  
  /**
   * Close modal
   */
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
    
    document.removeEventListener('keydown', this.handleEsc);
    this.activeModal = null;
  },
  
  /**
   * Handle ESC key
   */
  handleEsc(e) {
    if (e.key === 'Escape') {
      Modals.close();
    }
  },
  
  /**
   * Show auth modal
   */
  showAuth() {
    this.activeModal = 'auth';
    
    const html = `
      <div class="modal-overlay auth-modal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">Connect Wallet</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="auth-header">
              <div class="auth-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <span class="auth-brand">XRP Music</span>
            </div>
            
            <h3 class="auth-title">Welcome</h3>
            <p class="auth-description">Connect your Xaman wallet to stream music, create releases, and collect NFTs on the XRP Ledger.</p>
            
            <button class="xaman-btn" id="xaman-connect-btn">
              <img src="https://xumm.app/assets/icons/icon-512.png" alt="Xaman">
              <div class="xaman-btn-info">
                <span class="xaman-btn-title">Connect with Xaman</span>
                <span class="xaman-btn-subtitle">Secure XRPL wallet</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            
            <div class="auth-info">
              <div class="auth-info-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div class="auth-info-text">
                  <h4>Don't have Xaman?</h4>
                  <p>Download the free Xaman wallet app for <a href="https://apps.apple.com/app/xaman/id1492302343" target="_blank">iOS</a> or <a href="https://play.google.com/store/apps/details?id=com.xrpllabs.xumm" target="_blank">Android</a>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    // Bind connect button
    document.getElementById('xaman-connect-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('xaman-connect-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <div class="spinner"></div>
          <div class="xaman-btn-info">
            <span class="xaman-btn-title">Connecting...</span>
            <span class="xaman-btn-subtitle">Check your Xaman app</span>
          </div>
        `;
      }
      
      await XamanWallet.connect();
      
      // If connected successfully, close modal
      if (XamanWallet.isConnected()) {
        this.close();
      } else if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <img src="https://xumm.app/assets/icons/icon-512.png" alt="Xaman">
          <div class="xaman-btn-info">
            <span class="xaman-btn-title">Connect with Xaman</span>
            <span class="xaman-btn-subtitle">Secure XRPL wallet</span>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;
      }
    });
  },
  
  /**
   * Show release modal
   */
  showRelease(release) {
    this.activeModal = 'release';
    
    const available = release.totalEditions - release.soldEditions;
    const isSoldOut = available <= 0;
    const price = release.albumPrice || release.songPrice;
    
    const html = `
      <div class="modal-overlay">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <div class="modal-title">${release.title}</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <!-- Cover -->
            <div style="aspect-ratio: 1; background: var(--bg-hover); position: relative;">
              ${release.coverUrl 
                ? `<img src="${release.coverUrl}" alt="${release.title}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                      <path d="M9 18V5l12-2v13"></path>
                      <circle cx="6" cy="18" r="3"></circle>
                      <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                  </div>`
              }
              <span class="release-type-badge ${release.type}" style="position: absolute; top: 16px; left: 16px;">${release.type}</span>
            </div>
            
            <!-- Info -->
            <div style="padding: 24px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <button class="artist-link" data-artist="${release.artistAddress}" style="display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; color: var(--text-secondary);">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                    ${(release.artistName || 'A')[0].toUpperCase()}
                  </div>
                  <span>${release.artistName || Helpers.truncateAddress(release.artistAddress)}</span>
                </button>
              </div>
              
              ${release.description ? `<p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">${release.description}</p>` : ''}
              
              <!-- Price & Availability -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-hover); border-radius: var(--radius-lg); margin-bottom: 16px;">
                <div>
                  <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${price} XRP</div>
                  <div style="font-size: 13px; color: var(--text-muted);">per ${release.type === 'album' ? 'album' : 'track'}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 600; color: ${isSoldOut ? 'var(--error)' : available < 10 ? 'var(--warning)' : 'var(--text-primary)'};">
                    ${isSoldOut ? 'Sold Out' : `${available} / ${release.totalEditions}`}
                  </div>
                  <div style="font-size: 13px; color: var(--text-muted);">available</div>
                </div>
              </div>
              
              <!-- Tracks -->
              ${release.tracks?.length > 0 ? `
                <div style="margin-bottom: 16px;">
                  <h4 style="font-size: 14px; font-weight: 600; color: var(--text-muted); margin-bottom: 12px;">TRACKS</h4>
                  <div class="track-list" style="border-radius: var(--radius-lg);">
                    ${release.tracks.map((track, idx) => `
                      <div class="track-item modal-track" data-track-idx="${idx}" style="cursor: pointer;">
                        <div style="width: 32px; text-align: center; color: var(--text-muted);">${idx + 1}</div>
                        <div class="track-info">
                          <div class="track-title">${release.type === 'single' ? release.title : track.title}</div>
                        </div>
                        <div style="color: var(--text-muted);">${Helpers.formatDuration(track.duration)}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
              <!-- Actions -->
              <div style="display: flex; gap: 12px;">
                <button class="btn btn-primary" style="flex: 1;" id="play-release-btn" ${isSoldOut && !release.tracks?.length ? 'disabled' : ''}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Play
                </button>
                ${!isSoldOut ? `
                  <button class="btn btn-secondary" style="flex: 1;" id="buy-release-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    Buy NFT
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    this.bindReleaseEvents(release);
  },
  
  bindReleaseEvents(release) {
    // Play button
    document.getElementById('play-release-btn')?.addEventListener('click', () => {
      if (release.tracks?.length > 0) {
        StreamPage.playRelease(release);
        this.close();
      }
    });
    
    // Track items
    document.querySelectorAll('.modal-track').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.trackIdx, 10);
        if (release.tracks?.[idx]) {
          const track = release.tracks[idx];
          const playTrack = {
            id: parseInt(track.id) || idx,
            trackId: track.id,
            title: release.type === 'single' ? release.title : track.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl,
            ipfsHash: track.audioCid,
            audioUrl: track.audioUrl,
            releaseId: release.id,
            duration: track.duration,
          };
          
          const queue = release.tracks.map((t, i) => ({
            id: parseInt(t.id) || i,
            trackId: t.id,
            title: release.type === 'single' ? release.title : t.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl,
            ipfsHash: t.audioCid,
            audioUrl: t.audioUrl,
            releaseId: release.id,
            duration: t.duration,
          }));
          
          Player.playTrack(playTrack, queue, idx);
        }
      });
    });
    
    // Buy button
    document.getElementById('buy-release-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) {
        this.close();
        this.showAuth();
        return;
      }
      // TODO: Implement buy flow
      alert('Buy feature coming soon!');
    });
    
    // Artist link
    document.querySelector('.artist-link')?.addEventListener('click', () => {
      const address = document.querySelector('.artist-link').dataset.artist;
      this.close();
      Router.navigate('artist', { address });
    });
  },
  
  /**
   * Show create release modal
   */
  showCreate() {
    if (!AppState.user?.address) {
      this.showAuth();
      return;
    }
    
    this.activeModal = 'create';
    
    const html = `
      <div class="modal-overlay">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <div class="modal-title">Create Release</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
              Upload your music and mint it as an NFT on the XRP Ledger. Fans can purchase and collect your releases.
            </p>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <button class="create-option" data-type="single">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--success), #10b981); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                  </svg>
                </div>
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">Single</h3>
                <p style="font-size: 13px; color: var(--text-muted);">One track release</p>
              </button>
              
              <button class="create-option" data-type="album">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #a855f7, #ec4899); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                    <circle cx="12" cy="12" r="4"></circle>
                    <circle cx="12" cy="12" r="1"></circle>
                  </svg>
                </div>
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">Album / EP</h3>
                <p style="font-size: 13px; color: var(--text-muted);">Multiple tracks</p>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .create-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-xl);
          background: var(--bg-card);
          cursor: pointer;
          transition: all 150ms;
        }
        .create-option:hover {
          border-color: var(--accent);
          background: var(--bg-hover);
        }
      </style>
    `;
    
    this.show(html);
    
    // Bind create options
    document.querySelectorAll('.create-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.showCreateForm(type);
      });
    });
  },
  
  /**
   * Show create form (placeholder)
   */
  showCreateForm(type) {
    // TODO: Implement full create form
    alert(`Create ${type} - Coming soon!`);
  },
  
  /**
   * Show edit profile modal
   */
  showEditProfile() {
    if (!AppState.user?.address) return;
    
    this.activeModal = 'edit-profile';
    const profile = AppState.profile || {};
    
    const html = `
      <div class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <div class="modal-title">Edit Profile</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <form id="edit-profile-form">
              <div class="form-group">
                <label class="form-label">Display Name</label>
                <input type="text" class="form-input" name="name" value="${profile.name || ''}" placeholder="Your artist name">
              </div>
              
              <div class="form-group">
                <label class="form-label">Bio</label>
                <textarea class="form-input form-textarea" name="bio" placeholder="Tell us about yourself">${profile.bio || ''}</textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label">Website</label>
                <input type="url" class="form-input" name="website" value="${profile.website || ''}" placeholder="https://yoursite.com">
              </div>
              
              <div class="form-group">
                <label class="form-label">Twitter Handle</label>
                <input type="text" class="form-input" name="twitter" value="${profile.twitter || ''}" placeholder="@username">
              </div>
              
              <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="button" class="btn btn-secondary close-modal-btn" style="flex: 1;">Cancel</button>
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    // Handle form submit
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const updates = {
        address: AppState.user.address,
        name: formData.get('name')?.trim() || null,
        bio: formData.get('bio')?.trim() || null,
        website: formData.get('website')?.trim() || null,
        twitter: formData.get('twitter')?.replace('@', '').trim() || null,
      };
      
      try {
        await API.saveProfile(updates);
        setProfile({ ...AppState.profile, ...updates });
        UI.updateUserCard();
        this.close();
        ProfilePage.render();
      } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile. Please try again.');
      }
    });
  },
};
