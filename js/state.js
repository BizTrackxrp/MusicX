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
  
  // External music NFTs (from XRP Cafe, etc)
  externalNfts: [],
  externalNftsLoaded: false,
  externalNftsScanning: false,
  
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
  AppState.externalNfts = [];
  AppState.externalNftsLoaded = false;
  AppState.externalNftsScanning = false;
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


// =====================================================
// EXTERNAL MUSIC NFTs
// =====================================================

/**
 * Scan wallet for external music NFTs (from XRP Cafe, etc).
 * Call this after wallet connect — runs in background, doesn't block UI.
 * Results cached server-side, so second call is instant.
 */
async function scanExternalMusicNfts(walletAddress) {
  if (!walletAddress || AppState.externalNftsScanning) return;
  
  AppState.externalNftsScanning = true;
  
  try {
    // Step 1: Get cached results instantly
    const listRes = await fetch('/api/external-nfts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', walletAddress }),
    });
    const listData = await listRes.json();
    
    if (listData.success && listData.nfts?.length > 0) {
      AppState.externalNfts = listData.nfts.map(normalizeExternalNft);
      AppState.externalNftsLoaded = true;
      console.log(`🎵 Loaded ${listData.nfts.length} cached external music NFTs`);
    }
    
    // Step 2: Background scan (API handles cooldown automatically)
    const scanRes = await fetch('/api/external-nfts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan', walletAddress }),
    });
    const scanData = await scanRes.json();
    
    if (scanData.success) {
      AppState.externalNfts = (scanData.nfts || []).map(normalizeExternalNft);
      AppState.externalNftsLoaded = true;
      
      if (!scanData.fromCache) {
        console.log(`🔍 Scan complete: ${scanData.totalFound} music NFTs from ${scanData.totalWalletNfts} total wallet NFTs`);
      }
    }
  } catch (error) {
    console.error('External NFT scan failed:', error);
  } finally {
    AppState.externalNftsScanning = false;
  }
}

/**
 * Force re-scan wallet for external music NFTs (ignores cooldown).
 * Use for manual "Rescan Wallet" button.
 */
async function refreshExternalNfts() {
  if (!AppState.user?.address) return;
  
  AppState.externalNftsScanning = true;
  
  try {
    const res = await fetch('/api/external-nfts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh',
        walletAddress: AppState.user.address,
      }),
    });
    const data = await res.json();
    
    if (data.success) {
      AppState.externalNfts = (data.nfts || []).map(normalizeExternalNft);
      AppState.externalNftsLoaded = true;
      console.log(`🔄 Refreshed: ${data.totalFound} music NFTs`);
    }
  } catch (error) {
    console.error('External NFT refresh failed:', error);
  } finally {
    AppState.externalNftsScanning = false;
  }
}

/**
 * Normalize a DB record from /api/external-nfts into player-compatible format.
 * Uses IpfsHelper to resolve ipfs:// URIs through the /api/ipfs/ proxy.
 */
function normalizeExternalNft(nft) {
  const coverUrl = typeof IpfsHelper !== 'undefined'
    ? IpfsHelper.toProxyUrl(nft.image_url)
    : nft.image_url;
  const audioProxyUrl = typeof IpfsHelper !== 'undefined'
    ? IpfsHelper.toProxyUrl(nft.audio_url)
    : nft.audio_url;
  const audioCid = typeof IpfsHelper !== 'undefined'
    ? IpfsHelper.extractCid(nft.audio_url)
    : null;
  
  return {
    // Player-compatible fields (same shape as platform tracks)
    id: nft.id,
    trackId: nft.id,
    title: nft.name || 'Unknown Track',
    artist: nft.artist_name || nft.collection_name || 'Unknown Artist',
    cover: coverUrl,
    ipfsHash: audioCid,
    audioUrl: audioProxyUrl,
    duration: 0,
    
    // External NFT metadata
    isExternal: true,
    nftTokenId: nft.nft_token_id,
    issuer: nft.issuer,
    collectionName: nft.collection_name,
    description: nft.description,
    metadataUri: nft.metadata_uri,
    
    // For UI display
    releaseTitle: nft.collection_name || nft.name,
    artistName: nft.artist_name || nft.collection_name || 'Unknown Artist',
    coverUrl: coverUrl,
  };
}


