/**
 * XRP Music - Likes API
 * /api/likes
 * 
 * Handles track likes for users
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - Fetch liked tracks or check if track is liked
    if (req.method === 'GET') {
      const { user, trackId, ids } = req.query;
      
      if (!user) {
        return res.status(400).json({ error: 'User address required' });
      }
      
      // Check if specific track is liked
      if (trackId) {
        const result = await sql`
          SELECT id FROM likes 
          WHERE user_address = ${user} AND track_id = ${trackId}
          LIMIT 1
        `;
        return res.json({ isLiked: result.length > 0 });
      }
      
      // Return just IDs for quick lookup
      if (ids === 'true') {
        const result = await sql`
          SELECT track_id FROM likes 
          WHERE user_address = ${user}
          ORDER BY created_at DESC
        `;
        return res.json({ trackIds: result.map(r => r.track_id) });
      }
      
      // Return full track data for liked tracks
      const tracks = await sql`
        SELECT 
          l.id as like_id,
          l.track_id,
          l.release_id,
          l.created_at as liked_at,
          t.title,
          t.duration,
          t.audio_cid,
          t.audio_url,
          r.title as release_title,
          r.cover_url,
          r.artist_name,
          r.artist_address,
          r.type as release_type
        FROM likes l
        JOIN tracks t ON l.track_id = t.id
        JOIN releases r ON l.release_id = r.id
        WHERE l.user_address = ${user}
        ORDER BY l.created_at DESC
      `;
      
      return res.json({ tracks });
    }
    
    // POST - Like or unlike a track
    if (req.method === 'POST') {
      const { action, userAddress, trackId, releaseId } = req.body;
      
      if (!userAddress || !trackId) {
        return res.status(400).json({ error: 'User address and track ID required' });
      }
      
      if (action === 'like') {
        if (!releaseId) {
          return res.status(400).json({ error: 'Release ID required for liking' });
        }
        
        // Check if already liked
        const existing = await sql`
          SELECT id FROM likes 
          WHERE user_address = ${userAddress} AND track_id = ${trackId}
          LIMIT 1
        `;
        
        if (existing.length > 0) {
          return res.json({ success: true, message: 'Already liked' });
        }
        
        // Create like
        const likeId = `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await sql`
          INSERT INTO likes (id, user_address, track_id, release_id, created_at)
          VALUES (${likeId}, ${userAddress}, ${trackId}, ${releaseId}, NOW())
        `;
        
        return res.json({ success: true, likeId });
      }
      
      if (action === 'unlike') {
        await sql`
          DELETE FROM likes 
          WHERE user_address = ${userAddress} AND track_id = ${trackId}
        `;
        
        return res.json({ success: true });
      }
      
      return res.status(400).json({ error: 'Invalid action. Use "like" or "unlike"' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Likes API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
