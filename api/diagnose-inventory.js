/**
 * XRP Music - NFT Inventory Diagnostic
 * 
 * Checks on-chain NFT counts in platform wallet vs database records
 * This helps identify missing sales for legacy pre-minted releases
 * 
 * GET /api/diagnose-inventory
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_WALLET = 'rBvqEKtZXZk95VarHPCYWRYc6YTnLWKtkp';

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
    // Get all tracks with metadata CIDs
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
        r.status
      FROM tracks t
      JOIN releases r ON r.id = t.release_id
      WHERE t.metadata_cid IS NOT NULL
      ORDER BY r.created_at DESC
    `;
    
    console.log(`📊 Checking ${tracks.length} tracks with metadata CIDs...`);
    
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
    const nftsByUri = {};
    for (const nft of allNFTs) {
      const uri = nft.URI || '';
      if (!nftsByUri[uri]) {
        nftsByUri[uri] = [];
      }
      nftsByUri[uri].push(nft.NFTokenID);
    }
    
    // Check each track
    const results = [];
    
    for (const track of tracks) {
      const expectedUri = Buffer.from(`ipfs://${track.metadata_cid}`).toString('hex').toUpperCase();
      const nftsInWallet = nftsByUri[expectedUri] || [];
      const inWalletCount = nftsInWallet.length;
      
      // Get sales count from database
      const salesResult = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.track_id}
      `;
      const dbSalesCount = parseInt(salesResult[0]?.count) || 0;
      
      // Get NFTs marked as sold in DB
      const soldNftsResult = await sql`
        SELECT COUNT(*) as count FROM nfts 
        WHERE track_id = ${track.track_id} AND status = 'sold'
      `;
      const dbSoldNfts = parseInt(soldNftsResult[0]?.count) || 0;
      
      // Calculate
      const totalMinted = track.total_editions; // Assuming all were pre-minted for legacy
      const soldOnChain = totalMinted - inWalletCount; // NFTs not in wallet = sold
      
      const isLegacy = track.is_minted && !track.mint_fee_paid;
      
      const discrepancy = soldOnChain !== dbSalesCount;
      
      results.push({
        track: `${track.release_title} - ${track.track_title}`,
        releaseId: track.release_id,
        trackId: track.track_id,
        isLegacy: isLegacy,
        totalEditions: totalMinted,
        
        // On-chain data
        inPlatformWallet: inWalletCount,
        soldOnChain: soldOnChain,
        
        // Database data
        dbSalesCount: dbSalesCount,
        dbSoldNfts: dbSoldNfts,
        dbSoldEditions: track.sold_editions,
        trackSoldCount: track.sold_count,
        
        // Analysis
        missingSales: soldOnChain - dbSalesCount,
        hasDiscrepancy: discrepancy,
        
        // What it should show
        correctSoldCount: soldOnChain,
        correctRemaining: inWalletCount,
      });
    }
    
    // Summary
    const withDiscrepancies = results.filter(r => r.hasDiscrepancy);
    const missingSalesTotal = results.reduce((sum, r) => sum + Math.max(0, r.missingSales), 0);
    
    return res.json({
      success: true,
      platformWallet: PLATFORM_WALLET,
      totalNFTsInWallet: allNFTs.length,
      tracksChecked: tracks.length,
      tracksWithDiscrepancies: withDiscrepancies.length,
      totalMissingSales: missingSalesTotal,
      
      // Detailed results (only show ones with issues, or all if requested)
      discrepancies: withDiscrepancies,
      allTracks: req.query.all === 'true' ? results : undefined,
    });
    
  } catch (error) {
    console.error('Diagnose inventory error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
    });
  }
}
