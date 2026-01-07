/**
 * XRP Music - Album Purchase API
 * Handles buying all tracks in an album with one payment
 * Uses nfts table for inventory tracking
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
  
  const { action } = req.body;
  
  if (action === 'confirm') {
    return handleConfirmSale(req, res, sql);
  }
  
  return handleAlbumPurchase(req, res, sql);
}

async function handleConfirmSale(req, res, sql) {
  try {
    const { pendingSales, acceptTxHashes } = req.body;
    
    if (!pendingSales || !acceptTxHashes) {
      return res.status(400).json({ error: 'Missing pending sales data' });
    }
    
    const releaseId = pendingSales[0]?.releaseId;
    
    // Confirm each track sale
    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      const txHash = acceptTxHashes[i];
      
      // Update NFT status in nfts table
      if (sale.nftTokenId) {
        await sql`
          UPDATE nfts 
          SET status = 'sold', 
              owner_address = ${sale.buyerAddress},
              sold_at = NOW()
          WHERE nft_token_id = ${sale.nftTokenId}
        `;
      }
      
      // Calculate edition number from sales table
      let editionNumber = sale.editionNumber;
      if (!editionNumber && sale.trackId) {
        const salesCount = await sql`
          SELECT COUNT(*) as count FROM sales WHERE track_id = ${sale.trackId}
        `;
        editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
      }
      
      // Update track sold_count to match sales
      if (sale.trackId) {
        await sql`
          UPDATE tracks 
          SET sold_count = (
            SELECT COUNT(*) + 1 FROM sales WHERE track_id = ${sale.trackId}
          )
          WHERE id = ${sale.trackId}
        `;
      }
      
      // Record the sale
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;
      
      await sql`
        INSERT INTO sales (
          id, release_id, track_id, buyer_address, seller_address,
          nft_token_id, edition_number, price, platform_fee, tx_hash, created_at
        ) VALUES (
          ${saleId}, ${sale.releaseId}, ${sale.trackId}, ${sale.buyerAddress},
          ${sale.artistAddress}, ${sale.nftTokenId}, ${editionNumber},
          ${sale.price}, ${sale.platformFee}, ${txHash}, NOW()
        )
      `;
      
      console.log('Sale confirmed:', saleId, 'Track:', sale.trackId, 'NFT:', sale.nftTokenId, 'Edition #', editionNumber);
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
    
    return res.json({ success: true });
    
  } catch (error) {
    console.error('Confirm album sale error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleAlbumPurchase(req, res, sql) {
  try {
    const { releaseId, buyerAddress, paymentTxHash } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Get release with tracks
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
    
    const tracks = release.tracks || [];
    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks in release' });
    }
    
    const trackPrice = parseFloat(release.song_price) || 0;
    const totalPrice = trackPrice * tracks.length;
    const artistAddress = release.artist_address;
    
    // Check availability for all tracks using sales count
    for (const track of tracks) {
      const salesCount = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
      `;
      const soldCount = parseInt(salesCount[0]?.count) || 0;
      const available = release.total_editions - soldCount;
      
      if (available <= 0) {
        return res.status(400).json({ error: `Track "${track.title}" is sold out` });
      }
    }
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Get platform's NFTs (for legacy fallback)
      const nftsResponse = await client.request({
        command: 'account_nfts',
        account: platformAddress,
        limit: 400,
      });
      const platformNFTs = nftsResponse.result.account_nfts || [];
      
      // Find NFTs for each track
      const offerIndexes = [];
      const pendingSales = [];
      const nftsToTransfer = [];
      const pendingNftIds = []; // Track NFT IDs we've marked as pending
      
      for (const track of tracks) {
        let nft = null;
        let editionNumber = null;
        
        // Try to get from nfts table first (new system)
        const availableNfts = await sql`
          SELECT * FROM nfts 
          WHERE track_id = ${track.id} 
            AND status = 'available'
          ORDER BY edition_number ASC
          LIMIT 1
        `;
        
        if (availableNfts.length > 0) {
          const nftRecord = availableNfts[0];
          nft = { NFTokenID: nftRecord.nft_token_id };
          editionNumber = nftRecord.edition_number;
          console.log('Found NFT in database for track:', track.title, nftRecord.nft_token_id, 'Edition:', editionNumber);
          
          // Mark as pending
          await sql`UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}`;
          pendingNftIds.push(nftRecord.id);
        } else {
          // Fallback to on-chain search (legacy)
          if (!track.metadata_cid) {
            console.error('Track missing metadata_cid:', track.id);
            continue;
          }
          
          const expectedUri = xrpl.convertStringToHex(`ipfs://${track.metadata_cid}`);
          nft = platformNFTs.find(n => n.URI === expectedUri);
          
          if (!nft) {
            console.error('NFT not found for track:', track.title, track.metadata_cid);
            // Reset any NFTs we marked as pending
            for (const nftId of pendingNftIds) {
              await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftId}`;
            }
            await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'NFT not found for track: ' + track.title);
            await client.disconnect();
            return res.status(400).json({ 
              error: `NFT not available for track: ${track.title}`,
              refunded: true 
            });
          }
        }
        
        nftsToTransfer.push({ nft, track, editionNumber });
      }
      
      // Create sell offers for all NFTs
      for (const { nft, track, editionNumber } of nftsToTransfer) {
        // Cancel any existing offers first
        try {
          const offersResponse = await client.request({
            command: 'nft_sell_offers',
            nft_id: nft.NFTokenID,
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
        
        // Create new sell offer
        const createOfferTx = await client.autofill({
          TransactionType: 'NFTokenCreateOffer',
          Account: platformAddress,
          NFTokenID: nft.NFTokenID,
          Amount: '1', // 1 drop (buyer already paid)
          Flags: 1, // tfSellNFToken
          Destination: buyerAddress,
        });
        
        const signedOffer = platformWallet.sign(createOfferTx);
        const offerResult = await client.submitAndWait(signedOffer.tx_blob);
        
        if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          console.error('Create offer failed for track:', track.title);
          // Reset pending NFTs
          for (const nftId of pendingNftIds) {
            await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftId}`;
          }
          await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'Offer creation failed');
          await client.disconnect();
          return res.status(400).json({ 
            error: 'Failed to create offer for: ' + track.title,
            refunded: true 
          });
        }
        
        // Get offer index
        let offerIndex = null;
        for (const node of offerResult.result.meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
            offerIndex = node.CreatedNode.LedgerIndex;
            break;
          }
        }
        
        offerIndexes.push(offerIndex);
        
        const platformFee = trackPrice * (PLATFORM_FEE_PERCENT / 100);
        pendingSales.push({
          releaseId,
          trackId: track.id,
          buyerAddress,
          artistAddress,
          nftTokenId: nft.NFTokenID,
          editionNumber: editionNumber,
          price: trackPrice,
          platformFee,
        });
      }
      
      // Pay artist (98% of total)
      const platformFeeTotal = totalPrice * (PLATFORM_FEE_PERCENT / 100);
      const artistPayment = totalPrice - platformFeeTotal;
      
      if (artistPayment > 0) {
        const paymentTx = await client.autofill({
          TransactionType: 'Payment',
          Account: platformAddress,
          Destination: artistAddress,
          Amount: xrpl.xrpToDrops(artistPayment.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: xrpl.convertStringToHex('XRPMusic'),
              MemoData: xrpl.convertStringToHex(`Album Sale: ${release.title}`),
            }
          }],
        });
        
        const signedPayment = platformWallet.sign(paymentTx);
        await client.submitAndWait(signedPayment.tx_blob);
      }
      
      await client.disconnect();
      
      return res.json({
        success: true,
        offerIndexes,
        pendingSales,
        trackCount: offerIndexes.length,
        message: `${offerIndexes.length} NFTs ready for transfer`,
      });
      
    } catch (innerError) {
      console.error('Album purchase error:', innerError);
      // Reset pending NFTs on error
      await client.disconnect();
      throw innerError;
    }
    
  } catch (error) {
    console.error('Album purchase error:', error);
    return res.status(500).json({ error: error.message });
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
