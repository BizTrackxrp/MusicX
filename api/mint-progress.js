/**
 * XRP Music - Mint Progress API
 * Returns real-time progress of NFT minting jobs
 * 
 * Frontend polls this every 2-3 seconds during minting
 */

import { neon } from '@neondatabase/serverless';

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
  
  const { jobId } = req.query;
  
  if (!jobId) {
    return res.status(400).json({ error: 'jobId required' });
  }
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const jobs = await sql`
      SELECT id, release_id, status, total_nfts, minted_count, started_at, updated_at, error
      FROM mint_jobs 
      WHERE id = ${jobId}
    `;
    
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = jobs[0];
    
    // Calculate elapsed time
    const startedAt = new Date(job.started_at);
    const elapsed = (Date.now() - startedAt.getTime()) / 1000;
    
    return res.json({
      success: true,
      jobId: job.id,
      releaseId: job.release_id,
      status: job.status,
      minted: job.minted_count || 0,
      total: job.total_nfts || 0,
      elapsed: Math.round(elapsed),
      startedAt: job.started_at,
      updatedAt: job.updated_at,
      error: job.error || null,
    });
    
  } catch (error) {
    console.error('Progress check error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to check progress' 
    });
  }
}
