<!-- 
  IMPROVED PLAYER BAR
  Replace your current player-bar HTML with this cleaner version
  Layout: [Art] [Title/Artist] [❤️ 🛒] [🔀 ⏮ ⏸ ⏭ 🔁] [0:00/3:10] [🔊━━]
-->

<div class="player-bar" id="player-bar" style="display: none;">
  <!-- Progress bar at top -->
  <div class="player-progress">
    <div class="player-progress-bar" id="player-progress-bar"></div>
    <input type="range" class="player-progress-input" id="player-seek" min="0" max="100" value="0">
  </div>
  
  <div class="player-content">
    <!-- Left: Track Info -->
    <div class="player-left">
      <div class="player-cover" id="player-cover"></div>
      <div class="player-info">
        <div class="player-title" id="player-title">No track playing</div>
        <div class="player-artist" id="player-artist"></div>
      </div>
    </div>
    
    <!-- Center-Left: Actions (Like, Buy) -->
    <div class="player-actions">
      <button class="player-action-btn" id="player-like-btn" title="Like">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>
      <button class="player-action-btn" id="player-buy-btn" title="Buy NFT">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
      </button>
    </div>
    
    <!-- Center: Playback Controls (MAIN - centered) -->
    <div class="player-controls">
      <button class="player-btn" id="player-shuffle" title="Shuffle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 3 21 3 21 8"></polyline>
          <line x1="4" y1="20" x2="21" y2="3"></line>
          <polyline points="21 16 21 21 16 21"></polyline>
          <line x1="15" y1="15" x2="21" y2="21"></line>
          <line x1="4" y1="4" x2="9" y2="9"></line>
        </svg>
      </button>
      <button class="player-btn" id="player-prev" title="Previous">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="19 20 9 12 19 4 19 20"></polygon>
          <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line>
        </svg>
      </button>
      <button class="player-btn player-btn-main" id="player-play-pause" title="Play/Pause">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="player-play-icon">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="player-pause-icon" style="display:none;">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      </button>
      <button class="player-btn" id="player-next" title="Next">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line>
        </svg>
      </button>
      <button class="player-btn" id="player-repeat" title="Repeat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
      </button>
    </div>
    
    <!-- Right: Time + Volume -->
    <div class="player-right">
      <div class="player-time">
        <span id="player-current-time">0:00</span>
        <span class="player-time-sep">/</span>
        <span id="player-duration">0:00</span>
      </div>
      <div class="player-volume">
        <button class="player-btn" id="player-mute" title="Mute">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="volume-icon">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>
        <input type="range" class="player-volume-slider" id="player-volume" min="0" max="100" value="80">
      </div>
    </div>
  </div>
</div>


<style>
/* ============================================
   PLAYER BAR STYLES - Clean Gala-style layout
   ============================================ */

.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--player-height, 80px);
  background: var(--bg-secondary, #181818);
  border-top: 1px solid var(--border-color, #282828);
  z-index: 1100;
}

@media (min-width: 1025px) {
  .player-bar {
    left: var(--sidebar-width, 240px);
  }
}

@media (max-width: 1024px) {
  .player-bar {
    height: var(--player-height-mobile, 64px);
  }
}

/* Progress bar */
.player-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--bg-hover, #282828);
  cursor: pointer;
}

.player-progress-bar {
  height: 100%;
  background: var(--accent, #1db954);
  width: 0%;
  transition: width 0.1s linear;
}

.player-progress-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
}

/* Main content layout */
.player-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  gap: 16px;
}

/* Left: Track info */
.player-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 180px;
  max-width: 300px;
  flex: 1;
}

.player-cover {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: var(--bg-hover, #282828);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.player-info {
  overflow: hidden;
}

.player-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-artist {
  font-size: 12px;
  color: var(--text-muted, #b3b3b3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Actions (Like, Buy) */
.player-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-action-btn {
  background: none;
  border: none;
  color: var(--text-muted, #b3b3b3);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-action-btn:hover {
  color: var(--text-primary, #fff);
  background: var(--bg-hover, #282828);
}

.player-action-btn.liked {
  color: var(--accent, #1db954);
}

/* Center: Playback controls */
.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
}

.player-btn {
  background: none;
  border: none;
  color: var(--text-muted, #b3b3b3);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-btn:hover {
  color: var(--text-primary, #fff);
}

.player-btn.active {
  color: var(--accent, #1db954);
}

/* Main play/pause button - larger and highlighted */
.player-btn-main {
  width: 40px;
  height: 40px;
  background: var(--text-primary, #fff);
  color: var(--bg-primary, #121212) !important;
  border-radius: 50%;
  margin: 0 8px;
}

.player-btn-main:hover {
  transform: scale(1.05);
  background: var(--text-primary, #fff);
}

/* Right: Time + Volume */
.player-right {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px;
  justify-content: flex-end;
  flex: 1;
}

.player-time {
  font-size: 12px;
  color: var(--text-muted, #b3b3b3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.player-time-sep {
  margin: 0 4px;
  opacity: 0.5;
}

.player-volume {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-volume-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-hover, #282828);
  border-radius: 2px;
  cursor: pointer;
}

.player-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--text-primary, #fff);
  border-radius: 50%;
  cursor: pointer;
}

.player-volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--text-primary, #fff);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .player-content {
    padding: 0 12px;
    gap: 8px;
  }
  
  .player-left {
    min-width: 120px;
    max-width: 150px;
  }
  
  .player-cover {
    width: 40px;
    height: 40px;
  }
  
  .player-title {
    font-size: 13px;
  }
  
  .player-actions {
    display: none; /* Hide on mobile */
  }
  
  .player-controls {
    gap: 4px;
  }
  
  .player-btn {
    padding: 6px;
  }
  
  #player-shuffle,
  #player-repeat {
    display: none; /* Hide shuffle/repeat on mobile */
  }
  
  .player-right {
    min-width: auto;
    gap: 8px;
  }
  
  .player-time {
    display: none; /* Hide time on very small screens */
  }
  
  .player-volume-slider {
    width: 60px;
  }
}

@media (max-width: 480px) {
  .player-volume {
    display: none; /* Hide volume on very small screens */
  }
}
</style>
