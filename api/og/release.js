/**
 * XRP Music - Open Graph & Twitter Player Card for Release Pages
 * Returns HTML with meta tags for social media previews
 * Includes Twitter Player Card for inline audio playback
 * 
 * Supports ?track=trk_xxx param for track-specific sharing:
 * - OG title shows "Track Name by Artist" instead of album name
 * - OG description shows "from Album Name" context
 * - Audio stream points to the specific track
 * - Redirect preserves the track param
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  const { id, track: trackParam } = req.query;
  
  if (!id) {
    return res.redirect('/app.html');
  }
  
  try {
    // Fetch release data
    const releases = await sql`
      SELECT r.*, 
        p.name as profile_name
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE r.id = ${id}
      LIMIT 1
    `;
    
    if (releases.length === 0) {
      return res.redirect('/app.html');
    }
    
    const release = releases[0];
    const artistName = escapeHtml(release.artist_name || release.profile_name || 'Unknown Artist');
    const coverUrl = release.cover_url || 'https://xrpmusic.io/og-default.png';
    const price = parseFloat(release.song_price) || 0;
    
    // Determine if we have a specific track to feature
    let ogTitle, ogDescription, audioStreamUrl, embedTrackId;
    
    if (trackParam) {
      // Fetch the specific track
      const tracks = await sql`
        SELECT t.* FROM tracks t
        WHERE t.release_id = ${id} AND t.id = ${trackParam}
        LIMIT 1
      `;
      
      if (tracks.length > 0) {
        const track = tracks[0];
        const trackTitle = escapeHtml(track.title || release.title || 'Untitled');
        const releaseTitle = escapeHtml(release.title || 'Untitled Release');
        
        // Track-specific OG metadata
        ogTitle = `${trackTitle} by ${artistName}`;
        ogDescription = escapeHtml(release.type !== 'single' 
          ? `From "${releaseTitle}" — Listen on XRP Music`
          : `Listen to "${trackTitle}" by ${artistName} on XRP Music`);
        
        // Track-specific audio
        audioStreamUrl = track.audio_url;
        if (!audioStreamUrl && track.audio_cid) {
          audioStreamUrl = `https://gateway.pinata.cloud/ipfs/${track.audio_cid}`;
        }
        embedTrackId = trackParam;
      } else {
        // Track not found, fall back to release-level
        ogTitle = `${escapeHtml(release.title || 'Untitled Release')} by ${artistName}`;
        ogDescription = escapeHtml(release.description || `Listen to "${release.title}" by ${artistName} on XRP Music`);
      }
    } else {
      // No track param — show release-level metadata
      ogTitle = `${escapeHtml(release.title || 'Untitled Release')} by ${artistName}`;
      ogDescription = escapeHtml(release.description || `Listen to "${release.title}" by ${artistName} on XRP Music`);
      
      // Fetch first track for audio
      const firstTrack = await sql`
        SELECT audio_url, audio_cid FROM tracks
        WHERE release_id = ${id}
        ORDER BY track_order ASC
        LIMIT 1
      `;
      if (firstTrack.length > 0) {
        audioStreamUrl = firstTrack[0].audio_url;
        if (!audioStreamUrl && firstTrack[0].audio_cid) {
          audioStreamUrl = `https://gateway.pinata.cloud/ipfs/${firstTrack[0].audio_cid}`;
        }
      }
    }
    
    const pageUrl = trackParam 
      ? `https://xrpmusic.io/release/${id}?track=${trackParam}`
      : `https://xrpmusic.io/release/${id}`;
    
    const hasAudio = !!audioStreamUrl;
    const embedPlayerUrl = trackParam
      ? `https://xrpmusic.io/api/embed/release?id=${id}&track=${trackParam}`
      : `https://xrpmusic.io/api/embed/release?id=${id}`;
    
    // Build redirect URL — preserve track param
    const redirectPath = trackParam
      ? `/release/${id}?track=${trackParam}`
      : `/release/${id}`;
    
    // Return HTML with Open Graph and Twitter Player Card tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${ogTitle} | XRP Music</title>
  <meta name="title" content="${ogTitle} | XRP Music">
  <meta name="description" content="${ogDescription}">
  
  <!-- Open Graph / Facebook / Discord -->
  <meta property="og:type" content="music.song">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${coverUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1200">
  <meta property="og:site_name" content="XRP Music">
  
  <!-- Twitter Card -->
  ${hasAudio ? `
  <!-- Twitter Player Card (for audio playback) -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:site" content="@xraboratories">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
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
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${coverUrl}">
  `}
  
  <!-- Music specific -->
  <meta property="music:musician" content="${artistName}">
  ${price > 0 ? `<meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="XRP">` : ''}
  
  <!-- Redirect to app with release context -->
  <script>window.location.replace('/app.html?redirect=${encodeURIComponent(redirectPath)}');</script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/app.html?redirect=${encodeURIComponent(redirectPath)}">
  </noscript>
</head>
<body>
  <p>Redirecting to XRP Music...</p>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
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
