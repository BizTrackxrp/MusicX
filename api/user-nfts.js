/**
 * XRP Music - User NFTs API
 * Fetches NFTs owned by a user from XRPL and matches with our releases
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

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
  
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      // Get user's NFTs from XRPL
      const nftsResponse = await client.request({
        command: 'account_nfts',
        account: address,
        limit: 400,
      });
      
      const userNFTs = nftsResponse.result.account_nfts || [];
      
      if (userNFTs.length === 0) {
        return res.json({ nfts: [] });
      }
      
      // Get all tracks with metadata CIDs from our database
      const tracks = await sql`
        SELECT 
          t.id as track_id,
          t.title as track_title,
          t.metadata_cid,
          t.audio_url,
          t.duration,
          r.id as release_id,
          r.title as release_title,
          r.cover_url,
          r.artist_address,
          r.artist_name,
          r.song_price,
          r.type,
          r.total_editions
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
            releaseId: track.release_id,
            releaseTitle: track.release_title,
            coverUrl: track.cover_url,
            artistAddress: track.artist_address,
            artistName: track.artist_name,
            audioUrl: track.audio_url,
            duration: track.duration,
            price: track.song_price,
            releaseType: track.type,
            totalEditions: track.total_editions,
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
            releaseType: release.type,
            totalEditions: release.total_editions,
          });
        }
      }
      
      // Match user's NFTs with our database
      const matchedNFTs = [];
      
      // Get sales info to find edition numbers
      const sales = await sql`
        SELECT nft_token_id, edition_number, release_id, created_at
        FROM sales 
        WHERE buyer_address = ${address}
      `;
      
      const salesMap = new Map();
      for (const sale of sales) {
        if (sale.nft_token_id) {
          salesMap.set(sale.nft_token_id, {
            editionNumber: sale.edition_number,
            purchaseDate: sale.created_at,
          });
        }
      }
      
      for (const nft of userNFTs) {
        try {
          // Decode URI from hex
          const uri = nft.URI ? xrpl.convertHexToString(nft.URI) : null;
          
          if (uri && uri.startsWith('ipfs://')) {
            const cid = uri.replace('ipfs://', '');
            
            if (cidMap.has(cid)) {
              const info = cidMap.get(cid);
              const saleInfo = salesMap.get(nft.NFTokenID) || {};
              
              matchedNFTs.push({
                nftTokenId: nft.NFTokenID,
                issuer: nft.Issuer,
                uri: uri,
                cid: cid,
                editionNumber: saleInfo.editionNumber || null,
                purchaseDate: saleInfo.purchaseDate || null,
                ...info,
              });
            }
          }
        } catch (e) {
          // Skip NFTs we can't decode
          console.error('Error decoding NFT:', e);
        }
      }
      
      return res.json({ 
        nfts: matchedNFTs,
        totalOnChain: userNFTs.length,
        matchedCount: matchedNFTs.length,
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('User NFTs error:', error);
    return res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
}
