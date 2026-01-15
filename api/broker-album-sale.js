/**
 * XRP Music - Album Purchase API (Unified: Legacy + Lazy Minting)
 * Handles buying all tracks in an album with one payment
 * 
 * Supports TWO systems:
 * 1. LAZY MINT (new): mint_fee_paid=true, NFTs mint on-demand at purchase
 * 2. LEGACY (old): is_minted=true, NFTs pre-minted in platform wallet
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
  
  return handleAlbumPurchase(req, res, sql);
}

/**
 * Check if a release is available for purchase
 * Supports both legacy (is_minted) and new (mint_fee_paid) systems
 */
function isReleaseAvailable(release) {
  return (
    release.mint_fee_paid === true ||
    release.status === 'live' ||
    release.is_minted === true ||
    (release.sell_offer_index && release.sell_offer_index.length > 0)
  );
}

/**
 * Check if release uses lazy minting (vs legacy pre-minted)
 */
function isLazyMintRelease(release) {
  return release.mint_fee_paid === true || release.status === 'live';
}

/**
 * Check availability for all tracks in album BEFORE payment
 */
async function handleAvailabilityCheck(req, res, sql) {
  try {
    const { releaseId } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
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
      return res.status(404).json({ 
        available: false, 
        error: 'Release not found' 
      });
    }
    
    // Check if release is available (legacy OR lazy mint)
    if (!isReleaseAvailable(release)) {
      return res.status(400).json({
        available: false,
        error: 'Release not yet available for purchase'
      });
    }
    
    const tracks = release.tracks || [];
    if (tracks.length === 0) {
      return res.status(400).json({ 
        available: false, 
        error: 'No tracks in release' 
      });
    }
    
    const useLazyMint = isLazyMintRelease(release);
    const unavailableTracks = [];
    
    if (useLazyMint) {
      // For lazy mint: check sold_count vs total_editions
      for (const track of tracks) {
        const soldCount = track.sold_count || 0;
        const available = release.total_editions - soldCount;
        if (available <= 0) {
          unavailableTracks.push(track.title);
        }
      }
    } else {
      // For legacy: check nfts table AND on-chain
      const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
      let platformNFTs = [];
      
      // Get platform wallet NFTs for legacy check
      try {
        const client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();
        const nftsResponse = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
        });
        platformNFTs = nftsResponse.result.account_nfts || [];
        await client.disconnect();
      } catch (e) {
        console.error('Failed to get platform NFTs:', e.message);
      }
      
      for (const track of tracks) {
        // Check database first
        const availableNfts = await sql`
          SELECT id FROM nfts 
          WHERE track_id = ${track.id} 
            AND status = 'available'
          LIMIT 1
        `;
        
        if (availableNfts.length === 0) {
          // Check on-chain
          if (track.metadata_cid) {
            const expectedUri = xrpl.convertStringToHex(`ipfs://${track.metadata_cid}`);
            const hasOnChain = platformNFTs.some(n => n.URI === expectedUri);
            if (!hasOnChain) {
              unavailableTracks.push(track.title);
            }
          } else {
            unavailableTracks.push(track.title);
          }
        }
      }
    }
    
    if (unavailableTracks.length > 0) {
      return res.status(400).json({ 
        available: false, 
        soldOut: true,
        error: unavailableTracks.length === tracks.length 
          ? 'Album is sold out'
          : `Sold out: ${unavailableTracks.join(', ')}`
      });
    }
    
    return res.json({ 
      available: true,
      releaseId,
      trackCount: tracks.length,
      releaseType: useLazyMint ? 'lazy_mint' : 'legacy'
    });
    
  } catch (error) {
    console.error('Album availability check error:', error);
    return res.status(500).json({ 
      available: false, 
      error: error.message 
    });
  }
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
      
      // Calculate edition number from sales count (sale order, not mint order)
      let editionNumber = null;
      if (sale.trackId) {
        const salesCount = await sql`
          SELECT COUNT(*) as count FROM sales WHERE track_id = ${sale.trackId}
        `;
        editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
      }
      
      // Update NFT status in nfts table
      if (sale.nftTokenId) {
        await sql`
          UPDATE nfts 
          SET status = 'sold', 
              owner_address = ${sale.buyerAddress},
              edition_number = ${editionNumber},
              sold_at = NOW()
          WHERE nft_token_id = ${sale.nftTokenId}
        `;
      }
      
      // Update track sold_count
      if (sale.trackId) {
        await sql`
          UPDATE tracks 
          SET sold_count = COALESCE(sold_count, 0) + 1
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
      
      console.log('✅ Sale confirmed:', saleId, 'Track:', sale.trackId, 'NFT:', sale.nftTokenId, 'Edition #', editionNumber);
    }
    
    // Update release sold_editions = MIN of all track sold_counts (for albums)
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
    
    // Verify release is available (legacy OR lazy mint)
    if (!isReleaseAvailable(release)) {
      return res.status(400).json({ error: 'Release not available for purchase' });
    }
    
    const tracks = release.tracks || [];
    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks in release' });
    }
    
    const trackPrice = parseFloat(release.song_price) || 0;
    const totalPrice = trackPrice * tracks.length;
    const artistAddress = release.artist_address;
    const useLazyMint = isLazyMintRelease(release);
    
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
      
      // Find/create NFTs for each track
      const offerIndexes = [];
      const pendingSales = [];
      const nftsToTransfer = [];
      const pendingNftRecordIds = []; // Track NFT record IDs we've marked as pending
      
      for (const track of tracks) {
        let nftTokenId = null;
        let editionNumber = null;
        let nftRecordId = null;
        let didLazyMint = false;
        
        // Check availability first
        if (useLazyMint) {
          const soldCount = track.sold_count || 0;
          if (soldCount >= release.total_editions) {
            // Reset any pending NFTs
            for (const id of pendingNftRecordIds) {
              await sql`UPDATE nfts SET status = 'available' WHERE id = ${id}`;
            }
            await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, `Track "${track.title}" is sold out`);
            await client.disconnect();
            return res.status(400).json({ 
              error: `Track "${track.title}" is sold out`,
              refunded: true 
            });
          }
        }
        
        // STEP 1: Try to get from nfts table first
        const availableNfts = await sql`
          SELECT * FROM nfts 
          WHERE track_id = ${track.id} 
            AND status = 'available'
          ORDER BY edition_number ASC
          LIMIT 1
        `;
        
        if (availableNfts.length > 0) {
          const nftRecord = availableNfts[0];
          nftTokenId = nftRecord.nft_token_id;
          editionNumber = nftRecord.edition_number;
          nftRecordId = nftRecord.id;
          console.log('📦 Found NFT in database for track:', track.title, nftTokenId, 'Edition:', editionNumber);
          
          // Mark as pending
          await sql`UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}`;
          pendingNftRecordIds.push(nftRecord.id);
        } else if (!useLazyMint) {
          // STEP 2: Legacy - check on-chain
          if (!track.metadata_cid) {
            console.error('Track missing metadata_cid:', track.id);
            for (const id of pendingNftRecordIds) {
              await sql`UPDATE nfts SET status = 'available' WHERE id = ${id}`;
            }
            await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'Track missing metadata: ' + track.title);
            await client.disconnect();
            return res.status(400).json({ 
              error: `Track "${track.title}" is missing metadata`,
              refunded: true 
            });
          }
          
          const expectedUri = xrpl.convertStringToHex(`ipfs://${track.metadata_cid}`);
          const matchingNft = platformNFTs.find(n => n.URI === expectedUri);
          
          if (matchingNft) {
            nftTokenId = matchingNft.NFTokenID;
            
            // Calculate edition from sales count
            const salesCount = await sql`
              SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
            `;
            editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
            
            console.log('📦 Found legacy NFT on-chain:', nftTokenId, 'Will be Edition:', editionNumber);
            
            // Create NFT record for tracking
            nftRecordId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await sql`
              INSERT INTO nfts (
                id, nft_token_id, release_id, track_id, edition_number,
                owner_address, status, created_at
              ) VALUES (
                ${nftRecordId}, ${nftTokenId}, ${releaseId}, ${track.id},
                ${editionNumber}, ${platformAddress}, 'pending', NOW()
              )
            `;
            pendingNftRecordIds.push(nftRecordId);
            
            // Remove from platformNFTs array so we don't reuse it
            const idx = platformNFTs.findIndex(n => n.NFTokenID === nftTokenId);
            if (idx >= 0) platformNFTs.splice(idx, 1);
          } else {
            // Not found - sold out
            for (const id of pendingNftRecordIds) {
              await sql`UPDATE nfts SET status = 'available' WHERE id = ${id}`;
            }
            await refundBuyer(client, platformWallet, platformAddress, buyerAddress, totalPrice, 'NFT not found for track: ' + track.title);
            await client.disconnect();
            return res.status(400).json({ 
              error: `NFT not available for track: ${track.title}`,
              refunded: true 
            });
          }
        } else {
          // STEP 3: Lazy mint - create NFT on-demand
          console.log('🎵 Lazy minting NFT for track:', track.title);
          
          const mintResult = await mintSingleNFT(
            client, 
            platformWallet, 
            platformAddress, 
            track, 
            release, 
            sql
          );
          
          nftTokenId = mintResult.nftTokenId;
          editionNumber = mintResult.editionNumber;
          nftRecordId = mintResult.nftRecordId;
          didLazyMint = true;
          pendingNftRecordIds.push(nftRecordId);
          
          console.log('✅ Lazy minted NFT:', nftTokenId, 'Edition:', editionNumber);
          
          // Wait for ledger to settle before creating sell offer
          console.log('⏳ Waiting for ledger to settle...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        nftsToTransfer.push({ 
          nftTokenId, 
          track, 
          editionNumber, 
          nftRecordId,
          didLazyMint 
        });
      }
      
      // Create sell offers for all NFTs
      for (const { nftTokenId, track, editionNumber } of nftsToTransfer) {
        // Cancel any existing offers first
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
        
        // Create new sell offer
        const createOfferTx = await client.autofill({
          TransactionType: 'NFTokenCreateOffer',
          Account: platformAddress,
          NFTokenID: nftTokenId,
          Amount: '1', // 1 drop (buyer already paid)
          Flags: 1, // tfSellNFToken
          Destination: buyerAddress,
        });
        
        const signedOffer = platformWallet.sign(createOfferTx);
        const offerResult = await client.submitAndWait(signedOffer.tx_blob);
        
        if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          console.error('Create offer failed for track:', track.title);
          // Reset pending NFTs
          for (const id of pendingNftRecordIds) {
            await sql`UPDATE nfts SET status = 'available' WHERE id = ${id}`;
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
          nftTokenId: nftTokenId,
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
        console.log('💰 Paid artist:', artistPayment, 'XRP for', tracks.length, 'tracks');
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
      await client.disconnect();
      throw innerError;
    }
    
  } catch (error) {
    console.error('Album purchase error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Mint a single NFT on-demand (lazy minting)
 */
async function mintSingleNFT(client, platformWallet, platformAddress, track, release, sql) {
  // Build metadata URI
  const metadataUri = track.metadata_cid 
    ? `ipfs://${track.metadata_cid}`
    : null;
  
  if (!metadataUri) {
    throw new Error('Track missing metadata CID - cannot mint');
  }
  
  // Convert URI to hex
  const uriHex = Buffer.from(metadataUri).toString('hex').toUpperCase();
  
  // Calculate transfer fee (royalty)
  const royaltyPercent = release.royalty_percent || 5;
  const transferFee = Math.round(royaltyPercent * 1000);
  
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
  
  // Calculate edition number based on sales count
  const salesCount = await sql`
    SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
  `;
  const editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
  
  // Insert NFT record
  const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await sql`
    INSERT INTO nfts (
      id, nft_token_id, release_id, track_id, edition_number,
      owner_address, status, created_at
    ) VALUES (
      ${nftId}, ${nftTokenId}, ${release.id}, ${track.id},
      ${editionNumber}, ${platformAddress}, 'pending', NOW()
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
    if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
      const nfts = node.CreatedNode.NewFields?.NFTokens;
      if (nfts?.length > 0) {
        return nfts[nfts.length - 1].NFToken?.NFTokenID;
      }
    }
    
    if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
      const prevNfts = node.ModifiedNode.PreviousFields?.NFTokens || [];
      const finalNfts = node.ModifiedNode.FinalFields?.NFTokens || [];
      
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
