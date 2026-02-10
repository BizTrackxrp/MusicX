/**
 * XRP Music - External Music NFT Scanner
 * 
 * Scans a user's XRPL wallet for music NFTs from other platforms (XRP Cafe, etc).
 * Detects music by checking metadata JSON for audio fields.
 * Caches results in DB so subsequent loads are instant.
 * 
 * Audio URLs and image URLs are stored as raw IPFS URIs (ipfs://...)
 * and resolved to proxy URLs on the frontend via IpfsHelper.
 * 
 * Actions:
 * - 'scan': Full wallet scan - fetch NFTs from XRPL, check metadata, cache results
 * - 'list': Return cached music NFTs for a wallet (fast, no XRPL/IPFS calls)
 * - 'refresh': Force re-scan even if recently scanned
 * 
 * Audio detection checks these metadata fields:
 * - "audio" (XRP Cafe / Spiffy Music style)
 * - "animation_url" with audio extension (.mp3, .wav, .flac, .ogg, .m4a)
 * - "files" array with audio content_type entries
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

// IPFS gateways used ONLY for fetching metadata JSON during scan
// Audio/image playback goes through /api/ipfs/[cid] proxy on frontend
const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

// How often to allow re-scanning (in minutes)
const SCAN_COOLDOWN_MINUTES = 30;

// Max NFTs to process metadata for (avoid timeout on huge wallets)
const MAX_NFTS_TO_SCAN = 200;

// Timeout for individual IPFS metadata fetch (ms)
const IPFS_FETCH_TIMEOUT = 8000;

// Audio file extensions we recognize
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus', '.wma'];

// Audio MIME types we recognize
const AUDIO_MIME_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/flac', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/mp4',
  'audio/opus', 'audio/webm',
];

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  switch (action) {
    case 'scan':
      return handleScan(req, res, sql, walletAddress, false);
    case 'refresh':
      return handleScan(req, res, sql, walletAddress, true);
    case 'list':
      return handleList(req, res, sql, walletAddress);
    default:
      return handleList(req, res, sql, walletAddress);
  }
}

/**
 * Return cached external music NFTs for a wallet (fast path)
 */
