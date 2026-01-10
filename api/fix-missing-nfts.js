/**
 * EMERGENCY FIX: Populate Missing NFTs
 * 
 * For tracks that have sales but no NFTs in the database,
 * this will fetch the NFTs from on-chain and add them.
 * 
 * POST /api/fix-missing-nfts
 * Body: { "secret": "fix-editions-2024" }
 */

import { neon } from '@neondatabase/serverless';
import * as xrpl from 'xrpl';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { secret } = req.body;
  if (secret !== (process.env.FIX_EDITIONS_SECRET || 'fix-editions-2024')) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  
  const results = {
    tracksChecked: 0,
    tracksMissingNfts: [],
    nftsAdded: 0,
    errors: [],
  };
  
  try {
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    
    if (!platformAddress) {
      return res.status(500).json({ error: 'Platform wallet not configured' });
    }
    
    // Find tracks with 0 NFTs in database
    const tracksWithNoNfts = await sql`
      SELECT 
        t.id as track_id,
        t.title as track_title,
        t.metadata_cid,
        r.id as release_id,
        r.title as release_title,
        r.artist_address,
        r.total_editions,
        (SELECT COUNT(*) FROM nfts WHERE track_id = t.id) as nft_count,
        (SELECT COUNT(*) FROM sales WHERE track_id = t.id) as sales_count
      FROM tracks t
      JOIN releases r ON t.release_id = r.id
      WHERE (SELECT COUNT(*) FROM nfts WHERE track_id = t.id) = 0
      ORDER BY t.title
    `;
    
    results.tracksChecked = tracksWithNoNfts.length;
    
    if (tracksWithNoNfts.length === 0) {
      return res.json({
        success: true,
        message: 'All tracks have NFTs in database',
        results,
      });
    }
    
    // Connect to XRPL to fetch NFTs
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      // Get all NFTs owned by platform
      let platformNfts = [];
      let marker = undefined;
      
      do {
        const response = await client.request({
          command: 'account_nfts',
          account: platformAddress,
          limit: 400,
          marker: marker,
        });
        
        platformNfts = platformNfts.concat(response.result.account_nfts || []);
        marker = response.result.marker;
      } while (marker);
      
      console.log(`Found ${platformNfts.length} NFTs owned by platform`);
      
      // For each track missing NFTs, try to find matching NFTs on-chain
      for (const track of tracksWithNoNfts) {
        results.tracksMissingNfts.push({
          title: track.track_title,
          release: track.release_title,
          sales: track.sales_count,
        });
        
        // Try to match NFTs by URI containing metadata_cid
        const matchingNfts = platformNfts.filter(nft => {
          if (!nft.URI) return false;
          try {
            const uri = Buffer.from(nft.URI, 'hex').toString('utf8');
            return track.metadata_cid && uri.includes(track.metadata_cid);
          } catch {
            return false;
          }
        });
        
        console.log(`Track "${track.track_title}": found ${matchingNfts.length} matching NFTs`);
        
        // Add each matching NFT to database
        for (let i = 0; i < matchingNfts.length; i++) {
          const nft = matchingNfts[i];
          const editionNumber = i + 1;
          
          try {
            // Check if this NFT is already in the database (maybe under different track)
            const existing = await sql`
              SELECT id FROM nfts WHERE nft_token_id = ${nft.NFTokenID}
            `;
            
            if (existing.length > 0) {
              console.log(`NFT ${nft.NFTokenID} already exists, skipping`);
              continue;
            }
            
            // Check if this NFT was sold (appears in sales)
            const sale = await sql`
              SELECT buyer_address FROM sales 
              WHERE nft_token_id = ${nft.NFTokenID}
              LIMIT 1
            `;
            
            const status = sale.length > 0 ? 'sold' : 'available';
            const ownerAddress = sale.length > 0 ? sale[0].buyer_address : platformAddress;
            
            await sql`
              INSERT INTO nfts (
                id, nft_token_id, track_id, edition_number, status, owner_address
              ) VALUES (
                ${'nft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)},
                ${nft.NFTokenID},
                ${track.track_id},
                ${editionNumber},
                ${status},
                ${ownerAddress}
              )
            `;
            
            results.nftsAdded++;
            console.log(`Added NFT ${nft.NFTokenID} for track "${track.track_title}" edition #${editionNumber}`);
            
          } catch (e) {
            results.errors.push(`Failed to add NFT for ${track.track_title}: ${e.message}`);
          }
        }
        
        // If no matching NFTs found by metadata_cid, log it
        if (matchingNfts.length === 0) {
          results.errors.push(`No matching NFTs found on-chain for "${track.track_title}" (metadata_cid: ${track.metadata_cid || 'none'})`);
        }
      }
      
      await client.disconnect();
      
    } catch (xrplError) {
      await client.disconnect();
      throw xrplError;
    }
    
    // Now re-run the edition fix to update counts
    console.log('Updating sold counts...');
    
    await sql`
      UPDATE tracks t
      SET sold_count = (
        SELECT COUNT(*) FROM nfts n 
        WHERE n.track_id = t.id AND n.status = 'sold'
      )
    `;
    
    await sql`
      UPDATE releases r
      SET sold_editions = (
        SELECT COALESCE(MIN(COALESCE(t.sold_count, 0)), 0)
        FROM tracks t WHERE t.release_id = r.id
      )
    `;
    
    return res.json({
      success: true,
      message: `Added ${results.nftsAdded} NFTs to database`,
      results,
    });
    
  } catch (error) {
    console.error('Fix missing NFTs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      results,
    });
  }
}
