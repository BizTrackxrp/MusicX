/**
 * XRP Music - Diagnose Edition Counts
 * Shows what's actually in the database vs what should be displayed
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Get all releases with their tracks and NFT counts
    const releases = await sql`
      SELECT 
        r.id as release_id,
        r.title as release_title,
        r.artist_name,
        r.total_editions,
        r.sold_editions,
        t.id as track_id,
        t.title as track_title,
        t.sold_count,
        (SELECT COUNT(*) FROM nfts WHERE track_id = t.id) as total_nfts,
        (SELECT COUNT(*) FROM nfts WHERE track_id = t.id AND status = 'available') as available_nfts,
        (SELECT COUNT(*) FROM nfts WHERE track_id = t.id AND status = 'sold') as sold_nfts,
        (SELECT COUNT(*) FROM nfts WHERE track_id = t.id AND status = 'pending') as pending_nfts,
        (SELECT COUNT(*) FROM sales WHERE track_id = t.id) as sales_count
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      ORDER BY r.title, t.title
    `;
    
    // Format for easy reading
    const formatted = releases.map(r => ({
      release: r.release_title,
      artist: r.artist_name,
      track: r.track_title,
      display: {
        total_editions: r.total_editions,
        sold_editions: r.sold_editions,
        track_sold_count: r.sold_count,
        should_show_left: r.total_editions - r.sold_editions,
      },
      actual: {
        total_nfts: r.total_nfts,
        available: r.available_nfts,
        sold: r.sold_nfts,
        pending: r.pending_nfts,
        sales_records: r.sales_count,
      },
      mismatch: r.sold_count != r.sold_nfts || r.sold_editions != r.sold_nfts,
    }));
    
    return res.json({
      success: true,
      data: formatted,
      summary: {
        total_releases: [...new Set(releases.map(r => r.release_id))].length,
        total_tracks: releases.length,
        mismatches: formatted.filter(f => f.mismatch).length,
      }
    });
    
  } catch (error) {
    console.error('Diagnose error:', error);
    return res.status(500).json({ error: error.message });
  }
}