async function handleList(req, res, sql, walletAddress) {
  try {
    const nfts = await sql`
      SELECT * FROM external_music_nfts
      WHERE wallet_address = ${walletAddress}
      ORDER BY name ASC
    `;

    const scanRecord = await sql`
      SELECT * FROM external_nft_scans
      WHERE wallet_address = ${walletAddress}
    `;

    return res.json({
      success: true,
      nfts,
      totalFound: nfts.length,
      lastScanned: scanRecord[0]?.last_scanned || null,
      needsScan: scanRecord.length === 0,
    });
  } catch (error) {
    console.error('List external NFTs error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Full wallet scan - fetch NFTs from XRPL, check metadata for audio, cache results
 */
async function handleScan(req, res, sql, walletAddress, forceRefresh) {
  try {
    // Check cooldown (don't re-scan too frequently)
    if (!forceRefresh) {
      const scanRecord = await sql`
        SELECT * FROM external_nft_scans
        WHERE wallet_address = ${walletAddress}
      `;

      if (scanRecord.length > 0) {
        const lastScanned = new Date(scanRecord[0].last_scanned);
        const minutesAgo = (Date.now() - lastScanned.getTime()) / 1000 / 60;

        if (minutesAgo < SCAN_COOLDOWN_MINUTES) {
          const nfts = await sql`
            SELECT * FROM external_music_nfts
            WHERE wallet_address = ${walletAddress}
            ORDER BY name ASC
          `;

          return res.json({
            success: true,
            nfts,
            totalFound: nfts.length,
            lastScanned: scanRecord[0].last_scanned,
            fromCache: true,
            nextScanAvailable: new Date(lastScanned.getTime() + SCAN_COOLDOWN_MINUTES * 60000),
          });
        }
      }
    }

    // Get our platform's issuer address to filter out XRP Music NFTs
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;

    // Get all metadata CIDs from our tracks/releases so we skip platform NFTs
    const platformCids = await sql`
      SELECT metadata_cid FROM tracks WHERE metadata_cid IS NOT NULL
      UNION
      SELECT metadata_cid FROM releases WHERE metadata_cid IS NOT NULL
    `;
    const platformCidSet = new Set(platformCids.map(r => r.metadata_cid));

    // Step 1: Fetch all NFTs from wallet via XRPL
    console.log(`🔍 Scanning wallet ${walletAddress} for external music NFTs...`);

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    let allNfts = [];
    let marker = undefined;

    do {
      const request = {
        command: 'account_nfts',
        account: walletAddress,
        limit: 400,
      };
      if (marker) request.marker = marker;

      const response = await client.request(request);
      allNfts = allNfts.concat(response.result.account_nfts || []);
      marker = response.result.marker;
    } while (marker);

    await client.disconnect();

    console.log(`📦 Found ${allNfts.length} total NFTs in wallet`);

    // Step 2: Filter out XRP Music platform NFTs
    const externalNfts = allNfts.filter(nft => {
      if (nft.Issuer === platformAddress) return false;
      if (!nft.URI) return false;

      // Check if CID matches any of our platform tracks
      try {
        const uri = Buffer.from(nft.URI, 'hex').toString('utf8');
        if (uri.startsWith('ipfs://')) {
          const cid = uri.replace('ipfs://', '');
          if (platformCidSet.has(cid)) return false;
        }
      } catch (e) {
        // Can't decode — include it for checking
      }

      return true;
    });

    console.log(`🔎 ${externalNfts.length} external NFTs to check for audio`);

    // Step 3: Check metadata for audio fields (batched)
    const nftsToCheck = externalNfts.slice(0, MAX_NFTS_TO_SCAN);
    const musicNfts = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < nftsToCheck.length; i += BATCH_SIZE) {
      const batch = nftsToCheck.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(nft => checkNftForAudio(nft))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          musicNfts.push(result.value);
        }
      }
    }

    console.log(`🎵 Found ${musicNfts.length} music NFTs!`);

    // Step 4: Upsert results into database
    const currentTokenIds = musicNfts.map(n => n.nftTokenId);

    if (currentTokenIds.length > 0) {
      await sql`
        DELETE FROM external_music_nfts
        WHERE wallet_address = ${walletAddress}
          AND nft_token_id != ALL(${currentTokenIds})
      `;
    } else {
      await sql`
        DELETE FROM external_music_nfts
        WHERE wallet_address = ${walletAddress}
      `;
    }

    for (const nft of musicNfts) {
      const id = `ext_${walletAddress.slice(0, 8)}_${nft.nftTokenId.slice(-8)}`;

      await sql`
        INSERT INTO external_music_nfts (
          id, wallet_address, nft_token_id, issuer, name, artist_name,
          collection_name, description, image_url, audio_url,
          metadata_uri, metadata_json, last_scanned
        ) VALUES (
          ${id}, ${walletAddress}, ${nft.nftTokenId}, ${nft.issuer},
          ${nft.name}, ${nft.artistName}, ${nft.collectionName},
          ${nft.description}, ${nft.imageUrl}, ${nft.audioUrl},
          ${nft.metadataUri}, ${JSON.stringify(nft.metadata)}, NOW()
        )
        ON CONFLICT (wallet_address, nft_token_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          artist_name = EXCLUDED.artist_name,
          collection_name = EXCLUDED.collection_name,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          audio_url = EXCLUDED.audio_url,
          metadata_json = EXCLUDED.metadata_json,
          last_scanned = NOW()
      `;
    }

    await sql`
      INSERT INTO external_nft_scans (wallet_address, last_scanned, nfts_found, music_nfts_found)
      VALUES (${walletAddress}, NOW(), ${allNfts.length}, ${musicNfts.length})
      ON CONFLICT (wallet_address)
      DO UPDATE SET
        last_scanned = NOW(),
        nfts_found = EXCLUDED.nfts_found,
        music_nfts_found = EXCLUDED.music_nfts_found
    `;

    const savedNfts = await sql`
      SELECT * FROM external_music_nfts
      WHERE wallet_address = ${walletAddress}
      ORDER BY name ASC
    `;

    return res.json({
      success: true,
      nfts: savedNfts,
      totalFound: savedNfts.length,
      totalWalletNfts: allNfts.length,
      externalNftsChecked: nftsToCheck.length,
      lastScanned: new Date().toISOString(),
      fromCache: false,
    });

  } catch (error) {
    console.error('Scan external NFTs error:', error);

    try {
      const cached = await sql`
        SELECT * FROM external_music_nfts
        WHERE wallet_address = ${walletAddress}
        ORDER BY name ASC
      `;

      return res.json({
        success: true,
        nfts: cached,
        totalFound: cached.length,
        scanError: error.message,
        fromCache: true,
      });
    } catch (e) {
      return res.status(500).json({ error: error.message });
    }
  }
}

/**
 * Check a single NFT's metadata for audio content.
 * Returns a normalized music NFT object if audio found, null otherwise.
 */
