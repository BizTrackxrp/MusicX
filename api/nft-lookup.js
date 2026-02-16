import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PLATFORM_WALLET = 'rBvqEKtZXZk95VarHPCYWRYc6YTnLWKtkp';

// ─── CORS headers for public API access ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  // Set CORS headers on all responses
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  try {
    // ─── GET: Single NFT lookup ───
    if (req.method === 'GET') {
      const { nft_id, token_id } = req.query;
      const id = nft_id || token_id;

      if (!id) {
        return res.status(400).json({ error: 'Missing nft_id or token_id parameter' });
      }

      const result = await lookupNFT(id);
      if (!result) {
        return res.status(404).json({ error: 'NFT not found', nft_id: id });
      }

      return res.status(200).json(result);
    }

    // ─── POST: Batch NFT lookup ───
    if (req.method === 'POST') {
      const { nft_ids } = req.body || {};

      if (!nft_ids || !Array.isArray(nft_ids) || nft_ids.length === 0) {
        return res.status(400).json({ error: 'Missing or empty nft_ids array in request body' });
      }

      if (nft_ids.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 NFT IDs per batch request' });
      }

      const results = await lookupBatch(nft_ids);
      return res.status(200).json({
        results,
        found: results.filter(r => r.found).length,
        not_found: results.filter(r => !r.found).length,
      });
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET for single lookup or POST for batch.' });
  } catch (err) {
    console.error('nft-lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Single NFT lookup ───
async function lookupNFT(nftId) {
  const { rows } = await pool.query(`
    SELECT 
      n.nft_token_id,
      n.release_id,
      n.track_id,
      n.owner_address,
      n.edition_number,
      r.artist_address,
      r.artist_name,
      r.title AS release_title,
      r.cover_cid,
      r.is_album,
      r.transfer_fee,
      r.mint_fee_paid,
      r.is_minted,
      t.title AS track_title,
      t.track_number
    FROM nfts n
    JOIN releases r ON n.release_id = r.id
    LEFT JOIN tracks t ON n.track_id = t.id
    WHERE n.nft_token_id = $1
    LIMIT 1
  `, [nftId]);

  if (rows.length === 0) return null;

  const row = rows[0];
  return formatResult(row);
}

// ─── Batch NFT lookup ───
async function lookupBatch(nftIds) {
  const { rows } = await pool.query(`
    SELECT 
      n.nft_token_id,
      n.release_id,
      n.track_id,
      n.owner_address,
      n.edition_number,
      r.artist_address,
      r.artist_name,
      r.title AS release_title,
      r.cover_cid,
      r.is_album,
      r.transfer_fee,
      r.mint_fee_paid,
      r.is_minted,
      t.title AS track_title,
      t.track_number
    FROM nfts n
    JOIN releases r ON n.release_id = r.id
    LEFT JOIN tracks t ON n.track_id = t.id
    WHERE n.nft_token_id = ANY($1)
  `, [nftIds]);

  // Build a map for fast lookup
  const resultMap = {};
  for (const row of rows) {
    resultMap[row.nft_token_id] = formatResult(row);
  }

  // Return results in the same order as input, marking missing ones
  return nftIds.map(id => {
    if (resultMap[id]) return resultMap[id];
    return { nft_id: id, found: false };
  });
}

// ─── Format a DB row into the API response ───
function formatResult(row) {
  // Determine mint type for SpaceBar's grouping logic
  let mintType;
  if (row.is_minted && !row.mint_fee_paid) {
    mintType = 'og';           // Pre-lazy-mint, artist is on-chain issuer
  } else if (row.mint_fee_paid) {
    // Could further distinguish legacy vs verified using ISSUER_FIX_DATE
    // but for SpaceBar's purposes, the artistAddress is the key info
    mintType = 'lazy';
  } else {
    mintType = 'unknown';
  }

  return {
    found: true,
    nft_id: row.nft_token_id,
    artistAddress: row.artist_address,
    artistName: row.artist_name,
    releaseTitle: row.release_title,
    trackTitle: row.track_title || row.release_title,
    releaseId: row.release_id,
    trackId: row.track_id,
    trackNumber: row.track_number,
    editionNumber: row.edition_number,
    ownerAddress: row.owner_address,
    isAlbum: row.is_album,
    coverCid: row.cover_cid,
    transferFee: row.transfer_fee,
    mintType,
    // Convenience: IPFS gateway URL for cover art
    coverUrl: row.cover_cid ? `https://gateway.lighthouse.storage/ipfs/${row.cover_cid}` : null,
  };
}
