/**
 * XRP Music - Purchase API (Single-Signature Flow)
 * 
 * NEW FLOW (1 buyer signature):
 * 1. Frontend calls 'prepare' → API mints NFT + creates sell offer for full price
 * 2. Frontend has buyer sign NFTokenAcceptOffer (ONLY signature)
 * 3. Frontend calls 'confirm' → API pays artist 98%, records sale
 * 
 * OLD FLOW (2 buyer signatures) - DEPRECATED due to Xaman 5.0 crash:
 * 1. Buyer signs Payment to platform
 * 2. Platform creates 0-amount sell offer
 * 3. Buyer signs NFTokenAcceptOffer for 0-amount offer ← Xaman 5.0 crashes here
 * 
 * The new flow embeds the XRP payment INTO the sell offer amount,
 * so the buyer's single NFTokenAcceptOffer both pays AND receives the NFT.
 * 
 * Supports LAZY MINT (mint_fee_paid=true) and LEGACY (is_minted=true)
 * 
 * FIX: Stale trackId fallback - if frontend sends a cached/stale trackId
 * that doesn't match any track in the release, we fall back to the first
 * track instead of returning "Track not found in release" error.
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const PLATFORM_FEE_PERCENT = 2;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const BUYBOT_GIF_URL = process.env.BUYBOT_GIF_URL || 'https://xrpmusic.io/buybot.gif';

// ─── Notification Helpers ────────────────────────────────────────────

async function createArtistSaleNotification(sql, sale) {
  const { artistAddress, trackTitle, releaseTitle, price, editionNumber, totalEditions } = sale;
  if (!artistAddress) return;
  
  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = `1 copy of "${trackTitle || releaseTitle}" sold!`;
    const message = `Edition #${editionNumber}${totalEditions ? ` of ${totalEditions}` : ''}`;
    
    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, amount, created_at)
      VALUES (${id}, ${artistAddress}, 'sale', ${title}, ${message}, ${sale.releaseId || null}, ${sale.trackId || null}, ${price}, NOW())
    `;
    console.log('✅ Artist sale notification created for:', artistAddress);
  } catch (error) {
    console.error('Failed to create artist notification:', error);
  }
}

async function sendDiscordBuyAlert(purchase) {
  if (!DISCORD_WEBHOOK_URL) return;

  const { trackTitle, releaseTitle, artistName, price, editionNumber, totalEditions, coverUrl, txHash, releaseId } = purchase;

  const description = [
    `**${trackTitle || releaseTitle}**`,
    `by ${artistName || 'Unknown Artist'}`,
    ``,
    `💰 **${price} XRP** • Edition #${editionNumber}/${totalEditions}`,
    ``,
    `🎧 [Listen on XRP Music](https://xrpmusic.io/release/${releaseId})${txHash ? ` • [View Tx](https://livenet.xrpl.org/transactions/${txHash})` : ''}`,
  ].join('\n');

  const embed = {
    embeds: [{
      title: '🎵 New Purchase!',
      description,
      color: 0x3b82f6,
      thumbnail: { url: BUYBOT_GIF_URL },
      image: { url: coverUrl || 'https://xrpmusic.io/placeholder.png' },
    }],
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
    if (!response.ok) console.error('Discord webhook failed:', response.status);
    else console.log('✅ Discord buy alert sent!');
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

async function sendDiscordMilestoneAlert(milestone) {
  if (!DISCORD_WEBHOOK_URL) return;

  const { type, releaseTitle, artistName, coverUrl } = milestone;
  const messages = {
    'sold_out': '🔥 **SOLD OUT!**',
    'first_sale': '🎉 **First Sale!**',
    'milestone_10': '⭐ **10 Sold!**',
    'milestone_50': '🌟 **50 Sold!**',
    'milestone_100': '💫 **100 Sold!**',
    'milestone_500': '🚀 **500 Sold!**',
    'milestone_1000': '👑 **1000 Sold!**',
  };

  const embed = {
    embeds: [{
      description: `${messages[type] || '🎵 Milestone!'}\n\n**${releaseTitle}** by ${artistName}`,
      color: type === 'sold_out' ? 0xef4444 : 0x22c55e,
      thumbnail: { url: coverUrl },
    }],
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

// ─── Shared Helpers ──────────────────────────────────────────────────

function isReleaseAvailable(release) {
  return (
    release.mint_fee_paid === true ||
    release.status === 'live' ||
    release.is_minted === true ||
    (release.sell_offer_index && release.sell_offer_index.length > 0)
  );
}

function isLazyMintRelease(release) {
  return release.mint_fee_paid === true || release.status === 'live';
}

function resolveTargetTrack(release, trackId) {
  let targetTrack = null;
  let targetTrackId = trackId;

  if (trackId && release.tracks) {
    targetTrack = release.tracks.find(t => t.id === trackId);
    if (!targetTrack) {
      console.warn(`⚠️ Track ID "${trackId}" not found in release "${release.id}", falling back to first track`);
      targetTrack = release.tracks[0] || null;
      targetTrackId = targetTrack?.id || null;
    }
  } else if (release.tracks?.length > 0) {
    targetTrack = release.tracks[0];
    targetTrackId = targetTrack.id;
  }

  if (!targetTrack) return null;
  return { targetTrack, targetTrackId };
}

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

async function getReleaseWithTracks(sql, releaseId) {
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
  return releases[0] || null;
}

// ─── Route Handler ───────────────────────────────────────────────────

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { action } = req.body;
  
  if (action === 'check') return handleAvailabilityCheck(req, res, sql);
  if (action === 'prepare') return handlePrepare(req, res, sql);
  if (action === 'confirm') return handleConfirmSale(req, res, sql);
  
  // Legacy fallback: old 2-signature flow (still works if needed)
  return handleLegacyPurchase(req, res, sql);
}

// ─── PRE-CHECK: Verify availability BEFORE purchase ──────────────────

async function handleAvailabilityCheck(req, res, sql) {
  try {
    const { releaseId, trackId } = req.body;
    if (!releaseId) return res.status(400).json({ error: 'Release ID required' });
    
    const release = await getReleaseWithTracks(sql, releaseId);
    if (!release) return res.status(404).json({ available: false, error: 'Release not found' });
    if (!isReleaseAvailable(release)) return res.status(400).json({ available: false, error: 'Release not yet available for purchase' });
    
    const resolved = resolveTargetTrack(release, trackId);
    if (!resolved) return res.status(400).json({ available: false, error: 'No tracks found for this release' });
    
    const { targetTrack } = resolved;
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    
    if (isLazyMintRelease(release)) {
      const soldCount = targetTrack.sold_count || 0;
      const totalEditions = release.total_editions || 0;
      const availableCount = totalEditions - soldCount;
      
      if (availableCount <= 0) {
        return res.json({ available: false, error: `"${targetTrack.title}" is sold out`, soldOut: true });
      }
      return res.json({ available: true, availableCount, trackTitle: targetTrack.title, price, releaseType: 'lazy_mint' });
    }
    
    // Legacy: check nfts table then on-chain
    const availableNfts = await sql`
      SELECT COUNT(*) as count FROM nfts 
      WHERE track_id = ${resolved.targetTrackId} AND status = 'available'
    `;
    const availableCount = parseInt(availableNfts[0]?.count) || 0;
    
    if (availableCount > 0) {
      return res.json({ available: true, availableCount, trackTitle: targetTrack.title, price, releaseType: 'legacy_db' });
    }
    
    // Check on-chain
    if (targetTrack.metadata_cid) {
      try {
        const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
        const client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();
        const nftsResponse = await client.request({ command: 'account_nfts', account: platformAddress, limit: 400 });
        await client.disconnect();
        
        const expectedUri = xrpl.convertStringToHex(`ipfs://${targetTrack.metadata_cid}`);
        const matchingNfts = (nftsResponse.result.account_nfts || []).filter(n => n.URI === expectedUri);
        
        if (matchingNfts.length > 0) {
          return res.json({ available: true, availableCount: matchingNfts.length, trackTitle: targetTrack.title, price, releaseType: 'legacy_onchain' });
        }
      } catch (e) {
        console.error('On-chain check failed:', e.message);
      }
    }
    
    return res.json({ available: false, error: `"${targetTrack.title}" is sold out`, soldOut: true });
  } catch (error) {
    console.error('Availability check error:', error);
    return res.status(500).json({ available: false, error: error.message || 'Failed to check availability' });
  }
}

// ─── NEW: Prepare purchase (mint + create priced sell offer) ─────────

async function handlePrepare(req, res, sql) {
  try {
    const { releaseId, trackId, buyerAddress } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    if (!platformAddress || !platformSeed) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    const release = await getReleaseWithTracks(sql, releaseId);
    if (!release) return res.status(404).json({ error: 'Release not found' });
    if (!isReleaseAvailable(release)) return res.status(400).json({ error: 'Release not available for purchase' });
    
    const resolved = resolveTargetTrack(release, trackId);
    if (!resolved) return res.status(400).json({ error: 'No track found' });
    
    const { targetTrack, targetTrackId } = resolved;
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    const useLazyMint = isLazyMintRelease(release);
    
    // Check sold out for lazy mint
    if (useLazyMint) {
      const soldCount = targetTrack.sold_count || 0;
      const totalEditions = release.total_editions || 0;
      if (soldCount >= totalEditions) {
        return res.status(400).json({ error: `"${targetTrack.title}" is sold out`, soldOut: true });
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
      // STEP 1: Get or mint NFT
      const availableNfts = await sql`
        SELECT * FROM nfts 
        WHERE track_id = ${targetTrackId} AND status = 'available'
        ORDER BY edition_number ASC LIMIT 1
      `;
      
      if (availableNfts.length > 0) {
        const nftRecord = availableNfts[0];
        nftTokenId = nftRecord.nft_token_id;
        editionNumber = nftRecord.edition_number;
        nftRecordId = nftRecord.id;
        console.log('📦 Using NFT from database:', nftTokenId);
        await sql`UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}`;
        
      } else if (!useLazyMint) {
        // Legacy: find on-chain
        if (!targetTrack.metadata_cid) {
          await client.disconnect();
          return res.status(400).json({ error: 'Track missing metadata' });
        }
        
        const nftsResponse = await client.request({ command: 'account_nfts', account: platformAddress, limit: 400 });
        const expectedUri = xrpl.convertStringToHex(`ipfs://${targetTrack.metadata_cid}`);
        const matchingNft = (nftsResponse.result.account_nfts || []).find(n => n.URI === expectedUri);
        
        if (!matchingNft) {
          await client.disconnect();
          return res.status(400).json({ error: `"${targetTrack.title}" is sold out`, soldOut: true });
        }
        
        nftTokenId = matchingNft.NFTokenID;
        const salesCount = await sql`SELECT COUNT(*) as count FROM sales WHERE track_id = ${targetTrackId}`;
        editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
        
        nftRecordId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO nfts (id, nft_token_id, release_id, track_id, edition_number, owner_address, status, created_at)
          VALUES (${nftRecordId}, ${nftTokenId}, ${releaseId}, ${targetTrackId}, ${editionNumber}, ${platformAddress}, 'pending', NOW())
        `;
        
      } else {
        // Lazy mint
        const mintResult = await mintSingleNFT(client, platformWallet, platformAddress, targetTrack, release, sql);
        nftTokenId = mintResult.nftTokenId;
        editionNumber = mintResult.editionNumber;
        nftRecordId = mintResult.nftRecordId;
        didLazyMint = true;
        console.log('✅ Lazy minted NFT:', nftTokenId);
      }
      
      // STEP 2: Cancel any existing offers for this NFT
      try {
        const offersResponse = await client.request({ command: 'nft_sell_offers', nft_id: nftTokenId });
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
        // No existing offers — fine
      }
      
      // STEP 3: Create sell offer for FULL PRICE with buyer as Destination
      // This is the key change — the XRP amount is embedded in the offer
      // so the buyer's NFTokenAcceptOffer both pays AND receives the NFT
      const priceInDrops = xrpl.xrpToDrops(price.toFixed(6));
      
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftTokenId,
        Amount: priceInDrops,
        Flags: 1, // tfSellNFToken
        Destination: buyerAddress,
      });
      
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        if (nftRecordId) await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
        await client.disconnect();
        return res.status(400).json({ error: 'Failed to create sell offer' });
      }
      
      // Extract offer index
      let sellOfferIndex = null;
      for (const node of offerResult.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          sellOfferIndex = node.CreatedNode.LedgerIndex;
          break;
        }
      }
      
      const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
      
      await client.disconnect();
      
      console.log('✅ Prepared purchase: NFT', nftTokenId, 'offer', sellOfferIndex, 'price', price, 'XRP');
      
      return res.json({
        success: true,
        sellOfferIndex,
        nftTokenId,
        price,
        lazyMinted: didLazyMint,
        pendingSale: {
          releaseId,
          trackId: targetTrackId,
          buyerAddress,
          artistAddress,
          nftTokenId,
          editionNumber,
          price,
          platformFee,
          nftRecordId,
        },
      });
      
    } catch (innerError) {
      console.error('Prepare error:', innerError);
      if (nftRecordId) await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
      
      try { await client.disconnect(); } catch (e) {}
      return res.status(500).json({ error: innerError.message || 'Failed to prepare purchase' });
    }
    
  } catch (error) {
    console.error('Prepare error:', error);
    return res.status(500).json({ error: error.message || 'Failed to prepare purchase' });
  }
}

// ─── Confirm sale after buyer accepts the sell offer ─────────────────

async function handleConfirmSale(req, res, sql) {
  try {
    const { pendingSale, acceptTxHash } = req.body;
    
    if (!pendingSale || !acceptTxHash) {
      return res.status(400).json({ error: 'Missing pending sale data or transaction hash' });
    }
    
    const { releaseId, trackId, buyerAddress, artistAddress, nftTokenId, price, platformFee, nftRecordId } = pendingSale;
    
    // Get release details
    const releases = await sql`
      SELECT r.*, t.title as track_title
      FROM releases r LEFT JOIN tracks t ON t.id = ${trackId}
      WHERE r.id = ${releaseId}
    `;
    const release = releases[0];
    
    // Calculate edition number
    let editionNumber = 1;
    if (trackId) {
      const salesCount = await sql`SELECT COUNT(*) as count FROM sales WHERE track_id = ${trackId}`;
      editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
    }
    
    // Update NFT status
    if (nftTokenId) {
      await sql`
        UPDATE nfts SET status = 'sold', owner_address = ${buyerAddress}, edition_number = ${editionNumber}, sold_at = NOW()
        WHERE nft_token_id = ${nftTokenId}
      `;
    }
    
    // Update track sold_count
    if (trackId) {
      await sql`UPDATE tracks SET sold_count = COALESCE(sold_count, 0) + 1 WHERE id = ${trackId}`;
    }
    
    // Update release sold_editions
    if (releaseId) {
      await sql`
        UPDATE releases r SET sold_editions = (
          SELECT COALESCE(MAX(COALESCE(t.sold_count, 0)), 0) FROM tracks t WHERE t.release_id = r.id
        ) WHERE r.id = ${releaseId}
      `;
    }
    
    // Record the sale
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO sales (id, release_id, track_id, buyer_address, seller_address, nft_token_id, edition_number, price, platform_fee, tx_hash, created_at)
      VALUES (${saleId}, ${releaseId}, ${trackId}, ${buyerAddress}, ${artistAddress}, ${nftTokenId}, ${editionNumber}, ${price}, ${platformFee}, ${acceptTxHash}, NOW())
    `;
    
    console.log('✅ Sale confirmed:', saleId, 'Edition #', editionNumber);
    
    // PAY ARTIST (98%) — XRP went to platform via the sell offer,
    // now platform forwards the artist's share
    const artistPayment = price - platformFee;
    
    if (artistPayment > 0 && artistAddress) {
      try {
        const platformSeed = process.env.PLATFORM_WALLET_SEED;
        const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
        const client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();
        const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
        
        const paymentTx = await client.autofill({
          TransactionType: 'Payment',
          Account: platformAddress,
          Destination: artistAddress,
          Amount: xrpl.xrpToDrops(artistPayment.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: xrpl.convertStringToHex('XRPMusic'),
              MemoData: xrpl.convertStringToHex(`Sale: ${release?.title || 'Unknown'}`),
            }
          }],
        });
        
        const signedPayment = platformWallet.sign(paymentTx);
        await client.submitAndWait(signedPayment.tx_blob);
        await client.disconnect();
        console.log('💰 Paid artist:', artistPayment, 'XRP');
      } catch (payErr) {
        console.error('❌ Artist payment failed:', payErr.message);
        // Sale is still confirmed — artist payment can be retried manually
      }
    }
    
    // Notifications
    if (release) {
      await createArtistSaleNotification(sql, {
        artistAddress, trackTitle: release.track_title, releaseTitle: release.title,
        price, editionNumber, totalEditions: release.total_editions, releaseId, trackId,
      });
      
      await sendDiscordBuyAlert({
        trackTitle: release.track_title || release.title, releaseTitle: release.title,
        artistName: release.artist_name, buyerAddress, price, editionNumber,
        totalEditions: release.total_editions, coverUrl: release.cover_url,
        releaseType: release.type, txHash: acceptTxHash, releaseId,
      });
      
      // Milestones
      if (editionNumber === 1) {
        await sendDiscordMilestoneAlert({ type: 'first_sale', releaseTitle: release.title, artistName: release.artist_name, coverUrl: release.cover_url });
      } else if (editionNumber === release.total_editions) {
        await sendDiscordMilestoneAlert({ type: 'sold_out', releaseTitle: release.title, artistName: release.artist_name, coverUrl: release.cover_url });
      } else if ([10, 50, 100, 500, 1000].includes(editionNumber)) {
        await sendDiscordMilestoneAlert({ type: `milestone_${editionNumber}`, releaseTitle: release.title, artistName: release.artist_name, coverUrl: release.cover_url });
      }
    }
    
    return res.json({ success: true, saleId, editionNumber });
    
  } catch (error) {
    console.error('Confirm sale error:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm sale' });
  }
}

// ─── Lazy Mint Helper ────────────────────────────────────────────────

async function mintSingleNFT(client, platformWallet, platformAddress, track, release, sql) {
  console.log('🎵 Lazy minting NFT for track:', track.id, track.title);
  
  const metadataUri = track.metadata_cid ? `ipfs://${track.metadata_cid}` : null;
  if (!metadataUri) throw new Error('Track missing metadata CID');
  
  const uriHex = Buffer.from(metadataUri).toString('hex').toUpperCase();
  const royaltyPercent = release.royalty_percent || 5;
  const transferFee = Math.round(royaltyPercent * 1000);
  
  // Check if artist has authorized platform as NFTokenMinter
  let useIssuer = false;
  try {
    const acctInfo = await client.request({ command: 'account_info', account: release.artist_address });
    useIssuer = acctInfo.result.account_data?.NFTokenMinter === platformAddress;
  } catch (e) {
    console.warn('Could not check NFTokenMinter for', release.artist_address);
  }

  const mintTx = await client.autofill({
    TransactionType: 'NFTokenMint',
    Account: platformAddress,
    ...(useIssuer ? { Issuer: release.artist_address } : {}),
    URI: uriHex,
    Flags: 8,
    TransferFee: transferFee,
    NFTokenTaxon: 0,
  });

  const signedMint = platformWallet.sign(mintTx);
  const mintResult = await client.submitAndWait(signedMint.tx_blob);

  if (mintResult.result.meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Mint failed: ${mintResult.result.meta.TransactionResult}`);
  }
  
  const nftTokenId = extractNFTokenID(mintResult.result.meta);
  if (!nftTokenId) throw new Error('Could not extract NFT Token ID');
  
  console.log('✅ Minted NFT:', nftTokenId);
  
  const salesCount = await sql`SELECT COUNT(*) as count FROM sales WHERE track_id = ${track.id}`;
  const editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
  
  const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await sql`
    INSERT INTO nfts (id, nft_token_id, release_id, track_id, edition_number, owner_address, status, created_at)
    VALUES (${nftId}, ${nftTokenId}, ${release.id}, ${track.id}, ${editionNumber}, ${platformAddress}, 'pending', NOW())
  `;
  
  await sql`UPDATE tracks SET minted_editions = COALESCE(minted_editions, 0) + 1 WHERE id = ${track.id}`;
  await sql`UPDATE releases SET minted_editions = COALESCE(minted_editions, 0) + 1 WHERE id = ${release.id}`;
  
  return { nftTokenId, editionNumber, nftRecordId: nftId };
}

// ─── Legacy 2-signature flow (fallback) ──────────────────────────────
// Kept for backward compatibility. Uses the old Payment + Accept pattern.

async function handleLegacyPurchase(req, res, sql) {
  try {
    const { releaseId, trackId, buyerAddress, paymentTxHash } = req.body;
    
    if (!releaseId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    if (!platformAddress || !platformSeed) return res.status(500).json({ error: 'Platform not configured' });
    
    const release = await getReleaseWithTracks(sql, releaseId);
    if (!release) return res.status(404).json({ error: 'Release not found' });
    if (!isReleaseAvailable(release)) return res.status(400).json({ error: 'Release not available' });
    
    const resolved = resolveTargetTrack(release, trackId);
    if (!resolved) return res.status(400).json({ error: 'No track found' });
    
    const { targetTrack, targetTrackId } = resolved;
    const price = parseFloat(release.song_price) || parseFloat(release.album_price) || 0;
    const artistAddress = release.artist_address;
    const useLazyMint = isLazyMintRelease(release);
    
    if (useLazyMint) {
      const soldCount = targetTrack.sold_count || 0;
      if (soldCount >= (release.total_editions || 0)) {
        return res.status(400).json({ error: `"${targetTrack.title}" is sold out`, soldOut: true });
      }
    }
    
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
    
    let nftTokenId = null, editionNumber = null, nftRecordId = null, didLazyMint = false;
    
    try {
      const availableNfts = await sql`
        SELECT * FROM nfts WHERE track_id = ${targetTrackId} AND status = 'available' ORDER BY edition_number ASC LIMIT 1
      `;
      
      if (availableNfts.length > 0) {
        const nftRecord = availableNfts[0];
        nftTokenId = nftRecord.nft_token_id;
        editionNumber = nftRecord.edition_number;
        nftRecordId = nftRecord.id;
        await sql`UPDATE nfts SET status = 'pending' WHERE id = ${nftRecord.id}`;
      } else if (!useLazyMint) {
        if (!targetTrack.metadata_cid) {
          await client.disconnect();
          return res.status(400).json({ error: 'Track missing metadata' });
        }
        const nftsResponse = await client.request({ command: 'account_nfts', account: platformAddress, limit: 400 });
        const expectedUri = xrpl.convertStringToHex(`ipfs://${targetTrack.metadata_cid}`);
        const matchingNft = (nftsResponse.result.account_nfts || []).find(n => n.URI === expectedUri);
        
        if (!matchingNft) {
          await client.disconnect();
          return res.status(400).json({ error: `"${targetTrack.title}" is sold out`, soldOut: true });
        }
        
        nftTokenId = matchingNft.NFTokenID;
        const salesCount = await sql`SELECT COUNT(*) as count FROM sales WHERE track_id = ${targetTrackId}`;
        editionNumber = (parseInt(salesCount[0]?.count) || 0) + 1;
        nftRecordId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO nfts (id, nft_token_id, release_id, track_id, edition_number, owner_address, status, created_at)
          VALUES (${nftRecordId}, ${nftTokenId}, ${releaseId}, ${targetTrackId}, ${editionNumber}, ${platformAddress}, 'pending', NOW())
        `;
      } else {
        const mintResult = await mintSingleNFT(client, platformWallet, platformAddress, targetTrack, release, sql);
        nftTokenId = mintResult.nftTokenId;
        editionNumber = mintResult.editionNumber;
        nftRecordId = mintResult.nftRecordId;
        didLazyMint = true;
      }
      
      // Cancel existing offers
      try {
        const offersResponse = await client.request({ command: 'nft_sell_offers', nft_id: nftTokenId });
        for (const offer of (offersResponse.result.offers || [])) {
          if (offer.owner === platformAddress) {
            const cancelTx = await client.autofill({ TransactionType: 'NFTokenCancelOffer', Account: platformAddress, NFTokenOffers: [offer.nft_offer_index] });
            const signedCancel = platformWallet.sign(cancelTx);
            await client.submitAndWait(signedCancel.tx_blob);
          }
        }
      } catch (e) {}
      
      // Create 0-amount sell offer (old flow)
      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer', Account: platformAddress, NFTokenID: nftTokenId,
        Amount: '1', Flags: 1, Destination: buyerAddress,
      });
      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        if (nftRecordId) await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
        await refundBuyer(client, platformWallet, platformAddress, buyerAddress, price, 'Offer creation failed');
        await client.disconnect();
        return res.status(400).json({ error: 'NFT transfer failed - payment refunded', refunded: true });
      }
      
      let offerIndex = null;
      for (const node of offerResult.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') { offerIndex = node.CreatedNode.LedgerIndex; break; }
      }
      
      // Pay artist
      const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
      const artistPayment = price - platformFee;
      if (artistPayment > 0) {
        const paymentTx = await client.autofill({
          TransactionType: 'Payment', Account: platformAddress, Destination: artistAddress,
          Amount: xrpl.xrpToDrops(artistPayment.toFixed(6)),
          Memos: [{ Memo: { MemoType: xrpl.convertStringToHex('XRPMusic'), MemoData: xrpl.convertStringToHex(`Sale: ${release.title}`) } }],
        });
        const signedPayment = platformWallet.sign(paymentTx);
        await client.submitAndWait(signedPayment.tx_blob);
        console.log('💰 Paid artist:', artistPayment, 'XRP');
      }
      
      await client.disconnect();
      
      return res.json({
        success: true, sellOfferIndex: offerIndex, nftTokenId, txHash: offerResult.result.hash, lazyMinted: didLazyMint,
        pendingSale: { releaseId, trackId: targetTrackId, buyerAddress, artistAddress, nftTokenId, editionNumber, price, platformFee },
      });
      
    } catch (innerError) {
      console.error('Purchase error:', innerError);
      if (nftRecordId) await sql`UPDATE nfts SET status = 'available' WHERE id = ${nftRecordId}`;
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

async function refundBuyer(client, platformWallet, platformAddress, buyerAddress, amount, reason) {
  try {
    console.log('💸 Refunding buyer:', buyerAddress, amount, 'XRP -', reason);
    const refundTx = await client.autofill({
      TransactionType: 'Payment', Account: platformAddress, Destination: buyerAddress,
      Amount: xrpl.xrpToDrops(amount.toFixed(6)),
      Memos: [{ Memo: { MemoType: xrpl.convertStringToHex('XRPMusic'), MemoData: xrpl.convertStringToHex('Refund: ' + reason) } }],
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
