/**
 * XRP Music - Gifts API
 * Vercel Serverless Function
 * 
 * Handles:
 * - POST: Create gift, accept gift (lazy mint + sell offer), decline gift
 * - GET: Fetch gifts (sent, received, pending)
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'accept') {
      return handleAcceptGift(req, res, sql);
    }

    if (action === 'decline') {
      return handleDeclineGift(req, res, sql);
    }

    if (action === 'confirm') {
      return handleConfirmGift(req, res, sql);
    }

    return handleCreateGift(req, res, sql);
  }

  if (req.method === 'GET') {
    return handleGetGifts(req, res, sql);
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

/**
 * Create a new gift
 */
async function handleCreateGift(req, res, sql) {
  const { senderAddress, recipientAddress, releaseId, trackId } = req.body;

  if (!senderAddress || !recipientAddress || !releaseId || !trackId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    const [release] = await sql`
      SELECT id, artist_address, title, cover_url, total_editions 
      FROM releases 
      WHERE id = ${releaseId} AND artist_address = ${senderAddress}
    `;

    if (!release) {
      return res.status(403).json({ success: false, error: 'You can only gift from your own releases' });
    }

    const [track] = await sql`
      SELECT id, title, sold_count, metadata_cid FROM tracks 
      WHERE id = ${trackId} AND release_id = ${releaseId}
    `;

    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    const [senderProfile] = await sql`
      SELECT name FROM profiles WHERE wallet_address = ${senderAddress}
    `;
    const senderName = senderProfile?.name || senderAddress.slice(0, 8) + '...';

    const giftId = `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO gifts (id, sender_address, recipient_address, release_id, track_id, status, created_at)
      VALUES (${giftId}, ${senderAddress}, ${recipientAddress}, ${releaseId}, ${trackId}, 'pending', NOW())
    `;

    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notifTitle = `🎁 ${senderName} sent you a gift!`;
    const notifMessage = `"${track.title || release.title}" — tap to accept your free NFT`;

    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, created_at)
      VALUES (${notifId}, ${recipientAddress}, 'gift', ${notifTitle}, ${notifMessage}, ${releaseId}, ${trackId}, NOW())
    `;

    return res.status(200).json({
      success: true,
      giftId,
      message: 'Gift created successfully'
    });

  } catch (error) {
    console.error('Gift creation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Accept a gift — lazy mint NFT + create sell offer for recipient
 */
async function handleAcceptGift(req, res, sql) {
  const { giftId, recipientAddress } = req.body;

  if (!giftId || !recipientAddress) {
    return res.status(400).json({ success: false, error: 'Gift ID and recipient address required' });
  }

  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
  const platformSeed = process.env.PLATFORM_WALLET_SEED;

  if (!platformAddress || !platformSeed) {
    return res.status(500).json({ success: false, error: 'Platform not configured' });
  }

  try {
    const [gift] = await sql`
      SELECT g.*, r.title as release_title, r.total_editions, r.royalty_percent, r.cover_url,
             t.title as track_title, t.metadata_cid, t.sold_count
      FROM gifts g
      JOIN releases r ON g.release_id = r.id
      JOIN tracks t ON g.track_id = t.id
      WHERE g.id = ${giftId} AND g.recipient_address = ${recipientAddress} AND g.status = 'pending'
    `;

    if (!gift) {
      return res.status(404).json({ success: false, error: 'Gift not found or already claimed' });
    }

    if (!gift.metadata_cid) {
      return res.status(400).json({ success: false, error: 'Track missing metadata — cannot mint' });
    }

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    const platformWallet = xrpl.Wallet.fromSeed(platformSeed);

    try {
      console.log('🎁 Lazy minting gift NFT for:', recipientAddress);

      const metadataUri = `ipfs://${gift.metadata_cid}`;
      const uriHex = Buffer.from(metadataUri).toString('hex').toUpperCase();
      const royaltyPercent = gift.royalty_percent || 5;
      const transferFee = Math.round(royaltyPercent * 1000);

      const mintTx = await client.autofill({
        TransactionType: 'NFTokenMint',
        Account: platformAddress,
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
      if (!nftTokenId) {
        throw new Error('Could not extract NFT Token ID from mint result');
      }

      console.log('✅ Gift NFT minted:', nftTokenId);

      const createOfferTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformAddress,
        NFTokenID: nftTokenId,
        Amount: '1',
        Flags: 1,
        Destination: recipientAddress,
      });

      const signedOffer = platformWallet.sign(createOfferTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);

      if (offerResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Sell offer failed: ${offerResult.result.meta.TransactionResult}`);
      }

      let offerIndex = null;
      for (const node of offerResult.result.meta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerIndex = node.CreatedNode.LedgerIndex;
          break;
        }
      }

      console.log('✅ Gift sell offer created:', offerIndex);

      await sql`
        UPDATE gifts 
        SET nft_token_id = ${nftTokenId}, offer_index = ${offerIndex}, status = 'minted'
        WHERE id = ${giftId}
      `;

      await client.disconnect();

      return res.json({
        success: true,
        sellOfferIndex: offerIndex,
        nftTokenId,
        message: 'Gift NFT minted! Accept the offer in your wallet.',
      });

    } catch (innerError) {
      console.error('Gift accept error:', innerError);
      await client.disconnect();
      return res.status(500).json({ success: false, error: innerError.message });
    }

  } catch (error) {
    console.error('Gift accept error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Confirm gift after recipient accepts the NFT offer in Xaman
 */
async function handleConfirmGift(req, res, sql) {
  const { giftId, acceptTxHash } = req.body;

  if (!giftId) {
    return res.status(400).json({ success: false, error: 'Gift ID required' });
  }

  try {
    const [gift] = await sql`
      SELECT * FROM gifts WHERE id = ${giftId} AND status = 'minted'
    `;

    if (!gift) {
      return res.status(404).json({ success: false, error: 'Gift not found or not ready' });
    }

    // Mark gift as accepted
    await sql`
      UPDATE gifts 
      SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${giftId}
    `;

    // Increment total_editions on the release (gift adds a new copy beyond the sale pool)
    await sql`
      UPDATE releases 
      SET total_editions = total_editions + 1
      WHERE id = ${gift.release_id}
    `;

    // Get current sold_count to calculate edition number
    // Edition # = sold_count (purchases) + number of accepted gifts for this track
    const [track] = await sql`
      SELECT sold_count FROM tracks WHERE id = ${gift.track_id}
    `;

    const acceptedGiftsCount = await sql`
      SELECT COUNT(*) as count FROM gifts 
      WHERE track_id = ${gift.track_id} AND status = 'accepted'
    `;

    const editionNumber = (track?.sold_count || 0) + parseInt(acceptedGiftsCount[0]?.count || 0);

    // Do NOT increment sold_count — gifts are not sales

    // Insert NFT record with edition number
    const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO nfts (id, nft_token_id, release_id, track_id, owner_address, edition_number, status, created_at)
      VALUES (${nftId}, ${gift.nft_token_id}, ${gift.release_id}, ${gift.track_id}, ${gift.recipient_address}, ${editionNumber}, 'sold', NOW())
    `;

    // Get names for notifications
    const [recipientProfile] = await sql`
      SELECT name FROM profiles WHERE wallet_address = ${gift.recipient_address}
    `;
    const recipientName = recipientProfile?.name || gift.recipient_address.slice(0, 8) + '...';

    const [senderProfile] = await sql`
      SELECT name FROM profiles WHERE wallet_address = ${gift.sender_address}
    `;
    const senderName = senderProfile?.name || gift.sender_address.slice(0, 8) + '...';

    const [release] = await sql`
      SELECT title FROM releases WHERE id = ${gift.release_id}
    `;
    const releaseTitle = release?.title || 'Track';

    // Notify the SENDER that their gift was accepted
    const senderNotifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, created_at)
      VALUES (${senderNotifId}, ${gift.sender_address}, 'gift_accepted', ${`🎁 ${recipientName} accepted your gift!`}, ${`"${releaseTitle}" has been claimed`}, ${gift.release_id}, ${gift.track_id}, NOW())
    `;

    // Update the RECIPIENT's gift notification to show accepted state
    await sql`
      UPDATE artist_notifications 
      SET type = 'gift_accepted', 
          title = ${`🎁 You accepted a gift from ${senderName}!`},
          message = ${`"${releaseTitle}" — Edition #${editionNumber}`}
      WHERE artist_address = ${gift.recipient_address} 
        AND type = 'gift' 
        AND release_id = ${gift.release_id} 
        AND track_id = ${gift.track_id}
    `;

    return res.json({ success: true, message: 'Gift confirmed!', editionNumber });

  } catch (error) {
    console.error('Gift confirm error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Decline a gift
 */
async function handleDeclineGift(req, res, sql) {
  const { giftId, recipientAddress } = req.body;

  if (!giftId || !recipientAddress) {
    return res.status(400).json({ success: false, error: 'Gift ID and recipient address required' });
  }

  try {
    const [gift] = await sql`
      SELECT * FROM gifts 
      WHERE id = ${giftId} AND recipient_address = ${recipientAddress} AND status = 'pending'
    `;

    if (!gift) {
      return res.status(404).json({ success: false, error: 'Gift not found' });
    }

    await sql`
      UPDATE gifts SET status = 'declined' WHERE id = ${giftId}
    `;

    await sql`
      DELETE FROM artist_notifications 
      WHERE artist_address = ${recipientAddress} AND type = 'gift' AND release_id = ${gift.release_id} AND track_id = ${gift.track_id}
    `;

    return res.json({ success: true, message: 'Gift declined' });

  } catch (error) {
    console.error('Gift decline error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get gifts for a user
 */
async function handleGetGifts(req, res, sql) {
  const { address, type } = req.query;

  if (!address) {
    return res.status(400).json({ success: false, error: 'Address required' });
  }

  try {
    let gifts;

    if (type === 'sent') {
      gifts = await sql`
        SELECT g.*, r.title as release_title, r.cover_url, t.title as track_title,
               p.name as recipient_name, p.avatar_url as recipient_avatar
        FROM gifts g
        JOIN releases r ON g.release_id = r.id
        JOIN tracks t ON g.track_id = t.id
        LEFT JOIN profiles p ON g.recipient_address = p.wallet_address
        WHERE g.sender_address = ${address}
        ORDER BY g.created_at DESC
      `;
    } else if (type === 'pending') {
      gifts = await sql`
        SELECT g.*, r.title as release_title, r.cover_url, r.artist_name, t.title as track_title,
               p.name as sender_name, p.avatar_url as sender_avatar
        FROM gifts g
        JOIN releases r ON g.release_id = r.id
        JOIN tracks t ON g.track_id = t.id
        LEFT JOIN profiles p ON g.sender_address = p.wallet_address
        WHERE g.recipient_address = ${address} AND g.status = 'pending'
        ORDER BY g.created_at DESC
      `;
    } else if (type === 'received') {
      gifts = await sql`
        SELECT g.*, r.title as release_title, r.cover_url, r.artist_name, t.title as track_title,
               p.name as sender_name, p.avatar_url as sender_avatar
        FROM gifts g
        JOIN releases r ON g.release_id = r.id
        JOIN tracks t ON g.track_id = t.id
        LEFT JOIN profiles p ON g.sender_address = p.wallet_address
        WHERE g.recipient_address = ${address}
        ORDER BY g.created_at DESC
      `;
    } else {
      gifts = await sql`
        SELECT g.*, r.title as release_title, r.cover_url, r.artist_name, t.title as track_title
        FROM gifts g
        JOIN releases r ON g.release_id = r.id
        JOIN tracks t ON g.track_id = t.id
        WHERE g.sender_address = ${address} OR g.recipient_address = ${address}
        ORDER BY g.created_at DESC
      `;
    }

    const pendingCount = await sql`
      SELECT COUNT(*) as count FROM gifts 
      WHERE recipient_address = ${address} AND status = 'pending'
    `;

    return res.status(200).json({
      success: true,
      gifts,
      pendingCount: parseInt(pendingCount[0]?.count || 0)
    });

  } catch (error) {
    console.error('Get gifts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
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