// =====================================================
// LIKES FUNCTIONALITY
// =====================================================

/**
 * Check if a track is liked by the current user
 * Uses the cached Set in AppState for instant lookups
 */
function isTrackLiked(trackId) {
  if (!trackId) return false;
  return AppState.likedTrackIds?.has(trackId.toString()) || false;
}

/**
 * Add to liked tracks (local state only)
 */
function addLikedTrack(trackId) {
  if (trackId) AppState.likedTrackIds.add(trackId.toString());
}

/**
 * Remove from liked tracks (local state only)
 */
function removeLikedTrack(trackId) {
  if (trackId) AppState.likedTrackIds.delete(trackId.toString());
}

/**
 * Toggle like status for a track
 * Updates local state immediately (optimistic), then syncs with server
 * @param {string} trackId - The track ID to like/unlike
 * @param {string} releaseId - The release ID (required for liking)
 * @returns {Promise<boolean>} - The new liked state
 */
async function toggleTrackLike(trackId, releaseId) {
  if (!AppState.user?.address) {
    // Show auth modal if not logged in
    if (typeof Modals !== 'undefined' && Modals.showAuth) {
      Modals.showAuth();
    }
    return false;
  }
  
  if (!trackId) {
    console.error('toggleTrackLike: No trackId provided');
    return false;
  }
  
  const trackIdStr = trackId.toString();
  const isCurrentlyLiked = isTrackLiked(trackIdStr);
  
  // Optimistic update - update UI immediately
  if (isCurrentlyLiked) {
    AppState.likedTrackIds.delete(trackIdStr);
  } else {
    AppState.likedTrackIds.add(trackIdStr);
  }
  
  // Update any visible like buttons
  updateLikeButtons(trackIdStr, !isCurrentlyLiked);
  
  try {
    // Sync with server
    if (isCurrentlyLiked) {
      await API.unlikeTrack(AppState.user.address, trackIdStr);
    } else {
      if (!releaseId) {
        console.error('toggleTrackLike: releaseId required for liking');
        // Revert optimistic update
        AppState.likedTrackIds.delete(trackIdStr);
        updateLikeButtons(trackIdStr, false);
        return false;
      }
      await API.likeTrack(AppState.user.address, trackIdStr, releaseId);
    }
    
    return !isCurrentlyLiked; // Return new liked state
    
  } catch (error) {
    console.error('Failed to toggle like:', error);
    
    // Revert optimistic update on error
    if (isCurrentlyLiked) {
      AppState.likedTrackIds.add(trackIdStr);
    } else {
      AppState.likedTrackIds.delete(trackIdStr);
    }
    updateLikeButtons(trackIdStr, isCurrentlyLiked);
    
    return isCurrentlyLiked;
  }
}

/**
 * Update all like buttons for a track across the UI
 * @param {string} trackId - The track ID
 * @param {boolean} isLiked - Whether the track is now liked
 */
