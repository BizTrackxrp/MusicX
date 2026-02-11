/**
 * XRP Music - Album Purchase API (Sequential Flow)
 * 
 * NEW FLOW: Mint and transfer one track at a time
 * - No timeout issues - each step is quick
 * - User sees progress and signs after each NFT
 * - If something fails mid-way, they at least have some NFTs
 * 
 * Actions:
 * - 'check': Check availability for all tracks
 * - 'init': Initialize purchase, take payment, return track count
 * - 'mint-single': Mint/find one NFT and create offer (called per track)
 * - 'confirm-single': Confirm single track sale after buyer accepts
 * - 'finalize': Pay artist after all tracks transferred
 * 
 * FIX: Stale trackId fallback - if frontend sends a cached/stale trackId
 * that doesn't match any track in the release, we fall back by index or
 * first track instead of returning "Track not found" error.
 * 
 * FEB 2026 FIX: XRPL websocket reconnection - prevents DisconnectedError
 * on tracks 5-6 of album purchases by using fallback nodes and auto-reconnect.
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_FEE_PERCENT = 2;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// 🤖 Buy bot animated gif - host this on your server and update the URL
const BUYBOT_GIF_URL = process.env.BUYBOT_GIF_URL || 'https://xrpmusic.io/buybot.gif';

// XRPL nodes to try (fallback if primary drops)
const XRPL_NODES = [
  'wss://xrplcluster.com',
  'wss://s1.ripple.com',
  'wss://s2.ripple.com',
];

/**
 * Connect to XRPL with fallback nodes and retry
 */
async function connectXRPL(maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const node of XRPL_NODES) {
      try {
        const client = new xrpl.Client(node, { connectionTimeout: 10000, timeout: 10000 });
        await client.connect();
        console.log(`✅ XRPL connected: ${node}`);
        return client;
      } catch (e) {
        console.warn(`⚠️ Failed to connect to ${node}:`, e.message);
      }
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Failed to connect to any XRPL node');
}

/**
 * Safely disconnect XRPL client (never throws)
 */
async function disconnectSafe(client) {
  try { if (client?.isConnected()) await client.disconnect(); } catch (e) { /* ignore */ }
}

/**
 * Ensure client is connected, reconnect if not
 */
async function ensureConnected(client) {
  if (client && client.isConnected()) return client;
  console.log('🔌 XRPL disconnected, reconnecting...');
  await disconnectSafe(client);
  return await connectXRPL(1);
}

/**
 * Send artist notification for a sale
 */
