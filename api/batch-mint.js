/**
 * XRP Music - Batch Mint API
 * Platform mints NFTs on behalf of artist (artist is Issuer, gets royalties)
 * 
 * Flow:
 * 1. Artist authorizes platform via AccountSet (frontend)
 * 2. This endpoint mints X NFTs using platform wallet
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
      metadataUri,
      quantity,
      transferFee = 500, // Default 5% royalty (500 = 0.5%, 5000 = 5%)
      taxon = 0,
    } = req.body;
    
    if (!artistAddress || !metadataUri || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (quantity > 200) {
      return res.status(400).json({ error: 'Maximum 200 NFTs per batch' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform wallet not configured' });
    }
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    console.log(`Starting batch mint: ${quantity} NFTs for artist ${artistAddress}`);
    
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
      
      // Convert URI to hex
      const uriHex = xrpl.convertStringToHex(metadataUri);
      
      // Mint NFTs one by one (or use tickets for speed)
      const mintedNFTs = [];
      const nftTokenIds = [];
      
      for (let i = 0; i < quantity; i++) {
        console.log(`Minting NFT ${i + 1}/${quantity}...`);
        
        try {
          const mintTx = await client.autofill({
            TransactionType: 'NFTokenMint',
            Account: platformAddress,
            Issuer: artistAddress, // Artist gets royalties
            URI: uriHex,
            Flags: 8, // tfTransferable
            TransferFee: transferFee,
            NFTokenTaxon: taxon,
          });
          
          const signed = wallet.sign(mintTx);
          const result = await client.submitAndWait(signed.tx_blob);
          
          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            // Extract NFT Token ID from affected nodes
            let nftTokenId = null;
            for (const node of result.result.meta.AffectedNodes) {
              if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage' ||
                  node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
                // The NFT ID is in the modified/created NFTokenPage
                // We need to find it from the transaction
                nftTokenId = result.result.hash; // Use tx hash as reference for now
                break;
              }
            }
            
            mintedNFTs.push({
              index: i,
              txHash: result.result.hash,
              success: true,
            });
            nftTokenIds.push(result.result.hash);
            
            console.log(`NFT ${i + 1} minted: ${result.result.hash}`);
          } else {
            console.error(`NFT ${i + 1} failed: ${result.result.meta.TransactionResult}`);
            mintedNFTs.push({
              index: i,
              error: result.result.meta.TransactionResult,
              success: false,
            });
          }
          
          // Small delay to avoid rate limiting
          if (i < quantity - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (mintError) {
          console.error(`Failed to mint NFT ${i + 1}:`, mintError.message);
          mintedNFTs.push({
            index: i,
            error: mintError.message,
            success: false,
          });
        }
      }
      
      const successCount = mintedNFTs.filter(n => n.success).length;
      console.log(`Batch mint complete: ${successCount}/${quantity} successful`);
      
      // Revoke minter authorization (cleanup)
      try {
        // Note: Only the artist can revoke - we skip this for now
        // They can revoke manually if needed
      } catch (revokeError) {
        console.log('Could not revoke minter (expected - only artist can do this)');
      }
      
      return res.json({
        success: true,
        totalRequested: quantity,
        totalMinted: successCount,
        nftTokenIds: nftTokenIds,
        details: mintedNFTs,
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
