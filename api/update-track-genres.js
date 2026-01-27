// /api/update-track-genres.js
// API endpoint for updating track genres (artist only)

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const { releaseId, tracks, artistAddress } = req.body;
    
    if (!releaseId || !tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: releaseId and tracks array' 
      });
    }
    
    // Verify the release exists and optionally check ownership
    const releaseCheck = await sql`
      SELECT id, artist_address FROM releases WHERE id = ${releaseId}
    `;
    
    if (releaseCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }
    
    // Optional: Verify artist ownership if artistAddress is provided
    if (artistAddress && releaseCheck.rows[0].artist_address !== artistAddress) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only edit genres for your own releases' 
      });
    }
    
    // Update each track's genre
    const updatePromises = tracks.map(async (track) => {
      if (!track.trackId) return null;
      
      // Update the track genre
      await sql`
        UPDATE tracks 
        SET genre = ${track.genre || null}
        WHERE id = ${track.trackId} AND release_id = ${releaseId}
      `;
      
      return track.trackId;
    });
    
    await Promise.all(updatePromises);
    
    // Also update the release's primary/secondary genre based on first track
    // (optional - helps with fallback logic)
    if (tracks.length > 0 && tracks[0].genre) {
      await sql`
        UPDATE releases 
        SET genre_primary = ${tracks[0].genre}
        WHERE id = ${releaseId}
      `;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Genres updated successfully',
      updatedTracks: tracks.length
    });
    
  } catch (error) {
    console.error('Update track genres API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update track genres',
      details: error.message
    });
  }
}
