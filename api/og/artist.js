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
    const displayName = profile.name || `${address.slice(0, 6)}...${address.slice(-4)}`;
    const bio = profile.bio || `Check out ${displayName}'s music on XRP Music`;
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
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${displayName} on XRP Music">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${bannerUrl || avatarUrl}">
  
  <!-- Profile specific -->
  <meta property="profile:username" content="${displayName}">
  ${releaseCount > 0 ? `<meta name="music:release_count" content="${releaseCount}">` : ''}
  
  <!-- Redirect to app -->
  <meta http-equiv="refresh" content="0;url=/app.html">
  <script>window.location.href = '/app.html';</script>
</head>
<body>
  <p>Loading ${displayName}'s profile...</p>
  <p><a href="/app.html">Click here if not redirected</a></p>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('OG Artist error:', error);
    return res.redirect('/app.html');
  }
}
