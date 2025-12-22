/**
 * XRP Music - List for Sale API
 * Creates NFTokenCreateOffer payload for Xaman signing
 * 
 * This creates a sell offer where the platform can broker the sale
 */

import { neon } from '@neondatabase/serverless';

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
  
  try {
    const { releaseId, nftTokenId, offerIndex } = req.body;
    
    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }
    
    // Update release with sell offer info
    if (offerIndex) {
      // Store the sell offer index after user signs
      await sql`
        UPDATE releases 
        SET 
          sell_offer_index = ${offerIndex},
          listed_at = NOW()
        WHERE id = ${releaseId}
      `;
      
      return res.json({ success: true, message: 'Listed for sale!' });
    }
    
    // If nftTokenId provided, update the release
    if (nftTokenId) {
      await sql`
        UPDATE releases 
        SET nft_token_id = ${nftTokenId}
        WHERE id = ${releaseId}
      `;
    }
    
    // Get release details for creating offer
    const [release] = await sql`
      SELECT * FROM releases WHERE id = ${releaseId}
    `;
    
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    if (!platformAddress) {
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Return payload info for frontend to create Xaman request
    return res.json({
      success: true,
      payload: {
        nftTokenId: release.nft_token_id,
        price: release.song_price,
        platformAddress: platformAddress,
        releaseId: releaseId,
      }
    });
    
  } catch (error) {
    console.error('List for sale error:', error);
    return res.status(500).json({ error: 'Failed to list for sale' });
  }
}
