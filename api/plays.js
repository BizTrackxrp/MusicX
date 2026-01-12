/**
 * XRP Music - Plays/Streams API
 * Records play events and returns aggregated play counts
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'POST') {
      return await recordPlay(req, res, sql);
    } else if (req.method === 'GET') {
      return await getPlays(req, res, sql);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Plays API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Record a play event
 * Called when a user listens to a track for at least 30 seconds
 */
async function recordPlay(req, res, sql) {
  const { trackId, releaseId, userAddress, sessionId, duration } = req.body;
  
  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }
  
  // Dedupe: Check if this session already recorded a play for this track in last 5 minutes
  if (sessionId) {
    const recent = await sql`
      SELECT id FROM plays 
      WHERE track_id = ${trackId} 
        AND session_id = ${sessionId}
        AND played_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `;
    
    if (recent.length > 0) {
      // Already recorded this play, skip but return success
      return res.json({ success: true, deduplicated: true });
    }
  }
  
  // Record the play
  const [play] = await sql`
    INSERT INTO plays (
      track_id,
      release_id,
      user_address,
      session_id,
      duration_seconds,
      played_at
    ) VALUES (
      ${trackId},
      ${releaseId || null},
      ${userAddress || null},
      ${sessionId || null},
      ${duration || null},
      NOW()
    )
    RETURNING id
  `;
  
  return res.json({ success: true, playId: play.id });
}

/**
 * Get play counts - either top tracks or counts for specific tracks
 */
async function getPlays(req, res, sql) {
  const { period, limit, trackIds, action } = req.query;
  
  // Get top tracks by period
  if (action === 'top') {
    return await getTopTracks(req, res, sql, period, parseInt(limit) || 10);
  }
  
  // Get play counts for specific track IDs
  if (trackIds) {
    return await getTrackPlayCounts(req, res, sql, trackIds.split(','), period);
  }
  
  // Default: return top tracks
  return await getTopTracks(req, res, sql, period, parseInt(limit) || 10);
}

/**
 * Get top played tracks for a given period
 */
async function getTopTracks(req, res, sql, period = '7d', limit = 10) {
  const interval = getIntervalFromPeriod(period);
  
  const tracks = await sql`
    SELECT 
      p.track_id,
      p.release_id,
      COUNT(*) as play_count,
      t.title as track_title,
      t.audio_cid,
      t.duration,
      r.title as release_title,
      r.artist_name,
      r.artist_address,
      r.cover_url,
      r.song_price,
      r.total_editions,
      r.type as release_type,
      COALESCE((SELECT COUNT(*) FROM sales s WHERE s.track_id = t.id), 0) as sold_count
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    JOIN releases r ON t.release_id = r.id
    WHERE p.played_at > NOW() - ${interval}::interval
    GROUP BY p.track_id, p.release_id, t.id, t.title, t.audio_cid, t.duration,
             r.id, r.title, r.artist_name, r.artist_address, r.cover_url, 
             r.song_price, r.total_editions, r.type
    ORDER BY play_count DESC
    LIMIT ${limit}
  `;
  
  // Format response
  const formatted = tracks.map(row => ({
    trackId: row.track_id,
    releaseId: row.release_id,
    plays: parseInt(row.play_count),
    track: {
      id: row.track_id,
      title: row.track_title,
      audioCid: row.audio_cid,
      duration: row.duration,
    },
    release: {
      id: row.release_id,
      title: row.release_title,
      artistName: row.artist_name,
      artistAddress: row.artist_address,
      coverUrl: row.cover_url,
      songPrice: parseFloat(row.song_price) || 0,
      totalEditions: row.total_editions,
      soldEditions: parseInt(row.sold_count) || 0,
      type: row.release_type,
    }
  }));
  
  return res.json({ 
    success: true, 
    period,
    tracks: formatted 
  });
}

/**
 * Get play counts for specific tracks
 */
async function getTrackPlayCounts(req, res, sql, trackIds, period = '7d') {
  const interval = getIntervalFromPeriod(period);
  
  const counts = await sql`
    SELECT 
      track_id,
      COUNT(*) as play_count
    FROM plays
    WHERE track_id = ANY(${trackIds})
      AND played_at > NOW() - ${interval}::interval
    GROUP BY track_id
  `;
  
  // Convert to map for easy lookup
  const countMap = {};
  counts.forEach(row => {
    countMap[row.track_id] = parseInt(row.play_count);
  });
  
  // Include zeros for tracks with no plays
  trackIds.forEach(id => {
    if (!countMap[id]) countMap[id] = 0;
  });
  
  return res.json({
    success: true,
    period,
    counts: countMap
  });
}

/**
 * Convert period string to PostgreSQL interval
 */
function getIntervalFromPeriod(period) {
  switch (period) {
    case '1d': return '1 day';
    case '7d': return '7 days';
    case '30d': return '30 days';
    case '365d': return '365 days';
    case 'all': return '100 years'; // effectively all time
    default: return '7 days';
  }
}
