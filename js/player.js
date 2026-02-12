/**
 * XRP Music - Audio Player
 * Handles playback, queue, progress, volume, and PLAY TRACKING
 * 
 * PLAY TRACKING:
 * - A "play" is recorded after 30 seconds of listening
 * - Uses session ID for deduplication (same track won't count twice in 5 min)
 * - Tracks are sent to /api/plays endpoint
 * 
 * QUEUE SYSTEM (via QueueManager):
 * - User Queue: Manually added tracks (Play Next / Add to Queue) — highest priority
 * - Context Queue: Sequential album/playlist tracks — plays in order
 * - Auto Queue: Random tracks from library — infinite, lazy-loaded
 * - When a song ends, next() checks: User Queue → Context Queue → Auto Queue
 * 
 * SHUFFLE BEHAVIOR:
 * - Shuffle is ALWAYS ON by default for auto queue (no toggle)
 * - Albums/playlists play in sequential order via context queue
 * - Repeat overrides everything (replays current track)
 * 
 * IPFS PROXY:
 * - All IPFS content (audio + images) routes through /api/ipfs/[cid]
 * - This bypasses security software that blocks IPFS gateways directly
 * 
 * SEEK BAR:
 * - Click anywhere on progress bar to seek
 * - Drag the progress ball to scrub through track
 * 
 * EXPANDED NOW PLAYING:
 * - Up arrow on mobile opens Spotify-style full-screen Now Playing view
 * - Shows album art, controls, buy button, share button
 * - Dispatches 'player:trackchange' event for external listeners
 * 
 * MUSIC VIDEO SUPPORT:
 * - Tracks can have optional videoUrl/videoCid for music videos
 * - Desktop drawer shows video synced to audio playback
 * - Video is purely visual — audio element remains the playback engine
 */

/**
 * Get proxied IPFS URL
 * Routes through our API to bypass IPFS blocks (Whalebone, etc.)
 */
function getProxiedIpfsUrl(cidOrUrl) {
  if (!cidOrUrl) return null;
  
  let cid = cidOrUrl;
  
  // Extract CID from full URL if needed
  if (cidOrUrl.includes('/ipfs/')) {
    cid = cidOrUrl.split('/ipfs/')[1].split('?')[0];
  }
  
  // Already a proxy URL
  if (cidOrUrl.startsWith('/api/ipfs/')) {
    return cidOrUrl;
  }
  
  return '/api/ipfs/' + cid;
}

