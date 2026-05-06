/**
 * Video Validator
 * ==========================================================
 * Validates a video file BEFORE upload to catch mobile-incompatible
 * formats (HEVC, 10-bit, weird codecs, .mov containers).
 *
 * The trick: we use the artist's own browser as the test environment.
 * If their browser can't play it, no viewer's browser can. We catch it
 * here, before it costs a Filecoin upload.
 *
 * USAGE:
 *   const result = await VideoValidator.validate(file);
 *   if (!result.valid) {
 *     alert(result.message);
 *     return;
 *   }
 *   // ...proceed with upload
 *
 * Make available globally:
 *   window.VideoValidator
 *
 * Drop this file in /js/pages/video-validator.js and include it
 * in your HTML before films.js / modals.js.
 */

const VideoValidator = {
  // Accept these extensions. .mov is allowed because the codec INSIDE
  // matters more than the container — a .mov with H.264 will play fine.
  ALLOWED_EXTENSIONS: ['mp4', 'mov', 'm4v'],

  // Reject these extensions outright — known mobile failure modes
  REJECTED_EXTENSIONS: ['webm', 'mkv', 'avi', 'flv', 'wmv', 'ogg', 'ogv'],

  // Hard size cap (Filecoin handles big files but be reasonable)
  MAX_SIZE_BYTES: 10 * 1024 * 1024 * 1024, // 10GB

  /**
   * Main entry point. Validates a File and returns:
   *   { valid: true, file }  — go ahead and upload
   *   { valid: false, code, message } — show the message to user, do NOT upload
   */
  async validate(file) {
    if (!file) {
      return this._fail('NO_FILE', 'No file provided.');
    }

    // 1. Size check
    if (file.size > this.MAX_SIZE_BYTES) {
      const maxGB = (this.MAX_SIZE_BYTES / 1024 / 1024 / 1024).toFixed(0);
      return this._fail('TOO_LARGE',
        `File is too large. Max size is ${maxGB}GB.`);
    }

    if (file.size === 0) {
      return this._fail('EMPTY', 'File is empty.');
    }

    // 2. Extension check
    const ext = this._getExtension(file.name);
    if (this.REJECTED_EXTENSIONS.includes(ext)) {
      return this._fail('BAD_EXTENSION',
        `${ext.toUpperCase()} files are not supported. Please export as MP4 (H.264).`);
    }
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      return this._fail('UNKNOWN_EXTENSION',
        `Unsupported file type ".${ext}". Please use MP4 (H.264).`);
    }

    // 3. MIME type sanity check
    if (file.type && !file.type.startsWith('video/')) {
      return this._fail('NOT_A_VIDEO',
        'This file does not appear to be a video.');
    }

    // 4. Browser playability probe — THE BIG ONE
    // We create a temporary <video> element, point it at the file,
    // and listen for either `loadedmetadata` (✓ playable) or `error` (✗ rejected by browser).
    // If the artist's browser can't decode it, no viewer's browser can.
    try {
      const probe = await this._probePlayability(file);
      if (!probe.playable) {
        return this._fail('CODEC_NOT_SUPPORTED',
          'This video uses a format that won\'t play on phones. ' +
          'Most editors have an "Export for Web" or "H.264 MP4" preset that works. ' +
          'If you exported from iPhone or Mac, try changing the format to H.264 (not HEVC) ' +
          'and 8-bit color.',
          probe.diagnostics
        );
      }

      // Bonus: warn (don't reject) on suspiciously large dimensions
      if (probe.width > 3840 || probe.height > 2160) {
        console.warn('[VideoValidator] Large dimensions:',
          `${probe.width}x${probe.height} — will play but may stream slowly on mobile.`);
      }

      return {
        valid: true,
        file,
        diagnostics: {
          width: probe.width,
          height: probe.height,
          duration: probe.duration,
          extension: ext,
          mimeType: file.type,
          sizeMB: (file.size / 1024 / 1024).toFixed(1),
        },
      };
    } catch (err) {
      console.error('[VideoValidator] Probe error:', err);
      return this._fail('PROBE_FAILED',
        'Could not analyze video file. The file may be corrupt or in an unsupported format.');
    }
  },

  // ------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------

  _getExtension(name) {
    const m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  },

  _fail(code, message, diagnostics = null) {
    return { valid: false, code, message, diagnostics };
  },

  /**
   * Try loading the file in a hidden <video> element.
   * Returns { playable: bool, width, height, duration, errorCode? }
   *
   * This catches:
   *   - HEVC / H.265 (Android Chrome refuses → error code 4)
   *   - 10-bit color (refused → error code 4)
   *   - 4:4:4 chroma (refused → error code 4)
   *   - Corrupt files (any error code)
   *   - Containers the browser can't read (.avi, .flv, etc.)
   */
  _probePlayability(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.top = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      document.body.appendChild(video);

      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        try { video.remove(); } catch (e) {}
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      // Success: browser was able to read metadata (decoder accepted the file)
      video.addEventListener('loadedmetadata', () => {
        finish({
          playable: true,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
      });

      // Failure: browser refused the file
      video.addEventListener('error', () => {
        const err = video.error;
        finish({
          playable: false,
          errorCode: err?.code,
          errorMessage: err?.message,
        });
      });

      // Safety timeout — if neither event fires in 30s, give up
      setTimeout(() => {
        finish({
          playable: false,
          errorCode: 'TIMEOUT',
          errorMessage: 'Browser could not analyze the file in time.',
        });
      }, 30000);

      video.src = url;
      video.load();
    });
  },
};

if (typeof window !== 'undefined') {
  window.VideoValidator = VideoValidator;
}
