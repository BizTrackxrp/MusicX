/**
 * XRP Music - Audio Player
 * Handles playback, queue, progress, and volume
 */

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
    
    // Event listeners
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('error', (e) => this.onError(e));
    this.audio.addEventListener('canplay', () => this.onCanPlay());
    
    // Bind controls
    this.bindControls();
  },
  
  /**
   * Bind control buttons
   */
  bindControls() {
    // Desktop controls
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
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
    const expShuffleBtn = document.getElementById('expanded-shuffle-btn');
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
    
    // Shuffle/Repeat
    if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat());
    if (expShuffleBtn) expShuffleBtn.addEventListener('click', () => this.toggleShuffle());
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
    
    // Expand/Collapse mobile player
    if (expandBtn) expandBtn.addEventListener('click', () => this.expandPlayer());
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.collapsePlayer());
    
    // Like button
    const likeBtn = document.getElementById('player-like-btn');
    const expLikeBtn = document.getElementById('expanded-like-btn');
    if (likeBtn) likeBtn.addEventListener('click', () => this.toggleLike());
    if (expLikeBtn) expLikeBtn.addEventListener('click', () => this.toggleLike());
  },
  
  /**
   * Play a track
   */
  playTrack(track, queue = null, queueIndex = 0) {
    if (!track) return;
    
    // Update state
    setCurrentTrack(track);
    if (queue) {
      setQueue(queue, queueIndex);
    }
    
    // Get audio source
    const src = track.ipfsHash 
      ? Helpers.getIPFSUrl(track.ipfsHash)
      : track.audioUrl;
    
    if (!src) {
      console.error('No audio source for track:', track);
      return;
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
   * Play next track
   */
  next() {
    const { queue, queueIndex } = AppState.player;
    if (queue.length === 0) return;
    
    const nextIndex = (queueIndex + 1) % queue.length;
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
    
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    const prevTrack = queue[prevIndex];
    
    updatePlayer({ queueIndex: prevIndex });
    this.playTrack(prevTrack);
  },
  
  /**
   * Toggle shuffle
   */
  toggleShuffle() {
    const isShuffled = !AppState.player.isShuffled;
    updatePlayer({ isShuffled });
    
    // Update UI
    const shuffleBtn = document.getElementById('shuffle-btn');
    const expShuffleBtn = document.getElementById('expanded-shuffle-btn');
    
    if (shuffleBtn) shuffleBtn.classList.toggle('active', isShuffled);
    if (expShuffleBtn) expShuffleBtn.classList.toggle('active', isShuffled);
    
    // If enabling shuffle, shuffle the remaining queue
    if (isShuffled && AppState.player.queue.length > 1) {
      const currentTrack = AppState.player.queue[AppState.player.queueIndex];
      const remaining = AppState.player.queue.filter((_, i) => i !== AppState.player.queueIndex);
      const shuffled = Helpers.shuffle(remaining);
      setQueue([currentTrack, ...shuffled], 0);
    }
  },
  
  /**
   * Toggle repeat
   */
  toggleRepeat() {
    const isRepeat = !AppState.player.isRepeat;
    updatePlayer({ isRepeat });
    
    // Update UI
    const repeatBtn = document.getElementById('repeat-btn');
    const expRepeatBtn = document.getElementById('expanded-repeat-btn');
    
    if (repeatBtn) repeatBtn.classList.toggle('active', isRepeat);
    if (expRepeatBtn) expRepeatBtn.classList.toggle('active', isRepeat);
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
   * Expand mobile player
   */
  expandPlayer() {
    const expandedPlayer = document.getElementById('expanded-player');
    if (expandedPlayer) {
      expandedPlayer.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      AppState.expandedPlayer = true;
      this.updateExpandedPlayer();
    }
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
      this.audio.currentTime = 0;
      this.play();
    } else {
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
    
    // Sync volume slider
    const expVolumeSlider = document.getElementById('expanded-volume-slider');
    if (expVolumeSlider) {
      expVolumeSlider.value = AppState.player.isMuted ? 0 : AppState.player.volume;
    }
  },
};
