/**
 * XRP Music - Releases API
 * Vercel Serverless Function
 * 
 * With lazy minting, releases are "live" when mint_fee_paid = true.
 * NFTs mint on-demand at purchase time, not upfront.
 * 
 * Visibility rules:
 * - Public pages: show is_minted = true OR mint_fee_paid = true OR r.status = 'live'
 * - Public feeds (Stream/Marketplace): when ?feed=true, additionally require artist has >= 20 XRP in total sales
 * - Artist's own page: show ALL their releases (including drafts)
 * - Single release by ID: always visible (for purchase flow, direct links)
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      return await getReleases(req, res, sql);
    } else if (req.method === 'POST') {
      return await createRelease(req, res, sql);
    } else if (req.method === 'PUT') {
      return await updateRelease(req, res, sql);
    } else if (req.method === 'DELETE') {
      return await deleteRelease(req, res, sql);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Releases API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getReleases(req, res, sql) {
  const { artist, id, includeUnminted, feed } = req.query;
  
  let releases;
  
  if (id) {
    // Get single release with tracks
    // No filter - need to see it for purchase flow regardless of status
    releases = await sql`
      SELECT r.*, 
        p.avatar_url as artist_avatar,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url,
              'metadataCid', t.metadata_cid,
              'soldCount', COALESCE(t.sold_count, 0),
              'mintedEditions', COALESCE(t.minted_editions, 0)
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE r.id = ${id}
      GROUP BY r.id, p.avatar_url
    `;
    
    if (releases.length === 0) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    return res.json({ release: formatRelease(releases[0]) });
  }
  
  if (artist) {
    if (includeUnminted === 'true') {
      // Artist's own profile - show ALL their releases
      releases = await sql`
        SELECT r.*, 
          p.avatar_url as artist_avatar,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'title', t.title,
                'trackNumber', t.track_order,
                'duration', t.duration,
                'audioCid', t.audio_cid,
                'audioUrl', t.audio_url,
                'metadataCid', t.metadata_cid,
                'soldCount', COALESCE(t.sold_count, 0),
                'mintedEditions', COALESCE(t.minted_editions, 0)
              ) ORDER BY t.track_order
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) as tracks
        FROM releases r
        LEFT JOIN tracks t ON t.release_id = r.id
        LEFT JOIN profiles p ON p.wallet_address = r.artist_address
        WHERE r.artist_address = ${artist}
        GROUP BY r.id, p.avatar_url
        ORDER BY r.created_at DESC
      `;
    } else {
      // Public view of artist - show live releases only (NO sales threshold here)
      releases = await sql`
        SELECT r.*, 
          p.avatar_url as artist_avatar,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'title', t.title,
                'trackNumber', t.track_order,
                'duration', t.duration,
                'audioCid', t.audio_cid,
                'audioUrl', t.audio_url,
                'metadataCid', t.metadata_cid,
                'soldCount', COALESCE(t.sold_count, 0),
                'mintedEditions', COALESCE(t.minted_editions, 0)
              ) ORDER BY t.track_order
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) as tracks
        FROM releases r
        LEFT JOIN tracks t ON t.release_id = r.id
        LEFT JOIN profiles p ON p.wallet_address = r.artist_address
        WHERE r.artist_address = ${artist}
          AND (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        GROUP BY r.id, p.avatar_url
        ORDER BY r.created_at DESC
      `;
    }
  } else if (feed === 'true') {
    // ============================================================
    // FILTERED FEED (Stream cards / Marketplace cards)
    // Only show releases from artists with >= 20 XRP total sales
    // ============================================================
    releases = await sql`
      SELECT r.*, 
        p.avatar_url as artist_avatar,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url,
              'metadataCid', t.metadata_cid,
              'soldCount', COALESCE(t.sold_count, 0),
              'mintedEditions', COALESCE(t.minted_editions, 0)
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.artist_address IN (
          SELECT seller_address
          FROM sales
          GROUP BY seller_address
          HAVING COALESCE(SUM(price), 0) >= 20
        )
      GROUP BY r.id, p.avatar_url
      ORDER BY r.created_at DESC
    `;
  } else {
    // ============================================================
    // UNFILTERED - All live releases (for artists list, stats, etc.)
    // ============================================================
    releases = await sql`
      SELECT r.*, 
        p.avatar_url as artist_avatar,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url,
              'metadataCid', t.metadata_cid,
              'soldCount', COALESCE(t.sold_count, 0),
              'mintedEditions', COALESCE(t.minted_editions, 0)
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live'
      GROUP BY r.id, p.avatar_url
      ORDER BY r.created_at DESC
    `;
  }
  
  return res.json({ releases: releases.map(formatRelease) });
}

async function createRelease(req, res, sql) {
  const {
    artistAddress,
    artistName,
    title,
    description,
    type,
    coverUrl,
    coverCid,
    metadataCid,
    songPrice,
    albumPrice,
    totalEditions,
    royaltyPercent,
    tracks,
    nftTokenIds,
    txHash,
    sellOfferIndex,
  } = req.body;
  
  if (!artistAddress || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const releaseId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Insert release - starts as draft, becomes live when mint fee paid
  const [release] = await sql`
    INSERT INTO releases (
      id,
      artist_address,
      artist_name,
      title,
      description,
      type,
      cover_url,
      cover_cid,
      metadata_cid,
      song_price,
      album_price,
      total_editions,
      sold_editions,
      minted_editions,
      royalty_percent,
      tx_hash,
      sell_offer_index,
      is_minted,
      mint_fee_paid,
      status,
      created_at
    ) VALUES (
      ${releaseId},
      ${artistAddress},
      ${artistName || null},
      ${title},
      ${description || null},
      ${type},
      ${coverUrl || null},
      ${coverCid || null},
      ${metadataCid || null},
      ${songPrice || 0},
      ${albumPrice || null},
      ${totalEditions || 100},
      0,
      0,
      ${royaltyPercent || 5},
      ${txHash || null},
      ${sellOfferIndex || null},
      false,
      false,
      'draft',
      NOW()
    )
    RETURNING *
  `;
  
  // Insert tracks
  const trackIds = [];
  if (tracks && tracks.length > 0) {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackId = `trk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await sql`
        INSERT INTO tracks (
          id,
          release_id,
          title,
          track_order,
          duration,
          audio_cid,
          audio_url,
          metadata_cid,
          sold_count,
          minted_editions,
          track_number
        ) VALUES (
          ${trackId},
          ${release.id},
          ${track.title || title},
          ${track.trackNumber || i + 1},
          ${track.duration || null},
          ${track.audioCid || null},
          ${track.audioUrl || null},
          ${track.metadataCid || null},
          0,
          0,
          ${i + 1}
        )
      `;
      trackIds.push(trackId);
    }
  }
  
  return res.json({ 
    success: true, 
    releaseId: release.id,
    trackIds: trackIds
  });
}

/**
 * Update an existing release
 * Used after mint fee payment to mark as live
 */
