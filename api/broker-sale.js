/**
 * XRP Music - Purchase API (Unified: Legacy + Lazy Minting)
 * 
 * Supports TWO systems:
 * 
 * 1. LAZY MINT (new): mint_fee_paid=true, NFTs mint on-demand at purchase
 * 2. LEGACY (old): is_minted=true, NFTs pre-minted in platform wallet
 * 
 * Flow:
 * 1. Buyer pays platform
 * 2. Find NFT:
 *    a. Check nfts table for available NFT
 *    b. If legacy: check platform wallet on-chain
 *    c. If lazy mint and none exist: mint on-demand
 * 3. Platform creates sell offer → buyer accepts
 * 4. Platform sends 98% to artist
 * 5. Platform keeps 2%
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_FEE_PERCENT = 2;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send a purchase notification to Discord
 */
async function sendDiscordBuyAlert(purchase) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }

  const {
    trackTitle,
    releaseTitle,
    artistName,
    buyerAddress,
    price,
    editionNumber,
    totalEditions,
    coverUrl,
    releaseType,
    txHash,
  } = purchase;

  const buyerShort = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
  
  const embed = {
    embeds: [
      {
        title: '🎵 New NFT Purchase!',
        color: 0x3b82f6,
        thumbnail: {
          url: coverUrl || 'https://xrpmusic.app/placeholder.png',
        },
        fields: [
          {
            name: '🎤 Track',
            value: trackTitle || releaseTitle || 'Unknown',
            inline: true,
          },
          {
            name: '👤 Artist',
            value: artistName || 'Unknown Artist',
            inline: true,
          },
          {
            name: '💰 Price',
            value: `${price} XRP`,
            inline: true,
          },
          {
            name: '🏷️ Edition',
            value: `#${editionNumber} of ${totalEditions}`,
            inline: true,
          },
          {
            name: '🛒 Buyer',
            value: `\`${buyerShort}\``,
            inline: true,
          },
          {
            name: '📀 Type',
            value: releaseType || 'Single',
            inline: true,
          },
        ],
        footer: {
          text: 'XRP Music • Powered by XRPL',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (txHash) {
    embed.embeds[0].fields.push({
      name: '🔗 Transaction',
      value: `[View on XRPL](https://livenet.xrpl.org/transactions/${txHash})`,
      inline: false,
    });
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status);
    } else {
      console.log('✅ Discord buy alert sent!');
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

/**
 * Send milestone notifications (first sale, sold out, etc)
 */
async function sendDiscordMilestoneAlert(milestone) {
  if (!DISCORD_WEBHOOK_URL) return;

  const { type, releaseTitle, artistName, coverUrl, details } = milestone;

  const titles = {
    'sold_out': '🔥 SOLD OUT!',
    'first_sale': '🎉 First Sale!',
    'milestone_10': '⭐ 10 Copies Sold!',
    'milestone_50': '🌟 50 Copies Sold!',
    'milestone_100': '💫 100 Copies Sold!',
    'milestone_500': '🚀 500 Copies Sold!',
    'milestone_1000': '👑 1000 Copies Sold!',
  };

  const embed = {
    embeds: [
      {
        title: titles[type] || '🎵 Milestone!',
        description: `**${releaseTitle}** by ${artistName}`,
        color: type === 'sold_out' ? 0xef4444 : 0x22c55e,
        thumbnail: { url: coverUrl },
        fields: details ? [{ name: 'Details', value: details }] : [],
        footer: { text: 'XRP Music' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
    console.log('✅ Discord milestone alert sent:', type);
  } catch (error) {
    console.error('Discord milestone error:', error);
  }
}

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
 * PRE-CHECK: Verify NFT availability BEFORE payment
 * Works for both legacy and lazy mint releases
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
    
    if (!targetTrack) {
      return res.status(400).json({ 
        available: false, 
        error: 'No tracks found for this release' 
      });
    }
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    
    // For LAZY MINT releases: check sold_count vs total_editions
    if (isLazyMintRelease(release)) {
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
        price,
        releaseType: 'lazy_mint'
      });
    }
    
    // For LEGACY releases: check nfts table first, then on-chain
    const availableNfts = await sql`
      SELECT id FROM nfts 
      WHERE track_id = ${targetTrackId} 
        AND status = 'available'
      LIMIT 1
    `;
    
    if (availableNfts.length > 0) {
      // Count available in DB
      const countResult = await sql`
        SELECT COUNT(*) as count FROM nfts 
        WHERE track_id = ${targetTrackId} 
          AND status = 'available'
      `;
      const availableCount = parseInt(countResult[0]?.count) || 0;
      
      return res.json({ 
        available: true, 
        availableCount,
        trackTitle: targetTrack.title,
        price,
        releaseType: 'legacy_db'
      });
    }
    
    // Check on-chain for legacy NFTs not in DB
    if (targetTrack.metadata_cid) {
      try {
        const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
        const client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();
        
        const nftsResponse = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
        });
        
        await client.disconnect();
        
        const expectedUri = xrpl.convertStringToHex(`ipfs://${targetTrack.metadata_cid}`);
        const matchingNfts = (nftsResponse.result.account_nfts || [])
          .filter(n => n.URI === expectedUri);
        
        if (matchingNfts.length > 0) {
          return res.json({ 
            available: true, 
            availableCount: matchingNfts.length,
            trackTitle: targetTrack.title,
            price,
            releaseType: 'legacy_onchain'
          });
        }
      } catch (e) {
        console.error('On-chain check failed:', e.message);
      }
    }
    
    // Nothing found - sold out
    return res.json({ 
      available: false, 
      error: `"${targetTrack.title}" is sold out`,
      soldOut: true
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
    
    const { releaseId, trackId, buyerAddress, artistAddress, nftTokenId, price, platformFee } = pendingSale;
    
    // Get release details for Discord notification
    const releases = await sql`
      SELECT r.*, t.title as track_title
      FROM releases r
      LEFT JOIN tracks t ON t.id = ${trackId}
      WHERE r.id = ${releaseId}
    `;
    const release = releases[0];
    
    // Calculate edition number from actual sales count
    let editionNumber = 1;
    if (trackId) {
      const salesCount = await sql`
        SELECT COUNT(*) as count FROM sales WHERE track_id = ${trackId}
      `;
      editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
    }
    
    // Update NFT status to sold
    if (nftTokenId) {
      await sql`
        UPDATE nfts 
        SET status = 'sold', 
            owner_address = ${buyerAddress},
            edition_number = ${editionNumber},
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
    
    // Update release sold_editions (MAX of all track sold_counts for singles, MIN for albums)
    // Using MAX here because for singles we want to show actual sales
    if (releaseId) {
      await sql`
        UPDATE releases r
        SET sold_editions = (
          SELECT COALESCE(MAX(COALESCE(t.sold_count, 0)), 0)
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
    
    // 🎉 DISCORD NOTIFICATION - Send buy alert
    if (release) {
      await sendDiscordBuyAlert({
        trackTitle: release.track_title || release.title,
        releaseTitle: release.title,
        artistName: release.artist_name,
        buyerAddress: buyerAddress,
        price: price,
        editionNumber: editionNumber,
        totalEditions: release.total_editions,
        coverUrl: release.cover_url,
        releaseType: release.type,
        txHash: acceptTxHash,
      });
      
      // Check for milestones
      const newSoldCount = editionNumber;
      
      if (newSoldCount === 1) {
        await sendDiscordMilestoneAlert({
          type: 'first_sale',
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
        });
      } else if (newSoldCount === release.total_editions) {
        await sendDiscordMilestoneAlert({
          type: 'sold_out',
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
          details: `All ${release.total_editions} editions sold! 🚀`,
        });
      } else if ([10, 50, 100, 500, 1000].includes(newSoldCount)) {
        await sendDiscordMilestoneAlert({
          type: `milestone_${newSoldCount}`,
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
        });
      }
    }
    
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
 * Main purchase handler - supports both legacy and lazy mint
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
    
    // Verify release is available (legacy OR lazy mint)
    if (!isReleaseAvailable(release)) {
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
    
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    const useLazyMint = isLazyMintRelease(release);
    
    // For lazy mint: check sold_count vs total_editions
    if (useLazyMint) {
      const soldCount = targetTrack.sold_count || 0;
      const totalEditions = release.total_editions || 0;
      
      if (soldCount >= totalEditions) {
        return res.status(400).json({ 
          error: `"${targetTrack.title}" is sold out`,
          soldOut: true 
        });
      }
    }
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
    
    let nftTokenId = null;
    let editionNumber = null;
    let nftRecordId = null;
    let didLazyMint = false;
    
    try {
      // STEP 1: Try to find existing NFT in database
      const availableNfts = await sql`
        SELECT * FROM nfts 
        WHERE track_id = ${targetTrackId} 
          AND status = 'available'
        ORDER BY edition_number ASC
        LIMIT 1
      `;
      
      if (availableNfts.length > 0) {
        // Use existing NFT from database
        const nftRecord = availableNfts[0];
        nftTokenId = nftRecord.nft_token_id;
        editionNumber = nftRecord.edition_number;
        nftRecordId = nftRecord.id;
        console.log('📦 Using NFT from database:', nftTokenId, 'Edition:', editionNumber);
        
        // Mark as pending
        await sql`
          UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}
        `;
      } else if (!useLazyMint) {
        // STEP 2: Legacy release - check platform wallet on-chain
        console.log('🔍 Checking platform wallet for legacy NFT...');
        
        if (!targetTrack.metadata_cid) {
          await client.disconnect();
          return res.status(400).json({ error: 'Track missing metadata - cannot find NFT' });
        }
        
        const nftsResponse = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
        });
        
        const expectedUri = xrpl.convertStringToHex(`ipfs://${targetTrack.metadata_cid}`);
        const matchingNft = (nftsResponse.result.account_nfts || [])
          .find(n => n.URI === expectedUri);
        
        if (matchingNft) {
          nftTokenId = matchingNft.NFTokenID;
          
          // Calculate edition from sales count
          const salesCount = await sql`
            SELECT COUNT(*) as count FROM sales WHERE track_id = ${targetTrackId}
          `;
          editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
          
          console.log('📦 Found legacy NFT on-chain:', nftTokenId, 'Will be Edition:', editionNumber);
          
          // Create NFT record in database for tracking
          nftRecordId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await sql`
            INSERT INTO nfts (
              id, nft_token_id, release_id, track_id, edition_number,
              owner_address, status, created_at
            ) VALUES (
              ${nftRecordId}, ${nftTokenId}, ${releaseId}, ${targetTrackId},
              ${editionNumber}, ${platformAddress}, 'pending', NOW()
            )
          `;
        } else {
          // No NFT found anywhere - truly sold out
          await client.disconnect();
          return res.status(400).json({ 
            error: `"${targetTrack.title}" is sold out`,
            soldOut: true 
          });
        }
      } else {
        // STEP 3: Lazy mint release - mint on-demand
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
      
      // STEP 4: Cancel any existing offers for this NFT
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
      
      // STEP 5: Create sell offer for buyer
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
      
      // STEP 6: Pay artist (98%)
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
  
  // Calculate edition number based on sales count (not mint count)
  const salesCount = await sql`
    SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
  `;
  const editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
  
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
