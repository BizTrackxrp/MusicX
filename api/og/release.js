/**
 * XRP Music - Open Graph Tags for Release Pages
 * Returns HTML with meta tags for social media previews
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  const { id } = req.query;
  
  if (!id) {
    return res.redirect('/app.html');
  }
  
  try {
    // Fetch release data
    const releases = await sql`
      SELECT r.*, p.name as profile_name
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE r.id = ${id}
    `;
    
    if (releases.length === 0) {
      // Release not found, redirect to app anyway
      return res.redirect('/app.html');
    }
    
    const release = releases[0];
    const title = release.title || 'Untitled Release';
    const artistName = release.artist_name || release.profile_name || 'Unknown Artist';
    const description = release.description || `Listen to "${title}" by ${artistName} on XRP Music`;
    const coverUrl = release.cover_url || 'https://xrpmusic.io/og-default.png';
    const pageUrl = `https://xrpmusic.io/release/${id}`;
    const price = parseFloat(release.song_price) || 0;
    
    // Return HTML with Open Graph tags
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
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title} by ${artistName}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${coverUrl}">
  
  <!-- Music specific -->
  <meta property="music:musician" content="${artistName}">
  ${price > 0 ? `<meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="XRP">` : ''}
  
  <!-- Redirect to app -->
  <meta http-equiv="refresh" content="0;url=/app.html#/release/${id}">
  <script>window.location.href = '/app.html';</script>
</head>
<body>
  <p>Loading ${title} by ${artistName}...</p>
  <p><a href="/app.html">Click here if not redirected</a></p>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('OG Release error:', error);
    return res.redirect('/app.html');
  }
}
