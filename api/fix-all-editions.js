/**
 * XRP Music - Comprehensive Edition & Counter Fix
 * 
 * This script:
 * 1. Assigns edition numbers based on SALE ORDER (not mint order)
 * 2. Updates both sales.edition_number and nfts.edition_number
 * 3. Syncs tracks.sold_count from actual sales
 * 4. Syncs releases.sold_editions from track sold counts
 * 
 * GET /api/fix-all-editions - Dry run (shows what would change)
 * POST /api/fix-all-editions - Actually apply fixes
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const dryRun = req.method === 'GET';
  
  try {
    const results = {
      dryRun,
      salesFixed: [],
      nftsFixed: [],
      tracksFixed: [],
      releasesFixed: [],
      summary: {},
    };
    
    // ============================================
    // STEP 1: Get all sales ordered by purchase time
    // ============================================
    console.log('📊 Step 1: Analyzing sales by purchase order...');
    
    const allSales = await sql`
      SELECT 
        s.id as sale_id,
        s.track_id,
        s.nft_token_id,
        s.edition_number as current_edition,
        s.buyer_address,
        s.created_at,
        t.title as track_title,
        r.title as release_title,
        r.id as release_id
      FROM sales s
      JOIN tracks t ON t.id = s.track_id
      JOIN releases r ON r.id = t.release_id
      ORDER BY s.track_id, s.created_at ASC, s.id ASC
    `;
    
    console.log(`   Found ${allSales.length} total sales`);
    
    // Group by track
    const salesByTrack = {};
    for (const sale of allSales) {
      if (!salesByTrack[sale.track_id]) {
        salesByTrack[sale.track_id] = {
          trackTitle: sale.track_title,
          releaseTitle: sale.release_title,
          releaseId: sale.release_id,
          sales: [],
        };
      }
      salesByTrack[sale.track_id].sales.push(sale);
    }
    
    // ============================================
    // STEP 2: Fix edition numbers on sales & NFTs
    // ============================================
    console.log('🔧 Step 2: Fixing edition numbers...');
    
    for (const trackId in salesByTrack) {
      const trackData = salesByTrack[trackId];
      const sales = trackData.sales;
      
      for (let i = 0; i < sales.length; i++) {
        const sale = sales[i];
        const correctEdition = i + 1;
        
        // Fix sale edition number
        if (sale.current_edition !== correctEdition) {
          results.salesFixed.push({
            saleId: sale.sale_id,
            track: `${trackData.releaseTitle} - ${trackData.trackTitle}`,
            buyer: sale.buyer_address?.slice(0, 8) + '...',
            was: sale.current_edition,
            shouldBe: correctEdition,
            purchasedAt: sale.created_at,
          });
          
          if (!dryRun) {
            await sql`
              UPDATE sales 
              SET edition_number = ${correctEdition} 
              WHERE id = ${sale.sale_id}
            `;
          }
        }
        
        // Fix NFT edition number (if we have the token ID)
        if (sale.nft_token_id) {
          const nftRecord = await sql`
            SELECT id, edition_number FROM nfts 
            WHERE nft_token_id = ${sale.nft_token_id}
          `;
          
          if (nftRecord.length > 0 && nftRecord[0].edition_number !== correctEdition) {
            results.nftsFixed.push({
              nftTokenId: sale.nft_token_id.slice(0, 16) + '...',
              track: `${trackData.releaseTitle} - ${trackData.trackTitle}`,
              was: nftRecord[0].edition_number,
              shouldBe: correctEdition,
            });
            
            if (!dryRun) {
              await sql`
                UPDATE nfts 
                SET edition_number = ${correctEdition} 
                WHERE nft_token_id = ${sale.nft_token_id}
              `;
            }
          }
        }
      }
    }
    
    // ============================================
    // STEP 3: Sync track sold_count from sales
    // ============================================
    console.log('🔧 Step 3: Syncing track sold counts...');
    
    const allTracks = await sql`
      SELECT 
        t.id,
        t.title,
        t.sold_count as current_sold_count,
        r.title as release_title,
        r.id as release_id,
        r.total_editions
      FROM tracks t
      JOIN releases r ON r.id = t.release_id
    `;
    
    for (const track of allTracks) {
      const salesCount = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
      `;
      const actualSold = parseInt(salesCount[0]?.count) || 0;
      const currentSold = track.current_sold_count || 0;
      
      if (actualSold !== currentSold) {
        const remaining = track.total_editions - actualSold;
        results.tracksFixed.push({
          track: `${track.release_title} - ${track.title}`,
          releaseId: track.release_id,
          soldWas: currentSold,
          soldShouldBe: actualSold,
          totalEditions: track.total_editions,
          remaining: remaining,
        });
        
        if (!dryRun) {
          await sql`
            UPDATE tracks SET sold_count = ${actualSold} WHERE id = ${track.id}
          `;
        }
      }
    }
    
    // ============================================
    // STEP 4: Sync release sold_editions
    // ============================================
    console.log('🔧 Step 4: Syncing release sold editions...');
    
    const allReleases = await sql`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.sold_editions as current_sold,
        r.total_editions
      FROM releases r
    `;
    
    for (const release of allReleases) {
      // For singles: MAX sold_count (there's only one track)
      // For albums: MIN sold_count (album only "sold" when all tracks sold together)
      const trackSales = await sql`
        SELECT 
          COALESCE(MAX(COALESCE(t.sold_count, 0)), 0) as max_sold,
          COALESCE(MIN(COALESCE(t.sold_count, 0)), 0) as min_sold
        FROM tracks t
        WHERE t.release_id = ${release.id}
      `;
      
      if (trackSales.length > 0) {
        // Use MAX for display purposes (shows total sales across all tracks)
        const actualSold = release.type === 'album' 
          ? parseInt(trackSales[0].min_sold) 
          : parseInt(trackSales[0].max_sold);
        const currentSold = release.current_sold || 0;
        
        if (actualSold !== currentSold) {
          results.releasesFixed.push({
            release: release.title,
            type: release.type,
            soldWas: currentSold,
            soldShouldBe: actualSold,
            totalEditions: release.total_editions,
            remaining: release.total_editions - actualSold,
          });
          
          if (!dryRun) {
            await sql`
              UPDATE releases SET sold_editions = ${actualSold} WHERE id = ${release.id}
            `;
          }
        }
      }
    }
    
    // ============================================
    // Summary
    // ============================================
    results.summary = {
      totalSales: allSales.length,
      salesNeedingFix: results.salesFixed.length,
      nftsNeedingFix: results.nftsFixed.length,
      tracksNeedingFix: results.tracksFixed.length,
      releasesNeedingFix: results.releasesFixed.length,
    };
    
    if (dryRun) {
      console.log('🔍 Dry run complete. POST to apply changes.');
    } else {
      console.log('✅ All fixes applied!');
    }
    
    return res.json({
      success: true,
      message: dryRun 
        ? 'Dry run complete - POST to apply these changes'
        : 'All edition numbers and counters have been fixed!',
      results,
    });
    
  } catch (error) {
    console.error('Fix all editions error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
    });
  }
}
