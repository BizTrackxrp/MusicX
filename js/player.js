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
    
    // Dispatch track change event for external listeners (e.g., Now Playing view)
    document.dispatchEvent(new CustomEvent('player:trackchange', { detail: { track } }));
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
  },
};
