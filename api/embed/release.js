/**
 * XRP Music - Embeddable Player for Twitter/X Player Cards
 * A minimal audio player that can be embedded in an iframe
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).send('Missing release ID');
  }
  
  try {
    // Fetch release with first track
    const releases = await sql`
      SELECT r.*, 
        t.audio_url as track_audio_url,
        t.audio_cid as track_audio_cid,
        t.title as track_title
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      WHERE r.id = ${id}
      ORDER BY t.track_order ASC
      LIMIT 1
    `;
    
    if (releases.length === 0) {
      return res.status(404).send('Release not found');
    }
    
    const release = releases[0];
    const title = release.title || 'Untitled';
    const artistName = release.artist_name || 'Unknown Artist';
    const coverUrl = release.cover_url || 'https://xrpmusic.io/placeholder.png';
    const trackTitle = release.track_title || title;
    
    // Get audio URL - prefer direct URL, fallback to IPFS gateway
    let audioUrl = release.track_audio_url;
    if (!audioUrl && release.track_audio_cid) {
      audioUrl = `https://gateway.pinata.cloud/ipfs/${release.track_audio_cid}`;
    }
    
    if (!audioUrl) {
      return res.status(404).send('No audio available');
    }
    
    // Build embedded player HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} by ${artistName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .player {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      width: 100%;
      max-width: 480px;
    }
    
    .cover {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .info {
      flex: 1;
      min-width: 0;
    }
    
    .title {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    
    .artist {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 12px;
    }
    
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .play-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #22c55e;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    
    .play-btn:hover {
      transform: scale(1.05);
      background: #16a34a;
    }
    
    .play-btn svg {
      width: 18px;
      height: 18px;
      fill: white;
      margin-left: 2px;
    }
    
    .play-btn.playing svg {
      margin-left: 0;
    }
    
    .progress-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .progress-bar {
      flex: 1;
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      cursor: pointer;
      position: relative;
    }
    
    .progress-fill {
      height: 100%;
      background: #22c55e;
      border-radius: 2px;
      width: 0%;
      transition: width 0.1s linear;
    }
    
    .time {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      min-width: 35px;
      text-align: right;
    }
    
    .branding {
      position: absolute;
      bottom: 8px;
      right: 12px;
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      text-decoration: none;
    }
    
    .branding:hover {
      color: rgba(255,255,255,0.7);
    }
  </style>
</head>
<body>
  <div class="player">
    <div class="cover">
      <img src="${coverUrl}" alt="${title}" crossorigin="anonymous">
    </div>
    <div class="info">
      <div class="title">${trackTitle}</div>
      <div class="artist">${artistName}</div>
      <div class="controls">
        <button class="play-btn" id="playBtn">
          <svg viewBox="0 0 24 24" id="playIcon">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <div class="progress-container">
          <div class="progress-bar" id="progressBar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <span class="time" id="time">0:00</span>
        </div>
      </div>
    </div>
  </div>
  
  <a href="https://xrpmusic.io/release/${id}" target="_blank" class="branding">XRP Music</a>
  
  <audio id="audio" preload="metadata" crossorigin="anonymous">
    <source src="${audioUrl}" type="audio/mpeg">
  </audio>
  
  <script>
    const audio = document.getElementById('audio');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const timeDisplay = document.getElementById('time');
    
    let isPlaying = false;
    
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    
    function updatePlayIcon() {
      if (isPlaying) {
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        playBtn.classList.add('playing');
      } else {
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        playBtn.classList.remove('playing');
      }
    }
    
    playBtn.addEventListener('click', function() {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    });
    
    audio.addEventListener('play', function() {
      isPlaying = true;
      updatePlayIcon();
    });
    
    audio.addEventListener('pause', function() {
      isPlaying = false;
      updatePlayIcon();
    });
    
    audio.addEventListener('timeupdate', function() {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = percent + '%';
      timeDisplay.textContent = formatTime(audio.currentTime);
    });
    
    audio.addEventListener('ended', function() {
      isPlaying = false;
      updatePlayIcon();
      progressFill.style.width = '0%';
      timeDisplay.textContent = '0:00';
    });
    
    progressBar.addEventListener('click', function(e) {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
    });
    
    // Auto-play when loaded (Twitter expects this behavior)
    audio.addEventListener('canplaythrough', function() {
      // Don't auto-play, let user click
    }, { once: true });
  </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Allow Twitter to iframe this
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('Embed player error:', error);
    return res.status(500).send('Error loading player');
  }
}
