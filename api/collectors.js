import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  const { artist } = req.query;
  
  if (!artist) {
    return res.status(400).json({ success: false, error: 'Artist address required' });
  }
  
  try {
    // Get unique buyers of this artist's releases with their profile info and purchase count
    const collectors = await sql`
      SELECT 
        s.buyer_address as address,
        p.name,
        p.avatar_url,
        COUNT(s.id) as purchase_count
      FROM sales s
      JOIN releases r ON s.release_id = r.id
      LEFT JOIN profiles p ON s.buyer_address = p.address
      WHERE r.artist_address = ${artist}
        AND s.buyer_address != ${artist}
      GROUP BY s.buyer_address, p.name, p.avatar_url
      ORDER BY purchase_count DESC, MAX(s.created_at) DESC
      LIMIT 50
    `;
    
    return res.status(200).json({ 
      success: true, 
      collectors: collectors.map(c => ({
        ...c,
        purchase_count: parseInt(c.purchase_count)
      }))
    });
    
  } catch (error) {
    console.error('Get collectors error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
