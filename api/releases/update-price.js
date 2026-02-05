/**
 * API Route: /api/releases/update-price
 * Allows artists to update the price of their releases (per-track + album)
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const { releaseId, artistAddress, songPrice, albumPrice, trackPrices } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ success: false, error: 'Release ID is required' });
    }
    
    if (!artistAddress) {
      return res.status(400).json({ success: false, error: 'Artist address is required' });
    }
    
    // Verify ownership
    const release = await sql`
      SELECT id, artist_address, title, type, song_price, album_price
      FROM releases 
      WHERE id = ${releaseId}
    `;
    
    if (release.length === 0) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }
    
    if (release[0].artist_address.toLowerCase() !== artistAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You can only edit your own releases' });
    }
    
    // Update release prices
    if (songPrice !== undefined || albumPrice !== undefined) {
      await sql`
        UPDATE releases 
        SET 
          song_price = COALESCE(${songPrice}, song_price),
          album_price = COALESCE(${albumPrice}, album_price)
        WHERE id = ${releaseId}
      `;
    }
    
    // Update per-track prices
    if (trackPrices && trackPrices.length > 0) {
      for (const tp of trackPrices) {
        await sql`
          UPDATE tracks 
          SET price = ${tp.price}
          WHERE id = ${tp.trackId} AND release_id = ${releaseId}
        `;
      }
    }
    
    console.log(`✅ Prices updated for release ${releaseId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Prices updated successfully',
    });
    
  } catch (error) {
    console.error('Failed to update prices:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update prices' 
    });
  }
}
