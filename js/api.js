/**
 * XRP Music - API Client
 * Fetch wrappers for all backend endpoints
 */

// IPFS Gateway configuration - MUST be defined before any code uses it
const IPFS_GATEWAYS = [
  '/api/ipfs/',  // Our proxy - FIRST choice (bypasses blockers)
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

/**
 * IPFS Helper - Centralized IPFS URL handling
 * Use this for ALL image/audio URLs from IPFS
 */
const IpfsHelper = {
  /**
   * Convert any IPFS URL to use our proxy
   * This bypasses security software that blocks IPFS gateways
   */
  toProxyUrl(url) {
    if (!url) return '/placeholder.png';
    
    // Already using our proxy
    if (url.startsWith('/api/ipfs/')) return url;
    
    // Extract CID from various formats
    let cid = null;
    
    // Format: ipfs://QmXxx
    if (url.startsWith('ipfs://')) {
      cid = url.replace('ipfs://', '');
    }
    // Format: https://gateway.../ipfs/QmXxx
    else if (url.includes('/ipfs/')) {
      cid = url.split('/ipfs/')[1].split('?')[0].split('#')[0];
    }
    // Format: Raw CID (starts with Qm or bafy)
    else if (url.startsWith('Qm') || url.startsWith('bafy')) {
      cid = url.split('?')[0].split('#')[0];
    }
    
    if (cid) {
      return `/api/ipfs/${cid}`;
    }
    
    // Not an IPFS URL, return as-is
    return url;
  },
  
  /**
   * Get gateway URL with fallback support
   * @param {string} cid - The IPFS CID
   * @param {number} gatewayIndex - Which gateway to use (0 = proxy)
   */
  getGatewayUrl(cid, gatewayIndex = 0) {
    if (!cid) return '/placeholder.png';
    
    // Clean the CID
    if (cid.includes('/ipfs/')) {
      cid = cid.split('/ipfs/')[1].split('?')[0];
    }
    if (cid.startsWith('ipfs://')) {
      cid = cid.replace('ipfs://', '');
    }
    
    const index = Math.min(gatewayIndex, IPFS_GATEWAYS.length - 1);
    return `${IPFS_GATEWAYS[index]}${cid}`;
  }
};

const API = {
  /**
   * Base fetch with error handling
   */
  async fetch(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API Error (${url}):`, error);
      throw error;
    }
  },

  // ============================================
  // RELEASES
  // ============================================
  
  /**
   * Get all releases (only minted releases shown publicly)
   */
  async getReleases() {
    const data = await this.fetch('/api/releases');
    return data.releases || [];
  },
  
  /**
   * Get releases by artist
   * @param {string} artistAddress - The artist's wallet address
   * @param {boolean} includeUnminted - If true, includes releases still being minted (for artist's own profile)
   */
  async getReleasesByArtist(artistAddress, includeUnminted = false) {
    let url = `/api/releases?artist=${artistAddress}`;
    if (includeUnminted) {
      url += '&includeUnminted=true';
    }
    const data = await this.fetch(url);
    return data.releases || [];
  },
  
  /**
   * Save a new release
   */
  async saveRelease(release) {
    return this.fetch('/api/releases', {
      method: 'POST',
      body: JSON.stringify(release),
    });
  },
  
  /**
   * Update an existing release
   */
  async updateRelease(releaseId, updates) {
    return this.fetch(`/api/releases?id=${releaseId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  
  /**
   * Delete a release (used for cleanup on failed mints)
   */
  async deleteRelease(releaseId) {
    return this.fetch(`/api/releases?id=${releaseId}`, {
      method: 'DELETE',
    });
  },
  
  /**
   * Search releases
   */
  async searchReleases(query) {
    if (!query || query.trim().length < 2) return [];
    const data = await this.fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
    return data.releases || [];
  },

  /**
   * Get a single release by ID
   */
  async getRelease(releaseId) {
    const data = await this.fetch(`/api/releases?id=${releaseId}`);
    return data;
  },

  // ============================================
  // MINT JOBS / NOTIFICATIONS
  // ============================================
  
  /**
   * Get user's mint jobs for notification bell
   */
  async getMyMintJobs(address) {
    const data = await this.fetch(`/api/my-mint-jobs?address=${address}`);
    return data;
  },
  
  /**
   * Mark a mint job notification as seen
   */
  async markJobSeen(jobId, address) {
    return this.fetch('/api/mark-job-seen', {
      method: 'POST',
      body: JSON.stringify({ jobId, address }),
    });
  },
  
  /**
   * Get mint job progress
   */
  async getMintProgress(jobId) {
    const data = await this.fetch(`/api/mint-progress?jobId=${jobId}`);
    return data;
  },

  // ============================================
  // PLAYS / STREAMS
  // ============================================
  
  /**
   * Record a play event
   * Called after ~30 seconds of listening
   */
  async recordPlay(trackId, releaseId, userAddress = null, sessionId = null, duration = null) {
    return this.fetch('/api/plays', {
      method: 'POST',
      body: JSON.stringify({
        trackId,
        releaseId,
        userAddress,
        sessionId,
        duration,
      }),
    });
  },
  
  /**
   * Get top played tracks for a period
   * @param {string} period - '1d', '7d', '30d', '365d', or 'all'
   * @param {number} limit - Number of tracks to return (default 10)
   */
  async getTopTracks(period = '7d', limit = 10) {
    const data = await this.fetch(`/api/plays?action=top&period=${period}&limit=${limit}`);
    return data.tracks || [];
  },
  
  /**
   * Get play counts for specific tracks
   * @param {string[]} trackIds - Array of track IDs
   * @param {string} period - Time period to aggregate
   */
  async getPlayCounts(trackIds, period = '7d') {
    const data = await this.fetch(`/api/plays?trackIds=${trackIds.join(',')}&period=${period}`);
    return data.counts || {};
  },

  // ============================================
  // PROFILES
  // ============================================
  
  /**
   * Get profile by address
   */
  async getProfile(address) {
    const data = await this.fetch(`/api/profile?address=${address}`);
    return data.profile || null;
  },
  
  /**
   * Save profile
   */
  async saveProfile(profile) {
    return this.fetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  // ============================================
  // PLAYLISTS
  // ============================================
  
  /**
   * Get user's playlists
   */
  async getPlaylists(userAddress) {
    const data = await this.fetch(`/api/playlists?user=${userAddress}`);
    return data.playlists || [];
  },
  
  /**
   * Get public playlists
   */
  async getPublicPlaylists(sort = 'newest') {
    const data = await this.fetch(`/api/playlists?public=true&sort=${sort}`);
    return data.playlists || [];
  },
  
  /**
   * Get playlist by ID
   */
  async getPlaylist(playlistId, withTracks = false, checkLiked = null) {
    let url = `/api/playlists?id=${playlistId}`;
    if (withTracks) url += '&withTracks=true';
    if (checkLiked) url += `&checkLiked=${checkLiked}`;
    const data = await this.fetch(url);
    return data;
  },
  
  /**
   * Create playlist
   */
  async createPlaylist(name, ownerAddress) {
    return this.fetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        name,
        ownerAddress,
      }),
    });
  },
  
  /**
   * Update playlist
   */
  async updatePlaylist(playlistId, ownerAddress, updates) {
    return this.fetch('/api/playlists', {
      method: 'PUT',
      body: JSON.stringify({
        playlistId,
        ownerAddress,
        ...updates,
      }),
    });
  },
  
  /**
   * Delete playlist
   */
  async deletePlaylist(playlistId, ownerAddress) {
    return this.fetch(`/api/playlists?id=${playlistId}&owner=${ownerAddress}`, {
      method: 'DELETE',
    });
  },
  
  /**
   * Add track to playlist
   */
  async addTrackToPlaylist(playlistId, ownerAddress, trackId, releaseId) {
    return this.fetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        action: 'addTrack',
        playlistId,
        ownerAddress,
        trackId,
        releaseId,
      }),
    });
  },
  
  /**
   * Remove track from playlist
   */
  async removeTrackFromPlaylist(playlistId, ownerAddress, playlistTrackId) {
    return this.fetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        action: 'removeTrack',
        playlistId,
        ownerAddress,
        playlistTrackId,
      }),
    });
  },
  
  /**
   * Reorder playlist tracks
   */
  async reorderPlaylistTracks(playlistId, ownerAddress, trackIds) {
    return this.fetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        action: 'reorder',
        playlistId,
        ownerAddress,
        trackIds,
      }),
    });
  },
  
  /**
   * Like/Unlike playlist
   */
  async togglePlaylistLike(playlistId, userAddress, isLiked) {
    return this.fetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        action: isLiked ? 'unlike' : 'like',
        playlistId,
        userAddress,
      }),
    });
  },

  // ============================================
  // LIKES
  // ============================================
  
  /**
   * Get liked tracks
   */
  async getLikedTracks(userAddress) {
    const data = await this.fetch(`/api/likes?user=${userAddress}`);
    return data.tracks || [];
  },
  
  /**
   * Get liked track IDs
   */
  async getLikedTrackIds(userAddress) {
    const data = await this.fetch(`/api/likes?user=${userAddress}&ids=true`);
    return data.trackIds || [];
  },
  
  /**
   * Check if track is liked
   */
  async isTrackLiked(userAddress, trackId) {
    const data = await this.fetch(`/api/likes?user=${userAddress}&trackId=${trackId}`);
    return data.isLiked || false;
  },
  
  /**
   * Like a track
   */
  async likeTrack(userAddress, trackId, releaseId) {
    return this.fetch('/api/likes', {
      method: 'POST',
      body: JSON.stringify({
        action: 'like',
        userAddress,
        trackId,
        releaseId,
      }),
    });
  },
  
  /**
   * Unlike a track
   */
  async unlikeTrack(userAddress, trackId) {
    return this.fetch('/api/likes', {
      method: 'POST',
      body: JSON.stringify({
        action: 'unlike',
        userAddress,
        trackId,
      }),
    });
  },

  // ============================================
  // UPLOADS (IPFS via Lighthouse - Direct)
  // ============================================
  
  /**
   * Upload file directly to Lighthouse (bypasses Vercel size limits)
   */
  async uploadFile(file) {
    // Step 1: Get Lighthouse config from our secure endpoint
    const configResponse = await fetch('/api/upload-config');
    if (!configResponse.ok) {
      const error = await configResponse.text();
      throw new Error(error || 'Failed to get upload configuration');
    }
    const config = await configResponse.json();
    
    // Step 2: Upload directly to Lighthouse
    const formData = new FormData();
    formData.append('file', file);
    
    console.log(`📤 Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) directly to Lighthouse...`);
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.key}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lighthouse upload error:', errorText);
      throw new Error(errorText || 'Upload to IPFS failed');
    }
    
    const data = await response.json();
    const cid = data.Hash;
    
    console.log(`✅ Uploaded to IPFS: ${cid}`);
    
    return {
      success: true,
      cid: cid,
      url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      ipfsUrl: `ipfs://${cid}`,
    };
  },
  
  /**
   * Upload JSON to IPFS
   */
  async uploadJSON(jsonData, name) {
    return this.fetch('/api/upload-json', {
      method: 'POST',
      body: JSON.stringify({ data: jsonData, name }),
    });
  },
};

