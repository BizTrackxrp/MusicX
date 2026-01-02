/**
 * XRP Music - Modals
 * Auth, Release, Create, Edit Profile, Now Playing modals
 */

const Modals = {
  activeModal: null,
  nowPlayingInterval: null,
  
  genres: [
    { id: 'hiphop', name: 'Hip Hop', color: '#f97316' },
    { id: 'rap', name: 'Rap', color: '#ef4444' },
    { id: 'electronic', name: 'Electronic', color: '#3b82f6' },
    { id: 'rnb', name: 'R&B', color: '#a855f7' },
    { id: 'pop', name: 'Pop', color: '#ec4899' },
    { id: 'rock', name: 'Rock', color: '#84cc16' },
    { id: 'country', name: 'Country', color: '#f59e0b' },
    { id: 'jazz', name: 'Jazz', color: '#06b6d4' },
    { id: 'lofi', name: 'Lo-Fi', color: '#8b5cf6' },
    { id: 'other', name: 'Other', color: '#6b7280' },
  ],
  
  show(html) {
    const container = document.getElementById('modals');
    if (!container) return;
    container.innerHTML = html;
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) this.close();
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
      setTimeout(() => { container.innerHTML = ''; }, 200);
    }
    document.removeEventListener('keydown', this.handleEsc);
    this.activeModal = null;
  },
  
  handleEsc(e) {
    if (e.key === 'Escape') Modals.close();
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
    const total = release ? release.totalEditions : 0;
    const price = release ? (release.albumPrice || release.songPrice) : 0;
    const soldOut = available <= 0;
    const lowStock = available > 0 && available <= 10;
    
    const html = `
      <div class="modal-overlay now-playing-modal">
        <div class="modal np-modal">
          <button class="modal-close np-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div class="np-layout">
            <!-- Left: Cover Art -->
            <div class="np-cover-section">
              <div class="np-cover">
                <img src="${track.cover || '/placeholder.png'}" alt="${track.title}">
              </div>
            </div>
            
            <!-- Right: Info & Controls -->
            <div class="np-info-section">
              <div class="np-track-info">
                <h1 class="np-title">${track.title}</h1>
                <button class="np-artist" data-artist="${release?.artistAddress || ''}">${track.artist}</button>
                ${release ? `<span class="np-release-type">${release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'}: ${release.title}</span>` : ''}
              </div>
              
              <!-- Progress -->
              <div class="np-progress-section">
                <div class="np-progress" id="np-progress">
                  <div class="np-progress-fill" id="np-progress-fill" style="width: ${AppState.player.progress}%"></div>
                </div>
                <div class="np-times">
                  <span id="np-current-time">${Helpers.formatDuration(Player.audio?.currentTime || 0)}</span>
                  <span id="np-duration">${Helpers.formatDuration(AppState.player.duration || 0)}</span>
                </div>
              </div>
              
              <!-- Controls -->
              <div class="np-controls">
                <button class="np-ctrl-btn ${AppState.player.isShuffled ? 'active' : ''}" id="np-shuffle-btn" title="Shuffle">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                  </svg>
                </button>
                <button class="np-ctrl-btn" id="np-prev-btn">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="19 20 9 12 19 4 19 20"></polygon>
                    <line x1="5" y1="19" x2="5" y2="5"></line>
                  </svg>
                </button>
                <button class="np-play-btn" id="np-play-btn">
                  ${AppState.player.isPlaying 
                    ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
                    : '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
                  }
                </button>
                <button class="np-ctrl-btn" id="np-next-btn">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 4 15 12 5 20 5 4"></polygon>
                    <line x1="19" y1="5" x2="19" y2="19"></line>
                  </svg>
                </button>
                <button class="np-ctrl-btn ${AppState.player.isRepeat ? 'active' : ''}" id="np-repeat-btn" title="Repeat">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                  </svg>
                </button>
              </div>
              
              <!-- Actions -->
              <div class="np-actions">
                <button class="np-action-btn ${isLiked ? 'liked' : ''}" id="np-like-btn" title="Like">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <span>Like</span>
                </button>
                <button class="np-action-btn" id="np-add-btn" title="Add to Playlist">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Add to Playlist</span>
                </button>
              </div>
              
              ${release ? `
                <!-- Purchase Section -->
                <div class="np-purchase">
                  <div class="np-scarcity ${soldOut ? 'sold-out' : lowStock ? 'low-stock' : ''}">
                    <div class="np-scarcity-bar">
                      <div class="np-scarcity-fill" style="width: ${total > 0 ? ((total - available) / total) * 100 : 0}%"></div>
                    </div>
                    <div class="np-scarcity-text">
                      ${soldOut 
                        ? '<span class="np-sold-out-text">SOLD OUT</span>'
                        : `<span class="np-available">${available}</span> of <span>${total}</span> remaining`
                      }
                    </div>
                  </div>
                  
                  ${!soldOut ? `
                    <button class="np-buy-btn" id="np-buy-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                      Buy NFT for ${price} XRP
                    </button>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
          
          ${release?.tracks && release.tracks.length > 1 ? `
            <!-- Track List -->
            <div class="np-tracklist">
              <h3 class="np-tracklist-title">ALL TRACKS IN THIS ${release.type === 'album' ? 'ALBUM' : 'RELEASE'}</h3>
              <div class="np-tracks">
                ${release.tracks.map((t, idx) => {
                  const isCurrentTrack = (t.id === track.id) || (t.id?.toString() === track.trackId);
                  return `
                    <div class="np-track-row ${isCurrentTrack ? 'playing' : ''}" data-track-idx="${idx}">
                      <span class="np-track-num">${isCurrentTrack ? '▶' : idx + 1}</span>
                      <span class="np-track-name">${release.type === 'single' ? release.title : t.title}</span>
                      <span class="np-track-dur">${Helpers.formatDuration(t.duration)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <style>
        .np-modal {
          width: 95%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--bg-secondary);
          border-radius: var(--radius-2xl);
          padding: 0;
        }
        .np-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          padding: 8px;
          background: var(--bg-hover);
          border: none;
          border-radius: 50%;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 150ms;
        }
        .np-close:hover {
          background: var(--border-color);
          color: var(--text-primary);
        }
        .np-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          padding: 24px;
        }
        @media (min-width: 600px) {
          .np-layout {
            grid-template-columns: 280px 1fr;
            padding: 32px;
          }
        }
        .np-cover-section {
          display: flex;
          justify-content: center;
        }
        .np-cover {
          width: 100%;
          max-width: 280px;
          aspect-ratio: 1;
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .np-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .np-info-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .np-track-info {
          text-align: center;
        }
        @media (min-width: 600px) {
          .np-track-info { text-align: left; }
        }
        .np-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .np-artist {
          font-size: 18px;
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 150ms;
        }
        .np-artist:hover { color: var(--accent); }
        .np-release-type {
          display: block;
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .np-progress-section { margin-top: auto; }
        .np-progress {
          height: 6px;
          background: var(--border-color);
          border-radius: 3px;
          cursor: pointer;
          overflow: hidden;
        }
        .np-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
          transition: width 100ms linear;
        }
        .np-times {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .np-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        @media (min-width: 600px) {
          .np-controls { justify-content: flex-start; }
        }
        .np-ctrl-btn {
          padding: 10px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 150ms;
          border-radius: var(--radius-md);
        }
        .np-ctrl-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
        .np-ctrl-btn.active { color: var(--accent); }
        .np-play-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 150ms, background 150ms;
          margin: 0 8px;
        }
        .np-play-btn:hover { transform: scale(1.05); background: var(--accent-hover); }
        .np-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        @media (min-width: 600px) {
          .np-actions { justify-content: flex-start; }
        }
        .np-action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--bg-hover);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .np-action-btn:hover { background: var(--border-color); color: var(--text-primary); }
        .np-action-btn.liked { color: var(--error); border-color: var(--error); }
        .np-purchase {
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
        }
        .np-scarcity { margin-bottom: 16px; }
        .np-scarcity-bar {
          height: 8px;
          background: var(--bg-hover);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .np-scarcity-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), #a855f7);
          border-radius: 4px;
          transition: width 300ms;
        }
        .np-scarcity.low-stock .np-scarcity-fill { background: linear-gradient(90deg, var(--warning), var(--error)); }
        .np-scarcity.sold-out .np-scarcity-fill { background: var(--error); }
        .np-scarcity-text {
          font-size: 14px;
          color: var(--text-secondary);
          text-align: center;
        }
        .np-available {
          font-size: 20px;
          font-weight: 700;
          color: var(--accent);
        }
        .np-scarcity.low-stock .np-available { color: var(--warning); }
        .np-sold-out-text {
          font-size: 16px;
          font-weight: 700;
          color: var(--error);
        }
        .np-buy-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 24px;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          border: none;
          border-radius: var(--radius-lg);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 150ms, box-shadow 150ms;
        }
        .np-buy-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }
        .np-tracklist {
          padding: 24px;
          padding-top: 0;
          border-top: 1px solid var(--border-color);
          margin-top: 0;
        }
        @media (min-width: 600px) {
          .np-tracklist { padding: 0 32px 32px; }
        }
        .np-tracklist-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          margin: 20px 0 12px;
        }
        .np-tracks {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .np-track-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          cursor: pointer;
          transition: background 150ms;
          border-bottom: 1px solid var(--border-color);
        }
        .np-track-row:last-child { border-bottom: none; }
        .np-track-row:hover { background: var(--bg-hover); }
        .np-track-row.playing { background: rgba(59, 130, 246, 0.1); }
        .np-track-row.playing .np-track-name { color: var(--accent); }
        .np-track-num {
          width: 24px;
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
        }
        .np-track-name {
          flex: 1;
          font-size: 15px;
          color: var(--text-primary);
        }
        .np-track-dur {
          font-size: 14px;
          color: var(--text-muted);
        }
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
        btn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
      }
    });
    
    document.getElementById('np-progress')?.addEventListener('click', (e) => {
      if (!Player.audio?.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      Player.audio.currentTime = percent * Player.audio.duration;
    });
    
    document.querySelector('.np-artist')?.addEventListener('click', () => {
      const artistAddress = document.querySelector('.np-artist')?.dataset.artist;
      if (artistAddress) {
        this.close();
        Router.navigate('artist', { address: artistAddress });
      }
    });
    
    // Buy button - triggers purchase flow
    document.getElementById('np-buy-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) {
        this.close();
        this.showAuth();
        return;
      }
      if (release) {
        this.showPurchase(release);
      }
    });
    
    if (release?.tracks) {
      document.querySelectorAll('.np-track-row').forEach(item => {
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
            document.querySelectorAll('.np-track-row').forEach((el, i) => {
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
      ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  },

  /**
   * Show List for Sale Modal
   * Artist confirms details and transfers NFT to platform for batch minting
   */
  showListForSale(release) {
    this.activeModal = 'list-for-sale';
    
    const price = release.albumPrice || release.songPrice;
    const quantity = release.totalEditions || 100;
    const royaltyPercent = release.royaltyPercent || 5; // Default 5% resale royalty
    const platformFee = 2;
    const artistEarnings = (price * 0.98).toFixed(2);
    const totalPotential = (price * 0.98 * quantity).toFixed(2);
    
    const html = `
      <div class="modal-overlay">
        <div class="modal list-sale-modal">
          <div class="modal-header">
            <div class="modal-title">List for Sale</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Item Preview -->
            <div class="purchase-item">
              <div class="purchase-cover">
                ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${release.title}">` : ''}
              </div>
              <div class="purchase-details">
                <div class="purchase-title">${release.title}</div>
                <div class="purchase-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
                <div class="purchase-type">${release.type} • ${release.tracks?.length || 1} track${release.tracks?.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <!-- Confirm Details -->
            <div class="list-sale-section">
              <div class="list-sale-section-title">Confirm Sale Details</div>
              
              <div class="list-sale-details">
                <div class="list-sale-row">
                  <span>Price per copy</span>
                  <span class="list-sale-value">${price} XRP</span>
                </div>
                <div class="list-sale-row">
                  <span>Number of copies</span>
                  <span class="list-sale-value">${quantity} editions</span>
                </div>
                <div class="list-sale-row">
                  <span>Resale royalty</span>
                  <span class="list-sale-value">${royaltyPercent}%</span>
                </div>
                <div class="list-sale-row">
                  <span>Platform fee</span>
                  <span class="list-sale-value">${platformFee}%</span>
                </div>
              </div>
            </div>
            
            <!-- Earnings Summary -->
            <div class="list-sale-earnings-box">
              <div class="earnings-row">
                <span>You earn per sale</span>
                <span class="earnings-value">${artistEarnings} XRP</span>
              </div>
              <div class="earnings-row highlight">
                <span>Total if all sell</span>
                <span class="earnings-value">${totalPotential} XRP</span>
              </div>
            </div>
            
            <!-- What happens -->
            <div class="list-sale-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>You'll sign <strong>one transaction</strong> to transfer your NFT to XRP Music. We'll mint ${quantity} copies and handle all sales automatically.</span>
            </div>
            
            <!-- Status -->
            <div class="list-sale-status" id="list-sale-status" style="display: none;">
              <div class="spinner"></div>
              <span id="list-sale-status-text">Preparing...</span>
            </div>
            
            <!-- Actions -->
            <div class="list-sale-actions" id="list-sale-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary" id="confirm-list-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Confirm & Sign
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .list-sale-modal {
          max-width: 480px;
        }
        .list-sale-section {
          margin-bottom: 20px;
        }
        .list-sale-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        .list-sale-details {
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          padding: 4px 16px;
        }
        .list-sale-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          font-size: 14px;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .list-sale-row:last-child {
          border-bottom: none;
        }
        .list-sale-value {
          font-weight: 600;
          color: var(--text-primary);
        }
        .list-sale-earnings-box {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02));
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: var(--radius-lg);
          padding: 16px;
          margin-bottom: 20px;
        }
        .earnings-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .earnings-row:not(:last-child) {
          margin-bottom: 8px;
        }
        .earnings-row.highlight {
          padding-top: 12px;
          margin-top: 12px;
          border-top: 1px solid rgba(34, 197, 94, 0.2);
          font-size: 16px;
        }
        .earnings-value {
          font-weight: 700;
          color: var(--success);
        }
        .earnings-row.highlight .earnings-value {
          font-size: 18px;
        }
        .list-sale-info {
          display: flex;
          gap: 10px;
          padding: 12px 14px;
          background: var(--bg-hover);
          border-radius: var(--radius-md);
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .list-sale-info svg {
          flex-shrink: 0;
          color: var(--accent);
          margin-top: 2px;
        }
        .list-sale-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 32px;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .list-sale-actions {
          display: flex;
          gap: 12px;
        }
        .list-sale-actions .btn {
          flex: 1;
        }
      </style>
    `;
    
    this.show(html);
    
    // Bind confirm button
    document.getElementById('confirm-list-btn')?.addEventListener('click', () => {
      this.processListForSale(release);
    });
  },
  
  /**
   * Load NFTs from user's wallet and match with release
   */
  async loadUserNFTs(release) {
    // This function kept for compatibility but simplified
    try {
      const response = await fetch(`https://xrplcluster.com`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_nfts',
          params: [{ account: AppState.user.address, limit: 100 }]
        })
      });
      
      const data = await response.json();
      return data.result?.account_nfts || [];
    } catch (error) {
      console.error('Failed to load NFTs:', error);
      return [];
    }
  },
  
  /**
   * Process the list for sale - transfer NFT to platform
   */
  async processListForSale(release) {
    const statusEl = document.getElementById('list-sale-status');
    const statusTextEl = document.getElementById('list-sale-status-text');
    const actionsEl = document.getElementById('list-sale-actions');
    
    // Show loading
    actionsEl.style.display = 'none';
    statusEl.style.display = 'flex';
    statusTextEl.textContent = 'Finding your NFT...';
    
    try {
      // Step 1: Find the NFT in user's wallet
      const nfts = await this.loadUserNFTs(release);
      
      let nftTokenId = release.nftTokenId;
      
      // Try to match by metadata CID if we don't have the token ID
      if (!nftTokenId && nfts.length > 0) {
        for (const nft of nfts) {
          if (nft.URI) {
            const uri = this.hexToString(nft.URI);
            if (release.metadataCid && uri.includes(release.metadataCid)) {
              nftTokenId = nft.NFTokenID;
              break;
            }
          }
        }
        
        // If still no match, use most recent NFT
        if (!nftTokenId) {
          nftTokenId = nfts[nfts.length - 1]?.NFTokenID;
        }
      }
      
      if (!nftTokenId) {
        throw new Error('Could not find NFT in your wallet');
      }
      
      // Step 2: Get platform address
      statusTextEl.textContent = 'Preparing transfer...';
      
      const configResponse = await fetch('/api/list-for-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: release.id, nftTokenId }),
      });
      
      const configData = await configResponse.json();
      if (!configData.success) throw new Error(configData.error || 'Failed to get platform config');
      
      const { platformAddress } = configData.payload;
      
      if (!platformAddress) {
        throw new Error('Platform wallet not configured');
      }
      
      // Step 3: Create sell offer with platform as destination (transfer)
      // Using Amount: "0" and Destination makes it a transfer offer
      statusTextEl.textContent = 'Sign in Xaman to transfer NFT...';
      
      const offerResult = await XamanWallet.createTransferOffer(nftTokenId, platformAddress);
      
      if (!offerResult.success) {
        throw new Error('Transaction cancelled');
      }
      
      // Step 4: Save to database and trigger backend minting
      statusTextEl.textContent = 'Finalizing listing...';
      
      const listResponse = await fetch('/api/list-for-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          releaseId: release.id, 
          nftTokenId: nftTokenId,
          offerIndex: offerResult.offerIndex || offerResult.txHash,
          transferToPlaftorm: true
        }),
      });
      
      const listData = await listResponse.json();
      if (!listData.success) throw new Error(listData.error || 'Failed to save listing');
      
      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span style="color: var(--success); font-weight: 600; font-size: 16px;">Listed for Sale!</span>
        <span style="font-size: 13px; color: var(--text-muted); text-align: center;">Your release is now available.<br>We'll handle the rest automatically.</span>
      `;
      
      setTimeout(() => {
        this.close();
        if (typeof ProfilePage !== 'undefined') ProfilePage.render();
      }, 2500);
      
    } catch (error) {
      console.error('List for sale failed:', error);
      
      statusEl.innerHTML = `
        <div style="color: var(--error);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <span style="color: var(--error); font-weight: 600;">Listing Failed</span>
        <span style="font-size: 13px; color: var(--text-muted);">${error.message}</span>
      `;
      
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="Modals.close()">Close</button>
        <button class="btn btn-primary" onclick="Modals.processListForSale(${JSON.stringify(release).replace(/"/g, '&quot;')})">Try Again</button>
      `;
      actionsEl.style.display = 'flex';
    }
  },
  
  /**
   * Helper: Convert hex to string
   */
  hexToString(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  },

  /**
   * Show List ALL for Sale Modal - batch listing
   */
  showListAllForSale(releases) {
    this.activeModal = 'list-all-for-sale';
    this.pendingListings = releases;
    this.currentListingIndex = 0;
    this.listedCount = 0;
    this.userNFTs = [];
    
    const totalEarnings = releases.reduce((sum, r) => {
      const price = r.albumPrice || r.songPrice || 0;
      return sum + (price * 0.98);
    }, 0);
    
    const html = `
      <div class="modal-overlay">
        <div class="modal list-all-modal">
          <div class="modal-header">
            <div class="modal-title">List All for Sale</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Summary -->
            <div class="list-all-summary">
              <div class="list-all-stat">
                <span class="list-all-stat-value">${releases.length}</span>
                <span class="list-all-stat-label">Releases to list</span>
              </div>
              <div class="list-all-stat">
                <span class="list-all-stat-value">${releases.length}</span>
                <span class="list-all-stat-label">Signatures needed</span>
              </div>
              <div class="list-all-stat highlight">
                <span class="list-all-stat-value">${totalEarnings.toFixed(2)} XRP</span>
                <span class="list-all-stat-label">Potential earnings</span>
              </div>
            </div>
            
            <!-- Release List -->
            <div class="list-all-releases" id="list-all-releases">
              ${releases.map((release, i) => `
                <div class="list-all-item" data-index="${i}" data-release-id="${release.id}">
                  <div class="list-all-item-cover">
                    ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${release.title}">` : ''}
                  </div>
                  <div class="list-all-item-info">
                    <div class="list-all-item-title">${release.title}</div>
                    <div class="list-all-item-price">${release.albumPrice || release.songPrice} XRP</div>
                  </div>
                  <div class="list-all-item-status" id="status-${i}">
                    <span class="status-pending">Pending</span>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <!-- Progress -->
            <div class="list-all-progress" id="list-all-progress" style="display: none;">
              <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
              </div>
              <div class="progress-text" id="progress-text">Starting...</div>
            </div>
            
            <!-- Actions -->
            <div class="list-all-actions" id="list-all-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary" id="start-list-all-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start Listing (${releases.length} signatures)
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .list-all-modal {
          max-width: 500px;
        }
        .list-all-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .list-all-stat {
          flex: 1;
          text-align: center;
          padding: 16px 12px;
          background: var(--bg-hover);
          border-radius: var(--radius-md);
        }
        .list-all-stat.highlight {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05));
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .list-all-stat-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .list-all-stat.highlight .list-all-stat-value {
          color: var(--success);
        }
        .list-all-stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .list-all-releases {
          max-height: 250px;
          overflow-y: auto;
          margin-bottom: 20px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        .list-all-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        .list-all-item:last-child {
          border-bottom: none;
        }
        .list-all-item.active {
          background: rgba(139, 92, 246, 0.1);
        }
        .list-all-item.done {
          background: rgba(34, 197, 94, 0.05);
        }
        .list-all-item.error {
          background: rgba(239, 68, 68, 0.05);
        }
        .list-all-item-cover {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--bg-card);
          flex-shrink: 0;
        }
        .list-all-item-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .list-all-item-info {
          flex: 1;
          min-width: 0;
        }
        .list-all-item-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .list-all-item-price {
          font-size: 12px;
          color: var(--text-muted);
        }
        .list-all-item-status {
          font-size: 12px;
          font-weight: 500;
        }
        .status-pending { color: var(--text-muted); }
        .status-active { color: var(--accent); }
        .status-done { color: var(--success); }
        .status-error { color: var(--error); }
        .list-all-progress {
          margin-bottom: 20px;
        }
        .progress-bar {
          height: 8px;
          background: var(--bg-hover);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--success));
          border-radius: 4px;
          transition: width 300ms ease;
        }
        .progress-text {
          font-size: 13px;
          color: var(--text-secondary);
          text-align: center;
        }
        .list-all-actions {
          display: flex;
          gap: 12px;
        }
        .list-all-actions .btn {
          flex: 1;
        }
      </style>
    `;
    
    this.show(html);
    
    // Load NFTs first
    this.loadNFTsForBatchListing();
    
    // Bind start button
    document.getElementById('start-list-all-btn')?.addEventListener('click', () => {
      this.processBatchListing();
    });
  },
  
  /**
   * Load NFTs for batch listing
   */
  async loadNFTsForBatchListing() {
    try {
      const response = await fetch(`https://xrplcluster.com`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_nfts',
          params: [{ account: AppState.user.address, limit: 100 }]
        })
      });
      
      const data = await response.json();
      this.userNFTs = data.result?.account_nfts || [];
      console.log(`Loaded ${this.userNFTs.length} NFTs for batch listing`);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
    }
  },
  
  /**
   * Process batch listing - one by one
   */
  async processBatchListing() {
    const actionsEl = document.getElementById('list-all-actions');
    const progressEl = document.getElementById('list-all-progress');
    
    // Hide actions, show progress
    actionsEl.style.display = 'none';
    progressEl.style.display = 'block';
    
    // Get platform address once
    const configResponse = await fetch('/api/list-for-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseId: this.pendingListings[0].id }),
    });
    const configData = await configResponse.json();
    const platformAddress = configData.payload?.platformAddress;
    
    if (!platformAddress) {
      alert('Platform not configured');
      return;
    }
    
    // Process each release
    for (let i = 0; i < this.pendingListings.length; i++) {
      const release = this.pendingListings[i];
      const statusEl = document.getElementById(`status-${i}`);
      const itemEl = document.querySelector(`.list-all-item[data-index="${i}"]`);
      
      // Update UI
      itemEl.classList.add('active');
      statusEl.innerHTML = `<span class="status-active">Sign in Xaman...</span>`;
      document.getElementById('progress-text').textContent = `Listing ${i + 1} of ${this.pendingListings.length}: ${release.title}`;
      document.getElementById('progress-fill').style.width = `${((i) / this.pendingListings.length) * 100}%`;
      
      try {
        // Find matching NFT
        let nftTokenId = release.nftTokenId;
        
        if (!nftTokenId && this.userNFTs.length > 0) {
          // Try to match by metadata CID
          for (const nft of this.userNFTs) {
            if (nft.URI) {
              const uri = this.hexToString(nft.URI);
              if (release.metadataCid && uri.includes(release.metadataCid)) {
                nftTokenId = nft.NFTokenID;
                break;
              }
            }
          }
          
          // If still no match, use first available NFT (user will need to verify)
          if (!nftTokenId && this.userNFTs.length > 0) {
            nftTokenId = this.userNFTs[0].NFTokenID;
            // Remove this NFT from the list so it's not reused
            this.userNFTs.shift();
          }
        }
        
        if (!nftTokenId) {
          throw new Error('No NFT found');
        }
        
        const price = release.albumPrice || release.songPrice;
        const priceInDrops = Math.floor(parseFloat(price) * 1000000);
        
        // Create sell offer
        const offerResult = await XamanWallet.createSellOffer(nftTokenId, priceInDrops, platformAddress);
        
        if (!offerResult.success) {
          throw new Error('Cancelled');
        }
        
        // Save to database
        await fetch('/api/list-for-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            releaseId: release.id, 
            nftTokenId: nftTokenId,
            offerIndex: offerResult.offerIndex || offerResult.txHash
          }),
        });
        
        // Success!
        itemEl.classList.remove('active');
        itemEl.classList.add('done');
        statusEl.innerHTML = `<span class="status-done">✓ Listed</span>`;
        this.listedCount++;
        
      } catch (error) {
        console.error(`Failed to list ${release.title}:`, error);
        itemEl.classList.remove('active');
        itemEl.classList.add('error');
        statusEl.innerHTML = `<span class="status-error">✗ ${error.message}</span>`;
      }
      
      // Update progress
      document.getElementById('progress-fill').style.width = `${((i + 1) / this.pendingListings.length) * 100}%`;
    }
    
    // Done!
    document.getElementById('progress-text').textContent = `Done! Listed ${this.listedCount} of ${this.pendingListings.length} releases`;
    
    // Show close button
    actionsEl.innerHTML = `
      <button class="btn btn-primary" onclick="Modals.close(); ProfilePage.render();">
        Done - View Profile
      </button>
    `;
    actionsEl.style.display = 'flex';
  },

  /**
   * Show Purchase/Checkout Modal
   */
  showPurchase(release) {
    this.activeModal = 'purchase';
    
    const price = release.albumPrice || release.songPrice;
    const available = release.totalEditions - release.soldEditions;
    
    const html = `
      <div class="modal-overlay">
        <div class="modal purchase-modal">
          <div class="modal-header">
            <div class="modal-title">Complete Purchase</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Item Preview -->
            <div class="purchase-item">
              <div class="purchase-cover">
                ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${release.title}">` : ''}
              </div>
              <div class="purchase-details">
                <div class="purchase-title">${release.title}</div>
                <div class="purchase-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
                <div class="purchase-type">${release.type} • ${release.tracks?.length || 1} track${release.tracks?.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <!-- Price Summary -->
            <div class="purchase-summary">
              <div class="purchase-row">
                <span>NFT Price</span>
                <span>${price} XRP</span>
              </div>
              <div class="purchase-row">
                <span>Network Fee</span>
                <span>~0.00001 XRP</span>
              </div>
              <div class="purchase-row purchase-total">
                <span>Total</span>
                <span>${price} XRP</span>
              </div>
            </div>
            
            <!-- Scarcity Reminder -->
            <div class="purchase-scarcity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Only <strong>${available}</strong> of ${release.totalEditions} remaining!</span>
            </div>
            
            <!-- 2 Signature Notice -->
            <div class="purchase-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span><strong>2 signatures required:</strong> First to send payment, then to receive your NFT</span>
            </div>
            
            <!-- Purchase Status -->
            <div class="purchase-status" id="purchase-status" style="display: none;">
              <div class="purchase-status-icon">
                <div class="spinner"></div>
              </div>
              <div class="purchase-status-text">Waiting for payment...</div>
              <div class="purchase-status-sub">Check your Xaman app to sign the transaction</div>
            </div>
            
            <!-- Actions -->
            <div class="purchase-actions" id="purchase-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary purchase-confirm-btn" id="confirm-purchase-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Pay with Xaman
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .purchase-modal {
          max-width: 440px;
        }
        .purchase-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .purchase-cover {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--bg-card);
        }
        .purchase-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .purchase-details {
          flex: 1;
          min-width: 0;
        }
        .purchase-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .purchase-artist {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .purchase-type {
          font-size: 12px;
          color: var(--text-muted);
        }
        .purchase-summary {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 16px;
          margin-bottom: 16px;
        }
        .purchase-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .purchase-row.purchase-total {
          border-top: 1px solid var(--border-color);
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .purchase-scarcity {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-lg);
          font-size: 13px;
          color: var(--warning);
          margin-bottom: 12px;
        }
        .purchase-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: var(--radius-lg);
          font-size: 13px;
          color: var(--accent);
          margin-bottom: 20px;
        }
        .purchase-status {
          text-align: center;
          padding: 24px;
          margin-bottom: 20px;
        }
        .purchase-status-icon {
          margin-bottom: 16px;
        }
        .purchase-status-icon .spinner {
          width: 48px;
          height: 48px;
          border-width: 3px;
          margin: 0 auto;
        }
        .purchase-status-icon.success {
          color: var(--success);
        }
        .purchase-status-icon.error {
          color: var(--error);
        }
        .purchase-status-text {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .purchase-status-sub {
          font-size: 13px;
          color: var(--text-muted);
        }
        .purchase-actions {
          display: flex;
          gap: 12px;
        }
        .purchase-actions .btn {
          flex: 1;
        }
        .purchase-confirm-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      </style>
    `;
    
    this.show(html);
    
    // Bind confirm button
    document.getElementById('confirm-purchase-btn')?.addEventListener('click', async () => {
      await this.processPurchase(release);
    });
  },
  
  /**
   * Process the actual purchase
   * 1. Buyer pays platform wallet
   * 2. Platform creates sell offer for buyer
   * 3. Buyer accepts the offer (gets NFT)
   * 4. Platform pays artist 98%
   */
  async processPurchase(release) {
    const statusEl = document.getElementById('purchase-status');
    const actionsEl = document.getElementById('purchase-actions');
    const price = release.albumPrice || release.songPrice;
    
    // Show loading state
    if (statusEl) statusEl.style.display = 'block';
    if (actionsEl) actionsEl.style.display = 'none';
    
    try {
      // Step 1: Buyer pays platform wallet
      statusEl.innerHTML = `
        <div class="purchase-status-icon">
          <div class="spinner"></div>
        </div>
        <div class="purchase-status-text">Sending payment...</div>
        <div class="purchase-status-sub">Approve the transaction in Xaman</div>
      `;
      
      // Get platform address
      const configResponse = await fetch('/api/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConfig' }),
      });
      const configData = await configResponse.json();
      const platformAddress = configData.platformAddress;
      
      if (!platformAddress) {
        throw new Error('Platform not configured');
      }
      
      const paymentResult = await XamanWallet.sendPayment(
        platformAddress,
        price,
        `XRP Music: ${release.title}`
      );
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }
      
      // Step 2: Call API to prepare NFT transfer
      statusEl.innerHTML = `
        <div class="purchase-status-icon">
          <div class="spinner"></div>
        </div>
        <div class="purchase-status-text">Preparing your NFT...</div>
        <div class="purchase-status-sub">Platform is processing the transfer</div>
      `;
      
      const purchaseResponse = await fetch('/api/broker-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          buyerAddress: AppState.user.address,
          paymentTxHash: paymentResult.txHash,
        }),
      });
      
      const purchaseResult = await purchaseResponse.json();
      
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || 'Transfer failed');
      }
      
      // Step 3: Buyer accepts the sell offer to receive NFT
      statusEl.innerHTML = `
        <div class="purchase-status-icon">
          <div class="spinner"></div>
        </div>
        <div class="purchase-status-text">Accept NFT transfer...</div>
        <div class="purchase-status-sub">Sign in Xaman to receive your NFT</div>
      `;
      
      const acceptResult = await XamanWallet.acceptSellOffer(purchaseResult.offerIndex);
      
      if (!acceptResult.success) {
        throw new Error('Failed to accept NFT transfer');
      }
      
      // Confirm the sale in database
      if (purchaseResult.pendingSale) {
        try {
          await fetch('/api/broker-sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'confirm',
              pendingSale: purchaseResult.pendingSale,
              acceptTxHash: acceptResult.txHash,
            }),
          });
        } catch (confirmErr) {
          console.error('Failed to confirm sale in DB:', confirmErr);
        }
      }
      
      // Success!
      statusEl.innerHTML = `
        <div class="purchase-status-icon success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="purchase-status-text">Purchase Complete! 🎉</div>
        <div class="purchase-status-sub">Redirecting to your collection...</div>
      `;
      
      // Auto-redirect to profile NFTs tab
      setTimeout(() => {
        this.close();
        ProfilePage.activeTab = 'nfts';
        Router.navigate('profile');
      }, 2000);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      
      // Update status to error
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="purchase-status-icon error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div class="purchase-status-text">Purchase Failed</div>
          <div class="purchase-status-sub">${error.message || 'Transaction was cancelled or failed'}</div>
        `;
      }
      
      // Show actions again to allow retry
      if (actionsEl) {
        actionsEl.style.display = 'flex';
        actionsEl.innerHTML = `
          <button class="btn btn-secondary close-modal-btn" onclick="Modals.close()">Close</button>
          <button class="btn btn-primary" onclick="Modals.processPurchase(${JSON.stringify(release).replace(/"/g, '&quot;')})">Try Again</button>
        `;
      }
    }
  },

  /**
   * Show modal to list an owned NFT for sale (secondary market)
   */
  showListNFTForSale(nft) {
    this.activeModal = 'list-nft';
    
    const isOneOfOne = nft.totalEditions === 1;
    const editionText = isOneOfOne 
      ? '1/1 Edition' 
      : nft.editionNumber 
        ? `Edition #${nft.editionNumber} of ${nft.totalEditions}` 
        : `Edition of ${nft.totalEditions}`;
    
    const html = `
      <div class="modal-overlay list-nft-modal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">List for Sale</div>
            <button class="modal-close close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- NFT Preview -->
            <div class="list-nft-preview">
              <div class="list-nft-cover">
                ${nft.coverUrl 
                  ? `<img src="${nft.coverUrl}" alt="${nft.trackTitle || nft.releaseTitle}">`
                  : `<div class="cover-placeholder">🎵</div>`
                }
              </div>
              <div class="list-nft-details">
                <div class="list-nft-title">${nft.trackTitle || nft.releaseTitle}</div>
                <div class="list-nft-artist">${nft.artistName || 'Unknown Artist'}</div>
                <div class="list-nft-edition ${isOneOfOne ? 'one-of-one' : ''}">${editionText}</div>
              </div>
            </div>
            
            <!-- Price Input -->
            <div class="form-group">
              <label class="form-label">Sale Price (XRP)</label>
              <input type="number" class="form-input" id="list-nft-price" placeholder="Enter price" step="0.01" min="0.01" value="${nft.price || ''}">
              <p class="form-hint">Artist royalty is automatically deducted by the XRP Ledger</p>
            </div>
            
            <!-- Info -->
            <div class="list-nft-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>When someone buys, you'll need to approve the sale in Xaman</span>
            </div>
            
            <!-- Status -->
            <div class="list-nft-status hidden" id="list-nft-status">
              <div class="spinner"></div>
              <p>Creating sell offer...</p>
            </div>
            
            <!-- Actions -->
            <div class="list-nft-actions" id="list-nft-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary" id="confirm-list-nft-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                List for Sale
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .list-nft-modal .modal { max-width: 420px; }
        .list-nft-preview {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .list-nft-cover {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
        }
        .list-nft-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .list-nft-details {
          flex: 1;
          min-width: 0;
        }
        .list-nft-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .list-nft-artist {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .list-nft-edition {
          display: inline-block;
          padding: 4px 10px;
          background: var(--bg-card);
          border-radius: 100px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
        }
        .list-nft-edition.one-of-one {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
        }
        .list-nft-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: var(--radius-lg);
          font-size: 13px;
          color: var(--accent);
          margin-bottom: 20px;
        }
        .list-nft-info svg { flex-shrink: 0; margin-top: 2px; }
        .list-nft-status {
          text-align: center;
          padding: 20px;
        }
        .list-nft-status.hidden { display: none; }
        .list-nft-status .spinner { margin: 0 auto 12px; }
        .list-nft-status p { color: var(--text-secondary); font-size: 14px; margin: 0; }
        .list-nft-actions {
          display: flex;
          gap: 12px;
        }
        .list-nft-actions .btn { flex: 1; }
      </style>
    `;
    
    this.show(html);
    
    // Bind confirm button
    document.getElementById('confirm-list-nft-btn')?.addEventListener('click', async () => {
      const price = parseFloat(document.getElementById('list-nft-price').value);
      if (!price || price <= 0) {
        alert('Please enter a valid price');
        return;
      }
      
      await this.processListNFT(nft, price);
    });
  },
  
  /**
   * Process listing an NFT for sale
   */
  async processListNFT(nft, price) {
    const statusEl = document.getElementById('list-nft-status');
    const actionsEl = document.getElementById('list-nft-actions');
    
    statusEl?.classList.remove('hidden');
    if (actionsEl) actionsEl.style.display = 'none';
    
    try {
      // Create sell offer via Xaman
      const result = await XamanWallet.createSellOffer(nft.nftTokenId, price);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create sell offer');
      }
      
      // Save listing to database
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftTokenId: nft.nftTokenId,
          sellerAddress: AppState.user.address,
          price: price,
          offerIndex: result.offerIndex,
          releaseId: nft.releaseId,
          trackId: nft.trackId,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.warn('Failed to save listing to DB:', data.error);
      }
      
      // Success
      statusEl.innerHTML = `
        <div style="color: var(--success); margin-bottom: 12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <p style="font-weight: 600; color: var(--text-primary);">Listed for ${price} XRP!</p>
        <p style="font-size: 13px; margin-top: 4px;">Your NFT is now listed for sale</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="Modals.close(); ProfilePage.activeTab = 'forsale'; Router.navigate('profile')">View My Listing</button>
      `;
      
    } catch (error) {
      console.error('List NFT failed:', error);
      statusEl.innerHTML = `
        <div style="color: var(--error); margin-bottom: 12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <p style="font-weight: 600; color: var(--text-primary);">Listing Failed</p>
        <p style="font-size: 13px; margin-top: 4px;">${error.message}</p>
      `;
      if (actionsEl) actionsEl.style.display = 'flex';
    }
  },

  /**
   * Show modal to purchase from secondary market
   */
  showSecondaryPurchase(listing) {
    this.activeModal = 'secondary-purchase';
    
    const title = listing.track_title || listing.release_title || 'NFT';
    const artist = listing.artist_name || 'Unknown Artist';
    const price = parseFloat(listing.price);
    const sellerShort = `${listing.seller_address.slice(0, 6)}...${listing.seller_address.slice(-4)}`;
    
    const html = `
      <div class="modal-overlay purchase-modal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">Buy from Resale</div>
            <button class="modal-close close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- Item Preview -->
            <div class="purchase-item">
              <div class="purchase-cover">
                ${listing.cover_url 
                  ? `<img src="${listing.cover_url}" alt="${title}">`
                  : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;">🎵</div>`
                }
              </div>
              <div class="purchase-details">
                <div class="purchase-title">${title}</div>
                <div class="purchase-artist">${artist}</div>
                <div class="purchase-type" style="color: var(--accent);">Resale from ${sellerShort}</div>
              </div>
            </div>
            
            <!-- Price Summary -->
            <div class="purchase-summary">
              <div class="purchase-row">
                <span>NFT Price</span>
                <span>${price} XRP</span>
              </div>
              <div class="purchase-row">
                <span>Network Fee</span>
                <span>~0.00001 XRP</span>
              </div>
              <div class="purchase-row purchase-total">
                <span>Total</span>
                <span>${price} XRP</span>
              </div>
            </div>
            
            <!-- Info -->
            <div class="purchase-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 1l4 4-4 4"></path>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              </svg>
              <span>This is a resale. Artist royalty is automatically paid by the XRP Ledger.</span>
            </div>
            
            <!-- Status -->
            <div class="purchase-status" id="secondary-purchase-status" style="display: none;">
              <div class="purchase-status-icon">
                <div class="spinner"></div>
              </div>
              <div class="purchase-status-text">Processing...</div>
              <div class="purchase-status-sub">Check your Xaman app</div>
            </div>
            
            <!-- Actions -->
            <div class="purchase-actions" id="secondary-purchase-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary" id="confirm-secondary-purchase-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Buy with Xaman
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    document.getElementById('confirm-secondary-purchase-btn')?.addEventListener('click', async () => {
      await this.processSecondaryPurchase(listing);
    });
  },
  
  /**
   * Process secondary market purchase
   */
  async processSecondaryPurchase(listing) {
    const statusEl = document.getElementById('secondary-purchase-status');
    const actionsEl = document.getElementById('secondary-purchase-actions');
    
    if (statusEl) statusEl.style.display = 'block';
    if (actionsEl) actionsEl.style.display = 'none';
    
    try {
      // Accept the seller's offer
      statusEl.innerHTML = `
        <div class="purchase-status-icon">
          <div class="spinner"></div>
        </div>
        <div class="purchase-status-text">Sign in Xaman</div>
        <div class="purchase-status-sub">Accept the seller's offer to complete purchase</div>
      `;
      
      const result = await XamanWallet.acceptSellOffer(listing.offer_index);
      
      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }
      
      // Mark listing as sold
      await fetch(`/api/listings?listingId=${listing.id}`, { method: 'DELETE' });
      
      // Success!
      statusEl.innerHTML = `
        <div class="purchase-status-icon success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="purchase-status-text">Purchase Complete! 🎉</div>
        <div class="purchase-status-sub">Redirecting to your collection...</div>
      `;
      
      // Auto-redirect to profile NFTs tab
      setTimeout(() => {
        this.close();
        ProfilePage.activeTab = 'nfts';
        Router.navigate('profile');
      }, 2000);
      
    } catch (error) {
      console.error('Secondary purchase failed:', error);
      statusEl.innerHTML = `
        <div class="purchase-status-icon error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="purchase-status-text">Purchase Failed</div>
        <div class="purchase-status-sub">${error.message}</div>
      `;
      if (actionsEl) actionsEl.style.display = 'flex';
    }
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
            <div class="auth-waiting hidden" id="auth-waiting">
              <div class="spinner"></div>
              <p>Waiting for Xaman approval...</p>
              <p class="auth-waiting-hint">Check your Xaman app or the popup window</p>
            </div>
          </div>
        </div>
      </div>
      <style>
        .auth-waiting { text-align: center; padding: 20px 0; }
        .auth-waiting .spinner { width: 32px; height: 32px; margin: 0 auto 12px; }
        .auth-waiting p { color: var(--text-secondary); font-size: 14px; margin: 0; }
        .auth-waiting-hint { font-size: 12px; color: var(--text-muted); margin-top: 8px !important; }
        .auth-waiting.hidden { display: none; }
        .xaman-btn.hidden { display: none; }
      </style>
    `;
    this.show(html);
    
    document.getElementById('xaman-connect-btn')?.addEventListener('click', async () => {
      // Show waiting state
      document.getElementById('xaman-connect-btn')?.classList.add('hidden');
      document.getElementById('auth-waiting')?.classList.remove('hidden');
      
      // Start connection
      await XamanWallet.connect();
      
      // The SDK will fire 'success' event when user signs
      // We'll poll to check if connected
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes
      const checkConnection = setInterval(() => {
        attempts++;
        if (XamanWallet.isConnected()) {
          clearInterval(checkConnection);
          this.close();
          // Navigate to stream page after successful login
          Router.navigate('stream');
        } else if (attempts >= maxAttempts) {
          clearInterval(checkConnection);
          // Show button again on timeout
          document.getElementById('xaman-connect-btn')?.classList.remove('hidden');
          document.getElementById('auth-waiting')?.classList.add('hidden');
        }
      }, 1000);
    });
  },
  
  showRelease(release) {
    this.activeModal = 'release';
    const available = release.totalEditions - release.soldEditions;
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    const albumPrice = trackPrice * trackCount;
    const isAlbum = release.type !== 'single' && trackCount > 1;
    
    // Check if full album is available (all tracks have stock)
    const canBuyFullAlbum = isAlbum && available >= trackCount;
    
    // Calculate total duration
    const totalDuration = release.tracks?.reduce((sum, t) => sum + (t.duration || 0), 0) || 0;
    const durationText = totalDuration > 3600 
      ? `${Math.floor(totalDuration / 3600)} hr ${Math.floor((totalDuration % 3600) / 60)} min`
      : `${Math.floor(totalDuration / 60)} min ${totalDuration % 60} sec`;
    
    const html = `
      <div class="modal-overlay release-modal-overlay">
        <div class="modal release-modal">
           <button class="release-close-x" onclick="Modals.close()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <!-- Header with gradient background -->
          <div class="release-header" style="background: linear-gradient(180deg, ${this.getColorFromImage(release.coverUrl)} 0%, var(--bg-primary) 100%);">
            <div class="release-header-content">
              <div class="release-cover-small">
                ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${release.title}">` : '<div class="cover-placeholder">🎵</div>'}
              </div>
              <div class="release-header-info">
                <span class="release-type-label">${isAlbum ? (release.type === 'album' ? 'Album' : 'EP') : 'Single'}</span>
                <h1 class="release-title-large">${release.title}</h1>
                <div class="release-meta">
                 <button class="artist-chip" data-artist="${release.artistAddress}">
                    ${(release.artistAvatarUrl || release.artistAvatar || release.avatar_url)
                      ? `<img class="artist-chip-avatar" src="${release.artistAvatarUrl || release.artistAvatar || release.avatar_url}" alt="${release.artistName || 'Artist'}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
                      : `<div class="artist-chip-avatar">${(release.artistName || 'A')[0].toUpperCase()}</div>`
                    }
                    <span>${release.artistName || Helpers.truncateAddress(release.artistAddress)}</span>
                  </button>
                  <span class="release-meta-dot">•</span>
                  <span>${trackCount} song${trackCount > 1 ? 's' : ''}, ${durationText}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Action Bar -->
          <div class="release-actions-bar">
            <button class="btn-play-large" id="play-release-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
            <button class="btn-icon-circle" id="like-release-btn" title="Add to Liked Songs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="btn-icon-circle" id="add-to-playlist-btn" title="Add to Playlist">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </button>
            <div style="flex: 1;"></div>
            ${canBuyFullAlbum ? `
              <button class="btn btn-primary buy-album-btn" id="buy-album-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                Buy Full ${isAlbum ? (release.type === 'album' ? 'Album' : 'EP') : 'Release'} • ${albumPrice} XRP
              </button>
            ` : available > 0 && !isAlbum ? `
              <button class="btn btn-primary" id="buy-release-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                Buy NFT • ${trackPrice} XRP
              </button>
            ` : ''}
          </div>
          
          <!-- Track List -->
          <div class="release-track-list">
           <div class="track-list-header">
              <span class="track-col-num">#</span>
              <span class="track-col-title">Title</span>
              <span class="track-col-actions"></span>
              <span class="track-col-duration">Length</span>
              <span class="track-col-avail">Available</span>
              <span class="track-col-buy">Price</span>
            </div>
            ${release.tracks?.map((track, idx) => {
              const trackSold = track.soldCount || 0;
              const trackRemaining = release.totalEditions - trackSold;
              const trackAvailable = trackRemaining > 0;
              return `
                <div class="track-row" data-track-idx="${idx}">
                  <span class="track-col-num">
                    <span class="track-num">${idx + 1}</span>
                    <button class="track-play-btn" data-track-idx="${idx}">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </button>
                  </span>
                  <div class="track-col-title">
                    <span class="track-name">${release.type === 'single' ? release.title : track.title}</span>
                    <span class="track-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</span>
                  </div>
                  <span class="track-col-actions">
                    <button class="track-action-btn like-track-btn" data-track-idx="${idx}" title="Like">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>
                    <button class="track-action-btn add-track-btn" data-track-idx="${idx}" title="Add to Playlist">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </span>
                  <span class="track-col-duration">${Helpers.formatDuration(track.duration)}</span>
                 <span class="track-col-avail">${trackRemaining}/${release.totalEditions}</span>
                  <span class="track-col-buy">
                    ${trackAvailable ? `
                      <button class="btn btn-sm buy-track-btn" data-track-idx="${idx}" data-track-id="${track.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="9" cy="21" r="1"></circle>
                          <circle cx="20" cy="21" r="1"></circle>
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                        ${trackPrice} XRP
                      </button>
                    ` : `<span class="sold-out-label">Sold Out</span>`}
                  </span>
                </div>
              `;
            }).join('') || ''}
          </div>
          
         <!-- Availability Info -->
          <div class="release-availability">
            ${release.soldEditions === 0 
              ? `<span class="first-edition-badge">🏆 1st Edition Available!</span>`
              : `<span class="availability-count">${available} of ${release.totalEditions}</span>
                 <span class="availability-label">editions available</span>`
            }
          </div>
        </div>
      </div>
      
      <style>
        .release-modal-overlay {
          align-items: flex-start;
          padding-top: 40px;
        }
        .release-modal {
          max-width: 800px;
          width: 100%;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
          border-radius: var(--radius-xl);
          padding: 0;
        }
      .release-close-x {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          background: transparent;
          border: none;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          opacity: 0.8;
          padding: 0;
        }
        .release-close-x:hover {
          opacity: 1;
        }
        .release-header {
          padding: 24px 24px 24px;
          position: relative;
        }
        .release-header-content {
          display: flex;
          gap: 24px;
          align-items: flex-end;
        }
        .release-cover-small {
          width: 180px;
          height: 180px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .release-cover-small img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .release-header-info {
          flex: 1;
          min-width: 0;
        }
        .release-type-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .release-title-large {
          font-size: 36px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 8px 0 16px;
          line-height: 1.1;
        }
        .release-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }
        .release-meta-dot { opacity: 0.5; }
        .artist-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          font-weight: 600;
          padding: 0;
        }
        .artist-chip:hover { text-decoration: underline; }
        .artist-chip-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
        }
        
        .release-actions-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          background: var(--bg-primary);
        }
        .btn-play-large {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--success);
          border: none;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 100ms, background 100ms;
        }
        .btn-play-large:hover {
          transform: scale(1.05);
          background: #3be477;
        }
        .btn-play-large svg { margin-left: 2px; }
        .btn-icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid var(--text-muted);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms;
        }
        .btn-icon-circle:hover {
          border-color: var(--text-primary);
          color: var(--text-primary);
          transform: scale(1.05);
        }
        .buy-album-btn {
          margin-left: auto;
        }
        
        .release-track-list {
          padding: 0 24px;
        }
        .track-list-header {
          display: grid;
          grid-template-columns: 48px 1fr 80px 60px 70px 100px;
          gap: 16px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-color);
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .track-row {
          display: grid;
          grid-template-columns: 48px 1fr 80px 60px 60px 100px;
          gap: 16px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background 100ms;
        }
        .track-row:hover {
          background: var(--bg-hover);
        }
        .track-row:hover .track-num { display: none; }
        .track-row:hover .track-play-btn { display: flex; }
        .track-col-num {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        .track-col-avail {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--text-muted);
        }
       track-col-avail.low {
          color: var(--warning);
          font-weight: 600;
        }
       
        .track-play-btn {
          display: none;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
        }
        .track-col-title {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        .track-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-artist {
          font-size: 12px;
          color: var(--text-muted);
        }
        .track-col-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          transition: opacity 100ms;
        }
        .track-row:hover .track-col-actions { opacity: 1; }
        .track-action-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 100ms;
        }
        .track-action-btn:hover { color: var(--text-primary); }
        .track-col-duration {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: var(--text-muted);
          font-size: 14px;
        }
        .track-col-buy {
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .buy-track-btn {
          font-size: 12px;
          padding: 6px 12px;
          background: var(--accent);
          border-color: var(--accent);
        }
        .buy-track-btn:hover {
          background: var(--accent-hover);
        }
        .sold-out-label {
          font-size: 12px;
          color: var(--text-muted);
          font-style: italic;
        }
        
       .release-availability {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          font-size: 14px;
        }
        .release-availability:empty {
          display: none;
        }
        .availability-count {
          font-weight: 600;
          color: var(--accent);
        }
        .availability-label {
          color: var(--text-muted);
        }
       .first-edition-badge {
          position: absolute;
          top: 20px;
          right: 70px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          white-space: nowrap;
        }
        
        @media (max-width: 600px) {
          .release-header-content { flex-direction: column; align-items: center; text-align: center; }
          .release-cover-small { width: 150px; height: 150px; }
          .release-title-large { font-size: 24px; }
          .release-meta { justify-content: center; }
          .track-list-header { display: none; }
          .track-row { grid-template-columns: 32px 1fr auto; }
          .track-col-actions, .track-col-duration, .track-col-avail { display: none; }
          .track-col-buy .btn { font-size: 11px; padding: 4px 8px; }
        }
      </style>
    `;
    
    this.show(html);
    this.bindReleaseModalEvents(release);
  },
  
  getColorFromImage(url) {
    // Simple color extraction based on URL hash - could be enhanced
    if (!url) return 'var(--accent)';
    const hash = url.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 40%, 30%)`;
  },
  
  bindReleaseModalEvents(release) {
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    
    // Play button
    document.getElementById('play-release-btn')?.addEventListener('click', () => {
      if (release.tracks?.length > 0) {
        const queue = release.tracks.map((t, i) => ({
          id: parseInt(t.id) || i, trackId: t.id?.toString(),
          title: release.type === 'single' ? release.title : t.title,
          artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
          cover: release.coverUrl, ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
        }));
        Player.playTrack(queue[0], queue, 0);
      }
    });
    
    // Track row click to play
    document.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.buy-track-btn') || e.target.closest('.track-action-btn')) return;
        const idx = parseInt(row.dataset.trackIdx, 10);
        if (release.tracks?.[idx]) {
          const queue = release.tracks.map((t, i) => ({
            id: parseInt(t.id) || i, trackId: t.id?.toString(),
            title: release.type === 'single' ? release.title : t.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl, ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
          }));
          Player.playTrack(queue[idx], queue, idx);
        }
      });
    });
    
    // Track play buttons
    document.querySelectorAll('.track-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.trackIdx, 10);
        if (release.tracks?.[idx]) {
          const queue = release.tracks.map((t, i) => ({
            id: parseInt(t.id) || i, trackId: t.id?.toString(),
            title: release.type === 'single' ? release.title : t.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl, ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
          }));
          Player.playTrack(queue[idx], queue, idx);
        }
      });
    });
    
    // Buy single track
    document.querySelectorAll('.buy-track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!AppState.user?.address) { 
          this.showConnectWalletPrompt();
          return; 
        }
        const trackIdx = parseInt(btn.dataset.trackIdx, 10);
        const track = release.tracks?.[trackIdx];
        if (track) {
          this.showTrackPurchase(release, track, trackIdx);
        }
      });
    });
    
    // Buy full album
    document.getElementById('buy-album-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) { 
        this.showConnectWalletPrompt();
        return; 
      }
      this.showAlbumPurchase(release);
    });
    
    // Single release buy
    document.getElementById('buy-release-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) { 
        this.showConnectWalletPrompt();
        return; 
      }
      this.showPurchase(release);
    });
    
    // Artist link
    document.querySelector('.artist-chip')?.addEventListener('click', () => {
      this.close();
      Router.navigate('artist', { address: release.artistAddress });
    });
    
    // Like release
    document.getElementById('like-release-btn')?.addEventListener('click', () => {
      this.showToast('Liked Songs feature coming soon!');
    });
    
    // Add to playlist
    document.getElementById('add-to-playlist-btn')?.addEventListener('click', () => {
      this.showAddToPlaylist(release);
    });
    
    // Like track buttons
    document.querySelectorAll('.like-track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showToast('Liked Songs feature coming soon!');
      });
    });
    
    // Add track to playlist buttons
    document.querySelectorAll('.add-track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackIdx = parseInt(btn.dataset.trackIdx, 10);
        const track = release.tracks?.[trackIdx];
        if (track) {
          this.showAddToPlaylist(release, track);
        }
      });
    });
  },
  
  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card);
      color: var(--text-primary);
      padding: 12px 24px;
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      animation: slideUp 200ms ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
  
  showConnectWalletPrompt() {
    // Create a nice centered modal prompting user to connect wallet
    const overlay = document.createElement('div');
    overlay.className = 'connect-wallet-prompt-overlay';
    overlay.innerHTML = `
      <div class="connect-wallet-prompt">
        <div class="cwp-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
        </div>
        <h3 class="cwp-title">Connect Your Wallet</h3>
        <p class="cwp-text">To purchase NFTs, you need to connect your Xaman wallet first.</p>
        <p class="cwp-subtext">Don't have Xaman? <a href="https://xaman.app" target="_blank">Download it here</a> - it's the best XRP wallet!</p>
        <div class="cwp-actions">
          <button class="btn btn-primary cwp-connect-btn">Connect Wallet</button>
          <button class="btn btn-secondary cwp-cancel-btn">Maybe Later</button>
        </div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1002;
    `;
    
    const prompt = overlay.querySelector('.connect-wallet-prompt');
    prompt.style.cssText = `
      background: var(--bg-card);
      border-radius: var(--radius-xl);
      padding: 32px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 16px 64px rgba(0,0,0,0.5);
    `;
    
    // Style the inner elements
    overlay.querySelector('.cwp-icon').style.cssText = 'margin-bottom: 16px;';
    overlay.querySelector('.cwp-title').style.cssText = 'font-size: 24px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary);';
    overlay.querySelector('.cwp-text').style.cssText = 'color: var(--text-secondary); margin-bottom: 8px;';
    overlay.querySelector('.cwp-subtext').style.cssText = 'font-size: 13px; color: var(--text-muted); margin-bottom: 24px;';
    overlay.querySelector('.cwp-subtext a').style.cssText = 'color: var(--accent);';
    overlay.querySelector('.cwp-actions').style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    
    document.body.appendChild(overlay);
    
    // Bind events
    overlay.querySelector('.cwp-connect-btn').addEventListener('click', () => {
      overlay.remove();
      this.showAuth();
    });
    
    overlay.querySelector('.cwp-cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });
    
    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },
  
  showAddToPlaylist(release, track = null) {
    // TODO: Implement playlist picker modal
    this.showToast('Playlists feature coming soon!');
  },
  
  showTrackPurchase(release, track, trackIdx) {
    // Quick inline purchase confirmation
    const price = parseFloat(release.songPrice) || 0;
    const btn = document.querySelector(`.buy-track-btn[data-track-idx="${trackIdx}"]`);
    
    // If already in confirm state, process the purchase
    if (btn && btn.classList.contains('confirm-state')) {
      this.processQuickPurchase(release, track, trackIdx, btn);
      return;
    }
    
    // Change button to confirm state
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.classList.add('confirm-state');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Confirm
      `;
      btn.style.background = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      
      // Add cancel on click outside
      const cancelHandler = (e) => {
        if (!btn.contains(e.target)) {
          btn.classList.remove('confirm-state');
          btn.innerHTML = originalHTML;
          btn.style.background = '';
          btn.style.borderColor = '';
          document.removeEventListener('click', cancelHandler);
        }
      };
      
      // Delay adding listener to prevent immediate trigger
      setTimeout(() => {
        document.addEventListener('click', cancelHandler);
      }, 10);
      
      // Auto-cancel after 5 seconds
      setTimeout(() => {
        if (btn.classList.contains('confirm-state')) {
          btn.classList.remove('confirm-state');
          btn.innerHTML = originalHTML;
          btn.style.background = '';
          btn.style.borderColor = '';
        }
      }, 5000);
    }
  },
  
  async processQuickPurchase(release, track, trackIdx, btn) {
    const price = parseFloat(release.songPrice) || 0;
    const originalHTML = btn.innerHTML;
    
    // Show processing state on button
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>`;
    btn.style.background = 'var(--bg-hover)';
    btn.style.borderColor = 'var(--border-color)';
    btn.style.minWidth = '80px';
    
    // Create a prominent centered status overlay with purple theme
    const statusOverlay = document.createElement('div');
    statusOverlay.className = 'quick-purchase-status';
    statusOverlay.innerHTML = `
      <div class="qps-content">
        <div class="qps-icon">
          <div class="spinner" style="width:40px;height:40px;border-width:3px;border-color:rgba(255,255,255,0.2);border-top-color:#fff;"></div>
        </div>
        <div class="qps-text">
          <div class="qps-title">Opening Xaman...</div>
          <div class="qps-sub">Check your phone</div>
        </div>
        <div class="qps-tip">
          <strong>📱 In Xaman:</strong><br>
          1. Pull down on Events to refresh<br>
          2. Sign the first transaction<br>
          3. Pull down again to refresh<br>
          4. Sign the second transaction
        </div>
      </div>
    `;
    statusOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 40px 48px;
      box-shadow: 0 20px 60px rgba(124, 58, 237, 0.4), 0 0 40px rgba(124, 58, 237, 0.2);
      z-index: 1001;
      min-width: 320px;
      max-width: 400px;
      text-align: center;
      color: white;
    `;
    document.body.appendChild(statusOverlay);
    
    // Style the tip
    const tipEl = statusOverlay.querySelector('.qps-tip');
    if (tipEl) {
      tipEl.style.cssText = `
        margin-top: 20px;
        padding: 12px 16px;
        background: rgba(0,0,0,0.2);
        border-radius: 10px;
        font-size: 13px;
        color: rgba(255,255,255,0.8);
        line-height: 1.5;
      `;
    }
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'qps-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
    `;
    document.body.appendChild(backdrop);
    
    const updateStatus = (title, sub = '', isError = false, isSuccess = false) => {
      statusOverlay.querySelector('.qps-content').innerHTML = `
        <div class="qps-icon">
          ${isError ? `
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ` : isSuccess ? `
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          ` : `
            <div class="spinner" style="width:40px;height:40px;border-width:3px;border-color:rgba(255,255,255,0.2);border-top-color:#fff;"></div>
          `}
        </div>
        <div class="qps-text">
          <div class="qps-title" style="font-size:20px;font-weight:700;margin-top:16px;color:white;">${title}</div>
          ${sub ? `<div class="qps-sub" style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:8px;">${sub}</div>` : ''}
        </div>
        ${!isError && !isSuccess ? `
          <div class="qps-tip" style="margin-top:20px;padding:12px 16px;background:rgba(0,0,0,0.2);border-radius:10px;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.6;text-align:left;">
            <strong>📱 In Xaman:</strong><br>
            1. Pull down on Events to refresh<br>
            2. Sign the first transaction<br>
            3. Pull down again to refresh<br>
            4. Sign the second transaction
          </div>
        ` : ''}
      `;
    };
    
    const cleanup = () => {
      statusOverlay.remove();
      backdrop.remove();
    };
    
    try {
      // Step 1: Get platform address
      const configResponse = await fetch('/api/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConfig' }),
      });
      const configData = await configResponse.json();
      const platformAddress = configData.platformAddress;
      
      if (!platformAddress) throw new Error('Platform not configured');
      
      // Step 2: Buyer pays platform
      updateStatus('Approve Payment', 'Check Xaman on your phone');
      
      const paymentResult = await XamanWallet.sendPayment(
        platformAddress,
        price,
        `XRP Music: ${track.title}`
      );
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment cancelled');
      }
      
      // Step 3: Call broker API
      updateStatus('Preparing NFT', 'Processing your purchase...');
      
      const purchaseResponse = await fetch('/api/broker-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          trackId: track.id,  // Pass specific track ID
          buyerAddress: AppState.user.address,
          paymentTxHash: paymentResult.txHash,
        }),
      });
      
      const purchaseResult = await purchaseResponse.json();
      
      if (!purchaseResult.success) {
        // Check if refunded
        if (purchaseResult.refunded) {
          updateStatus('Purchase Failed', 'Your payment has been refunded ✓', true);
          setTimeout(() => {
            cleanup();
            // Reset button
            btn.disabled = false;
            btn.classList.remove('confirm-state');
            btn.innerHTML = originalHTML;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.minWidth = '';
          }, 3000);
          return;
        }
        throw new Error(purchaseResult.error || 'Transfer failed');
      }
      
      // Step 4: Accept NFT
      updateStatus('Accept NFT', 'Check Xaman on your phone');
      
      const acceptResult = await XamanWallet.acceptSellOffer(purchaseResult.sellOfferIndex);
      
      if (!acceptResult.success) {
        throw new Error(acceptResult.error || 'NFT transfer failed');
      }
      
      // Step 5: Confirm the sale in database (only after NFT successfully transferred)
      updateStatus('Confirming purchase...', 'Almost done!');
      
      try {
        await fetch('/api/broker-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm',
            pendingSale: purchaseResult.pendingSale,
            acceptTxHash: acceptResult.txHash,
          }),
        });
      } catch (confirmErr) {
        console.error('Failed to confirm sale in DB:', confirmErr);
        // Don't throw - user still got their NFT
      }
      
      // Success!
      updateStatus('NFT Purchased! 🎉', 'Redirecting to your collection...', false, true);
      
      // Update button to show "Owned"
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01" fill="none" stroke="currentColor" stroke-width="2"></polyline>
        </svg>
        Owned
      `;
      btn.style.background = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      btn.style.opacity = '0.8';
      btn.classList.remove('confirm-state');
      
      // Update availability display
      this.updateTrackAvailability(release, trackIdx);
      
      // Redirect to profile NFTs tab after delay
      setTimeout(() => {
        cleanup();
        this.close();
        ProfilePage.activeTab = 'nfts';
        Router.navigate('profile');
      }, 2000);
      
    } catch (error) {
      console.error('Quick purchase failed:', error);
      
      // Show error
      updateStatus('Purchase Failed', error.message, true);
      
      // Reset button after delay
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('confirm-state');
        btn.innerHTML = originalHTML;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.minWidth = '';
        cleanup();
      }, 3000);
    }
  },
  
  // Update availability display after purchase
  updateTrackAvailability(release, purchasedTrackIdx) {
    // Update the track availability display
    const trackRows = document.querySelectorAll('.track-row');
    let minAvailability = Infinity;
    let totalEditions = 0;
    
    trackRows.forEach((row, idx) => {
      const availEl = row.querySelector('.track-col-avail');
      if (availEl) {
        // Parse current availability
        const current = availEl.textContent;
        const match = current.match(/(\d+)\/(\d+)/);
        if (match) {
          let trackAvail = parseInt(match[1]);
          totalEditions = parseInt(match[2]);
          
          // Decrement if this is the purchased track
          if (idx === purchasedTrackIdx) {
            trackAvail = Math.max(0, trackAvail - 1);
            availEl.textContent = `${trackAvail}/${totalEditions}`;
            if (trackAvail < 5) {
              availEl.classList.add('low');
            }
          }
          
          // Track minimum across all tracks
          minAvailability = Math.min(minAvailability, trackAvail);
        }
      }
    });
    
    // Update the album availability badge (minimum of all tracks)
    const albumAvailEl = document.querySelector('.availability-count');
    if (albumAvailEl && minAvailability !== Infinity) {
      albumAvailEl.textContent = `${minAvailability} of ${totalEditions}`;
    }
  },
  
  showAlbumPurchase(release) {
    // Purchase all tracks in album
    this.activeModal = 'album-purchase';
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    const totalPrice = trackPrice * trackCount;
    
    const html = `
      <div class="modal-overlay purchase-modal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">Buy Full ${release.type === 'album' ? 'Album' : 'EP'}</div>
            <button class="modal-close close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="purchase-item">
              <div class="purchase-cover">
                ${release.coverUrl ? `<img src="${release.coverUrl}" alt="${release.title}">` : ''}
              </div>
              <div class="purchase-details">
                <div class="purchase-title">${release.title}</div>
                <div class="purchase-artist">${release.artistName}</div>
                <div class="purchase-type">${trackCount} tracks</div>
              </div>
            </div>
            
            <div class="purchase-summary">
              <div class="purchase-row">
                <span>${trackCount} NFTs × ${trackPrice} XRP</span>
                <span>${totalPrice} XRP</span>
              </div>
              <div class="purchase-row">
                <span>Network Fee</span>
                <span>~0.00001 XRP</span>
              </div>
              <div class="purchase-row purchase-total">
                <span>Total</span>
                <span>${totalPrice} XRP</span>
              </div>
            </div>
            
            <div class="purchase-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span><strong>2 signatures required:</strong> Payment + NFT transfers</span>
            </div>
            
            <div class="purchase-status" id="album-purchase-status" style="display: none;">
              <div class="purchase-status-icon"><div class="spinner"></div></div>
              <div class="purchase-status-text">Processing...</div>
              <div class="purchase-status-sub">Check Xaman</div>
            </div>
            
            <div class="purchase-actions" id="album-purchase-actions">
              <button class="btn btn-secondary close-modal-btn">Cancel</button>
              <button class="btn btn-primary" id="confirm-album-purchase">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Pay ${totalPrice} XRP
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.show(html);
    
    document.getElementById('confirm-album-purchase')?.addEventListener('click', async () => {
      await this.processAlbumPurchase(release);
    });
  },
  
  async processAlbumPurchase(release) {
    const statusEl = document.getElementById('album-purchase-status');
    const actionsEl = document.getElementById('album-purchase-actions');
    const trackPrice = parseFloat(release.songPrice) || 0;
    const trackCount = release.tracks?.length || 1;
    const totalPrice = trackPrice * trackCount;
    
    if (statusEl) statusEl.style.display = 'block';
    if (actionsEl) actionsEl.style.display = 'none';
    
    try {
      // Step 1: Send payment
      statusEl.innerHTML = `
        <div class="purchase-status-icon"><div class="spinner"></div></div>
        <div class="purchase-status-text">Sending payment...</div>
        <div class="purchase-status-sub">Approve ${totalPrice} XRP in Xaman</div>
      `;
      
      const configResponse = await fetch('/api/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConfig' }),
      });
      const configData = await configResponse.json();
      const platformAddress = configData.platformAddress;
      
      const paymentResult = await XamanWallet.sendPayment(
        platformAddress,
        totalPrice,
        `XRP Music: ${release.title} (Full Album)`
      );
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }
      
      // Step 2: Process album purchase on backend
      statusEl.innerHTML = `
        <div class="purchase-status-icon"><div class="spinner"></div></div>
        <div class="purchase-status-text">Processing ${trackCount} NFTs...</div>
        <div class="purchase-status-sub">This may take a moment</div>
      `;
      
      const purchaseResponse = await fetch('/api/broker-album-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          buyerAddress: AppState.user.address,
          paymentTxHash: paymentResult.txHash,
          trackCount: trackCount,
        }),
      });
      
      const purchaseResult = await purchaseResponse.json();
      
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || 'Purchase failed');
      }
      
      // Step 3: Accept all NFT offers
      statusEl.innerHTML = `
        <div class="purchase-status-icon"><div class="spinner"></div></div>
        <div class="purchase-status-text">Accept NFT transfers...</div>
        <div class="purchase-status-sub">Sign in Xaman to receive ${trackCount} NFTs</div>
      `;
      
      // Accept each offer sequentially
      for (let i = 0; i < purchaseResult.offerIndexes.length; i++) {
        const offerIndex = purchaseResult.offerIndexes[i];
        statusEl.querySelector('.purchase-status-sub').textContent = 
          `Accepting NFT ${i + 1} of ${purchaseResult.offerIndexes.length}...`;
        
        const acceptResult = await XamanWallet.acceptSellOffer(offerIndex);
        if (!acceptResult.success) {
          throw new Error(`Failed to accept NFT ${i + 1}`);
        }
      }
      
      // Success!
      statusEl.innerHTML = `
        <div class="purchase-status-icon success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="purchase-status-text">Album Purchased! 🎉</div>
        <div class="purchase-status-sub">Redirecting to your collection...</div>
      `;
      
      // Auto-redirect to profile NFTs tab
      setTimeout(() => {
        this.close();
        ProfilePage.activeTab = 'nfts';
        Router.navigate('profile');
      }, 2000);
      
    } catch (error) {
      console.error('Album purchase failed:', error);
      statusEl.innerHTML = `
        <div class="purchase-status-icon error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="purchase-status-text">Purchase Failed</div>
        <div class="purchase-status-sub">${error.message}</div>
      `;
      if (actionsEl) actionsEl.style.display = 'flex';
    }
  },
  
  showCreate() {
    if (!AppState.user?.address) { this.showAuth(); return; }
    this.activeModal = 'create';
    
    const html = `
      <div class="modal-overlay">
        <div class="modal create-modal">
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
            <form id="create-release-form">
              <!-- Step 1: Basic Info -->
              <div class="create-step" id="create-step-1">
                <h3 class="create-step-title">Release Details</h3>
                
                <input type="hidden" name="type" id="release-type" value="release">
                
                <div class="form-group">
                  <label class="form-label">Title *</label>
                  <input type="text" class="form-input" name="title" id="release-title" placeholder="Release title" required>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Description</label>
                  <textarea class="form-input form-textarea" name="description" id="release-description" placeholder="Tell listeners about this release"></textarea>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Price (XRP) *</label>
                    <input type="number" class="form-input" name="price" id="release-price" placeholder="0.5" step="0.01" min="0" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Editions *</label>
                    <input type="number" class="form-input" name="editions" id="release-editions" placeholder="100" min="1" max="200" value="100" required>
                  </div>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Resale Royalty %</label>
                  <p class="form-hint" style="margin-bottom: 8px;">You'll earn this % on every secondary sale of your NFT</p>
                  <input type="number" class="form-input" id="release-royalty" name="royalty" value="5" min="0" max="50" step="0.5" style="max-width: 120px;">
                </div>
                
                <div class="mint-fee-preview">
                  <span>Mint Fee:</span>
                  <span id="mint-fee-amount">Calculated after upload</span>
                </div>
                
                <button type="button" class="btn btn-primary btn-full" id="create-next-1">Next: Upload Files</button>
              </div>
              
              <!-- Step 2: Upload Files -->
              <div class="create-step hidden" id="create-step-2">
                <h3 class="create-step-title">Upload Files</h3>
                
                <div class="form-group">
                  <label class="form-label">Cover Art *</label>
                  <div class="upload-zone" id="cover-upload-zone">
                    <input type="file" id="cover-input" accept="image/*" hidden>
                    <div class="upload-placeholder" id="cover-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      <span>Click to upload cover art</span>
                      <span class="upload-hint">JPG, PNG, or GIF (max 10MB)</span>
                    </div>
                    <div class="upload-preview hidden" id="cover-preview">
                      <img id="cover-preview-img" src="" alt="Cover preview">
                      <button type="button" class="upload-remove" id="cover-remove">×</button>
                    </div>
                  </div>
                  <input type="hidden" name="coverCid" id="cover-cid">
                  <input type="hidden" name="coverUrl" id="cover-url">
                </div>
                
                <div class="form-group">
                  <label class="form-label">Audio File(s) *</label>
                  <p class="form-hint" style="margin-bottom: 8px;">Upload 1 song for a single, or multiple for an album</p>
                  <div class="upload-zone audio-zone" id="audio-upload-zone">
                    <input type="file" id="audio-input" accept="audio/*" multiple hidden>
                    <div class="upload-placeholder" id="audio-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                      <span>Click to upload audio</span>
                      <span class="upload-hint">MP3, WAV, or FLAC (max 50MB)</span>
                    </div>
                  </div>
                  <div class="track-list-upload" id="track-list-upload"></div>
                </div>
                
                <div class="create-nav">
                  <button type="button" class="btn btn-secondary" id="create-back-2">Back</button>
                  <button type="button" class="btn btn-primary" id="create-next-2">Next: Review</button>
                </div>
              </div>
              
              <!-- Step 3: Review & Mint -->
              <div class="create-step hidden" id="create-step-3">
                <h3 class="create-step-title">Review & Mint</h3>
                
                <div class="review-card">
                  <div class="review-cover" id="review-cover"></div>
                  <div class="review-info">
                    <div class="review-title" id="review-title"></div>
                    <div class="review-artist">${AppState.profile?.name || Helpers.truncateAddress(AppState.user.address)}</div>
                    <div class="review-meta">
                      <span id="review-type"></span>
                      <span id="review-tracks"></span>
                    </div>
                  </div>
                </div>
                
                <div class="review-details">
                  <div class="review-row">
                    <span>Price</span>
                    <span id="review-price"></span>
                  </div>
                  <div class="review-row">
                    <span>Editions</span>
                    <span id="review-editions"></span>
                  </div>
                  <div class="review-row">
                    <span>Resale Royalty</span>
                    <span id="review-royalty"></span>
                  </div>
                  <div class="review-row mint-fee-row">
                    <span>Mint Fee (one-time)</span>
                    <span id="review-mint-fee"></span>
                  </div>
                </div>
                
                <div class="mint-status hidden" id="mint-status">
                  <div class="mint-status-icon">
                    <div class="spinner"></div>
                  </div>
                  <div class="mint-status-text" id="mint-status-text">Preparing...</div>
                </div>
                
                <div class="create-nav" id="create-nav-3">
                  <button type="button" class="btn btn-secondary" id="create-back-3">Back</button>
                  <button type="submit" class="btn btn-primary btn-mint">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                      <path d="M2 17l10 5 10-5"></path>
                      <path d="M2 12l10 5 10-5"></path>
                    </svg>
                    Mint NFT
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <style>
        .create-modal { max-width: 540px; }
        .create-step-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 20px; }
        .create-step.hidden { display: none; }
        .release-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 8px; }
        .release-type-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; background: var(--bg-hover); border: 2px solid var(--border-color); border-radius: var(--radius-lg); color: var(--text-secondary); cursor: pointer; transition: all 150ms; }
        .release-type-btn:hover { border-color: var(--text-muted); color: var(--text-primary); }
        .release-type-btn.selected { border-color: var(--accent); background: rgba(59, 130, 246, 0.1); color: var(--accent); }
        .release-type-btn span { font-size: 13px; font-weight: 500; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .mint-fee-preview { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--bg-hover); border-radius: var(--radius-md); margin-top: 16px; font-size: 14px; }
        .mint-fee-preview span:first-child { color: var(--text-secondary); }
        .mint-fee-preview span:last-child { color: var(--text-primary); font-weight: 500; }
        .mint-fee-row { border-top: 1px solid var(--border-color); margin-top: 8px; padding-top: 12px !important; }
        .upload-zone { border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 24px; text-align: center; cursor: pointer; transition: all 150ms; }
        .upload-zone:hover { border-color: var(--accent); background: rgba(59, 130, 246, 0.05); }
        .upload-zone.dragover { border-color: var(--accent); background: rgba(59, 130, 246, 0.1); }
        .upload-zone.has-file { border-style: solid; border-color: var(--success); }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-muted); }
        .upload-placeholder svg { opacity: 0.5; }
        .upload-hint { font-size: 12px; }
        .upload-preview { position: relative; }
        .upload-preview img { width: 100%; max-width: 200px; border-radius: var(--radius-md); }
        .upload-preview.hidden { display: none; }
        .upload-remove { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--error); border: none; border-radius: 50%; color: white; font-size: 16px; cursor: pointer; }
        .track-list-upload { margin-top: 12px; }
        .track-upload-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-hover); border-radius: var(--radius-md); margin-bottom: 8px; }
        .track-upload-item .track-num { width: 24px; height: 24px; background: var(--accent); border-radius: 50%; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .track-upload-item .track-name { flex: 1; font-size: 14px; }
        .track-upload-item .track-name-input { flex: 1; font-size: 14px; background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 4px 8px; color: var(--text-primary); outline: none; }
        .track-upload-item .track-name-input:hover { border-color: var(--border); }
        .track-upload-item .track-name-input:focus { border-color: var(--accent); background: var(--bg-card); }
        .track-upload-item .track-duration { font-size: 13px; color: var(--text-muted); }
        .track-upload-item .track-status { font-size: 12px; }
        .track-upload-item .track-status.uploading { color: var(--warning); }
        .track-upload-item .track-status.done { color: var(--success); }
        .track-upload-item .track-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
        .track-upload-item .track-remove:hover { color: var(--error); }
        .create-nav { display: flex; gap: 12px; margin-top: 24px; }
        .create-nav .btn { flex: 1; }
        .btn-full { width: 100%; margin-top: 24px; }
        .review-card { display: flex; gap: 16px; padding: 16px; background: var(--bg-hover); border-radius: var(--radius-lg); margin-bottom: 20px; }
        .review-cover { width: 100px; height: 100px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); }
        .review-cover img { width: 100%; height: 100%; object-fit: cover; }
        .review-info { flex: 1; }
        .review-title { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
        .review-artist { font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }
        .review-meta { font-size: 13px; color: var(--text-muted); }
        .review-meta span { margin-right: 12px; }
        .review-details { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; }
        .review-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .review-row span:first-child { color: var(--text-secondary); }
        .review-row span:last-child { color: var(--text-primary); font-weight: 500; }
        .mint-status { text-align: center; padding: 24px; margin-bottom: 20px; }
        .mint-status.hidden { display: none; }
        .mint-status-icon { margin-bottom: 12px; }
        .mint-status-icon .spinner { width: 40px; height: 40px; margin: 0 auto; }
        .mint-status-text { font-size: 14px; color: var(--text-secondary); }
        .btn-mint { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .mint-success { text-align: center; }
        .mint-success-cover { width: 120px; height: 120px; margin: 0 auto 16px; border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); position: relative; }
        .mint-success-cover img { width: 100%; height: 100%; object-fit: cover; }
        .mint-success-icon { position: absolute; bottom: -8px; right: calc(50% - 76px); width: 32px; height: 32px; background: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .mint-success-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .mint-success-stats { font-size: 14px; color: var(--accent); margin-bottom: 8px; }
        .mint-success-msg { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
        .mint-success-actions { display: flex; gap: 12px; justify-content: center; }
        .mint-success-actions .btn { min-width: 120px; }
      </style>
    `;
    
    this.show(html);
    this.bindCreateEvents();
  },
  
  bindCreateEvents() {
    const form = document.getElementById('create-release-form');
    const tracks = [];
    let coverFile = null;
    
    // Calculate mint fee: tracks × editions × network fee + buffer
    function calculateMintFee(editions, trackCount = 1) {
      const totalNFTs = trackCount * editions;
      const networkFee = totalNFTs * 0.000012;
      const buffer = 0.001;
      return (networkFee + buffer).toFixed(6);
    }
    
    // Update mint fee display
    function updateMintFee() {
      const editions = parseInt(document.getElementById('release-editions').value) || 1;
      const trackCount = tracks.length;
      const feeDisplay = document.getElementById('mint-fee-amount');
      
      if (trackCount === 0) {
        // No tracks yet - can't calculate
        if (feeDisplay) feeDisplay.textContent = 'Calculated after upload';
      } else {
        const fee = calculateMintFee(editions, trackCount);
        const totalNFTs = trackCount * editions;
        if (feeDisplay) {
          feeDisplay.textContent = `~${fee} XRP (${totalNFTs} NFTs)`;
        }
      }
    }
    
    // Editions input - update mint fee
    document.getElementById('release-editions')?.addEventListener('input', updateMintFee);
    
    // Initialize mint fee
    updateMintFee();
    
    // Step navigation
    document.getElementById('create-next-1')?.addEventListener('click', () => {
      const title = document.getElementById('release-title').value.trim();
      const price = document.getElementById('release-price').value;
      if (!title) { alert('Please enter a title'); return; }
      if (!price || price <= 0) { alert('Please enter a valid price'); return; }
      document.getElementById('create-step-1').classList.add('hidden');
      document.getElementById('create-step-2').classList.remove('hidden');
    });
    
    document.getElementById('create-back-2')?.addEventListener('click', () => {
      document.getElementById('create-step-2').classList.add('hidden');
      document.getElementById('create-step-1').classList.remove('hidden');
    });
    
    document.getElementById('create-next-2')?.addEventListener('click', () => {
      if (!coverFile) { alert('Please upload cover art'); return; }
      if (tracks.length === 0) { alert('Please upload at least one audio file'); return; }
      
      const editions = parseInt(document.getElementById('release-editions').value) || 1;
      const royalty = document.getElementById('release-royalty').value;
      const totalNFTs = tracks.length * editions;
      const mintFee = calculateMintFee(editions, tracks.length);
      
      // Auto-detect type based on track count
      const releaseType = tracks.length === 1 ? 'single' : 'album';
      document.getElementById('release-type').value = releaseType;
      
      // Update review
      document.getElementById('review-cover').innerHTML = `<img src="${URL.createObjectURL(coverFile)}" alt="Cover">`;
      document.getElementById('review-title').textContent = document.getElementById('release-title').value;
      document.getElementById('review-type').textContent = releaseType.toUpperCase();
      document.getElementById('review-tracks').textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
      document.getElementById('review-price').textContent = `${document.getElementById('release-price').value} XRP per track`;
      document.getElementById('review-editions').textContent = `${editions} editions × ${tracks.length} tracks = ${totalNFTs} NFTs`;
      document.getElementById('review-royalty').textContent = `${royalty}%`;
      document.getElementById('review-mint-fee').textContent = `${mintFee} XRP`;
      
      document.getElementById('create-step-2').classList.add('hidden');
      document.getElementById('create-step-3').classList.remove('hidden');
    });
    
    document.getElementById('create-back-3')?.addEventListener('click', () => {
      document.getElementById('create-step-3').classList.add('hidden');
      document.getElementById('create-step-2').classList.remove('hidden');
    });
    
    // Cover upload
    const coverZone = document.getElementById('cover-upload-zone');
    const coverInput = document.getElementById('cover-input');
    
    coverZone?.addEventListener('click', () => coverInput?.click());
    coverZone?.addEventListener('dragover', (e) => { e.preventDefault(); coverZone.classList.add('dragover'); });
    coverZone?.addEventListener('dragleave', () => coverZone.classList.remove('dragover'));
    coverZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      coverZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleCoverFile(e.dataTransfer.files[0]);
    });
    
    coverInput?.addEventListener('change', () => {
      if (coverInput.files[0]) handleCoverFile(coverInput.files[0]);
    });
    
    document.getElementById('cover-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      coverFile = null;
      document.getElementById('cover-placeholder').classList.remove('hidden');
      document.getElementById('cover-preview').classList.add('hidden');
      coverZone.classList.remove('has-file');
    });
    
    function handleCoverFile(file) {
      if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
      if (file.size > 10 * 1024 * 1024) { alert('File too large (max 10MB)'); return; }
      
      coverFile = file;
      const preview = document.getElementById('cover-preview-img');
      preview.src = URL.createObjectURL(file);
      document.getElementById('cover-placeholder').classList.add('hidden');
      document.getElementById('cover-preview').classList.remove('hidden');
      coverZone.classList.add('has-file');
    }
    
    // Audio upload
    const audioZone = document.getElementById('audio-upload-zone');
    const audioInput = document.getElementById('audio-input');
    
    audioZone?.addEventListener('click', () => audioInput?.click());
    audioZone?.addEventListener('dragover', (e) => { e.preventDefault(); audioZone.classList.add('dragover'); });
    audioZone?.addEventListener('dragleave', () => audioZone.classList.remove('dragover'));
    audioZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      audioZone.classList.remove('dragover');
      Array.from(e.dataTransfer.files).forEach(handleAudioFile);
    });
    
    audioInput?.addEventListener('change', () => {
      Array.from(audioInput.files).forEach(handleAudioFile);
    });
    
    function handleAudioFile(file) {
      if (!file.type.startsWith('audio/')) { alert('Please upload an audio file'); return; }
      if (file.size > 50 * 1024 * 1024) { alert('File too large (max 50MB)'); return; }
      
      const trackNum = tracks.length + 1;
      const track = {
        file,
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: 0,
        status: 'pending',
      };
      tracks.push(track);
      
      // Get duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.addEventListener('loadedmetadata', () => {
        track.duration = audio.duration;
        updateTrackList();
      });
      
      updateTrackList();
    }
    
    function updateTrackList() {
      const container = document.getElementById('track-list-upload');
      container.innerHTML = tracks.map((track, idx) => `
        <div class="track-upload-item" data-idx="${idx}">
          <div class="track-num">${idx + 1}</div>
          <input type="text" class="track-name-input" value="${track.title.replace(/"/g, '&quot;')}" data-idx="${idx}" placeholder="Track name">
          <div class="track-duration">${track.duration ? Helpers.formatDuration(track.duration) : '--:--'}</div>
          <div class="track-status ${track.status}">${track.status === 'done' ? '✓' : track.status === 'uploading' ? 'Uploading...' : ''}</div>
          <button type="button" class="track-remove" data-idx="${idx}">×</button>
        </div>
      `).join('');
      
      // Track name editing - save on every keystroke
      container.querySelectorAll('.track-name-input').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx);
          tracks[idx].title = input.value.trim() || `Track ${idx + 1}`;
        });
      });
      
      container.querySelectorAll('.track-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          tracks.splice(parseInt(btn.dataset.idx), 1);
          updateTrackList();
        });
      });
      
      if (tracks.length > 0) {
        audioZone.classList.add('has-file');
      } else {
        audioZone.classList.remove('has-file');
      }
      
      // Recalculate mint fee when tracks change
      updateMintFee();
    }
    
    // Form submit - Mint NFT
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const statusEl = document.getElementById('mint-status');
      const statusText = document.getElementById('mint-status-text');
      const navEl = document.getElementById('create-nav-3');
      
      statusEl.classList.remove('hidden');
      navEl.style.display = 'none';
      
      // Helper to show status with patience message
      const showStatus = (step, total, message, submessage) => {
        statusEl.innerHTML = `
          <div class="mint-status-icon">
            <div class="spinner"></div>
          </div>
          <div class="mint-status-text">Step ${step}/${total}: ${message}</div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${submessage}</p>
          <p style="font-size: 11px; color: var(--text-muted); margin-top: 12px; opacity: 0.7;">⏳ Please be patient and don't close this page</p>
        `;
      };
      
      try {
        // Step 1: Upload cover to IPFS
        showStatus(1, 5, 'Uploading cover art...', 'This may take a moment depending on file size');
        const coverResult = await API.uploadFile(coverFile);
        document.getElementById('cover-cid').value = coverResult.cid;
        document.getElementById('cover-url').value = coverResult.url;
        
        // Step 2: Upload audio files to IPFS
        const uploadedTracks = [];
        for (let i = 0; i < tracks.length; i++) {
          showStatus(2, 5, `Uploading track ${i + 1} of ${tracks.length}...`, 'Audio files take longer to upload');
          tracks[i].status = 'uploading';
          updateTrackList();
          
          const audioResult = await API.uploadFile(tracks[i].file);
          tracks[i].status = 'done';
          tracks[i].audioCid = audioResult.cid;
          tracks[i].audioUrl = audioResult.url;
          uploadedTracks.push({
            title: tracks[i].title,
            trackNumber: i + 1,
            duration: Math.round(tracks[i].duration),
            audioCid: audioResult.cid,
            audioUrl: audioResult.url,
          });
          updateTrackList();
        }
        
        // Step 3: Create metadata JSON(s)
        showStatus(3, 5, 'Creating metadata...', 'Almost ready for Xaman signatures');
        const releaseType = document.getElementById('release-type').value;
        const releaseTitle = document.getElementById('release-title').value;
        const releaseDescription = document.getElementById('release-description').value;
        const artistName = AppState.profile?.name || AppState.user.address;
        
        // Create individual metadata for EACH track (for NFT minting)
        const trackMetadataUris = [];
        for (let i = 0; i < uploadedTracks.length; i++) {
          const track = uploadedTracks[i];
          const trackMetadata = {
            name: uploadedTracks.length === 1 ? releaseTitle : `${releaseTitle} - ${track.title}`,
            description: releaseDescription,
            image: `ipfs://${coverResult.cid}`,
            animation_url: `ipfs://${track.audioCid}`,
            attributes: [
              { trait_type: 'Type', value: releaseType },
              { trait_type: 'Artist', value: artistName },
              { trait_type: 'Album', value: releaseTitle },
              { trait_type: 'Track Number', value: i + 1 },
              { trait_type: 'Total Tracks', value: uploadedTracks.length },
            ],
            properties: {
              title: track.title,
              duration: track.duration,
              audio: `ipfs://${track.audioCid}`,
              albumTitle: releaseTitle,
              trackNumber: i + 1,
            },
          };
          
          showStatus(3, 5, `Creating metadata ${i + 1}/${uploadedTracks.length}...`, 'Preparing track data');
          const result = await API.uploadJSON(trackMetadata, `${releaseTitle}-track${i + 1}-metadata.json`);
          trackMetadataUris.push(result.ipfsUrl);
          uploadedTracks[i].metadataCid = result.cid;
          uploadedTracks[i].metadataUrl = result.ipfsUrl;
        }
        
        // Also create album-level metadata for display purposes
        const albumMetadata = {
          name: releaseTitle,
          description: releaseDescription,
          image: `ipfs://${coverResult.cid}`,
          attributes: [
            { trait_type: 'Type', value: releaseType },
            { trait_type: 'Artist', value: artistName },
            { trait_type: 'Tracks', value: uploadedTracks.length },
          ],
          properties: {
            tracks: uploadedTracks.map(t => ({
              title: t.title,
              duration: t.duration,
              audio: `ipfs://${t.audioCid}`,
              metadataUri: t.metadataUrl,
            })),
          },
        };
        const albumMetadataResult = await API.uploadJSON(albumMetadata, `${releaseTitle}-album-metadata.json`);
        
        // Step 4: Mint NFTs (pay fee, authorize, then backend mints)
        const editions = parseInt(document.getElementById('release-editions').value) || 1;
        const royaltyPercent = parseFloat(document.getElementById('release-royalty').value) || 5;
        const transferFee = Math.round(royaltyPercent * 100); // Convert % to basis points (5% = 500)
        const totalNFTs = uploadedTracks.length * editions;
        
        // Show Xaman prep message
        statusEl.innerHTML = `
          <div class="mint-status-icon">
            <div class="spinner"></div>
          </div>
          <div class="mint-status-text" style="font-size: 15px; font-weight: 600;">Get ready to sign in Xaman!</div>
          <p style="font-size: 13px; color: var(--accent); margin-top: 12px;">📱 You'll sign 2 transactions:</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">1. Pay mint fee to platform</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">2. Authorize NFT creation</p>
          <p style="font-size: 11px; color: var(--text-muted); margin-top: 12px; opacity: 0.7;">Minting ${totalNFTs} NFTs (${uploadedTracks.length} tracks × ${editions} editions)</p>
        `;
        
        // Pass track URIs for multi-track albums, or single URI for singles
        const mintResult = await XamanWallet.mintNFT(trackMetadataUris[0], {
          quantity: editions,
          transferFee: transferFee,
          tracks: uploadedTracks.length > 1 ? trackMetadataUris : null,
          onProgress: (progress) => {
            if (progress.stage === 'paying') {
              statusEl.innerHTML = `
                <div class="mint-status-icon">
                  <div class="spinner"></div>
                </div>
                <div class="mint-status-text">Step 4/5: Sign payment in Xaman</div>
                <p style="font-size: 13px; color: var(--accent); margin-top: 8px;">📱 Transaction 1 of 2</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Pay mint fee to platform</p>
              `;
            } else if (progress.stage === 'authorizing') {
              statusEl.innerHTML = `
                <div class="mint-status-icon">
                  <div class="spinner"></div>
                </div>
                <div class="mint-status-text">Step 4/5: Sign authorization in Xaman</div>
                <p style="font-size: 13px; color: var(--accent); margin-top: 8px;">📱 Transaction 2 of 2</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Authorize XRP Music to mint your NFTs</p>
              `;
            } else if (progress.stage === 'minting') {
              statusEl.innerHTML = `
                <div class="mint-status-icon">
                  <div class="spinner"></div>
                </div>
                <div class="mint-status-text">Step 5/5: Minting ${progress.quantity} NFTs...</div>
                <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;">Saving your music forever to the XRP Ledger ⛓️</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Thanks for your patience!</p>
                <p style="font-size: 12px; color: #f59e0b; margin-top: 8px; font-weight: 500;">⚠️ Please don't close or refresh this page</p>
              `;
            }
          },
        });
        
        if (!mintResult.success) {
          throw new Error(mintResult.error || 'Minting failed');
        }
        
        showStatus(5, 5, 'Saving release...', 'Almost done!');
        
        // Step 5: Save to database
        const releaseData = {
          artistAddress: AppState.user.address,
          artistName: AppState.profile?.name || null,
          title: releaseTitle,
          description: releaseDescription,
          type: releaseType,
          coverUrl: coverResult.url,
          coverCid: coverResult.cid,
          metadataCid: albumMetadataResult.cid,
          songPrice: parseFloat(document.getElementById('release-price').value),
          albumPrice: releaseType !== 'single' ? parseFloat(document.getElementById('release-price').value) * uploadedTracks.length : null,
          totalEditions: editions,
          editionsPerTrack: editions,
          nftTokenIds: mintResult.nftTokenIds,
          txHash: mintResult.txHash,
          tracks: uploadedTracks.map((t, i) => ({
            ...t,
            soldEditions: 0,
            availableEditions: editions,
          })),
          sellOfferIndex: 'platform-owned', // Mark as ready to sell
        };
        
        await API.saveRelease(releaseData);
        
        // Success - NFTs minted and ready to sell!
        statusEl.innerHTML = `
          <div class="mint-success">
            <div class="mint-success-cover">
              <img src="${URL.createObjectURL(coverFile)}" alt="Cover">
            </div>
            <div class="mint-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div class="mint-success-title">${releaseTitle}</div>
            <div class="mint-success-stats">${uploadedTracks.length} track${uploadedTracks.length > 1 ? 's' : ''} • ${mintResult.totalMinted} NFTs minted</div>
            <p class="mint-success-msg">Your music is now live on the XRP Ledger!</p>
            <div class="mint-success-actions">
              <button type="button" class="btn btn-secondary" onclick="window.open('https://x.com/intent/tweet?text=${encodeURIComponent('Just dropped my music as NFTs on @XRP_MUSIC! 🎵\\n\\nOwn it forever on the XRP Ledger.')}', '_blank')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share
              </button>
              <button type="button" class="btn btn-primary" id="mint-success-done">View Release</button>
            </div>
          </div>
        `;
        
        document.getElementById('mint-success-done')?.addEventListener('click', () => {
          this.close();
          Router.navigate('profile');
        });
        
      } catch (error) {
        console.error('Mint failed:', error);
        statusEl.innerHTML = `
          <div class="mint-status-icon" style="color: var(--error);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div class="mint-status-text" style="color: var(--error);">${error.message || 'Minting failed'}</div>
        `;
        navEl.style.display = 'flex';
      }
    });
  },
  
  /**
   * Start the list-for-sale flow
   * Creates NFTokenCreateOffer with platform as destination
   */
  async startListForSale(releaseId, nftTokenId, releaseData) {
    const statusEl = document.querySelector('.mint-status');
    if (!statusEl) return;
    
    statusEl.innerHTML = `
      <div class="spinner" style="margin: 0 auto 16px;"></div>
      <div class="mint-status-text">Creating sell offer...</div>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">Please approve in Xaman</p>
    `;
    
    try {
      // Get platform address from API
      const listResponse = await fetch('/api/list-for-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId, nftTokenId }),
      });
      
      const listData = await listResponse.json();
      if (!listData.success) throw new Error(listData.error);
      
      const { platformAddress } = listData.payload;
      const priceInDrops = Math.floor(parseFloat(releaseData.songPrice || releaseData.albumPrice || 1) * 1000000);
      
      // Create NFTokenCreateOffer via Xaman
      const offerResult = await XamanWallet.createSellOffer(nftTokenId, priceInDrops, platformAddress);
      
      if (!offerResult.success) throw new Error('Failed to create sell offer');
      
      // Save the offer index
      await fetch('/api/list-for-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          releaseId, 
          offerIndex: offerResult.offerIndex 
        }),
      });
      
      // Success!
      statusEl.innerHTML = `
        <div class="mint-status-icon" style="color: var(--success);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="mint-status-text" style="color: var(--success); font-weight: 600;">Listed for Sale!</div>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">Your release is now available for purchase</p>
      `;
      
      setTimeout(() => {
        this.close();
        Router.navigate('profile');
      }, 2000);
      
    } catch (error) {
      console.error('List for sale failed:', error);
      statusEl.innerHTML = `
        <div class="mint-status-icon" style="color: var(--error);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="mint-status-text" style="color: var(--error);">Listing failed</div>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">You can list later from your profile</p>
        <button class="btn btn-ghost" id="close-listing-error" style="margin-top: 16px;">Go to Profile</button>
      `;
      document.getElementById('close-listing-error')?.addEventListener('click', () => {
        this.close();
        Router.navigate('profile');
      });
    }
  },

  showEditProfile() {
    if (!AppState.user?.address) return;
    this.activeModal = 'edit-profile';
    const profile = AppState.profile || {};
    
    const html = `
      <div class="modal-overlay">
        <div class="modal edit-profile-modal">
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
              <!-- Profile Picture & Banner -->
              <div class="profile-images-section">
                <div class="banner-upload" id="banner-upload">
                  ${profile.bannerUrl 
                    ? `<img src="${profile.bannerUrl}" alt="Banner" class="banner-preview">`
                    : `<div class="banner-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>Upload Banner</span>
                      </div>`
                  }
                  <input type="file" id="banner-input" accept="image/*" hidden>
                  <button type="button" class="banner-edit-btn" onclick="document.getElementById('banner-input').click()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
                <div class="avatar-upload" id="avatar-upload">
                  ${profile.avatarUrl 
                    ? `<img src="${profile.avatarUrl}" alt="Avatar" class="avatar-preview">`
                    : `<div class="avatar-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>`
                  }
                  <input type="file" id="avatar-input" accept="image/*" hidden>
                  <button type="button" class="avatar-edit-btn" onclick="document.getElementById('avatar-input').click()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <input type="hidden" name="avatarUrl" id="avatar-url" value="${profile.avatarUrl || ''}">
              <input type="hidden" name="bannerUrl" id="banner-url" value="${profile.bannerUrl || ''}">
              
              <!-- Basic Info -->
              <div class="form-group">
                <label class="form-label">Display Name</label>
                <input type="text" class="form-input" name="name" value="${profile.name || ''}" placeholder="Your name">
              </div>
              
              <div class="form-group">
                <label class="form-label">Bio</label>
                <textarea class="form-input form-textarea" name="bio" placeholder="Tell us about yourself" rows="3">${profile.bio || ''}</textarea>
              </div>
              
              <!-- Are you an artist? -->
              <div class="form-group">
                <label class="toggle-label">
                  <span>Are you an artist?</span>
                  <div class="toggle-switch">
                    <input type="checkbox" name="isArtist" id="is-artist-toggle" ${profile.isArtist ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                </label>
              </div>
              
              <!-- Genre Selection (only shown if artist) -->
              <div class="form-group artist-only" id="genre-section" style="display: ${profile.isArtist ? 'block' : 'none'};">
                <label class="form-label">Choose up to 2 genres</label>
                <div class="genre-select-grid" id="genre-select">
                  ${this.genres.map(genre => `
                    <button type="button" class="genre-chip ${profile.genrePrimary === genre.id || profile.genreSecondary === genre.id ? 'selected' : ''}" 
                            data-genre="${genre.id}" style="--genre-color: ${genre.color}">${genre.name}</button>
                  `).join('')}
                </div>
                <input type="hidden" name="genrePrimary" id="genre-primary" value="${profile.genrePrimary || ''}">
                <input type="hidden" name="genreSecondary" id="genre-secondary" value="${profile.genreSecondary || ''}">
              </div>
              
              <!-- Social Links -->
              <div class="form-group">
                <label class="form-label">Website</label>
                <input type="url" class="form-input" name="website" value="${profile.website || ''}" placeholder="https://yoursite.com">
              </div>
              
              <div class="form-group">
                <label class="form-label">Twitter</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">@</span>
                  <input type="text" class="form-input" name="twitter" value="${profile.twitter || ''}" placeholder="username">
                </div>
              </div>
              
              <div class="form-actions">
                <button type="button" class="btn btn-secondary close-modal-btn">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <style>
        .edit-profile-modal { max-width: 500px; }
        .profile-images-section { position: relative; margin-bottom: 60px; }
        .banner-upload {
          width: 100%;
          height: 120px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          overflow: hidden;
          position: relative;
          cursor: pointer;
        }
        .banner-preview { width: 100%; height: 100%; object-fit: cover; }
        .banner-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          gap: 8px;
          font-size: 13px;
        }
        .banner-edit-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-upload {
          position: absolute;
          bottom: -40px;
          left: 20px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 4px solid var(--bg-primary);
          overflow: hidden;
          cursor: pointer;
        }
        .avatar-preview { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: var(--bg-hover);
          color: var(--text-muted);
        }
        .avatar-edit-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--bg-primary);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-md);
          cursor: pointer;
        }
        .toggle-switch { position: relative; width: 44px; height: 24px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute;
          inset: 0;
          background: var(--border-color);
          border-radius: 24px;
          transition: 200ms;
        }
        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 18px;
          height: 18px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 200ms;
        }
        .toggle-switch input:checked + .toggle-slider { background: var(--accent); }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }
        .genre-select-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .genre-chip {
          padding: 6px 14px;
          border: 1px solid var(--border-color);
          border-radius: 20px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .genre-chip:hover { border-color: var(--genre-color); color: var(--genre-color); }
        .genre-chip.selected {
          border-color: var(--genre-color);
          background: color-mix(in srgb, var(--genre-color) 15%, transparent);
          color: var(--genre-color);
        }
        .input-with-prefix {
          display: flex;
          align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        .input-with-prefix .input-prefix {
          padding: 0 12px;
          color: var(--text-muted);
          font-size: 14px;
        }
        .input-with-prefix .form-input {
          border: none;
          background: transparent;
          padding-left: 0;
        }
        .form-actions { display: flex; gap: 12px; margin-top: 24px; }
        .form-actions .btn { flex: 1; }
      </style>
    `;
    
    this.show(html);
    this.bindEditProfileEvents();
  },
  
  bindEditProfileEvents() {
    const selectedGenres = [];
    const profile = AppState.profile || {};
    if (profile.genrePrimary) selectedGenres.push(profile.genrePrimary);
    if (profile.genreSecondary) selectedGenres.push(profile.genreSecondary);
    
    // Artist toggle - show/hide genres
    document.getElementById('is-artist-toggle')?.addEventListener('change', (e) => {
      document.getElementById('genre-section').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Genre selection
    document.querySelectorAll('.genre-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const genre = btn.dataset.genre;
        const idx = selectedGenres.indexOf(genre);
        if (idx > -1) {
          selectedGenres.splice(idx, 1);
          btn.classList.remove('selected');
        } else if (selectedGenres.length < 2) {
          selectedGenres.push(genre);
          btn.classList.add('selected');
        } else {
          const oldGenre = selectedGenres.shift();
          document.querySelector(`.genre-chip[data-genre="${oldGenre}"]`)?.classList.remove('selected');
          selectedGenres.push(genre);
          btn.classList.add('selected');
        }
        document.getElementById('genre-primary').value = selectedGenres[0] || '';
        document.getElementById('genre-secondary').value = selectedGenres[1] || '';
      });
    });
    
    // Avatar upload
    document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const avatarUpload = document.getElementById('avatar-upload');
      avatarUpload.innerHTML = '<div class="avatar-placeholder"><div class="spinner" style="width:24px;height:24px;"></div></div>';
      
      try {
        const result = await API.uploadFile(file);
        document.getElementById('avatar-url').value = result.url;
        avatarUpload.innerHTML = `<img src="${result.url}" alt="Avatar" class="avatar-preview">
          <button type="button" class="avatar-edit-btn" onclick="document.getElementById('avatar-input').click()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>`;
      } catch (err) {
        console.error('Avatar upload failed:', err);
        avatarUpload.innerHTML = '<div class="avatar-placeholder"><span style="color:var(--error);">Failed</span></div>';
      }
    });
    
    // Banner upload
    document.getElementById('banner-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const bannerUpload = document.getElementById('banner-upload');
      bannerUpload.innerHTML = '<div class="banner-placeholder"><div class="spinner"></div><span>Uploading...</span></div>';
      
      try {
        const result = await API.uploadFile(file);
        document.getElementById('banner-url').value = result.url;
        bannerUpload.innerHTML = `<img src="${result.url}" alt="Banner" class="banner-preview">
          <button type="button" class="banner-edit-btn" onclick="document.getElementById('banner-input').click()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>`;
      } catch (err) {
        console.error('Banner upload failed:', err);
        bannerUpload.innerHTML = '<div class="banner-placeholder"><span style="color:var(--error);">Upload failed</span></div>';
      }
    });
    
    // Form submit
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const isArtist = document.getElementById('is-artist-toggle')?.checked || false;
      
      const updates = {
        address: AppState.user.address,
        name: formData.get('name')?.trim() || null,
        bio: formData.get('bio')?.trim() || null,
        avatarUrl: formData.get('avatarUrl') || null,
        bannerUrl: formData.get('bannerUrl') || null,
        website: formData.get('website')?.trim() || null,
        twitter: formData.get('twitter')?.replace('@', '').trim() || null,
        isArtist: isArtist,
        genrePrimary: isArtist ? (formData.get('genrePrimary') || null) : null,
        genreSecondary: isArtist ? (formData.get('genreSecondary') || null) : null,
      };
      
      console.log('Saving profile updates:', updates);
      
      try {
        const result = await API.saveProfile(updates);
        console.log('Profile save result:', result);
        setProfile({ ...AppState.profile, ...updates });
        UI.updateUserCard();
        this.close();
        if (typeof ProfilePage !== 'undefined') ProfilePage.render();
      } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile: ' + error.message);
      }
    });
  },
};
