/**
 * XRP Music - Purchase API
 * Platform already owns the NFTs, so we:
 * 1. Buyer pays platform
 * 2. Platform transfers 1 NFT to buyer (from nfts table inventory)
 * 3. Platform sends 98% to artist
 * 4. Platform keeps 2%
 * 
 * IMPORTANT: Only NFTs tracked in the database can be sold.
 * No fallback to on-chain search - this prevents wrong NFT transfers.
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
  
  if (action === 'check') {
    return handleAvailabilityCheck(req, res, sql);
  }
  
  // Default: handle purchase
  return handlePurchase(req, res, sql);
}

/**
 * PRE-CHECK: Verify NFT availability BEFORE payment
 * This prevents users from paying for sold-out items
 */
async function handleAvailabilityCheck(req, res, sql) {
  try {
    const { releaseId, trackId } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }
    
    // Get release details
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
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
      return res.status(404).json({ 
        available: false, 
        error: 'Release not found' 
      });
    }
    
    // Determine which track to check
    let targetTrackId = trackId;
    let targetTrack = null;
    
    if (trackId && release.tracks) {
      targetTrack = release.tracks.find(t => t.id === trackId);
      if (!targetTrack) {
        return res.status(404).json({ 
          available: false, 
          error: 'Track not found in release' 
        });
      }
    } else if (release.tracks?.length > 0) {
      targetTrack = release.tracks[0];
      targetTrackId = targetTrack.id;
    }
    
    // Check ACTUAL NFT availability in database
    if (targetTrackId) {
      const availableNfts = await sql`
        SELECT COUNT(*) as count FROM nfts 
        WHERE track_id = ${targetTrackId} 
          AND status = 'available'
      `;
      
      const availableCount = parseInt(availableNfts[0]?.count) || 0;
      
      if (availableCount === 0) {
        return res.json({ 
          available: false, 
          error: `"${targetTrack?.title || 'This track'}" is sold out`,
          soldOut: true
        });
      }
      
      return res.json({ 
        available: true, 
        availableCount,
        trackTitle: targetTrack?.title,
        price: parseFloat(release.song_price) || parseFloat(release.album_price) || 0
      });
    }
    
    // No track found
    return res.status(400).json({ 
      available: false, 
      error: 'No tracks found for this release' 
    });
    
  } catch (error) {
    console.error('Availability check error:', error);
    return res.status(500).json({ 
      available: false, 
      error: error.message || 'Failed to check availability' 
    });
  }
}