async function checkNftForAudio(nft) {
  try {
    const uri = decodeHexUri(nft.URI);
    if (!uri) return null;

    const metadata = await fetchMetadataFromIpfs(uri);
    if (!metadata) return null;

    const audioUrl = extractAudioUrl(metadata);
    if (!audioUrl) return null;

    // Store raw IPFS URIs — frontend resolves via IpfsHelper
    const imageUrl = metadata.image || metadata.image_url || metadata.thumbnail || null;
    const name = metadata.name || 'Unknown Track';
    const description = metadata.description || '';
    const artistName = extractArtistName(metadata);
    const collectionName = metadata.collection?.name || null;

    return {
      nftTokenId: nft.NFTokenID,
      issuer: nft.Issuer,
      name,
      artistName,
      collectionName,
      description,
      imageUrl,   // Raw IPFS URI e.g. ipfs://bafy.../31.png
      audioUrl,   // Raw IPFS URI e.g. ipfs://bafy.../1.mp3
      metadataUri: uri,
      metadata,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Decode hex-encoded URI from XRPL NFT
 */
function decodeHexUri(hexUri) {
  if (!hexUri) return null;

  try {
    const bytes = Buffer.from(hexUri, 'hex');
    const decoded = bytes.toString('utf8');

    if (decoded.startsWith('ipfs://') || decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }

    if (decoded.startsWith('Qm') || decoded.startsWith('bafy')) {
      return `ipfs://${decoded}`;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch metadata JSON from IPFS, trying multiple gateways
 */
async function fetchMetadataFromIpfs(uri) {
  let ipfsPath = null;

  if (uri.startsWith('ipfs://')) {
    ipfsPath = uri.replace('ipfs://', '');
  } else if (uri.includes('/ipfs/')) {
    ipfsPath = uri.split('/ipfs/')[1];
  } else if (uri.startsWith('http')) {
    return await fetchJson(uri);
  }

  if (!ipfsPath) return null;

  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}${ipfsPath}`;
    const result = await fetchJson(url);
    if (result) return result;
  }

  return null;
}

/**
 * Fetch JSON with timeout, returns parsed JSON or null
 */
async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IPFS_FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';

    // Make sure we got JSON/text back, not binary audio/image
    if (!contentType.includes('json') && !contentType.includes('text')) {
      return null;
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Extract audio URL from metadata JSON.
 * Returns raw URI as stored in metadata (usually ipfs://...)
 */
function extractAudioUrl(metadata) {
  if (!metadata) return null;

  // 1. Direct "audio" field (XRP Cafe / Spiffy Music style)
  if (metadata.audio) return metadata.audio;

  // 2. "animation_url" — check if it's audio
  if (metadata.animation_url) {
    const url = metadata.animation_url.toLowerCase();

    if (AUDIO_EXTENSIONS.some(ext => url.includes(ext))) {
      return metadata.animation_url;
    }

    const hintType = (metadata.animation_type || metadata.content_type || '').toLowerCase();
    if (AUDIO_MIME_TYPES.some(t => hintType.includes(t))) {
      return metadata.animation_url;
    }
  }

  // 3. "content" field
  if (metadata.content) {
    const url = (typeof metadata.content === 'string') ? metadata.content : metadata.content?.url;
    if (url) {
      const lower = url.toLowerCase();
      if (AUDIO_EXTENSIONS.some(ext => lower.includes(ext))) return url;
    }
  }

  // 4. "files" array
  if (Array.isArray(metadata.files)) {
    for (const file of metadata.files) {
      const fileType = (file.type || file.content_type || file.mediaType || '').toLowerCase();
      const fileUrl = file.uri || file.url || file.src;
      if (!fileUrl) continue;

      if (AUDIO_MIME_TYPES.some(t => fileType.includes(t))) return fileUrl;

      const lower = fileUrl.toLowerCase();
      if (AUDIO_EXTENSIONS.some(ext => lower.includes(ext))) return fileUrl;
    }
  }

  // 5. "properties.files" (alternate structure)
  if (metadata.properties?.files && Array.isArray(metadata.properties.files)) {
    for (const file of metadata.properties.files) {
      const fileType = (file.type || file.content_type || '').toLowerCase();
      const fileUrl = file.uri || file.url || file.src;
      if (!fileUrl) continue;

      if (AUDIO_MIME_TYPES.some(t => fileType.includes(t))) return fileUrl;

      const lower = fileUrl.toLowerCase();
      if (AUDIO_EXTENSIONS.some(ext => lower.includes(ext))) return fileUrl;
    }
  }

  return null;
}

/**
 * Try to extract artist name from metadata
 */
function extractArtistName(metadata) {
  if (!metadata) return null;

  if (metadata.artist) return metadata.artist;
  if (metadata.artist_name) return metadata.artist_name;
  if (metadata.creator) return metadata.creator;

  if (metadata.collection?.name) return metadata.collection.name;

  if (Array.isArray(metadata.attributes)) {
    const artistAttr = metadata.attributes.find(a =>
      ['artist', 'creator', 'musician', 'band', 'author'].includes(
        (a.trait_type || '').toLowerCase()
      )
    );
    if (artistAttr) return artistAttr.value;
  }

  return null;
}
