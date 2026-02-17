/**
 * API Route: /api/releases/update-video
 * Allows artists to add or update a music video on their tracks
 * 
 * The video CID is stored at the platform level (tracks table),
 * NOT baked into the NFT on-chain. So it can be added/changed anytime.
 * 
 * Actions:
 *   'update' (default) - Set video_cid on a track
 *   'remove' - Remove video from a track
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const { action, releaseId, trackId, artistAddress, videoCid } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ success: false, error: 'Release ID is required' });
    }
    
    if (!artistAddress) {
      return res.status(400).json({ success: false, error: 'Artist address is required' });
    }
    
    // Verify ownership
    const releases = await sql`
      SELECT id, artist_address, title, type
      FROM releases 
      WHERE id = ${releaseId}
    `;
    
    if (releases.length === 0) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }
    
    if (releases[0].artist_address.toLowerCase() !== artistAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You can only edit your own releases' });
    }
    
    // If no trackId specified, get the first track of the release
    let targetTrackId = trackId;
    if (!targetTrackId) {
      const tracks = await sql`
        SELECT id FROM tracks 
        WHERE release_id = ${releaseId} 
        ORDER BY track_number ASC 
        LIMIT 1
      `;
      if (tracks.length === 0) {
        return res.status(400).json({ success: false, error: 'Release has no tracks' });
      }
      targetTrackId = tracks[0].id;
    }
    
    // Verify track belongs to release
    const trackCheck = await sql`
      SELECT id, title, video_cid FROM tracks 
      WHERE id = ${targetTrackId} AND release_id = ${releaseId}
    `;
    
    if (trackCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Track not found in this release' });
    }
    
    if (action === 'remove') {
      // Remove video
      await sql`
        UPDATE tracks 
        SET video_cid = NULL
        WHERE id = ${targetTrackId} AND release_id = ${releaseId}
      `;
      
      console.log(`✅ Video removed from track ${targetTrackId} (${trackCheck[0].title})`);
      
      return res.status(200).json({
        success: true,
        message: 'Video removed',
        trackId: targetTrackId,
        trackTitle: trackCheck[0].title,
      });
    }
    
    // Default: update video
    if (!videoCid) {
      return res.status(400).json({ success: false, error: 'Video CID is required' });
    }
    
    // Basic CID validation
    if (!videoCid.startsWith('Qm') && !videoCid.startsWith('bafy')) {
      return res.status(400).json({ success: false, error: 'Invalid IPFS CID format' });
    }
    
    // Update the track with the new video CID
    await sql`
      UPDATE tracks 
      SET video_cid = ${videoCid}
      WHERE id = ${targetTrackId} AND release_id = ${releaseId}
    `;
    
    const videoUrl = `https://gateway.lighthouse.storage/ipfs/${videoCid}`;
    
    console.log(`✅ Video added to track ${targetTrackId} (${trackCheck[0].title}): ${videoCid}`);
    
    return res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      trackId: targetTrackId,
      trackTitle: trackCheck[0].title,
      videoCid,
      videoUrl,
    });
    
  } catch (error) {
    console.error('Failed to update video:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update video' 
    });
  }
}
