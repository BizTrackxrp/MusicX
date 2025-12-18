/**
 * XRP Music - Likes API
 * Vercel Serverless Function
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      return await getLikes(req, res);
    } else if (req.method === 'POST') {
      return await toggleLike(req, res);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Likes API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getLikes(req, res) {
  const { user, trackId, ids } = req.query;
  
  if (!user) {
    return res.status(400).json({ error: 'User address required' });
  }
  
  // Check if specific track is liked
  if (trackId) {
    const likes = await sql`
      SELECT id FROM likes 
      WHERE user_address = ${user} AND track_id = ${trackId}
    `;
    return res.json({ isLiked: likes.length > 0 });
  }
  
  // Return just IDs
  if (ids === 'true') {
    const likes = await sql`
      SELECT track_id FROM likes WHERE user_address = ${user}
    `;
    return res.json({ trackIds: likes.map(l => l.track_id) });
  }
  
  // Return full tracks with details
  const tracks = await sql`
    SELECT 
      t.id,
      t.title,
      t.duration,
      t.audio_cid as "audioCid",
      t.audio_url as "audioUrl",
      r.id as "releaseId",
      r.title as "releaseTitle",
      r.cover_url as "coverUrl",
      r.artist_address as "artistAddress",
      r.artist_name as "artistName",
      l.created_at as "likedAt"
    FROM likes l
    JOIN tracks t ON t.id = l.track_id
    JOIN releases r ON r.id = t.release_id
    WHERE l.user_address = ${user}
    ORDER BY l.created_at DESC
  `;
  
  return res.json({ tracks });
}

async function toggleLike(req, res) {
  const { action, userAddress, trackId, releaseId } = req.body;
  
  if (!userAddress || !trackId) {
    return res.status(400).json({ error: 'User address and track ID required' });
  }
  
  if (action === 'like') {
    // Check if already liked
    const existing = await sql`
      SELECT id FROM likes 
      WHERE user_address = ${userAddress} AND track_id = ${trackId}
    `;
    
    if (existing.length === 0) {
      await sql`
        INSERT INTO likes (user_address, track_id, release_id, created_at)
        VALUES (${userAddress}, ${trackId}, ${releaseId || null}, NOW())
      `;
    }
    
    return res.json({ success: true, isLiked: true });
  } else if (action === 'unlike') {
    await sql`
      DELETE FROM likes 
      WHERE user_address = ${userAddress} AND track_id = ${trackId}
    `;
    
    return res.json({ success: true, isLiked: false });
  }
  
  return res.status(400).json({ error: 'Invalid action' });
}
