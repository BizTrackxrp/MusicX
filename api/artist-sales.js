/**
 * XRP Music - Artist Sales API
 * 
 * Provides sales analytics for artists:
 * - Check if artist has any sales (for sidebar visibility)
 * - Get all sold tracks with buyer details
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { action, artist } = req.query;
  
  if (!artist) {
    return res.status(400).json({ error: 'Artist address required' });
  }
  
  try {
    // ACTION: check - Returns true/false if artist has any sales
    if (action === 'check') {
      const result = await sql`
        SELECT EXISTS (
          SELECT 1 FROM sales s
          JOIN releases r ON s.release_id = r.id
          WHERE r.artist_address = ${artist}
        ) as has_sales
      `;
      
      return res.json({ 
        hasSales: result[0]?.has_sales || false 
      });
    }
    
    // ACTION: tracks - Get all tracks with sales for this artist
    if (action === 'tracks') {
      const tracks = await sql`
        SELECT 
          t.id as track_id,
          t.title as track_title,
          r.id as release_id,
          r.title as release_title,
          r.cover_url,
          r.type as release_type,
          COUNT(s.id) as copies_sold
        FROM tracks t
        JOIN releases r ON t.release_id = r.id
        JOIN sales s ON s.track_id = t.id
        WHERE r.artist_address = ${artist}
        GROUP BY t.id, t.title, r.id, r.title, r.cover_url, r.type
        ORDER BY copies_sold DESC, t.title ASC
      `;
      
      return res.json({ tracks });
    }
    
    // ACTION: buyers - Get buyers for a specific track (grouped by buyer)
    if (action === 'buyers') {
      const { trackId } = req.query;
      
      if (!trackId) {
        return res.status(400).json({ error: 'Track ID required' });
      }
      
      // Verify this track belongs to the artist
      const trackCheck = await sql`
        SELECT t.id FROM tracks t
        JOIN releases r ON t.release_id = r.id
        WHERE t.id = ${trackId} AND r.artist_address = ${artist}
      `;
      
      if (trackCheck.length === 0) {
        return res.status(403).json({ error: 'Track not found or not owned by artist' });
      }
      
      // Group by buyer and count copies they bought
      const buyers = await sql`
        SELECT 
          s.buyer_address,
          p.name as profile_name,
          p.avatar_url,
          COUNT(s.id) as copies_bought,
          MIN(s.created_at) as first_purchase,
          MAX(s.created_at) as last_purchase
        FROM sales s
        LEFT JOIN profiles p ON s.buyer_address = p.wallet_address
        WHERE s.track_id = ${trackId}
        GROUP BY s.buyer_address, p.name, p.avatar_url
        ORDER BY copies_bought DESC, first_purchase ASC
      `;
      
      return res.json({ buyers });
    }
    
    // Default: return summary stats
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sales,
        COUNT(DISTINCT s.buyer_address) as unique_buyers,
        COUNT(DISTINCT t.id) as tracks_with_sales
      FROM sales s
      JOIN releases r ON s.release_id = r.id
      JOIN tracks t ON s.track_id = t.id
      WHERE r.artist_address = ${artist}
    `;
    
    return res.json({ 
      stats: stats[0] || { total_sales: 0, unique_buyers: 0, tracks_with_sales: 0 }
    });
    
  } catch (error) {
    console.error('Artist sales API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch sales data' });
  }
}
