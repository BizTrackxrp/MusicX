/**
 * XRP Music - Fix Sales Counters
 * Syncs sold_count on tracks and sold_editions on releases
 * with actual sales records in the database
 * 
 * Run: GET /api/fix-sales-counters
 * Or with specific release: GET /api/fix-sales-counters?releaseId=xxx
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
  
  try {
    const { releaseId } = req.query;
    const fixes = [];
    
    // Get all tracks (or just for specific release)
    let tracks;
    if (releaseId) {
      tracks = await sql`
        SELECT t.id, t.title, t.sold_count, t.release_id, r.title as release_title
        FROM tracks t
        JOIN releases r ON r.id = t.release_id
        WHERE t.release_id = ${releaseId}
      `;
    } else {
      tracks = await sql`
        SELECT t.id, t.title, t.sold_count, t.release_id, r.title as release_title
        FROM tracks t
        JOIN releases r ON r.id = t.release_id
      `;
    }
    
    console.log(`📊 Checking ${tracks.length} tracks...`);
    
    // Fix each track's sold_count based on actual sales
    for (const track of tracks) {
      const salesResult = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
      `;
      const actualSales = parseInt(salesResult[0]?.count) || 0;
      const currentCount = track.sold_count || 0;
      
      if (actualSales !== currentCount) {
        console.log(`🔧 Fixing track "${track.title}": ${currentCount} → ${actualSales}`);
        
        await sql`
          UPDATE tracks SET sold_count = ${actualSales} WHERE id = ${track.id}
        `;
        
        fixes.push({
          type: 'track',
          id: track.id,
          title: track.title,
          releaseTitle: track.release_title,
          was: currentCount,
          now: actualSales,
        });
      }
    }
    
    // Now fix release sold_editions
    let releases;
    if (releaseId) {
      releases = await sql`SELECT * FROM releases WHERE id = ${releaseId}`;
    } else {
      releases = await sql`SELECT * FROM releases`;
    }
    
    for (const release of releases) {
      // Get the track with the MOST sales (for singles) or MIN (for albums)
      // Using MAX here because we want to show actual total sales for the release
      const trackSalesResult = await sql`
        SELECT 
          COALESCE(MAX(t.sold_count), 0) as max_sold,
          COALESCE(MIN(t.sold_count), 0) as min_sold,
          r.type
        FROM releases r
        LEFT JOIN tracks t ON t.release_id = r.id
        WHERE r.id = ${release.id}
        GROUP BY r.id, r.type
      `;
      
      if (trackSalesResult.length > 0) {
        const { max_sold, min_sold, type } = trackSalesResult[0];
        // For albums, use min (all tracks must be sold for album to be "sold")
        // For singles, use max (there's only one track anyway)
        const actualSold = type === 'album' ? parseInt(min_sold) : parseInt(max_sold);
        const currentSold = release.sold_editions || 0;
        
        if (actualSold !== currentSold) {
          console.log(`🔧 Fixing release "${release.title}": ${currentSold} → ${actualSold}`);
          
          await sql`
            UPDATE releases SET sold_editions = ${actualSold} WHERE id = ${release.id}
          `;
          
          fixes.push({
            type: 'release',
            id: release.id,
            title: release.title,
            was: currentSold,
            now: actualSold,
          });
        }
      }
    }
    
    if (fixes.length === 0) {
      return res.json({
        success: true,
        message: 'All counters are already correct!',
        checked: {
          tracks: tracks.length,
          releases: releases.length,
        },
      });
    }
    
    return res.json({
      success: true,
      message: `Fixed ${fixes.length} counters`,
      fixes,
    });
    
  } catch (error) {
    console.error('Fix sales counters error:', error);
    return res.status(500).json({ error: error.message });
  }
}
