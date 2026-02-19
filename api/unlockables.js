/**
 * API Route: /api/unlockables  (v2)
 * 
 * Artist unlockable settings + private page posts
 * Supports: multi-media posts, per-post access keys, pinned posts
 * 
 * GET:
 *   ?artist=ADDRESS                    → get artist unlockable config
 *   ?artist=ADDRESS&posts=true         → get private posts
 *   ?artist=ADDRESS&check=ADDRESS      → check if user has access
 * 
 * POST:
 *   action: 'setup'        → artist configures their unlockable tab
 *   action: 'create_post'  → artist creates a private page post
 *   action: 'update_post'  → artist updates a post
 *   action: 'delete_post'  → artist deletes a post
 *   action: 'comment'      → user comments on a post
 */
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return handleGet(req, res, sql);
    if (req.method === 'POST') return handlePost(req, res, sql);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Unlockables API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================
// GET handlers
// ============================================

async function handleGet(req, res, sql) {
  const { artist, posts, check } = req.query;

  if (!artist) {
    return res.status(400).json({ error: 'artist parameter required' });
  }

  // Check access
  if (check) {
    const config = await getArtistConfig(sql, artist);
    if (!config || !config.tab_setup_complete) {
      return res.json({ hasAccess: false, reason: 'not_setup' });
    }
    if (check.toLowerCase() === artist.toLowerCase()) {
      return res.json({ hasAccess: true, isOwner: true });
    }
    const hasAccess = await checkNftAccess(sql, check, {
      artist_address: artist,
      access_type: config.private_page_access_type || 'any_nft',
      required_release_id: config.private_page_release_id,
    });
    return res.json({ hasAccess, isOwner: false });
  }

  // Get private posts
  if (posts === 'true') {
    const postRows = await sql`
      SELECT pp.*
      FROM private_posts pp
      WHERE pp.artist_address = ${artist}
      ORDER BY pp.pinned DESC, pp.created_at DESC
      LIMIT 50
    `;

    // Get comments for each post
    const postIds = postRows.map(p => p.id);
    let comments = [];
    if (postIds.length > 0) {
      comments = await sql`
        SELECT c.*, p.name as commenter_name
        FROM private_post_comments c
        LEFT JOIN profiles p ON p.wallet_address = c.commenter_address
        WHERE c.post_id = ANY(${postIds})
        ORDER BY c.created_at ASC
      `;
    }

    const commentsByPost = {};
    for (const c of comments) {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
      commentsByPost[c.post_id].push(c);
    }

    const postsWithComments = postRows.map(p => ({
      ...p,
      media_urls: p.media_urls || [],
      comments: commentsByPost[p.id] || [],
    }));

    return res.json({ posts: postsWithComments });
  }

  // Get config + counts
  const config = await getArtistConfig(sql, artist);

  const rewardCount = await sql`
    SELECT COUNT(*) as count FROM rewards
    WHERE artist_address = ${artist} AND status = 'active'
  `;
  const postCount = await sql`
    SELECT COUNT(*) as count FROM private_posts
    WHERE artist_address = ${artist}
  `;

  return res.json({
    config: config || { tab_setup_complete: false },
    rewardCount: parseInt(rewardCount[0]?.count) || 0,
    postCount: parseInt(postCount[0]?.count) || 0,
  });
}

// ============================================
// POST handlers
// ============================================

