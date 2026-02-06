/**
 * XRP Music - Queue Manager
 * 3-tier priority queue system:
 *   Slot 1: Now Playing (single track)
 *   Slot 2: User Queue (manually added via "Play Next" / "Add to Queue")
 *   Slot 3: Auto Queue (random tracks, infinite lazy-loaded)
 * 
 * PRIORITY: Slot 2 always plays before Slot 3.
 * When Slot 2 is empty, tracks pull from Slot 3.
 * Slot 3 auto-refills with random tracks when running low.
 * 
 * CONTEXT MODES:
 * - "library" (default): Auto queue is random from entire library
 * - "artist" / "playlist" / "album": Context takeover — clears everything,
 *   queues all tracks from that context
 * 
 * DRAG REORDER: User can reorder Slot 2 (user queue) via drag-and-drop.
 * Auto queue (Slot 3) is not reorderable.
 */

const QueueManager = {
  // Slot 2: User-added tracks (Play Next / Add to Queue)
  userQueue: [],
  
  // Context Queue: Sequential tracks from album/playlist (plays after user queue, before auto)
  contextQueue: [],
  
  // Slot 3: Auto-generated random queue
  autoQueue: [],
  
  // Playback history (for "previous" functionality)
  history: [],
  
  // Current context
  context: {
    type: 'library', // 'library' | 'artist' | 'playlist' | 'album'
    id: null,
    name: null,
    tracks: [], // All tracks in current context (for context mode)
    currentIndex: 0,
  },
  
  // Config
  AUTO_QUEUE_BATCH_SIZE: 20,
  AUTO_QUEUE_REFILL_THRESHOLD: 5,
  MAX_HISTORY: 50,
  
  // Sidebar visibility
  isQueueVisible: true,
  
  /**
   * Initialize the queue manager
   * Called after releases are loaded
   */
  init() {
    this.loadAutoQueue();
    this.renderSidebar();
    this.bindSidebarEvents();
    console.log('🎵 QueueManager initialized');
  },
  
  // ============================================
  // CORE QUEUE OPERATIONS
  // ============================================
  
  /**
   * Play a track from anywhere on the site
   * This is the main entry point for playing tracks
   * 
   * @param {Object} track - Track to play
   * @param {Object} options - Optional context info
   *   options.context: 'library' | 'artist' | 'playlist' | 'album'
   *   options.contextId: ID of the context (artist address, playlist id, etc.)
   *   options.contextName: Display name of the context
   *   options.contextTracks: All tracks in the context
   *   options.trackIndex: Index of this track in contextTracks
   */
  playNow(track, options = {}) {
    if (!track) return;
    
    const contextType = options.context || 'library';
    
    // Push current track to history
    const currentTrack = AppState.player.currentTrack;
    if (currentTrack) {
      this.history.unshift(currentTrack);
      if (this.history.length > this.MAX_HISTORY) {
        this.history = this.history.slice(0, this.MAX_HISTORY);
      }
    }
    
    // Context takeover: artist, playlist, album
    if (['artist', 'playlist', 'album'].includes(contextType) && options.contextTracks) {
      this.setContext(contextType, options.contextId, options.contextName, options.contextTracks, options.trackIndex || 0);
    }
    
    // Actually play the track
    Player.playTrack(track);
    
    // Ensure auto queue has tracks
    if (this.autoQueue.length < this.AUTO_QUEUE_REFILL_THRESHOLD) {
      this.refillAutoQueue();
    }
    
    this.renderSidebar();
  },
  
  /**
   * Set a context (artist/playlist/album) — clears auto queue, preserves user queue
   * Albums and playlists play in ORDER (not shuffled).
   * When context finishes, user queue (Slot 2) picks back up, then auto queue resumes.
   */
  setContext(type, id, name, tracks, startIndex = 0) {
    // Save current user queue so it resumes after context finishes
    // (don't clear it — it picks back up after the album/playlist ends)
    
    // Set context
    this.context = {
      type,
      id,
      name,
      tracks: [...tracks],
      currentIndex: startIndex,
    };
    
    // Build context queue: tracks AFTER the current one, IN ORDER
    // e.g., if user clicks track 3 of 7, queue becomes [4, 5, 6, 7]
    const remainingTracks = tracks.slice(startIndex + 1);
    
    // Context tracks go into a special contextQueue that plays in order
    // before auto queue, but after user queue
    this.contextQueue = remainingTracks;
    
    // Clear auto queue — it will refill once context + user queue are done
    this.autoQueue = [];
    
    console.log(`🎵 Context set: ${type} "${name}" — playing from track ${startIndex + 1}/${tracks.length}, ${remainingTracks.length} remaining in order`);
  },
  
  /**
   * Clear context back to library mode
   */
  clearContext() {
    this.context = {
      type: 'library',
      id: null,
      name: null,
      tracks: [],
      currentIndex: 0,
    };
    this.contextQueue = [];
    this.loadAutoQueue();
  },
  
  /**
   * Add track as "Play Next" — inserts at TOP of user queue (Slot 2)
   */
  playNext(track) {
    if (!track) return;
    
    // Prevent duplicates in user queue
    this.userQueue = this.userQueue.filter(t => 
      (t.trackId || t.id) !== (track.trackId || track.id)
    );
    
    this.userQueue.unshift(track);
    this.renderSidebar();
    
    if (typeof Modals !== 'undefined' && Modals.showToast) {
      Modals.showToast(`"${track.title}" will play next`);
    } else if (typeof showToast === 'function') {
      showToast(`"${track.title}" will play next`);
    }
    
    console.log('⏭️ Play Next:', track.title, '| User queue:', this.userQueue.length);
  },
  
  /**
   * Add track to "Add to Queue" — appends to END of user queue (Slot 2)
   */
  addToQueue(track) {
    if (!track) return;
    
    // Prevent duplicates in user queue
    this.userQueue = this.userQueue.filter(t => 
      (t.trackId || t.id) !== (track.trackId || track.id)
    );
    
    this.userQueue.push(track);
    this.renderSidebar();
    
    if (typeof Modals !== 'undefined' && Modals.showToast) {
      Modals.showToast(`"${track.title}" added to queue`);
    } else if (typeof showToast === 'function') {
      showToast(`"${track.title}" added to queue`);
    }
    
    console.log('➕ Added to Queue:', track.title, '| User queue:', this.userQueue.length);
  },
  
  /**
   * Get the next track to play
   * Priority: Slot 2 (user queue) > Context Queue (album/playlist in order) > Slot 3 (auto queue)
   */
  getNext() {
    // 1. Check user queue first (Slot 2) — always highest priority
    if (this.userQueue.length > 0) {
      const track = this.userQueue.shift();
      console.log('⏭️ Next from user queue:', track.title);
      this.renderSidebar();
      return track;
    }
    
    // 2. Check context queue (album/playlist sequential tracks)
    if (this.contextQueue.length > 0) {
      const track = this.contextQueue.shift();
      console.log('🎵 Next from context (in order):', track.title);
      
      // If context queue is now empty, refill auto queue for after context ends
      if (this.contextQueue.length === 0) {
        console.log('📀 Context finished — auto queue will resume');
        this.refillAutoQueue();
      }
      
      this.renderSidebar();
      return track;
    }
    
    // 3. Check auto queue (Slot 3)
    if (this.autoQueue.length > 0) {
      const track = this.autoQueue.shift();
      
      // Refill if running low
      if (this.autoQueue.length < this.AUTO_QUEUE_REFILL_THRESHOLD) {
        this.refillAutoQueue();
      }
      
      console.log('🎲 Next from auto queue:', track.title);
      this.renderSidebar();
      return track;
    }
    
    // 4. Fallback: get random from library
    const randomTrack = this._getRandomTrack();
    if (randomTrack) {
      this.refillAutoQueue();
      console.log('🎲 Next from random fallback:', randomTrack.title);
      return randomTrack;
    }
    
    return null;
  },
  
  /**
   * Get the previous track (from history)
   */
  getPrevious() {
    if (this.history.length > 0) {
      return this.history.shift();
    }
    return null;
  },
  
  /**
   * Remove a track from user queue by index
   */
  removeFromUserQueue(index) {
    if (index >= 0 && index < this.userQueue.length) {
      const removed = this.userQueue.splice(index, 1)[0];
      console.log('🗑️ Removed from user queue:', removed.title);
      this.renderSidebar();
    }
  },
  
  /**
   * Remove a track from context queue by index
   */
  removeFromContextQueue(index) {
    if (index >= 0 && index < this.contextQueue.length) {
      const removed = this.contextQueue.splice(index, 1)[0];
      console.log('🗑️ Removed from context queue:', removed.title);
      this.renderSidebar();
    }
  },
  
  /**
   * Remove a track from auto queue by index
   */
  removeFromAutoQueue(index) {
    if (index >= 0 && index < this.autoQueue.length) {
      const removed = this.autoQueue.splice(index, 1)[0];
      console.log('🗑️ Removed from auto queue:', removed.title);
      this.renderSidebar();
    }
  },
  
  /**
   * Reorder user queue (drag and drop)
   */
  reorderUserQueue(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.userQueue.length) return;
    if (toIndex < 0 || toIndex >= this.userQueue.length) return;
    
    const [item] = this.userQueue.splice(fromIndex, 1);
    this.userQueue.splice(toIndex, 0, item);
    
    console.log('🔀 Reordered user queue:', fromIndex, '->', toIndex);
    this.renderSidebar();
  },
  
  /**
   * Clear user queue
   */
  clearUserQueue() {
    this.userQueue = [];
    this.renderSidebar();
  },
  
  // ============================================
  // AUTO QUEUE (SLOT 3) — Random / Infinite
  // ============================================
  
  /**
   * Load initial auto queue with random tracks
   */
  loadAutoQueue() {
    const allTracks = this._getAllTracks();
    if (allTracks.length === 0) return;
    
    const currentTrack = AppState.player.currentTrack;
    const currentId = currentTrack?.trackId || currentTrack?.id;
    
    // Filter out current track and any tracks in user queue
    const userQueueIds = new Set(this.userQueue.map(t => t.trackId || t.id));
    const available = allTracks.filter(t => {
      const tid = t.trackId || t.id;
      return tid !== currentId && !userQueueIds.has(tid);
    });
    
    const shuffled = this._shuffle([...available]);
    this.autoQueue = shuffled.slice(0, this.AUTO_QUEUE_BATCH_SIZE);
    
    console.log('🎲 Auto queue loaded:', this.autoQueue.length, 'tracks');
  },
  
  /**
   * Refill auto queue when running low
   */
  refillAutoQueue() {
    const allTracks = this._getAllTracks();
    if (allTracks.length === 0) return;
    
    const currentTrack = AppState.player.currentTrack;
    const currentId = currentTrack?.trackId || currentTrack?.id;
    
    // IDs already in queues
    const existingIds = new Set([
      ...this.userQueue.map(t => t.trackId || t.id),
      ...this.autoQueue.map(t => t.trackId || t.id),
    ]);
    if (currentId) existingIds.add(currentId);
    
    // If in context mode, pull from context tracks
    let pool;
    if (this.context.type !== 'library' && this.context.tracks.length > 0) {
      pool = this.context.tracks.filter(t => !existingIds.has(t.trackId || t.id));
      // If context is exhausted, allow repeats from context
      if (pool.length === 0) {
        pool = this.context.tracks.filter(t => (t.trackId || t.id) !== currentId);
      }
    } else {
      pool = allTracks.filter(t => !existingIds.has(t.trackId || t.id));
      // If library is small, allow repeats
      if (pool.length === 0) {
        pool = allTracks.filter(t => (t.trackId || t.id) !== currentId);
      }
    }
    
    const shuffled = this._shuffle([...pool]);
    const newTracks = shuffled.slice(0, this.AUTO_QUEUE_BATCH_SIZE);
    this.autoQueue.push(...newTracks);
    
    console.log('🔄 Auto queue refilled:', newTracks.length, 'new tracks. Total:', this.autoQueue.length);
  },
  
  // ============================================
  // SIDEBAR RENDERING
  // ============================================
  
  /**
   * Render the queue in the sidebar
   */
  renderSidebar() {
    const container = document.getElementById('queue-tracks-list');
    if (!container) return;
    
    const currentTrack = AppState.player.currentTrack;
    const hasUserQueue = this.userQueue.length > 0;
    const hasContextQueue = this.contextQueue.length > 0;
    const hasAutoQueue = this.autoQueue.length > 0;
    
    let html = '';
    
    // Now Playing
    if (currentTrack) {
      html += `
        <div class="queue-section-label">Now Playing</div>
        <div class="queue-item now-playing">
          <div class="queue-item-cover">
            <img src="${getProxiedIpfsUrl(currentTrack.cover || currentTrack.coverUrl) || '/placeholder.png'}" alt="" onerror="this.src='/placeholder.png'">
            <div class="queue-now-playing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="queue-item-info">
            <div class="queue-item-title">${currentTrack.title || 'Unknown'}</div>
            <div class="queue-item-artist">${currentTrack.artist || 'Unknown'}</div>
          </div>
        </div>
      `;
    }
    
    // User Queue (Slot 2 — highest priority)
    if (hasUserQueue) {
      html += `
        <div class="queue-section-label">
          Next Up
          <button class="queue-clear-btn" onclick="QueueManager.clearUserQueue()" title="Clear queue">Clear</button>
        </div>
      `;
      
      this.userQueue.forEach((track, index) => {
        html += this._renderQueueItem(track, index, 'user');
      });
    }
    
    // Context Queue (album/playlist — sequential, plays after user queue)
    if (hasContextQueue) {
      const contextLabel = this.context.name 
        ? `Next from ${this.context.name}`
        : `Next from ${this.context.type}`;
      
      html += `<div class="queue-section-label">${contextLabel}</div>`;
      
      const displayCount = Math.min(this.contextQueue.length, 15);
      for (let i = 0; i < displayCount; i++) {
        html += this._renderQueueItem(this.contextQueue[i], i, 'context');
      }
      
      if (this.contextQueue.length > 15) {
        html += `<div class="queue-more-indicator">+${this.contextQueue.length - 15} more tracks</div>`;
      }
    }
    
    // Auto Queue (Slot 3) — show up to 15
    if (hasAutoQueue) {
      const autoLabel = (!hasContextQueue && this.context.type !== 'library')
        ? `Playing from ${this.context.name || this.context.type}`
        : 'Auto Playing';
      
      html += `<div class="queue-section-label">${autoLabel}</div>`;
      
      const displayCount = Math.min(this.autoQueue.length, 15);
      for (let i = 0; i < displayCount; i++) {
        html += this._renderQueueItem(this.autoQueue[i], i, 'auto');
      }
      
      if (this.autoQueue.length > 15) {
        html += `<div class="queue-more-indicator">+${this.autoQueue.length - 15} more tracks</div>`;
      }
    }
    
    // Empty state
    if (!currentTrack && !hasUserQueue && !hasContextQueue && !hasAutoQueue) {
      html = `
        <div class="queue-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4;">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <p>Your queue is empty</p>
          <p class="queue-empty-sub">Play a song to get started</p>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // Initialize drag-and-drop on user queue items
    this._initDragAndDrop();
    
    // Update queue count badge
    const countEl = document.getElementById('queue-count');
    const totalQueued = this.userQueue.length + this.contextQueue.length;
    if (countEl) {
      countEl.textContent = totalQueued > 0 ? `${totalQueued} queued` : '';
    }
  },
  
  /**
   * Render a single queue item
   */
  _renderQueueItem(track, index, queueType) {
    const coverUrl = getProxiedIpfsUrl(track.cover || track.coverUrl) || '/placeholder.png';
    const isDraggable = queueType === 'user';
    
    return `
      <div class="queue-item ${isDraggable ? 'draggable' : ''}" 
           data-queue-type="${queueType}" 
           data-index="${index}"
           ${isDraggable ? 'draggable="true"' : ''}>
        ${isDraggable ? `
          <div class="queue-drag-handle" title="Drag to reorder">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2"></circle>
              <circle cx="16" cy="6" r="2"></circle>
              <circle cx="8" cy="12" r="2"></circle>
              <circle cx="16" cy="12" r="2"></circle>
              <circle cx="8" cy="18" r="2"></circle>
              <circle cx="16" cy="18" r="2"></circle>
            </svg>
          </div>
        ` : ''}
        <div class="queue-item-cover" onclick="QueueManager._playFromQueue('${queueType}', ${index})">
          <img src="${coverUrl}" alt="" onerror="this.src='/placeholder.png'">
        </div>
        <div class="queue-item-info" onclick="QueueManager._playFromQueue('${queueType}', ${index})">
          <div class="queue-item-title">${track.title || 'Unknown'}</div>
          <div class="queue-item-artist">${track.artist || 'Unknown'}</div>
        </div>
        <button class="queue-item-remove" onclick="QueueManager.${queueType === 'user' ? 'removeFromUserQueue' : queueType === 'context' ? 'removeFromContextQueue' : 'removeFromAutoQueue'}(${index})" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  },
  
  /**
   * Play a track directly from the queue sidebar
   */
  _playFromQueue(queueType, index) {
    let track;
    
    if (queueType === 'user') {
      if (index >= 0 && index < this.userQueue.length) {
        track = this.userQueue.splice(index, 1)[0];
      }
    } else if (queueType === 'context') {
      if (index >= 0 && index < this.contextQueue.length) {
        // When clicking a context track, also remove everything before it
        // (since we're skipping ahead in the album/playlist)
        track = this.contextQueue[index];
        this.contextQueue = this.contextQueue.slice(index + 1);
      }
    } else if (queueType === 'auto') {
      if (index >= 0 && index < this.autoQueue.length) {
        track = this.autoQueue.splice(index, 1)[0];
      }
    }
    
    if (track) {
      // Push current track to history
      const currentTrack = AppState.player.currentTrack;
      if (currentTrack) {
        this.history.unshift(currentTrack);
        if (this.history.length > this.MAX_HISTORY) {
          this.history = this.history.slice(0, this.MAX_HISTORY);
        }
      }
      
      Player.playTrack(track);
      this.renderSidebar();
    }
  },
  
  // ============================================
  // DRAG AND DROP
  // ============================================
  
  _dragState: {
    draggedIndex: null,
    draggedEl: null,
    placeholder: null,
  },
  
  _initDragAndDrop() {
    const container = document.getElementById('queue-tracks-list');
    if (!container) return;
    
    const draggables = container.querySelectorAll('.queue-item.draggable');
    
    draggables.forEach(item => {
      item.addEventListener('dragstart', (e) => this._onDragStart(e, item));
      item.addEventListener('dragend', (e) => this._onDragEnd(e, item));
    });
    
    // Also support touch drag
    draggables.forEach(item => {
      const handle = item.querySelector('.queue-drag-handle');
      if (handle) {
        handle.addEventListener('touchstart', (e) => this._onTouchDragStart(e, item), { passive: false });
      }
    });
    
    container.addEventListener('dragover', (e) => this._onDragOver(e));
    container.addEventListener('drop', (e) => this._onDrop(e));
  },
  
  _onDragStart(e, item) {
    this._dragState.draggedIndex = parseInt(item.dataset.index);
    this._dragState.draggedEl = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.index);
  },
  
  _onDragEnd(e, item) {
    item.classList.remove('dragging');
    this._dragState.draggedIndex = null;
    this._dragState.draggedEl = null;
    
    // Remove any drag-over highlights
    document.querySelectorAll('.queue-item.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  },
  
  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.queue-item.draggable');
    if (!target || target === this._dragState.draggedEl) return;
    
    // Highlight drop target
    document.querySelectorAll('.queue-item.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    target.classList.add('drag-over');
  },
  
  _onDrop(e) {
    e.preventDefault();
    
    const target = e.target.closest('.queue-item.draggable');
    if (!target) return;
    
    const fromIndex = this._dragState.draggedIndex;
    const toIndex = parseInt(target.dataset.index);
    
    if (fromIndex !== null && fromIndex !== toIndex) {
      this.reorderUserQueue(fromIndex, toIndex);
    }
    
    // Clean up
    document.querySelectorAll('.queue-item.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  },
  
  // Touch drag support for mobile
  _touchDragState: {
    item: null,
    clone: null,
    startY: 0,
    currentY: 0,
    scrollInterval: null,
  },
  
  _onTouchDragStart(e, item) {
    e.preventDefault();
    const touch = e.touches[0];
    
    this._touchDragState.item = item;
    this._touchDragState.startY = touch.clientY;
    this._touchDragState.currentY = touch.clientY;
    
    item.classList.add('dragging');
    
    const onTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._touchDragState.currentY = touch.clientY;
      
      // Find element under touch point
      const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
      const target = elements.find(el => el.classList?.contains('draggable') && el !== item);
      
      document.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (target) target.classList.add('drag-over');
    };
    
    const onTouchEnd = (e) => {
      item.classList.remove('dragging');
      
      const touch = e.changedTouches[0];
      const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
      const target = elements.find(el => el.classList?.contains('draggable') && el !== item);
      
      if (target) {
        const fromIndex = parseInt(item.dataset.index);
        const toIndex = parseInt(target.dataset.index);
        this.reorderUserQueue(fromIndex, toIndex);
      }
      
      document.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  },
  
  // ============================================
  // SIDEBAR EVENTS
  // ============================================
  
  bindSidebarEvents() {
    // Toggle queue visibility
    const toggleBtn = document.getElementById('queue-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isQueueVisible = !this.isQueueVisible;
        const content = document.getElementById('queue-content');
        if (content) content.classList.toggle('hidden', !this.isQueueVisible);
        toggleBtn.classList.toggle('collapsed', !this.isQueueVisible);
      });
    }
  },
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Build a track object from a release (for adding to queue from UI)
   */
  buildTrackObject(release, trackIndex = 0) {
    const track = release.tracks?.[trackIndex];
    if (!track) return null;
    
    return {
      id: parseInt(track.id) || trackIndex,
      trackId: track.id,
      title: release.type === 'single' ? release.title : track.title,
      artist: release.artistName || (typeof Helpers !== 'undefined' ? Helpers.truncateAddress(release.artistAddress) : release.artistAddress),
      cover: getProxiedIpfsUrl(release.coverUrl),
      ipfsHash: track.audioCid,
      releaseId: release.id,
      duration: track.duration,
      price: track.price || release.price,
      artistAddress: release.artistAddress,
    };
  },
  
  /**
   * Get all tracks from AppState.releases
   */
  _getAllTracks() {
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
    
    return allTracks;
  },
  
  /**
   * Get a single random track (excluding current)
   */
  _getRandomTrack(excludeId = null) {
    const allTracks = this._getAllTracks();
    if (allTracks.length === 0) return null;
    
    const currentId = excludeId || AppState.player.currentTrack?.trackId || AppState.player.currentTrack?.id;
    const available = allTracks.filter(t => (t.trackId || t.id) !== currentId);
    
    if (available.length === 0) return allTracks[0];
    return available[Math.floor(Math.random() * available.length)];
  },
  
  /**
   * Fisher-Yates shuffle
   */
  _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  
  /**
   * Get total queued count (user + context + auto)
   */
  getTotalCount() {
    return this.userQueue.length + this.contextQueue.length + this.autoQueue.length;
  },
};
