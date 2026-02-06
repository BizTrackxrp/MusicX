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
    // Genre page URL
    if (page === 'genre' && params.id) {
      return `/genre/${params.id}`;
    }
    // Browse genres page
    if (page === 'genres') {
      return '/genres';
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
    // Handles both /release/rel_xxx and /release/rel_xxx?track=trk_xxx
    if (path.startsWith('/release/')) {
      let releasePath = path.replace('/release/', '');
      // Handle ?track= param that may be embedded in the path (from OG redirects)
      let trackId = null;
      if (releasePath.includes('?')) {
        const parts = releasePath.split('?');
        releasePath = parts[0];
        const relParams = new URLSearchParams(parts[1]);
        trackId = relParams.get('track');
      }
      // Also check actual URL search params
      if (!trackId) trackId = searchParams.get('track');
      return { page: 'release', params: { id: releasePath, track: trackId } };
    }
    
    // Genre page (single genre)
    if (path.startsWith('/genre/')) {
      const id = path.replace('/genre/', '');
      return { page: 'genre', params: { id } };
    }
    
    // Browse genres page
    if (path === '/genres') {
      return { page: 'genres', params: {} };
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
        // Use PlaylistPage if available, otherwise fallback
        if (typeof PlaylistPage !== 'undefined') {
          PlaylistPage.render(this.params);
        } else {
          this.renderPlaylistPage(this.params.id);
        }
        break;
      case 'release':
        // Direct link to release - show stream page then open modal
        this.openReleaseFromUrl(this.params.id, this.params.track);
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
      // ========== GENRE ROUTES ==========
      case 'genres':
        // Browse all genres page
        if (typeof BrowseGenresPage !== 'undefined') {
          BrowseGenresPage.render();
        } else {
          console.error('BrowseGenresPage not loaded');
          StreamPage.render();
        }
        break;
      case 'genre':
        // Single genre page (shows all tracks in that genre)
        if (typeof GenrePage !== 'undefined') {
          GenrePage.render(this.params);
        } else {
          console.error('GenrePage not loaded');
          StreamPage.render();
        }
        break;
      // ===================================
      default:
        StreamPage.render();
    }
  },
  
  /**
   * Open release modal from direct URL
   * FIXED: Prevents double-open, properly separates releaseId from track param
   */
  async openReleaseFromUrl(releaseId, trackId) {
    if (!releaseId) {
      StreamPage.render();
      return;
    }
    
    // Prevent double-open (redirect + route can both trigger this)
    if (this._openingRelease === releaseId) return;
    this._openingRelease = releaseId;
    
    try {
      // Fetch the release data first
      const data = await API.getRelease(releaseId);
      
      if (!data?.release) {
        console.error('Release not found:', releaseId);
        Modals.showToast('Release not found');
        this._openingRelease = null;
        StreamPage.render();
        return;
      }
      
      // Now render the stream page as background and wait for it
      await StreamPage.render();
      
      // Update URL with clean release path (and track if present)
      const cleanUrl = trackId 
        ? `/release/${releaseId}?track=${trackId}` 
        : `/release/${releaseId}`;
      history.replaceState({ page: 'release', params: { id: releaseId, track: trackId } }, '', cleanUrl);
      
      // Small delay to ensure DOM is ready, then show modal
      setTimeout(() => {
        Modals.showRelease(data.release);
        this._openingRelease = null;
      }, 50);
      
    } catch (error) {
      this._openingRelease = null;
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
                 ${playlist.cover_url || playlist.coverUrl
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
                  <div class="release-card-artist">${playlist.owner_name || Helpers.truncateAddress(playlist.owner_address || playlist.ownerAddress)}</div>
                  <div class="release-card-footer">
                    <span class="release-card-tracks">${playlist.track_count || playlist.trackCount || 0} tracks</span>
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
   * Render single playlist page (fallback if PlaylistPage not available)
   * FIXED: Now correctly gets tracks from data.playlist.tracks
   */
  async renderPlaylistPage(playlistId) {
    UI.showLoading();
    
    try {
      const data = await API.getPlaylist(playlistId, true, AppState.user?.address);
      const playlist = data.playlist;
      // FIX: tracks are inside data.playlist.tracks, not data.tracks
      const tracks = data.tracks || data.playlist?.tracks || [];
      
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
                    <img src="${track.cover_url || track.coverUrl || '/placeholder.png'}" alt="${track.title}">
                  </div>
                  <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${track.artist_name || track.artistName || Helpers.truncateAddress(track.artist_address || track.artistAddress)}</div>
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
              id: track.track_id || track.id,
              trackId: track.track_id || track.id,
              title: track.title,
              artist: track.artist_name || track.artistName || Helpers.truncateAddress(track.artist_address || track.artistAddress),
              cover: track.cover_url || track.coverUrl,
              ipfsHash: track.audio_cid || track.audioCid,
              releaseId: track.release_id || track.releaseId,
            };
            
            const queue = tracks.map(t => ({
              id: t.track_id || t.id,
              trackId: t.track_id || t.id,
              title: t.title,
              artist: t.artist_name || t.artistName || Helpers.truncateAddress(t.artist_address || t.artistAddress),
              cover: t.cover_url || t.coverUrl,
              ipfsHash: t.audio_cid || t.audioCid,
              releaseId: t.release_id || t.releaseId,
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
   * Show full bio in a modal
   */
  showBioModal(artistName, bio) {
    const overlay = document.createElement('div');
    overlay.className = 'bio-modal-overlay';
    overlay.innerHTML = `
      <div class="bio-modal">
        <div class="bio-modal-header">
          <h3>About ${artistName}</h3>
          <button class="bio-modal-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="bio-modal-content">${bio}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close handlers
    overlay.querySelector('.bio-modal-close').addEventListener('click', () => {
      overlay.remove();
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },
  
  /**
   * Render artist page (public profile)
   * UPDATED: Bio truncated with "more" button and modal popup
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
                  <p class="artist-bio" id="artist-bio-text">${profile.bio}</p>
                  <button class="artist-bio-more" id="artist-bio-more-btn" style="display: none;">more</button>
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
          .artist-page {
            padding-bottom: 120px;
          }
          
          @media (max-width: 1024px) {
            .artist-page {
              padding-bottom: 140px;
            }
          }
          
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
          
          .artist-bio-container {
            margin-bottom: 12px;
            max-width: 700px;
          }
          
          .artist-bio {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.6;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          .artist-bio-more {
            background: none;
            border: none;
            color: var(--accent);
            font-size: 14px;
            padding: 4px 0;
            cursor: pointer;
            margin-top: 4px;
          }
          
          .artist-bio-more:hover {
            text-decoration: underline;
          }
          
          @media (max-width: 640px) {
            .artist-bio-container {
              max-width: 100%;
              width: 100%;
            }
            
            .artist-bio {
              -webkit-line-clamp: 2;
              text-align: center;
            }
            
            .artist-bio-more {
              display: block;
              width: 100%;
              text-align: center;
            }
          }
          
          .bio-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }
          
          .bio-modal {
            background: var(--bg-secondary);
            border-radius: var(--radius-xl);
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .bio-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-color);
          }
          
          .bio-modal-header h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
          }
          
          .bio-modal-close {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .bio-modal-close:hover {
            color: var(--text-primary);
          }
          
          .bio-modal-content {
            padding: 24px;
            overflow-y: auto;
            color: var(--text-secondary);
            font-size: 15px;
            line-height: 1.7;
            white-space: pre-wrap;
            word-wrap: break-word;
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
      
      // Check if bio needs "more" button
      const bioText = document.getElementById('artist-bio-text');
      const bioMoreBtn = document.getElementById('artist-bio-more-btn');
      if (bioText && bioMoreBtn) {
        if (bioText.scrollHeight > bioText.clientHeight) {
          bioMoreBtn.style.display = 'block';
          bioMoreBtn.addEventListener('click', () => {
            this.showBioModal(displayName, profile.bio);
          });
        }
      }
      
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
  
  // Initialize queue manager
  if (typeof QueueManager !== 'undefined') {
    QueueManager.init();
  }
  
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
