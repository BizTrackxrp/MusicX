/**
 * XRP Music - Modals
 * Auth, Release, Create, Edit Profile, Now Playing modals
 */

const Modals = {
  activeModal: null,
  _ownedNftsCache: null,
  _ownedNftsCacheTime: 0,
  nowPlayingInterval: null,
  mintingInProgress: false,

  async fetchOwnedNfts(forceRefresh = false) {
    const walletAddress = AppState.user?.address;
    if (!walletAddress) return [];

    const now = Date.now();
    if (!forceRefresh && this._ownedNftsCache && (now - this._ownedNftsCacheTime < 60000)) {
      return this._ownedNftsCache;
    }

    try {
      const resp = await fetch(`/api/user-nfts?address=${walletAddress}`);
      const data = await resp.json();
      if (data.nfts) {
        this._ownedNftsCache = data.nfts;
        this._ownedNftsCacheTime = now;
        return data.nfts;
      }
    } catch (err) {
      console.error('Failed to fetch owned NFTs:', err);
    }
    return [];
  },

  renderOwnBadge(ownedCopies) {
    const modal = document.querySelector('.release-modal');
    if (!modal) return;

    const badgeEl = document.createElement('div');
    badgeEl.className = 'own-badge-container';
    badgeEl.innerHTML = `
      <span class="own-badge" id="ownBadgeBtn">✓ You own this</span>
      <div class="own-badge-dropdown" id="ownBadgeDropdown">
        <div class="own-badge-dropdown-header">Your Copies</div>
        <div class="own-badge-dropdown-list">
          ${ownedCopies.map((nft, i) => {
            const editionText = nft.editionNumber
              ? `Edition #${nft.editionNumber}`
              : '';
            const totalText = nft.totalEditions
              ? ` of ${nft.totalEditions}`
              : '';
            return `
              <div class="own-badge-copy-row">
                <span class="own-copy-label">Copy ${i + 1}</span>
                ${editionText ? `<span class="own-copy-edition">${editionText}${totalText}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    modal.style.position = 'relative';
    modal.appendChild(badgeEl);

    const btn = document.getElementById('ownBadgeBtn');
    const dropdown = document.getElementById('ownBadgeDropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    const closeHandler = (e) => {
      if (!badgeEl.contains(e.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  },
  
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
    { id: 'breakbeat', name: 'Breakbeat', color: '#f472b6' },
    { id: 'synthwave', name: 'Synthwave', color: '#c084fc' },
    { id: 'hyperpop', name: 'Hyperpop', color: '#fb7185' },
    { id: 'deephouse', name: 'Deep House', color: '#2dd4bf' },
    { id: 'afrohouse', name: 'Afro House', color: '#fbbf24' },
    { id: 'garage', name: 'Garage', color: '#a3e635' },
    { id: 'other', name: 'Other', color: '#6b7280' },
  ],

  getImageUrl(url) {
  if (!url) return '/placeholder.png';
  if (typeof IpfsHelper !== 'undefined' && IpfsHelper.toProxyUrl) {
    return IpfsHelper.toProxyUrl(url);
  }
  return url;
},
  
  show(html) {
    const container = document.getElementById('modals');
    if (!container) return;
    container.innerHTML = html;
    requestAnimationFrame(() => {
      container.querySelector('.modal-overlay')?.classList.add('visible');
    });
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
     if (e.target.classList.contains('modal-overlay') && !this.mintingInProgress && this.activeModal !== 'create') this.close();
    });
    document.querySelectorAll('.modal-close, .close-modal-btn').forEach(btn => {
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
    
    // CLEANUP: If we're closing during minting and have a pending release, delete it
    if (this.pendingReleaseId) {
      console.log('🧹 Modal closed - cleaning up pending release:', this.pendingReleaseId);
      fetch(`/api/releases?id=${this.pendingReleaseId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(result => console.log('Cleanup result:', result))
        .catch(err => console.error('Cleanup failed:', err));
      this.pendingReleaseId = null;
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
    if (e.key === 'Escape' && !Modals.mintingInProgress && Modals.activeModal !== 'create') Modals.close();
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
               <img src="${this.getImageUrl(track.cover)}" alt="${track.title}" onerror="this.src='/placeholder.png'">
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
  padding: 0;
  background: none;
  border: none;
  color: white;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 150ms;
}
.np-close:hover {
  opacity: 1;
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
  // Player.toggleLike() now syncs all like buttons automatically
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
              cover: Modals.getImageUrl(release.coverUrl),
              ipfsHash: t.audioCid,
              releaseId: release.id,
              duration: t.duration,
            };
            const queue = release.tracks.map((tr, i) => ({
              id: parseInt(tr.id) || i,
              trackId: tr.id?.toString(),
              title: release.type === 'single' ? release.title : tr.title,
              artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
              cover: Modals.getImageUrl(release.coverUrl),
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
                ${release.coverUrl ? `<img src="${this.getImageUrl(release.coverUrl)}" alt="${release.title}" onerror="this.src='/placeholder.png'">` : ''}
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
                    ${release.coverUrl ? `<img src="${this.getImageUrl(release.coverUrl)}" alt="${release.title}" onerror="this.src='/placeholder.png'">` : ''}
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
    // Navigate to full purchase page instead of modal
    this.close();
    Router.navigate('purchase', { 
      release: release.id 
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
                  ? `<img src="${this.getImageUrl(nft.coverUrl)}" alt="${nft.trackTitle || nft.releaseTitle}" onerror="this.src='/placeholder.png'">`
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
    
    console.log('Xaman result:', result);
    
    // Check if user cancelled or rejected
    if (!result.success) {
      throw new Error(result.error || 'Failed to create sell offer');
    }
    
    // Must have txHash to verify on-chain
    if (!result.txHash) {
      throw new Error('No transaction hash returned');
    }
    
    // CRITICAL: Wait and verify the transaction actually succeeded on XRPL
    console.log('Waiting for ledger validation...');
    statusEl.innerHTML = `
      <div class="spinner"></div>
      <p>Verifying transaction on XRPL...</p>
    `;
    
    await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds for ledger
    
    // Check the transaction result on XRPL
    const txResponse = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tx',
        params: [{ transaction: result.txHash }]
      })
    });
    const txData = await txResponse.json();
    
    console.log('Transaction result:', txData);
    
    // Check if transaction was validated and successful
    if (!txData.result?.validated) {
      throw new Error('Transaction not validated on XRPL');
    }
    
    // Check the transaction result code - tesSUCCESS means it worked
    const txResultCode = txData.result?.meta?.TransactionResult;
    if (txResultCode !== 'tesSUCCESS') {
      console.error('Transaction failed with code:', txResultCode);
      throw new Error(`Transaction failed: ${txResultCode || 'Unknown error'}. Check your XRP reserve.`);
    }
    
    // Get the offer index from the transaction metadata
    let offerIndex = result.offerIndex;
    
    // If we don't have offerIndex, try to extract from tx metadata
    if (!offerIndex && txData.result?.meta?.AffectedNodes) {
      for (const node of txData.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerIndex = node.CreatedNode.LedgerIndex;
          break;
        }
      }
    }
    
    if (!offerIndex) {
      throw new Error('Could not find offer index in transaction');
    }
    
    // Pad offer_index to 64 characters
    if (offerIndex.length < 64) {
      offerIndex = offerIndex.padStart(64, '0');
    }
    
    console.log('Offer verified! Index:', offerIndex);
    
    // NOW save listing to database
    const response = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nftTokenId: nft.nftTokenId,
        sellerAddress: AppState.user.address,
        price: price,
        offerIndex: offerIndex,
        releaseId: nft.releaseId,
        trackId: nft.trackId,
        txHash: result.txHash,
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
                  ? `<img src="${this.getImageUrl(listing.cover_url)}" alt="${title}" onerror="this.src='/placeholder.png'">`
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
  <img src="data:image/webp;base64,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" alt="Xaman" class="trust-logo xaman">
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
          <!-- Badge + Close container -->
<div style="position:absolute;top:16px;right:16px;z-index:10;display:flex;align-items:center;gap:12px;">
  ${release.soldEditions === 0 ? `<span style="font-size:14px;font-weight:600;color:white;white-space:nowrap;">🏆 1st Edition Available!</span>` : `<span style="font-size:14px;color:rgba(255,255,255,0.8);">${available} of ${release.totalEditions} available</span>`}
  <button onclick="Modals.close()" style="background:none;border:none;padding:0;cursor:pointer;color:white;opacity:0.8;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
</div>
          
          <!-- Header with gradient background -->
          <div class="release-header" style="background: linear-gradient(180deg, ${this.getColorFromImage(release.coverUrl)} 0%, var(--bg-primary) 100%);">
            <div class="release-header-content">
              <div class="release-cover-small">
                ${release.coverUrl ? `<img src="${this.getImageUrl(release.coverUrl)}" alt="${release.title}" onerror="this.src='/placeholder.png'">` : '<div class="cover-placeholder">🎵</div>'}
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
              <button class="btn-icon-circle" id="share-release-btn" title="Share">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
           ${AppState.user?.address && AppState.user.address === release.artistAddress ? `
  <button class="btn btn-sm btn-secondary" id="edit-price-btn" style="font-size: 13px; padding: 6px 12px;">
    Price
  </button>
  <button class="btn btn-sm btn-secondary" id="edit-genres-btn" style="font-size: 13px; padding: 6px 12px;">
    Genres
  </button>
  <button class="btn btn-sm btn-secondary" id="gift-track-btn" style="font-size: 13px; padding: 6px 12px;">
    🎁 Gift
  </button>
` : ''}
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
          
         <!-- Description -->
          ${release.description ? `
            <div class="release-description">
              <p>${release.description}</p>
            </div>
          ` : ''}
          
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
  <button class="track-action-btn share-track-btn" data-track-idx="${idx}" data-track-id="${track.id}" title="Share">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
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
          
        </div>
      </div>
      
      <style>
       .release-modal-overlay {
  align-items: flex-start;
  padding-top: 40px;
  padding-bottom: 40px;
  overflow-y: auto;
}
       .release-modal {
  max-width: 800px;
  width: 100%;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  border-radius: var(--radius-xl);
  padding: 0;
  position: relative;
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
          gap: 12px;
          padding: 16px 24px;
          background: var(--bg-primary);
        }
        .release-description {
          padding: 0 24px 20px;
          background: var(--bg-primary);
        }
        .release-description p {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--text-secondary);
          white-space: pre-wrap;
        }
        .btn-play-large {
          width: 56px;
          height: 56px;
          min-width: 56px;
          min-height: 56px;
          border-radius: 50%;
          background: var(--success);
          border: none;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 100ms, background 100ms;
          flex-shrink: 0;
        }
        .btn-play-large:hover {
          transform: scale(1.05);
          background: #3be477;
        }
        .btn-play-large svg { margin-left: 2px; }
        .btn-icon-circle {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms;
          flex-shrink: 0;
          padding: 0;
        }
        .btn-icon-circle:hover {
          color: var(--text-primary);
          transform: scale(1.1);
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
       
        
        @media (max-width: 600px) {
          .release-modal-overlay {
            padding-top: 20px;
            padding-bottom: 20px;
            align-items: flex-start;
          }
          .release-modal {
            max-height: calc(100vh - 40px);
            max-height: calc(100dvh - 40px);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .release-header-content { flex-direction: column; align-items: center; text-align: center; gap: 16px; }
          .release-cover-small { width: 140px; height: 140px; }
          .release-header { padding: 20px 16px 16px; }
          .release-title-large { font-size: 22px; margin: 4px 0 12px; }
          .release-meta { justify-content: center; font-size: 13px; }
          .release-actions-bar { 
            padding: 12px 16px; 
            gap: 10px; 
            flex-wrap: wrap;
            justify-content: flex-start;
          }
           .release-description {
            padding: 0 16px 16px;
          }
          .release-description p {
            font-size: 13px;
            line-height: 1.6;
          }
          .btn-play-large { width: 48px; height: 48px; min-width: 48px; min-height: 48px; }
          .btn-icon-circle { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
          .btn-icon-circle svg { width: 20px; height: 20px; }
          .track-list-header { display: none; }
          .release-track-list { 
            padding: 0 16px 24px;
          }
        .track-row { 
  grid-template-columns: 32px 1fr auto; 
  padding: 10px 12px;
  gap: 8px;
}
.track-col-actions, .track-col-duration, .track-col-avail { display: none; }
.track-col-title {
  min-width: 0;
}
.track-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-artist {
  font-size: 11px;
}
.track-col-buy { 
  flex-shrink: 0;
}
.track-col-buy .btn { 
  font-size: 13px; 
  padding: 10px 14px;
  white-space: nowrap;
  min-width: 70px;
  background: var(--accent) !important;
  border: none !important;
  color: white !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.track-col-buy .btn svg {
  display: none;
}
.sold-out-label {
  font-size: 10px;
}
          .buy-album-btn { 
            font-size: 13px; 
            padding: 10px 14px;
            width: 100%;
            margin-top: 8px;
            order: 10;
          }
        }
        /* === "You Own This" Badge === */
.own-badge-container {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}
.own-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(34, 197, 94, 0.9);
  backdrop-filter: blur(8px);
  color: white;
  font-size: 13px;
  font-weight: 600;
  border-radius: 20px;
  cursor: pointer;
  border: none;
  transition: all 150ms;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.own-badge:hover {
  background: rgba(34, 197, 94, 1);
  transform: scale(1.05);
}
.own-badge svg {
  width: 14px;
  height: 14px;
}
.own-badge-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 20;
}
.own-badge-dropdown.show {
  display: block;
}
.own-badge-dropdown-header {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}
.own-badge-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}
.own-badge-dropdown-item:last-child {
  border-bottom: none;
}
.own-badge-dropdown-item .edition-num {
  font-weight: 600;
  color: var(--text-primary);
}
.own-badge-dropdown-item .track-name {
  flex: 1;
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary);
  font-size: 12px;
}

@media (max-width: 600px) {
  .own-badge-container {
    top: 12px;
    left: 12px;
  }
  .own-badge {
    font-size: 12px;
    padding: 5px 12px;
  }
  .own-badge-dropdown {
    min-width: 180px;
  }
}
      </style>
    `;
    this.show(html);
    this.bindReleaseModalEvents(release);
    // "You own this" badge
    if (AppState.user?.address) {
      this.fetchOwnedNfts().then(allNfts => {
        const ownedCopies = allNfts.filter(nft => nft.releaseId === release.id);
        if (release.tracks && release.tracks.length > 0) {
          const trackIds = release.tracks.map(t => t.id || t.trackId);
          allNfts.forEach(nft => {
            if (nft.trackId && trackIds.includes(nft.trackId)) {
              if (!ownedCopies.find(c => c.nftTokenId === nft.nftTokenId)) {
                ownedCopies.push(nft);
              }
            }
          });
        }
        if (ownedCopies.length > 0) {
          this.renderOwnBadge(ownedCopies);
        }
      });
    }
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
  
  // Set initial like state for release button
  const firstTrack = release.tracks?.[0];
  if (firstTrack) {
    const trackId = firstTrack.id?.toString();
    const isLiked = isTrackLiked(trackId);
    const likeBtn = document.getElementById('like-release-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked);
      const svg = likeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
  }
    
    // Play button
    document.getElementById('play-release-btn')?.addEventListener('click', () => {
      if (release.tracks?.length > 0) {
        const queue = release.tracks.map((t, i) => ({
          id: parseInt(t.id) || i, trackId: t.id?.toString(),
          title: release.type === 'single' ? release.title : t.title,
          artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
          cover: Modals.getImageUrl(release.coverUrl), ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
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
            cover: Modals.getImageUrl(release.coverUrl), ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
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
            cover: Modals.getImageUrl(release.coverUrl), ipfsHash: t.audioCid, releaseId: release.id, duration: t.duration,
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
    
    // Like release - use Player.toggleLike() for sync
document.getElementById('like-release-btn')?.addEventListener('click', async () => {
  if (!AppState.user?.address) {
    this.showAuth();
    return;
  }
  
  // Check if this release's track is currently playing
  const currentTrack = AppState.player.currentTrack;
  const firstTrack = release.tracks?.[0];
  if (!firstTrack) return;
  
  const isCurrentTrackPlaying = currentTrack && 
    (currentTrack.trackId === firstTrack.id?.toString() || currentTrack.releaseId === release.id);
  
  if (isCurrentTrackPlaying) {
    // Use Player.toggleLike() which syncs all buttons
    await Player.toggleLike();
  } else {
    // Track not playing - handle manually but still sync
    const trackId = firstTrack.id?.toString();
    const isCurrentlyLiked = isTrackLiked(trackId);
    
    try {
      if (isCurrentlyLiked) {
        await API.unlikeTrack(AppState.user.address, trackId);
        removeLikedTrack(trackId);
        this.showToast('Removed from Liked Songs');
      } else {
        await API.likeTrack(AppState.user.address, trackId, release.id);
        addLikedTrack(trackId);
        this.showToast('Added to Liked Songs');
      }
      // Sync all like buttons including this one
      if (typeof Player !== 'undefined' && Player.syncAllLikeButtons) {
        Player.syncAllLikeButtons();
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      this.showToast('Failed to update liked songs');
    }
  }
});
    // Add to playlist
    document.getElementById('add-to-playlist-btn')?.addEventListener('click', () => {
      this.showAddToPlaylist(release);
    });

    // Share button
    document.getElementById('share-release-btn')?.addEventListener('click', () => {
      if (typeof ShareUtils !== 'undefined') {
        ShareUtils.shareRelease(release);
      } else {
        // Fallback if ShareUtils not loaded
        const url = `${window.location.origin}/release/${release.id}`;
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('Link copied to clipboard!');
        });
      }
    });
// Edit Price button (only visible to artist)
document.getElementById('edit-price-btn')?.addEventListener('click', () => {
  if (typeof EditPriceModal !== 'undefined') {
    EditPriceModal.show(release);
  } else {
    this.showToast('Price editor loading...');
  }
});
    // Edit Genres button (only visible to artist)
    document.getElementById('edit-genres-btn')?.addEventListener('click', () => {
      if (typeof EditGenresModal !== 'undefined') {
        EditGenresModal.show(release);
      } else {
        this.showToast('Genre editor loading...');
      }
    });
    // Gift button (only visible to artist)
    document.getElementById('gift-track-btn')?.addEventListener('click', () => {
      this.showGiftTrack(release);
    });
    
   // Like track buttons
    document.querySelectorAll('.like-track-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!AppState.user?.address) {
          this.showAuth();
          return;
        }
        const trackIdx = parseInt(btn.dataset.trackIdx, 10);
        const track = release.tracks?.[trackIdx];
        if (!track) return;
        
        const trackId = track.id?.toString();
        const isCurrentlyLiked = isTrackLiked(trackId);
        
        try {
          if (isCurrentlyLiked) {
            await API.unlikeTrack(AppState.user.address, trackId);
            removeLikedTrack(trackId);
            btn.querySelector('svg').setAttribute('fill', 'none');
            btn.classList.remove('liked');
            this.showToast('Removed from Liked Songs');
          } else {
            await API.likeTrack(AppState.user.address, trackId, release.id);
            addLikedTrack(trackId);
            btn.querySelector('svg').setAttribute('fill', 'currentColor');
            btn.classList.add('liked');
            this.showToast('Added to Liked Songs');
          }
        } catch (error) {
          console.error('Failed to toggle like:', error);
          this.showToast('Failed to update liked songs');
        }
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
    // Share track buttons
document.querySelectorAll('.share-track-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const trackIdx = parseInt(btn.dataset.trackIdx, 10);
    const trackId = btn.dataset.trackId;
    const track = release.tracks?.[trackIdx];
    if (track) {
      const url = `${window.location.origin}/release/${release.id}?track=${trackId}`;
      navigator.clipboard.writeText(url).then(() => {
        Modals.showToast(`Link copied for "${release.type === 'single' ? release.title : track.title}"!`);
      }).catch(() => {
        Modals.showToast('Failed to copy link');
      });
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
    if (!AppState.user?.address) {
      this.showAuth();
      return;
    }
    
    // Build track object for PlaylistPicker
    const trackToAdd = track ? {
      id: track.id,
      trackId: track.id?.toString(),
      title: release.type === 'single' ? release.title : track.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: Modals.getImageUrl(release.coverUrl),
      ipfsHash: track.audioCid,
      releaseId: release.id,
      duration: track.duration,
    } : {
      // If no specific track, use first track
      id: release.tracks?.[0]?.id,
      trackId: release.tracks?.[0]?.id?.toString(),
      title: release.title,
      artist: release.artistName || Helpers.truncateAddress(release.artistAddress),
      cover: Modals.getImageUrl(release.coverUrl),
      ipfsHash: release.tracks?.[0]?.audioCid,
      releaseId: release.id,
      duration: release.tracks?.[0]?.duration,
    };
    
    if (typeof PlaylistPicker !== 'undefined') {
      PlaylistPicker.show(trackToAdd);
    } else {
      this.showToast('Playlist feature loading...');
    }
  },
  
showTrackPurchase(release, track, trackIdx) {
    // Navigate to full purchase page instead of modal
    this.close();
    Router.navigate('purchase', { 
      release: release.id, 
      track: track.id 
    });
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
      statusOverlay.querySelector('.qps-content').innerHTML = `
        <div class="qps-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="qps-text">
          <div class="qps-title" style="font-size:20px;font-weight:700;margin-top:16px;color:#22c55e;">NFT Buy Successful! 🎉</div>
          <div class="qps-sub" style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:8px;">Rerouting to your profile to see your collection...</div>
        </div>
      `;
      
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
    // Navigate to full purchase page instead of modal
    this.close();
    Router.navigate('purchase', { 
      release: release.id, 
      album: 'true' 
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
                  <label class="form-label" id="title-label">Title *</label>
                  <input type="text" class="form-input" name="title" id="release-title" placeholder="Song or album title" required>
                  <p class="form-hint" id="title-hint">This will be your song title, or album title if uploading multiple tracks</p>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Description</label>
                  <textarea class="form-input form-textarea" name="description" id="release-description" placeholder="Tell listeners about this release"></textarea>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Editions *</label>
                    <input type="number" class="form-input" name="editions" id="release-editions" placeholder="100" min="1" max="10000" value="100" required>
                    <p class="form-hint edition-limit-hint" id="edition-limit-hint">How many copies of each track can be sold</p>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Resale Royalty %</label>
                    <input type="number" class="form-input" id="release-royalty" name="royalty" value="5" min="0" max="50" step="0.5">
                    <p class="form-hint">You earn this % on secondary sales</p>
                  </div>
                </div>
                
                <button type="button" class="btn btn-primary btn-full" id="create-next-1">Next: Upload Files</button>
              </div>
              
              <!-- Step 2: Upload Files & Pricing -->
              <div class="create-step hidden" id="create-step-2">
                <h3 class="create-step-title">Upload & Price</h3>
                
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
                      <span class="upload-hint">3000×3000px recommended • JPG, PNG, GIF (max 10MB)</span>
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
                  <p class="form-hint" style="margin-bottom: 8px;">Upload 1 file for a single, or multiple for an album</p>
                  <div class="upload-zone audio-zone" id="audio-upload-zone">
                    <input type="file" id="audio-input" accept="audio/*" multiple hidden>
                    <div class="upload-placeholder" id="audio-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                      <span>Click to upload audio</span>
                      <span class="upload-hint"><strong>MP3 recommended</strong> • Smaller files upload faster</span>
                      <span class="upload-hint" style="font-size: 11px; color: var(--warning);">⚠️ Large WAV files may fail — convert to MP3 (max 20MB)</span>
                    </div>
                  </div>
                  <div class="track-list-upload" id="track-list-upload"></div>
                </div>
                
                <!-- Default price input - shown before tracks uploaded -->
                <div class="form-group" id="default-price-group">
                  <label class="form-label">Price per Track (XRP) *</label>
                  <input type="number" class="form-input" name="price" id="release-price" placeholder="5" step="0.01" min="0" value="5" required style="max-width: 150px;">
                  <p class="form-hint">Set the price for your track(s). You can customize individual prices after uploading.</p>
                </div>
                
                <div class="mint-fee-preview">
                  <span>Mint Fee:</span>
                  <span id="mint-fee-amount">Upload tracks to calculate</span>
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
        .track-upload-item .track-num { width: 24px; height: 24px; background: var(--accent); border-radius: 50%; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .track-upload-item .track-name { flex: 1; font-size: 14px; }
        .track-upload-item .track-name-input { flex: 1; font-size: 14px; background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 4px 8px; color: var(--text-primary); outline: none; min-width: 0; }
        .track-upload-item .track-name-input:hover { border-color: var(--border); }
        .track-upload-item .track-name-input:focus { border-color: var(--accent); background: var(--bg-card); }
        .track-upload-item .track-duration { font-size: 13px; color: var(--text-muted); flex-shrink: 0; }
        .track-upload-item .track-status { font-size: 12px; flex-shrink: 0; }
        .track-upload-item .track-status.uploading { color: var(--warning); }
        .track-upload-item .track-status.done { color: var(--success); }
        .track-upload-item .track-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; flex-shrink: 0; }
        .track-upload-item .track-remove:hover { color: var(--error); }
        
        /* Per-track price inputs */
        .track-price-input-wrap { display: flex; align-items: center; gap: 4px; min-width: 90px; flex-shrink: 0; }
        .track-price-input { width: 70px; padding: 4px 6px; background: var(--bg-card); border: 1px solid transparent; border-radius: 4px; color: var(--text-primary); font-size: 13px; text-align: right; outline: none; -moz-appearance: textfield; }
        .track-price-input::-webkit-outer-spin-button, .track-price-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .track-price-input:hover { border-color: var(--border); }
        .track-price-input:focus { border-color: var(--accent); background: var(--bg-card); }
        .track-price-label { font-size: 11px; color: var(--text-muted); }
        
        /* Album price section */
        .album-price-section { margin-top: 16px; }
        .album-price-box { padding: 16px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: var(--radius-lg); }
        .album-price-header { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
        .album-price-header svg { color: #8b5cf6; }
        .album-price-row { display: flex; align-items: flex-start; gap: 16px; }
        .album-price-input-wrap { display: flex; align-items: center; gap: 8px; }
        .album-price-input { width: 120px !important; font-size: 16px !important; font-weight: 600; }
        .album-price-currency { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
        .album-price-comparison { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
        .individual-total { font-size: 13px; color: var(--text-muted); text-decoration: line-through; }
        .album-savings { font-size: 13px; font-weight: 600; }
        .album-savings.discount-active { color: #22c55e; }
        .album-savings.no-discount { color: var(--text-muted); font-weight: 400; font-size: 12px; }
        
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
        .edition-info-badge { cursor: help; margin-left: 4px; }
        .edition-limit-hint { color: var(--accent); margin-top: 8px; font-size: 12px; }
        .mint-progress-container { margin: 20px 0; padding: 20px; background: var(--bg-hover); border-radius: var(--radius-lg); }
        .mint-progress-bar { height: 12px; background: var(--bg-card); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
        .mint-progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #a855f7); border-radius: 6px; transition: width 300ms ease; }
        .mint-progress-stats { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
        .mint-progress-percent { font-weight: 600; color: var(--accent); }
        .mint-progress-time { color: var(--text-muted); }
        .mint-status-centered { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001; background: var(--bg-card); padding: 40px; border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0,0,0,0.5); text-align: center; min-width: 350px; max-width: 450px; }
        .mint-warning { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; padding: 10px 16px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); font-size: 12px; color: #f59e0b; }
        .mint-success { text-align: center; }
        .mint-success-cover { width: 120px; height: 120px; margin: 0 auto 16px; border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); position: relative; }
        .mint-success-cover img { width: 100%; height: 100%; object-fit: cover; }
        .mint-success-icon { position: absolute; bottom: -8px; right: calc(50% - 76px); width: 32px; height: 32px; background: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .mint-success-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .mint-success-stats { font-size: 14px; color: var(--accent); margin-bottom: 8px; }
        .mint-success-msg { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
        .mint-success-actions { display: flex; gap: 12px; justify-content: center; }
        .mint-success-actions .btn { min-width: 120px; }
        
        @media (max-width: 480px) {
          .album-price-row { flex-direction: column; gap: 8px; }
          .track-price-input-wrap { min-width: 70px; }
          .track-price-input { width: 55px; }
          .track-upload-item { gap: 8px; padding: 10px; }
          .track-upload-item .track-name-input { font-size: 13px; }
        }
      </style>
    `;
    
    this.show(html);
    this.bindCreateEvents();
  },
  
  bindCreateEvents() {
    const form = document.getElementById('create-release-form');
    const tracks = [];
    let coverFile = null;
   // Calculate listing fee: pre-funds future on-demand mints
// tracks × editions × network fee + buffer for reserves
function calculateMintFee(editions, trackCount = 1) {
  const totalNFTs = trackCount * editions;
  const networkFee = totalNFTs * 0.000012;
  const buffer = 0.01; // Slightly higher buffer for reserve account costs
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
      
      // Update the hint with max editions for current track count
      const hintEl = document.getElementById('edition-limit-hint');
      if (hintEl && trackCount > 0) {
        const maxEditions = Math.floor(1000 / trackCount);
        hintEl.textContent = `Max ${maxEditions} editions (${trackCount} track${trackCount > 1 ? 's' : ''} × editions ≤ 1000 NFTs)`;
      }
    }
    
    // Editions input - update mint fee
    document.getElementById('release-editions')?.addEventListener('input', updateMintFee);

    // Sync default price to tracks that haven't been customized
    document.getElementById('release-price')?.addEventListener('input', (e) => {
      const newDefault = parseFloat(e.target.value) || 0;
      tracks.forEach(track => {
        // Only update tracks still at the old default (user hasn't customized)
        if (!track.priceCustomized) {
          track.price = newDefault;
        }
      });
      updateTrackList();
    });
    
    // Initialize mint fee
    updateMintFee();
    
    // Step navigation
    document.getElementById('create-next-1')?.addEventListener('click', () => {
  const title = document.getElementById('release-title').value.trim();
  if (!title) { alert('Please enter a title'); return; }
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
      
   // Validate edition limit (10000 max)
const editions = parseInt(document.getElementById('release-editions').value) || 1;
if (editions > 10000) {
  alert('Maximum 10,000 editions per minting session due to server limits. If an album, you can have a 10 song album and give it 1000 copies!');
  document.getElementById('release-editions').value = 10000;
  return;
}
      const totalNFTs = tracks.length * editions;
      
      const royalty = document.getElementById('release-royalty').value;
      
      const mintFee = calculateMintFee(editions, tracks.length);
      
      // Auto-detect type based on track count
      const releaseType = tracks.length === 1 ? 'single' : 'album';
      document.getElementById('release-type').value = releaseType;
      
     // Update review
      document.getElementById('review-cover').innerHTML = `<img src="${URL.createObjectURL(coverFile)}" alt="Cover">`;
      document.getElementById('review-title').textContent = document.getElementById('release-title').value;
      document.getElementById('review-type').textContent = releaseType.toUpperCase();
      document.getElementById('review-tracks').textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
      
      // Price review - show per-track or album discount
      const reviewPriceEl = document.getElementById('review-price');
      if (tracks.length === 1) {
        reviewPriceEl.textContent = `${tracks[0].price} XRP`;
      } else {
        const individualTotal = tracks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
        const albumPriceVal = parseFloat(document.getElementById('album-discount-price')?.value) || individualTotal;
        const savings = individualTotal - albumPriceVal;
        
        let priceText = `Album: ${albumPriceVal} XRP`;
        if (savings > 0) {
          priceText += ` (save ${savings.toFixed(2)} XRP vs individual)`;
        }
        reviewPriceEl.textContent = priceText;
      }
      
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
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      if (file.size > 20 * 1024 * 1024) { 
        alert(`File "${file.name}" is ${sizeMB}MB which exceeds the 20MB limit.\n\nPlease convert to MP3 for smaller file sizes.\n\nTip: WAV files are typically 10x larger than MP3s.`); 
        return; 
      }
      if (file.type === 'audio/wav' || file.type === 'audio/x-wav') {
        if (file.size > 10 * 1024 * 1024) {
          const proceed = confirm(`WAV file "${file.name}" is ${sizeMB}MB.\n\nLarge WAV files may fail to upload. We strongly recommend converting to MP3 for better reliability.\n\nContinue anyway?`);
          if (!proceed) return;
        }
      }
      
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
      const defaultPrice = document.getElementById('release-price').value || '0';
      
      container.innerHTML = tracks.map((track, idx) => {
        // Initialize track price from default if not set
        if (track.price === undefined || track.price === null) {
          track.price = parseFloat(defaultPrice) || 0;
        }
        return `
        <div class="track-upload-item" data-idx="${idx}">
          <div class="track-num">${idx + 1}</div>
          <input type="text" class="track-name-input" value="${track.title.replace(/"/g, '&quot;')}" data-idx="${idx}" placeholder="Click to edit song title" title="Click to edit">
          <div class="track-price-input-wrap">
            <input type="number" class="track-price-input" value="${track.price}" data-idx="${idx}" step="0.01" min="0" placeholder="0.00" title="Track price in XRP">
            <span class="track-price-label">XRP</span>
          </div>
          <div class="track-duration">${track.duration ? Helpers.formatDuration(track.duration) : '--:--'}</div>
          <div class="track-status ${track.status}">${track.status === 'done' ? '✓' : track.status === 'uploading' ? 'Uploading...' : ''}</div>
          <button type="button" class="track-remove" data-idx="${idx}">×</button>
        </div>
      `}).join('');
      
      // Show album price section when multiple tracks
      let albumPriceSection = document.getElementById('album-price-section');
      if (tracks.length > 1) {
        if (!albumPriceSection) {
          albumPriceSection = document.createElement('div');
          albumPriceSection.id = 'album-price-section';
          albumPriceSection.className = 'album-price-section';
          container.after(albumPriceSection);
        }
        const individualTotal = tracks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
        const currentAlbumPrice = document.getElementById('album-discount-price')?.value || individualTotal.toFixed(2);
        
        albumPriceSection.innerHTML = `
          <div class="album-price-box">
            <div class="album-price-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>Album Price</span>
            </div>
            <div class="album-price-row">
              <div class="album-price-input-wrap">
                <input type="number" class="form-input album-price-input" id="album-discount-price" value="${currentAlbumPrice}" step="0.01" min="0" placeholder="Album price">
                <span class="album-price-currency">XRP</span>
              </div>
              <div class="album-price-comparison">
                <span class="individual-total">Tracks individually: ${individualTotal.toFixed(2)} XRP</span>
                <span class="album-savings" id="album-savings"></span>
              </div>
            </div>
          </div>
        `;
        updateAlbumSavings();
      } else if (albumPriceSection) {
        albumPriceSection.remove();
      }
      
      // Track name editing
      document.querySelectorAll('.track-name-input').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx);
          tracks[idx].title = input.value.trim() || `Track ${idx + 1}`;
        });
      });
      
     // Track price editing
      document.querySelectorAll('.track-price-input').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx);
          tracks[idx].price = parseFloat(input.value) || 0;
          tracks[idx].priceCustomized = true;  // Mark as customized
          updateAlbumSavings();
          updateMintFee();
        });
      });
      
      // Album price editing
      document.getElementById('album-discount-price')?.addEventListener('input', updateAlbumSavings);
      
      document.querySelectorAll('.track-remove').forEach(btn => {
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
      
      updateMintFee();
      
      // Update title label based on track count
      const titleLabel = document.getElementById('title-label');
      const titleHint = document.getElementById('title-hint');
      const titleInput = document.getElementById('release-title');
      
      if (tracks.length > 1) {
        if (titleLabel) titleLabel.textContent = 'Album/EP Title *';
        if (titleInput) titleInput.placeholder = 'Album or EP name';
        if (titleHint) titleHint.innerHTML = `Don't include your artist name — it's added automatically.<br><span style="color: var(--accent); margin-top: 4px; display: inline-block;">👆 Click track names below to edit song titles</span>`;
      } else {
        if (titleLabel) titleLabel.textContent = 'Song Title *';
        if (titleInput) titleInput.placeholder = 'Song title';
        if (titleHint) titleHint.textContent = "Don't include your artist name — it's added automatically";
      }
    }
    
    // Calculate and display album savings
    function updateAlbumSavings() {
      const individualTotal = tracks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
      const albumPrice = parseFloat(document.getElementById('album-discount-price')?.value) || 0;
      const savingsEl = document.getElementById('album-savings');
      const totalEl = document.querySelector('.individual-total');
      
      if (totalEl) {
        totalEl.textContent = `Tracks individually: ${individualTotal.toFixed(2)} XRP`;
      }
      
      if (savingsEl) {
        if (albumPrice < individualTotal && albumPrice > 0) {
          const saved = (individualTotal - albumPrice).toFixed(2);
          const pct = Math.round((1 - albumPrice / individualTotal) * 100);
          savingsEl.textContent = `Fans save ${saved} XRP (${pct}% off)`;
          savingsEl.className = 'album-savings discount-active';
        } else if (albumPrice >= individualTotal) {
          savingsEl.textContent = 'Set lower than individual total for a discount';
          savingsEl.className = 'album-savings no-discount';
        } else {
          savingsEl.textContent = '';
          savingsEl.className = 'album-savings';
        }
      }
    }
      
      // Track name editing - save on every keystroke
      document.querySelectorAll('.track-name-input').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx);
          tracks[idx].title = input.value.trim() || `Track ${idx + 1}`;
        });
      });
      
      document.querySelectorAll('.track-remove').forEach(btn => {
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
      
      // Update title label based on track count
      const titleLabel = document.getElementById('title-label');
      const titleHint = document.getElementById('title-hint');
      const titleInput = document.getElementById('release-title');
      
      if (tracks.length > 1) {
        // Album/EP mode
        if (titleLabel) titleLabel.textContent = 'Album/EP Title *';
        if (titleInput) titleInput.placeholder = 'Album or EP name';
        if (titleHint) titleHint.innerHTML = `Don't include your artist name — it's added automatically.<br><span style="color: var(--accent); margin-top: 4px; display: inline-block;">👆 Click track names below to edit song titles</span>`;
      } else {
        // Single mode
        if (titleLabel) titleLabel.textContent = 'Song Title *';
        if (titleInput) titleInput.placeholder = 'Song title';
        if (titleHint) titleHint.textContent = "Don't include your artist name — it's added automatically";
      }
    
    
    // Form submit - Mint NFT
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let releaseId = null;  // Declare in outer scope for cleanup access
      
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
  title: tracks.length === 1 ? document.getElementById('release-title').value : tracks[i].title,
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
        
       // Step 4: Create release in database FIRST to get IDs
showStatus(4, 6, 'Creating release...', 'Preparing database records');

const editions = parseInt(document.getElementById('release-editions').value) || 1;
const royaltyPercent = parseFloat(document.getElementById('release-royalty').value) || 5;
const transferFee = Math.round(royaltyPercent * 100);
const totalNFTs = uploadedTracks.length * editions;

// Pre-create release to get IDs
const preReleaseData = {
  artistAddress: AppState.user.address,
  artistName: AppState.profile?.name || null,
  title: releaseTitle,
  description: releaseDescription,
  type: releaseType,
  coverUrl: coverResult.url,
  coverCid: coverResult.cid,
  metadataCid: albumMetadataResult.cid,
  songPrice: parseFloat(document.getElementById('release-price').value),
albumPrice: releaseType !== 'single' 
  ? (parseFloat(document.getElementById('album-discount-price')?.value) || parseFloat(document.getElementById('release-price').value) * uploadedTracks.length)
  : null,
  totalEditions: editions,
  editionsPerTrack: editions,
  nftTokenIds: [],
  txHash: null,
  tracks: uploadedTracks.map((t, i) => ({
    ...t,
    price: tracks[i]?.price || parseFloat(document.getElementById('release-price').value) || 0,
    soldEditions: 0,
    availableEditions: editions,
  })),
  sellOfferIndex: null,
};

const preCreateResult = await API.saveRelease(preReleaseData);
releaseId = preCreateResult.releaseId;
Modals.pendingReleaseId = releaseId;  // Track for cleanup if modal closes
const trackIds = preCreateResult.trackIds;

console.log('Pre-created release:', { releaseId, trackIds });

// Step 5: Pay mint fee (pre-funds on-demand minting)
const mintFee = calculateMintFee(editions, uploadedTracks.length);

statusEl.innerHTML = `
  <div class="mint-status-icon">
    <div class="spinner"></div>
  </div>
  <div class="mint-status-text" style="font-size: 15px; font-weight: 600;">Pay Mint Fee</div>
  <p style="font-size: 13px; color: var(--accent); margin-top: 12px;">📱 Sign in Xaman</p>
  <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">One quick signature and you're live!</p>
`;

Modals.mintingInProgress = true;

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

// Pay mint fee
const paymentResult = await XamanWallet.sendPayment(
  platformAddress,
  parseFloat(mintFee),
  `XRP Music: ${releaseTitle}`
);

if (!paymentResult.success) {
  throw new Error(paymentResult.error || 'Payment cancelled');
}

Modals.mintingInProgress = false;

// Step 6: Finalize release (now live, NFTs mint on purchase)
showStatus(6, 6, 'Going live...', 'Your release is being published!');

try {
  await API.updateRelease(releaseId, {
    mintFeePaid: true,
    mintFeeTxHash: paymentResult.txHash,
    mintFeeAmount: parseFloat(mintFee),
    status: 'live',
  });
  console.log('✓ Release is live - lazy minting enabled');
} catch (updateError) {
  console.error('⚠ Failed to finalize release:', updateError);
  Modals.mintingInProgress = false;
  statusEl.innerHTML = `
    <div class="mint-status-icon" style="color: var(--error);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    </div>
    <div class="mint-status-text" style="color: var(--error);">Failed to publish</div>
    <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;">
      Payment received but publishing failed. Contact support with Release ID: <code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;">${releaseId}</code>
    </p>
    <div class="mint-success-actions" style="margin-top: 20px;">
      <button type="button" class="btn btn-primary" onclick="Modals.close(); Router.navigate('profile');">Go to Profile</button>
    </div>
  `;
  return;
}

Modals.pendingReleaseId = null;
        
// Success - Release is live!
Modals.mintingInProgress = false;
statusEl.innerHTML = `
  <div class="mint-success">
    <div class="mint-success-cover">
      <img src="${URL.createObjectURL(coverFile)}" alt="Cover">
      <div class="mint-success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
    </div>
    <div class="mint-success-title">🎉 ${releaseTitle}</div>
    <div class="mint-success-stats">${uploadedTracks.length} track${uploadedTracks.length > 1 ? 's' : ''} • ${editions} editions available</div>
    <p class="mint-success-msg">Your music is live! NFTs mint automatically when fans purchase.</p>
    <div class="mint-success-actions">
      <button type="button" class="btn btn-secondary" onclick="window.open('https://x.com/intent/tweet?text=${encodeURIComponent('Just dropped my music as NFTs on @XRP_MUSIC! 🎵\\n\\nOwn it forever on the XRP Ledger.')}', '_blank')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Share on X
      </button>
      <button type="button" class="btn btn-primary" id="mint-success-done">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        View Release
      </button>
    </div>
  </div>
`;

document.getElementById('mint-success-done')?.addEventListener('click', () => {
  this.close();
  Router.navigate('profile');
});

document.getElementById('mint-success-done')?.addEventListener('click', () => {
  this.close();
  Router.navigate('profile');
});

  } catch (error) {
        console.error('Mint failed:', error);
        console.log('=== CLEANUP DEBUG ===');
        console.log('releaseId value:', releaseId);
        
        Modals.mintingInProgress = false;
        
        // AUTO-CLEANUP: Delete the pre-created release if minting failed
       if (releaseId) {
  console.log('🧹 Cleaning up failed release:', releaseId);
  try {
    const deleteResponse = await fetch(`/api/releases?id=${releaseId}`, { method: 'DELETE' });
    const deleteResult = await deleteResponse.json();
    console.log('Cleanup response:', deleteResponse.status, deleteResult);
    if (deleteResult.success) {
      console.log('✅ Cleaned up failed release');
      Modals.pendingReleaseId = null;
    } else {
      console.error('❌ Cleanup failed:', deleteResult.error);
    }
  } catch (cleanupErr) {
    console.error('❌ Cleanup fetch error:', cleanupErr);
  }
} else {
  console.log('⚠️ No releaseId to cleanup');
}
        
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

  showTermsOfService() {
    this.activeModal = 'terms';
    const html = `
      <div class="modal-overlay tos-modal-overlay">
        <div class="modal tos-modal">
          <div class="modal-header">
            <div class="modal-title">Terms of Service</div>
            <button class="modal-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body tos-content">
            <p class="tos-effective"><em>Effective Date: January 19, 2026</em></p>
            <p>Welcome to XRP Music. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
            
            <h3>1. Platform Description</h3>
            <p>XRP Music operates as a marketplace facilitating the minting, buying, and selling of music NFTs on the XRP Ledger (XRPL). We act as an intermediary platform connecting artists and collectors. We do not take custody of, control, or have the ability to reverse any transactions conducted on the XRPL blockchain.</p>
            
            <h3>2. Copyright and Content Restrictions</h3>
            <p><strong>You represent and warrant that you will not upload, mint, or sell any music or content through our platform unless you own the copyright or have obtained all necessary rights, licenses, and permissions to do so.</strong></p>
            <p>Uploading, minting, or selling copyrighted material that you do not own or have rights to is strictly prohibited and constitutes a material breach of these Terms. Violators may have their content removed and their accounts suspended or terminated without notice.</p>
            
            <h3>3. Intellectual Property Rights and NFT Ownership</h3>
            <p>Purchasing an NFT on XRP Music grants you ownership of the unique digital token recorded on the XRPL blockchain. Unless explicitly stated otherwise by the artist at the point of sale, purchasing an NFT does <strong>not</strong> transfer any intellectual property rights, including but not limited to:</p>
            <ul>
              <li>Copyright in the underlying music, artwork, or other content</li>
              <li>Rights to reproduce, distribute, or create derivative works</li>
              <li>Commercial use rights or licensing rights</li>
              <li>Trademark or publicity rights</li>
            </ul>
            <p>You receive only the right to own, hold, transfer, and resell the NFT itself.</p>
            
            <h3>4. Account Access and Platform Use</h3>
            <p>XRP Music reserves the right to condition, restrict, suspend, or terminate your access to the platform at any time, for any reason or no reason, in its sole discretion.</p>
            
            <h3>5. Platform Fee</h3>
            <p>XRP Music collects a platform fee of two percent (2%) on all NFT sales conducted through the platform. This fee is automatically deducted at the time of each transaction. XRP Music reserves the right to modify the platform fee percentage at any time.</p>
            
            <h3>6. Dispute Resolution and Governing Law</h3>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Washington. Any dispute arising out of these Terms shall be brought exclusively in the state or federal courts located in King County, Washington.</p>
            
            <h3>7. Class Action Waiver</h3>
            <p><strong>YOU AGREE THAT ANY CLAIMS AGAINST XRP MUSIC MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION.</strong></p>
            
            <h3>8. Limitation of Liability</h3>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL XRP MUSIC BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</p>
            <p><strong>Damages Cap:</strong> THE TOTAL CUMULATIVE LIABILITY OF XRP MUSIC SHALL NOT EXCEED ONE HUNDRED UNITED STATES DOLLARS ($100.00).</p>
            
            <h3>9. Assumption of Risk</h3>
            <p>You acknowledge and accept the inherent risks associated with blockchain technology and digital assets, including price volatility, regulatory uncertainty, technological vulnerabilities, and the potential for total loss of value.</p>
            
            <h3>10. Modifications to Terms</h3>
            <p>We reserve the right to modify these Terms at any time. Changes will be effective upon posting to the platform.</p>
            
            <h3>11. Contact Information</h3>
            <p>For questions about these Terms of Service, please contact us through the platform.</p>
            
            <p class="tos-agreement"><em>By using XRP Music, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</em></p>
          </div>
        </div>
      </div>
      
      <style>
        .tos-modal { max-width: 600px; max-height: 80vh; }
        .tos-content { 
          overflow-y: auto; 
          max-height: 60vh; 
          padding-right: 8px;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        .tos-content h3 { 
          font-size: 15px; 
          font-weight: 600; 
          color: var(--text-primary); 
          margin: 20px 0 8px 0; 
        }
        .tos-content p { margin: 8px 0; }
        .tos-content ul { margin: 8px 0 8px 20px; }
        .tos-content li { margin: 4px 0; }
        .tos-effective { color: var(--text-muted); margin-bottom: 16px; }
        .tos-agreement { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); }
        .tos-content::-webkit-scrollbar { width: 6px; }
        .tos-content::-webkit-scrollbar-track { background: var(--bg-hover); border-radius: 3px; }
        .tos-content::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
      </style>
    `;
    this.show(html);
  },
  /**
 * Show Gift Track Modal - Artist gives away a copy
 */
async showGiftTrack(release, track = null) {
  this.activeModal = 'gift-track';
  
  const tracks = release.tracks || [];
  const trackOptions = tracks.map((t, idx) => {
    const remaining = release.totalEditions - (t.soldCount || 0);
    return `<option value="${t.id}" ${remaining <= 0 ? 'disabled' : ''} ${track?.id === t.id ? 'selected' : ''}>
      ${release.type === 'single' ? release.title : t.title} (${remaining} available)
    </option>`;
  }).join('');
  
  const html = `
    <div class="modal-overlay gift-modal-overlay">
      <div class="modal gift-modal">
        <div class="modal-header">
          <div class="modal-title">🎁 Gift a Track</div>
          <button class="modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Release Preview -->
          <div class="gift-preview">
            <div class="gift-cover">
              ${release.coverUrl ? `<img src="${this.getImageUrl(release.coverUrl)}" alt="${release.title}">` : '<div class="cover-placeholder">🎵</div>'}
            </div>
            <div class="gift-info">
              <div class="gift-title">${release.title}</div>
              <div class="gift-artist">${release.artistName || Helpers.truncateAddress(release.artistAddress)}</div>
            </div>
          </div>
          
          <!-- Track Selection -->
          ${tracks.length > 1 ? `
            <div class="form-group">
              <label class="form-label">Select Track</label>
              <select class="form-input" id="gift-track-select">
                ${trackOptions}
              </select>
            </div>
          ` : `<input type="hidden" id="gift-track-select" value="${tracks[0]?.id || ''}">`}
          
          <!-- Recipient Address -->
          <div class="form-group">
            <label class="form-label">Recipient Wallet Address</label>
            <input type="text" class="form-input" id="gift-recipient" placeholder="rXXXX..." autocomplete="off">
          </div>
          
          <!-- Collectors List -->
          <div class="gift-collectors-section">
            <label class="form-label" style="margin-bottom: 12px;">Your Collectors</label>
            <div class="gift-collectors-list" id="gift-collectors-list">
              <div class="gift-collectors-loading">
                <div class="spinner" style="width: 20px; height: 20px;"></div>
                <span>Loading collectors...</span>
              </div>
            </div>
          </div>
          
          <!-- Info -->
          <div class="gift-info-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>This mints a bonus NFT as a gift — it doesn't reduce your available copies for sale. The recipient will need to accept it in their Xaman wallet.</span>
          </div>
          
          <!-- Status -->
          <div class="gift-status hidden" id="gift-status">
            <div class="spinner"></div>
            <p id="gift-status-text">Processing gift...</p>
          </div>
          
          <!-- Actions -->
          <div class="gift-actions" id="gift-actions">
            <button class="btn btn-secondary close-modal-btn">Cancel</button>
            <button class="btn btn-primary" id="confirm-gift-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"></path>
                <path d="M12 3v12"></path>
                <path d="M12 3l4 4"></path>
                <path d="M12 3L8 7"></path>
              </svg>
              Send Gift
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <style>
      .gift-modal { max-width: 420px; }
      .gift-preview {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--bg-hover);
        border-radius: var(--radius-lg);
        margin-bottom: 20px;
      }
      .gift-cover {
        width: 64px;
        height: 64px;
        border-radius: var(--radius-md);
        overflow: hidden;
        flex-shrink: 0;
      }
      .gift-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .gift-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .gift-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 4px;
      }
      .gift-artist {
        font-size: 14px;
        color: var(--text-secondary);
      }
      .gift-collectors-section {
        margin-bottom: 20px;
      }
      .gift-collectors-list {
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
      }
      .gift-collectors-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        color: var(--text-muted);
        font-size: 13px;
      }
      .gift-collectors-empty {
        padding: 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
      }
      .gift-collector-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        cursor: pointer;
        transition: background 150ms;
        border-bottom: 1px solid var(--border-color);
      }
      .gift-collector-item:last-child {
        border-bottom: none;
      }
      .gift-collector-item:hover {
        background: var(--bg-hover);
      }
      .gift-collector-item.selected {
        background: rgba(139, 92, 246, 0.1);
      }
      .gift-collector-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--accent-gradient);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
        overflow: hidden;
      }
      .gift-collector-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .gift-collector-info {
        flex: 1;
        min-width: 0;
      }
      .gift-collector-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .gift-collector-address {
        font-size: 12px;
        color: var(--text-muted);
        font-family: monospace;
      }
      .gift-collector-count {
        font-size: 11px;
        color: var(--accent);
        background: rgba(139, 92, 246, 0.1);
        padding: 2px 8px;
        border-radius: 10px;
      }
      .gift-info-box {
        display: flex;
        gap: 10px;
        padding: 12px;
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: var(--radius-lg);
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 20px;
      }
      .gift-info-box svg {
        flex-shrink: 0;
        color: #8b5cf6;
        margin-top: 2px;
      }
      .gift-status {
        text-align: center;
        padding: 20px;
      }
      .gift-status.hidden { display: none; }
      .gift-status .spinner { margin: 0 auto 12px; }
      .gift-status p { color: var(--text-secondary); font-size: 14px; margin: 0; }
      .gift-actions {
        display: flex;
        gap: 12px;
      }
      .gift-actions .btn { flex: 1; }
    </style>
  `;
  
  this.show(html);
  
  // Load collectors
  this.loadArtistCollectors(release.artistAddress);
  
  // Bind confirm button
  document.getElementById('confirm-gift-btn')?.addEventListener('click', async () => {
    const trackId = document.getElementById('gift-track-select')?.value;
    const recipient = document.getElementById('gift-recipient')?.value?.trim();
    
    if (!recipient) {
      alert('Please enter a recipient wallet address');
      return;
    }
    
    // Basic XRPL address validation
    if (!recipient.startsWith('r') || recipient.length < 25 || recipient.length > 35) {
      alert('Please enter a valid XRPL wallet address (starts with r)');
      return;
    }
    
    const selectedTrack = tracks.find(t => t.id == trackId) || tracks[0];
    await this.processGift(release, selectedTrack, recipient);
  });
},

/**
 * Load collectors who have bought from this artist
 */
async loadArtistCollectors(artistAddress) {
  const listEl = document.getElementById('gift-collectors-list');
  if (!listEl) return;
  
  try {
    const response = await fetch(`/api/collectors?artist=${artistAddress}`);
    const data = await response.json();
    
    if (!data.success || !data.collectors?.length) {
      listEl.innerHTML = `<div class="gift-collectors-empty">No collectors yet. Share your music to get your first fans!</div>`;
      return;
    }
    
    listEl.innerHTML = data.collectors.map(collector => `
      <div class="gift-collector-item" data-address="${collector.address}">
        <div class="gift-collector-avatar">
          ${collector.avatar_url 
            ? `<img src="${collector.avatar_url}" alt="${collector.name || 'Collector'}">`
            : (collector.name || collector.address).charAt(0).toUpperCase()
          }
        </div>
        <div class="gift-collector-info">
          <div class="gift-collector-name">${collector.name || Helpers.truncateAddress(collector.address)}</div>
          <div class="gift-collector-address">${Helpers.truncateAddress(collector.address)}</div>
        </div>
        <div class="gift-collector-count">${collector.purchase_count} NFT${collector.purchase_count !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
    
    // Bind click to populate address
    listEl.querySelectorAll('.gift-collector-item').forEach(item => {
      item.addEventListener('click', () => {
        const address = item.dataset.address;
        document.getElementById('gift-recipient').value = address;
        
        // Visual feedback
        listEl.querySelectorAll('.gift-collector-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
    
  } catch (error) {
    console.error('Failed to load collectors:', error);
    listEl.innerHTML = `<div class="gift-collectors-empty">Failed to load collectors</div>`;
  }
},
  
  /**
   * Process the gift - lazy mint an NFT for the recipient
   */
  async processGift(release, track, recipientAddress) {
    const statusEl = document.getElementById('gift-status');
    const statusTextEl = document.getElementById('gift-status-text');
    const actionsEl = document.getElementById('gift-actions');
    
    statusEl?.classList.remove('hidden');
    if (actionsEl) actionsEl.style.display = 'none';
    
    try {
      // Step 1: Create gift record and trigger lazy mint
      statusTextEl.textContent = 'Creating gift...';
      
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAddress: AppState.user.address,
          recipientAddress: recipientAddress,
          releaseId: release.id,
          trackId: track.id,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create gift');
      }
      
      // Success!
      statusEl.innerHTML = `
        <div style="color: var(--success); margin-bottom: 12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <p style="font-weight: 600; color: var(--text-primary); font-size: 16px;">Gift Sent! 🎁</p>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
          ${Helpers.truncateAddress(recipientAddress)} will receive a notification to claim their NFT.
        </p>
        <button class="btn btn-primary" style="margin-top: 20px;" onclick="Modals.close()">Done</button>
      `;
      
    } catch (error) {
      console.error('Gift failed:', error);
      statusEl.innerHTML = `
        <div style="color: var(--error); margin-bottom: 12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <p style="font-weight: 600; color: var(--text-primary);">Gift Failed</p>
        <p style="font-size: 13px; margin-top: 4px; color: var(--text-secondary);">${error.message}</p>
      `;
      if (actionsEl) actionsEl.style.display = 'flex';
    }
  },
};
