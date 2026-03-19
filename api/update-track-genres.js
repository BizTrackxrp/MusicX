// /api/update-track-genres.js
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  
  try {
    const { releaseId, tracks, artistAddress, draftGenres } = req.body;
    
    if (!releaseId || !tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: releaseId and tracks array' 
      });
    }
    
    const releaseCheck = await sql`
      SELECT id, artist_address FROM releases WHERE id = ${releaseId}
    `;
    
    if (releaseCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Release not found' });
    }
    
    if (artistAddress && releaseCheck[0].artist_address !== artistAddress) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only edit genres for your own releases' 
      });
    }
    
    // Update each track's genre columns
    for (const track of tracks) {
      if (!track.trackId) continue;
      await sql`
        UPDATE tracks 
        SET genre = ${track.genre || null},
            genre_secondary = ${track.genreSecondary || null},
            genre_tertiary = ${track.genreTertiary || null}
        WHERE id = ${track.trackId} AND release_id = ${releaseId}
      `;
    }
    
    // Update release-level genre fields
    const primaryGenre = draftGenres?.[0] || tracks[0]?.genre || null;
    const genresJson = draftGenres && draftGenres.length > 0 
      ? JSON.stringify(draftGenres) 
      : JSON.stringify(tracks.slice(0, 3).map(t => t.genre).filter(Boolean));

    await sql`
      UPDATE releases 
      SET genre_primary = ${primaryGenre},
          draft_genres = ${genresJson}::jsonb
      WHERE id = ${releaseId}
    `;
    
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