const Player = {
  audio: null,
  progressInterval: null,
  allTracksCache: [], // Cache of all available tracks for shuffle
  
  // Seek/drag state
  seeking: {
    isDragging: false,
    activeBar: null, // 'desktop' or 'expanded'
  },
  
  // Play tracking state
  playTracking: {
    currentTrackId: null,
    playStartTime: null,
    playRecorded: false,
    playCheckInterval: null,
    PLAY_THRESHOLD_SECONDS: 30, // Record play after 30 seconds
  },

  // Desktop video viewer state
  _videoViewerMode: null, // null | 'fullscreen' | 'mini'
  _videoSyncInterval: null,
  _videoTrackHandler: null,
  
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
    
    // Progress seeking - CLICK AND DRAG support
    this.bindSeekBar(progressBar, 'desktop');
    this.bindSeekBar(expProgressBar, 'expanded');
    
    // Expand button - OPENS SPOTIFY-STYLE NOW PLAYING VIEW
    if (expandBtn) expandBtn.addEventListener('click', () => this.openExpandedNowPlaying());
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
    
    // Click on track info to open release modal
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
  
  /**
   * Bind seek bar for click and drag
   */
  bindSeekBar(progressBar, barType) {
    if (!progressBar) return;
    
    const self = this;
    
    // Store reference to the bar for calculations
    self.seeking[barType + 'Bar'] = progressBar;
    
    // Handle click/mousedown on the progress bar AND its children (fill, knob)
    const handleSeekStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      self.seeking.isDragging = true;
      self.seeking.activeBar = barType;
      
      // Always use the container for position calculation, not the child element
      self.seekToPosition(e, progressBar);
      
      // Add window listeners for drag
      window.addEventListener('mousemove', self.onSeekDrag);
      window.addEventListener('mouseup', self.onSeekEnd);
    };
    
    const handleTouchStart = (e) => {
      e.stopPropagation();
      
      self.seeking.isDragging = true;
      self.seeking.activeBar = barType;
      
      const touch = e.touches[0];
      self.seekToPosition(touch, progressBar);
      
      window.addEventListener('touchmove', self.onSeekTouchDrag, { passive: false });
      window.addEventListener('touchend', self.onSeekTouchEnd);
    };
    
    // Bind to progress bar container
    progressBar.addEventListener('mousedown', handleSeekStart);
    progressBar.addEventListener('touchstart', handleTouchStart);
    
    // Make progress bar look interactive
    progressBar.style.cursor = 'pointer';
    
    // Also make child elements clickable (fill, knob)
    const children = progressBar.querySelectorAll('*');
    children.forEach(child => {
      child.style.pointerEvents = 'none'; // Let clicks pass through to parent
    });
  },
  
  /**
   * Seek to position based on click/touch event
   */
  seekToPosition(e, progressBar) {
    if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
    
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    
    let percent = (clientX - rect.left) / rect.width;
    
    // Clamp between 0 and 1
    percent = Math.max(0, Math.min(1, percent));
    
    // Calculate new time
    const newTime = percent * this.audio.duration;
    
    // Set the audio time
    this.audio.currentTime = newTime;
    
    // Update UI immediately for responsive feel
    this.updateProgressUI(percent * 100);
    
    console.log('🎯 Seek to:', Math.round(percent * 100) + '%', 'Time:', newTime.toFixed(1) + 's');
  },
  
  /**
   * Handle mouse drag for seeking
   */
  onSeekDrag: function(e) {
    if (!Player.seeking.isDragging) return;
    
    e.preventDefault();
    
    const barType = Player.seeking.activeBar;
    const progressBar = barType === 'expanded' 
      ? document.getElementById('expanded-progress')
      : document.getElementById('player-progress');
    
    if (progressBar && Player.audio && Player.audio.duration) {
      const rect = progressBar.getBoundingClientRect();
      let percent = (e.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));
      
      Player.audio.currentTime = percent * Player.audio.duration;
      Player.updateProgressUI(percent * 100);
    }
  },
  
  /**
   * Handle mouse up - end drag
   */
  onSeekEnd: function(e) {
    if (Player.seeking.isDragging) {
      // Final seek position
      const barType = Player.seeking.activeBar;
      const progressBar = barType === 'expanded' 
        ? document.getElementById('expanded-progress')
        : document.getElementById('player-progress');
      
      if (progressBar && Player.audio && Player.audio.duration && e.clientX) {
        const rect = progressBar.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        Player.audio.currentTime = percent * Player.audio.duration;
      }
    }
    
    Player.seeking.isDragging = false;
    Player.seeking.activeBar = null;
    window.removeEventListener('mousemove', Player.onSeekDrag);
    window.removeEventListener('mouseup', Player.onSeekEnd);
  },
  
  /**
   * Handle touch drag for seeking
   */
  onSeekTouchDrag: function(e) {
    if (!Player.seeking.isDragging) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const barType = Player.seeking.activeBar;
    const progressBar = barType === 'expanded' 
      ? document.getElementById('expanded-progress')
      : document.getElementById('player-progress');
    
    if (progressBar && Player.audio && Player.audio.duration) {
      const rect = progressBar.getBoundingClientRect();
      let percent = (touch.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));
      
      Player.audio.currentTime = percent * Player.audio.duration;
      Player.updateProgressUI(percent * 100);
    }
  },
  
  /**
   * Handle touch end - end drag
   */
  onSeekTouchEnd: function() {
    Player.seeking.isDragging = false;
    Player.seeking.activeBar = null;
    window.removeEventListener('touchmove', Player.onSeekTouchDrag);
    window.removeEventListener('touchend', Player.onSeekTouchEnd);
  },
  
  /**
   * Update progress bar UI directly (for responsive dragging)
   */
  updateProgressUI(percent) {
    const progressFill = document.getElementById('player-progress-fill');
    const expProgressFill = document.getElementById('expanded-progress-fill');
    const expProgressKnob = document.getElementById('expanded-progress-knob');
    
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (expProgressFill) expProgressFill.style.width = `${percent}%`;
    if (expProgressKnob) expProgressKnob.style.left = `${percent}%`;
    
    // Update time displays
    if (this.audio && this.audio.duration && !isNaN(this.audio.duration)) {
      const currentTime = (percent / 100) * this.audio.duration;
      const currentTimeEl = document.getElementById('expanded-current-time');
      if (currentTimeEl && typeof Helpers !== 'undefined') {
        currentTimeEl.textContent = Helpers.formatDuration(currentTime);
      }
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

    if (track.isExternal) return;
    
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
   * Open the Spotify-style expanded Now Playing view
   * Called when user taps the up arrow on mobile player
   */
  openExpandedNowPlaying() {
    if (typeof Modals !== 'undefined' && Modals.showExpandedNowPlaying) {
      Modals.showExpandedNowPlaying();
    } else {
      // Fallback to release modal if method not available yet
      this.openReleaseModal();
    }
  },
  
  /**
   * Open release modal for current track
   * Used when clicking track info area on desktop
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
   * Now includes videoUrl/videoCid for music video support
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
          cover: getProxiedIpfsUrl(release.coverUrl),
          ipfsHash: track.audioCid,
          releaseId: release.id,
          duration: track.duration,
          price: track.price || release.price,
          artistAddress: release.artistAddress,
          videoUrl: track.videoUrl || null,
          videoCid: track.videoCid || null,
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
   * Play a track
   * @param {Object} track - Track to play
   * @param {Array} queue - Optional queue (if null, uses global shuffle) — LEGACY, prefer QueueManager
   * @param {Number} queueIndex - Index in queue
   */
  async playTrack(track, queue = null, queueIndex = 0) {
    if (!track) return;
    
    console.log('🎵 Playing track:', track.title);
    
    // Reset play tracking for new track
    this.resetPlayTracking();
    
    // Update state
    setCurrentTrack(track);
    
    // If queue provided (legacy calls), set it up
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
    
    // Get audio source - USE PROXY for all IPFS content
    let src = track.audioUrl;
    if (!src && track.ipfsHash) {
      src = getProxiedIpfsUrl(track.ipfsHash);
    }
    
    if (!src) {
      console.error('No audio source for track:', track);
      return;
    }
    
    console.log('🔊 Audio source:', src);
    
    // Set source and play
    this.audio.src = src;
    this.audio.load();
    
    // Update UI
    this.updateTrackInfo(track);
    this.showPlayerBar();
    
    // Start play tracking
    this.startPlayTracking(track);
    
    // Dispatch track change event for external listeners (e.g., Now Playing view, desktop drawer)
    document.dispatchEvent(new CustomEvent('player:trackchange', { detail: { track } }));
    
    // Notify QueueManager to update sidebar
    if (typeof QueueManager !== 'undefined') {
      QueueManager.renderSidebar();
    }
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
   * Play next track — uses QueueManager priority system
   * Priority: User Queue → Context Queue (album/playlist in order) → Auto Queue → Random
   */
  next() {
    const currentTrack = AppState.player.currentTrack;
    console.log('⏭️ Next track requested');
    
    // Push current track to QueueManager history
    if (currentTrack && typeof QueueManager !== 'undefined') {
      QueueManager.history.unshift(currentTrack);
      if (QueueManager.history.length > QueueManager.MAX_HISTORY) {
        QueueManager.history = QueueManager.history.slice(0, QueueManager.MAX_HISTORY);
      }
    }
    
    // Use QueueManager if available
    if (typeof QueueManager !== 'undefined') {
      const nextTrack = QueueManager.getNext();
      if (nextTrack) {
        this.playTrack(nextTrack);
        return;
      }
    }
    
    // Fallback to old behavior if QueueManager not loaded
    const { queue, queueIndex } = AppState.player;
    
    if (queue.length > 1) {
      // Pick a random track from queue that's not current
      let nextIndex;
      let attempts = 0;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
        attempts++;
      } while (nextIndex === queueIndex && attempts < 10);
      
      const nextTrack = queue[nextIndex];
      console.log('🎵 Playing random from queue (fallback):', nextTrack?.title);
      updatePlayer({ queueIndex: nextIndex });
      this.playTrack(nextTrack);
    } else {
      // No queue or single item - get random from all tracks
      const currentId = currentTrack?.trackId || currentTrack?.id;
      const randomTrack = this.getRandomTrack(currentId);
      
      if (randomTrack) {
        console.log('🎵 Playing random from library (fallback):', randomTrack.title);
        this.playTrack(randomTrack);
      } else {
        console.log('⚠️ No tracks available to play');
      }
    }
  },
  
  /**
   * Play previous track
   * - If > 3 seconds into song, restart it
   * - Otherwise, check QueueManager history, then fallback
   */
  previous() {
    // If more than 3 seconds in, restart current track
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    // Check QueueManager history first
    if (typeof QueueManager !== 'undefined') {
      const prevTrack = QueueManager.getPrevious();
      if (prevTrack) {
        this.playTrack(prevTrack);
        return;
      }
    }
    
    // Fallback to old behavior
    const { queue, queueIndex } = AppState.player;
    
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
   * Legacy seek method (kept for compatibility)
   */
  seek(e) {
    const progressBar = document.getElementById('player-progress');
    if (progressBar) {
      this.seekToPosition(e, progressBar);
    }
  },
  
  /**
   * Legacy seek expanded method (kept for compatibility)
   */
  seekExpanded(e) {
    const progressBar = document.getElementById('expanded-progress');
    if (progressBar) {
      this.seekToPosition(e, progressBar);
    }
  },
  
  /**
   * Toggle like for current track
   * Updates ALL like buttons (player bar, expanded player, Now Playing modal)
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
    const isCurrentlyLiked = typeof isTrackLiked === 'function' ? isTrackLiked(trackId) : false;
    
    try {
      if (isCurrentlyLiked) {
        await API.unlikeTrack(AppState.user.address, trackId);
        if (typeof removeLikedTrack === 'function') removeLikedTrack(trackId);
      } else {
        await API.likeTrack(AppState.user.address, trackId, releaseId);
        if (typeof addLikedTrack === 'function') addLikedTrack(trackId);
      }
      
      // Update ALL like buttons everywhere
      this.syncAllLikeButtons();
      
      // Show toast
      if (typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast(isCurrentlyLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
      }
      
      return !isCurrentlyLiked; // Return new liked state
    } catch (error) {
      console.error('Failed to toggle like:', error);
      if (typeof Modals !== 'undefined' && Modals.showToast) {
        Modals.showToast('Failed to update liked songs');
      }
      throw error;
    }
  },
  
  /**
   * Sync ALL like buttons across the app
   * Called after any like/unlike action
   */
  syncAllLikeButtons() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    const trackId = track.trackId || track.id?.toString();
    const isLiked = typeof isTrackLiked === 'function' ? isTrackLiked(trackId) : false;
    
    // 1. Player bar like button
    const playerLikeBtn = document.getElementById('player-like-btn');
    if (playerLikeBtn) {
      playerLikeBtn.classList.toggle('liked', isLiked);
      playerLikeBtn.setAttribute('title', isLiked ? 'Unlike' : 'Like');
      const svg = playerLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    // 2. Expanded player like button
    const expLikeBtn = document.getElementById('expanded-like-btn');
    if (expLikeBtn) {
      expLikeBtn.classList.toggle('liked', isLiked);
      const svg = expLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    // 3. Now Playing modal like button
    const npLikeBtn = document.getElementById('np-like-btn');
    if (npLikeBtn) {
      npLikeBtn.classList.toggle('liked', isLiked);
      const svg = npLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    // 4. Release modal like button (for first track)
    const releaseLikeBtn = document.getElementById('like-release-btn');
    if (releaseLikeBtn) {
      releaseLikeBtn.classList.toggle('liked', isLiked);
      const svg = releaseLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    // 5. Desktop drawer like button
    const dnpLikeBtn = document.getElementById('dnp-like');
    if (dnpLikeBtn) {
      dnpLikeBtn.classList.toggle('liked', isLiked);
      const svg = dnpLikeBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    }
    
    console.log('❤️ Synced all like buttons. Liked:', isLiked);
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
   * Expand mobile player (legacy - now opens Now Playing view)
   */
  expandPlayer() {
    this.openExpandedNowPlaying();
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
  // DESKTOP VIDEO VIEWER (3 modes: fullscreen / mini / hidden)
  // ============================================

  /**
   * Toggle desktop video viewer
   * First click → fullscreen, if already open → close
   */
  toggleDesktopDrawer() {
    if (this._videoViewerMode) {
      this.closeDesktopDrawer();
    } else {
      this.openDesktopDrawer();
    }
  },

  /**
   * Open desktop video viewer in fullscreen mode (default)
   */
  openDesktopDrawer() {
    const track = AppState.player.currentTrack;
    if (!track) return;

    // Remove any existing viewer
    document.getElementById('desktop-np-drawer')?.remove();
    this._cleanupVideoSync();

    const hasVideo = !!(track.videoUrl || track.videoCid);
    const coverUrl = track.cover || '/placeholder.png';
    const videoSrc = this._getVideoSrc(track);

    this._videoViewerMode = 'fullscreen';
    this._createFullscreenViewer(track, hasVideo, videoSrc, coverUrl);
    this._startVideoSync();
    this._videoTrackHandler = () => this._onTrackChangeViewer();
    document.addEventListener('player:trackchange', this._videoTrackHandler);
  },

  /**
   * Get video source URL for a track
   */
  _getVideoSrc(track) {
    if (track.videoUrl) {
      return typeof IpfsHelper !== 'undefined' ? IpfsHelper.toProxyUrl(track.videoUrl) : track.videoUrl;
    }
    if (track.videoCid) {
      return '/api/ipfs/' + track.videoCid;
    }
    return '';
  },

  /**
   * Create fullscreen video viewer
   * Takes over main content area with video + transport controls
   */
  _createFullscreenViewer(track, hasVideo, videoSrc, coverUrl) {
    const viewer = document.createElement('div');
    viewer.id = 'desktop-np-drawer';
    viewer.className = 'video-viewer-fullscreen';
    
    const isPlaying = AppState.player.isPlaying;
    const progress = AppState.player.progress || 0;
    const currentTime = this.audio?.currentTime || 0;
    const duration = this.audio?.duration || 0;
    const formatTime = typeof Helpers !== 'undefined' ? Helpers.formatDuration : (t) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    viewer.innerHTML = `
      <div class="vvf-backdrop" id="vvf-backdrop"></div>
      <div class="vvf-container">
        <!-- Top bar -->
        <div class="vvf-topbar">
          <div class="vvf-track-info">
            <div class="vvf-title">${track.title || 'Unknown'}</div>
            <div class="vvf-artist">${track.artist || 'Unknown'}</div>
          </div>
          <div class="vvf-topbar-actions">
            <button class="vvf-btn" id="vvf-minimize" title="Mini player">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
            <button class="vvf-btn" id="vvf-close" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Visual area -->
        <div class="vvf-visual">
          ${hasVideo ? `
            <video class="vvf-video" id="vvf-video" src="${videoSrc}" 
              playsinline muted loop poster="${coverUrl}"></video>
          ` : `
            <img class="vvf-cover" src="${coverUrl}" alt="Cover">
          `}
        </div>

        <!-- Transport controls -->
        <div class="vvf-transport">
          <div class="vvf-progress-row">
            <span class="vvf-time" id="vvf-current">${formatTime(currentTime)}</span>
            <div class="vvf-progress" id="vvf-progress">
              <div class="vvf-progress-fill" id="vvf-progress-fill" style="width: ${progress}%"></div>
              <div class="vvf-progress-knob" id="vvf-progress-knob" style="left: ${progress}%"></div>
            </div>
            <span class="vvf-time" id="vvf-duration">${formatTime(duration)}</span>
          </div>
          <div class="vvf-controls">
            <button class="vvf-ctrl" id="vvf-prev" title="Previous">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5"></line>
              </svg>
            </button>
            <button class="vvf-play" id="vvf-play" title="Play/Pause">
              ${isPlaying 
                ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
                : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
              }
            </button>
            <button class="vvf-ctrl" id="vvf-next" title="Next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style>
        .video-viewer-fullscreen {
          position: fixed; inset: 0; z-index: 900;
          display: flex; flex-direction: column;
        }
        .vvf-backdrop {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.95);
        }
        .vvf-container {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          width: 100%; height: 100%;
          padding-bottom: 80px; /* space for player bar */
        }

        /* Top bar */
        .vvf-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 24px;
          background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
        }
        .vvf-track-info { flex: 1; min-width: 0; }
        .vvf-title {
          font-size: 18px; font-weight: 700; color: white;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .vvf-artist {
          font-size: 14px; color: rgba(255,255,255,0.6);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .vvf-topbar-actions { display: flex; gap: 8px; margin-left: 16px; }
        .vvf-btn {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,0.1); border: none;
          color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 150ms;
        }
        .vvf-btn:hover { background: rgba(255,255,255,0.2); }

        /* Visual */
        .vvf-visual {
          flex: 1; display: flex; align-items: center; justify-content: center;
          overflow: hidden; min-height: 0;
        }
        .vvf-video {
          max-width: 100%; max-height: 100%;
          width: auto; height: auto;
          object-fit: contain;
          border-radius: 8px;
        }
        .vvf-cover {
          max-width: 60vh; max-height: 60vh;
          width: auto; height: auto;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }

        /* Transport */
        .vvf-transport {
          padding: 16px 24px 24px;
          background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%);
          max-width: 700px; width: 100%;
          margin: 0 auto;
        }
        .vvf-progress-row {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px;
        }
        .vvf-time {
          font-size: 12px; color: rgba(255,255,255,0.5);
          min-width: 40px; text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .vvf-progress {
          flex: 1; height: 6px; position: relative;
          background: rgba(255,255,255,0.15); border-radius: 3px;
          cursor: pointer;
        }
        .vvf-progress-fill {
          height: 100%; background: white; border-radius: 3px;
          transition: width 100ms linear; pointer-events: none;
        }
        .vvf-progress-knob {
          position: absolute; top: 50%; transform: translate(-50%, -50%);
          width: 14px; height: 14px; border-radius: 50%;
          background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          pointer-events: none; opacity: 0; transition: opacity 150ms;
        }
        .vvf-progress:hover .vvf-progress-knob { opacity: 1; }

        .vvf-controls {
          display: flex; align-items: center; justify-content: center; gap: 24px;
        }
        .vvf-ctrl {
          width: 48px; height: 48px;
          background: none; border: none; color: white;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          border-radius: 50%; transition: background 150ms;
        }
        .vvf-ctrl:hover { background: rgba(255,255,255,0.1); }
        .vvf-play {
          width: 64px; height: 64px; border-radius: 50%;
          background: white; border: none; color: black;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 150ms;
        }
        .vvf-play:hover { transform: scale(1.05); }
        .vvf-play svg { margin-left: 2px; }

        /* Mini mode */
        .desktop-np-drawer {
          position: fixed; bottom: 80px; right: 16px; z-index: 800;
          width: 320px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transform: translateY(20px); opacity: 0;
          transition: transform 300ms ease, opacity 300ms ease;
          overflow: hidden;
        }
        .desktop-np-drawer.open {
          transform: translateY(0); opacity: 1;
        }
        .dnp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .dnp-header-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .dnp-close, .dnp-expand {
          background: none; border: none; color: var(--text-muted);
          cursor: pointer; padding: 4px; transition: color 150ms;
        }
        .dnp-close:hover, .dnp-expand:hover { color: var(--text-primary); }
        .dnp-body { padding: 16px; }
        .dnp-visual { width: 100%; aspect-ratio: 1; border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-hover); margin-bottom: 12px; }
        .dnp-video, .dnp-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dnp-info { text-align: center; }
        .dnp-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dnp-artist { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dnp-actions { display: flex; justify-content: center; gap: 12px; }
        .dnp-action-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px; background: var(--bg-hover);
          border: 1px solid var(--border-color); border-radius: var(--radius-md);
          color: var(--text-secondary); font-size: 12px;
          cursor: pointer; transition: all 150ms;
        }
        .dnp-action-btn:hover { border-color: var(--accent); color: var(--text-primary); }
        .dnp-action-btn.liked { color: var(--error); border-color: var(--error); }
      </style>
    `;

    document.body.appendChild(viewer);

    // Bind fullscreen events
    document.getElementById('vvf-close')?.addEventListener('click', () => this.closeDesktopDrawer());
    document.getElementById('vvf-minimize')?.addEventListener('click', () => this._switchToMini());
    document.getElementById('vvf-play')?.addEventListener('click', () => {
      this.togglePlay();
      this._updateViewerPlayButton();
    });
    document.getElementById('vvf-prev')?.addEventListener('click', () => this.previous());
    document.getElementById('vvf-next')?.addEventListener('click', () => this.next());

    // Progress bar seeking
    this._bindViewerSeek();

    // Start video playback if playing
    if (hasVideo && isPlaying) {
      const video = document.getElementById('vvf-video');
      if (video) video.play().catch(() => {});
    }
  },

  /**
   * Switch to mini drawer mode
   */
  _switchToMini() {
    const track = AppState.player.currentTrack;
    if (!track) return;

    // Remove fullscreen
    document.getElementById('desktop-np-drawer')?.remove();
    this._cleanupVideoSync();

    this._videoViewerMode = 'mini';

    const hasVideo = !!(track.videoUrl || track.videoCid);
    const coverUrl = track.cover || '/placeholder.png';
    const videoSrc = this._getVideoSrc(track);

    const drawer = document.createElement('div');
    drawer.id = 'desktop-np-drawer';
    drawer.className = 'desktop-np-drawer';
    drawer.innerHTML = `
      <div class="dnp-header">
        <span class="dnp-header-title">Now Playing</span>
        <div style="display:flex;gap:4px;">
          <button class="dnp-expand" id="dnp-expand" title="Fullscreen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
          <button class="dnp-close" id="dnp-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="dnp-body">
        <div class="dnp-visual">
          ${hasVideo ? `
            <video class="dnp-video" id="dnp-video" src="${videoSrc}" 
              playsinline muted autoplay loop poster="${coverUrl}"></video>
          ` : `
            <img class="dnp-cover" id="dnp-cover" src="${coverUrl}" alt="Cover">
          `}
        </div>
        <div class="dnp-info">
          <div class="dnp-title" id="dnp-title">${track.title || 'Unknown'}</div>
          <div class="dnp-artist" id="dnp-artist">${track.artist || 'Unknown'}</div>
          <div class="dnp-actions">
            <button class="dnp-action-btn" id="dnp-like" title="Like">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="dnp-action-btn" id="dnp-add" title="Add to Playlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="dnp-action-btn" id="dnp-buy" title="Buy">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              ${track.price ? track.price + ' XRP' : ''}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);
    requestAnimationFrame(() => drawer.classList.add('open'));

    // Bind mini events
    document.getElementById('dnp-close')?.addEventListener('click', () => this.closeDesktopDrawer());
    document.getElementById('dnp-expand')?.addEventListener('click', () => this._switchToFullscreen());
    document.getElementById('dnp-like')?.addEventListener('click', () => this.toggleLike());
    document.getElementById('dnp-add')?.addEventListener('click', () => this.showPlaylistPicker());
    document.getElementById('dnp-buy')?.addEventListener('click', () => this.openReleaseModal());

    this.syncAllLikeButtons();
    this._startVideoSync();
  },

  /**
   * Switch from mini back to fullscreen
   */
  _switchToFullscreen() {
    document.getElementById('desktop-np-drawer')?.remove();
    this._cleanupVideoSync();
    this._videoViewerMode = null;
    this.openDesktopDrawer(); // Re-opens in fullscreen
  },

  /**
   * Close desktop viewer (any mode)
   */
  closeDesktopDrawer() {
    const el = document.getElementById('desktop-np-drawer');
    if (el) {
      if (this._videoViewerMode === 'mini') {
        el.classList.remove('open');
        setTimeout(() => el.remove(), 300);
      } else {
        el.remove();
      }
    }
    this._cleanupVideoSync();
    this._videoViewerMode = null;
    if (this._videoTrackHandler) {
      document.removeEventListener('player:trackchange', this._videoTrackHandler);
      this._videoTrackHandler = null;
    }
  },

  /**
   * Cleanup video sync interval
   */
  _cleanupVideoSync() {
    if (this._videoSyncInterval) {
      clearInterval(this._videoSyncInterval);
      this._videoSyncInterval = null;
    }
  },

  /**
   * Start syncing video element with audio player
   */
  _startVideoSync() {
    this._videoSyncInterval = setInterval(() => {
      // Sync video in either mode
      const video = document.getElementById('vvf-video') || document.getElementById('dnp-video');
      if (video && this.audio) {
        if (!this.audio.paused && video.paused) video.play().catch(() => {});
        if (this.audio.paused && !video.paused) video.pause();
        if (Math.abs(video.currentTime - this.audio.currentTime) > 0.5) {
          video.currentTime = this.audio.currentTime;
        }
      }

      // Update fullscreen transport
      if (this._videoViewerMode === 'fullscreen' && this.audio) {
        const progress = this.audio.duration ? (this.audio.currentTime / this.audio.duration) * 100 : 0;
        const fill = document.getElementById('vvf-progress-fill');
        const knob = document.getElementById('vvf-progress-knob');
        const currentEl = document.getElementById('vvf-current');
        const durationEl = document.getElementById('vvf-duration');
        
        if (fill) fill.style.width = `${progress}%`;
        if (knob) knob.style.left = `${progress}%`;
        
        const formatTime = typeof Helpers !== 'undefined' ? Helpers.formatDuration : (t) => {
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          return `${m}:${s.toString().padStart(2, '0')}`;
        };
        if (currentEl) currentEl.textContent = formatTime(this.audio.currentTime || 0);
        if (durationEl) durationEl.textContent = formatTime(this.audio.duration || 0);
      }
    }, 200);
  },

  /**
   * Bind seek on fullscreen progress bar
   */
  _bindViewerSeek() {
    const bar = document.getElementById('vvf-progress');
    if (!bar) return;
    
    const seek = (e) => {
      if (!this.audio || !this.audio.duration) return;
      const rect = bar.getBoundingClientRect();
      let percent = (e.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));
      this.audio.currentTime = percent * this.audio.duration;
    };

    bar.addEventListener('click', seek);
    
    let dragging = false;
    bar.addEventListener('mousedown', (e) => {
      dragging = true;
      seek(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (dragging) seek(e);
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  },

  /**
   * Update play button in viewer
   */
  _updateViewerPlayButton() {
    const btn = document.getElementById('vvf-play');
    if (!btn) return;
    btn.innerHTML = AppState.player.isPlaying
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  },

  /**
   * Handle track change while viewer is open
   */
  _onTrackChangeViewer() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    if (this._videoViewerMode === 'fullscreen') {
      // Rebuild fullscreen with new track
      document.getElementById('desktop-np-drawer')?.remove();
      this._cleanupVideoSync();
      
      const hasVideo = !!(track.videoUrl || track.videoCid);
      const videoSrc = this._getVideoSrc(track);
      const coverUrl = track.cover || '/placeholder.png';
      
      this._createFullscreenViewer(track, hasVideo, videoSrc, coverUrl);
      this._startVideoSync();
    } else if (this._videoViewerMode === 'mini') {
      // Update mini drawer content
      this.updateDesktopDrawer();
    }
  },

  /**
   * Update mini drawer when track changes (legacy compat)
   */
  updateDesktopDrawer() {
    const track = AppState.player.currentTrack;
    if (!track) return;
    const drawer = document.getElementById('desktop-np-drawer');
    if (!drawer || this._videoViewerMode !== 'mini') return;

    const titleEl = document.getElementById('dnp-title');
    const artistEl = document.getElementById('dnp-artist');
    if (titleEl) titleEl.textContent = track.title || 'Unknown';
    if (artistEl) artistEl.textContent = track.artist || 'Unknown';

    const hasVideo = !!(track.videoUrl || track.videoCid);
    const visualContainer = drawer.querySelector('.dnp-visual');
    const coverUrl = track.cover || '/placeholder.png';

    this._cleanupVideoSync();

    if (hasVideo) {
      const videoSrc = this._getVideoSrc(track);
      visualContainer.innerHTML = `<video class="dnp-video" id="dnp-video" src="${videoSrc}" 
        playsinline muted autoplay loop poster="${coverUrl}"></video>`;
    } else {
      visualContainer.innerHTML = `<img class="dnp-cover" id="dnp-cover" src="${coverUrl}" alt="Cover">`;
    }

    this._startVideoSync();

    // Update buy button
    const buyBtn = document.getElementById('dnp-buy');
    if (buyBtn) {
      const svgHtml = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
      buyBtn.innerHTML = svgHtml + (track.price ? ' ' + track.price + ' XRP' : '');
    }

    this.syncAllLikeButtons();
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
      // Repeat is OFF - play next from queue system
      this.next();
    }
  },
  
  onTimeUpdate() {
    // Don't update UI while user is dragging
    if (this.seeking.isDragging) return;
    
    if (!this.audio.duration) return;
    
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    updatePlayer({ progress });
    
    // Update progress bars
    this.updateProgressUI(progress);
    
    // Update duration display
    const durationEl = document.getElementById('expanded-duration');
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
  
  /**
   * Show the player bar and mark body as player-active
   * The player-active class enables CSS spacing fixes for modals/track lists
   */
  showPlayerBar() {
    const playerBar = document.getElementById('player-bar');
    if (playerBar) {
      playerBar.classList.remove('hidden');
    }
    
    // Add player-active class to body for CSS spacing adjustments
    document.body.classList.add('player-active');
  },
  
  updateTrackInfo(track) {
    // Mini player
    const cover = document.getElementById('player-cover');
    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    
    // Use proxy for cover images too
    const coverUrl = getProxiedIpfsUrl(track.cover || track.coverUrl) || '/placeholder.png';
    
    if (cover) {
      cover.onerror = () => {
        cover.onerror = null; // Prevent infinite loop
        cover.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23222" width="200" height="200"/><text x="50%" y="50%" fill="%23444" font-size="48" text-anchor="middle" dy=".3em">♪</text></svg>';
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
        expCover.onerror = null; // Prevent infinite loop
        expCover.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23222" width="200" height="200"/><text x="50%" y="50%" fill="%23444" font-size="48" text-anchor="middle" dy=".3em">♪</text></svg>';
      };
      expCover.src = coverUrl;
    }
    if (expTitle) expTitle.textContent = track.title || 'Unknown Track';
    if (expArtist) expArtist.textContent = track.artist || 'Unknown Artist';
    
    // Update all like buttons
    this.syncAllLikeButtons();
    
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
  
  /**
   * Update like button (legacy - now calls syncAllLikeButtons)
   */
  updateLikeButton() {
    this.syncAllLikeButtons();
  },
  
  updateExpandedPlayer() {
    // Sync all UI elements with current state
    const track = AppState.player.currentTrack;
    if (!track) return;
    
    this.updateTrackInfo(track);
    this.updatePlayButton(AppState.player.isPlaying);
    this.updateVolumeIcon();
    this.syncAllLikeButtons();
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
    
    // Initialize QueueManager auto queue when tracks are available
    if (typeof QueueManager !== 'undefined') {
      QueueManager.loadAutoQueue();
      QueueManager.renderSidebar();
    }
  },
};
