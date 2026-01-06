/**
 * XRP Music - API Client
 * Fetch wrappers for all backend endpoints
 */

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
   * Get all releases
   */
  async getReleases() {
    const data = await this.fetch('/api/releases');
    return data.releases || [];
  },
  
  /**
   * Get releases by artist
   */
  async getReleasesByArtist(artistAddress) {
    const data = await this.fetch(`/api/releases?artist=${artistAddress}`);
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
  // UPLOADS (IPFS)
  // ============================================
  
  /**
   * Upload file to IPFS
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    
    return data;
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

/**
 * IPFS Gateway fallback list (shared with player.js)
 */
const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

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
   * Get IPFS URL (uses first gateway, fallback handled by error handler)
   */
  getIPFSUrl(cid) {
    if (!cid) return '';
    // Clean the CID in case it already has a gateway prefix
    if (cid.includes('/ipfs/')) {
      cid = cid.split('/ipfs/')[1].split('?')[0];
    }
    return `${IPFS_GATEWAYS[0]}${cid}`;
  },
  
  /**
   * Get next IPFS gateway URL for fallback
   */
  getNextIPFSUrl(currentUrl) {
    if (!currentUrl || !currentUrl.includes('/ipfs/')) return null;
    
    const cid = currentUrl.split('/ipfs/')[1].split('?')[0];
    const currentGatewayIndex = IPFS_GATEWAYS.findIndex(g => currentUrl.startsWith(g));
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
  
  // Only handle IPFS URLs
  if (!currentSrc.includes('/ipfs/')) return;
  
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