// Confirm sale after buyer successfully accepts NFT
async function handleConfirmSale(req, res, sql) {
  try {
    const { pendingSale, acceptTxHash } = req.body;
    
    if (!pendingSale || !acceptTxHash) {
      return res.status(400).json({ error: 'Missing pending sale data or transaction hash' });
    }
    
    const { releaseId, trackId, buyerAddress, artistAddress, nftTokenId, price, platformFee } = pendingSale;
    
    // Update the NFT status in nfts table
    if (nftTokenId) {
      await sql`
        UPDATE nfts 
        SET status = 'sold', 
            owner_address = ${buyerAddress},
            sold_at = NOW()
        WHERE nft_token_id = ${nftTokenId}
      `;
    }
    
    // ALWAYS calculate edition number from sales count (sale order, not mint order)
    let finalEditionNumber = 1;
    
    if (trackId) {
      // Count existing sales for this track to determine edition number
      const salesCount = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${trackId}
      `;
      finalEditionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
    }
    
    // Update the NFT's edition_number to match sale order (not mint order)
    if (nftTokenId) {
      await sql`
        UPDATE nfts 
        SET edition_number = ${finalEditionNumber}
        WHERE nft_token_id = ${nftTokenId}
      `;
    }
    
    // Update track sold_count to match sales
    if (trackId) {
      await sql`
        UPDATE tracks 
        SET sold_count = (
          SELECT COUNT(*) + 1 FROM sales WHERE track_id = ${trackId}
        )
        WHERE id = ${trackId}
      `;
    }
    
    // Update release sold_editions = MIN of all track sold_counts
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
        ${finalEditionNumber},
        ${price},
        ${platformFee},
        ${acceptTxHash},
        NOW()
      )
    `;
    
    console.log('Sale confirmed:', saleId, 'Track:', trackId, 'NFT:', nftTokenId, 'Edition #', finalEditionNumber);
    
    return res.json({
      success: true,
      saleId,
      editionNumber: finalEditionNumber,
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
    
    // Get release details
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
    
    // Determine which track to sell
    let targetTrack = null;
    let targetTrackId = trackId;
    
    if (trackId && release.tracks) {
      targetTrack = release.tracks.find(t => t.id === trackId);
      if (!targetTrack) {
        return res.status(404).json({ error: 'Track not found in release' });
      }
    } else if (release.tracks?.length > 0) {
      // Default to first track for singles
      targetTrack = release.tracks[0];
      targetTrackId = targetTrack.id;
    }
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    
    // Get NFT from nfts table - this is the ONLY way to get an NFT now
    let nftToTransfer = null;
    let editionNumber = null;
    let nftRecordId = null;
    
    if (targetTrackId) {
      const availableNfts = await sql`
        SELECT * FROM nfts 
        WHERE track_id = ${targetTrackId} 
          AND status = 'available'
        ORDER BY edition_number ASC
        LIMIT 1
      `;
      
      if (availableNfts.length > 0) {
        const nftRecord = availableNfts[0];
        nftToTransfer = { NFTokenID: nftRecord.nft_token_id };
        editionNumber = nftRecord.edition_number;
        nftRecordId = nftRecord.id;
        console.log('Found NFT in database:', nftRecord.nft_token_id, 'Edition:', editionNumber);
        
        // Mark as pending (will be confirmed after buyer accepts)
        await sql`
          UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}
        `;
      }
    }
    
    // NO FALLBACK - if NFT not in database, it's sold out
    if (!nftToTransfer) {
      console.error('No NFT available in database for track:', targetTrackId);
      return res.status(400).json({ 
        error: `"${targetTrack?.title || 'This track'}" is sold out`,
        soldOut: true 
      });
    }
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      console.log('Transferring NFT:', nftToTransfer.NFTokenID);
      
      // Cancel any existing offers for this NFT
      try {
        const offersResponse = await client.request({
          command: 'nft_sell_offers',
          nft_id: nftToTransfer.NFTokenID,
        });
        
        for (const offer of (offersResponse.result.offers || [])) {
          if (offer.owner === platformAddress) {
            const cancelTx = await client.autofill({
              TransactionType: 'NFTokenCancelOffer',
              Account: platformAddress,
              NFTokenOffers: [offer.nft_offer_index],
            });
            const signedCancel = platformWallet.sign(cancelTx);
            await client.submitAndWait(signedCancel.tx_blob);
          }
        }
      } catch (e) {
        // No existing offers, that's fine
      }
      
      // Create sell offer for buyer
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftToTransfer.NFTokenID,
        Amount: '1', // 1 drop
        Flags: 1, // tfSellNFToken
        Destination: buyerAddress,
      });
      
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        // Reset NFT status
        if (nftRecordId) {
          await sql`
            UPDATE nfts SET status = 'available' 
            WHERE id = ${nftRecordId}
          `;
        }
        await refundBuyer(client, platformWallet, platformAddress, buyerAddress, price, 'Offer creation failed');
        await client.disconnect();
        return res.status(400).json({ error: 'NFT transfer failed - payment refunded', refunded: true });
      }
      
      // Get offer index
      let offerIndex = null;
      for (const node of offerResult.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerIndex = node.CreatedNode.LedgerIndex;
          break;
        }
      }
      
      // Pay artist (98%)
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
        await client.submitAndWait(signedPayment.tx_blob);
      }
      
      await client.disconnect();
      
      return res.json({
        success: true,
        sellOfferIndex: offerIndex,
        nftTokenId: nftToTransfer.NFTokenID,
        txHash: offerResult.result.hash,
        pendingSale: {
          releaseId,
          trackId: targetTrackId,
          buyerAddress,
          artistAddress,
          nftTokenId: nftToTransfer.NFTokenID,
          editionNumber: editionNumber,
          price,
          platformFee,
        },
        message: 'NFT ready for transfer!',
      });
      
    } catch (innerError) {
      console.error('Purchase error:', innerError);
      // Reset NFT status
      if (nftRecordId) {
        await sql`
          UPDATE nfts SET status = 'available' 
          WHERE id = ${nftRecordId}
        `;
      }
      try {
        await refundBuyer(client, platformWallet, platformAddress, buyerAddress, price, 'Transaction error');
        await client.disconnect();
        return res.status(500).json({ error: innerError.message, refunded: true });
      } catch (refundError) {
        await client.disconnect();
        return res.status(500).json({ error: innerError.message, refunded: false });
      }
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    return res.status(500).json({ error: error.message || 'Purchase failed' });
  }
}

async function refundBuyer(client, platformWallet, platformAddress, buyerAddress, amount, reason) {
  try {
    console.log('Refunding buyer:', buyerAddress, amount, 'XRP -', reason);
    const refundTx = await client.autofill({
      TransactionType: 'Payment',
      Account: platformAddress,
      Destination: buyerAddress,
      Amount: xrpl.xrpToDrops(amount.toFixed(6)),
      Memos: [{
        Memo: {
          MemoType: xrpl.convertStringToHex('XRPMusic'),
          MemoData: xrpl.convertStringToHex('Refund: ' + reason),
        }
      }],
    });
    const signedRefund = platformWallet.sign(refundTx);
    const result = await client.submitAndWait(signedRefund.tx_blob);
    console.log('Refund sent:', result.result.hash);
    return result.result.hash;
  } catch (error) {
    console.error('Refund failed:', error);
    return null;
  }
}
