/**
 * XRP Music - Batch Mint API
 * Platform mints NFTs on behalf of artist (artist is Issuer, gets royalties)
 * 
 * Supports:
 * - Single tracks: mint X editions of 1 track
 * - Albums: mint X editions of EACH track
 * 
 * Flow:
 * 1. Artist authorizes platform via AccountSet (frontend)
 * 2. This endpoint mints NFTs using platform wallet
 * 3. Artist set as Issuer - gets royalties on resale
 * 4. NFTs go to platform wallet - ready to sell
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { action } = req.body;
  
  // Return platform config
  if (action === 'getConfig') {
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    if (!platformAddress) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    return res.json({ success: true, platformAddress });
  }
  
  // Handle minting
  if (action === 'mint') {
    return handleMint(req, res);
  }
  
  return res.status(400).json({ error: 'Invalid action' });
}

async function handleMint(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const {
      artistAddress,
      metadataUri,      // Single track URI (backward compatible)
      tracks,           // Array of track URIs for albums
      quantity,
      transferFee = 500,
      taxon = 0,
    } = req.body;
    
    if (!artistAddress || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Handle both single track and multiple tracks
    const trackUris = tracks || (metadataUri ? [metadataUri] : []);
    if (trackUris.length === 0) {
      return res.status(400).json({ error: 'No tracks provided' });
    }
    
    const totalNFTs = trackUris.length * quantity;
    if (totalNFTs > 500) {
      return res.status(400).json({ error: 'Maximum 500 NFTs per batch (reduce editions or tracks)' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform wallet not configured' });
    }
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    console.log(`Starting batch mint: ${trackUris.length} tracks × ${quantity} editions = ${totalNFTs} NFTs for artist ${artistAddress}`);
    
    try {
      const wallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Verify artist has authorized platform
      const accountInfo = await client.request({
        command: 'account_info',
        account: artistAddress,
      });
      
      const authorizedMinter = accountInfo.result.account_data.NFTokenMinter;
      if (authorizedMinter !== platformAddress) {
        throw new Error('Platform not authorized as minter. Artist must sign authorization first.');
      }
      
      console.log('Platform authorized. Starting mint...');
      
      // Results storage
      const mintedTracks = [];
      let totalMinted = 0;
      
      // Loop through each track
      for (let t = 0; t < trackUris.length; t++) {
        const trackUri = trackUris[t];
        const uriHex = xrpl.convertStringToHex(trackUri);
        const trackNFTs = [];
        
        console.log(`Minting track ${t + 1}/${trackUris.length}: ${quantity} editions...`);
        
        // Mint X editions of this track
        for (let i = 0; i < quantity; i++) {
          console.log(`  Edition ${i + 1}/${quantity}...`);
          
          try {
            const mintTx = await client.autofill({
              TransactionType: 'NFTokenMint',
              Account: platformAddress,
              Issuer: artistAddress,
              URI: uriHex,
              Flags: 8, // tfTransferable
              TransferFee: transferFee,
              NFTokenTaxon: t, // Use track index as taxon to group by track
            });
            
            const signed = wallet.sign(mintTx);
            const result = await client.submitAndWait(signed.tx_blob);
            
            if (result.result.meta.TransactionResult === 'tesSUCCESS') {
              trackNFTs.push({
                txHash: result.result.hash,
                success: true,
              });
              totalMinted++;
              console.log(`    ✓ Edition ${i + 1} minted: ${result.result.hash}`);
            } else {
              console.error(`    ✗ Edition ${i + 1} failed: ${result.result.meta.TransactionResult}`);
              trackNFTs.push({
                error: result.result.meta.TransactionResult,
                success: false,
              });
            }
            
            // Small delay to avoid rate limiting
            if (i < quantity - 1 || t < trackUris.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
          } catch (mintError) {
            console.error(`    ✗ Failed to mint edition ${i + 1}:`, mintError.message);
            trackNFTs.push({
              error: mintError.message,
              success: false,
            });
          }
        }
        
        mintedTracks.push({
          trackIndex: t,
          trackUri: trackUri,
          editions: trackNFTs.filter(n => n.success).length,
          nfts: trackNFTs,
        });
      }
      
      console.log(`Batch mint complete: ${totalMinted}/${totalNFTs} successful`);
      
      return res.json({
        success: true,
        totalRequested: totalNFTs,
        totalMinted: totalMinted,
        trackCount: trackUris.length,
        editionsPerTrack: quantity,
        tracks: mintedTracks,
        // Backward compatible
        nftTokenIds: mintedTracks.flatMap(t => t.nfts.filter(n => n.success).map(n => n.txHash)),
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('Batch mint error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Batch mint failed' 
    });
  }
}
