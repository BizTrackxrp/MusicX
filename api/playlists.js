/**
 * XRP Music - Playlists API
 * Vercel Serverless Function
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { user, action } = req.query;
    
    if (req.method === 'GET') {
      // Get user's playlists
      if (!user) {
        return res.status(400).json({ error: 'User address required' });
      }
      
      const playlists = await sql`
        SELECT * FROM playlists 
        WHERE owner_address = ${user}
        ORDER BY created_at DESC
      `;
      
      return res.json({ playlists: playlists.map(formatPlaylist) });
      
    } else if (req.method === 'POST') {
      const { name, ownerAddress, action: bodyAction, playlistId, trackId } = req.body;
      
      // Create new playlist
      if (bodyAction === 'create' || (!bodyAction && name)) {
        if (!name || !ownerAddress) {
          return res.status(400).json({ error: 'Name and owner address required' });
        }
        
        const [playlist] = await sql`
          INSERT INTO playlists (name, owner_address, track_ids, created_at)
          VALUES (${name}, ${ownerAddress}, '[]', NOW())
          RETURNING *
        `;
        
        return res.json({ success: true, playlist: formatPlaylist(playlist) });
      }
      
      // Add track to playlist
      if (bodyAction === 'addTrack') {
        if (!playlistId || !trackId) {
          return res.status(400).json({ error: 'Playlist ID and track ID required' });
        }
        
        await sql`
          UPDATE playlists 
          SET track_ids = track_ids || ${JSON.stringify([trackId])}::jsonb
          WHERE id = ${playlistId}
        `;
        
        return res.json({ success: true });
      }
      
      // Remove track from playlist
      if (bodyAction === 'removeTrack') {
        if (!playlistId || !trackId) {
          return res.status(400).json({ error: 'Playlist ID and track ID required' });
        }
        
        await sql`
          UPDATE playlists 
          SET track_ids = track_ids - ${trackId}
          WHERE id = ${playlistId}
        `;
        
        return res.json({ success: true });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
      
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Playlist ID required' });
      }
      
      await sql`DELETE FROM playlists WHERE id = ${id}`;
      
      return res.json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Playlists API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function formatPlaylist(row) {
  return {
    id: row.id,
    name: row.name,
    ownerAddress: row.owner_address,
    trackIds: row.track_ids || [],
    createdAt: row.created_at,
  };
}
