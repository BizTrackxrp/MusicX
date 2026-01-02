/**
 * XRP Music - Album Purchase API
 * Handles buying all tracks in an album with one payment
 * 1. Buyer pays platform (total price for all tracks)
 * 2. Platform creates sell offers for ALL track NFTs
 * 3. Returns offer indexes for buyer to accept each
 * 4. Platform sends 98% to artist
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
    
    // Confirm each track sale
    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      const txHash = acceptTxHashes[i];
      
      const updateResult = await sql`
        UPDATE releases 
        SET sold_editions = sold_editions + 1
        WHERE id = ${sale.releaseId}
        RETURNING sold_editions
      `;
      
      const editionNumber = updateResult[0]?.sold_editions || 1;
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
              'metadata_cid', t.metadata_cid
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
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Get platform's NFTs
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
      
      for (const track of tracks) {
        if (!track.metadata_cid) {
          console.error('Track missing metadata_cid:', track.id);
          continue;
        }
        
        const expectedUri = xrpl.convertStringToHex(`ipfs://${track.metadata_cid}`);
        const nft = platformNFTs.find(n => n.URI === expectedUri);
        
        if (!nft) {
          console.error('NFT not found for track:', track.title, track.metadata_cid);
          // Refund and abort
          await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'NFT not found for track: ' + track.title);
          return res.status(400).json({ 
            error: `NFT not available for track: ${track.title}`,
            refunded: true 
          });
        }
        
        nftsToTransfer.push({ nft, track });
      }
      
      // Create sell offers for all found NFTs
      for (const { nft, track } of nftsToTransfer) {
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
          await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'Offer creation failed');
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
      
      return res.json({
        success: true,
        offerIndexes,
        pendingSales,
        trackCount: offerIndexes.length,
        message: `${offerIndexes.length} NFTs ready for transfer`,
      });
      
    } finally {
      await client.disconnect();
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
