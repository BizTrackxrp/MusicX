/**
 * XRP Music - Open Graph & Twitter Player Card for Release Pages
 * Returns HTML with meta tags for social media previews
 * Includes Twitter Player Card for inline audio playback
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  const { id } = req.query;
  
  if (!id) {
    return res.redirect('/app.html');
  }
  
  try {
    // Fetch release data with first track for audio
    const releases = await sql`
      SELECT r.*, 
        p.name as profile_name,
        t.audio_url as track_audio_url,
        t.audio_cid as track_audio_cid
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      LEFT JOIN tracks t ON t.release_id = r.id
      WHERE r.id = ${id}
      ORDER BY t.track_order ASC
      LIMIT 1
    `;
    
    if (releases.length === 0) {
      // Release not found, redirect to app anyway
      return res.redirect('/app.html');
    }
    
    const release = releases[0];
    const title = escapeHtml(release.title || 'Untitled Release');
    const artistName = escapeHtml(release.artist_name || release.profile_name || 'Unknown Artist');
    const description = escapeHtml(release.description || `Listen to "${title}" by ${artistName} on XRP Music`);
    const coverUrl = release.cover_url || 'https://xrpmusic.io/og-default.png';
    const pageUrl = `https://xrpmusic.io/release/${id}`;
    const price = parseFloat(release.song_price) || 0;
    
    // Check if we have audio for Player Card
    const hasAudio = release.track_audio_url || release.track_audio_cid;
    const embedPlayerUrl = `https://xrpmusic.io/api/embed/release?id=${id}`;
    
    // Get direct audio URL for twitter:player:stream
    let audioStreamUrl = release.track_audio_url;
    if (!audioStreamUrl && release.track_audio_cid) {
      audioStreamUrl = `https://gateway.pinata.cloud/ipfs/${release.track_audio_cid}`;
    }
    
    // Return HTML with Open Graph and Twitter Player Card tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${title} by ${artistName} | XRP Music</title>
  <meta name="title" content="${title} by ${artistName} | XRP Music">
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="music.song">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title} by ${artistName}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${coverUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1200">
  <meta property="og:site_name" content="XRP Music">
  
  <!-- Twitter Card -->
  ${hasAudio ? `
  <!-- Twitter Player Card (for audio playback) -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:site" content="@xraboratories">
  <meta name="twitter:title" content="${title} by ${artistName}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${coverUrl}">
  <meta name="twitter:player" content="${embedPlayerUrl}">
  <meta name="twitter:player:width" content="480">
  <meta name="twitter:player:height" content="120">
  ${audioStreamUrl ? `<meta name="twitter:player:stream" content="${audioStreamUrl}">
  <meta name="twitter:player:stream:content_type" content="audio/mpeg">` : ''}
  ` : `
  <!-- Twitter Summary Card (fallback when no audio) -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@xraboratories">
  <meta name="twitter:title" content="${title} by ${artistName}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${coverUrl}">
  `}
  
  <!-- Music specific -->
  <meta property="music:musician" content="${artistName}">
  ${price > 0 ? `<meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="XRP">` : ''}
  
  <!-- Redirect to app for regular browsers -->
  <script>
    // Only redirect if not a bot/crawler
    if (!/bot|crawl|spider|facebook|twitter|discord|slack|telegram|whatsapp/i.test(navigator.userAgent)) {
      window.location.href = '/app.html';
    }
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/app.html">
  </noscript>
</head>
<body style="font-family: system-ui, sans-serif; background: #0a0a0a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 20px;">
    <img src="${coverUrl}" alt="${title}" style="width: 200px; height: 200px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
    <h1 style="font-size: 24px; margin-bottom: 8px;">${title}</h1>
    <p style="color: #888; margin-bottom: 20px;">${artistName}</p>
    <a href="/app.html" style="display: inline-block; padding: 12px 32px; background: #22c55e; color: white; text-decoration: none; border-radius: 24px; font-weight: 600;">Listen on XRP Music</a>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('OG Release error:', error);
    return res.redirect('/app.html');
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
