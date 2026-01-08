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
 * 5. NFT token IDs stored in database for tracking
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

/**
 * Extract NFT Token ID from mint transaction result
 */
function extractNFTokenID(meta) {
  // Look through AffectedNodes for the newly created NFToken
  for (const node of meta.AffectedNodes || []) {
    // Check for modified NFTokenPage (token added to existing page)
    if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
      const finalTokens = node.ModifiedNode.FinalFields?.NFTokens || [];
      const prevTokens = node.ModifiedNode.PreviousFields?.NFTokens || [];
      
      // Find the new token (in final but not in previous)
      const prevIds = new Set(prevTokens.map(t => t.NFToken?.NFTokenID));
      for (const token of finalTokens) {
        if (!prevIds.has(token.NFToken?.NFTokenID)) {
          return token.NFToken.NFTokenID;
        }
      }
    }
    
    // Check for created NFTokenPage (new page created for token)
    if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
      const tokens = node.CreatedNode.NewFields?.NFTokens || [];
      if (tokens.length > 0) {
        return tokens[0].NFToken?.NFTokenID;
      }
    }
  }
  
  return null;
}

async function handleMint(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const {
      artistAddress,
      metadataUri,      // Single track URI (backward compatible)
      tracks,           // Array of track URIs for albums
      trackIds,         // Array of track database IDs (for storing in nfts table)
      releaseId,        // Release ID for linking
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
    
    // Allow up to 1000 NFTs per batch
    if (totalNFTs > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 NFTs per batch (reduce editions or tracks)' });
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
      const allNftTokenIds = [];
      
      // Loop through each track
      for (let t = 0; t < trackUris.length; t++) {
        const trackUri = trackUris[t];
        const trackId = trackIds?.[t] || null;
        const uriHex = xrpl.convertStringToHex(trackUri);
        const trackNFTs = [];
        
        console.log(`Minting track ${t + 1}/${trackUris.length}: ${quantity} editions...`);
        
        // Mint X editions of this track
        for (let i = 0; i < quantity; i++) {
          const editionNumber = i + 1;
          console.log(`  Edition ${editionNumber}/${quantity}...`);
          
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
              // Extract the actual NFT Token ID from the transaction result
              const nftTokenId = extractNFTokenID(result.result.meta);
              
              if (nftTokenId) {
                console.log(`    ✓ Edition ${editionNumber} minted: ${nftTokenId}`);
                
                // Store in database
                if (trackId || releaseId) {
                  const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  try {
                    await sql`
                      INSERT INTO nfts (
                        id, nft_token_id, track_id, release_id, edition_number,
                        status, owner_address, tx_hash, minted_at
                      ) VALUES (
                        ${nftId}, ${nftTokenId}, ${trackId}, ${releaseId},
                        ${editionNumber}, 'available', ${platformAddress},
                        ${result.result.hash}, NOW()
                      )
                      ON CONFLICT (nft_token_id) DO NOTHING
                    `;
                    console.log(`    ✓ Stored in database: ${nftId}`);
                  } catch (dbError) {
                    console.error(`    ⚠ DB insert failed (continuing):`, dbError.message);
                  }
                }
                
                trackNFTs.push({
                  nftTokenId: nftTokenId,
                  editionNumber: editionNumber,
                  txHash: result.result.hash,
                  success: true,
                });
                allNftTokenIds.push(nftTokenId);
                totalMinted++;
              } else {
                console.error(`    ⚠ Could not extract NFT Token ID from result`);
                trackNFTs.push({
                  txHash: result.result.hash,
                  error: 'Could not extract NFT Token ID',
                  success: false,
                });
              }
            } else {
              console.error(`    ✗ Edition ${editionNumber} failed: ${result.result.meta.TransactionResult}`);
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
            console.error(`    ✗ Failed to mint edition ${editionNumber}:`, mintError.message);
            trackNFTs.push({
              error: mintError.message,
              success: false,
            });
          }
        }
        
        mintedTracks.push({
          trackIndex: t,
          trackId: trackId,
          trackUri: trackUri,
          editions: trackNFTs.filter(n => n.success).length,
          nfts: trackNFTs,
        });
      }
      
      console.log(`Batch mint complete: ${totalMinted}/${totalNFTs} successful`);
      
      // Update release with minted NFT token IDs
      if (releaseId && allNftTokenIds.length > 0) {
        try {
          await sql`
            UPDATE releases 
            SET nft_token_ids = ${JSON.stringify(allNftTokenIds)},
                is_minted = true
            WHERE id = ${releaseId}
          `;
          console.log(`Updated release ${releaseId} with ${allNftTokenIds.length} NFT token IDs`);
        } catch (updateError) {
          console.error('Failed to update release:', updateError.message);
        }
      }
      
      return res.json({
        success: true,
        totalRequested: totalNFTs,
        totalMinted: totalMinted,
        trackCount: trackUris.length,
        editionsPerTrack: quantity,
        tracks: mintedTracks,
        nftTokenIds: allNftTokenIds,
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
