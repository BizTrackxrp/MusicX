/**
 * XRP Music - Purchase API (Lazy Minting)
 * 
 * Flow:
 * 1. Buyer pays platform
 * 2. Check for pre-minted NFT in DB
 *    - If exists: use it
 *    - If not: mint one on-demand (using artist's pre-paid mint fee)
 * 3. Platform creates sell offer → buyer accepts
 * 4. Platform sends 98% to artist
 * 5. Platform keeps 2%
 * 
 * Lazy minting = NFTs mint at purchase time, not upfront.
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
  
  if (action === 'check') {
    return handleAvailabilityCheck(req, res, sql);
  }
  
  return handlePurchase(req, res, sql);
}

/**
 * PRE-CHECK: Verify NFT availability BEFORE payment
 * With lazy minting, we check if editions remain (not if NFTs exist)
 */
async function handleAvailabilityCheck(req, res, sql) {
  try {
    const { releaseId, trackId } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }
    
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'sold_count', COALESCE(t.sold_count, 0),
              'minted_editions', COALESCE(t.minted_editions, 0)
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
    
    // Check if release is live (mint fee paid)
    if (!release.mint_fee_paid && release.status !== 'live') {
      return res.status(400).json({
        available: false,
        error: 'Release not yet available for purchase'
      });
    }
    
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
    
    if (targetTrack) {
      // With lazy minting: check sold_count vs total_editions
      const soldCount = targetTrack.sold_count || 0;
      const totalEditions = release.total_editions || 0;
      const availableCount = totalEditions - soldCount;
      
      if (availableCount <= 0) {
        return res.json({ 
          available: false, 
          error: `"${targetTrack.title}" is sold out`,
          soldOut: true
        });
      }
      
      return res.json({ 
        available: true, 
        availableCount,
        trackTitle: targetTrack.title,
        price: parseFloat(release.song_price) || parseFloat(release.album_price) || 0
      });
    }
    
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

/**
 * Confirm sale after buyer successfully accepts NFT
 */
async function handleConfirmSale(req, res, sql) {
  try {
    const { pendingSale, acceptTxHash } = req.body;
    
    if (!pendingSale || !acceptTxHash) {
      return res.status(400).json({ error: 'Missing pending sale data or transaction hash' });
    }
    
    const { releaseId, trackId, buyerAddress, artistAddress, nftTokenId, price, platformFee, editionNumber } = pendingSale;
    
    // Update NFT status to sold
    if (nftTokenId) {
      await sql`
        UPDATE nfts 
        SET status = 'sold', 
            owner_address = ${buyerAddress},
            sold_at = NOW()
        WHERE nft_token_id = ${nftTokenId}
      `;
    }
    
    // Update track sold_count
    if (trackId) {
      await sql`
        UPDATE tracks 
        SET sold_count = COALESCE(sold_count, 0) + 1
        WHERE id = ${trackId}
      `;
    }
    
    // Update release sold_editions (MIN of all track sold_counts)
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
    
    console.log('✅ Sale confirmed:', saleId, 'Track:', trackId, 'NFT:', nftTokenId, 'Edition #', editionNumber);
    
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

/**
 * Main purchase handler - with lazy minting support
 */
async function handlePurchase(req, res, sql) {
  try {
    const { releaseId, trackId, buyerAddress, paymentTxHash } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
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
              'sold_count', COALESCE(t.sold_count, 0),
              'minted_editions', COALESCE(t.minted_editions, 0)
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
    
    // Verify release is live
    if (!release.mint_fee_paid && release.status !== 'live') {
      return res.status(400).json({ error: 'Release not available for purchase' });
    }
    
    // Determine target track
    let targetTrack = null;
    let targetTrackId = trackId;
    
    if (trackId && release.tracks) {
      targetTrack = release.tracks.find(t => t.id === trackId);
      if (!targetTrack) {
        return res.status(404).json({ error: 'Track not found in release' });
      }
    } else if (release.tracks?.length > 0) {
      targetTrack = release.tracks[0];
      targetTrackId = targetTrack.id;
    }
    
    if (!targetTrack) {
      return res.status(400).json({ error: 'No track found' });
    }
    
    // Check if sold out (sold_count >= total_editions)
    const soldCount = targetTrack.sold_count || 0;
    const totalEditions = release.total_editions || 0;
    
    if (soldCount >= totalEditions) {
      return res.status(400).json({ 
        error: `"${targetTrack.title}" is sold out`,
        soldOut: true 
      });
    }
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
    
    let nftTokenId = null;
    let editionNumber = null;
    let nftRecordId = null;
    let didLazyMint = false;
    
    try {
      // STEP 1: Try to find existing pre-minted NFT
      const availableNfts = await sql`
        SELECT * FROM nfts 
        WHERE track_id = ${targetTrackId} 
          AND status = 'available'
        ORDER BY edition_number ASC
        LIMIT 1
      `;
      
      if (availableNfts.length > 0) {
        // Use existing NFT
        const nftRecord = availableNfts[0];
        nftTokenId = nftRecord.nft_token_id;
        editionNumber = nftRecord.edition_number;
        nftRecordId = nftRecord.id;
        console.log('📦 Using pre-minted NFT:', nftTokenId, 'Edition:', editionNumber);
        
        // Mark as pending
        await sql`
          UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}
        `;
      } else {
        // STEP 2: No pre-minted NFT - do lazy mint!
        console.log('🎵 No pre-minted NFT found, lazy minting...');
        
        const mintResult = await mintSingleNFT(
          client, 
          platformWallet, 
          platformAddress, 
          targetTrack, 
          release, 
          sql
        );
        
        nftTokenId = mintResult.nftTokenId;
        editionNumber = mintResult.editionNumber;
        nftRecordId = mintResult.nftRecordId;
        didLazyMint = true;
        
        console.log('✅ Lazy minted NFT:', nftTokenId, 'Edition:', editionNumber);
      }
      
      // STEP 3: Cancel any existing offers for this NFT
      try {
        const offersResponse = await client.request({
          command: 'nft_sell_offers',
          nft_id: nftTokenId,
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
      
      // STEP 4: Create sell offer for buyer
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftTokenId,
        Amount: '1', // 1 drop (essentially free, buyer already paid)
        Flags: 1, // tfSellNFToken
        Destination: buyerAddress,
      });
      
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        // Reset NFT status
        if (nftRecordId) {
          await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
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
      
      // STEP 5: Pay artist (98%)
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
        console.log('💰 Paid artist:', artistPayment, 'XRP');
      }
      
      await client.disconnect();
      
      return res.json({
        success: true,
        sellOfferIndex: offerIndex,
        nftTokenId: nftTokenId,
        txHash: offerResult.result.hash,
        lazyMinted: didLazyMint,
        pendingSale: {
          releaseId,
          trackId: targetTrackId,
          buyerAddress,
          artistAddress,
          nftTokenId: nftTokenId,
          editionNumber: editionNumber,
          price,
          platformFee,
        },
        message: didLazyMint ? 'NFT minted and ready!' : 'NFT ready for transfer!',
      });
      
    } catch (innerError) {
      console.error('Purchase error:', innerError);
      
      // Reset NFT status if we have a record
      if (nftRecordId) {
        await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
      }
      
      // Try to refund
      try {
        await refundBuyer(client, platformWallet, platformAddress, buyerAddress, price, innerError.message);
        await client.disconnect();
        return res.status(500).json({ error: innerError.message, refunded: true });
      } catch (refundError) {
        console.error('Refund also failed:', refundError);
        await client.disconnect();
        return res.status(500).json({ error: innerError.message, refunded: false });
      }
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    return res.status(500).json({ error: error.message || 'Purchase failed' });
  }
}

/**
 * Mint a single NFT on-demand (lazy minting)
 */
async function mintSingleNFT(client, platformWallet, platformAddress, track, release, sql) {
  console.log('🎵 Lazy minting NFT for track:', track.id, track.title);
  
  // Build metadata URI
  const metadataUri = track.metadata_cid 
    ? `ipfs://${track.metadata_cid}`
    : null;
  
  if (!metadataUri) {
    throw new Error('Track missing metadata CID - cannot mint');
  }
  
  // Convert URI to hex
  const uriHex = Buffer.from(metadataUri).toString('hex').toUpperCase();
  
  // Calculate transfer fee (royalty) - XRPL uses basis points (50000 = 50%, 5000 = 5%)
  const royaltyPercent = release.royalty_percent || 5;
  const transferFee = Math.round(royaltyPercent * 1000); // 5% = 5000
  
  // Mint the NFT
  const mintTx = await client.autofill({
    TransactionType: 'NFTokenMint',
    Account: platformAddress,
    URI: uriHex,
    Flags: 8, // tfTransferable
    TransferFee: transferFee,
    NFTokenTaxon: 0,
  });
  
  const signedMint = platformWallet.sign(mintTx);
  const mintResult = await client.submitAndWait(signedMint.tx_blob);
  
  if (mintResult.result.meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Mint failed: ${mintResult.result.meta.TransactionResult}`);
  }
  
  // Extract NFT Token ID
  const nftTokenId = extractNFTokenID(mintResult.result.meta);
  
  if (!nftTokenId) {
    throw new Error('Could not extract NFT Token ID from mint result');
  }
  
  console.log('✅ Minted NFT:', nftTokenId);
  
  // Calculate edition number based on how many have been minted for this track
  const mintedCount = await sql`
    SELECT COALESCE(minted_editions, 0) as count FROM tracks WHERE id = ${track.id}
  `;
  const editionNumber = (parseInt(mintedCount[0]?.count) || 0) + 1;
  
  // Insert NFT record
  const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await sql`
    INSERT INTO nfts (
      id,
      nft_token_id,
      release_id,
      track_id,
      edition_number,
      owner_address,
      status,
      created_at
    ) VALUES (
      ${nftId},
      ${nftTokenId},
      ${release.id},
      ${track.id},
      ${editionNumber},
      ${platformAddress},
      'pending',
      NOW()
    )
  `;
  
  // Update track minted_editions count
  await sql`
    UPDATE tracks 
    SET minted_editions = COALESCE(minted_editions, 0) + 1
    WHERE id = ${track.id}
  `;
  
  // Update release minted_editions count
  await sql`
    UPDATE releases 
    SET minted_editions = COALESCE(minted_editions, 0) + 1
    WHERE id = ${release.id}
  `;
  
  return {
    nftTokenId,
    editionNumber,
    nftRecordId: nftId,
  };
}

/**
 * Extract NFT Token ID from mint transaction metadata
 */
function extractNFTokenID(meta) {
  if (!meta?.AffectedNodes) return null;
  
  for (const node of meta.AffectedNodes) {
    // Check CreatedNode (new NFTokenPage)
    if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
      const nfts = node.CreatedNode.NewFields?.NFTokens;
      if (nfts?.length > 0) {
        return nfts[nfts.length - 1].NFToken?.NFTokenID;
      }
    }
    
    // Check ModifiedNode (existing NFTokenPage with new NFT added)
    if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
      const prevNfts = node.ModifiedNode.PreviousFields?.NFTokens || [];
      const finalNfts = node.ModifiedNode.FinalFields?.NFTokens || [];
      
      // Find the new NFT (in final but not in previous)
      const prevIds = new Set(prevNfts.map(n => n.NFToken?.NFTokenID));
      for (const nft of finalNfts) {
        if (!prevIds.has(nft.NFToken?.NFTokenID)) {
          return nft.NFToken?.NFTokenID;
        }
      }
    }
  }
  
  return null;
}

/**
 * Refund buyer if something goes wrong
 */
async function refundBuyer(client, platformWallet, platformAddress, buyerAddress, amount, reason) {
  try {
    console.log('💸 Refunding buyer:', buyerAddress, amount, 'XRP -', reason);
    
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
    console.log('✅ Refund sent:', result.result.hash);
    return result.result.hash;
  } catch (error) {
    console.error('❌ Refund failed:', error);
    return null;
  }
}
