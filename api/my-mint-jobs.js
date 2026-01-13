/**
 * XRP Music - Get My Mint Jobs
 * 
 * Returns the user's recent mint jobs for the notification bell.
 * Shows pending, minting, and recently completed jobs.
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
  
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Missing address parameter' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Get user's mint jobs from the last 7 days
    // Join with releases to get album info for the notification
    const jobs = await sql`
      SELECT 
        mj.id as job_id,
        mj.release_id,
        mj.status,
        mj.total_nfts,
        mj.minted_count,
        mj.error,
        mj.created_at,
        mj.updated_at,
        mj.completed_at,
        mj.seen,
        r.title as release_title,
        r.cover_url,
        r.artist_name
      FROM mint_jobs mj
      JOIN releases r ON r.id = mj.release_id
      WHERE (mj.job_data->>'artistAddress') = ${address}
        AND mj.created_at > NOW() - INTERVAL '7 days'
      ORDER BY mj.created_at DESC
      LIMIT 20
    `;
    
    // Categorize jobs
    const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'minting');
    const completedUnseen = jobs.filter(j => j.status === 'complete' && !j.seen);
    const recentCompleted = jobs.filter(j => j.status === 'complete' && j.seen);
    const failedJobs = jobs.filter(j => j.status === 'failed' && !j.seen);
    
    return res.json({
      success: true,
      hasUnread: completedUnseen.length > 0 || failedJobs.length > 0,
      hasActive: activeJobs.length > 0,
      jobs: {
        active: activeJobs,
        completedUnseen: completedUnseen,
        failed: failedJobs,
        recentCompleted: recentCompleted.slice(0, 5), // Last 5 seen completions
      },
      // Summary for quick badge display
      summary: {
        activeCount: activeJobs.length,
        unreadCount: completedUnseen.length + failedJobs.length,
      }
    });
    
  } catch (error) {
    console.error('Get mint jobs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get mint jobs',
    });
  }
}
