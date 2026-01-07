/**
 * XRP Music - Releases API
 * Vercel Serverless Function
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Initialize SQL connection inside handler
  const sql = neon(process.env.DATABASE_URL);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Releases API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getReleases(req, res, sql) {
  const { artist, id } = req.query;
  
  let releases;
  
  if (id) {
    // Get single release with tracks and per-track sold counts
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
              'soldCount', COALESCE((
                SELECT COUNT(*) FROM sales s WHERE s.track_id = t.id
              ), 0)
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
    // Get releases by artist with per-track sold counts
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
              'soldCount', COALESCE((
                SELECT COUNT(*) FROM sales s WHERE s.track_id = t.id
              ), 0)
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
    // Get all releases with per-track sold counts
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
              'soldCount', COALESCE((
                SELECT COUNT(*) FROM sales s WHERE s.track_id = t.id
              ), 0)
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
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
    tracks,
    nftTokenIds,
    txHash,
    sellOfferIndex,
  } = req.body;
  
  if (!artistAddress || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Generate unique ID (since id column is varchar, not serial)
  const releaseId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Insert release (using columns that exist in your schema)
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
      tx_hash,
      sell_offer_index,
      listed_at,
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
      ${txHash || null},
      ${sellOfferIndex || null},
      ${sellOfferIndex ? new Date() : null},
      NOW()
    )
    RETURNING *
  `;
  
  // Insert tracks and collect their IDs
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
          sold_editions
        ) VALUES (
          ${trackId},
          ${release.id},
          ${track.title || title},
          ${track.trackNumber || i + 1},
          ${track.duration || null},
          ${track.audioCid || null},
          ${track.audioUrl || null},
          ${track.metadataCid || null},
          0
        )
      `;
      trackIds.push(trackId);
    }
  }
  
  // Return both releaseId and trackIds for NFT minting
  return res.json({ 
    success: true, 
    releaseId: release.id,
    trackIds: trackIds
  });
}

/**
 * Update an existing release
 * Used after NFT minting to add nftTokenIds, txHash, etc.
 */
async function updateRelease(req, res, sql) {
  const { id } = req.query;
  const updates = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }
  
  // Build dynamic update query based on provided fields
  const allowedFields = {
    nftTokenIds: 'nft_token_ids',
    txHash: 'tx_hash',
    sellOfferIndex: 'sell_offer_index',
    listedAt: 'listed_at',
    soldEditions: 'sold_editions',
  };
  
  // Prepare update values
  const nftTokenIds = updates.nftTokenIds || null;
  const txHash = updates.txHash || null;
  const sellOfferIndex = updates.sellOfferIndex || null;
  const listedAt = updates.sellOfferIndex ? new Date() : null;
  
  // Update the release
  const [updated] = await sql`
    UPDATE releases
    SET
      nft_token_ids = COALESCE(${nftTokenIds ? JSON.stringify(nftTokenIds) : null}, nft_token_ids),
      tx_hash = COALESCE(${txHash}, tx_hash),
      sell_offer_index = COALESCE(${sellOfferIndex}, sell_offer_index),
      listed_at = COALESCE(${listedAt}, listed_at)
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
    // Calculate sold editions as max of any track's sold count (for accurate album availability)
    soldEditions: calculateSoldEditions(row),
    nftTokenId: row.nft_token_id,
    nftTokenIds: row.nft_token_ids ? (typeof row.nft_token_ids === 'string' ? JSON.parse(row.nft_token_ids) : row.nft_token_ids) : [],
    sellOfferIndex: row.sell_offer_index,
    listedAt: row.listed_at,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    tracks: row.tracks || [],
  };
}

// Calculate sold editions based on track with most sales
// Album availability = total - max(track sold counts)
function calculateSoldEditions(row) {
  const tracks = row.tracks || [];
  if (tracks.length === 0) {
    return row.sold_editions || 0;
  }
  
  // Find the track with most sales (determines album availability)
  let maxSold = 0;
  for (const track of tracks) {
    const trackSold = parseInt(track.soldCount) || 0;
    if (trackSold > maxSold) {
      maxSold = trackSold;
    }
  }
  
  return maxSold;
}
