// /api/get-track-genres.js
// API endpoint for fetching track genres for a release

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
    const { releaseId } = req.query;
    
    if (!releaseId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing releaseId parameter' 
      });
    }
    
    // Get all tracks with their genres for this release
    const tracks = await sql`
      SELECT id, title, genre, genre_secondary
      FROM tracks 
      WHERE release_id = ${releaseId}
      ORDER BY track_number ASC
    `;
    
    return res.status(200).json({
      success: true,
      tracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        genre: t.genre || null,
        genreSecondary: t.genre_secondary || null
      }))
    });
    
  } catch (error) {
    console.error('Get track genres API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch track genres',
      details: error.message
    });
  }
}
