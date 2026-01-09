/**
 * XRP Music - Main App
 * Initialization and routing
 */

const Router = {
  params: {},
  
  /**
   * Navigate to a page
   */
  navigate(page, params = {}) {
    this.params = params;
    savePage(page);
    UI.setActiveNav(page);
    
    // Update URL without reload
    const url = this.buildUrl(page, params);
    history.pushState({ page, params }, '', url);
    
    this.render(page);
  },
  
  /**
   * Build URL for page
   */
  buildUrl(page, params) {
    if (page === 'artist' && params.address) {
      return `/artist/${params.address}`;
    }
    if (page === 'playlist' && params.id) {
      return `/playlist/${params.id}`;
    }
    if (page === 'purchase') {
      const queryParams = new URLSearchParams();
      if (params.release) queryParams.set('release', params.release);
      if (params.track) queryParams.set('track', params.track);
      if (params.album) queryParams.set('album', params.album);
      return `/purchase?${queryParams.toString()}`;
    }
    return `/${page === 'stream' ? '' : page}`;
  },
  
  /**
   * Parse URL and return page/params
   */
  parseUrl() {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Artist page
    if (path.startsWith('/artist/')) {
      const address = path.replace('/artist/', '');
      return { page: 'artist', params: { address } };
    }
    
    // Playlist page
    if (path.startsWith('/playlist/')) {
      const id = path.replace('/playlist/', '');
      return { page: 'playlist', params: { id } };
    }
    
    // Purchase page
    if (path === '/purchase') {
      return { 
        page: 'purchase', 
        params: { 
          release: searchParams.get('release'),
          track: searchParams.get('track'),
          album: searchParams.get('album')
        } 
      };
    }
    
    // Other pages
    const pageName = path.replace('/', '') || 'stream';
    return { page: pageName, params: {} };
  },
  
  /**
   * Render page
   */
  render(page) {
    switch (page) {
      case 'stream':
        StreamPage.render();
        break;
      case 'marketplace':
        MarketplacePage.render();
        break;
      case 'profile':
        ProfilePage.render();
        break;
      case 'purchase':
        PurchasePage.init();
        break;
      case 'liked':
        // Use new Spotify-style LikedSongsPage
        if (typeof LikedSongsPage !== 'undefined') {
          LikedSongsPage.render();
        } else {
          this.renderLikedPageFallback();
        }
        break;
      case 'playlists':
        this.renderPlaylistsPage();
        break;
      case 'playlist':
        this.renderPlaylistPage(this.params.id);
        break;
      case 'artist':
        this.renderArtistPage(this.params.address);
        break;
      default:
        StreamPage.render();
    }
  },
  
  /**
   * Reload current page
   */
  reload() {
    this.render(AppState.currentPage);
  },
  
  /**
   * Fallback liked songs page (if LikedSongsPage not loaded)
   */
  async renderLikedPageFallback() {
    if (!AppState.user?.address) {
      UI.renderPage(`
        <div class="empty-state" style="min-height: 60vh;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <h3>Liked Songs</h3>
          <p>Connect your wallet to see your liked songs.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="Modals.showAuth()">
            Connect Wallet
          </button>
        </div>
      `);
      return;
    }
    
    UI.showLoading();
    
    try {
      const tracks = await API.getLikedTracks(AppState.user.address);
      UI.updateLikedCount(tracks.length);
      
      if (tracks.length === 0) {
        UI.renderPage(`
          <div class="animate-fade-in">
            <h2 class="section-title">Liked Songs</h2>
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <h3>No Liked Songs Yet</h3>
              <p>Like songs while listening to add them here.</p>
            </div>
          </div>
        `);
        return;
      }
      
      UI.renderPage(`
        <div class="animate-fade-in">
          <h2 class="section-title">Liked Songs</h2>
          <div class="track-list">
            ${tracks.map((track, idx) => `
              <div class="track-item" data-track-idx="${idx}">
                <div class="track-cover">
                  <img src="${track.coverUrl || '/placeholder.png'}" alt="${track.title}">
                </div>
                <div class="track-info">
                  <div class="track-title">${track.title}</div>
                  <div class="track-artist">${track.artistName || Helpers.truncateAddress(track.artistAddress)}</div>
                </div>
                <button class="player-action-btn liked" data-track-id="${track.id}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `);
      
      // Bind events
      document.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.closest('.player-action-btn')) return;
          
          const idx = parseInt(item.dataset.trackIdx, 10);
          const track = tracks[idx];
          if (track) {
            const playTrack = {
              id: track.id,
              trackId: track.id,
              title: track.title,
              artist: track.artistName || Helpers.truncateAddress(track.artistAddress),
              cover: track.coverUrl,
              ipfsHash: track.audioCid,
              releaseId: track.releaseId,
            };
            
            const queue = tracks.map(t => ({
              id: t.id,
              trackId: t.id,
              title: t.title,
              artist: t.artistName || Helpers.truncateAddress(t.artistAddress),
              cover: t.coverUrl,
              ipfsHash: t.audioCid,
              releaseId: t.releaseId,
            }));
            
            Player.playTrack(playTrack, queue, idx);
          }
        });
      });
      
      // Unlike buttons
      document.querySelectorAll('.player-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const trackId = btn.dataset.trackId;
          try {
            await API.unlikeTrack(AppState.user.address, trackId);
            removeLikedTrack(trackId);
            this.renderLikedPageFallback();
          } catch (error) {
            console.error('Failed to unlike:', error);
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load liked tracks:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Failed to Load</h3>
          <p>There was an error loading your liked songs.</p>
        </div>
      `);
    }
  },
  
  /**
   * Render playlists browse page
   */
  async renderPlaylistsPage() {
    UI.showLoading();
    
    try {
      const playlists = await API.getPublicPlaylists();
      
      if (playlists.length === 0) {
        UI.renderPage(`
          <div class="animate-fade-in">
            <h2 class="section-title">Browse Playlists</h2>
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              <h3>No Public Playlists</h3>
              <p>Be the first to create a public playlist!</p>
            </div>
          </div>
        `);
        return;
      }
      
      UI.renderPage(`
        <div class="animate-fade-in">
          <h2 class="section-title">Browse Playlists</h2>
          <div class="release-grid">
            ${playlists.map(playlist => `
              <div class="release-card" data-playlist-id="${playlist.id}">
                <div class="release-card-cover">
                  ${playlist.coverUrl 
                    ? `<img src="${playlist.coverUrl}" alt="${playlist.name}">`
                    : `<div class="placeholder" style="background: linear-gradient(135deg, #a855f7, #ec4899);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                          <path d="M9 18V5l12-2v13"></path>
                          <circle cx="6" cy="18" r="3"></circle>
                          <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                      </div>`
                  }
                </div>
                <div class="release-card-info">
                  <div class="release-card-title">${playlist.name}</div>
                  <div class="release-card-artist">${Helpers.truncateAddress(playlist.ownerAddress)}</div>
                  <div class="release-card-footer">
                    <span class="release-card-tracks">${playlist.trackCount} tracks</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `);
      
      // Bind clicks
      document.querySelectorAll('.release-card').forEach(card => {
        card.addEventListener('click', () => {
          const playlistId = card.dataset.playlistId;
          this.navigate('playlist', { id: playlistId });
        });
      });
      
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  },
  
  /**
   * Render single playlist page
   */
  async renderPlaylistPage(playlistId) {
    UI.showLoading();
    
    try {
      const data = await API.getPlaylist(playlistId, true, AppState.user?.address);
      const playlist = data.playlist;
      const tracks = data.tracks || [];
      
      UI.renderPage(`
        <div class="animate-fade-in">
          <div style="display: flex; gap: 24px; margin-bottom: 32px;">
            <div style="width: 200px; height: 200px; border-radius: var(--radius-xl); overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg, #a855f7, #ec4899);">
              ${playlist.coverUrl 
                ? `<img src="${playlist.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M9 18V5l12-2v13"></path>
                      <circle cx="6" cy="18" r="3"></circle>
                      <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                  </div>`
              }
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
              <div style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Playlist</div>
              <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${playlist.name}</h1>
              <p style="color: var(--text-muted);">${tracks.length} tracks</p>
            </div>
          </div>
          
          ${tracks.length > 0 ? `
            <div class="track-list">
              ${tracks.map((track, idx) => `
                <div class="track-item" data-track-idx="${idx}">
                  <div class="track-cover">
                    <img src="${track.coverUrl || '/placeholder.png'}" alt="${track.title}">
                  </div>
                  <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${track.artistName || Helpers.truncateAddress(track.artistAddress)}</div>
                  </div>
                  <div style="color: var(--text-muted);">${Helpers.formatDuration(track.duration)}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              <h3>Empty Playlist</h3>
              <p>This playlist has no tracks yet.</p>
            </div>
          `}
        </div>
      `);
      
      // Bind track clicks
      document.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.trackIdx, 10);
          const track = tracks[idx];
          if (track) {
            const playTrack = {
              id: track.id,
              trackId: track.id,
              title: track.title,
              artist: track.artistName || Helpers.truncateAddress(track.artistAddress),
              cover: track.coverUrl,
              ipfsHash: track.audioCid,
              releaseId: track.releaseId,
            };
            
            const queue = tracks.map(t => ({
              id: t.id,
              trackId: t.id,
              title: t.title,
              artist: t.artistName || Helpers.truncateAddress(t.artistAddress),
              cover: t.coverUrl,
              ipfsHash: t.audioCid,
              releaseId: t.releaseId,
            }));
            
            Player.playTrack(playTrack, queue, idx);
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load playlist:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Playlist Not Found</h3>
          <p>This playlist doesn't exist or has been deleted.</p>
        </div>
      `);
    }
  },
  
  /**
   * Render artist page
   */
  async renderArtistPage(address) {
    UI.showLoading();
    
    try {
      const [profile, releases] = await Promise.all([
        API.getProfile(address),
        API.getReleasesByArtist(address),
      ]);
      
      const displayName = profile?.name || Helpers.truncateAddress(address);
      
      UI.renderPage(`
        <div class="animate-fade-in">
          <!-- Banner -->
          <div style="height: 200px; background: linear-gradient(135deg, var(--accent), #8b5cf6); border-radius: var(--radius-xl); margin-bottom: -60px;">
            ${profile?.bannerUrl ? `<img src="${profile.bannerUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-xl);">` : ''}
          </div>
          
          <!-- Profile -->
          <div style="display: flex; align-items: flex-end; gap: 20px; padding: 0 24px; margin-bottom: 32px;">
            <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--bg-primary); background: linear-gradient(135deg, var(--accent), #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden;">
              ${profile?.avatarUrl 
                ? `<img src="${profile.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : displayName[0].toUpperCase()
              }
            </div>
            <div style="padding-bottom: 16px;">
              <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">${displayName}</h1>
              <p style="color: var(--text-muted); font-size: 14px;">${Helpers.truncateAddress(address, 8, 6)}</p>
              ${profile?.bio ? `<p style="color: var(--text-secondary); font-size: 14px; margin-top: 8px;">${profile.bio}</p>` : ''}
            </div>
          </div>
          
          <!-- Releases -->
          <div style="padding: 0 24px;">
            <h2 class="section-title">Releases</h2>
            ${releases.length > 0 ? `
              <div class="release-grid">
                ${releases.map(release => `
                  <div class="release-card" data-release-id="${release.id}">
                    <div class="release-card-cover">
                      ${release.coverUrl 
                        ? `<img src="${release.coverUrl}" alt="${release.title}">`
                        : `<div class="placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M9 18V5l12-2v13"></path>
                              <circle cx="6" cy="18" r="3"></circle>
                              <circle cx="18" cy="16" r="3"></circle>
                            </svg>
                          </div>`
                      }
                      <span class="release-type-badge ${release.type}">${release.type}</span>
                    </div>
                    <div class="release-card-info">
                      <div class="release-card-title">${release.title}</div>
                      <div class="release-card-footer">
                        <span class="release-card-price">${release.songPrice} XRP</span>
                        <span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <h3>No Releases</h3>
                <p>This artist hasn't released any music yet.</p>
              </div>
            `}
          </div>
        </div>
      `);
      
      // Bind release clicks
      document.querySelectorAll('.release-card').forEach(card => {
        card.addEventListener('click', () => {
          const releaseId = card.dataset.releaseId;
          const release = releases.find(r => r.id === releaseId);
          if (release) {
            Modals.showRelease(release);
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load artist:', error);
      UI.renderPage(`
        <div class="empty-state">
          <h3>Artist Not Found</h3>
          <p>This artist profile doesn't exist.</p>
        </div>
      `);
    }
  },
};

/**
 * App Initialization
 */
async function initApp() {
  console.log('🎵 Initializing XRP Music...');
  
  // Initialize UI immediately - don't wait for anything
  UI.init();
  
  // Initialize player
  Player.init();
  
  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state?.page) {
      Router.params = e.state.params || {};
      savePage(e.state.page);
      UI.setActiveNav(e.state.page);
      Router.render(e.state.page);
    }
  });
  
  // Parse initial URL and route - show page immediately
  const { page, params } = Router.parseUrl();
  Router.params = params;
  savePage(page);
  UI.setActiveNav(page);
  Router.render(page);
  
  console.log('✅ XRP Music ready!');
  
  // Initialize Xaman in background - don't block the UI
  XamanWallet.init().catch(err => {
    console.error('Xaman init error:', err);
  });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
