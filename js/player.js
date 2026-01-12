/**
 * XRP Music - Audio Player
 * Handles playback, queue, progress, volume, and PLAY TRACKING
 * 
 * PLAY TRACKING:
 * - A "play" is recorded after 30 seconds of listening
 * - Uses session ID for deduplication (same track won't count twice in 5 min)
 * - Tracks are sent to /api/plays endpoint
 * 
 * SHUFFLE BEHAVIOR:
 * - Shuffle is ALWAYS ON by default (no toggle)
 * - When a song ends, a random song from the queue plays next
 * - Skip/Next button plays a random song
 * - Repeat overrides shuffle (replays current track)
 * - Playlists will have their own queue logic (future feature)
 */

/**
 * IPFS Gateway fallback list
 */
const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

/**
 * Try to get a working IPFS URL with fallback gateways
 */
async function getWorkingIpfsUrl(cidOrUrl) {
  // Extract CID from full URL if needed
  let cid = cidOrUrl;
  if (cidOrUrl && cidOrUrl.includes('/ipfs/')) {
    cid = cidOrUrl.split('/ipfs/')[1].split('?')[0]; // Remove query params too
  }
  if (!cid) return cidOrUrl;
  
  // Try each gateway with a quick timeout
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = gateway + cid;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        console.log('✅ Working gateway found:', gateway);
        return url;
      }
    } catch (e) {
      console.log('❌ Gateway failed:', gateway);
      continue;
    }
  }
  
  // Fallback to first gateway if all fail
  console.warn('⚠️ All gateways failed, using default');
  return IPFS_GATEWAYS[0] + cid;
}

