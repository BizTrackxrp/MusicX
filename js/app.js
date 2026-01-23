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
    if (page === 'release' && params.id) {
      return `/release/${params.id}`;
    }
    if (page === 'analytics') {
      const queryParams = new URLSearchParams();
      if (params.sort) queryParams.set('sort', params.sort);
      if (params.period) queryParams.set('period', params.period);
      const qs = queryParams.toString();
      return `/analytics${qs ? '?' + qs : ''}`;
    }
    if (page === 'purchase') {
      const queryParams = new URLSearchParams();
      if (params.release) queryParams.set('release', params.release);
      if (params.track) queryParams.set('track', params.track);
      if (params.album) queryParams.set('album', params.album);
      return `/purchase?${queryParams.toString()}`;
    }
    if (page === 'sales') {
      return '/sales';
    }
    return `/${page === 'stream' ? '' : page}`;
  },
  
  /**
   * Parse URL and return page/params
   */
  parseUrl() {
    let path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Check for redirect parameter (from OG meta pages)
    const redirectPath = searchParams.get('redirect');
    if (redirectPath) {
      path = redirectPath;
      // Update the URL to the clean path (remove ?redirect=)
      history.replaceState({}, '', redirectPath);
    }
    
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
    
    // Release page (direct link to release modal)
    if (path.startsWith('/release/')) {
      const id = path.replace('/release/', '');
      return { page: 'release', params: { id } };
    }
    
    // Analytics page
    if (path === '/analytics') {
      return { 
        page: 'analytics', 
        params: { 
          sort: searchParams.get('sort') || 'streams',
          period: searchParams.get('period') || '7d'
        } 
      };
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
    
    // Sales page
    if (path === '/sales') {
      return { page: 'sales', params: {} };
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
      case 'analytics':
        AnalyticsPage.render(this.params);
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
      case 'release':
        // Direct link to release - show stream page then open modal
        this.openReleaseFromUrl(this.params.id);
        break;
      case 'artist':
        this.renderArtistPage(this.params.address);
        break;
      case 'sales':
        if (typeof ArtistSalesPage !== 'undefined') {
          ArtistSalesPage.render();
        } else {
          StreamPage.render();
        }
        break;
      default:
        StreamPage.render();
    }
  },
  
  /**
   * Open release modal from direct URL
   * FIXED: Now properly awaits StreamPage.render() before opening modal
   */
  async openReleaseFromUrl(releaseId) {
    if (!releaseId) {
      StreamPage.render();
      return;
    }
    
    try {
      // Fetch the release data first
      const data = await API.getRelease(releaseId);
      
      if (!data?.release) {
        console.error('Release not found:', releaseId);
        Modals.showToast('Release not found');
        StreamPage.render();
        return;
      }
      
      // Now render the stream page as background and wait for it
      await StreamPage.render();
      
      // Small delay to ensure DOM is ready, then show modal
      setTimeout(() => {
        Modals.showRelease(data.release);
      }, 50);
      
    } catch (error) {
      console.error('Failed to load release:', error);
      Modals.showToast('Failed to load release');
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
   * Helper to get proxied image URL (for IPFS)
   */
  getImageUrl(url) {
    if (!url) return '/placeholder.png';
    if (typeof IpfsHelper !== 'undefined') {
      return IpfsHelper.toProxyUrl(url);
    }
    return url;
  },
  
  /**
   * Render artist page (public profile)
   * UPDATED: Fixed banner scaling, bio overflow, and mobile layout
   */
  async renderArtistPage(address) {
    UI.showLoading();
    
    try {
      const [profile, releases] = await Promise.all([
        API.getProfile(address),
        API.getReleasesByArtist(address),
      ]);
      
      const displayName = profile?.name || Helpers.truncateAddress(address);
      const bannerUrl = this.getImageUrl(profile?.bannerUrl);
      const avatarUrl = this.getImageUrl(profile?.avatarUrl);
      
      UI.renderPage(`
        <div class="artist-page animate-fade-in">
          <!-- Banner - Now responsive -->
          <div class="artist-banner">
            ${profile?.bannerUrl ? `<img src="${bannerUrl}" alt="Banner" onerror="this.style.display='none'">` : ''}
          </div>
          
          <!-- Profile Card -->
          <div class="artist-profile-card">
            <div class="artist-avatar">
              ${profile?.avatarUrl 
                ? `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none'">`
                : `<span>${displayName[0].toUpperCase()}</span>`
              }
            </div>
            <div class="artist-info">
              <h1 class="artist-name">${displayName}</h1>
              <p class="artist-address">${Helpers.truncateAddress(address, 8, 6)}</p>
              ${profile?.bio ? `
                <div class="artist-bio-container">
                  <p class="artist-bio">${profile.bio}</p>
                </div>
              ` : ''}
              ${profile?.website ? `
                <a href="${profile.website}" target="_blank" class="artist-website">${profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
              ` : ''}
            </div>
            <div class="artist-actions">
              <button class="btn btn-secondary" id="share-artist-btn" title="Share Artist Profile">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span class="btn-text">Share</span>
              </button>
            </div>
          </div>
          
          <!-- Releases -->
          <div class="artist-releases">
            <h2 class="section-title">Releases</h2>
            ${releases.length > 0 ? `
              <div class="release-grid">
                ${releases.map(release => {
                  const coverUrl = this.getImageUrl(release.coverUrl);
                  return `
                    <div class="release-card" data-release-id="${release.id}">
                      <div class="release-card-cover">
                        ${release.coverUrl 
                          ? `<img src="${coverUrl}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
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
                          <span class="release-card-price">${release.songPrice || release.albumPrice} XRP</span>
                          <span class="release-card-tracks">${release.tracks?.length || 0} tracks</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
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
        
        <style>
          /* ============================================
             Artist Page Styles
             ============================================ */
          .artist-page {
            padding-bottom: 120px;
          }
          
          @media (max-width: 1024px) {
            .artist-page {
              padding-bottom: 140px;
            }
          }
          
          /* ============================================
             Artist Banner - Responsive height
             ============================================ */
          .artist-banner {
            width: 100%;
            height: 180px;
            background: linear-gradient(135deg, var(--accent), #8b5cf6);
            border-radius: var(--radius-xl);
            overflow: hidden;
            margin-bottom: -60px;
          }
          
          .artist-banner img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center center;
          }
          
          @media (min-width: 768px) {
            .artist-banner {
              height: 220px;
            }
          }
          
          @media (min-width: 1024px) {
            .artist-banner {
              height: 260px;
            }
          }
          
          @media (min-width: 1280px) {
            .artist-banner {
              height: 300px;
            }
          }
          
          /* ============================================
             Artist Profile Card
             ============================================ */
          .artist-profile-card {
            display: flex;
            align-items: flex-start;
            gap: 20px;
            padding: 0 24px;
            margin-bottom: 32px;
          }
          
          @media (max-width: 640px) {
            .artist-profile-card {
              flex-direction: column;
              align-items: center;
              text-align: center;
              padding: 0 16px;
            }
          }
          
          .artist-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 4px solid var(--bg-primary);
            background: linear-gradient(135deg, var(--accent), #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            font-weight: 700;
            color: white;
            flex-shrink: 0;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          }
          
          .artist-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .artist-info {
            flex: 1;
            min-width: 0;
            padding-top: 60px;
          }
          
          @media (max-width: 640px) {
            .artist-info {
              padding-top: 0;
              width: 100%;
            }
          }
          
          .artist-name {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 4px;
            color: var(--text-primary);
          }
          
          .artist-address {
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: 12px;
          }
          
          /* ============================================
             Artist Bio - FIXED overflow
             ============================================ */
          .artist-bio-container {
            max-width: 500px;
            margin-bottom: 12px;
          }
          
          .artist-bio {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.6;
            max-height: 100px;
            overflow-y: auto;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            padding-right: 8px;
            margin: 0;
          }
          
          /* Custom scrollbar for bio */
          .artist-bio::-webkit-scrollbar {
            width: 4px;
          }
          
          .artist-bio::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .artist-bio::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 2px;
          }
          
          .artist-bio::-webkit-scrollbar-thumb:hover {
            background: var(--border-light);
          }
          
          @media (max-width: 640px) {
            .artist-bio-container {
              max-width: 100%;
              width: 100%;
            }
            
            .artist-bio {
              max-height: 120px;
              text-align: center;
              padding-right: 0;
            }
          }
          
          .artist-website {
            color: var(--accent);
            font-size: 14px;
            text-decoration: none;
            transition: opacity 150ms;
          }
          
          .artist-website:hover {
            opacity: 0.8;
            text-decoration: underline;
          }
          
          /* ============================================
             Artist Actions
             ============================================ */
          .artist-actions {
            padding-top: 60px;
            flex-shrink: 0;
          }
          
          @media (max-width: 640px) {
            .artist-actions {
              padding-top: 16px;
              width: 100%;
              display: flex;
              justify-content: center;
            }
          }
          
          /* ============================================
             Artist Releases Section
             ============================================ */
          .artist-releases {
            padding: 0 24px;
          }
          
          @media (max-width: 640px) {
            .artist-releases {
              padding: 0 16px;
            }
          }
        </style>
      `);
      
      // Bind share button
      document.getElementById('share-artist-btn')?.addEventListener('click', () => {
        ShareUtils.shareArtistProfile({
          address: address,
          displayName: displayName,
          artistName: profile?.name,
          avatarUrl: profile?.avatarUrl
        });
      });
      
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