async function createArtistSaleNotification(sql, sale) {
  const { artistAddress, releaseTitle, price, editionNumber, totalEditions, trackCount, releaseId } = sale;
  
  if (!artistAddress) return;
  
  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = `Album "${releaseTitle}" sold!`;
    const message = `${trackCount} tracks • Edition #${editionNumber}${totalEditions ? ` of ${totalEditions}` : ''}`;
    
    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, amount, created_at)
      VALUES (${id}, ${artistAddress}, 'sale', ${title}, ${message}, ${releaseId || null}, ${null}, ${price}, NOW())
    `;
    
    console.log('✅ Artist album sale notification created for:', artistAddress);
  } catch (error) {
    // Don't fail the sale if notification fails
    console.error('Failed to create artist notification:', error);
  }
}

/**
 * Send a purchase notification to Discord (compact version)
 * Includes direct link to album on XRP Music
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
    price,
    editionNumber,
    totalEditions,
    coverUrl,
    txHash,
    isAlbumPurchase,
    trackCount,
    releaseId,
  } = purchase;

  // Build compact description
  const title = isAlbumPurchase ? `🎵 Album Purchase!` : '🎵 New Purchase!';
  const trackInfo = isAlbumPurchase ? `${trackCount} tracks` : '';
  
  const description = [
    `**${releaseTitle}**${trackInfo ? ` (${trackInfo})` : ''}`,
    `by ${artistName || 'Unknown Artist'}`,
    ``,
    `💰 **${price} XRP** • Edition #${editionNumber}/${totalEditions}`,
    ``,
    `🎧 [Listen on XRP Music](https://xrpmusic.io/release/${releaseId})${txHash ? ` • [View Tx](https://livenet.xrpl.org/transactions/${txHash})` : ''}`,
  ].join('\n');

  const embed = {
    embeds: [
      {
        title,
        description,
        color: isAlbumPurchase ? 0xa855f7 : 0x3b82f6,
        thumbnail: {
          url: BUYBOT_GIF_URL,
        },
        image: {
          url: coverUrl || 'https://xrpmusic.io/placeholder.png',
        },
      },
    ],
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status);
    } else {
      console.log('✅ Discord album buy alert sent!');
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

/**
 * Send milestone notifications (first sale, sold out, etc) - compact version
 */
async function sendDiscordMilestoneAlert(milestone) {
  if (!DISCORD_WEBHOOK_URL) return;

  const { type, releaseTitle, artistName, coverUrl } = milestone;

  const messages = {
    'sold_out': '🔥 **SOLD OUT!**',
    'first_sale': '🎉 **First Album Sale!**',
    'milestone_10': '⭐ **10 Sold!**',
    'milestone_50': '🌟 **50 Sold!**',
    'milestone_100': '💫 **100 Sold!**',
    'milestone_500': '🚀 **500 Sold!**',
    'milestone_1000': '👑 **1000 Sold!**',
  };

  const embed = {
    embeds: [
      {
        description: `${messages[type] || '🎵 Milestone!'}\n\n**${releaseTitle}** by ${artistName}`,
        color: type === 'sold_out' ? 0xef4444 : 0x22c55e,
        thumbnail: { url: coverUrl },
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
  
  switch (action) {
    case 'check':
      return handleAvailabilityCheck(req, res, sql);
    case 'init':
      return handleInitPurchase(req, res, sql);
    case 'mint-single':
      return handleMintSingle(req, res, sql);
    case 'confirm-single':
      return handleConfirmSingle(req, res, sql);
    case 'finalize':
      return handleFinalize(req, res, sql);
    case 'confirm':
      // Legacy support - redirect to finalize
      return handleLegacyConfirm(req, res, sql);
    default:
      // Legacy support - old flow without action
      return handleInitPurchase(req, res, sql);
  }
}

/**
 * Check if a release is available for purchase
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
 * Resolve a track from a release by trackId, with fallback to trackIndex or first track.
 * Handles stale/cached trackIds gracefully.
 * Returns the matched track object, or null if no tracks exist.
 */
function resolveTrack(tracks, trackId, trackIndex) {
  if (!tracks || tracks.length === 0) return null;

  // Try exact match first
  if (trackId) {
    const exact = tracks.find(t => t.id === trackId);
    if (exact) return exact;
    console.warn(`⚠️ Track ID "${trackId}" not found in release, falling back`);
  }

  // Fall back to trackIndex if provided
  if (trackIndex !== undefined && trackIndex !== null && tracks[trackIndex]) {
    console.warn(`⚠️ Using trackIndex ${trackIndex} as fallback`);
    return tracks[trackIndex];
  }

  // Last resort: first track
  console.warn(`⚠️ No trackId or trackIndex match, using first track`);
  return tracks[0];
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
    
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'metadata_cid', t.metadata_cid,
              'sold_count', COALESCE(t.sold_count, 0),
              'price', t.price
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
      for (const track of tracks) {
        const soldCount = track.sold_count || 0;
        const available = release.total_editions - soldCount;
        if (available <= 0) {
          unavailableTracks.push(track.title);
        }
      }
    } else {
      // Legacy: check nfts table AND on-chain
      const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
      let platformNFTs = [];
      
      try {
        const client = await connectXRPL();
        const nftsResponse = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
        });
        platformNFTs = nftsResponse.result.account_nfts || [];
        await disconnectSafe(client);
      } catch (e) {
        console.error('Failed to get platform NFTs:', e.message);
      }
      
      for (const track of tracks) {
        const availableNfts = await sql`
          SELECT id FROM nfts 
          WHERE track_id = ${track.id} 
            AND status = 'available'
          LIMIT 1
        `;
        
        if (availableNfts.length === 0) {
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

/**
 * Initialize album purchase - validates and returns track info
 * Payment has already been made by the buyer
 */
async function handleInitPurchase(req, res, sql) {
  try {
    const { releaseId, buyerAddress, paymentTxHash } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get release with tracks (including per-track prices)
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'metadata_cid', t.metadata_cid,
              'sold_count', COALESCE(t.sold_count, 0),
              'minted_editions', COALESCE(t.minted_editions, 0),
              'price', t.price
            )
            ORDER BY t.track_number, t.id
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
    
    if (!isReleaseAvailable(release)) {
      return res.status(400).json({ error: 'Release not available for purchase' });
    }
    
    const tracks = release.tracks || [];
    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks in release' });
    }
    
    // Calculate prices - use per-track prices with fallback to song_price
    const defaultPrice = parseFloat(release.song_price) || 0;
    const trackPrices = tracks.map(t => parseFloat(t.price) || defaultPrice);
    const individualTotal = trackPrices.reduce((sum, p) => sum + p, 0);
    
    // Use artist-set album price if available, otherwise sum of individual track prices
    const albumPrice = release.album_price ? parseFloat(release.album_price) : individualTotal;
    const totalPrice = albumPrice;
    
    // Create a purchase session to track progress
    const sessionId = `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🎵 Album purchase initialized:', sessionId, 'Tracks:', tracks.length, 'Album price:', totalPrice, 'Individual total:', individualTotal);
    
    return res.json({
      success: true,
      sessionId,
      releaseId,
      releaseTitle: release.title,
      artistAddress: release.artist_address,
      artistName: release.artist_name,
      coverUrl: release.cover_url,
      totalEditions: release.total_editions,
      trackCount: tracks.length,
      totalPrice,
      individualTotal,
      tracks: tracks.map((t, i) => ({
        index: i,
        id: t.id,
        title: t.title,
        price: trackPrices[i],
      })),
      useLazyMint: isLazyMintRelease(release),
    });
    
  } catch (error) {
    console.error('Init album purchase error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Mint/find a single NFT and create sell offer
 * Called once per track in the album
 * 
 * FEB 2026 FIX: Uses connectXRPL() with fallback nodes and ensureConnected()
 * before each XRPL operation to prevent DisconnectedError on later tracks.
 */
async function handleMintSingle(req, res, sql) {
  let client = null;
  
  try {
    const { releaseId, trackId, trackIndex, buyerAddress, sessionId } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Get release and tracks (including per-track price)
    const releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'metadata_cid', t.metadata_cid,
              'sold_count', COALESCE(t.sold_count, 0),
              'minted_editions', COALESCE(t.minted_editions, 0),
              'price', t.price
            )
            ORDER BY t.track_number, t.id
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
    
    // FIX: Resolve track with stale cache fallback
    const track = resolveTrack(tracks, trackId, trackIndex);
    if (!track) {
      return res.status(400).json({ error: 'No tracks found in release' });
    }
    
    // Use the resolved track's actual ID going forward
    const resolvedTrackId = track.id;
    
    const useLazyMint = isLazyMintRelease(release);
    
    // Use per-track price, fall back to release song_price
    const trackPrice = parseFloat(track.price) || parseFloat(release.song_price) || 0;
    
    // Check availability
    if (useLazyMint) {
      const soldCount = track.sold_count || 0;
      if (soldCount >= release.total_editions) {
        return res.status(400).json({ 
          error: `Track "${track.title}" is sold out`,
          soldOut: true 
        });
      }
    }
    
    // Connect to XRPL (with fallback nodes)
    client = await connectXRPL();
    
    const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
    
    let nftTokenId = null;
    let editionNumber = null;
    let nftRecordId = null;
    let didLazyMint = false;
    
    try {
      // STEP 1: Try to get from nfts table first
      const availableNfts = await sql`
        SELECT * FROM nfts 
        WHERE track_id = ${resolvedTrackId} 
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
        
      } else if (!useLazyMint) {
        // STEP 2: Legacy - check on-chain
        if (!track.metadata_cid) {
          await disconnectSafe(client);
          return res.status(400).json({ error: `Track "${track.title}" is missing metadata` });
        }
        
        client = await ensureConnected(client);
        const nftsResponse = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
        });
        const platformNFTs = nftsResponse.result.account_nfts || [];
        
        const expectedUri = xrpl.convertStringToHex(`ipfs://${track.metadata_cid}`);
        const matchingNft = platformNFTs.find(n => n.URI === expectedUri);
        
        if (matchingNft) {
          nftTokenId = matchingNft.NFTokenID;
          
          const salesCount = await sql`
            SELECT COUNT(*) as count FROM sales WHERE track_id = ${resolvedTrackId}
          `;
          editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
          
          console.log('📦 Found legacy NFT on-chain:', nftTokenId, 'Edition:', editionNumber);
          
          // Create NFT record for tracking
          nftRecordId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await sql`
            INSERT INTO nfts (
              id, nft_token_id, release_id, track_id, edition_number,
              owner_address, status, created_at
            ) VALUES (
              ${nftRecordId}, ${nftTokenId}, ${releaseId}, ${resolvedTrackId},
              ${editionNumber}, ${platformAddress}, 'pending', NOW()
            )
          `;
        } else {
          await disconnectSafe(client);
          return res.status(400).json({ 
            error: `NFT not available for track: ${track.title}`,
            soldOut: true 
          });
        }
        
      } else {
        // STEP 3: Lazy mint - create NFT on-demand (with retry)
        console.log('🎵 Lazy minting NFT for track:', track.title);
        
        let mintResult = null;
        for (let mintAttempt = 0; mintAttempt < 3; mintAttempt++) {
          try {
            client = await ensureConnected(client);
            console.log(`🔨 Mint attempt ${mintAttempt + 1}...`);
            mintResult = await mintSingleNFT(
              client, 
              platformWallet, 
              platformAddress, 
              track, 
              release, 
              sql
            );
            break; // Success
          } catch (mintError) {
            console.warn(`⚠️ Mint attempt ${mintAttempt + 1} failed:`, mintError.message);
            await disconnectSafe(client);
            client = null;
            if (mintAttempt === 2) throw mintError;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        
        nftTokenId = mintResult.nftTokenId;
        editionNumber = mintResult.editionNumber;
        nftRecordId = mintResult.nftRecordId;
        didLazyMint = true;
        
        console.log('✅ Lazy minted NFT:', nftTokenId, 'Edition:', editionNumber);
        
        // Wait for ledger to settle (increased from 1s to 2s)
        console.log('⏳ Waiting for ledger to settle...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Ensure still connected before offer operations
      client = await ensureConnected(client);
      
      // STEP 4: Cancel any existing offers for this NFT
      try {
        const offersResponse = await client.request({
          command: 'nft_sell_offers',
          nft_id: nftTokenId,
        });
        
        for (const offer of (offersResponse.result.offers || [])) {
          if (offer.owner === platformAddress) {
            client = await ensureConnected(client);
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
      
      // STEP 5: Create sell offer for buyer (with retry on timeout)
      let offerResult = null;
      for (let offerAttempt = 0; offerAttempt < 3; offerAttempt++) {
        try {
          client = await ensureConnected(client);
          console.log(`📝 Creating sell offer (attempt ${offerAttempt + 1})...`);
          const createOfferTx = await client.autofill({
            TransactionType: 'NFTokenCreateOffer',
            Account: platformAddress,
            NFTokenID: nftTokenId,
            Amount: '1', // 1 drop (buyer already paid)
            Flags: 1, // tfSellNFToken
            Destination: buyerAddress,
          });
          
          const signedOffer = platformWallet.sign(createOfferTx);
          offerResult = await client.submitAndWait(signedOffer.tx_blob);
          break; // Success - exit retry loop
        } catch (offerError) {
          console.warn(`⚠️ Offer attempt ${offerAttempt + 1} failed:`, offerError.message);
          await disconnectSafe(client);
          client = null;
          if (offerAttempt === 2) throw offerError; // Last attempt, rethrow
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        // Reset NFT status
        if (nftRecordId) {
          await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
        }
        await disconnectSafe(client);
        return res.status(400).json({ 
          error: `Failed to create offer for: ${track.title}` 
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
      
      await disconnectSafe(client);
      
      const platformFee = trackPrice * (PLATFORM_FEE_PERCENT / 100);
      
      console.log('✅ Offer created for track:', track.title, 'Price:', trackPrice, 'Offer:', offerIndex);
      
      return res.json({
        success: true,
        trackIndex,
        trackId: resolvedTrackId,
        trackTitle: track.title,
        nftTokenId,
        editionNumber,
        offerIndex,
        didLazyMint,
        pendingSale: {
          releaseId,
          trackId: resolvedTrackId,
          buyerAddress,
          artistAddress: release.artist_address,
          nftTokenId,
          editionNumber,
          price: trackPrice,
          platformFee,
          nftRecordId,
        },
      });
      
    } catch (innerError) {
      console.error('Mint single error:', innerError);
      
      // Reset NFT status if we marked one as pending
      if (nftRecordId) {
        await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
      }
      
      await disconnectSafe(client);
      return res.status(500).json({ error: innerError.message });
    }
    
  } catch (error) {
    console.error('Mint single error:', error);
    await disconnectSafe(client);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Confirm a single track sale after buyer accepts NFT
 */
async function handleConfirmSingle(req, res, sql) {
  try {
    const { pendingSale, acceptTxHash } = req.body;
    
    if (!pendingSale || !acceptTxHash) {
      return res.status(400).json({ error: 'Missing pending sale data or transaction hash' });
    }
    
    const { releaseId, trackId, buyerAddress, nftTokenId, price, platformFee, nftRecordId } = pendingSale;
    
    // Calculate edition number from sales count
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
    
    // Record the sale
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO sales (
        id, release_id, track_id, buyer_address, seller_address,
        nft_token_id, edition_number, price, platform_fee, tx_hash, created_at
      ) VALUES (
        ${saleId}, ${releaseId}, ${trackId}, ${buyerAddress},
        ${pendingSale.artistAddress}, ${nftTokenId}, ${editionNumber},
        ${price}, ${platformFee}, ${acceptTxHash}, NOW()
      )
    `;
    
    console.log('✅ Single sale confirmed:', saleId, 'Track:', trackId, 'Edition #', editionNumber);
    
    return res.json({
      success: true,
      saleId,
      editionNumber,
    });
    
  } catch (error) {
    console.error('Confirm single sale error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Finalize album purchase - pay artist after all tracks transferred
 * 🎉 This is where we send the Discord notification for album purchases!
 */
async function handleFinalize(req, res, sql) {
  try {
    const { releaseId, artistAddress, totalPrice, trackCount, buyerAddress } = req.body;
    
    if (!releaseId || !artistAddress || !totalPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Get release details for Discord notification
    const releases = await sql`
      SELECT r.*, 
        (SELECT MIN(COALESCE(t.sold_count, 0)) FROM tracks t WHERE t.release_id = r.id) as min_sold_count
      FROM releases r
      WHERE r.id = ${releaseId}
    `;
    const release = releases[0];
    
    // Update release sold_editions = MIN of all track sold_counts
    await sql`
      UPDATE releases r
      SET sold_editions = (
        SELECT COALESCE(MIN(COALESCE(t.sold_count, 0)), 0)
        FROM tracks t
        WHERE t.release_id = r.id
      )
      WHERE r.id = ${releaseId}
    `;
    
    // Pay artist (98% of total)
    const platformFeeTotal = totalPrice * (PLATFORM_FEE_PERCENT / 100);
    const artistPayment = totalPrice - platformFeeTotal;
    
    let paymentTxHash = null;
    
    if (artistPayment > 0) {
      const client = await connectXRPL();
      
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      const paymentTx = await client.autofill({
        TransactionType: 'Payment',
        Account: platformAddress,
        Destination: artistAddress,
        Amount: xrpl.xrpToDrops(artistPayment.toFixed(6)),
        Memos: [{
          Memo: {
            MemoType: xrpl.convertStringToHex('XRPMusic'),
            MemoData: xrpl.convertStringToHex(`Album Sale: ${release?.title || 'Album'}`),
          }
        }],
      });
      
      const signedPayment = platformWallet.sign(paymentTx);
      const paymentResult = await client.submitAndWait(signedPayment.tx_blob);
      paymentTxHash = paymentResult.result.hash;
      
      await disconnectSafe(client);
      
      console.log('💰 Paid artist:', artistPayment, 'XRP for', trackCount, 'tracks');
    }
    
    // Get the edition number (min sold count after this purchase)
    const editionNumber = (release?.min_sold_count || 0) + 1;
    
    // 🔔 ARTIST IN-APP NOTIFICATION
    if (release) {
      await createArtistSaleNotification(sql, {
        artistAddress: artistAddress,
        releaseTitle: release.title,
        price: totalPrice,
        editionNumber: editionNumber,
        totalEditions: release.total_editions,
        trackCount: trackCount,
        releaseId: releaseId,
      });
    }
    
    // 🎉 DISCORD NOTIFICATION - Send album buy alert with song link
    if (release && buyerAddress) {
      await sendDiscordBuyAlert({
        trackTitle: null,
        releaseTitle: release.title,
        artistName: release.artist_name,
        buyerAddress: buyerAddress,
        price: totalPrice,
        editionNumber: editionNumber,
        totalEditions: release.total_editions,
        coverUrl: release.cover_url,
        releaseType: release.type || 'Album',
        txHash: paymentTxHash,
        isAlbumPurchase: true,
        trackCount: trackCount,
        releaseId: releaseId,
      });
      
      // Check for milestones
      if (editionNumber === 1) {
        await sendDiscordMilestoneAlert({
          type: 'first_sale',
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
        });
      } else if (editionNumber === release.total_editions) {
        await sendDiscordMilestoneAlert({
          type: 'sold_out',
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
          details: `All ${release.total_editions} editions sold! 🚀`,
        });
      } else if ([10, 50, 100, 500, 1000].includes(editionNumber)) {
        await sendDiscordMilestoneAlert({
          type: `milestone_${editionNumber}`,
          releaseTitle: release.title,
          artistName: release.artist_name,
          coverUrl: release.cover_url,
        });
      }
    }
    
    return res.json({
      success: true,
      artistPayment,
      platformFee: platformFeeTotal,
      paymentTxHash,
    });
    
  } catch (error) {
    console.error('Finalize album purchase error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Legacy confirm handler - for backwards compatibility
 */
async function handleLegacyConfirm(req, res, sql) {
  try {
    const { pendingSales, acceptTxHashes } = req.body;
    
    if (!pendingSales || !acceptTxHashes) {
      return res.status(400).json({ error: 'Missing pending sales data' });
    }
    
    // Confirm each sale individually
    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      const txHash = acceptTxHashes[i];
      
      await handleConfirmSingle({
        body: {
          pendingSale: sale,
          acceptTxHash: txHash,
        }
      }, {
        status: () => ({ json: () => {} }),
        json: () => {},
      }, sql);
    }
    
    // Update release sold_editions
    const releaseId = pendingSales[0]?.releaseId;
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
    console.error('Legacy confirm error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Mint a single NFT on-demand (lazy minting)
 */
async function mintSingleNFT(client, platformWallet, platformAddress, track, release, sql) {
  const metadataUri = track.metadata_cid 
    ? `ipfs://${track.metadata_cid}`
    : null;
  
  if (!metadataUri) {
    throw new Error('Track missing metadata CID - cannot mint');
  }
  
  const uriHex = Buffer.from(metadataUri).toString('hex').toUpperCase();
  
  const royaltyPercent = release.royalty_percent || 5;
  const transferFee = Math.round(royaltyPercent * 1000);
  
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
  
  const nftTokenId = extractNFTokenID(mintResult.result.meta);
  
  if (!nftTokenId) {
    throw new Error('Could not extract NFT Token ID from mint result');
  }
  
  const salesCount = await sql`
    SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}
  `;
  const editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
  
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
  
  await sql`
    UPDATE tracks 
    SET minted_editions = COALESCE(minted_editions, 0) + 1
    WHERE id = ${track.id}
  `;
  
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
