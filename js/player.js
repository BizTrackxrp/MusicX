/**
 * XRP Music - Audio Player
 * Handles playback, queue, progress, and volume
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
    // REMOVED: shuffleBtn - shuffle is now always on
    const repeatBtn = document.getElementById('repeat-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const progressBar = document.getElementById('player-progress');
    
    // Mobile controls
    const mobilePlayBtn = document.getElementById('mobile-play-btn');
    const expandBtn = document.getElementById('player-expand-btn');
    const collapseBtn = document.getElementById('collapse-player-btn');
    
    // Expanded player controls
    const expPlayBtn = document.getElementById('expanded-play-btn');
    const expPrevBtn = document.getElementById('expanded-prev-btn');
    const expNextBtn = document.getElementById('expanded-next-btn');
    // REMOVED: expShuffleBtn - shuffle is now always on
    const expRepeatBtn = document.getElementById('expanded-repeat-btn');
    const expVolumeSlider = document.getElementById('expanded-volume-slider');
    const expProgressBar = document.getElementById('expanded-progress');
    
    // Play/Pause
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
    if (mobilePlayBtn) mobilePlayBtn.addEventListener('click', () => this.togglePlay());
    if (expPlayBtn) expPlayBtn.addEventListener('click', () => this.togglePlay());
    
    // Previous/Next
    if (prevBtn) prevBtn.addEventListener('click', () => this.previous());
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());
    if (expPrevBtn) expPrevBtn.addEventListener('click', () => this.previous());
    if (expNextBtn) expNextBtn.addEventListener('click', () => this.next());
    
    // Repeat only (shuffle removed)
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
    
    // Like button
    const likeBtn = document.getElementById('player-like-btn');
    const expLikeBtn = document.getElementById('expanded-like-btn');
    if (likeBtn) likeBtn.addEventListener('click', () => this.toggleLike());
    if (expLikeBtn) expLikeBtn.addEventListener('click', () => this.toggleLike());
    
    // Click on track info to open release modal (not expanded player)
    const playerTrack = document.getElementById('player-track-info');
    if (playerTrack) {
      playerTrack.addEventListener('click', async (e) => {
        // Don't trigger if clicking on the expand button
        if (e.target.closest('.player-expand-btn')) return;
        await this.openReleaseModal();
      });
      playerTrack.style.cursor = 'pointer';
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
   * Play a track (NOW ASYNC with gateway fallback)
   */
  async playTrack(track, queue = null, queueIndex = 0) {
    if (!track) return;
    
    // Update state
    setCurrentTrack(track);
    if (queue) {
      // ALWAYS SHUFFLE the queue (except current track stays first)
      const currentTrack = queue[queueIndex];
      const otherTracks = queue.filter((_, i) => i !== queueIndex);
      const shuffledOthers = Helpers.shuffle([...otherTracks]);
      const shuffledQueue = [currentTrack, ...shuffledOthers];
      setQueue(shuffledQueue, 0);
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
   * Play next track - ALWAYS RANDOM (shuffle is default)
   */
  next() {
    const { queue, queueIndex } = AppState.player;
    if (queue.length === 0) return;
    
    // Always pick a random next track (shuffle is always on)
    // But avoid playing the same track unless it's the only one
    let nextIndex;
    if (queue.length === 1) {
      nextIndex = 0;
    } else {
      // Pick random index that's not the current one
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === queueIndex && queue.length > 1);
    }
    
    const nextTrack = queue[nextIndex];
    updatePlayer({ queueIndex: nextIndex });
    this.playTrack(nextTrack);
  },
  
  /**
   * Play previous track
   */
  previous() {
    const { queue, queueIndex } = AppState.player;
    if (queue.length === 0) return;
    
    // If more than 3 seconds in, restart current track
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    // Go to previous in queue order (or random if you prefer)
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    const prevTrack = queue[prevIndex];
    
    updatePlayer({ queueIndex: prevIndex });
    this.playTrack(prevTrack);
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
      // Also update the color directly for immediate feedback
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
   */
  async toggleLike() {
    const track = AppState.player.currentTrack;
    if (!track || !AppState.user?.address) return;
    
    const trackId = track.trackId || track.id?.toString();
    const isLiked = isTrackLiked(trackId);
    
    try {
      if (isLiked) {
        await API.unlikeTrack(AppState.user.address, trackId);
        removeLikedTrack(trackId);
      } else {
        await API.likeTrack(AppState.user.address, trackId, track.releaseId);
        addLikedTrack(trackId);
      }
      
      this.updateLikeButton();
    } catch (error) {
      console.error('Failed to toggle like:', error);
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
  
  onEnded() {
    if (AppState.player.isRepeat) {
      // Repeat is ON - replay current track
      this.audio.currentTime = 0;
      this.play();
    } else {
      // Repeat is OFF - play random next track (shuffle is always on)
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
    
    if (currentTimeEl) currentTimeEl.textContent = Helpers.formatDuration(this.audio.currentTime);
    if (durationEl) durationEl.textContent = Helpers.formatDuration(this.audio.duration);
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
    
    if (cover) cover.src = track.cover || '/placeholder.png';
    if (title) title.textContent = track.title || 'Unknown Track';
    if (artist) artist.textContent = track.artist || 'Unknown Artist';
    
    // Expanded player
    const expCover = document.getElementById('expanded-cover');
    const expTitle = document.getElementById('expanded-title');
    const expArtist = document.getElementById('expanded-artist');
    
    if (expCover) expCover.src = track.cover || '/placeholder.png';
    if (expTitle) expTitle.textContent = track.title || 'Unknown Track';
    if (expArtist) expArtist.textContent = track.artist || 'Unknown Artist';
    
    // Update like button
    this.updateLikeButton();
    
    // Update document title
    document.title = `${track.title} - ${track.artist} | XRP Music`;
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
    const isLiked = isTrackLiked(trackId);
    
    const likeBtn = document.getElementById('player-like-btn');
    const expLikeBtn = document.getElementById('expanded-like-btn');
    
    if (likeBtn) likeBtn.classList.toggle('liked', isLiked);
    if (expLikeBtn) expLikeBtn.classList.toggle('liked', isLiked);
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
};