// Helper functions
const Helpers = {
  /**
   * Format duration from seconds
   */
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },
  
  /**
   * Format date relative
   */
  formatRelativeDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  },
  
  /**
   * Truncate address
   */
  truncateAddress(address, start = 6, end = 4) {
    if (!address) return '';
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  },
  
  /**
   * Get IPFS URL - uses proxy first for compatibility
   */
  getIPFSUrl(cid) {
    if (!cid) return '';
    // Clean the CID in case it already has a gateway prefix
    if (cid.includes('/ipfs/')) {
      cid = cid.split('/ipfs/')[1].split('?')[0];
    }
    if (cid.startsWith('ipfs://')) {
      cid = cid.replace('ipfs://', '');
    }
    // Use proxy first (index 0)
    return `${IPFS_GATEWAYS[0]}${cid}`;
  },
  
  /**
   * Get next IPFS gateway URL for fallback
   */
  getNextIPFSUrl(currentUrl) {
    if (!currentUrl) return null;
    
    // Extract CID from URL
    let cid = null;
    if (currentUrl.includes('/ipfs/')) {
      cid = currentUrl.split('/ipfs/')[1].split('?')[0].split('#')[0];
    } else if (currentUrl.startsWith('/api/ipfs/')) {
      cid = currentUrl.replace('/api/ipfs/', '').split('?')[0].split('#')[0];
    }
    
    if (!cid) return null;
    
    // Find current gateway index
    let currentGatewayIndex = -1;
    for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
      if (currentUrl.startsWith(IPFS_GATEWAYS[i]) || 
          (IPFS_GATEWAYS[i] === '/api/ipfs/' && currentUrl.startsWith('/api/ipfs/'))) {
        currentGatewayIndex = i;
        break;
      }
    }
    
    const nextIndex = currentGatewayIndex + 1;
    
    if (nextIndex < IPFS_GATEWAYS.length) {
      return `${IPFS_GATEWAYS[nextIndex]}${cid}`;
    }
    return null; // No more gateways to try
  },
  
  /**
   * Debounce function
   */
  debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  },
  
  /**
   * Shuffle array (Fisher-Yates)
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  
  /**
   * Generate random ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },
  
  /**
   * Format number with K/M suffix for large numbers
   */
  formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toLocaleString();
  },
  
  /**
   * Generate a session ID for play deduplication
   * Stored in sessionStorage so it persists across page loads but not browser sessions
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('xrp_music_session');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('xrp_music_session', sessionId);
    }
    return sessionId;
  },
};

/**
 * Global image error handler for IPFS fallback
 * Automatically tries next gateway when an image fails to load
 */
document.addEventListener('error', function(e) {
  const target = e.target;
  
  // Only handle image errors
  if (target.tagName !== 'IMG') return;
  
  const currentSrc = target.src;
  
  // Only handle IPFS URLs (proxy or gateway)
  if (!currentSrc.includes('/ipfs/') && !currentSrc.includes('/api/ipfs/')) return;
  
  // Prevent infinite loops - track retry count
  const retryCount = parseInt(target.dataset.ipfsRetry || '0', 10);
  if (retryCount >= IPFS_GATEWAYS.length - 1) {
    console.warn('All IPFS gateways failed for image:', currentSrc);
    // Set to placeholder if all gateways fail
    target.src = '/placeholder.png';
    return;
  }
  
  // Try next gateway
  const nextUrl = Helpers.getNextIPFSUrl(currentSrc);
  if (nextUrl) {
    console.log(`🔄 Image gateway fallback (attempt ${retryCount + 1}):`, nextUrl);
    target.dataset.ipfsRetry = (retryCount + 1).toString();
    target.src = nextUrl;
  }
}, true); // Use capture phase to catch errors before they bubble
