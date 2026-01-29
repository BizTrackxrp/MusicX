// /api/genre-tracks.js
// API endpoint for fetching tracks by genre

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const { genre, limit = 50, offset = 0, countOnly, allCounts } = req.query;
    
    // Get counts for all genres
    if (allCounts === 'true') {
      // Use UNION to count both primary and secondary genres
      const result = await sql`
        SELECT genre, SUM(count) as count FROM (
          SELECT 
            COALESCE(t.genre, r.genre_primary, 'other') as genre,
            COUNT(DISTINCT t.id) as count
          FROM tracks t
          JOIN releases r ON t.release_id = r.id
          WHERE r.status = 'live' OR r.mint_fee_paid = true
          GROUP BY COALESCE(t.genre, r.genre_primary, 'other')
          
          UNION ALL
          
          SELECT 
            t.genre_secondary as genre,
            COUNT(DISTINCT t.id) as count
          FROM tracks t
          JOIN releases r ON t.release_id = r.id
          WHERE t.genre_secondary IS NOT NULL
            AND (r.status = 'live' OR r.mint_fee_paid = true)
          GROUP BY t.genre_secondary
        ) combined
        WHERE genre IS NOT NULL
        GROUP BY genre
        ORDER BY count DESC
      `;
      
      return res.status(200).json({
        success: true,
        genres: result.map(row => ({
          genre: row.genre,
          count: parseInt(row.count)
        }))
      });
    }
    
    // Get count for specific genre
    if (countOnly === 'true' && genre) {
      const result = await sql`
        SELECT COUNT(DISTINCT t.id) as count
        FROM tracks t
        JOIN releases r ON t.release_id = r.id
        WHERE (t.genre = ${genre} OR t.genre_secondary = ${genre} OR (t.genre IS NULL AND r.genre_primary = ${genre}))
          AND (r.status = 'live' OR r.mint_fee_paid = true)
      `;
      
      return res.status(200).json({
        success: true,
        count: parseInt(result[0]?.count || 0)
      });
    }
    
    // Get tracks for a specific genre
    if (!genre) {
      return res.status(400).json({ success: false, error: 'Genre parameter required' });
    }
    
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    
    const result = await sql`
      SELECT 
        t.id,
        t.title,
        t.duration,
        t.audio_cid as "audioCid",
        t.genre,
        t.genre_secondary as "genreSecondary",
        t.release_id as "releaseId",
        r.title as "releaseTitle",
        r.cover_url as "coverUrl",
        r.artist_address as "artistAddress",
        r.artist_name as "artistName",
        r.song_price as "price"
      FROM tracks t
      JOIN releases r ON t.release_id = r.id
      WHERE (t.genre = ${genre} OR t.genre_secondary = ${genre} OR (t.genre IS NULL AND r.genre_primary = ${genre}))
        AND (r.status = 'live' OR r.mint_fee_paid = true)
      ORDER BY r.created_at DESC, t.track_number ASC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `;
    
    return res.status(200).json({
      success: true,
      tracks: result
    });
    
  } catch (error) {
    console.error('Genre tracks API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch genre tracks',
      details: error.message
    });
  }
}
