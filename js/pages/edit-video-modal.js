/**
 * Edit Video Modal
 * Allows artists to add/replace music videos on their existing tracks
 * 
 * Uses direct browser-to-IPFS upload via Lighthouse (bypasses Vercel 4.5MB limit)
 * Same upload pattern as the main upload flow for videos
 * 
 * Usage:
 *   EditVideoModal.show(release)           — show modal for a release
 *   EditVideoModal.show(release, trackId)  — show modal for a specific track
 */

const EditVideoModal = {
  currentRelease: null,
  selectedTrackId: null,
  selectedFile: null,
  uploadProgress: 0,
  lighthouseApiKey: null,
  
  async show(release, trackId = null) {
    this.currentRelease = release;
    this.selectedTrackId = trackId;
    this.selectedFile = null;
    this.uploadProgress = 0;
    
    // Get Lighthouse API key for direct upload
    if (!this.lighthouseApiKey) {
      try {
        const configResponse = await fetch('/api/upload-config');
        const config = await configResponse.json();
        this.lighthouseApiKey = config.lighthouseApiKey;
      } catch (e) {
        console.error('Failed to get upload config:', e);
      }
    }
    
    const tracks = release.tracks || [];
    const isMultiTrack = tracks.length > 1;
    
    // If single track, auto-select it
    if (tracks.length === 1) {
      this.selectedTrackId = tracks[0].id;
    }
    
    const html = `
      <div class="modal-overlay edit-video-modal-overlay">
        <div class="modal edit-video-modal">
          <div class="modal-header">
            <div class="modal-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              Add Music Video
            </div>
            <button class="modal-close" onclick="EditVideoModal.close()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Release Preview -->
            <div class="edit-video-preview">
              <div class="edit-video-cover">
                ${release.coverUrl 
                  ? `<img src="${Modals.getImageUrl(release.coverUrl)}" alt="${release.title}" onerror="this.src='/placeholder.png'">`
                  : `<div class="cover-placeholder">🎵</div>`
                }
              </div>
              <div class="edit-video-info">
                <div class="edit-video-title">${release.title}</div>
                <div class="edit-video-meta">${release.artistName} • ${tracks.length} track${tracks.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <!-- Track Selector (for multi-track releases) -->
            ${isMultiTrack ? `
              <div class="edit-video-section">
                <div class="section-label">Select Track</div>
                <p class="section-hint">Choose which track to add the video to</p>
                <div class="track-select-list" id="track-select-list">
                  ${tracks.map((track, idx) => `
                    <div class="track-select-row ${this.selectedTrackId === track.id ? 'selected' : ''} ${track.videoCid ? 'has-video' : ''}" 
                         data-track-id="${track.id}" 
                         onclick="EditVideoModal.selectTrack('${track.id}')">
                      <span class="track-select-num">${idx + 1}</span>
                      <span class="track-select-name">${track.title}</span>
                      ${track.videoCid 
                        ? `<span class="track-video-badge">🎬 Has Video</span>`
                        : `<span class="track-no-video-badge">No Video</span>`
                      }
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : `
              ${tracks[0]?.videoCid ? `
                <div class="current-video-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>This track already has a video. Uploading a new one will replace it.</span>
                </div>
              ` : ''}
            `}
            
            <!-- Video Upload Area -->
            <div class="edit-video-section">
              <div class="section-label">Music Video File</div>
              <p class="section-hint">MP4 format recommended. Up to 500MB.</p>
              
              <div class="video-drop-zone" id="video-drop-zone" onclick="document.getElementById('video-file-input').click()">
                <input type="file" id="video-file-input" accept="video/mp4,video/webm,video/quicktime" style="display:none" onchange="EditVideoModal.handleFileSelect(event)">
                <div class="drop-zone-content" id="drop-zone-content">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                  <div class="drop-zone-text">Click to select video file</div>
                  <div class="drop-zone-hint">or drag and drop here</div>
                </div>
              </div>
              
              <!-- File Info (after selection) -->
              <div class="selected-file-info" id="selected-file-info" style="display:none">
                <div class="file-info-row">
                  <span class="file-info-name" id="file-info-name"></span>
                  <button class="file-info-remove" onclick="EditVideoModal.removeFile()">✕</button>
                </div>
                <div class="file-info-size" id="file-info-size"></div>
              </div>
            </div>
            
            <!-- Upload Progress -->
            <div class="edit-video-progress" id="edit-video-progress" style="display:none">
              <div class="progress-header">
                <span id="upload-progress-label">Uploading to IPFS...</span>
                <span id="upload-progress-pct">0%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="upload-progress-fill" style="width:0%"></div>
              </div>
              <div class="progress-detail" id="upload-progress-detail">Starting upload...</div>
            </div>
            
            <!-- Status -->
            <div class="edit-video-status" id="edit-video-status" style="display:none">
              <div class="spinner"></div>
              <span id="edit-video-status-text">Saving...</span>
            </div>
            
            <!-- Actions -->
            <div class="edit-video-actions" id="edit-video-actions">
              <button class="btn btn-secondary" onclick="EditVideoModal.close()">Cancel</button>
              <button class="btn btn-primary" id="upload-video-btn" onclick="EditVideoModal.upload()" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Video
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .edit-video-modal { max-width: 520px; }
        .edit-video-modal .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .edit-video-preview {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .edit-video-cover {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
        }
        .edit-video-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .edit-video-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .edit-video-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .edit-video-meta {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .edit-video-section {
          margin-bottom: 20px;
        }
        .section-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .section-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0 0 12px 0;
        }
        
        /* Track selector */
        .track-select-list {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .track-select-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 150ms;
        }
        .track-select-row:last-child {
          border-bottom: none;
        }
        .track-select-row:hover {
          background: var(--bg-hover);
        }
        .track-select-row.selected {
          background: rgba(139, 92, 246, 0.1);
          border-left: 3px solid var(--accent);
        }
        .track-select-num {
          width: 24px;
          height: 24px;
          background: var(--bg-tertiary);
          border-radius: 50%;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .track-select-row.selected .track-select-num {
          background: var(--accent);
          color: white;
        }
        .track-select-name {
          flex: 1;
          font-size: 14px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-video-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border-radius: 4px;
          font-weight: 600;
        }
        .track-no-video-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          border-radius: 4px;
        }
        
        .current-video-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: var(--radius-md);
          font-size: 13px;
          color: #60a5fa;
          margin-bottom: 20px;
        }
        .current-video-notice svg {
          flex-shrink: 0;
        }
        
        /* Video drop zone */
        .video-drop-zone {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-lg);
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: all 200ms;
        }
        .video-drop-zone:hover,
        .video-drop-zone.drag-over {
          border-color: var(--accent);
          background: rgba(139, 92, 246, 0.05);
        }
        .drop-zone-content svg {
          color: var(--text-muted);
          margin-bottom: 12px;
        }
        .drop-zone-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .drop-zone-hint {
          font-size: 13px;
          color: var(--text-muted);
        }
        .video-drop-zone.has-file {
          border-color: var(--success);
          background: rgba(34, 197, 94, 0.05);
        }
        
        /* Selected file info */
        .selected-file-info {
          margin-top: 12px;
          padding: 12px 16px;
          background: var(--bg-hover);
          border-radius: var(--radius-md);
        }
        .file-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .file-info-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 350px;
        }
        .file-info-remove {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .file-info-remove:hover {
          background: var(--bg-tertiary);
          color: var(--error);
        }
        .file-info-size {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        
        /* Progress */
        .edit-video-progress {
          margin-bottom: 20px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
        }
        .edit-video-progress .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
        }
        #upload-progress-label {
          color: var(--text-primary);
          font-weight: 500;
        }
        #upload-progress-pct {
          color: var(--accent);
          font-weight: 600;
        }
        .edit-video-progress .progress-bar {
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .edit-video-progress .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), #8b5cf6);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .progress-detail {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        /* Status */
        .edit-video-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .edit-video-status .spinner {
          width: 20px;
          height: 20px;
        }
        
        /* Actions */
        .edit-video-actions {
          display: flex;
          gap: 12px;
        }
        .edit-video-actions .btn {
          flex: 1;
        }
      </style>
    `;
    
    // Insert modal
    const container = document.getElementById('modals');
    if (container) {
      container.innerHTML = html;
      requestAnimationFrame(() => {
        container.querySelector('.modal-overlay')?.classList.add('visible');
      });
    }
    
    // Setup drag and drop
    this.setupDragDrop();
    
    // Close on backdrop click
    container.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.close();
      }
    });
    
    // Close on escape
    document.addEventListener('keydown', this.handleEsc);
  },
  
  selectTrack(trackId) {
    this.selectedTrackId = trackId;
    
    // Update UI
    document.querySelectorAll('.track-select-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.trackId === trackId);
    });
    
    // Enable upload button if file is also selected
    this.updateUploadButton();
  },
  
  setupDragDrop() {
    const zone = document.getElementById('video-drop-zone');
    if (!zone) return;
    
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });
    
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        this.setFile(file);
      } else {
        alert('Please select a video file (MP4, WebM, or MOV)');
      }
    });
  },
  
  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.setFile(file);
    }
  },
  
  setFile(file) {
    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum is 500MB.`);
      return;
    }
    
    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a video file (MP4, WebM, or MOV)');
      return;
    }
    
    this.selectedFile = file;
    
    // Update UI
    const zone = document.getElementById('video-drop-zone');
    const fileInfo = document.getElementById('selected-file-info');
    const fileName = document.getElementById('file-info-name');
    const fileSize = document.getElementById('file-info-size');
    
    zone.classList.add('has-file');
    zone.querySelector('.drop-zone-content').innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <div class="drop-zone-text" style="color: var(--success);">Video Selected</div>
      <div class="drop-zone-hint">Click to change file</div>
    `;
    
    fileInfo.style.display = 'block';
    fileName.textContent = file.name;
    
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    fileSize.textContent = `${sizeMB} MB • ${file.type.split('/')[1].toUpperCase()}`;
    
    this.updateUploadButton();
  },
  
  removeFile() {
    this.selectedFile = null;
    
    const zone = document.getElementById('video-drop-zone');
    const fileInfo = document.getElementById('selected-file-info');
    const fileInput = document.getElementById('video-file-input');
    
    zone.classList.remove('has-file');
    zone.querySelector('.drop-zone-content').innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
      <div class="drop-zone-text">Click to select video file</div>
      <div class="drop-zone-hint">or drag and drop here</div>
    `;
    
    fileInfo.style.display = 'none';
    fileInput.value = '';
    
    this.updateUploadButton();
  },
  
  updateUploadButton() {
    const btn = document.getElementById('upload-video-btn');
    if (!btn) return;
    
    const ready = this.selectedFile && this.selectedTrackId;
    btn.disabled = !ready;
    
    if (ready) {
      const track = this.currentRelease.tracks?.find(t => t.id === this.selectedTrackId);
      const action = track?.videoCid ? 'Replace' : 'Upload';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        ${action} Video
      `;
    }
  },
  
  handleEsc(e) {
    if (e.key === 'Escape') {
      EditVideoModal.close();
    }
  },
  
  close() {
    const container = document.getElementById('modals');
    if (container) {
      const overlay = container.querySelector('.modal-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
          // Restore the release modal if it was open
          if (this.currentRelease) {
            Modals.showRelease(this.currentRelease);
          }
        }, 200);
      }
    }
    document.removeEventListener('keydown', this.handleEsc);
    this.currentRelease = null;
    this.selectedFile = null;
    this.selectedTrackId = null;
  },
  
  updateProgress(pct, label, detail) {
    const progressEl = document.getElementById('edit-video-progress');
    const fillEl = document.getElementById('upload-progress-fill');
    const pctEl = document.getElementById('upload-progress-pct');
    const labelEl = document.getElementById('upload-progress-label');
    const detailEl = document.getElementById('upload-progress-detail');
    
    if (!progressEl) return;
    progressEl.style.display = 'block';
    
    fillEl.style.width = `${pct}%`;
    pctEl.textContent = `${Math.round(pct)}%`;
    if (label) labelEl.textContent = label;
    if (detail) detailEl.textContent = detail;
  },
  
  async upload() {
    if (!this.selectedFile || !this.selectedTrackId) return;
    
    const file = this.selectedFile;
    const trackId = this.selectedTrackId;
    const release = this.currentRelease;
    
    const track = release.tracks?.find(t => t.id === trackId);
    const trackTitle = track?.title || 'Track';
    
    const actionsEl = document.getElementById('edit-video-actions');
    const statusEl = document.getElementById('edit-video-status');
    
    // Hide actions, show progress
    actionsEl.style.display = 'none';
    
    try {
      // STEP 1: Upload video to IPFS via Lighthouse
      this.updateProgress(0, 'Uploading to IPFS...', `"${trackTitle}" — starting upload`);
      
      let videoCid = null;
      
      if (this.lighthouseApiKey) {
        // Direct upload to Lighthouse
        videoCid = await this.uploadToLighthouse(file);
      } else {
        // Fallback: upload through server (limited to 4.5MB)
        videoCid = await this.uploadViaServer(file);
      }
      
      if (!videoCid) {
        throw new Error('Upload failed — no CID returned');
      }
      
      console.log('✅ Video uploaded to IPFS:', videoCid);
      
      // STEP 2: Save CID to database
      this.updateProgress(90, 'Saving...', 'Updating track with video link');
      
      statusEl.style.display = 'flex';
      document.getElementById('edit-video-status-text').textContent = 'Saving video to track...';
      
      const response = await fetch('/api/releases/update-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          trackId: trackId,
          artistAddress: AppState.user.address,
          videoCid: videoCid,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save video');
      }
      
      // STEP 3: Success!
      this.updateProgress(100, 'Complete!', `Video added to "${trackTitle}"`);
      
      statusEl.innerHTML = `
        <div style="color: var(--success);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span style="color: var(--success); font-weight: 600;">Video Added!</span>
      `;
      
      // Update release in memory
      if (track) {
        track.videoCid = videoCid;
        track.videoUrl = `https://gateway.lighthouse.storage/ipfs/${videoCid}`;
      }
      
      // Update AppState
      if (AppState.releases) {
        const appRelease = AppState.releases.find(r => r.id === release.id);
        if (appRelease) {
          const appTrack = appRelease.tracks?.find(t => t.id === trackId);
          if (appTrack) {
            appTrack.videoCid = videoCid;
            appTrack.videoUrl = `https://gateway.lighthouse.storage/ipfs/${videoCid}`;
          }
        }
      }
      
      // Close and reopen release modal after delay
      setTimeout(() => {
        const container = document.getElementById('modals');
        if (container) container.innerHTML = '';
        document.removeEventListener('keydown', this.handleEsc);
        Modals.showRelease(this.currentRelease);
        this.currentRelease = null;
        this.selectedFile = null;
        this.selectedTrackId = null;
      }, 2000);
      
    } catch (error) {
      console.error('Video upload failed:', error);
      
      statusEl.style.display = 'flex';
      statusEl.innerHTML = `
        <div style="color: var(--error);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <span style="color: var(--error);">${error.message}</span>
      `;
      
      actionsEl.style.display = 'flex';
      
      // Reset progress
      const progressEl = document.getElementById('edit-video-progress');
      if (progressEl) progressEl.style.display = 'none';
    }
  },
  
  /**
   * Upload directly to Lighthouse IPFS (no server size limit)
   * Uses XMLHttpRequest for progress tracking
   */
  async uploadToLighthouse(file) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 85); // Reserve last 15% for processing
          const uploadedMB = (e.loaded / 1024 / 1024).toFixed(1);
          const totalMB = (e.total / 1024 / 1024).toFixed(1);
          this.updateProgress(pct, 'Uploading to IPFS...', `${uploadedMB} / ${totalMB} MB`);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            const cid = result?.data?.Hash || result?.Hash;
            if (cid) {
              resolve(cid);
            } else {
              reject(new Error('No CID in Lighthouse response'));
            }
          } catch (e) {
            reject(new Error('Invalid response from Lighthouse'));
          }
        } else {
          reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => reject(new Error('Upload failed — network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      
      xhr.open('POST', 'https://node.lighthouse.storage/api/v0/add');
      xhr.setRequestHeader('Authorization', `Bearer ${this.lighthouseApiKey}`);
      xhr.send(formData);
    });
  },
  
  /**
   * Fallback: upload via server proxy (limited to ~4.5MB on Vercel)
   */
  async uploadViaServer(file) {
    if (file.size > 4 * 1024 * 1024) {
      throw new Error('File too large for server upload. Direct IPFS upload not configured — contact support.');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'video');
    
    this.updateProgress(30, 'Uploading via server...', 'This may take a moment');
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (!result.success || !result.cid) {
      throw new Error(result.error || 'Server upload failed');
    }
    
    return result.cid;
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EditVideoModal = EditVideoModal;
}
