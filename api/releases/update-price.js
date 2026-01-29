/**
 * API Route: /api/releases/update-price
 * Allows artists to update the price of their releases
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const { releaseId, artistAddress, newPrice } = req.body;
    
    // Validate inputs
    if (!releaseId) {
      return res.status(400).json({ success: false, error: 'Release ID is required' });
    }
    
    if (!artistAddress) {
      return res.status(400).json({ success: false, error: 'Artist address is required' });
    }
    
    if (!newPrice || newPrice <= 0) {
      return res.status(400).json({ success: false, error: 'Valid price is required' });
    }
    
    // Verify the release exists and belongs to this artist
    const release = await sql`
      SELECT id, artist_address, title, type, song_price
      FROM releases 
      WHERE id = ${releaseId}
    `;
    
    if (release.length === 0) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }
    
    // Check ownership
    if (release[0].artist_address.toLowerCase() !== artistAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You can only edit your own releases' });
    }
    
    const oldPrice = release[0].song_price;
    
    // Get track count for album price calculation
    const tracks = await sql`
      SELECT COUNT(*) as count FROM tracks WHERE release_id = ${releaseId}
    `;
    const trackCount = parseInt(tracks[0]?.count) || 1;
    
    // Calculate new album price (if applicable)
    const newAlbumPrice = release[0].type !== 'single' ? newPrice * trackCount : null;
    
    // Update the price
    await sql`
      UPDATE releases 
      SET 
        song_price = ${newPrice},
        album_price = ${newAlbumPrice},
      WHERE id = ${releaseId}
    `;
    
    console.log(`✅ Price updated for release ${releaseId}: ${oldPrice} → ${newPrice} XRP`);
    
    return res.status(200).json({
      success: true,
      message: 'Price updated successfully',
      oldPrice: oldPrice,
      newPrice: newPrice,
      newAlbumPrice: newAlbumPrice,
    });
    
  } catch (error) {
    console.error('Failed to update price:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update price' 
    });
  }
}
