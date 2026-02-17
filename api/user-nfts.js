/**
 * XRP Music - User NFTs API
 * Fetches NFTs owned by a user from XRPL and matches with our releases
 * 
 * UPDATED: Returns totalTracks, trackNumber, albumPrice for album grouping
 * UPDATED: XRPL connection with fallback nodes
 * UPDATED: Returns external (unmatched) NFTs with IPFS metadata parsed
 *          for artist name, title, description, cover art, and audio
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

const XRPL_NODES = [
  'wss://xrplcluster.com',
  'wss://s1.ripple.com',
  'wss://s2.ripple.com',
];

// IPFS gateways to try (in order)
const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

async function connectXRPL() {
  for (const node of XRPL_NODES) {
    try {
      const client = new xrpl.Client(node);
      await client.connect();
      return client;
    } catch (e) {
      console.warn(`Failed to connect to ${node}:`, e.message);
    }
  }
  throw new Error('All XRPL nodes failed');
}

/**
 * Fetch JSON metadata from IPFS with gateway fallback
 * Returns parsed JSON or null
 */
async function fetchIPFSMetadata(cid, timeoutMs = 5000) {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(`${gateway}${cid}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timer);
      
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      // Only parse JSON responses (skip if it's an image/audio file)
      if (!contentType.includes('json') && !contentType.includes('text')) {
        continue;
      }
      
      const text = await response.text();
      // Quick check — if it starts with { or [, it's likely JSON
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        continue;
      }
      
      return JSON.parse(trimmed);
    } catch (e) {
      // Try next gateway
      continue;
    }
  }
  return null;
}

/**
 * Extract artist name from NFT metadata
 * Tries multiple common fields and patterns
 */
function extractArtistName(metadata) {
  if (!metadata) return null;
  
  // Direct artist fields (various NFT metadata standards)
  if (metadata.artist) return metadata.artist;
  if (metadata.artist_name) return metadata.artist_name;
  if (metadata.artistName) return metadata.artistName;
  if (metadata.creator) return metadata.creator;
  if (metadata.author) return metadata.author;
  
  // Check properties/attributes objects
  const props = metadata.properties || metadata.attributes || {};
  if (props.artist) return props.artist;
  if (props.creator) return props.creator;
  
  // Check attributes array (OpenSea-style)
  if (Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      const trait = (attr.trait_type || attr.key || '').toLowerCase();
      if (trait === 'artist' || trait === 'creator' || trait === 'author') {
        return attr.value;
      }
    }
  }
  
  // Parse "by [Artist]" from collection name, description, or name
  const textFields = [
    metadata.collection_name,
    metadata.collection?.name,
    metadata.description,
    metadata.name,
  ].filter(Boolean);
  
  for (const text of textFields) {
    // Match "by Artist Name" at end of string or before punctuation
    const byMatch = text.match(/\bby\s+([A-Z][A-Za-z\s.']+?)(?:\s*[-–—|•]|\s*$)/);
    if (byMatch) return byMatch[1].trim();
    
    // Match "Artist Name - Title" pattern
    const dashMatch = text.match(/^([^-–—]+?)\s*[-–—]\s+/);
    if (dashMatch && dashMatch[1].length < 40) return dashMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract cover image URL from NFT metadata
 */
function extractCoverUrl(metadata) {
  if (!metadata) return null;
  
  const imageField = metadata.image || metadata.image_url || metadata.cover 
    || metadata.cover_url || metadata.thumbnail || metadata.artwork;
  
  if (!imageField) return null;
  
  // Convert ipfs:// to gateway URL
  if (imageField.startsWith('ipfs://')) {
    const cid = imageField.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${cid}`;
  }
  
  return imageField;
}

/**
 * Extract audio URL from NFT metadata
 */
