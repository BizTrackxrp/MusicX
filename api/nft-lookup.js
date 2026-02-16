/**
 * XRP Music - NFT Lookup API
 * Public endpoint for resolving NFT token IDs to artist information.
 * Built for SpaceBar's Boombox / tip bot integration.
 *
 * GET  /api/nft-lookup?nft_id=xxx     → single lookup
 * POST /api/nft-lookup { nft_ids: [] } → batch lookup (max 100)
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ─── GET: Single NFT lookup ───
    if (req.method === 'GET') {
      const { nft_id, token_id } = req.query;
      const id = nft_id || token_id;

      if (!id) {
        return res.status(400).json({ error: 'Missing nft_id or token_id parameter' });
      }

      const rows = await sql`
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
          r.type AS release_type,
          r.transfer_fee,
          r.mint_fee_paid,
          r.is_minted,
          t.title AS track_title,
          t.track_order
        FROM nfts n
        JOIN releases r ON n.release_id = r.id
        LEFT JOIN tracks t ON n.track_id = t.id
        WHERE n.nft_token_id = ${id}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'NFT not found', nft_id: id });
      }

      return res.status(200).json(formatResult(rows[0]));
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

      const rows = await sql`
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
          r.type AS release_type,
          r.transfer_fee,
          r.mint_fee_paid,
          r.is_minted,
          t.title AS track_title,
          t.track_order
        FROM nfts n
        JOIN releases r ON n.release_id = r.id
        LEFT JOIN tracks t ON n.track_id = t.id
        WHERE n.nft_token_id = ANY(${nft_ids})
      `;

      const resultMap = {};
      for (const row of rows) {
        resultMap[row.nft_token_id] = formatResult(row);
      }

      const results = nft_ids.map(id => {
        if (resultMap[id]) return resultMap[id];
        return { nft_id: id, found: false };
      });

      return res.status(200).json({
        results,
        found: results.filter(r => r.found).length,
        not_found: results.filter(r => !r.found).length,
      });
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET for single lookup or POST for batch.' });
  } catch (error) {
    console.error('nft-lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function formatResult(row) {
  let mintType;
  if (row.is_minted && !row.mint_fee_paid) {
    mintType = 'og';
  } else if (row.mint_fee_paid) {
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
    trackNumber: row.track_order,
    editionNumber: row.edition_number,
    ownerAddress: row.owner_address,
    isAlbum: row.release_type === 'album',
    coverCid: row.cover_cid,
    transferFee: row.transfer_fee,
    mintType,
    coverUrl: row.cover_cid ? `https://gateway.lighthouse.storage/ipfs/${row.cover_cid}` : null,
  };
}
