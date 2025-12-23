/**
 * XRP Music - State Management
 * Simple global state with session persistence
 * Session clears when browser closes
 */

const AppState = {
  // Current page
  currentPage: 'stream',
  
  // User/Auth state
  user: null,
  profile: null,
  
  // Player state
  player: {
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    isPlaying: false,
    volume: 80,
    isMuted: false,
    isShuffled: false,
    isRepeat: false,
    progress: 0,
    duration: 0,
  },
  
  // Data caches
  releases: [],
  playlists: [],
  likedTrackIds: new Set(),
  
  // UI state
  theme: 'dark',
  sidebarOpen: false,
  expandedPlayer: false,
};

// Storage keys
const STORAGE_KEYS = {
  theme: 'xrpmusic_theme',
  page: 'xrpmusic_page',
  session: 'xrpmusic_wallet_session',
  volume: 'xrpmusic_volume',
};

/**
 * Initialize state from storage
 * Theme & volume persist (localStorage)
 * Session expires on browser close (sessionStorage)
 */
function initState() {
  // Load theme (persists)
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    AppState.theme = savedTheme;
  }
  
  // Load page (persists)
  const savedPage = localStorage.getItem(STORAGE_KEYS.page);
  if (savedPage && ['stream', 'marketplace', 'profile', 'liked', 'playlists'].includes(savedPage)) {
    AppState.currentPage = savedPage;
  }
  
  // Load volume (persists)
  const savedVolume = localStorage.getItem(STORAGE_KEYS.volume);
  if (savedVolume !== null) {
    AppState.player.volume = parseInt(savedVolume, 10);
  }
  
  // Load session from sessionStorage (clears on browser close)
  const savedSession = sessionStorage.getItem(STORAGE_KEYS.session);
  if (savedSession) {
    try {
      const { address } = JSON.parse(savedSession);
      if (address) {
        AppState.user = { address };
      }
    } catch (e) {
      sessionStorage.removeItem(STORAGE_KEYS.session);
    }
  }
}

/**
 * Save theme to localStorage
 */
function saveTheme(theme) {
  AppState.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

/**
 * Save current page to localStorage
 */
function savePage(page) {
  AppState.currentPage = page;
  localStorage.setItem(STORAGE_KEYS.page, page);
}

/**
 * Save volume to localStorage
 */
function saveVolume(volume) {
  AppState.player.volume = volume;
  localStorage.setItem(STORAGE_KEYS.volume, volume.toString());
}

/**
 * Save wallet session to sessionStorage
 * Session clears when browser is closed
 */
function saveSession(address) {
  AppState.user = { address };
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ address }));
}

/**
 * Clear wallet session
 */
function clearSession() {
  AppState.user = null;
  AppState.profile = null;
  AppState.playlists = [];
  AppState.likedTrackIds.clear();
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

/**
 * Set user profile
 */
function setProfile(profile) {
  AppState.profile = profile;
}

/**
 * Update player state
 */
function updatePlayer(updates) {
  Object.assign(AppState.player, updates);
}

/**
 * Set current track
 */
function setCurrentTrack(track) {
  AppState.player.currentTrack = track;
}

/**
 * Set queue
 */
function setQueue(tracks, startIndex = 0) {
  AppState.player.queue = tracks;
  AppState.player.queueIndex = startIndex;
}

/**
 * Add to liked tracks
 */
function addLikedTrack(trackId) {
  AppState.likedTrackIds.add(trackId);
}

/**
 * Remove from liked tracks
 */
function removeLikedTrack(trackId) {
  AppState.likedTrackIds.delete(trackId);
}

/**
 * Check if track is liked
 */
function isTrackLiked(trackId) {
  return AppState.likedTrackIds.has(trackId);
}

/**
 * Set releases
 */
function setReleases(releases) {
  AppState.releases = releases;
}

/**
 * Set playlists
 */
function setPlaylists(playlists) {
  AppState.playlists = playlists;
}

/**
 * Helper to get display name
 */
function getDisplayName() {
  if (AppState.profile?.name) return AppState.profile.name;
  if (AppState.user?.address) {
    return `${AppState.user.address.slice(0, 6)}...${AppState.user.address.slice(-4)}`;
  }
  return 'Anonymous';
}

/**
 * Helper to get user initial
 */
function getUserInitial() {
  if (AppState.profile?.name) return AppState.profile.name[0].toUpperCase();
  if (AppState.user?.address) return AppState.user.address[0].toUpperCase();
  return 'X';
}

// Initialize state on load
initState();
