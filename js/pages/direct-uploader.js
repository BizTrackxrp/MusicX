/**
 * XRP Music - Direct Uploader
 * Uploads files directly from browser to Lighthouse IPFS
 * Bypasses Vercel's 4.5MB serverless function limit
 * 
 * USAGE:
 *   // Upload with progress
 *   const result = await DirectUploader.upload(file, (pct) => {
 *     console.log(`${pct}% uploaded`);
 *   });
 *   // result = { cid: "Qm...", url: "https://gateway.lighthouse.storage/ipfs/Qm...", size: 12345 }
 * 
 * FLOW:
 *   1. Fetches Lighthouse API key from /api/upload-config (origin-restricted)
 *   2. Uploads file directly to Lighthouse (up to 24GB)
 *   3. Returns CID for use in mint/release creation
 * 
 * FALLBACK:
 *   For small files (<4MB), can still use the existing /api/upload proxy.
 *   DirectUploader.upload() works for ANY size — use it for everything if you want.
 */

const DirectUploader = {
  // Cached API key (refreshed each session)
  _apiKey: null,
  _endpoint: null,
  
  // Size threshold — files under this use old /api/upload, over use direct
  // Set to 0 to always use direct upload
  PROXY_THRESHOLD: 4 * 1024 * 1024, // 4MB
  
  /**
   * Get Lighthouse API key from server
   * Cached for the session to avoid repeated calls
   */
  async getConfig() {
    if (this._apiKey && this._endpoint) {
      return { key: this._apiKey, endpoint: this._endpoint };
    }
    
    try {
      const res = await fetch('/api/upload-config');
      if (!res.ok) {
        throw new Error(`Config fetch failed: ${res.status}`);
      }
      
      const data = await res.json();
      this._apiKey = data.key;
      this._endpoint = data.endpoint;
      
      return { key: this._apiKey, endpoint: this._endpoint };
    } catch (err) {
      console.error('Failed to get upload config:', err);
      throw new Error('Upload service unavailable. Please try again.');
    }
  },
  
  /**
   * Upload a file to IPFS
   * 
   * @param {File} file - The File object from an <input type="file">
   * @param {Function} onProgress - Callback: (percentComplete) => {}
   * @param {Object} options - Optional settings
   *   options.forceDirect: true to always use direct upload (skip proxy)
   *   options.forceProxy: true to always use /api/upload proxy (will fail >4.5MB)
   * @returns {Promise<{cid, url, ipfsUrl, size, name}>}
   */
  async upload(file, onProgress = null, options = {}) {
    if (!file) throw new Error('No file provided');
    
    // Decide upload path
    const useDirect = options.forceDirect || 
                      (!options.forceProxy && file.size > this.PROXY_THRESHOLD);
    
    if (useDirect) {
      return this._directUpload(file, onProgress);
    } else {
      return this._proxyUpload(file, onProgress);
    }
  },
  
  /**
   * Direct browser → Lighthouse upload (no size limit)
   * Uses XMLHttpRequest for progress tracking
   */
  async _directUpload(file, onProgress) {
    const config = await this.getConfig();
    
    const formData = new FormData();
    formData.append('file', file, file.name);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const cid = data.Hash;
            
            if (!cid) {
              reject(new Error('No CID returned from IPFS'));
              return;
            }
            
            console.log('✅ Direct upload complete:', file.name, '→', cid);
            
            resolve({
              cid: cid,
              url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
              ipfsUrl: `ipfs://${cid}`,
              size: parseInt(data.Size) || file.size,
              name: data.Name || file.name,
            });
          } catch (parseErr) {
            reject(new Error('Invalid response from IPFS service'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });
      
      xhr.open('POST', config.endpoint);
      xhr.setRequestHeader('Authorization', `Bearer ${config.key}`);
      xhr.send(formData);
    });
  },
  
  /**
   * Proxy upload through /api/upload (for small files like cover art)
   * Uses existing Vercel endpoint — limited to ~4.5MB
   */
  async _proxyUpload(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Can't track upload progress with fetch, but these are small files
    if (onProgress) onProgress(0);
    
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    
    const data = await res.json();
    
    if (onProgress) onProgress(100);
    
    console.log('✅ Proxy upload complete:', file.name, '→', data.cid);
    
    return {
      cid: data.cid,
      url: data.url,
      ipfsUrl: data.ipfsUrl || `ipfs://${data.cid}`,
      size: file.size,
      name: file.name,
    };
  },
  
  /**
   * Upload multiple files with combined progress
   * Useful for album uploads (multiple audio tracks)
   * 
   * @param {File[]} files - Array of File objects
   * @param {Function} onProgress - Callback: (percentComplete, currentFileIndex, fileName) => {}
   * @returns {Promise<Array<{cid, url, ipfsUrl, size, name}>>}
   */
  async uploadMultiple(files, onProgress = null) {
    const results = [];
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    let uploadedSize = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileStartSize = uploadedSize;
      
      const result = await this.upload(file, (filePct) => {
        if (onProgress) {
          const fileUploaded = (filePct / 100) * file.size;
          const totalPct = Math.round(((fileStartSize + fileUploaded) / totalSize) * 100);
          onProgress(totalPct, i, file.name);
        }
      }, { forceDirect: true });
      
      uploadedSize += file.size;
      results.push(result);
    }
    
    if (onProgress) onProgress(100, files.length - 1, 'Complete');
    
    return results;
  },
  
  /**
   * Validate file before upload
   * Returns { valid: true } or { valid: false, error: "..." }
   */
  validate(file, options = {}) {
    const maxSize = options.maxSize || 500 * 1024 * 1024; // 500MB default
    const allowedTypes = options.allowedTypes || null; // null = allow all
    
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }
    
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return { valid: false, error: `File too large. Maximum size is ${maxMB}MB.` };
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return { valid: false, error: `Unsupported file type: ${file.type}` };
    }
    
    return { valid: true };
  },
  
  /**
   * Get accepted audio MIME types
   */
  AUDIO_TYPES: [
    'audio/mpeg',      // MP3
    'audio/mp3',       // MP3 alternate
    'audio/wav',       // WAV
    'audio/x-wav',     // WAV alternate
    'audio/wave',      // WAV alternate
    'audio/flac',      // FLAC
    'audio/x-flac',    // FLAC alternate
    'audio/aac',       // AAC
    'audio/mp4',       // M4A
    'audio/x-m4a',     // M4A alternate
    'audio/ogg',       // OGG
    'audio/webm',      // WebM audio
  ],
  
  /**
   * Get accepted video MIME types
   */
  VIDEO_TYPES: [
    'video/mp4',       // MP4
    'video/webm',      // WebM
    'video/quicktime', // MOV
  ],
  
  /**
   * Get accepted image MIME types
   */
  IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  
  /**
   * Format file size for display
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  },
};
