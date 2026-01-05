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
  
  // Check for action type
  const { action } = req.body;
  
  if (action === 'confirm') {
    return handleConfirmSale(req, res, sql);
  }
  
  // Default: handle purchase
  return handlePurchase(req, res, sql);
}

// Confirm sale after buyer successfully accepts NFT
async function handleConfirmSale(req, res, sql) {
  try {
    const { pendingSale, acceptTxHash } = req.body;
    
    if (!pendingSale || !acceptTxHash) {
      return res.status(400).json({ error: 'Missing pending sale data or transaction hash' });
    }
    
    const { releaseId, trackId, buyerAddress, artistAddress, nftTokenId, price, platformFee } = pendingSale;
    
    // Update THIS TRACK's sold_count and get edition number
    let editionNumber = 1;
    
    if (trackId) {
      const trackUpdate = await sql`
        UPDATE tracks 
        SET sold_count = COALESCE(sold_count, 0) + 1
        WHERE id = ${trackId}
        RETURNING sold_count
      `;
      editionNumber = trackUpdate[0]?.sold_count || 1;
    }
    
    // Update release sold_editions = MIN of all track sold_counts
    // This keeps "albums available" in sync (complete sets available)
    if (releaseId) {
      await sql`
        UPDATE releases r
        SET sold_editions = (
          SELECT COALESCE(MIN(COALESCE(t.sold_count, 0)), 0)
          FROM tracks t
          WHERE t.release_id = r.id
        )
        WHERE r.id = ${releaseId}
      `;
    }
    
    // Record the sale
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO sales (
        id,
        release_id,
        track_id,
        buyer_address,
        seller_address,
        nft_token_id,
        edition_number,
        price,
        platform_fee,
        tx_hash,
        created_at
      ) VALUES (
        ${saleId},
        ${releaseId},
        ${trackId},
        ${buyerAddress},
        ${artistAddress},
        ${nftTokenId},
        ${editionNumber},
        ${price},
        ${platformFee},
        ${acceptTxHash},
        NOW()
      )
    `;
    
    console.log('Sale confirmed:', saleId, 'Track:', trackId, 'Edition #', editionNumber);
    
    return res.json({
      success: true,
      saleId,
      editionNumber,
    });
    
  } catch (error) {
    console.error('Confirm sale error:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm sale' });
  }
}

async function handlePurchase(req, res, sql) {
  try {
    const {
      releaseId,
      trackId,  // Optional - for buying specific track from album
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
    
    // Get release details with tracks and their sold_counts
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'metadata_cid', t.metadata_cid,
              'sold_count', COALESCE(t.sold_count, 0)
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      WHERE r.id = ${releaseId}
      GROUP BY r.id
    `;
    
    const release = releases[0];
    
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    // If trackId specified, find that specific track
    let targetTrack = null;
    if (trackId && release.tracks) {
      targetTrack = release.tracks.find(t => t.id === trackId);
      if (!targetTrack) {
        return res.status(404).json({ error: 'Track not found in release' });
      }
      console.log('Buying specific track:', targetTrack.title, targetTrack.metadata_cid);
      
      // Check if THIS TRACK is still available
      const trackAvailable = release.total_editions - (targetTrack.sold_count || 0);
      if (trackAvailable <= 0) {
        return res.status(400).json({ error: `Track "${targetTrack.title}" is sold out` });
      }
    } else {
      // Check if release has any availability (for singles)
      const available = release.total_editions - release.sold_editions;
      if (available <= 0) {
        return res.status(400).json({ error: 'Sold out' });
      }
    }
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    
    // Build list of possible metadata CIDs for this release
    // If trackId is specified, ONLY look for that track's NFT
    const possibleCids = [];
    
    if (targetTrack && targetTrack.metadata_cid) {
      // Only search for the specific track's NFT
      possibleCids.push(targetTrack.metadata_cid);
      console.log('Looking for specific track NFT with CID:', targetTrack.metadata_cid);
    } else {
      // Search for any NFT from this release (singles or album-level)
      if (release.metadata_cid) {
        possibleCids.push(release.metadata_cid);
      }
      // Add track-level metadata CIDs
      if (release.tracks && Array.isArray(release.tracks)) {
        for (const track of release.tracks) {
          if (track.metadata_cid) {
            possibleCids.push(track.metadata_cid);
          }
        }
      }
      console.log('Looking for any NFT with CIDs:', possibleCids);
    }
    
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
      
      // Build expected URI hex values for all possible CIDs
      const expectedUriHexes = possibleCids.map(cid => 
        xrpl.convertStringToHex(`ipfs://${cid}`)
      );
      
      // Find NFT with matching URI (metadata)
      let nftToTransfer = null;
      let matchedCid = null;
      
      for (const nft of platformNFTs) {
        // Check if NFT URI matches any of our expected URIs
        const uriIndex = expectedUriHexes.indexOf(nft.URI);
        if (uriIndex !== -1) {
          nftToTransfer = nft;
          matchedCid = possibleCids[uriIndex];
          break;
        }
      }
      
      if (!nftToTransfer) {
        console.error('No matching NFT found for release:', releaseId, 'track:', trackId);
        console.error('Looking for URIs:', possibleCids.map(c => `ipfs://${c}`));
        console.error('Platform has', platformNFTs.length, 'NFTs');
        // Log first few NFT URIs for debugging
        console.error('First 5 NFT URIs:', platformNFTs.slice(0, 5).map(n => {
          try {
            return xrpl.convertHexToString(n.URI);
          } catch {
            return n.URI;
          }
        }));
        
        // REFUND the buyer since we can't fulfill the order
        if (buyerAddress && price > 0) {
          try {
            console.log('Refunding buyer:', buyerAddress, price, 'XRP');
            const refundTx = await client.autofill({
              TransactionType: 'Payment',
              Account: platformAddress,
              Destination: buyerAddress,
              Amount: xrpl.xrpToDrops(price.toFixed(6)),
              Memos: [{
                Memo: {
                  MemoType: xrpl.convertStringToHex('XRPMusic'),
                  MemoData: xrpl.convertStringToHex('Refund: NFT unavailable'),
                }
              }],
            });
            const signedRefund = platformWallet.sign(refundTx);
            const refundResult = await client.submitAndWait(signedRefund.tx_blob);
            console.log('Refund sent:', refundResult.result.hash);
          } catch (refundError) {
            console.error('Refund failed:', refundError);
          }
        }
        
        return res.status(400).json({ error: 'No NFT available for this release - payment refunded', refunded: true });
      }
      
      console.log('Found NFT to transfer:', nftToTransfer.NFTokenID);
      
      // Check if there's already an existing sell offer for this NFT
      try {
        const offersResponse = await client.request({
          command: 'nft_sell_offers',
          nft_id: nftToTransfer.NFTokenID,
        });
        
        const existingOffers = offersResponse.result.offers || [];
        console.log('Existing sell offers:', existingOffers.length);
        
        // If there's already an offer from platform, cancel it first
        for (const offer of existingOffers) {
          if (offer.owner === platformAddress) {
            console.log('Cancelling existing offer:', offer.nft_offer_index);
            try {
              const cancelTx = await client.autofill({
                TransactionType: 'NFTokenCancelOffer',
                Account: platformAddress,
                NFTokenOffers: [offer.nft_offer_index],
              });
              const signedCancel = platformWallet.sign(cancelTx);
              await client.submitAndWait(signedCancel.tx_blob);
              console.log('Cancelled existing offer');
            } catch (cancelErr) {
              console.error('Failed to cancel existing offer:', cancelErr);
            }
          }
        }
      } catch (offerCheckErr) {
        // nft_sell_offers returns error if no offers exist, which is fine
        console.log('No existing sell offers (or error checking):', offerCheckErr.message);
      }
      
      // Step 2: Create sell offer for buyer (Amount: 0 = free transfer)
      // Since buyer already paid, we transfer for free
      
      // Validate buyer address format
      if (!buyerAddress || !buyerAddress.startsWith('r') || buyerAddress.length < 25) {
        throw new Error(`Invalid buyer address: ${buyerAddress}`);
      }
      
      console.log('Creating sell offer:', {
        Account: platformAddress,
        NFTokenID: nftToTransfer.NFTokenID,
        Amount: '1', // 1 drop (essentially free)
        Destination: buyerAddress,
      });
      
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftToTransfer.NFTokenID,
        Amount: '1', // 1 drop - using 0 can cause issues with Destination
        Flags: 1, // tfSellNFToken
        Destination: buyerAddress, // Only buyer can accept
      });
      
      console.log('Autofilled tx:', JSON.stringify(createOfferTx, null, 2));
      
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        console.error('Create offer failed:', offerResult.result.meta.TransactionResult);
        
        // Refund the buyer since offer creation failed
        try {
          const refundTx = await client.autofill({
            TransactionType: 'Payment',
            Account: platformAddress,
            Destination: buyerAddress,
            Amount: xrpl.xrpToDrops(price.toFixed(6)),
            Memos: [{
              Memo: {
                MemoType: xrpl.convertStringToHex('XRPMusic'),
                MemoData: xrpl.convertStringToHex('Refund: Offer creation failed'),
              }
            }],
          });
          const signedRefund = platformWallet.sign(refundTx);
          const refundResult = await client.submitAndWait(signedRefund.tx_blob);
          console.log('Refund sent:', refundResult.result.hash);
          
          return res.status(400).json({ 
            error: `NFT transfer failed (${offerResult.result.meta.TransactionResult}) - payment refunded`,
            refunded: true,
            refundTxHash: refundResult.result.hash,
          });
        } catch (refundError) {
          console.error('Refund failed:', refundError);
          return res.status(500).json({ 
            error: `NFT transfer failed and refund also failed. Please contact support.`,
            refunded: false,
          });
        }
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
      
      // DON'T record sale yet - wait for buyer to confirm NFT acceptance
      // Return the data needed to confirm later
      const soldTrackId = targetTrack?.id || (release.tracks?.[0]?.id) || null;
      
      return res.json({
        success: true,
        sellOfferIndex: offerIndex,
        nftTokenId: nftToTransfer.NFTokenID,
        txHash: offerResult.result.hash,
        // Data for confirming sale after buyer accepts
        pendingSale: {
          releaseId,
          trackId: soldTrackId,
          buyerAddress,
          artistAddress,
          nftTokenId: nftToTransfer.NFTokenID,
          price,
          platformFee,
        },
        message: 'NFT ready for transfer!',
      });
      
    } catch (innerError) {
      console.error('Inner purchase error:', innerError);
      
      // Try to refund the buyer
      try {
        console.log('Attempting refund due to error:', innerError.message);
        const refundTx = await client.autofill({
          TransactionType: 'Payment',
          Account: platformAddress,
          Destination: buyerAddress,
          Amount: xrpl.xrpToDrops(price.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: xrpl.convertStringToHex('XRPMusic'),
              MemoData: xrpl.convertStringToHex('Refund: Transaction error'),
            }
          }],
        });
        const signedRefund = platformWallet.sign(refundTx);
        const refundResult = await client.submitAndWait(signedRefund.tx_blob);
        console.log('Error refund sent:', refundResult.result.hash);
        
        return res.status(500).json({ 
          error: innerError.message || 'Purchase failed',
          refunded: true,
          refundTxHash: refundResult.result.hash,
        });
      } catch (refundError) {
        console.error('Error refund failed:', refundError);
        return res.status(500).json({ 
          error: `Purchase failed: ${innerError.message}. Refund also failed - please contact support.`,
          refunded: false,
        });
      }
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    return res.status(500).json({ error: error.message || 'Purchase failed' });
  }
}