function updateLikeButtons(trackId, isLiked) {
  // Update player like button
  const playerLikeBtn = document.getElementById('player-like-btn');
  if (playerLikeBtn) {
    const currentTrack = AppState.player.currentTrack;
    const currentTrackId = currentTrack?.trackId || currentTrack?.id?.toString();
    if (currentTrackId === trackId) {
      playerLikeBtn.classList.toggle('liked', isLiked);
      playerLikeBtn.setAttribute('title', isLiked ? 'Unlike' : 'Like');
      const svg = playerLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
  }
  
  // Update now playing modal like button
  const npLikeBtn = document.getElementById('np-like-btn');
  if (npLikeBtn) {
    const currentTrack = AppState.player.currentTrack;
    const currentTrackId = currentTrack?.trackId || currentTrack?.id?.toString();
    if (currentTrackId === trackId) {
      npLikeBtn.classList.toggle('liked', isLiked);
      const svg = npLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
  }
  
  // Update any track row like buttons (in lists, search results, etc.)
  document.querySelectorAll(`.like-track-btn[data-track-id="${trackId}"]`).forEach(btn => {
    btn.classList.toggle('liked', isLiked);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
  });
}

/**
 * Sync player like button with current track's liked state
 * Call this when track changes
 */
function syncPlayerLikeButton() {
  const currentTrack = AppState.player.currentTrack;
  if (!currentTrack) return;
  
  const trackId = currentTrack.trackId || currentTrack.id?.toString();
  const isLiked = isTrackLiked(trackId);
  
  // Update player like button
  const playerLikeBtn = document.getElementById('player-like-btn');
  if (playerLikeBtn) {
    playerLikeBtn.classList.toggle('liked', isLiked);
    playerLikeBtn.setAttribute('title', isLiked ? 'Unlike' : 'Like');
    const svg = playerLikeBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
  }
  
  // Update now playing modal like button
  const npLikeBtn = document.getElementById('np-like-btn');
  if (npLikeBtn) {
    npLikeBtn.classList.toggle('liked', isLiked);
    const svg = npLikeBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
  }
}


// =====================================================
// PLAYLIST FUNCTIONALITY
// =====================================================

/**
 * Get or create the "Liked Songs" system playlist for a user
 * @returns {Promise<Object|null>} The Liked Songs playlist or null
 */
async function getLikedSongsPlaylist() {
  if (!AppState.user?.address) return null;
  
  // Check if we already have it cached
  const existing = AppState.playlists?.find(p => p.is_system && p.name === 'Liked Songs');
  if (existing) return existing;
  
  // Fetch from server
  const playlists = await API.getPlaylists(AppState.user.address);
  const likedSongs = playlists.find(p => p.is_system && p.name === 'Liked Songs');
  
  return likedSongs || null;
}

/**
 * Show the "Add to Playlist" modal for a track
 * @param {Object} track - Track object with id, title, artist, cover
 * @param {string} releaseId - The release ID
 */
async function showAddToPlaylistModal(track, releaseId) {
  if (!AppState.user?.address) {
    if (typeof Modals !== 'undefined' && Modals.showAuth) {
      Modals.showAuth();
    }
    return;
  }
  
  // Get user's playlists
  let playlists = [];
  try {
    playlists = await API.getPlaylists(AppState.user.address);
  } catch (err) {
    console.error('Failed to fetch playlists:', err);
  }
  
  // Filter out system playlists (Liked Songs is managed via like button)
  const userPlaylists = playlists.filter(p => !p.is_system);
  
  const html = `
    <div class="modal-overlay add-to-playlist-modal" onclick="if(event.target===this)Modals.close()">
      <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
          <div class="modal-title">Add to Playlist</div>
          <button class="modal-close" onclick="Modals.close()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Track being added -->
          <div class="atp-track" style="display:flex;gap:12px;padding:12px;background:var(--bg-hover);border-radius:var(--radius-md);margin-bottom:20px;">
            <div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background:var(--bg-card);display:flex;align-items:center;justify-content:center;">
              ${track.cover ? `<img src="${track.cover}" alt="" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:24px;">🎵</span>'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${track.title || 'Unknown Track'}</div>
              <div style="font-size:13px;color:var(--text-muted);">${track.artist || 'Unknown Artist'}</div>
            </div>
          </div>
          
          <!-- Create new playlist -->
          <button class="atp-create-btn" id="atp-create-btn" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px;background:none;border:1px dashed var(--border-color);border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;margin-bottom:12px;transition:all 0.2s;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Create New Playlist</span>
          </button>
          
          <!-- New playlist input (hidden by default) -->
          <div id="atp-new-playlist" style="display:none;margin-bottom:12px;">
            <input type="text" class="form-input" id="atp-new-name" placeholder="Playlist name" style="margin-bottom:8px;width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-card);color:var(--text-primary);">
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" id="atp-cancel-new" style="flex:1;padding:8px;border-radius:var(--radius-md);cursor:pointer;">Cancel</button>
              <button class="btn btn-primary btn-sm" id="atp-save-new" style="flex:1;padding:8px;border-radius:var(--radius-md);cursor:pointer;background:var(--accent);color:white;border:none;">Create & Add</button>
            </div>
          </div>
          
          <!-- Existing playlists -->
          <div class="atp-playlists" id="atp-playlists" style="max-height:250px;overflow-y:auto;">
            ${userPlaylists.length === 0 ? `
              <p style="text-align:center;color:var(--text-muted);padding:20px;">No playlists yet. Create one above!</p>
            ` : userPlaylists.map(p => `
              <button class="atp-playlist-item" data-playlist-id="${p.id}" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px;background:none;border:none;border-radius:var(--radius-md);color:var(--text-primary);cursor:pointer;text-align:left;transition:background 0.2s;">
                <div style="width:40px;height:40px;border-radius:6px;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  ${p.cover_url ? `<img src="${p.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${p.track_count || 0} tracks</div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
    
    <style>
      .atp-playlist-item:hover { background: var(--bg-hover); }
      .atp-create-btn:hover { border-color: var(--accent); color: var(--accent); }
      .btn-secondary { background: var(--bg-hover); border: 1px solid var(--border-color); color: var(--text-primary); }
      .btn-secondary:hover { background: var(--bg-card); }
    </style>
  `;
  
  // Show modal
  if (typeof Modals !== 'undefined' && Modals.show) {
    Modals.show(html);
  } else {
    // Fallback: inject directly
    document.body.insertAdjacentHTML('beforeend', html);
  }
  
  // Bind events after a tick to ensure DOM is ready
  setTimeout(() => {
    const trackIdToAdd = track.trackId || track.id;
    
    // Show create new playlist form
    document.getElementById('atp-create-btn')?.addEventListener('click', () => {
      document.getElementById('atp-create-btn').style.display = 'none';
      document.getElementById('atp-new-playlist').style.display = 'block';
      document.getElementById('atp-new-name').focus();
    });
    
    // Cancel create new
    document.getElementById('atp-cancel-new')?.addEventListener('click', () => {
      document.getElementById('atp-create-btn').style.display = 'flex';
      document.getElementById('atp-new-playlist').style.display = 'none';
      document.getElementById('atp-new-name').value = '';
    });
    
    // Save new playlist and add track
    document.getElementById('atp-save-new')?.addEventListener('click', async () => {
      const name = document.getElementById('atp-new-name').value.trim();
      if (!name) {
        document.getElementById('atp-new-name').focus();
        return;
      }
      
      try {
        const result = await API.createPlaylist(name, AppState.user.address);
        await API.addTrackToPlaylist(result.playlistId, AppState.user.address, trackIdToAdd, releaseId);
        
        // Close modal
        if (typeof Modals !== 'undefined' && Modals.close) {
          Modals.close();
        } else {
          document.querySelector('.add-to-playlist-modal')?.remove();
        }
        
        // Show toast
        showToast(`Added to "${name}"`);
        
        // Refresh playlists cache
        const updatedPlaylists = await API.getPlaylists(AppState.user.address);
        setPlaylists(updatedPlaylists);
        
      } catch (err) {
        console.error('Failed to create playlist:', err);
        alert('Failed to create playlist. Please try again.');
      }
    });
    
    // Add to existing playlist
    document.querySelectorAll('.atp-playlist-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const playlistId = btn.dataset.playlistId;
        const playlistName = btn.querySelector('div > div').textContent;
        
        try {
          await API.addTrackToPlaylist(playlistId, AppState.user.address, trackIdToAdd, releaseId);
          
          // Close modal
          if (typeof Modals !== 'undefined' && Modals.close) {
            Modals.close();
          } else {
            document.querySelector('.add-to-playlist-modal')?.remove();
          }
          
          // Show toast
          showToast(`Added to "${playlistName}"`);
          
        } catch (err) {
          console.error('Failed to add to playlist:', err);
          if (err.message?.includes('already')) {
            showToast('Track already in playlist');
          } else {
            alert('Failed to add track. Please try again.');
          }
        }
      });
    });
  }, 10);
}

/**
 * Simple toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, duration = 3000) {
  // Remove existing toast
  document.querySelector('.toast-notification')?.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-card);
    color: var(--text-primary);
    padding: 12px 24px;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: toastIn 0.3s ease;
    border: 1px solid var(--border-color);
  `;
  toast.textContent = message;
  
  // Add animation keyframes if not exists
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toastOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}


// Initialize state on load
initState();