async function updateRelease(req, res, sql) {
  const { id } = req.query;
  const updates = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }
  
  // Prepare update values
  const nftTokenIds = updates.nftTokenIds || null;
  const txHash = updates.txHash || null;
  const sellOfferIndex = updates.sellOfferIndex || null;
  const listedAt = (updates.sellOfferIndex || updates.mintFeePaid) ? new Date() : null;
  const isMinted = updates.isMinted !== undefined ? updates.isMinted : null;
  const mintFeePaid = updates.mintFeePaid !== undefined ? updates.mintFeePaid : null;
  const mintFeeTxHash = updates.mintFeeTxHash || null;
  const mintFeeAmount = updates.mintFeeAmount || null;
  const status = updates.status || null;
  
  // Update the release
  const [updated] = await sql`
    UPDATE releases
    SET
      nft_token_ids = COALESCE(${nftTokenIds ? JSON.stringify(nftTokenIds) : null}, nft_token_ids),
      tx_hash = COALESCE(${txHash}, tx_hash),
      sell_offer_index = COALESCE(${sellOfferIndex}, sell_offer_index),
      listed_at = COALESCE(${listedAt}, listed_at),
      is_minted = COALESCE(${isMinted}, is_minted),
      mint_fee_paid = COALESCE(${mintFeePaid}, mint_fee_paid),
      mint_fee_tx_hash = COALESCE(${mintFeeTxHash}, mint_fee_tx_hash),
      mint_fee_amount = COALESCE(${mintFeeAmount}, mint_fee_amount),
      status = COALESCE(${status}, status)
    WHERE id = ${id}
    RETURNING *
  `;
  
  if (!updated) {
    return res.status(404).json({ error: 'Release not found' });
  }
  
  return res.json({ 
    success: true, 
    release: formatRelease(updated)
  });
}

