/**
 * XRP Music - Secondary Market Listings API
 * Handles user-created sell offers for their NFTs
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
      // Get active listings
      const { seller, nftTokenId } = req.query;
      
      let listings;
      if (seller) {
        listings = await sql`
          SELECT l.*, 
            t.title as track_title, 
            t.audio_url,
            r.title as release_title, 
            r.cover_url, 
            r.artist_name,
            r.artist_address
          FROM secondary_listings l
          LEFT JOIN tracks t ON t.id = l.track_id
          LEFT JOIN releases r ON r.id = l.release_id
          WHERE l.seller_address = ${seller} AND l.status = 'active'
          ORDER BY l.created_at DESC
        `;
      } else if (nftTokenId) {
        listings = await sql`
          SELECT l.*, 
            t.title as track_title, 
            t.audio_url,
            r.title as release_title, 
            r.cover_url, 
            r.artist_name,
            r.artist_address
          FROM secondary_listings l
          LEFT JOIN tracks t ON t.id = l.track_id
          LEFT JOIN releases r ON r.id = l.release_id
          WHERE l.nft_token_id = ${nftTokenId} AND l.status = 'active'
          LIMIT 1
        `;
      } else {
        // Get all active listings
        listings = await sql`
          SELECT l.*, 
            t.title as track_title, 
            t.audio_url,
            r.title as release_title, 
            r.cover_url, 
            r.artist_name,
            r.artist_address
          FROM secondary_listings l
          LEFT JOIN tracks t ON t.id = l.track_id
          LEFT JOIN releases r ON r.id = l.release_id
          WHERE l.status = 'active'
          ORDER BY l.created_at DESC
          LIMIT 50
        `;
      }
      
      return res.json({ listings });
    }
    
    if (req.method === 'POST') {
      const {
        nftTokenId,
        sellerAddress,
        price,
        offerIndex,
        releaseId,
        trackId,
      } = req.body;
      
      if (!nftTokenId || !sellerAddress || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const listingId = `lst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if listing already exists for this NFT
      const existing = await sql`
        SELECT id FROM secondary_listings 
        WHERE nft_token_id = ${nftTokenId} AND status = 'active'
      `;
      
      if (existing.length > 0) {
        // Update existing listing
        await sql`
          UPDATE secondary_listings 
          SET price = ${price}, 
              offer_index = ${offerIndex || null},
              updated_at = NOW()
          WHERE nft_token_id = ${nftTokenId} AND status = 'active'
        `;
        
        return res.json({ success: true, listingId: existing[0].id, updated: true });
      }
      
      // Create new listing
      await sql`
        INSERT INTO secondary_listings (
          id,
          nft_token_id,
          seller_address,
          price,
          offer_index,
          release_id,
          track_id,
          status,
          created_at
        ) VALUES (
          ${listingId},
          ${nftTokenId},
          ${sellerAddress},
          ${price},
          ${offerIndex || null},
          ${releaseId || null},
          ${trackId || null},
          'active',
          NOW()
        )
      `;
      
      return res.json({ success: true, listingId });
    }
    
    if (req.method === 'PUT') {
      // Record a completed secondary sale in the sales table
      const { action } = req.body;
      
      if (action === 'record-sale') {
        const {
          releaseId,
          trackId,
          buyerAddress,
          sellerAddress,
          nftTokenId,
          editionNumber,
          price,
          txHash,
        } = req.body;
        
        if (!buyerAddress || !sellerAddress || !price) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const saleId = `sale_secondary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const platformFee = (parseFloat(price) * 0.02).toFixed(4);
        
        await sql`
          INSERT INTO sales (
            id,
            release_id,
            track_id,
            buyer_address,
            seller_address,
            nft_token_id,
            edition_number,
            price,
            platform_fee,
            tx_hash,
            sale_type,
            created_at
          ) VALUES (
            ${saleId},
            ${releaseId || null},
            ${trackId || null},
            ${buyerAddress},
            ${sellerAddress},
            ${nftTokenId || null},
            ${editionNumber || null},
            ${price},
            ${platformFee},
            ${txHash || null},
            'secondary',
            NOW()
          )
        `;
        
        console.log(`Secondary sale recorded: ${saleId} - ${sellerAddress} -> ${buyerAddress} for ${price} XRP`);
        
        return res.json({ success: true, saleId });
      }
      
      return res.status(400).json({ error: 'Unknown action' });
    }
    
    if (req.method === 'DELETE') {
      const { listingId, nftTokenId } = req.query;
      
      if (listingId) {
        await sql`
          UPDATE secondary_listings 
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = ${listingId}
        `;
      } else if (nftTokenId) {
        await sql`
          UPDATE secondary_listings 
          SET status = 'cancelled', updated_at = NOW()
          WHERE nft_token_id = ${nftTokenId} AND status = 'active'
        `;
      }
      
      return res.json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Listings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
