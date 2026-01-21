/**
 * XRP Music - Open Graph Tags for Artist Pages
 * Returns HTML with meta tags for social media previews
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  const { address } = req.query;
  
  if (!address) {
    return res.redirect('/app.html');
  }
  
  try {
    // Fetch profile data
    const profiles = await sql`
      SELECT * FROM profiles WHERE wallet_address = ${address}
    `;
    
    // Count releases
    const releaseCounts = await sql`
      SELECT COUNT(*) as count FROM releases 
      WHERE artist_address = ${address}
        AND (is_minted = true OR mint_fee_paid = true OR status = 'live')
    `;
    
    const profile = profiles[0] || {};
    const displayName = escapeHtml(profile.name || `${address.slice(0, 6)}...${address.slice(-4)}`);
    const bio = escapeHtml(profile.bio || `Check out ${displayName}'s music on XRP Music`);
    const avatarUrl = profile.avatar_url || 'https://xrpmusic.io/og-default.png';
    const bannerUrl = profile.banner_url || avatarUrl;
    const pageUrl = `https://xrpmusic.io/artist/${address}`;
    const releaseCount = parseInt(releaseCounts[0]?.count) || 0;
    
    const description = bio.length > 160 ? bio.substring(0, 157) + '...' : bio;
    
    // Return HTML with Open Graph tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${displayName} | XRP Music</title>
  <meta name="title" content="${displayName} | XRP Music">
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${displayName} on XRP Music">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${bannerUrl || avatarUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="XRP Music">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@xraboratories">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${displayName} on XRP Music">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${bannerUrl || avatarUrl}">
  
  <!-- Profile specific -->
  <meta property="profile:username" content="${displayName}">
  ${releaseCount > 0 ? `<meta name="music:release_count" content="${releaseCount}">` : ''}
  
  <!-- Redirect to app with artist context -->
  <script>window.location.replace('/app.html?redirect=/artist/${address}');</script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/app.html?redirect=/artist/${address}">
  </noscript>
</head>
<body style="font-family: system-ui, sans-serif; background: #0a0a0a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 20px;">
    <img src="${avatarUrl}" alt="${displayName}" style="width: 150px; height: 150px; border-radius: 50%; margin-bottom: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
    <h1 style="font-size: 24px; margin-bottom: 8px;">${displayName}</h1>
    <p style="color: #888; margin-bottom: 20px;">${releaseCount} release${releaseCount !== 1 ? 's' : ''}</p>
    <a href="/app.html?redirect=/artist/${address}" style="display: inline-block; padding: 12px 32px; background: #22c55e; color: white; text-decoration: none; border-radius: 24px; font-weight: 600;">View on XRP Music</a>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('OG Artist error:', error);
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
