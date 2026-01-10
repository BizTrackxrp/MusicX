/**
 * XRP Music - Playlists API
 * /api/playlists
 * 
 * Handles playlist CRUD, track management, and playlist likes
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - Fetch playlists
    if (req.method === 'GET') {
      const { id, user, public: isPublic, sort, withTracks, checkLiked } = req.query;
      
      // Get single playlist by ID
      if (id) {
        const playlists = await sql`
          SELECT 
            p.*,
            pr.name as owner_name,
            pr.avatar_url as owner_avatar,
            (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
            (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.id) as like_count
          FROM playlists p
          LEFT JOIN profiles pr ON p.owner_address = pr.address
          WHERE p.id = ${id}
        `;
        
        if (playlists.length === 0) {
          return res.status(404).json({ success: false, error: 'Playlist not found' });
        }
        
        const playlist = playlists[0];
        
        // Check if user has liked this playlist
        if (checkLiked) {
          const liked = await sql`
            SELECT id FROM playlist_likes 
            WHERE playlist_id = ${id} AND user_address = ${checkLiked}
            LIMIT 1
          `;
          playlist.isLiked = liked.length > 0;
        }
        
        // Get tracks if requested (default to true for single playlist fetch)
        if (withTracks !== 'false') {
          const tracks = await sql`
            SELECT 
              pt.id as playlist_track_id,
              pt.position,
              pt.added_at,
              t.id as track_id,
              t.title,
              t.duration,
              t.audio_cid,
              t.audio_url,
              r.id as release_id,
              r.title as release_title,
              r.cover_url,
              r.artist_name,
              r.artist_address,
              r.type as release_type
            FROM playlist_tracks pt
            JOIN tracks t ON pt.track_id = t.id
            JOIN releases r ON pt.release_id = r.id
            WHERE pt.playlist_id = ${id}
            ORDER BY pt.position ASC
          `;
          playlist.tracks = tracks;
        }
        
        return res.json({ success: true, playlist });
      }
      
      // Get user's playlists
      if (user) {
        const playlists = await sql`
          SELECT 
            p.*,
            (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
            (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.id) as like_count
          FROM playlists p
          WHERE p.owner_address = ${user}
          ORDER BY p.is_system DESC, p.created_at DESC
        `;
        
        // Get track covers for each playlist (first 4)
        for (const playlist of playlists) {
          const covers = await sql`
            SELECT DISTINCT r.cover_url
            FROM playlist_tracks pt
            JOIN releases r ON pt.release_id = r.id
            WHERE pt.playlist_id = ${playlist.id}
            ORDER BY pt.position ASC
            LIMIT 4
          `;
          playlist.track_covers = covers.map(c => c.cover_url).filter(Boolean);
        }
        
        return res.json({ success: true, playlists });
      }
      
      // Get public playlists (for discovery/browse)
      if (isPublic === 'true') {
        const playlists = await sql`
          SELECT 
            p.*,
            pr.name as owner_name,
            pr.avatar_url as owner_avatar,
            (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
            (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.id) as like_count
          FROM playlists p
          LEFT JOIN profiles pr ON p.owner_address = pr.address
          WHERE p.is_public = true AND p.is_system = false
          ORDER BY ${sort === 'popular' ? sql`like_count DESC` : sql`p.created_at DESC`}
          LIMIT 50
        `;
        
        // Get track covers for each playlist (first 4)
        for (const playlist of playlists) {
          const covers = await sql`
            SELECT DISTINCT r.cover_url
            FROM playlist_tracks pt
            JOIN releases r ON pt.release_id = r.id
            WHERE pt.playlist_id = ${playlist.id}
            ORDER BY pt.position ASC
            LIMIT 4
          `;
          playlist.track_covers = covers.map(c => c.cover_url).filter(Boolean);
        }
        
        return res.json({ success: true, playlists });
      }
      
      return res.status(400).json({ success: false, error: 'Provide id, user, or public=true' });
    }
    
    // POST - Create playlist or manage tracks/likes
    if (req.method === 'POST') {
      const { action, name, ownerAddress, playlistId, trackId, releaseId, playlistTrackId, trackIds, userAddress } = req.body;
      
      // Create new playlist
      if (action === 'create') {
        if (!name || !ownerAddress) {
          return res.status(400).json({ success: false, error: 'Name and owner address required' });
        }
        
        const id = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await sql`
          INSERT INTO playlists (id, name, owner_address, is_public, is_system, created_at, updated_at)
          VALUES (${id}, ${name}, ${ownerAddress}, false, false, NOW(), NOW())
        `;
        
        return res.json({ success: true, playlistId: id });
      }
      
      // Add track to playlist
      if (action === 'addTrack') {
        if (!playlistId || !ownerAddress || !trackId || !releaseId) {
          return res.status(400).json({ success: false, error: 'Playlist ID, owner, track ID, and release ID required' });
        }
        
        // Verify ownership
        const playlist = await sql`
          SELECT id FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
        `;
        if (playlist.length === 0) {
          return res.status(403).json({ success: false, error: 'Not authorized to modify this playlist' });
        }
        
        // Check if track already in playlist
        const existing = await sql`
          SELECT id FROM playlist_tracks 
          WHERE playlist_id = ${playlistId} AND track_id = ${trackId}
        `;
        if (existing.length > 0) {
          return res.json({ success: true, message: 'Track already in playlist' });
        }
        
        // Get next position
        const maxPos = await sql`
          SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_tracks WHERE playlist_id = ${playlistId}
        `;
        const nextPosition = (maxPos[0]?.max_pos || 0) + 1;
        
        const id = `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await sql`
          INSERT INTO playlist_tracks (id, playlist_id, track_id, release_id, position, added_at)
          VALUES (${id}, ${playlistId}, ${trackId}, ${releaseId}, ${nextPosition}, NOW())
        `;
        
        // Update playlist updated_at
        await sql`UPDATE playlists SET updated_at = NOW() WHERE id = ${playlistId}`;
        
        return res.json({ success: true, playlistTrackId: id });
      }
      
      // Remove track from playlist
      if (action === 'removeTrack') {
        // Support both playlistTrackId and trackId for removal
        if (!playlistId || !ownerAddress || (!playlistTrackId && !trackId)) {
          return res.status(400).json({ success: false, error: 'Playlist ID, owner, and track identifier required' });
        }
        
        // Verify ownership
        const playlist = await sql`
          SELECT id, is_system FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
        `;
        if (playlist.length === 0) {
          return res.status(403).json({ success: false, error: 'Not authorized to modify this playlist' });
        }
        
        // Delete by playlistTrackId or trackId
        if (playlistTrackId) {
          await sql`
            DELETE FROM playlist_tracks WHERE id = ${playlistTrackId} AND playlist_id = ${playlistId}
          `;
        } else if (trackId) {
          await sql`
            DELETE FROM playlist_tracks WHERE track_id = ${trackId} AND playlist_id = ${playlistId}
          `;
        }
        
        // Update playlist updated_at
        await sql`UPDATE playlists SET updated_at = NOW() WHERE id = ${playlistId}`;
        
        return res.json({ success: true });
      }
      
      // Reorder tracks
      if (action === 'reorder') {
        if (!playlistId || !ownerAddress || !trackIds || !Array.isArray(trackIds)) {
          return res.status(400).json({ success: false, error: 'Playlist ID, owner, and track IDs array required' });
        }
        
        // Verify ownership
        const playlist = await sql`
          SELECT id FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
        `;
        if (playlist.length === 0) {
          return res.status(403).json({ success: false, error: 'Not authorized to modify this playlist' });
        }
        
        // Update positions
        for (let i = 0; i < trackIds.length; i++) {
          await sql`
            UPDATE playlist_tracks SET position = ${i + 1}
            WHERE id = ${trackIds[i]} AND playlist_id = ${playlistId}
          `;
        }
        
        return res.json({ success: true });
      }
      
      // Like playlist
      if (action === 'like') {
        if (!playlistId || !userAddress) {
          return res.status(400).json({ success: false, error: 'Playlist ID and user address required' });
        }
        
        const existing = await sql`
          SELECT id FROM playlist_likes WHERE playlist_id = ${playlistId} AND user_address = ${userAddress}
        `;
        if (existing.length > 0) {
          return res.json({ success: true, message: 'Already liked' });
        }
        
        const id = `plike_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO playlist_likes (id, playlist_id, user_address, created_at)
          VALUES (${id}, ${playlistId}, ${userAddress}, NOW())
        `;
        
        return res.json({ success: true });
      }
      
      // Unlike playlist
      if (action === 'unlike') {
        if (!playlistId || !userAddress) {
          return res.status(400).json({ success: false, error: 'Playlist ID and user address required' });
        }
        
        await sql`
          DELETE FROM playlist_likes WHERE playlist_id = ${playlistId} AND user_address = ${userAddress}
        `;
        
        return res.json({ success: true });
      }
      
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    // PUT - Update playlist metadata
    if (req.method === 'PUT') {
      const { playlistId, ownerAddress, name, description, isPublic, coverUrl } = req.body;
      
      if (!playlistId || !ownerAddress) {
        return res.status(400).json({ success: false, error: 'Playlist ID and owner address required' });
      }
      
      // Verify ownership and not system playlist
      const playlist = await sql`
        SELECT id, is_system FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
      `;
      if (playlist.length === 0) {
        return res.status(403).json({ success: false, error: 'Not authorized to modify this playlist' });
      }
      if (playlist[0].is_system) {
        return res.status(403).json({ success: false, error: 'Cannot modify system playlists' });
      }
      
      // Build update
      if (name !== undefined) {
        await sql`UPDATE playlists SET name = ${name}, updated_at = NOW() WHERE id = ${playlistId}`;
      }
      if (description !== undefined) {
        await sql`UPDATE playlists SET description = ${description}, updated_at = NOW() WHERE id = ${playlistId}`;
      }
      if (isPublic !== undefined) {
        await sql`UPDATE playlists SET is_public = ${isPublic}, updated_at = NOW() WHERE id = ${playlistId}`;
      }
      if (coverUrl !== undefined) {
        await sql`UPDATE playlists SET cover_url = ${coverUrl}, updated_at = NOW() WHERE id = ${playlistId}`;
      }
      
      return res.json({ success: true });
    }
    
    // DELETE - Delete playlist
    if (req.method === 'DELETE') {
      const { id, owner } = req.query;
      
      if (!id || !owner) {
        return res.status(400).json({ success: false, error: 'Playlist ID and owner required' });
      }
      
      // Verify ownership and not system playlist
      const playlist = await sql`
        SELECT id, is_system FROM playlists WHERE id = ${id} AND owner_address = ${owner}
      `;
      if (playlist.length === 0) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this playlist' });
      }
      if (playlist[0].is_system) {
        return res.status(403).json({ success: false, error: 'Cannot delete system playlists' });
      }
      
      // Delete tracks first
      await sql`DELETE FROM playlist_tracks WHERE playlist_id = ${id}`;
      // Delete likes
      await sql`DELETE FROM playlist_likes WHERE playlist_id = ${id}`;
      // Delete playlist
      await sql`DELETE FROM playlists WHERE id = ${id}`;
      
      return res.json({ success: true });
    }
    
    return res.status(405).json({ success: false, error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Playlists API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
