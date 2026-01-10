/**
 * XRP Music - Fix Editions API
 * Call this endpoint ONCE to repair all edition numbers and sold counts
 * 
 * Usage: POST /api/fix-editions with body { "secret": "your-secret-key" }
 * 
 * Set FIX_EDITIONS_SECRET in your environment variables
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Simple security check - require a secret
  const { secret } = req.body;
  const expectedSecret = process.env.FIX_EDITIONS_SECRET || 'fix-editions-2024';
  
  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  
  const results = {
    steps: [],
    errors: [],
  };
  
  try {
    // STEP 1: Fix edition_number in nfts table (using ID for ordering)
    console.log('Step 1: Fixing NFT edition numbers...');
    try {
      await sql`
        WITH numbered AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY id) as new_edition
          FROM nfts
        )
        UPDATE nfts 
        SET edition_number = numbered.new_edition
        FROM numbered
        WHERE nfts.id = numbered.id
      `;
      results.steps.push('✓ Fixed NFT edition numbers');
    } catch (e) {
      results.errors.push('NFT editions: ' + e.message);
    }
    
    // STEP 2: Fix sold_count in tracks table
    console.log('Step 2: Fixing track sold counts...');
    try {
      await sql`
        UPDATE tracks t
        SET sold_count = (
          SELECT COUNT(*) 
          FROM nfts n 
          WHERE n.track_id = t.id 
            AND n.status = 'sold'
        )
      `;
      results.steps.push('✓ Fixed track sold counts');
    } catch (e) {
      results.errors.push('Track sold counts: ' + e.message);
    }
    
    // STEP 3: Fix sold_editions in releases table
    console.log('Step 3: Fixing release sold editions...');
    try {
      await sql`
        UPDATE releases r
        SET sold_editions = (
          SELECT COALESCE(MIN(COALESCE(t.sold_count, 0)), 0)
          FROM tracks t
          WHERE t.release_id = r.id
        )
      `;
      results.steps.push('✓ Fixed release sold editions');
    } catch (e) {
      results.errors.push('Release sold editions: ' + e.message);
    }
    
    // STEP 4: Fix edition_number in sales table (from NFT)
    console.log('Step 4: Fixing sales edition numbers from NFTs...');
    try {
      await sql`
        UPDATE sales s
        SET edition_number = n.edition_number
        FROM nfts n
        WHERE s.nft_token_id = n.nft_token_id
          AND s.nft_token_id IS NOT NULL
      `;
      results.steps.push('✓ Fixed sales edition numbers (from NFTs)');
    } catch (e) {
      results.errors.push('Sales editions from NFTs: ' + e.message);
    }
    
    // STEP 5: Fix sales without NFT token ID - assign edition by purchase order
    console.log('Step 5: Fixing sales edition numbers by purchase order...');
    try {
      // Get all sales grouped by track, ordered by created_at
      const allSales = await sql`
        SELECT id, track_id, edition_number, created_at
        FROM sales
        ORDER BY track_id, created_at, id
      `;
      
      // Group by track and assign sequential editions
      const salesByTrack = {};
      for (const sale of allSales) {
        if (!salesByTrack[sale.track_id]) {
          salesByTrack[sale.track_id] = [];
        }
        salesByTrack[sale.track_id].push(sale);
      }
      
      let salesFixed = 0;
      for (const trackId in salesByTrack) {
        const trackSales = salesByTrack[trackId];
        for (let i = 0; i < trackSales.length; i++) {
          const sale = trackSales[i];
          const correctEdition = i + 1;
          if (sale.edition_number !== correctEdition) {
            await sql`
              UPDATE sales SET edition_number = ${correctEdition} WHERE id = ${sale.id}
            `;
            salesFixed++;
          }
        }
      }
      results.steps.push(`✓ Fixed ${salesFixed} sales edition numbers`);
    } catch (e) {
      results.errors.push('Sales editions: ' + e.message);
    }
    
    // STEP 5b: Create missing NFT records for sales that don't have matching NFTs
    console.log('Step 5b: Creating missing NFT records for orphaned sales...');
    try {
      const orphanedSales = await sql`
        SELECT s.id, s.track_id, s.nft_token_id, s.buyer_address, s.edition_number
        FROM sales s
        WHERE s.nft_token_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM nfts n WHERE n.nft_token_id = s.nft_token_id
          )
      `;
      
      let nftsCreated = 0;
      for (const sale of orphanedSales) {
        const nftId = 'nft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await sql`
          INSERT INTO nfts (id, nft_token_id, track_id, edition_number, status, owner_address)
          VALUES (
            ${nftId},
            ${sale.nft_token_id},
            ${sale.track_id},
            ${sale.edition_number},
            'sold',
            ${sale.buyer_address}
          )
        `;
        nftsCreated++;
      }
      results.steps.push(`✓ Created ${nftsCreated} missing NFT records for sales`);
    } catch (e) {
      results.errors.push('Create missing NFTs: ' + e.message);
    }
    
    // STEP 6: Reset stuck pending NFTs (reset ALL pending since no timestamp)
    console.log('Step 6: Resetting stuck pending NFTs...');
    try {
      const resetResult = await sql`
        UPDATE nfts 
        SET status = 'available' 
        WHERE status = 'pending'
        RETURNING id
      `;
      results.steps.push(`✓ Reset ${resetResult.length} stuck pending NFTs`);
    } catch (e) {
      results.errors.push('Reset pending: ' + e.message);
    }
    
    // Get summary stats
    console.log('Getting summary...');
    const nftStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE edition_number IS NULL) as missing_edition
      FROM nfts
    `;
    
    const trackStats = await sql`
      SELECT 
        COUNT(*) as total_tracks,
        SUM(sold_count) as total_sold
      FROM tracks
    `;
    
    const salesStats = await sql`
      SELECT 
        COUNT(*) as total_sales,
        COUNT(*) FILTER (WHERE edition_number IS NULL) as missing_edition
      FROM sales
    `;
    
    results.summary = {
      nfts: nftStats[0],
      tracks: trackStats[0],
      sales: salesStats[0],
    };
    
    console.log('Fix complete:', results);
    
    return res.json({
      success: true,
      message: 'Edition numbers and sold counts have been repaired',
      results,
    });
    
  } catch (error) {
    console.error('Fix editions error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      results,
    });
  }
}
