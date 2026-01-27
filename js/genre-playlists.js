/**
 * XRP Music - Genre Playlists
 * Auto-generated, uneditable playlists based on track genres
 */

const GenrePlaylists = {
  
  // Cache for genre playlist data
  cache: new Map(),
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  
  /**
   * Get tracks for a specific genre
   * @param {string} genreId - The genre ID
   * @param {object} options - limit, offset for pagination
   */
  async getTracksForGenre(genreId, options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    // Check cache
    const cacheKey = `${genreId}-${limit}-${offset}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    try {
      const response = await fetch(`/api/genre-tracks?genre=${genreId}&limit=${limit}&offset=${offset}`);
      const data = await response.json();
      
      if (data.success) {
        // Cache the result
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          data: data.tracks
        });
        return data.tracks;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch genre tracks:', error);
      return [];
    }
  },
  
  /**
   * Get track count for a genre
   */
  async getGenreTrackCount(genreId) {
    try {
      const response = await fetch(`/api/genre-tracks?genre=${genreId}&countOnly=true`);
      const data = await response.json();
      return data.success ? data.count : 0;
    } catch (error) {
      console.error('Failed to get genre count:', error);
      return 0;
    }
  },
  
  /**
   * Get all genres with track counts
   */
  async getAllGenresWithCounts() {
    try {
      const response = await fetch('/api/genre-tracks?allCounts=true');
      const data = await response.json();
      return data.success ? data.genres : [];
    } catch (error) {
      console.error('Failed to get genre counts:', error);
      return [];
    }
  },
  
  /**
   * Play all tracks in a genre as a playlist
   */
  async playGenre(genreId, startIndex = 0) {
    const tracks = await this.getTracksForGenre(genreId, { limit: 100 });
    
    if (tracks.length === 0) {
      Modals.showToast('No tracks in this genre yet');
      return;
    }
    
    // Format tracks for the player
    const queue = tracks.map(track => ({
      id: track.id,
      trackId: track.id?.toString(),
      title: track.title,
      artist: track.artistName || 'Unknown Artist',
      cover: track.coverUrl || '/placeholder.png',
      ipfsHash: track.audioCid,
      releaseId: track.releaseId,
      duration: track.duration,
    }));
    
    Player.playTrack(queue[startIndex], queue, startIndex);
    Modals.showToast(`Playing ${Genres.get(genreId).name} playlist`);
  },
  
  /**
   * Shuffle play a genre
   */
  async shuffleGenre(genreId) {
    const tracks = await this.getTracksForGenre(genreId, { limit: 100 });
    
    if (tracks.length === 0) {
      Modals.showToast('No tracks in this genre yet');
      return;
    }
    
    // Shuffle the tracks
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    
    // Format and play
    const queue = shuffled.map(track => ({
      id: track.id,
      trackId: track.id?.toString(),
      title: track.title,
      artist: track.artistName || 'Unknown Artist',
      cover: track.coverUrl || '/placeholder.png',
      ipfsHash: track.audioCid,
      releaseId: track.releaseId,
      duration: track.duration,
    }));
    
    Player.playTrack(queue[0], queue, 0);
    Player.toggleShuffle(); // Enable shuffle mode
    Modals.showToast(`Shuffling ${Genres.get(genreId).name}`);
  },
  
  /**
   * Clear the cache (call when new tracks are added)
   */
  clearCache() {
    this.cache.clear();
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenrePlaylists;
}