const Player = {
  audio: null,
  progressInterval: null,
  allTracksCache: [], // Cache of all available tracks for shuffle
  
  // Play tracking state
  playTracking: {
    currentTrackId: null,
    playStartTime: null,
    playRecorded: false,
    playCheckInterval: null,
    PLAY_THRESHOLD_SECONDS: 30, // Record play after 30 seconds
  },
  
  /**
   * Initialize player
   */
  init() {
    this.audio = document.getElementById('audio-player');
    
    if (!this.audio) {
      console.error('Audio element not found');
      return;
    }
    
    // Set initial volume
    this.audio.volume = AppState.player.volume / 100;
    
    // SHUFFLE IS NOW DEFAULT - always on
    if (!AppState.player.isShuffled) {
      updatePlayer({ isShuffled: true });
    }
    
    // Event listeners
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('error', (e) => this.onError(e));
    this.audio.addEventListener('canplay', () => this.onCanPlay());
    this.audio.addEventListener('play', () => this.onPlay());
    this.audio.addEventListener('pause', () => this.onPause());
    
    // Bind controls
    this.bindControls();
    
    // Initialize repeat button state
    this.updateRepeatButton();
  },
  
  /**
   * Bind control buttons
   */
  bindControls() {
    // Desktop controls
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const progressBar = document.getElementById('player-progress');
    
    // Mobile controls (mini player)
    const mobilePlayBtn = document.getElementById('mobile-play-btn');
    const mobilePrevBtn = document.getElementById('mobile-prev-btn');
    const mobileNextBtn = document.getElementById('mobile-next-btn');
    const expandBtn = document.getElementById('player-expand-btn');
    const collapseBtn = document.getElementById('collapse-player-btn');
    
    // Expanded player controls
    const expPlayBtn = document.getElementById('expanded-play-btn');
    const expPrevBtn = document.getElementById('expanded-prev-btn');
    const expNextBtn = document.getElementById('expanded-next-btn');
    const expRepeatBtn = document.getElementById('expanded-repeat-btn');
    const expVolumeSlider = document.getElementById('expanded-volume-slider');
    const expProgressBar = document.getElementById('expanded-progress');
    
    // Play/Pause - all buttons
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
    if (mobilePlayBtn) mobilePlayBtn.addEventListener('click', () => this.togglePlay());
    if (expPlayBtn) expPlayBtn.addEventListener('click', () => this.togglePlay());
    
    // Previous - all buttons
    if (prevBtn) prevBtn.addEventListener('click', () => this.previous());
    if (mobilePrevBtn) mobilePrevBtn.addEventListener('click', () => this.previous());
    if (expPrevBtn) expPrevBtn.addEventListener('click', () => this.previous());
    
    // Next - all buttons
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());
    if (mobileNextBtn) mobileNextBtn.addEventListener('click', () => this.next());
    if (expNextBtn) expNextBtn.addEventListener('click', () => this.next());
    
    // Repeat
    if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat());
    if (expRepeatBtn) expRepeatBtn.addEventListener('click', () => this.toggleRepeat());
    
    // Volume
    if (volumeBtn) volumeBtn.addEventListener('click', () => this.toggleMute());
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    }
    if (expVolumeSlider) {
      expVolumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    }
    
    // Progress seeking
    if (progressBar) {
      progressBar.addEventListener('click', (e) => this.seek(e));
    }
    if (expProgressBar) {
      expProgressBar.addEventListener('click', (e) => this.seekExpanded(e));
    }
    
    // Expand/Collapse mobile player - NOW OPENS RELEASE MODAL
    if (expandBtn) expandBtn.addEventListener('click', () => this.openReleaseModal());
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.collapsePlayer());
    
    // Like buttons - desktop player bar and expanded player
    const likeBtn = document.getElementById('player-like-btn');
    const expLikeBtn = document.getElementById('expanded-like-btn');
    if (likeBtn) likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLike();
    });
    if (expLikeBtn) expLikeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLike();
    });

    // Add to playlist buttons - desktop player bar and expanded player
    const addBtn = document.getElementById('player-add-btn');
    const expAddBtn = document.getElementById('expanded-add-btn');
    if (addBtn) addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showPlaylistPicker();
    });
    if (expAddBtn) expAddBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showPlaylistPicker();
    });
    
    // Click on track info to open release modal (not expanded player)
    const playerTrack = document.getElementById('player-track-info');
    if (playerTrack) {
      playerTrack.addEventListener('click', async (e) => {
        // Don't trigger if clicking on the expand button or controls
        if (e.target.closest('.player-expand-btn') || e.target.closest('button')) return;
        await this.openReleaseModal();
      });
      playerTrack.style.cursor = 'pointer';
    }
  },
  
  // ============================================
  // PLAY TRACKING
  // ============================================
  
  /**
   * Start tracking play time for current track
   */
  startPlayTracking(track) {
    const trackId = track.trackId || track.id;
    
    // Reset tracking state for new track
    this.playTracking.currentTrackId = trackId;
    this.playTracking.playStartTime = Date.now();
    this.playTracking.playRecorded = false;
    
    // Clear any existing interval
    if (this.playTracking.playCheckInterval) {
      clearInterval(this.playTracking.playCheckInterval);
    }
    
    console.log('📊 Play tracking started for:', track.title);
  },
  
  /**
   * Check if we should record a play (called on timeupdate)
   */
  checkAndRecordPlay() {
    // Skip if already recorded or no current track
    if (this.playTracking.playRecorded || !this.playTracking.currentTrackId) {
      return;
    }
    
    // Check if we've been playing for 30+ seconds
    const currentTime = this.audio.currentTime;
    
    if (currentTime >= this.playTracking.PLAY_THRESHOLD_SECONDS) {
      this.recordPlay();
    }
  },
  
  /**
   * Record a play to the API
   */
  async recordPlay() {
    if (this.playTracking.playRecorded) return;
    
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    const trackId = track.trackId || track.id;
    const releaseId = track.releaseId;
    const userAddress = AppState.user?.address || null;
    const sessionId = typeof Helpers !== 'undefined' && Helpers.getSessionId 
      ? Helpers.getSessionId() 
      : null;
    
    // Mark as recorded immediately to prevent duplicate calls
    this.playTracking.playRecorded = true;
    
    console.log('📊 Recording play for:', track.title);
    
    try {
      const result = await API.recordPlay(trackId, releaseId, userAddress, sessionId);
      
      if (result.deduplicated) {
        console.log('📊 Play was deduplicated (already counted recently)');
      } else {
        console.log('✅ Play recorded successfully:', result.playId);
      }
    } catch (error) {
      console.error('❌ Failed to record play:', error);
      // Don't un-set playRecorded - we don't want to spam retries
    }
  },
  
  /**
   * Reset play tracking (when track changes or stops)
   */
  resetPlayTracking() {
    this.playTracking.currentTrackId = null;
    this.playTracking.playStartTime = null;
    this.playTracking.playRecorded = false;
    
    if (this.playTracking.playCheckInterval) {
      clearInterval(this.playTracking.playCheckInterval);
      this.playTracking.playCheckInterval = null;
    }
  },
  
  /**
   * Open release modal for current track
   */
  async openReleaseModal() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    if (track.releaseId) {
      // Find or fetch the release and open release modal
      let release = AppState.releases.find(r => r.id === track.releaseId);
      if (!release) {
        try {
          const data = await API.getRelease(track.releaseId);
          release = data?.release;
        } catch (e) {
          console.error('Failed to fetch release:', e);
        }
      }
      if (release) {
        Modals.showRelease(release);
      } else {
        // Fallback to now playing if no release found
        Modals.showNowPlaying();
      }
    } else {
      // No releaseId, show now playing
      Modals.showNowPlaying();
    }
  },
  
  /**
   * Build queue from all available tracks in AppState
   * ALWAYS SHUFFLED - fresh random order each time site loads
   */
  buildGlobalQueue() {
    const releases = AppState.releases || [];
    const allTracks = [];
    
    releases.forEach(release => {
      (release.tracks || []).forEach((track, idx) => {
        allTracks.push({
          id: parseInt(track.id) || idx,
          trackId: track.id,
          title: release.type === 'single' ? release.title : track.title,
          artist: release.artistName || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(release.artistAddress) : release.artistAddress),
          cover: release.coverUrl,
          ipfsHash: track.audioCid,
          releaseId: release.id,
          duration: track.duration,
        });
      });
    });
    
    // SHUFFLE the tracks so it's different every time!
    const shuffledTracks = typeof Helpers !== 'undefined' && Helpers.shuffle
      ? Helpers.shuffle([...allTracks])
      : this.shuffleArray([...allTracks]);
    
    this.allTracksCache = shuffledTracks;
    console.log('🎲 Global queue built & shuffled:', shuffledTracks.length, 'tracks');
    return shuffledTracks;
  },
  
  /**
   * Get a random track from all available tracks (excluding current)
   */
  getRandomTrack(excludeTrackId = null) {
    // Make sure we have tracks cached
    if (this.allTracksCache.length === 0) {
      this.buildGlobalQueue();
    }
    
    const tracks = this.allTracksCache;
    if (tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];
    
    // Filter out current track if specified
    const available = excludeTrackId 
      ? tracks.filter(t => t.trackId !== excludeTrackId && t.id !== excludeTrackId)
      : tracks;
    
    if (available.length === 0) return tracks[0]; // Fallback to any track
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  },
  
  /**
   * Play a track (NOW ASYNC with gateway fallback)
   * @param {Object} track - Track to play
   * @param {Array} queue - Optional queue (if null, uses global shuffle)
   * @param {Number} queueIndex - Index in queue
   */
  async playTrack(track, queue = null, queueIndex = 0) {
    if (!track) return;
    
    console.log('🎵 Playing track:', track.title);
    
    // Reset play tracking for new track
    this.resetPlayTracking();
    
    // Update state
    setCurrentTrack(track);
    
    // If queue provided, set it up
    if (queue && queue.length > 0) {
      // Shuffle the queue, keeping current track at position 0
      const currentTrack = queue[queueIndex];
      const otherTracks = queue.filter((_, i) => i !== queueIndex);
      const shuffledOthers = typeof Helpers !== 'undefined' && Helpers.shuffle 
        ? Helpers.shuffle([...otherTracks])
        : this.shuffleArray([...otherTracks]);
      const shuffledQueue = [currentTrack, ...shuffledOthers];
      setQueue(shuffledQueue, 0);
      
      // Also update our cache with these tracks
      this.allTracksCache = shuffledQueue;
    } else {
      // No queue provided - build global queue if needed
      if (this.allTracksCache.length === 0) {
        this.buildGlobalQueue();
      }
      // Set queue to all tracks with current at front
      const otherTracks = this.allTracksCache.filter(t => t.trackId !== track.trackId && t.id !== track.id);
      const shuffledOthers = typeof Helpers !== 'undefined' && Helpers.shuffle
        ? Helpers.shuffle([...otherTracks])
        : this.shuffleArray([...otherTracks]);
      setQueue([track, ...shuffledOthers], 0);
    }
    
    // Get audio source - try Helpers.getIPFSUrl if it exists, otherwise build URL
    let src = track.audioUrl;
    if (!src && track.ipfsHash) {
      if (typeof Helpers !== 'undefined' && Helpers.getIPFSUrl) {
        src = Helpers.getIPFSUrl(track.ipfsHash);
      } else {
        src = IPFS_GATEWAYS[0] + track.ipfsHash;
      }
    }
    
    if (!src) {
      console.error('No audio source for track:', track);
      return;
    }
    
    // Try fallback gateways if it's an IPFS URL
    if (src.includes('/ipfs/') || track.ipfsHash) {
      console.log('🔄 Checking IPFS gateways for audio...');
      src = await getWorkingIpfsUrl(src);
    }
    
    // Set source and play
    this.audio.src = src;
    this.audio.load();
    
    // Update UI
    this.updateTrackInfo(track);
    this.showPlayerBar();
    
    // Start play tracking
    this.startPlayTracking(track);
  },
  
  /**
   * Simple array shuffle (Fisher-Yates) as fallback
   */
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  
  /**
   * Play/Pause toggle
   */
  togglePlay() {
    if (!AppState.player.currentTrack) return;
    
    if (AppState.player.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  },
  
  /**
   * Play
   */
  play() {
    this.audio.play().then(() => {
      updatePlayer({ isPlaying: true });
      this.updatePlayButton(true);
    }).catch(err => {
      console.error('Playback error:', err);
    });
  },
  
  /**
   * Pause
   */
  pause() {
    this.audio.pause();
    updatePlayer({ isPlaying: false });
    this.updatePlayButton(false);
  },
  
  /**
   * Play next track - ALWAYS RANDOM from global library
   * (unless in a playlist - future feature)
   */
  next() {
    const { queue, queueIndex } = AppState.player;
    const currentTrack = AppState.player.currentTrack;
    
    console.log('⏭️ Next track requested. Queue length:', queue.length);
    
    // If we have a queue with more than just current track
    if (queue.length > 1) {
      // Pick a random track from queue that's not current
      let nextIndex;
      let attempts = 0;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
        attempts++;
      } while (nextIndex === queueIndex && attempts < 10);
      
      const nextTrack = queue[nextIndex];
      console.log('🎵 Playing random from queue:', nextTrack?.title);
      updatePlayer({ queueIndex: nextIndex });
      this.playTrack(nextTrack);
    } else {
      // No queue or single item - get random from all tracks
      const currentId = currentTrack?.trackId || currentTrack?.id;
      const randomTrack = this.getRandomTrack(currentId);
      
      if (randomTrack) {
        console.log('🎵 Playing random from library:', randomTrack.title);
        this.playTrack(randomTrack);
      } else {
        console.log('⚠️ No tracks available to play');
      }
    }
  },
  
  /**
   * Play previous track
   * - If > 3 seconds into song, restart it
   * - Otherwise go to previous in history (or random)
   */
  previous() {
    const { queue, queueIndex } = AppState.player;
    
    // If more than 3 seconds in, restart current track
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    // If we have a queue, go to previous index
    if (queue.length > 1) {
      const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
      const prevTrack = queue[prevIndex];
      updatePlayer({ queueIndex: prevIndex });
      this.playTrack(prevTrack);
    } else {
      // No queue history - just restart current
      this.audio.currentTime = 0;
    }
  },
  
  /**
   * Toggle repeat - blue when ON, default when OFF
   */
  toggleRepeat() {
    const isRepeat = !AppState.player.isRepeat;
    updatePlayer({ isRepeat });
    this.updateRepeatButton();
  },
  
  /**
   * Update repeat button styling
   */
  updateRepeatButton() {
    const isRepeat = AppState.player.isRepeat;
    const repeatBtn = document.getElementById('repeat-btn');
    const expRepeatBtn = document.getElementById('expanded-repeat-btn');
    
    // Toggle active class for blue highlight
    if (repeatBtn) {
      repeatBtn.classList.toggle('active', isRepeat);
      repeatBtn.style.color = isRepeat ? 'var(--accent)' : '';
    }
    if (expRepeatBtn) {
      expRepeatBtn.classList.toggle('active', isRepeat);
      expRepeatBtn.style.color = isRepeat ? 'var(--accent)' : '';
    }
  },
  
  /**
   * Set volume
   */
  setVolume(value) {
    const volume = parseInt(value, 10);
    saveVolume(volume);
    
    this.audio.volume = volume / 100;
    updatePlayer({ isMuted: volume === 0 });
    
    // Sync sliders
    const volumeSlider = document.getElementById('volume-slider');
    const expVolumeSlider = document.getElementById('expanded-volume-slider');
    
    if (volumeSlider) volumeSlider.value = volume;
    if (expVolumeSlider) expVolumeSlider.value = volume;
    
    this.updateVolumeIcon();
  },
  
  /**
   * Toggle mute
   */
  toggleMute() {
    const isMuted = !AppState.player.isMuted;
    updatePlayer({ isMuted });
    
    this.audio.volume = isMuted ? 0 : AppState.player.volume / 100;
    
    // Update slider
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.value = isMuted ? 0 : AppState.player.volume;
    }
    
    this.updateVolumeIcon();
  },
  
  /**
   * Seek in track
   */
  seek(e) {
    if (!this.audio.duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.audio.currentTime = percent * this.audio.duration;
  },
  
  /**
   * Seek in expanded player
   */
  seekExpanded(e) {
    if (!this.audio.duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.audio.currentTime = percent * this.audio.duration;
  },
  
/**
   * Toggle like for current track
   * Uses the toggleTrackLike from state.js for optimistic updates
   */
  async toggleLike() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    // Check if user is logged in
    if (!AppState.user?.address) {
      if (typeof Modals !== 'undefined' && Modals.showAuth) {
        Modals.showAuth();
      }
      return;
    }
    
    const trackId = track.trackId || track.id?.toString();
    const releaseId = track.releaseId;
    
    // Use the state.js toggleTrackLike which handles optimistic updates
    if (typeof toggleTrackLike === 'function') {
      await toggleTrackLike(trackId, releaseId);
    } else {
      // Fallback to manual toggle if state function not available
      const isLiked = isTrackLiked(trackId);
      
      try {
        if (isLiked) {
          await API.unlikeTrack(AppState.user.address, trackId);
          removeLikedTrack(trackId);
        } else {
          await API.likeTrack(AppState.user.address, trackId, releaseId);
          addLikedTrack(trackId);
        }
        
        this.updateLikeButton();
      } catch (error) {
        console.error('Failed to toggle like:', error);
      }
    }
  },
  
  /**
   * Show playlist picker for current track
   */
  showPlaylistPicker() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    if (!AppState.user?.address) {
      if (typeof Modals !== 'undefined' && Modals.showAuth) {
        Modals.showAuth();
      }
      return;
    }
    
    if (typeof PlaylistPicker !== 'undefined') {
      PlaylistPicker.show({
        trackId: track.trackId || track.id,
        releaseId: track.releaseId,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
      });
    }
  },
  
  /**
   * Expand mobile player (legacy - now opens release modal)
   */
  expandPlayer() {
    this.openReleaseModal();
  },
  
  /**
   * Collapse mobile player
   */
  collapsePlayer() {
    const expandedPlayer = document.getElementById('expanded-player');
    if (expandedPlayer) {
      expandedPlayer.classList.add('hidden');
      document.body.style.overflow = '';
      AppState.expandedPlayer = false;
    }
  },
  
  // ============================================
  // Event Handlers
  // ============================================
  
  onCanPlay() {
    if (AppState.player.currentTrack) {
      this.play();
    }
  },
  
  onPlay() {
    // Track started playing - tracking is already started in playTrack()
    console.log('▶️ Playback started');
  },
  
  onPause() {
    // Track paused - we don't reset tracking, just pause the counter
    console.log('⏸️ Playback paused');
  },
  
  onEnded() {
    console.log('🎵 Track ended. Repeat:', AppState.player.isRepeat);
    
    if (AppState.player.isRepeat) {
      // Repeat is ON - replay current track
      this.audio.currentTime = 0;
      this.play();
    } else {
      // Repeat is OFF - play random next track
      this.next();
    }
  },
  
  onTimeUpdate() {
    if (!this.audio.duration) return;
    
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    updatePlayer({ progress });
    
    // Update progress bars
    const progressFill = document.getElementById('player-progress-fill');
    const expProgressFill = document.getElementById('expanded-progress-fill');
    
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (expProgressFill) expProgressFill.style.width = `${progress}%`;
    
    // Update times in expanded player
    const currentTimeEl = document.getElementById('expanded-current-time');
    const durationEl = document.getElementById('expanded-duration');
    
    if (currentTimeEl && typeof Helpers !== 'undefined') {
      currentTimeEl.textContent = Helpers.formatDuration(this.audio.currentTime);
    }
    if (durationEl && typeof Helpers !== 'undefined') {
      durationEl.textContent = Helpers.formatDuration(this.audio.duration);
    }
    
    // Check if we should record a play (after 30 seconds)
    this.checkAndRecordPlay();
  },
  
  onLoadedMetadata() {
    updatePlayer({ duration: this.audio.duration });
  },
  
  onError(e) {
    console.error('Audio error:', e);
    updatePlayer({ isPlaying: false });
    this.updatePlayButton(false);
  },
  
  // ============================================
  // UI Updates
  // ============================================
  
  showPlayerBar() {
    const playerBar = document.getElementById('player-bar');
    if (playerBar) {
      playerBar.classList.remove('hidden');
    }
  },
  
  updateTrackInfo(track) {
    // Mini player
    const cover = document.getElementById('player-cover');
    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    
    // Defensive: handle missing/broken cover images
    const coverUrl = track.cover || track.coverUrl || '/placeholder.png';
    
    if (cover) {
      cover.onerror = () => {
        cover.src = '/placeholder.png';
        console.warn('⚠️ Cover image failed to load:', coverUrl);
      };
      cover.src = coverUrl;
    }
    if (title) title.textContent = track.title || 'Unknown Track';
    if (artist) artist.textContent = track.artist || 'Unknown Artist';
    
    // Expanded player
    const expCover = document.getElementById('expanded-cover');
    const expTitle = document.getElementById('expanded-title');
    const expArtist = document.getElementById('expanded-artist');
    
    if (expCover) {
      expCover.onerror = () => {
        expCover.src = '/placeholder.png';
      };
      expCover.src = coverUrl;
    }
    if (expTitle) expTitle.textContent = track.title || 'Unknown Track';
    if (expArtist) expArtist.textContent = track.artist || 'Unknown Artist';
    
    // Update like button state
    this.updateLikeButton();
    
    // Sync like button if syncPlayerLikeButton exists in state.js
    if (typeof syncPlayerLikeButton === 'function') {
      syncPlayerLikeButton();
    }
    
    // Update document title
    document.title = `${track.title || 'Unknown'} - ${track.artist || 'Unknown'} | XRP Music`;
  },
  
  updatePlayButton(isPlaying) {
    // Desktop
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);
    
    // Mobile mini
    const mobilePlayIcon = document.getElementById('mobile-play-icon');
    const mobilePauseIcon = document.getElementById('mobile-pause-icon');
    
    if (mobilePlayIcon) mobilePlayIcon.classList.toggle('hidden', isPlaying);
    if (mobilePauseIcon) mobilePauseIcon.classList.toggle('hidden', !isPlaying);
    
    // Expanded
    const expPlayIcon = document.getElementById('expanded-play-icon');
    const expPauseIcon = document.getElementById('expanded-pause-icon');
    
    if (expPlayIcon) expPlayIcon.classList.toggle('hidden', isPlaying);
    if (expPauseIcon) expPauseIcon.classList.toggle('hidden', !isPlaying);
  },
  
  updateVolumeIcon() {
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');
    
    const isMuted = AppState.player.isMuted || AppState.player.volume === 0;
    
    if (volumeIcon) volumeIcon.classList.toggle('hidden', isMuted);
    if (volumeMuteIcon) volumeMuteIcon.classList.toggle('hidden', !isMuted);
  },
  
  updateLikeButton() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    const trackId = track.trackId || track.id?.toString();
    const isLiked = typeof isTrackLiked === 'function' ? isTrackLiked(trackId) : false;
    
    // Desktop player like button
    const likeBtn = document.getElementById('player-like-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked);
      likeBtn.setAttribute('title', isLiked ? 'Unlike' : 'Like');
      const svg = likeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    // Expanded player like button
    const expLikeBtn = document.getElementById('expanded-like-btn');
    if (expLikeBtn) {
      expLikeBtn.classList.toggle('liked', isLiked);
      const svg = expLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
  },
  
  updateExpandedPlayer() {
    // Sync all UI elements with current state
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    this.updateTrackInfo(track);
    this.updatePlayButton(AppState.player.isPlaying);
    this.updateVolumeIcon();
    this.updateLikeButton();
    this.updateRepeatButton();
    
    // Sync volume slider
    const expVolumeSlider = document.getElementById('expanded-volume-slider');
    if (expVolumeSlider) {
      expVolumeSlider.value = AppState.player.isMuted ? 0 : AppState.player.volume;
    }
  },
  
  /**
   * Refresh the all tracks cache (call when releases are loaded)
   */
  refreshTrackCache() {
    this.buildGlobalQueue();
    console.log('🔄 Track cache refreshed:', this.allTracksCache.length, 'tracks');
  },
};
