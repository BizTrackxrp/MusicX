/**
 * XRP Music - Modals
 * Auth, Release, Create, Edit Profile, Now Playing modals
 */

const Modals = {
  activeModal: null,
  nowPlayingInterval: null,
  
  show(html) {
    const container = document.getElementById('modals');
    if (!container) return;
    
    container.innerHTML = html;
    
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.close();
      }
    });
    
    container.querySelectorAll('.modal-close, .close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    document.addEventListener('keydown', this.handleEsc);
  },
  
  close() {
    const container = document.getElementById('modals');
    if (!container) return;
    
    if (this.nowPlayingInterval) {
      clearInterval(this.nowPlayingInterval);
      this.nowPlayingInterval = null;
    }
    
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
  
  handleEsc(e) {
    if (e.key === 'Escape') {
      Modals.close();
    }
  },
  
  async showNowPlaying() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    this.activeModal = 'now-playing';
    
    let release = AppState.releases.find(r => r.id === track.releaseId);
    
    if (!release && track.releaseId) {
      try {
        const data = await API.getRelease(track.releaseId);
        release = data?.release;
      } catch (e) {
        console.error('Failed to fetch release:', e);
      }
    }
    
    const isLiked = isTrackLiked(track.trackId || track.id?.toString());
    const available = release ? release.totalEditions - release.soldEditions : 0;
    const price = release ? (release.albumPrice || release.songPrice) : 0;
    
    const html = `
      <div class="modal-overlay now-playing-modal">
        <div class="modal now-playing-content">
          <button class="modal-close now-playing-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          <div class="now-playing-cover">
            <img src="${track.cover || '/placeholder.png'}" alt="${track.title}">
          </div>
          
          <div class="now-playing-info">
            <h1 class="now-playing-title">${track.title}</h1>
            <button class="now-playing-artist" data-artist="${release?.artistAddress || ''}">
              ${track.artist}
            </button>
          </div>
          
          <div class="now-playing-progress-section">
            <div class="now-playing-progress" id="np-progress">
              <div class="now-playing-progress-fill" id="np-progress-fill" style="width: ${AppState.player.progress}%"></div>
            </div>
            <div class="now-playing-times">
              <span id="np-current-time">${Helpers.formatDuration(Player.audio?.currentTime || 0)}</span>
              <span id="np-duration">${Helpers.formatDuration(AppState.player.duration || 0)}</span>
            </div>
          </div>
          
          <div class="now-playing-controls">
            <button class="np-control-btn ${AppState.player.isShuffled ? 'active' : ''}" id="np-shuffle-btn" title="Shuffle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
            <button class="np-control-btn" id="np-prev-btn" title="Previous">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5"></line>
              </svg>
            </button>
            <button class="np-play-btn" id="np-play-btn">
              ${AppState.player.isPlaying 
                ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
                : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
              }
            </button>
            <button class="np-control-btn" id="np-next-btn" title="Next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </button>
            <button class="np-control-btn ${AppState.player.isRepeat ? 'active' : ''}" id="np-repeat-btn" title="Repeat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </button>
          </div>
          
          <div class="now-playing-actions">
            <button class="np-action-btn ${isLiked ? 'liked' : ''}" id="np-like-btn" title="Like">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="np-action-btn" id="np-add-btn" title="Add to Playlist">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          
          ${release ? `
            <div class="now-playing-release">
              <div class="np-release-header">
                <span class="release-type-badge ${release.type}">${release.type}</span>
                <span class="np-release-title">${release.title}</span>
              </div>
              
              <div class="np-release-stats">
                <div class="np-stat">
                  <span class="np-stat-value">${price}</span>
                  <span class="np-stat-label">XRP</span>
                </div>
                <div class="np-stat">
                  <span class="np-stat-value">${available}</span>
                  <span class="np-stat-label">Available</span>
                </div>
                <div class="np-stat">
                  <span class="np-stat-value">${release.totalEditions}</span>
                  <span class="np-stat-label">Total</span>
                </div>
              </div>
              
              ${available > 0 ? `
                <button class="btn btn-primary np-buy-btn" id="np-buy-btn">Buy for ${price} XRP</button>
              ` : '<div class="np-sold-out">Sold Out</div>'}
              
              ${release.tracks && release.tracks.length > 1 ? `
                <div class="np-tracklist">
                  <h3 class="np-tracklist-title">All Tracks</h3>
                  <div class="np-tracks">
                    ${release.tracks.map((t, idx) => {
                      const isCurrentTrack = (t.id === track.id) || (t.id?.toString() === track.trackId);
                      return `
                        <div class="np-track-item ${isCurrentTrack ? 'playing' : ''}" data-track-idx="${idx}">
                          <span class="np-track-num">${isCurrentTrack ? '▶' : idx + 1}</span>
                          <span class="np-track-title">${release.type === 'single' ? release.title : t.title}</span>
                          <span class="np-track-duration">${Helpers.formatDuration(t.duration)}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
      
      <style>
        .now-playing-modal .modal { max-width: 420px; max-height: 90vh; overflow-y: auto; background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%); border-radius: var(--radius-2xl); }
        .now-playing-content { padding: 24px; padding-top: 48px; }
        .now-playing-close { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
        .now-playing-cover { width: 100%; aspect-ratio: 1; border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-xl); margin-bottom: 24px; }
        .now-playing-cover img { width: 100%; height: 100%; object-fit: cover; }
        .now-playing-info { text-align: center; margin-bottom: 24px; }
        .now-playing-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .now-playing-artist { font-size: 16px; color: var(--text-secondary); background: none; border: none; cursor: pointer; transition: color 150ms; }
        .now-playing-artist:hover { color: var(--accent); }
        .now-playing-progress-section { margin-bottom: 16px; }
        .now-playing-progress { height: 4px; background: var(--border-color); border-radius: 2px; cursor: pointer; overflow: hidden; }
        .now-playing-progress-fill { height: 100%; background: var(--accent); transition: width 100ms linear; }
        .now-playing-times { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
        .now-playing-controls { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 24px; }
        .np-control-btn { padding: 8px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: all 150ms; }
        .np-control-btn:hover { color: var(--text-primary); }
        .np-control-btn.active { color: var(--accent); }
        .np-play-btn { width: 64px; height: 64px; border-radius: 50%; background: var(--accent); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 150ms, background 150ms; }
        .np-play-btn:hover { transform: scale(1.05); background: var(--accent-hover); }
        .now-playing-actions { display: flex; justify-content: center; gap: 24px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color); }
        .np-action-btn { padding: 12px; background: var(--bg-hover); border: none; border-radius: 50%; color: var(--text-secondary); cursor: pointer; transition: all 150ms; }
        .np-action-btn:hover { background: var(--border-color); color: var(--text-primary); }
        .np-action-btn.liked { color: var(--error); }
        .now-playing-release { background: var(--bg-card); border-radius: var(--radius-xl); padding: 16px; }
        .np-release-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .np-release-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .np-release-stats { display: flex; justify-content: space-around; margin-bottom: 16px; }
        .np-stat { text-align: center; }
        .np-stat-value { display: block; font-size: 20px; font-weight: 700; color: var(--accent); }
        .np-stat-label { font-size: 12px; color: var(--text-muted); }
        .np-buy-btn { width: 100%; margin-bottom: 16px; }
        .np-sold-out { text-align: center; padding: 12px; background: var(--bg-hover); border-radius: var(--radius-lg); color: var(--error); font-weight: 600; margin-bottom: 16px; }
        .np-tracklist { border-top: 1px solid var(--border-color); padding-top: 16px; }
        .np-tracklist-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; }
        .np-track-item { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: var(--radius-md); cursor: pointer; transition: background 150ms; }
        .np-track-item:hover { background: var(--bg-hover); }
        .np-track-item.playing { background: rgba(59, 130, 246, 0.1); }
        .np-track-item.playing .np-track-title { color: var(--accent); }
        .np-track-num { width: 20px; font-size: 13px; color: var(--text-muted); text-align: center; }
        .np-track-title { flex: 1; font-size: 14px; color: var(--text-primary); }
        .np-track-duration { font-size: 13px; color: var(--text-muted); }
      </style>
    `;
    
    this.show(html);
    this.bindNowPlayingEvents(release);
    this.startNowPlayingUpdates();
  },
  
  bindNowPlayingEvents(release) {
    document.getElementById('np-play-btn')?.addEventListener('click', () => {
      Player.togglePlay();
      this.updateNowPlayingPlayButton();
    });
    
    document.getElementById('np-prev-btn')?.addEventListener('click', () => {
      Player.previous();
      setTimeout(() => this.showNowPlaying(), 300);
    });
    document.getElementById('np-next-btn')?.addEventListener('click', () => {
      Player.next();
      setTimeout(() => this.showNowPlaying(), 300);
    });
    
    document.getElementById('np-shuffle-btn')?.addEventListener('click', () => {
      Player.toggleShuffle();
      document.getElementById('np-shuffle-btn')?.classList.toggle('active', AppState.player.isShuffled);
    });
    document.getElementById('np-repeat-btn')?.addEventListener('click', () => {
      Player.toggleRepeat();
      document.getElementById('np-repeat-btn')?.classList.toggle('active', AppState.player.isRepeat);
    });
    
    document.getElementById('np-like-btn')?.addEventListener('click', async () => {
      await Player.toggleLike();
      const track = AppState.player.currentTrack;
      const isLiked = isTrackLiked(track?.trackId || track?.id?.toString());
      const btn = document.getElementById('np-like-btn');
      if (btn) {
        btn.classList.toggle('liked', isLiked);
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
      }
    });
    
    document.getElementById('np-progress')?.addEventListener('click', (e) => {
      if (!Player.audio?.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      Player.audio.currentTime = percent * Player.audio.duration;
    });
    
    document.querySelector('.now-playing-artist')?.addEventListener('click', () => {
      const artistAddress = document.querySelector('.now-playing-artist')?.dataset.artist;
      if (artistAddress) {
        this.close();
        Router.navigate('artist', { address: artistAddress });
      }
    });
    
    document.getElementById('np-buy-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) {
        this.close();
        this.showAuth();
        return;
      }
      alert('Buy feature coming soon!');
    });
    
    if (release?.tracks) {
      document.querySelectorAll('.np-track-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.trackIdx, 10);
          const t = release.tracks[idx];
          if (t) {
            const playTrack = {
              id: parseInt(t.id) || idx,
              trackId: t.id?.toString(),
              title: release.type === 'single' ? release.title : t.title,
              artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
              cover: release.coverUrl,
              ipfsHash: t.audioCid,
              releaseId: release.id,
              duration: t.duration,
            };
            
            const queue = release.tracks.map((tr, i) => ({
              id: parseInt(tr.id) || i,
              trackId: tr.id?.toString(),
              title: release.type === 'single' ? release.title : tr.title,
              artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
              cover: release.coverUrl,
              ipfsHash: tr.audioCid,
              releaseId: release.id,
              duration: tr.duration,
            }));
            
            Player.playTrack(playTrack, queue, idx);
            
            document.querySelectorAll('.np-track-item').forEach((el, i) => {
              el.classList.toggle('playing', i === idx);
              el.querySelector('.np-track-num').textContent = i === idx ? '▶' : i + 1;
            });
          }
        });
      });
    }
  },
  
  startNowPlayingUpdates() {
    this.nowPlayingInterval = setInterval(() => {
      if (this.activeModal !== 'now-playing') {
        clearInterval(this.nowPlayingInterval);
        return;
      }
      
      const progress = AppState.player.progress;
      const fill = document.getElementById('np-progress-fill');
      const currentTime = document.getElementById('np-current-time');
      const duration = document.getElementById('np-duration');
      
      if (fill) fill.style.width = `${progress}%`;
      if (currentTime) currentTime.textContent = Helpers.formatDuration(Player.audio?.currentTime || 0);
      if (duration) duration.textContent = Helpers.formatDuration(Player.audio?.duration || 0);
    }, 200);
  },
  
  updateNowPlayingPlayButton() {
    const btn = document.getElementById('np-play-btn');
    if (!btn) return;
    btn.innerHTML = AppState.player.isPlaying 
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  },

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
            <h3 class="auth-title">Welcome to XRP Music</h3>
            <p class="auth-description">Connect your Xaman wallet to stream, create, and collect music NFTs.</p>
            
            <button class="xaman-btn" id="xaman-connect-btn">
              <img src="https://xumm.app/assets/icons/icon-512.png" alt="Xaman">
              <div class="xaman-btn-info">
                <span class="xaman-btn-title">Connect with Xaman</span>
                <span class="xaman-btn-subtitle">Secure XRPL wallet</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    document.getElementById('xaman-connect-btn')?.addEventListener('click', async () => {
      await XamanWallet.connect();
      if (XamanWallet.isConnected()) {
        this.close();
      }
    });
  },
  
  showRelease(release) {
    this.activeModal = 'release';
    
    const available = release.totalEditions - release.soldEditions;
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
            <div style="aspect-ratio: 1; background: var(--bg-hover);">
              ${release.coverUrl ? `<img src="${release.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
            </div>
            <div style="padding: 24px;">
              <button class="artist-link" data-artist="${release.artistAddress}" style="display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; color: var(--text-secondary); margin-bottom: 16px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                  ${(release.artistName || 'A')[0].toUpperCase()}
                </div>
                <span>${release.artistName || Helpers.truncateAddress(release.artistAddress)}</span>
              </button>
              
              <div style="display: flex; justify-content: space-between; padding: 16px; background: var(--bg-hover); border-radius: var(--radius-lg); margin-bottom: 16px;">
                <div><div style="font-size: 24px; font-weight: 700; color: var(--accent);">${price} XRP</div></div>
                <div style="text-align: right;"><div style="font-size: 18px; font-weight: 600;">${available} / ${release.totalEditions}</div><div style="font-size: 13px; color: var(--text-muted);">available</div></div>
              </div>
              
              ${release.tracks?.length > 0 ? `
                <div style="margin-bottom: 16px;">
                  <h4 style="font-size: 14px; color: var(--text-muted); margin-bottom: 12px;">TRACKS</h4>
                  <div class="track-list">
                    ${release.tracks.map((track, idx) => `
                      <div class="track-item modal-track" data-track-idx="${idx}" style="cursor: pointer;">
                        <div style="width: 32px; text-align: center; color: var(--text-muted);">${idx + 1}</div>
                        <div class="track-info"><div class="track-title">${release.type === 'single' ? release.title : track.title}</div></div>
                        <div style="color: var(--text-muted);">${Helpers.formatDuration(track.duration)}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
              <div style="display: flex; gap: 12px;">
                <button class="btn btn-primary" style="flex: 1;" id="play-release-btn">Play</button>
                ${available > 0 ? '<button class="btn btn-secondary" style="flex: 1;" id="buy-release-btn">Buy NFT</button>' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    document.getElementById('play-release-btn')?.addEventListener('click', () => {
      if (release.tracks?.length > 0) {
        const queue = release.tracks.map((t, i) => ({
          id: parseInt(t.id) || i,
          trackId: t.id?.toString(),
          title: release.type === 'single' ? release.title : t.title,
          artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
          cover: release.coverUrl,
          ipfsHash: t.audioCid,
          releaseId: release.id,
          duration: t.duration,
        }));
        Player.playTrack(queue[0], queue, 0);
        this.close();
      }
    });
    
    document.querySelectorAll('.modal-track').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.trackIdx, 10);
        if (release.tracks?.[idx]) {
          const queue = release.tracks.map((t, i) => ({
            id: parseInt(t.id) || i,
            trackId: t.id?.toString(),
            title: release.type === 'single' ? release.title : t.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl,
            ipfsHash: t.audioCid,
            releaseId: release.id,
            duration: t.duration,
          }));
          Player.playTrack(queue[idx], queue, idx);
        }
      });
    });
    
    document.getElementById('buy-release-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) { this.close(); this.showAuth(); return; }
      alert('Buy feature coming soon!');
    });
    
    document.querySelector('.artist-link')?.addEventListener('click', () => {
      const address = document.querySelector('.artist-link').dataset.artist;
      this.close();
      Router.navigate('artist', { address });
    });
  },
  
  showCreate() {
    if (!AppState.user?.address) { this.showAuth(); return; }
    this.activeModal = 'create';
    alert('Create feature coming soon!');
  },
  
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
                <textarea class="form-input form-textarea" name="bio" placeholder="About yourself">${profile.bio || ''}</textarea>
              </div>
              <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="button" class="btn btn-secondary close-modal-btn" style="flex: 1;">Cancel</button>
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const updates = {
        address: AppState.user.address,
        name: formData.get('name')?.trim() || null,
        bio: formData.get('bio')?.trim() || null,
      };
      try {
        await API.saveProfile(updates);
        setProfile({ ...AppState.profile, ...updates });
        UI.updateUserCard();
        this.close();
      } catch (error) {
        alert('Failed to save profile.');
      }
    });
  },
};