function extractAudioUrl(metadata) {
  if (!metadata) return null;
  
  const audioField = metadata.animation_url || metadata.audio || metadata.audio_url 
    || metadata.music || metadata.song || metadata.media;
  
  if (!audioField) return null;
  
  if (audioField.startsWith('ipfs://')) {
    const cid = audioField.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${cid}`;
  }
  
  return audioField;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { address, includeExternal } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const client = await connectXRPL();
    
    try {
      const nftsResponse = await client.request({
        command: 'account_nfts',
        account: address,
        limit: 400,
      });
      
      const userNFTs = nftsResponse.result.account_nfts || [];
      
      if (userNFTs.length === 0) {
        return res.json({ nfts: [], external: [], totalOnChain: 0, matchedCount: 0 });
      }
      
      // Get all tracks with metadata CIDs — includes total_tracks count per release
      const tracks = await sql`
        SELECT 
          t.id as track_id,
          t.title as track_title,
          t.metadata_cid,
          t.audio_url,
          t.duration,
          t.track_number,
          t.video_cid,
          r.id as release_id,
          r.title as release_title,
          r.cover_url,
          r.artist_address,
          r.artist_name,
          r.song_price,
          r.album_price,
          r.type,
          r.total_editions,
          (SELECT COUNT(*) FROM tracks t2 WHERE t2.release_id = r.id) as total_tracks
        FROM tracks t
        JOIN releases r ON r.id = t.release_id
        WHERE t.metadata_cid IS NOT NULL
      `;
      
      // Also get single releases (where metadata is on release level)
      const releases = await sql`
        SELECT 
          id as release_id,
          title as release_title,
          metadata_cid,
          cover_url,
          artist_address,
          artist_name,
          song_price,
          album_price,
          type,
          total_editions
        FROM releases
        WHERE metadata_cid IS NOT NULL
      `;
      
      // Build a map of CID -> track/release info
      const cidMap = new Map();
      
      for (const track of tracks) {
        if (track.metadata_cid) {
          cidMap.set(track.metadata_cid, {
            type: 'track',
            trackId: track.track_id,
            trackTitle: track.track_title,
            trackNumber: track.track_number || null,
            releaseId: track.release_id,
            releaseTitle: track.release_title,
            coverUrl: track.cover_url,
            artistAddress: track.artist_address,
            artistName: track.artist_name,
            audioUrl: track.audio_url,
            duration: track.duration,
            videoCid: track.video_cid || null,
            price: track.song_price,
            albumPrice: track.album_price || null,
            releaseType: track.type,
            totalEditions: track.total_editions,
            totalTracks: parseInt(track.total_tracks) || 1,
          });
        }
      }
      
      for (const release of releases) {
        if (release.metadata_cid && !cidMap.has(release.metadata_cid)) {
          cidMap.set(release.metadata_cid, {
            type: 'release',
            releaseId: release.release_id,
            releaseTitle: release.release_title,
            coverUrl: release.cover_url,
            artistAddress: release.artist_address,
            artistName: release.artist_name,
            price: release.song_price,
            albumPrice: release.album_price || null,
            releaseType: release.type,
            totalEditions: release.total_editions,
            totalTracks: 1,
          });
        }
      }
      
      // Match user's NFTs with our database
      const matchedNFTs = [];
      const unmatchedNFTs = []; // External NFTs not in our DB
      
      const sales = await sql`
        SELECT nft_token_id, edition_number, release_id, created_at
        FROM sales 
        WHERE buyer_address = ${address}
      `;
      
      const editionMap = new Map();
      for (const sale of sales) {
        if (sale.nft_token_id) {
          editionMap.set(sale.nft_token_id, {
            editionNumber: sale.edition_number,
            purchaseDate: sale.created_at,
          });
        }
      }
      
      const nftRecords = await sql`
        SELECT nft_token_id, edition_number, created_at
        FROM nfts
        WHERE owner_address = ${address}
          AND edition_number IS NOT NULL
      `;
      
      for (const record of nftRecords) {
        if (record.nft_token_id && !editionMap.has(record.nft_token_id)) {
          editionMap.set(record.nft_token_id, {
            editionNumber: record.edition_number,
            purchaseDate: record.created_at,
          });
        }
      }
      
      for (const nft of userNFTs) {
        try {
          const uri = nft.URI ? xrpl.convertHexToString(nft.URI) : null;
          
          if (uri && uri.startsWith('ipfs://')) {
            const cid = uri.replace('ipfs://', '');
            
            if (cidMap.has(cid)) {
              // Matched — platform NFT
              const info = cidMap.get(cid);
              const editionInfo = editionMap.get(nft.NFTokenID) || {};
              
              matchedNFTs.push({
                nftTokenId: nft.NFTokenID,
                issuer: nft.Issuer,
                uri: uri,
                cid: cid,
                editionNumber: editionInfo.editionNumber || null,
                purchaseDate: editionInfo.purchaseDate || null,
                ...info,
              });
            } else {
              // Unmatched — external NFT
              unmatchedNFTs.push({
                nftTokenId: nft.NFTokenID,
                issuer: nft.Issuer,
                uri: uri,
                cid: cid,
                taxon: nft.NFTokenTaxon,
                transferFee: nft.TransferFee,
                flags: nft.Flags,
                serial: nft.nft_serial,
              });
            }
          } else if (uri) {
            // Non-IPFS URI (HTTP, etc) — still external
            unmatchedNFTs.push({
              nftTokenId: nft.NFTokenID,
              issuer: nft.Issuer,
              uri: uri,
              cid: null,
              taxon: nft.NFTokenTaxon,
              transferFee: nft.TransferFee,
              flags: nft.Flags,
              serial: nft.nft_serial,
            });
          }
        } catch (e) {
          console.error('Error decoding NFT:', e);
        }
      }
      
      // Fetch metadata for external NFTs (if requested)
      // Limit to first 20 to avoid timeout
      const externalNFTs = [];
      
      if (includeExternal !== 'false' && unmatchedNFTs.length > 0) {
        const toFetch = unmatchedNFTs.slice(0, 20);
        
        // Fetch metadata in parallel (with individual timeouts)
        const metadataPromises = toFetch.map(async (nft) => {
          try {
            let metadata = null;
            
            if (nft.cid) {
              metadata = await fetchIPFSMetadata(nft.cid, 4000);
            } else if (nft.uri && nft.uri.startsWith('http')) {
              // Direct HTTP metadata
              try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 4000);
                const resp = await fetch(nft.uri, { signal: controller.signal });
                clearTimeout(timer);
                if (resp.ok) metadata = await resp.json();
              } catch (e) { /* skip */ }
            }
            
            const artistName = extractArtistName(metadata);
            const coverUrl = extractCoverUrl(metadata);
            const audioUrl = extractAudioUrl(metadata);
            
            return {
              nftTokenId: nft.nftTokenId,
              issuer: nft.issuer,
              uri: nft.uri,
              cid: nft.cid,
              taxon: nft.taxon,
              transferFee: nft.transferFee,
              isExternal: true,
              // Parsed metadata
              title: metadata?.name || metadata?.title || null,
              artistName: artistName,
              description: metadata?.description || null,
              coverUrl: coverUrl,
              audioUrl: audioUrl,
              collectionName: metadata?.collection_name || metadata?.collection?.name || null,
              // Raw metadata for frontend to use if needed
              externalMeta: metadata ? {
                name: metadata.name,
                description: metadata.description,
                collection: metadata.collection_name || metadata.collection?.name,
                artist: artistName,
                image: metadata.image,
                animation_url: metadata.animation_url,
              } : null,
            };
          } catch (e) {
            console.error('Failed to fetch metadata for', nft.nftTokenId, e.message);
            return {
              nftTokenId: nft.nftTokenId,
              issuer: nft.issuer,
              uri: nft.uri,
              cid: nft.cid,
              isExternal: true,
              title: null,
              artistName: null,
              coverUrl: null,
              audioUrl: null,
            };
          }
        });
        
        const results = await Promise.allSettled(metadataPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            externalNFTs.push(result.value);
          }
        }
      }
      
      return res.json({ 
        nfts: matchedNFTs,
        external: externalNFTs,
        totalOnChain: userNFTs.length,
        matchedCount: matchedNFTs.length,
        externalCount: unmatchedNFTs.length,
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('User NFTs error:', error);
    return res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
}
