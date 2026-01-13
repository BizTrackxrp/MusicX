/**
 * XRP Music - Queue Mint API
 * 
 * This endpoint QUEUES a mint job and returns immediately.
 * The Railway worker picks up the job and processes it.
 * No more Vercel timeouts!
 * 
 * Flow:
 * 1. Frontend calls this after user pays & authorizes
 * 2. We create a mint_jobs record with status='pending'
 * 3. Return jobId immediately
 * 4. Frontend polls /api/mint-progress for updates
 * 5. Railway worker processes the job in background
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const {
      artistAddress,
      releaseId,
      quantity,
      transferFee = 500,
    } = req.body;
    
    if (!artistAddress || !releaseId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields: artistAddress, releaseId, quantity' });
    }
    
    // Get release to calculate total NFTs
    const releases = await sql`
      SELECT * FROM releases WHERE id = ${releaseId}
    `;
    
    if (releases.length === 0) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    const release = releases[0];
    
    // Get track count
    const trackCountResult = await sql`
      SELECT COUNT(*) as count FROM tracks WHERE release_id = ${releaseId}
    `;
    const trackCount = parseInt(trackCountResult[0]?.count || 1);
    
    const totalNFTs = trackCount * quantity;
    
    // Create job ID
    const jobId = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create the job in pending state
    await sql`
      INSERT INTO mint_jobs (
        id, 
        release_id, 
        status, 
        total_nfts, 
        minted_count, 
        job_data,
        created_at,
        updated_at
      ) VALUES (
        ${jobId},
        ${releaseId},
        'pending',
        ${totalNFTs},
        0,
        ${JSON.stringify({ artistAddress, quantity, transferFee })},
        NOW(),
        NOW()
      )
    `;
    
    console.log(`✅ Queued mint job ${jobId}: ${totalNFTs} NFTs for release ${releaseId}`);
    
    // Return immediately with jobId
    return res.json({
      success: true,
      jobId: jobId,
      totalNFTs: totalNFTs,
      trackCount: trackCount,
      quantity: quantity,
      message: 'Mint job queued successfully. Poll /api/mint-progress for updates.',
    });
    
  } catch (error) {
    console.error('Queue mint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue mint job',
    });
  }
}
