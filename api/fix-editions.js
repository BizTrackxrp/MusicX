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
    // STEP 1: Fix edition_number in nfts table
    console.log('Step 1: Fixing NFT edition numbers...');
    try {
      await sql`
        WITH numbered AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY created_at, id) as new_edition
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
    
    // STEP 5: Fix sales without NFT token ID
    console.log('Step 5: Fixing sales without NFT token IDs...');
    try {
      // For sales without nft_token_id, assign edition based on sale order
      await sql`
        WITH sale_editions AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY created_at) as sale_order
          FROM sales
          WHERE edition_number IS NULL
        )
        UPDATE sales s
        SET edition_number = se.sale_order
        FROM sale_editions se
        WHERE s.id = se.id
      `;
      results.steps.push('✓ Fixed sales without NFT references');
    } catch (e) {
      results.errors.push('Sales without NFTs: ' + e.message);
    }
    
    // STEP 6: Reset stuck pending NFTs
    console.log('Step 6: Resetting stuck pending NFTs...');
    try {
      const resetResult = await sql`
        UPDATE nfts 
        SET status = 'available' 
        WHERE status = 'pending' 
          AND (updated_at IS NULL OR updated_at < NOW() - INTERVAL '10 minutes')
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
