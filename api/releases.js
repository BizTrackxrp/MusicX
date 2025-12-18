import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      const { artist } = req.query;
      
      let releases;
      
      if (artist) {
        releases = await sql`
          SELECT * FROM releases 
          WHERE artist_address = ${artist}
          ORDER BY created_at DESC
        `;
      } else {
        releases = await sql`
          SELECT * FROM releases 
          ORDER BY created_at DESC
        `;
      }
      
      // Get tracks for each release
      const formatted = await Promise.all(releases.map(async (row) => {
        const tracks = await sql`
          SELECT * FROM tracks WHERE release_id = ${row.id}
        `;
        
        return {
          id: row.id,
          artistAddress: row.artist_address,
          artistName: row.artist_name,
          title: row.title,
          type: row.type,
          coverUrl: row.cover_url,
          songPrice: parseFloat(row.song_price) || 0,
          albumPrice: row.album_price ? parseFloat(row.album_price) : null,
          totalEditions: row.total_editions,
          soldEditions: row.sold_editions,
          tracks: tracks.map(t => ({
            id: t.id,
            title: t.title,
            duration: t.duration,
            audioCid: t.audio_cid || t.audiocid || t.cid
          })),
          createdAt: row.created_at
        };
      }));
      
      return res.status(200).json({ releases: formatted });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Releases API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
