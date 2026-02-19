/**
 * API Route: /api/rewards
 * 
 * Rewards & Unlockable Content system
 * 
 * GET:
 *   ?artist=ADDRESS          → rewards by artist
 *   ?page=global&sort=newest → global rewards feed (newest, ending_soon, most_claimed)
 *   ?id=REWARD_ID            → single reward detail
 *   ?claims=true&artist=ADDR → artist sees who claimed their rewards
 * 
 * POST:
 *   action: 'create'         → artist creates a reward
 *   action: 'update'         → artist updates a reward
 *   action: 'claim'          → user claims a reward
 *   action: 'update_status'  → artist pauses/completes/reactivates
 * 
 * DELETE:
 *   ?id=REWARD_ID&artist=ADDR → artist deletes a reward
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return handleGet(req, res, sql);
    if (req.method === 'POST') return handlePost(req, res, sql);
    if (req.method === 'DELETE') return handleDelete(req, res, sql);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Rewards API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================
// GET handlers
// ============================================

async function handleGet(req, res, sql) {
  const { artist, page, sort, id, claims, claimer } = req.query;

  // Single reward detail
  if (id) {
    const rewards = await sql`
      SELECT r.*, 
        p.display_name as artist_name,
        p.avatar_url as artist_avatar
      FROM rewards r
      LEFT JOIN profiles p ON p.address = r.artist_address
      WHERE r.id = ${id}
    `;
    if (rewards.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }
    return res.json({ reward: rewards[0] });
  }

  // Artist's claims (who claimed their rewards)
  if (claims === 'true' && artist) {
    const claimRows = await sql`
      SELECT rc.*, r.title as reward_title, r.image_url as reward_image,
        p.display_name as claimer_name
      FROM reward_claims rc
      JOIN rewards r ON r.id = rc.reward_id
      LEFT JOIN profiles p ON p.address = rc.claimer_address
      WHERE r.artist_address = ${artist}
      ORDER BY rc.claimed_at DESC
      LIMIT 100
    `;
    
    // Mark as notified
    await sql`
      UPDATE reward_claims SET artist_notified = true
      WHERE reward_id IN (SELECT id FROM rewards WHERE artist_address = ${artist})
        AND artist_notified = false
    `;
    
    return res.json({ claims: claimRows });
  }

  // Check if a specific user has claimed
  if (claimer && id) {
    const existing = await sql`
      SELECT id FROM reward_claims
      WHERE reward_id = ${id} AND claimer_address = ${claimer}
    `;
    return res.json({ claimed: existing.length > 0 });
  }

  // Rewards by artist
  if (artist) {
    const rewards = await sql`
      SELECT r.*,
        p.display_name as artist_name,
        p.avatar_url as artist_avatar
      FROM rewards r
      LEFT JOIN profiles p ON p.address = r.artist_address
      WHERE r.artist_address = ${artist}
      ORDER BY r.created_at DESC
    `;
    return res.json({ rewards });
  }

  // Global rewards feed
  if (page === 'global') {
    let orderBy = 'r.created_at DESC'; // newest
    if (sort === 'ending_soon') {
      orderBy = 'r.expires_at ASC NULLS LAST';
    } else if (sort === 'most_claimed') {
      orderBy = 'r.claim_count DESC';
    }

    const rewards = await sql`
      SELECT r.*,
        p.display_name as artist_name,
        p.avatar_url as artist_avatar
      FROM rewards r
      LEFT JOIN profiles p ON p.address = r.artist_address
      WHERE r.status = 'active'
        AND (r.expires_at IS NULL OR r.expires_at > NOW())
        AND (r.max_claims IS NULL OR r.claim_count < r.max_claims)
      ORDER BY ${sql.unsafe(orderBy)}
      LIMIT 50
    `;
    return res.json({ rewards });
  }

  return res.status(400).json({ error: 'Missing query parameters' });
}

// ============================================
// POST handlers
// ============================================

async function handlePost(req, res, sql) {
  const { action } = req.body;

  switch (action) {
    case 'create': return createReward(req, res, sql);
    case 'update': return updateReward(req, res, sql);
    case 'claim': return claimReward(req, res, sql);
    case 'update_status': return updateStatus(req, res, sql);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function createReward(req, res, sql) {
  const {
    artistAddress, title, description, imageUrl, videoUrl,
    rewardType, accessType, requiredReleaseId,
    expiresAt, maxClaims
  } = req.body;

  if (!artistAddress || !title) {
    return res.status(400).json({ error: 'Artist address and title required' });
  }

  const id = `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await sql`
    INSERT INTO rewards (
      id, artist_address, title, description, image_url, video_url,
      reward_type, access_type, required_release_id,
      expires_at, max_claims, status, created_at, updated_at
    ) VALUES (
      ${id}, ${artistAddress}, ${title}, ${description || null},
      ${imageUrl || null}, ${videoUrl || null},
      ${rewardType || 'physical'}, ${accessType || 'any_nft'},
      ${requiredReleaseId || null},
      ${expiresAt || null}, ${maxClaims || null},
      'active', NOW(), NOW()
    )
  `;

  // Ensure artist_unlockables row exists with tab_setup_complete = true
  await sql`
    INSERT INTO artist_unlockables (artist_address, tab_setup_complete, updated_at)
    VALUES (${artistAddress}, true, NOW())
    ON CONFLICT (artist_address)
    DO UPDATE SET tab_setup_complete = true, updated_at = NOW()
  `;

  console.log(`✅ Reward created: ${id} by ${artistAddress}`);

  return res.json({ success: true, id });
}

async function updateReward(req, res, sql) {
  const {
    id, artistAddress, title, description, imageUrl, videoUrl,
    rewardType, accessType, requiredReleaseId,
    expiresAt, maxClaims
  } = req.body;

  if (!id || !artistAddress) {
    return res.status(400).json({ error: 'Reward ID and artist address required' });
  }

  // Verify ownership
  const existing = await sql`
    SELECT id FROM rewards WHERE id = ${id} AND artist_address = ${artistAddress}
  `;
  if (existing.length === 0) {
    return res.status(403).json({ error: 'Not your reward' });
  }

  await sql`
    UPDATE rewards SET
      title = COALESCE(${title}, title),
      description = COALESCE(${description}, description),
      image_url = COALESCE(${imageUrl}, image_url),
      video_url = COALESCE(${videoUrl}, video_url),
      reward_type = COALESCE(${rewardType}, reward_type),
      access_type = COALESCE(${accessType}, access_type),
      required_release_id = ${requiredReleaseId || null},
      expires_at = ${expiresAt || null},
      max_claims = ${maxClaims || null},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return res.json({ success: true });
}

async function claimReward(req, res, sql) {
  const { rewardId, claimerAddress, nftTokenId } = req.body;

  if (!rewardId || !claimerAddress) {
    return res.status(400).json({ error: 'Reward ID and claimer address required' });
  }

  // Get reward
  const rewards = await sql`
    SELECT * FROM rewards WHERE id = ${rewardId}
  `;
  if (rewards.length === 0) {
    return res.status(404).json({ error: 'Reward not found' });
  }

  const reward = rewards[0];

  // Check status
  if (reward.status !== 'active') {
    return res.status(400).json({ error: 'Reward is no longer active' });
  }

  // Check expiry
  if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Reward has expired' });
  }

  // Check max claims
  if (reward.max_claims && reward.claim_count >= reward.max_claims) {
    return res.status(400).json({ error: 'Reward is fully claimed' });
  }

  // Check duplicate (unique constraint will catch this too)
  const existing = await sql`
    SELECT id FROM reward_claims
    WHERE reward_id = ${rewardId} AND claimer_address = ${claimerAddress}
  `;
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Already claimed' });
  }

  // Verify NFT ownership
  const hasAccess = await checkNftAccess(sql, claimerAddress, reward);
  if (!hasAccess) {
    return res.status(403).json({ error: 'You do not own the required NFT' });
  }

  // Create claim
  const claimId = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await sql`
    INSERT INTO reward_claims (id, reward_id, claimer_address, nft_token_id, claimed_at)
    VALUES (${claimId}, ${rewardId}, ${claimerAddress}, ${nftTokenId || null}, NOW())
  `;

  // Increment claim count
  await sql`
    UPDATE rewards SET claim_count = claim_count + 1, updated_at = NOW()
    WHERE id = ${rewardId}
  `;

  // Create artist notification
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, created_at)
      VALUES (
        ${notifId}, ${reward.artist_address}, 'reward_claim',
        ${'Reward claimed: ' + reward.title},
        ${claimerAddress + ' claimed your reward'},
        NOW()
      )
    `;
  } catch (e) {
    console.error('Failed to create claim notification:', e);
  }

  console.log(`✅ Reward claimed: ${rewardId} by ${claimerAddress}`);

  return res.json({ success: true, claimId });
}

async function updateStatus(req, res, sql) {
  const { id, artistAddress, status } = req.body;

  if (!id || !artistAddress || !status) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (!['active', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const existing = await sql`
    SELECT id FROM rewards WHERE id = ${id} AND artist_address = ${artistAddress}
  `;
  if (existing.length === 0) {
    return res.status(403).json({ error: 'Not your reward' });
  }

  await sql`
    UPDATE rewards SET status = ${status}, updated_at = NOW() WHERE id = ${id}
  `;

  return res.json({ success: true });
}

// ============================================
// DELETE handler
// ============================================

async function handleDelete(req, res, sql) {
  const { id, artist } = req.query;

  if (!id || !artist) {
    return res.status(400).json({ error: 'Reward ID and artist required' });
  }

  const existing = await sql`
    SELECT id FROM rewards WHERE id = ${id} AND artist_address = ${artist}
  `;
  if (existing.length === 0) {
    return res.status(403).json({ error: 'Not your reward' });
  }

  await sql`DELETE FROM rewards WHERE id = ${id}`;

  console.log(`🗑️ Reward deleted: ${id}`);
  return res.json({ success: true });
}

// ============================================
// Helper: check NFT ownership for access
// ============================================

async function checkNftAccess(sql, userAddress, rewardOrConfig) {
  const accessType = rewardOrConfig.access_type || 'any_nft';
  const artistAddress = rewardOrConfig.artist_address;
  const requiredReleaseId = rewardOrConfig.required_release_id;

  if (accessType === 'specific_release' && requiredReleaseId) {
    // User must own NFT from a specific release
    const nfts = await sql`
      SELECT n.id FROM nfts n
      JOIN tracks t ON t.id = n.track_id
      WHERE n.owner_address = ${userAddress}
        AND n.status = 'sold'
        AND t.release_id = ${requiredReleaseId}
      LIMIT 1
    `;
    return nfts.length > 0;
  }

  // Default: own any NFT by this artist
  const nfts = await sql`
    SELECT n.id FROM nfts n
    JOIN tracks t ON t.id = n.track_id
    JOIN releases r ON r.id = t.release_id
    WHERE n.owner_address = ${userAddress}
      AND n.status = 'sold'
      AND r.artist_address = ${artistAddress}
    LIMIT 1
  `;
  return nfts.length > 0;
}
