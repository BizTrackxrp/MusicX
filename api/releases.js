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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      return await getReleases(req, res, sql);
    } else if (req.method === 'POST') {
      return await createRelease(req, res, sql);
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
    // Get single release with tracks
    releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      WHERE r.id = ${id}
      GROUP BY r.id
    `;
    
    if (releases.length === 0) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    return res.json({ release: formatRelease(releases[0]) });
  }
  
  if (artist) {
    // Get releases by artist
    releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      WHERE r.artist_address = ${artist}
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
  } else {
    // Get all releases
    releases = await sql`
      SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'trackNumber', t.track_order,
              'duration', t.duration,
              'audioCid', t.audio_cid,
              'audioUrl', t.audio_url
            ) ORDER BY t.track_order
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tracks
      FROM releases r
      LEFT JOIN tracks t ON t.release_id = r.id
      GROUP BY r.id
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
    nftTokenId,
    txHash,
  } = req.body;
  
  if (!artistAddress || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Insert release (using columns that exist in your schema)
  const [release] = await sql`
    INSERT INTO releases (
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
      sold_editions,
      tx_hash,
      created_at
    ) VALUES (
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
      0,
      ${txHash || null},
      NOW()
    )
    RETURNING *
  `;
  
  // Insert tracks
  if (tracks && tracks.length > 0) {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      await sql`
        INSERT INTO tracks (
          release_id,
          title,
          track_order,
          duration,
          audio_cid,
          audio_url
        ) VALUES (
          ${release.id},
          ${track.title || title},
          ${track.trackNumber || i + 1},
          ${track.duration || null},
          ${track.audioCid || null},
          ${track.audioUrl || null}
        )
      `;
    }
  }
  
  return res.json({ success: true, releaseId: release.id });
}

function formatRelease(row) {
  return {
    id: row.id,
    artistAddress: row.artist_address,
    artistName: row.artist_name,
    title: row.title,
    description: row.description,
    type: row.type,
    coverUrl: row.cover_url,
    coverCid: row.cover_cid,
    metadataCid: row.metadata_cid,
    songPrice: parseFloat(row.song_price) || 0,
    albumPrice: row.album_price ? parseFloat(row.album_price) : null,
    totalEditions: 100, // Default since column doesn't exist
    soldEditions: row.sold_editions || 0,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    tracks: row.tracks || [],
  };
}