/**
 * Delete a release and all associated data
 * Used for cleanup when mint fee payment fails
 */
async function deleteRelease(req, res, sql) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }
  
  console.log('🗑️ Deleting release:', id);
  
  try {
    // Check if release has any sales - don't delete if people bought NFTs!
    const sales = await sql`
      SELECT COUNT(*) as count FROM sales WHERE release_id = ${id}
    `;
    
    if (parseInt(sales[0]?.count) > 0) {
      console.log('❌ Cannot delete release with sales');
      return res.status(400).json({ 
        error: 'Cannot delete release that has sales. Contact support.' 
      });
    }
    
    // Delete in order due to foreign key constraints:
    
    // 1. Delete NFTs (references tracks and releases)
    const deletedNfts = await sql`
      DELETE FROM nfts WHERE release_id = ${id}
      RETURNING id
    `;
    console.log(`  Deleted ${deletedNfts.length} NFT records`);
    
    // 2. Delete tracks (references releases)
    const deletedTracks = await sql`
      DELETE FROM tracks WHERE release_id = ${id}
      RETURNING id
    `;
    console.log(`  Deleted ${deletedTracks.length} track records`);
    
    // 3. Delete mint_jobs if table exists
    try {
      const deletedJobs = await sql`
        DELETE FROM mint_jobs WHERE release_id = ${id}
        RETURNING id
      `;
      console.log(`  Deleted ${deletedJobs.length} mint job records`);
    } catch (e) {
      // Table might not exist, that's fine
    }
    
    // 4. Delete the release itself
    const deletedRelease = await sql`
      DELETE FROM releases WHERE id = ${id}
      RETURNING id
    `;
    
    if (deletedRelease.length === 0) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    console.log('✅ Successfully deleted release:', id);
    
    return res.json({ 
      success: true, 
      deleted: {
        releaseId: id,
        nfts: deletedNfts.length,
        tracks: deletedTracks.length
      }
    });
    
  } catch (error) {
    console.error('❌ Delete release error:', error);
    return res.status(500).json({ error: 'Failed to delete release: ' + error.message });
  }
}

function formatRelease(row) {
  return {
    id: row.id,
    artistAddress: row.artist_address,
    artistName: row.artist_name,
    artistAvatar: row.artist_avatar || null,
    title: row.title,
    description: row.description,
    type: row.type,
    coverUrl: row.cover_url,
    coverCid: row.cover_cid,
    metadataCid: row.metadata_cid,
    songPrice: parseFloat(row.song_price) || 0,
    albumPrice: row.album_price ? parseFloat(row.album_price) : null,
    totalEditions: row.total_editions || 100,
    soldEditions: calculateSoldEditions(row),
    mintedEditions: row.minted_editions || 0,
    royaltyPercent: row.royalty_percent || 5,
    nftTokenId: row.nft_token_id,
    nftTokenIds: row.nft_token_ids ? (typeof row.nft_token_ids === 'string' ? JSON.parse(row.nft_token_ids) : row.nft_token_ids) : [],
    sellOfferIndex: row.sell_offer_index,
    listedAt: row.listed_at,
    txHash: row.tx_hash,
    isMinted: row.is_minted || false,
    mintFeePaid: row.mint_fee_paid || false,
    mintFeeTxHash: row.mint_fee_tx_hash,
    mintFeeAmount: row.mint_fee_amount ? parseFloat(row.mint_fee_amount) : null,
    status: row.status || 'draft',
    createdAt: row.created_at,
    tracks: row.tracks || [],
  };
}

/**
 * Calculate sold editions based on track sales
 * For albums: use the track with most sales (determines album availability)
 */
function calculateSoldEditions(row) {
  const tracks = row.tracks || [];
  if (tracks.length === 0) {
    return row.sold_editions || 0;
  }
  
  let maxSold = 0;
  for (const track of tracks) {
    const trackSold = parseInt(track.soldCount) || 0;
    if (trackSold > maxSold) {
      maxSold = trackSold;
    }
  }
  
  return maxSold;
}
