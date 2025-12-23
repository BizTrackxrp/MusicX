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
      
      // Success!
      statusEl.innerHTML = `
        <div class="purchase-status-icon success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="purchase-status-text">Purchase Complete!</div>
        <div class="purchase-status-sub">Your NFT has been added to your collection</div>
      `;
      
      // Show success for a moment then close
      setTimeout(() => {
        this.close();
        // Refresh releases to update availability
        if (typeof StreamPage !== 'undefined') {
          StreamPage.render();
        }
        if (typeof ProfilePage !== 'undefined') {
          ProfilePage.render();
        }
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
                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">${(release.artistName || 'A')[0].toUpperCase()}</div>
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
          id: parseInt(t.id) || i, trackId: t.id?.toString(),
          title: release.type === 'single' ? release.title : t.title,
          artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
          cover: release.coverUrl, ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
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
            id: parseInt(t.id) || i, trackId: t.id?.toString(),
            title: release.type === 'single' ? release.title : t.title,
            artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
            cover: release.coverUrl, ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
          }));
          Player.playTrack(queue[idx], queue, idx);
        }
      });
    });
    document.getElementById('buy-release-btn')?.addEventListener('click', () => {
      if (!AppState.user?.address) { this.close(); this.showAuth(); return; }
      this.showPurchase(release);
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
                
                <div class="form-group">
                  <label class="form-label">Release Type</label>
                  <div class="release-type-grid">
                    <button type="button" class="release-type-btn selected" data-type="single">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>Single</span>
                    </button>
                    <button type="button" class="release-type-btn" data-type="album">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                        <rect x="6" y="6" width="12" height="12" rx="1"></rect>
                      </svg>
                      <span>Album</span>
                    </button>
                  </div>
                  <input type="hidden" name="type" id="release-type" value="single">
                </div>
                
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
                    <input type="number" class="form-input" name="editions" id="release-editions" placeholder="100" min="1" max="10000" value="100" required>
                  </div>
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
                  <div class="upload-zone audio-zone" id="audio-upload-zone">
                    <input type="file" id="audio-input" accept="audio/*" hidden>
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
                    <span>Network Fee</span>
                    <span>~0.2 XRP (reserve)</span>
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
      </style>
    `;
    
    this.show(html);
    this.bindCreateEvents();
  },
  
  bindCreateEvents() {
    const form = document.getElementById('create-release-form');
    const tracks = [];
    let coverFile = null;
    
    // Release type selection
    document.querySelectorAll('.release-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.release-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('release-type').value = btn.dataset.type;
        
        // Update audio input for multiple files if album/EP
        const audioInput = document.getElementById('audio-input');
        if (btn.dataset.type !== 'single') {
          audioInput.setAttribute('multiple', 'multiple');
        } else {
          audioInput.removeAttribute('multiple');
        }
      });
    });
    
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
      
      // Update review
      document.getElementById('review-cover').innerHTML = `<img src="${URL.createObjectURL(coverFile)}" alt="Cover">`;
      document.getElementById('review-title').textContent = document.getElementById('release-title').value;
      document.getElementById('review-type').textContent = document.getElementById('release-type').value.toUpperCase();
      document.getElementById('review-tracks').textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
      document.getElementById('review-price').textContent = `${document.getElementById('release-price').value} XRP`;
      document.getElementById('review-editions').textContent = document.getElementById('release-editions').value;
      
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
          <div class="track-name">${track.title}</div>
          <div class="track-duration">${track.duration ? Helpers.formatDuration(track.duration) : '--:--'}</div>
          <div class="track-status ${track.status}">${track.status === 'done' ? '✓' : track.status === 'uploading' ? 'Uploading...' : ''}</div>
          <button type="button" class="track-remove" data-idx="${idx}">×</button>
        </div>
      `).join('');
      
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
    }
    
    // Form submit - Mint NFT
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const statusEl = document.getElementById('mint-status');
      const statusText = document.getElementById('mint-status-text');
      const navEl = document.getElementById('create-nav-3');
      
      statusEl.classList.remove('hidden');
      navEl.style.display = 'none';
      
      try {
        // Step 1: Upload cover to IPFS
        statusText.textContent = 'Uploading cover art...';
        const coverResult = await API.uploadFile(coverFile);
        document.getElementById('cover-cid').value = coverResult.cid;
        document.getElementById('cover-url').value = coverResult.url;
        
        // Step 2: Upload audio files to IPFS
        const uploadedTracks = [];
        for (let i = 0; i < tracks.length; i++) {
          statusText.textContent = `Uploading track ${i + 1} of ${tracks.length}...`;
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
        
        // Step 3: Create metadata JSON
        statusText.textContent = 'Creating metadata...';
        const releaseType = document.getElementById('release-type').value;
        const metadata = {
          name: document.getElementById('release-title').value,
          description: document.getElementById('release-description').value,
          image: `ipfs://${coverResult.cid}`,
          animation_url: uploadedTracks.length === 1 ? `ipfs://${uploadedTracks[0].audioCid}` : undefined,
          attributes: [
            { trait_type: 'Type', value: releaseType },
            { trait_type: 'Artist', value: AppState.profile?.name || AppState.user.address },
            { trait_type: 'Tracks', value: uploadedTracks.length },
          ],
          properties: {
            tracks: uploadedTracks.map(t => ({
              title: t.title,
              duration: t.duration,
              audio: `ipfs://${t.audioCid}`,
            })),
          },
        };
        
        const metadataResult = await API.uploadJSON(metadata, `${metadata.name}-metadata.json`);
        
        // Step 4: Mint NFTs (authorizes platform, then backend mints copies)
        const editions = parseInt(document.getElementById('release-editions').value) || 1;
        statusText.textContent = `Authorize minting of ${editions} copies in Xaman...`;
        
        const mintResult = await XamanWallet.mintNFT(metadataResult.ipfsUrl, {
          quantity: editions,
          transferFee: 500, // 5% royalty
        });
        
        if (!mintResult.success) {
          throw new Error(mintResult.error || 'Minting failed');
        }
        
        statusText.textContent = `Minted ${mintResult.totalMinted} NFTs! Saving release...`;
        
        // Step 5: Save to database
        const releaseData = {
          artistAddress: AppState.user.address,
          artistName: AppState.profile?.name || null,
          title: document.getElementById('release-title').value,
          description: document.getElementById('release-description').value,
          type: releaseType,
          coverUrl: coverResult.url,
          coverCid: coverResult.cid,
          metadataCid: metadataResult.cid,
          songPrice: parseFloat(document.getElementById('release-price').value),
          albumPrice: releaseType !== 'single' ? parseFloat(document.getElementById('release-price').value) : null,
          totalEditions: mintResult.totalMinted || parseInt(document.getElementById('release-editions').value),
          nftTokenIds: mintResult.nftTokenIds,
          txHash: mintResult.txHash,
          tracks: uploadedTracks,
          sellOfferIndex: 'platform-owned', // Mark as ready to sell
        };
        
        await API.saveRelease(releaseData);
        
        // Success - NFTs minted and ready to sell!
        statusEl.innerHTML = `
          <div class="mint-status-icon" style="color: var(--success);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="mint-status-text" style="color: var(--success); font-weight: 600;">${mintResult.totalMinted || editions} NFTs Minted!</div>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">Your release is now live and for sale!</p>
        `;
        
        setTimeout(() => {
          this.close();
          Router.navigate('profile');
        }, 2000);
        
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
                <label class="form-label">Choose up to 2 genres that fit your style</label>
                <div class="genre-select-grid" id="genre-select">
                  ${this.genres.map(genre => `
                    <button type="button" class="genre-select-btn ${profile.genrePrimary === genre.id || profile.genreSecondary === genre.id ? 'selected' : ''}" 
                            data-genre="${genre.id}" style="--genre-color: ${genre.color}">${genre.name}</button>
                  `).join('')}
                </div>
                <input type="hidden" name="genrePrimary" id="genre-primary" value="${profile.genrePrimary || ''}">
                <input type="hidden" name="genreSecondary" id="genre-secondary" value="${profile.genreSecondary || ''}">
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
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <style>
        .genre-select-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; }
        .genre-select-btn { padding: 10px 12px; border: 2px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-hover); color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 150ms; }
        .genre-select-btn:hover { border-color: var(--genre-color); color: var(--text-primary); }
        .genre-select-btn.selected { border-color: var(--genre-color); background: color-mix(in srgb, var(--genre-color) 20%, var(--bg-hover)); color: var(--genre-color); }
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
    
    document.querySelectorAll('.genre-select-btn').forEach(btn => {
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
          document.querySelector(`.genre-select-btn[data-genre="${oldGenre}"]`)?.classList.remove('selected');
          selectedGenres.push(genre);
          btn.classList.add('selected');
        }
        document.getElementById('genre-primary').value = selectedGenres[0] || '';
        document.getElementById('genre-secondary').value = selectedGenres[1] || '';
      });
    });
    
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const updates = {
        address: AppState.user.address,
        name: formData.get('name')?.trim() || null,
        bio: formData.get('bio')?.trim() || null,
        website: formData.get('website')?.trim() || null,
        twitter: formData.get('twitter')?.replace('@', '').trim() || null,
        genrePrimary: formData.get('genrePrimary') || null,
        genreSecondary: formData.get('genreSecondary') || null,
      };
      try {
        await API.saveProfile(updates);
        setProfile({ ...AppState.profile, ...updates });
        UI.updateUserCard();
        this.close();
        if (typeof ProfilePage !== 'undefined') ProfilePage.render();
      } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile.');
      }
    });
  },
};
