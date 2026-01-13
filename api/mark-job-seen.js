/**
 * XRP Music - Mark Mint Job as Seen
 * 
 * Marks a completed mint job notification as "seen" so it
 * no longer shows the red dot on the notification bell.
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
  
  const { jobId, address } = req.body;
  
  if (!jobId || !address) {
    return res.status(400).json({ error: 'Missing jobId or address' });
  }
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Only mark as seen if the job belongs to this user
    const result = await sql`
      UPDATE mint_jobs 
      SET seen = true
      WHERE id = ${jobId}
        AND (job_data->>'artistAddress') = ${address}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Job not found or not yours' });
    }
    
    return res.json({
      success: true,
      jobId: jobId,
    });
    
  } catch (error) {
    console.error('Mark job seen error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark job as seen',
    });
  }
}
