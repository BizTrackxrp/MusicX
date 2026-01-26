/**
 * XRP Music - UI Utilities
 * DOM manipulation, theme, sidebar, auth UI
 */

const UI = {
  /**
   * Initialize UI
   */
  init() {
    this.applyTheme();
    this.bindGlobalEvents();
    this.updateAuthUI();
  },
  
  /**
   * Apply current theme
   */
  applyTheme() {
    if (AppState.theme === 'light') {
      document.body.classList.add('light');
      document.getElementById('moon-icon')?.classList.add('hidden');
      document.getElementById('sun-icon')?.classList.remove('hidden');
    } else {
      document.body.classList.remove('light');
      document.getElementById('moon-icon')?.classList.remove('hidden');
      document.getElementById('sun-icon')?.classList.add('hidden');
    }
  },
  
  /**
   * Toggle theme
   */
  toggleTheme() {
    const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    saveTheme(newTheme);
    this.applyTheme();
  },
  
  /**
   * Bind global events
   */
  bindGlobalEvents() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });
    
    // Mobile sidebar
    document.getElementById('menu-btn')?.addEventListener('click', () => {
      this.openSidebar();
    });
    
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      this.closeSidebar();
    });
    
    // Auth buttons
    document.getElementById('connect-btn')?.addEventListener('click', () => {
      Modals.showAuth();
    });
    
    document.getElementById('mobile-connect-btn')?.addEventListener('click', () => {
      Modals.showAuth();
    });
    
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      XamanWallet.disconnect();
    });
    
    // Nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        if (page) {
          Router.navigate(page);
          this.closeSidebar();
        }
      });
    });
    
    // Create button
    document.getElementById('create-btn')?.addEventListener('click', () => {
      Modals.showCreate();
      this.closeSidebar();
    });
    
    // Create playlist button
    document.getElementById('create-playlist-btn')?.addEventListener('click', () => {
      this.createPlaylist();
    });
    
    // Library toggle
    document.getElementById('library-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('collapsed');
      document.getElementById('library-content')?.classList.toggle('hidden');
    });
    
    // Search
    this.initSearch();
  },
  
  /**
   * Initialize search
   */
  initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      // Show/hide clear button
      searchClear?.classList.toggle('hidden', !query);
      
      // Clear previous timeout
      clearTimeout(searchTimeout);
      
      if (query.length < 2) {
        searchResults?.classList.add('hidden');
        return;
      }
      
      // Debounced search
      searchTimeout = setTimeout(async () => {
        try {
          const results = await API.search(query);
          this.showSearchResults(results, query);
        } catch (error) {
          console.error('Search failed:', error);
        }
      }, 300);
    });
    
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 2) {
        searchResults?.classList.remove('hidden');
      }
    });
    
    // Clear search
    searchClear?.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      searchResults?.classList.add('hidden');
    });
    
    // Close search results on outside click
    document.addEventListener('click', (e) => {
      const container = document.querySelector('.search-container');
      if (container && !container.contains(e.target)) {
        searchResults?.classList.add('hidden');
      }
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchResults?.classList.add('hidden');
        searchInput.blur();
      }
    });
  },
  
  /**
   * Show search results with categories
   */
  showSearchResults(results, query) {
    const container = document.getElementById('search-results');
    if (!container) return;
    
    const { artists = [], tracks = [], albums = [], singles = [] } = results;
    const hasResults = artists.length > 0 || tracks.length > 0 || albums.length > 0 || singles.length > 0;
    
    if (!hasResults) {
      container.innerHTML = `
        <div class="search-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>No results for "${query}"</p>
        </div>
      `;
      container.classList.remove('hidden');
      return;
    }
    
    let html = '';
    
    // Artists section
    if (artists.length > 0) {
      html += `
        <div class="search-section">
          <div class="search-section-title">Artists</div>
          ${artists.map(artist => `
            <div class="search-result-item" data-type="artist" data-address="${artist.address}">
              <div class="search-result-avatar">
                ${artist.avatar 
                  ? `<img src="${IpfsHelper.toProxyUrl(artist.avatar)}" alt="${artist.name}">`
                  : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>`
                }
              </div>
              <div class="search-result-info">
                <div class="search-result-title">${artist.name || Helpers.truncateAddress(artist.address)}</div>
                <div class="search-result-subtitle">Artist • ${artist.releaseCount} release${artist.releaseCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Albums section
    if (albums.length > 0) {
      html += `
        <div class="search-section">
          <div class="search-section-title">Albums</div>
          ${albums.map(album => `
            <div class="search-result-item" data-type="album" data-id="${album.id}">
              <img 
                class="search-result-cover" 
                src="${IpfsHelper.toProxyUrl(album.coverUrl) || '/placeholder.png'}"
                alt="${album.title}"
              >
              <div class="search-result-info">
                <div class="search-result-title">${album.title}</div>
                <div class="search-result-subtitle">${album.artistName || Helpers.truncateAddress(album.artistAddress)} • ${album.trackCount} tracks</div>
              </div>
              <div class="search-result-price">${album.price} XRP</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Singles section
    if (singles.length > 0) {
      html += `
        <div class="search-section">
          <div class="search-section-title">Singles</div>
          ${singles.map(single => `
            <div class="search-result-item" data-type="single" data-id="${single.id}">
              <img 
                class="search-result-cover" 
                src="${IpfsHelper.toProxyUrl(single.coverUrl) || '/placeholder.png'}"
                alt="${single.title}"
              >
              <div class="search-result-info">
                <div class="search-result-title">${single.title}</div>
                <div class="search-result-subtitle">${single.artistName || Helpers.truncateAddress(single.artistAddress)} • Single</div>
              </div>
              <div class="search-result-price">${single.price} XRP</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Tracks section
    if (tracks.length > 0) {
      html += `
        <div class="search-section">
          <div class="search-section-title">Tracks</div>
          ${tracks.map(track => `
            <div class="search-result-item" data-type="track" data-id="${track.id}" data-release-id="${track.releaseId}">
              <img 
                class="search-result-cover" 
                src="${IpfsHelper.toProxyUrl(track.coverUrl) || '/placeholder.png'}"
                alt="${track.title}"
              >
              <div class="search-result-info">
                <div class="search-result-title">${track.title}</div>
                <div class="search-result-subtitle">${track.artistName || Helpers.truncateAddress(track.artistAddress)} • ${track.releaseTitle}</div>
              </div>
              <div class="search-result-price">${track.price} XRP</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // Bind click events
    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', async () => {
        const type = item.dataset.type;
        
        // Close search
        container.classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear')?.classList.add('hidden');
        
        if (type === 'artist') {
          // Navigate to artist profile
          const address = item.dataset.address;
          Router.navigate('profile', { address });
        } else if (type === 'album' || type === 'single') {
          // Open release modal
          const releaseId = item.dataset.id;
          try {
            const data = await API.getRelease(releaseId);
            if (data.release) {
              Modals.showRelease(data.release);
            }
          } catch (error) {
            console.error('Failed to load release:', error);
          }
        } else if (type === 'track') {
          // Open release modal for the track's release
          const releaseId = item.dataset.releaseId;
          try {
            const data = await API.getRelease(releaseId);
            if (data.release) {
              Modals.showRelease(data.release);
            }
          } catch (error) {
            console.error('Failed to load release:', error);
          }
        }
      });
    });
    
    container.classList.remove('hidden');
  },
  
  /**
   * Open sidebar (mobile)
   */
  openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('visible');
    AppState.sidebarOpen = true;
  },
  
  /**
   * Close sidebar (mobile)
   */
  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    AppState.sidebarOpen = false;
  },
  
  /**
   * Update auth UI based on login state
   */
  updateAuthUI() {
    const isLoggedIn = !!AppState.user?.address;
    
    // Sidebar auth section
    const connectBtn = document.getElementById('connect-btn');
    const userCard = document.getElementById('user-card');
    const createBtn = document.getElementById('create-btn');
    const librarySection = document.getElementById('library-section');
    const mobileConnectBtn = document.getElementById('mobile-connect-btn');
    
    if (connectBtn) connectBtn.classList.toggle('hidden', isLoggedIn);
    if (userCard) userCard.classList.toggle('hidden', !isLoggedIn);
    if (createBtn) createBtn.classList.toggle('hidden', !isLoggedIn);
    if (librarySection) librarySection.classList.toggle('hidden', !isLoggedIn);
    if (mobileConnectBtn) mobileConnectBtn.classList.toggle('hidden', isLoggedIn);
    
    if (isLoggedIn) {
      this.updateUserCard();
      this.updatePlaylists();
      this.checkAndShowSalesTab();
    }
  },
  
  /**
   * Check if user is an artist with sales, show Sales tab if so
   */
  async checkAndShowSalesTab() {
    const salesNavItem = document.getElementById('sales-nav-item');
    if (!salesNavItem) return;
    
    // Hide by default
    salesNavItem.classList.add('hidden');
    
    if (!AppState.user?.address) return;
    
    try {
      const hasSales = await API.checkArtistHasSales(AppState.user.address);
      if (hasSales) {
        salesNavItem.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Failed to check artist sales:', error);
    }
  },
  
  /**
   * Update user card in sidebar
   */
  updateUserCard() {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const address = document.getElementById('user-address');
    
    if (avatar) {
      if (AppState.profile?.avatarUrl) {
        avatar.innerHTML = `<img src="${AppState.profile.avatarUrl}" alt="Avatar">`;
      } else {
        avatar.textContent = getUserInitial();
      }
    }
    
    if (name) {
      name.textContent = getDisplayName();
    }
    
    if (address && AppState.user?.address) {
      address.textContent = Helpers.truncateAddress(AppState.user.address, 8, 4);
    }
  },
  
  /**
   * Show logged in state
   */
  showLoggedInState() {
    this.updateAuthUI();
    this.updatePlaylists();
    
    // Reload current page to show user-specific content
    Router.reload();
  },
  
  /**
   * Show logged out state
   */
  showLoggedOutState() {
    this.updateAuthUI();
    
    // Hide sales tab
    const salesNavItem = document.getElementById('sales-nav-item');
    if (salesNavItem) salesNavItem.classList.add('hidden');
    
    // Navigate to stream if on profile or other user-only pages
    if (['profile', 'liked', 'sales'].includes(AppState.currentPage)) {
      Router.navigate('stream');
    }
  },
  
  /**
   * Update playlists in sidebar
   */
  async updatePlaylists() {
    if (!AppState.user?.address) return;
    
    const container = document.getElementById('user-playlists');
    if (!container) return;
    
    try {
      const playlists = await API.getPlaylists(AppState.user.address);
      setPlaylists(playlists);
      
      if (playlists.length === 0) {
        container.innerHTML = '';
        return;
      }
      
      container.innerHTML = playlists.map(playlist => `
        <button class="nav-item" data-playlist-id="${playlist.id}">
          <div class="playlist-icon">
            ${playlist.coverUrl 
              ? `<img src="${playlist.coverUrl}" alt="${playlist.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>`
            }
          </div>
          <div class="nav-item-info">
            <span>${playlist.name}</span>
            <span class="track-count">${playlist.trackCount} songs</span>
          </div>
        </button>
      `).join('');
      
      // Bind click events
      container.querySelectorAll('.nav-item[data-playlist-id]').forEach(item => {
        item.addEventListener('click', () => {
          const playlistId = item.dataset.playlistId;
          Router.navigate('playlist', { id: playlistId });
          this.closeSidebar();
        });
      });
      
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  },
  
  /**
   * Update liked count in sidebar
   */
  updateLikedCount(count) {
    const countEl = document.getElementById('liked-count');
    if (countEl) {
      countEl.textContent = count > 0 ? `${count} songs` : '';
    }
  },
  
  /**
   * Create new playlist
   */
  async createPlaylist() {
    if (!AppState.user?.address) {
      Modals.showAuth();
      return;
    }
    
    try {
      const name = `My Playlist #${AppState.playlists.length + 1}`;
      const result = await API.createPlaylist(name, AppState.user.address);
      
      if (result.success && result.playlistId) {
        await this.updatePlaylists();
        Router.navigate('playlist', { id: result.playlistId });
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  },
  
  /**
   * Set active nav item
   */
  setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemPage = item.dataset.page;
      item.classList.toggle('active', itemPage === page);
    });
  },
  
  /**
   * Show loading state
   */
  showLoading() {
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
      `;
    }
  },
  
  /**
   * Render page content
   */
  renderPage(html) {
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = html;
    }
  },
  
  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // TODO: Implement toast notifications
    console.log(`[${type}] ${message}`);
  },
};