async function handlePost(req, res, sql) {
  const { action } = req.body;

  switch (action) {
    case 'setup': return setupUnlockable(req, res, sql);
    case 'create_post': return createPost(req, res, sql);
    case 'update_post': return updatePost(req, res, sql);
    case 'delete_post': return deletePost(req, res, sql);
    case 'comment': return addComment(req, res, sql);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function setupUnlockable(req, res, sql) {
  const artist = req.body.artist || req.body.artistAddress;
  const enabled = req.body.private_page_enabled ?? req.body.privatePageEnabled ?? false;
  const title = req.body.private_page_title ?? req.body.privatePageTitle ?? null;
  const description = req.body.private_page_description ?? req.body.privatePageDescription ?? null;
  const accessType = req.body.private_page_access_type ?? req.body.privatePageAccessType ?? 'any_nft';
  const releaseId = req.body.private_page_release_id ?? req.body.privatePageReleaseId ?? null;
  const welcomeMsg = req.body.welcome_message ?? null;
  const tabComplete = req.body.tab_setup_complete ?? true;

  if (!artist) {
    return res.status(400).json({ error: 'Artist address required' });
  }

  await sql`
    INSERT INTO artist_unlockables (
      artist_address, private_page_enabled, private_page_title,
      private_page_description, private_page_access_type,
      private_page_release_id, welcome_message, tab_setup_complete, updated_at
    ) VALUES (
      ${artist}, ${enabled}, ${title}, ${description},
      ${accessType}, ${releaseId}, ${welcomeMsg}, ${tabComplete}, NOW()
    )
    ON CONFLICT (artist_address) DO UPDATE SET
      private_page_enabled = ${enabled},
      private_page_title = COALESCE(${title}, artist_unlockables.private_page_title),
      private_page_description = ${description},
      private_page_access_type = ${accessType},
      private_page_release_id = ${releaseId},
      welcome_message = ${welcomeMsg},
      tab_setup_complete = ${tabComplete},
      updated_at = NOW()
  `;

  console.log(`✅ Unlockable setup saved for ${artist}`);
  return res.json({ success: true });
}

async function createPost(req, res, sql) {
  const artist = req.body.artist || req.body.artistAddress;
  const { content, image_url, media_urls, access_type, required_release_id, pinned } = req.body;

  if (!artist) return res.status(400).json({ error: 'Artist address required' });
  if (!content && (!media_urls || media_urls.length === 0) && !image_url) {
    return res.status(400).json({ error: 'Post must have content or media' });
  }

  const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await sql`
    INSERT INTO private_posts (
      id, artist_address, content, image_url,
      media_urls, access_type, required_release_id, pinned, created_at
    ) VALUES (
      ${id}, ${artist}, ${content || null}, ${image_url || null},
      ${JSON.stringify(media_urls || [])}, ${access_type || 'page_default'},
      ${required_release_id || null}, ${pinned || false}, NOW()
    )
  `;

  // Ensure tab is set up
  await sql`
    INSERT INTO artist_unlockables (artist_address, private_page_enabled, tab_setup_complete, updated_at)
    VALUES (${artist}, true, true, NOW())
    ON CONFLICT (artist_address)
    DO UPDATE SET private_page_enabled = true, tab_setup_complete = true, updated_at = NOW()
  `;

  console.log(`✅ Private post created: ${id}`);
  return res.json({ success: true, id });
}

async function updatePost(req, res, sql) {
  const artist = req.body.artist || req.body.artistAddress;
  const { id, content, image_url, media_urls, access_type, required_release_id, pinned } = req.body;

  if (!id || !artist) return res.status(400).json({ error: 'Post ID and artist address required' });

  const existing = await sql`
    SELECT id FROM private_posts WHERE id = ${id} AND artist_address = ${artist}
  `;
  if (existing.length === 0) return res.status(403).json({ error: 'Not your post' });

  await sql`
    UPDATE private_posts SET
      content = ${content ?? null},
      image_url = ${image_url ?? null},
      media_urls = ${JSON.stringify(media_urls || [])},
      access_type = ${access_type || 'page_default'},
      required_release_id = ${required_release_id || null},
      pinned = ${pinned ?? false},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return res.json({ success: true });
}

async function deletePost(req, res, sql) {
  const artist = req.body.artist || req.body.artistAddress;
  const { id } = req.body;

  if (!id || !artist) return res.status(400).json({ error: 'Post ID and artist address required' });

  const existing = await sql`
    SELECT id FROM private_posts WHERE id = ${id} AND artist_address = ${artist}
  `;
  if (existing.length === 0) return res.status(403).json({ error: 'Not your post' });

  await sql`DELETE FROM private_posts WHERE id = ${id}`;
  return res.json({ success: true });
}

async function addComment(req, res, sql) {
  const { post_id, commenter_address, content } = req.body;

  if (!post_id || !commenter_address || !content) {
    return res.status(400).json({ error: 'Post ID, commenter address, and content required' });
  }

  const posts = await sql`SELECT artist_address FROM private_posts WHERE id = ${post_id}`;
  if (posts.length === 0) return res.status(404).json({ error: 'Post not found' });

  const id = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const profiles = await sql`
    SELECT name FROM profiles WHERE wallet_address = ${commenter_address}
  `;

  await sql`
    INSERT INTO private_post_comments (id, post_id, commenter_address, commenter_name, content, created_at)
    VALUES (${id}, ${post_id}, ${commenter_address}, ${profiles[0]?.name || null}, ${content}, NOW())
  `;

  return res.json({ success: true, id });
}

// ============================================
// Helpers
// ============================================

async function getArtistConfig(sql, artistAddress) {
  const rows = await sql`
    SELECT * FROM artist_unlockables WHERE artist_address = ${artistAddress}
  `;
  return rows[0] || null;
}

async function checkNftAccess(sql, userAddress, config) {
  const accessType = config.access_type || 'any_nft';
  const artistAddress = config.artist_address;
  const requiredReleaseId = config.required_release_id;

  if (accessType === 'specific_release' && requiredReleaseId) {
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
