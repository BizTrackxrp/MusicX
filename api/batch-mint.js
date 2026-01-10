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
 * Tries multiple methods to find the newly minted NFT Token ID
 */
function extractNFTokenID(meta, txHash = null) {
  // Method 1: Look through AffectedNodes for modified NFTokenPage
  for (const node of meta.AffectedNodes || []) {
    // Check for modified NFTokenPage (token added to existing page)
    if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
      const finalTokens = node.ModifiedNode.FinalFields?.NFTokens || [];
      const prevTokens = node.ModifiedNode.PreviousFields?.NFTokens || [];
      
      // Find the new token (in final but not in previous)
      const prevIds = new Set(prevTokens.map(t => t.NFToken?.NFTokenID));
      for (const token of finalTokens) {
        if (token.NFToken?.NFTokenID && !prevIds.has(token.NFToken.NFTokenID)) {
          return token.NFToken.NFTokenID;
        }
      }
      
      // If PreviousFields is empty, this might be first token on page
      if (prevTokens.length === 0 && finalTokens.length > 0) {
        // Return the last token (most recently added)
        const lastToken = finalTokens[finalTokens.length - 1];
        if (lastToken?.NFToken?.NFTokenID) {
          return lastToken.NFToken.NFTokenID;
        }
      }
    }
    
    // Check for created NFTokenPage (new page created for token)
    if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
      const tokens = node.CreatedNode.NewFields?.NFTokens || [];
      if (tokens.length > 0) {
        // Return the last token on the new page
        const lastToken = tokens[tokens.length - 1];
        if (lastToken?.NFToken?.NFTokenID) {
          return lastToken.NFToken.NFTokenID;
        }
      }
    }
  }
  
  // Method 2: Look for nftoken_id in meta directly (some XRPL versions)
  if (meta.nftoken_id) {
    return meta.nftoken_id;
  }
  
  // Method 3: Check if there's an nftoken_ids array
  if (meta.nftoken_ids && meta.nftoken_ids.length > 0) {
    return meta.nftoken_ids[0];
  }
  
  console.error('Could not extract NFT Token ID. Meta:', JSON.stringify(meta, null, 2));
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
      let totalStoredInDb = 0;
      const allNftTokenIds = [];
      const failedToExtract = []; // Track mints where we couldn't get the ID
      
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
              const nftTokenId = extractNFTokenID(result.result.meta, result.result.hash);
              
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
                    totalStoredInDb++;
                  } catch (dbError) {
                    console.error(`    ⚠ DB insert failed (continuing):`, dbError.message);
                  }
                }
                
                trackNFTs.push({
                  nftTokenId: nftTokenId,
                  editionNumber: editionNumber,
                  txHash: result.result.hash,
                  success: true,
                  storedInDb: true,
                });
                allNftTokenIds.push(nftTokenId);
                totalMinted++;
              } else {
                // NFT was minted on-chain but we couldn't extract the ID
                // This is a CRITICAL issue - the NFT exists but isn't tracked!
                console.error(`    ⚠ CRITICAL: Minted on-chain but could not extract NFT Token ID!`);
                console.error(`    ⚠ TxHash: ${result.result.hash}`);
                
                failedToExtract.push({
                  txHash: result.result.hash,
                  trackIndex: t,
                  editionNumber: editionNumber,
                });
                
                trackNFTs.push({
                  txHash: result.result.hash,
                  editionNumber: editionNumber,
                  error: 'Minted but could not extract NFT Token ID - check XRPL explorer',
                  success: true, // It DID mint, we just can't track it
                  storedInDb: false,
                });
                totalMinted++; // Still count it as minted
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
          storedInDb: trackNFTs.filter(n => n.storedInDb).length,
          nfts: trackNFTs,
        });
      }
      
      console.log(`Batch mint complete: ${totalMinted}/${totalNFTs} minted, ${totalStoredInDb}/${totalMinted} stored in DB`);
      
      // CRITICAL WARNING if some NFTs weren't stored
      if (totalStoredInDb < totalMinted) {
        console.error(`⚠ WARNING: ${totalMinted - totalStoredInDb} NFTs minted but NOT stored in database!`);
        console.error(`⚠ Failed extractions:`, failedToExtract);
      }
      
      // Update release with minted NFT token IDs
      if (releaseId && allNftTokenIds.length > 0) {
        try {
          await sql`
            UPDATE releases 
            SET nft_token_ids = ${JSON.stringify(allNftTokenIds)},
                is_minted = true,
                total_editions = ${totalStoredInDb}
            WHERE id = ${releaseId}
          `;
          console.log(`Updated release ${releaseId} with ${allNftTokenIds.length} NFT token IDs, total_editions = ${totalStoredInDb}`);
        } catch (updateError) {
          console.error('Failed to update release:', updateError.message);
        }
      }
      
      // Return response with clear indication of any issues
      const response = {
        success: true,
        totalRequested: totalNFTs,
        totalMinted: totalMinted,
        totalStoredInDb: totalStoredInDb,
        trackCount: trackUris.length,
        editionsPerTrack: quantity,
        tracks: mintedTracks,
        nftTokenIds: allNftTokenIds,
      };
      
      // Add warning if there's a mismatch
      if (totalStoredInDb < totalMinted) {
        response.warning = `${totalMinted - totalStoredInDb} NFTs were minted on-chain but could not be tracked in database. Check Vercel logs for transaction hashes.`;
        response.failedToExtract = failedToExtract;
      }
      
      return res.json(response);
      
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
