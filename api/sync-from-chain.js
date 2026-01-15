/**
 * XRP Music - Sync From On-Chain Inventory
 * 
 * Uses the platform wallet as SOURCE OF TRUTH
 * sold = total_editions - NFTs_in_wallet
 * 
 * Only affects LEGACY releases (is_minted = true, not lazy mint)
 * 
 * GET /api/sync-from-chain - Dry run
 * POST /api/sync-from-chain - Apply fixes
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_WALLET = 'rBvqEKtZXZk95VarHPCYWRYc6YTnLWKtkp';

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
    console.log(`🔄 ${dryRun ? 'DRY RUN:' : 'APPLYING:'} Sync from on-chain inventory...`);
    
    // Get all LEGACY tracks (is_minted = true, NOT lazy mint)
    const tracks = await sql`
      SELECT 
        t.id as track_id,
        t.title as track_title,
        t.metadata_cid,
        t.sold_count,
        r.id as release_id,
        r.title as release_title,
        r.total_editions,
        r.sold_editions,
        r.is_minted,
        r.mint_fee_paid,
        r.type
      FROM tracks t
      JOIN releases r ON r.id = t.release_id
      WHERE r.is_minted = true 
        AND (r.mint_fee_paid IS NULL OR r.mint_fee_paid = false)
        AND t.metadata_cid IS NOT NULL
      ORDER BY r.created_at DESC
    `;
    
    console.log(`📊 Found ${tracks.length} legacy tracks to check`);
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    // Get all NFTs in platform wallet
    let allNFTs = [];
    let marker = undefined;
    
    do {
      const response = await client.request({
        command: 'account_nfts',
        account: PLATFORM_WALLET,
        limit: 400,
        marker: marker,
      });
      
      allNFTs = allNFTs.concat(response.result.account_nfts || []);
      marker = response.result.marker;
    } while (marker);
    
    await client.disconnect();
    
    console.log(`📦 Found ${allNFTs.length} total NFTs in platform wallet`);
    
    // Build a map of URI -> count
    const nftCountByUri = {};
    for (const nft of allNFTs) {
      const uri = nft.URI || '';
      nftCountByUri[uri] = (nftCountByUri[uri] || 0) + 1;
    }
    
    // Process each track
    const fixes = [];
    const releaseUpdates = {}; // Track release-level updates
    
    for (const track of tracks) {
      const expectedUri = Buffer.from(`ipfs://${track.metadata_cid}`).toString('hex').toUpperCase();
      const inWalletCount = nftCountByUri[expectedUri] || 0;
      
      // Skip if we have MORE in wallet than total editions (bad data, don't touch)
      if (inWalletCount > track.total_editions) {
        console.log(`⚠️ Skipping ${track.track_title}: ${inWalletCount} in wallet > ${track.total_editions} total editions`);
        continue;
      }
      
      const correctSoldCount = track.total_editions - inWalletCount;
      const currentSoldCount = track.sold_count || 0;
      
      if (correctSoldCount !== currentSoldCount) {
        fixes.push({
          trackId: track.track_id,
          releaseId: track.release_id,
          track: `${track.release_title} - ${track.track_title}`,
          totalEditions: track.total_editions,
          inWallet: inWalletCount,
          soldWas: currentSoldCount,
          soldNow: correctSoldCount,
          remaining: inWalletCount,
        });
        
        if (!dryRun) {
          // Update track sold_count
          await sql`
            UPDATE tracks 
            SET sold_count = ${correctSoldCount}
            WHERE id = ${track.track_id}
          `;
          console.log(`✅ Fixed ${track.track_title}: ${currentSoldCount} → ${correctSoldCount}`);
        }
        
        // Track release updates (for albums, need to take MIN; for singles, just use the value)
        if (!releaseUpdates[track.release_id]) {
          releaseUpdates[track.release_id] = {
            releaseId: track.release_id,
            title: track.release_title,
            type: track.type,
            trackSoldCounts: [],
          };
        }
        releaseUpdates[track.release_id].trackSoldCounts.push(correctSoldCount);
      }
    }
    
    // Update release sold_editions
    const releaseFixes = [];
    for (const releaseId in releaseUpdates) {
      const update = releaseUpdates[releaseId];
      
      // For albums: MIN (album only sold when all tracks sold)
      // For singles: just the track's sold count
      const correctSoldEditions = update.type === 'album'
        ? Math.min(...update.trackSoldCounts)
        : Math.max(...update.trackSoldCounts);
      
      // Get current value
      const currentRelease = await sql`
        SELECT sold_editions FROM releases WHERE id = ${releaseId}
      `;
      const currentSoldEditions = currentRelease[0]?.sold_editions || 0;
      
      if (correctSoldEditions !== currentSoldEditions) {
        releaseFixes.push({
          releaseId,
          title: update.title,
          type: update.type,
          was: currentSoldEditions,
          now: correctSoldEditions,
        });
        
        if (!dryRun) {
          await sql`
            UPDATE releases 
            SET sold_editions = ${correctSoldEditions}
            WHERE id = ${releaseId}
          `;
          console.log(`✅ Fixed release ${update.title}: ${currentSoldEditions} → ${correctSoldEditions}`);
        }
      }
    }
    
    // Also update edition numbers in nfts table based on sale order
    let editionFixes = 0;
    if (!dryRun) {
      for (const fix of fixes) {
        // Get sales for this track ordered by date
        const sales = await sql`
          SELECT id, nft_token_id, edition_number, created_at
          FROM sales
          WHERE track_id = ${fix.trackId}
          ORDER BY created_at ASC, id ASC
        `;
        
        // Update edition numbers based on sale order
        for (let i = 0; i < sales.length; i++) {
          const sale = sales[i];
          const correctEdition = i + 1;
          
          if (sale.edition_number !== correctEdition) {
            // Update sale
            await sql`
              UPDATE sales SET edition_number = ${correctEdition} WHERE id = ${sale.id}
            `;
            
            // Update NFT if we have the token ID
            if (sale.nft_token_id) {
              await sql`
                UPDATE nfts SET edition_number = ${correctEdition} 
                WHERE nft_token_id = ${sale.nft_token_id}
              `;
            }
            editionFixes++;
          }
        }
      }
    }
    
    return res.json({
      success: true,
      dryRun,
      message: dryRun 
        ? `DRY RUN: Would fix ${fixes.length} tracks and ${releaseFixes.length} releases`
        : `Fixed ${fixes.length} tracks, ${releaseFixes.length} releases, and ${editionFixes} edition numbers`,
      platformWallet: PLATFORM_WALLET,
      totalNFTsInWallet: allNFTs.length,
      legacyTracksChecked: tracks.length,
      trackFixes: fixes,
      releaseFixes: releaseFixes,
      editionNumbersFixed: dryRun ? 'N/A' : editionFixes,
    });
    
  } catch (error) {
    console.error('Sync from chain error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
    });
  }
}
