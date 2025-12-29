/**
 * XRP Music - Purchase API
 * Platform already owns the NFTs, so we:
 * 1. Buyer pays platform
 * 2. Platform transfers 1 NFT to buyer
 * 3. Platform sends 98% to artist
 * 4. Platform keeps 2%
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_FEE_PERCENT = 2;

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
  
  try {
    const {
      releaseId,
      buyerAddress,
      paymentTxHash,
    } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get platform wallet credentials
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      console.error('Platform wallet not configured');
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Get release details
    const [release] = await sql`
      SELECT * FROM releases WHERE id = ${releaseId}
    `;
    
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    // Check if still available
    const available = release.total_editions - release.sold_editions;
    if (available <= 0) {
      return res.status(400).json({ error: 'Sold out' });
    }
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Step 1: Find an NFT to transfer to buyer
      // Get platform's NFTs and find one matching this release's metadata
      const nftsResponse = await client.request({
        command: 'account_nfts',
        account: platformAddress,
        limit: 400,
      });
      
      const platformNFTs = nftsResponse.result.account_nfts || [];
      
      // Find NFT with matching URI (metadata)
      let nftToTransfer = null;
      const metadataUri = `ipfs://${release.metadata_cid}`;
      const expectedUriHex = xrpl.convertStringToHex(metadataUri);
      
      for (const nft of platformNFTs) {
        // Check if NFT URI matches release metadata
        if (nft.URI === expectedUriHex) {
          // Also verify issuer is the artist
          // NFT Issuer is encoded in the NFTokenID
          nftToTransfer = nft;
          break;
        }
      }
      
      if (!nftToTransfer) {
        console.error('No matching NFT found for release:', releaseId);
        console.error('Looking for URI:', metadataUri);
        console.error('Platform has', platformNFTs.length, 'NFTs');
        return res.status(400).json({ error: 'No NFT available for this release' });
      }
      
      console.log('Found NFT to transfer:', nftToTransfer.NFTokenID);
      
      // Step 2: Create sell offer for buyer (Amount: 0 = free transfer)
      // Since buyer already paid, we transfer for free
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftToTransfer.NFTokenID,
        Amount: '0', // Free transfer (buyer already paid)
        Flags: 1, // tfSellNFToken
        Destination: buyerAddress, // Only buyer can accept
      });
      
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Create offer failed: ${offerResult.result.meta.TransactionResult}`);
      }
      
      // Get the offer index from the transaction result
      let offerIndex = null;
      for (const node of offerResult.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerIndex = node.CreatedNode.LedgerIndex;
          break;
        }
      }
      
      console.log('Created sell offer:', offerIndex);
      
      // Step 3: Accept the offer on behalf of buyer (using their signature)
      // Actually - buyer needs to accept this themselves via Xaman
      // Return the offer index for frontend to handle
      
      // Step 4: Send artist their payment (98%)
      const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
      const artistPayment = price - platformFee;
      
      if (artistPayment > 0) {
        const paymentTx = await client.autofill({
          TransactionType: 'Payment',
          Account: platformAddress,
          Destination: artistAddress,
          Amount: xrpl.xrpToDrops(artistPayment.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: xrpl.convertStringToHex('XRPMusic'),
              MemoData: xrpl.convertStringToHex(`Sale: ${release.title}`),
            }
          }],
        });
        
        const signedPayment = platformWallet.sign(paymentTx);
        const paymentResult = await client.submitAndWait(signedPayment.tx_blob);
        
        if (paymentResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          console.error('Artist payment failed:', paymentResult.result.meta.TransactionResult);
        } else {
          console.log('Artist paid:', paymentResult.result.hash);
        }
      }
      
      // Step 5: Update database
      await sql`
        UPDATE releases 
        SET sold_editions = sold_editions + 1
        WHERE id = ${releaseId}
      `;
      
      // Record the sale
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await sql`
        INSERT INTO sales (
          id,
          release_id,
          buyer_address,
          seller_address,
          price,
          platform_fee,
          tx_hash,
          created_at
        ) VALUES (
          ${saleId},
          ${releaseId},
          ${buyerAddress},
          ${artistAddress},
          ${price},
          ${platformFee},
          ${offerResult.result.hash},
          NOW()
        )
      `;
      
      return res.json({
        success: true,
        offerIndex: offerIndex,
        nftTokenId: nftToTransfer.NFTokenID,
        txHash: offerResult.result.hash,
        message: 'NFT ready for transfer!',
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    return res.status(500).json({ error: error.message || 'Purchase failed' });
  }
}
