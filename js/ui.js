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
          const results = await API.searchReleases(query);
          this.showSearchResults(results);
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
  },
  
  /**
   * Show search results
   */
  showSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 32px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <p style="margin-top: 8px; color: var(--text-muted);">No results found</p>
        </div>
      `;
      container.classList.remove('hidden');
      return;
    }
    
    container.innerHTML = results.map(release => `
      <div class="search-result-item" data-release-id="${release.id}">
        <img 
          class="search-result-cover" 
          src="${IpfsHelper.toProxyUrl(release.coverUrl) || '/placeholder.png'}"
          alt="${release.title}"
        >
        <div class="search-result-info">
          <div class="search-result-title">${release.title}</div>
          <div class="search-result-artist">
            ${release.artistName || Helpers.truncateAddress(release.artistAddress)} • ${release.type}
          </div>
        </div>
        <div class="search-result-price">${release.songPrice} XRP</div>
      </div>
    `).join('');
    
    // Bind click events
    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const releaseId = item.dataset.releaseId;
        const release = results.find(r => r.id === releaseId);
        if (release) {
          Modals.showRelease(release);
          container.classList.add('hidden');
          document.getElementById('search-input').value = '';
          document.getElementById('search-clear')?.classList.add('hidden');
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
