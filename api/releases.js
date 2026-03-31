/**
 * XRP Music - Releases API
 * Vercel Serverless Function
 * 
 * With lazy minting, releases are "live" when mint_fee_paid = true.
 * NFTs mint on-demand at purchase time, not upfront.
 * 
 * DRAFT SYSTEM:
 * - status='draft' releases are saved but not minted
 * - visibility='private': only artist sees (+ anyone with direct link)
 * - visibility='public': shows on artist's profile page with "Coming Soon" badge
 * - Drafts NEVER appear in Stream, Marketplace, search, or genre pages
 * 
 * Visibility rules:
 * - Public pages: show is_minted = true OR mint_fee_paid = true OR r.status = 'live'
 * - Public feeds (Stream/Marketplace): when ?feed=true, additionally require artist has >= 20 XRP in total sales
 * - Artist's own page (includeUnminted=true): show ALL their releases (including drafts)
 * - Artist's public page: show live releases + public drafts (visibility='public')
 * - Single release by ID: always visible (for purchase flow, direct links, draft preview)
 * 
 * CONTENT TYPE FILTERING:
 * - Stream/Marketplace pages: show ALL content types (no filter)
 * - Audiobooks page (?contentType=audiobook): audiobook releases only
 * - Podcasts page (?contentType=podcast): podcast releases only
 * - Stats/totals: count ALL content types (no filter)
 * - Player queue: frontend filters to music only (not handled here)
 * 
 * TRACK UPDATES:
 * - Tracks are updated IN PLACE (not deleted + re-inserted) to preserve
 *   foreign key references from plays, sales, and nfts tables.
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
  const { artist, id, includeUnminted, feed, contentType } = req.query;
  
  let releases;
  
  if (id) {
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
              'mintedEditions', COALESCE(t.minted_editions, 0),
              'price', t.price,
              'videoCid', t.video_cid,
              'videoUrl', t.video_url,
              'genre', t.genre,
              'genreSecondary', t.genre_secondary,
              'genreTertiary', t.genre_tertiary
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
                'mintedEditions', COALESCE(t.minted_editions, 0),
                'price', t.price,
                'videoCid', t.video_cid,
                'videoUrl', t.video_url,
                'genre', t.genre,
                'genreSecondary', t.genre_secondary,
                'genreTertiary', t.genre_tertiary
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
                'mintedEditions', COALESCE(t.minted_editions, 0),
                'price', t.price,
                'videoCid', t.video_cid,
                'videoUrl', t.video_url,
                'genre', t.genre,
                'genreSecondary', t.genre_secondary,
                'genreTertiary', t.genre_tertiary
              ) ORDER BY t.track_order
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) as tracks
        FROM releases r
        LEFT JOIN tracks t ON t.release_id = r.id
        LEFT JOIN profiles p ON p.wallet_address = r.artist_address
        WHERE r.artist_address = ${artist}
          AND (
            (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
            OR (r.status = 'draft' AND r.visibility = 'public')
          )
        GROUP BY r.id, p.avatar_url
        ORDER BY r.created_at DESC
      `;
    }
  } else if (feed === 'true') {
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
              'mintedEditions', COALESCE(t.minted_editions, 0),
              'price', t.price,
              'videoCid', t.video_cid,
              'videoUrl', t.video_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.status != 'draft'
        AND r.artist_address IN (
          SELECT seller_address
          FROM sales
          GROUP BY seller_address
          HAVING COALESCE(SUM(price), 0) >= 20
        )
      GROUP BY r.id, p.avatar_url
      ORDER BY r.created_at DESC
    `;
  } else if (contentType) {
    // ============================================================
    // CONTENT TYPE FILTERED (Audiobooks or Podcasts pages)
    // Show only releases matching the specified content type
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
              'mintedEditions', COALESCE(t.minted_editions, 0),
              'price', t.price,
              'videoCid', t.video_cid,
              'videoUrl', t.video_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.status != 'draft'
        AND r.content_type = ${contentType}
      GROUP BY r.id, p.avatar_url
      ORDER BY r.created_at DESC
    `;
  } else {
    // ============================================================
    // UNFILTERED (Stream page, stats, everything else)
    // Show ALL content types - NO contentType filter
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
              'mintedEditions', COALESCE(t.minted_editions, 0),
              'price', t.price,
              'videoCid', t.video_cid,
              'videoUrl', t.video_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.status != 'draft'
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
    visibility,
    draftGenres,
    contentType = 'music',
  } = req.body;
  
  if (!artistAddress || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const releaseId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
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
      visibility,
      draft_genres,
      content_type,
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
      ${visibility || 'private'},
      ${draftGenres ? JSON.stringify(draftGenres) : null},
      ${contentType},
      NOW()
    )
    RETURNING *
  `;
  
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
          track_number,
          price,
          video_cid,
          video_url,
          genre,
          genre_secondary,
          genre_tertiary
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
          ${i + 1},
          ${track.price !== undefined && track.price !== null ? track.price : null},
          ${track.videoCid || null},
          ${track.videoUrl || null},
          ${track.genre || null},
          ${track.genreSecondary || null},
          ${track.genreTertiary || null}
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

async function updateRelease(req, res, sql) {
  const { id } = req.query;
  const updates = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }
  
  const nftTokenIds = updates.nftTokenIds || null;
  const txHash = updates.txHash || null;
  const sellOfferIndex = updates.sellOfferIndex || null;
  const listedAt = (updates.sellOfferIndex || updates.mintFeePaid) ? new Date() : null;
  const isMinted = updates.isMinted !== undefined ? updates.isMinted : null;
  const mintFeePaid = updates.mintFeePaid !== undefined ? updates.mintFeePaid : null;
  const mintFeeTxHash = updates.mintFeeTxHash || null;
  const mintFeeAmount = updates.mintFeeAmount || null;
  const status = updates.status || null;
  const visibility = updates.visibility || null;
  const draftGenres = updates.draftGenres !== undefined ? JSON.stringify(updates.draftGenres) : null;
  const contentType = updates.contentType || null;
  
  const title = updates.title || null;
  const description = updates.description !== undefined ? updates.description : null;
  const songPrice = updates.songPrice !== undefined ? updates.songPrice : null;
  const albumPrice = updates.albumPrice !== undefined ? updates.albumPrice : null;
  const totalEditions = updates.totalEditions !== undefined ? updates.totalEditions : null;
  const royaltyPercent = updates.royaltyPercent !== undefined ? updates.royaltyPercent : null;
  const coverUrl = updates.coverUrl || null;
  const coverCid = updates.coverCid || null;
  
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
      status = COALESCE(${status}, status),
      visibility = COALESCE(${visibility}, visibility),
      draft_genres = COALESCE(${draftGenres}, draft_genres),
      content_type = COALESCE(${contentType}, content_type),
      title = COALESCE(${title}, title),
      description = COALESCE(${description}, description),
      song_price = COALESCE(${songPrice}, song_price),
      album_price = COALESCE(${albumPrice}, album_price),
      total_editions = COALESCE(${totalEditions}, total_editions),
      royalty_percent = COALESCE(${royaltyPercent}, royalty_percent),
      cover_url = COALESCE(${coverUrl}, cover_url),
      cover_cid = COALESCE(${coverCid}, cover_cid)
    WHERE id = ${id}
    RETURNING *
  `;
  
  if (!updated) {
    return res.status(404).json({ error: 'Release not found' });
  }
  
  if (updates.tracks && Array.isArray(updates.tracks) && updates.tracks.length > 0) {
    const existingTracks = await sql`
      SELECT id, track_order FROM tracks WHERE release_id = ${id} ORDER BY track_order
    `;
    
    for (let i = 0; i < updates.tracks.length; i++) {
      const track = updates.tracks[i];
      
      if (i < existingTracks.length) {
        await sql`
          UPDATE tracks SET
            title = ${track.title || 'Untitled'},
            track_order = ${track.trackNumber || i + 1},
            duration = COALESCE(${track.duration || null}, duration),
            audio_cid = COALESCE(${track.audioCid || null}, audio_cid),
            audio_url = COALESCE(${track.audioUrl || null}, audio_url),
            metadata_cid = COALESCE(${track.metadataCid || null}, metadata_cid),
            track_number = ${i + 1},
            price = ${track.price !== undefined && track.price !== null ? track.price : null},
            video_cid = ${track.videoCid || null},
            video_url = ${track.videoUrl || null},
            genre = COALESCE(${track.genre || null}, genre),
            genre_secondary = COALESCE(${track.genreSecondary || null}, genre_secondary),
            genre_tertiary = COALESCE(${track.genreTertiary || null}, genre_tertiary)
          WHERE id = ${existingTracks[i].id}
        `;
      } else {
        const trackId = `trk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO tracks (
            id, release_id, title, track_order, duration,
            audio_cid, audio_url, metadata_cid, sold_count, minted_editions,
            track_number, price, video_cid, video_url,
            genre, genre_secondary, genre_tertiary
          ) VALUES (
            ${trackId}, ${id}, ${track.title || 'Untitled'}, ${track.trackNumber || i + 1},
            ${track.duration || null}, ${track.audioCid || null}, ${track.audioUrl || null},
            ${track.metadataCid || null}, 0, 0, ${i + 1},
            ${track.price !== undefined && track.price !== null ? track.price : null},
            ${track.videoCid || null}, ${track.videoUrl || null},
            ${track.genre || null}, ${track.genreSecondary || null}, ${track.genreTertiary || null}
          )
        `;
      }
    }
  }
  
  return res.json({ 
    success: true, 
    release: formatRelease(updated)
  });
}

async function deleteRelease(req, res, sql) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }
  
  console.log('🗑️ Deleting release:', id);
  
  try {
    const sales = await sql`
      SELECT COUNT(*) as count FROM sales WHERE release_id = ${id}
    `;
    
    if (parseInt(sales[0]?.count) > 0) {
      console.log('❌ Cannot delete release with sales');
      return res.status(400).json({ 
        error: 'Cannot delete release that has sales. Contact support.' 
      });
    }
    
    const deletedNfts = await sql`
      DELETE FROM nfts WHERE release_id = ${id}
      RETURNING id
    `;
    console.log(`  Deleted ${deletedNfts.length} NFT records`);
    
    const trackIds = await sql`
      SELECT id FROM tracks WHERE release_id = ${id}
    `;
    if (trackIds.length > 0) {
      const ids = trackIds.map(t => t.id);
      await sql`DELETE FROM plays WHERE track_id = ANY(${ids})`;
      console.log(`  Deleted play records for ${ids.length} tracks`);
    }
    
    const deletedTracks = await sql`
      DELETE FROM tracks WHERE release_id = ${id}
      RETURNING id
    `;
    console.log(`  Deleted ${deletedTracks.length} track records`);
    
    try {
      const deletedJobs = await sql`
        DELETE FROM mint_jobs WHERE release_id = ${id}
        RETURNING id
      `;
      console.log(`  Deleted ${deletedJobs.length} mint job records`);
    } catch (e) {
      // Table might not exist
    }
    
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
    visibility: row.visibility || 'private',
    draftGenres: row.draft_genres || null,
    contentType: row.content_type || 'music',
    createdAt: row.created_at,
    tracks: row.tracks || [],
  };
}

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
