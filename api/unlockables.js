/**
 * API Route: /api/unlockables
 * 
 * Artist unlockable settings + private page posts
 * 
 * GET:
 *   ?artist=ADDRESS                    → get artist unlockable config
 *   ?artist=ADDRESS&posts=true         → get private posts (if user has access)
 *   ?artist=ADDRESS&check=ADDRESS      → check if user has access
 * 
 * POST:
 *   action: 'setup'        → artist configures their unlockable tab
 *   action: 'create_post'  → artist creates a private page post
 *   action: 'update_post'  → artist updates a post
 *   action: 'delete_post'  → artist deletes a post
 *   action: 'comment'      → user comments on a post (must have access)
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
  const { artist, posts, check, viewer } = req.query;

  if (!artist) {
    return res.status(400).json({ error: 'artist parameter required' });
  }

  // Check if a user has access to this artist's unlockable content
  if (check) {
    const config = await getArtistConfig(sql, artist);
    if (!config || !config.tab_setup_complete) {
      return res.json({ hasAccess: false, reason: 'not_setup' });
    }

    // Artist always has access to their own page
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

  // Get private posts (gated)
  if (posts === 'true') {
    // Must pass viewer to check access
    if (!viewer) {
      return res.status(400).json({ error: 'viewer parameter required for posts' });
    }

    const config = await getArtistConfig(sql, artist);
    const isOwner = viewer.toLowerCase() === artist.toLowerCase();

    if (!isOwner) {
      const hasAccess = await checkNftAccess(sql, viewer, {
        artist_address: artist,
        access_type: config?.private_page_access_type || 'any_nft',
        required_release_id: config?.private_page_release_id,
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'No access', hasAccess: false });
      }
    }

    const postRows = await sql`
      SELECT pp.*,
        (SELECT COUNT(*) FROM private_post_comments c WHERE c.post_id = pp.id) as comment_count
      FROM private_posts pp
      WHERE pp.artist_address = ${artist}
      ORDER BY pp.created_at DESC
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

    // Attach comments to posts
    const commentsByPost = {};
    for (const c of comments) {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
      commentsByPost[c.post_id].push(c);
    }

    const postsWithComments = postRows.map(p => ({
      ...p,
      comments: commentsByPost[p.id] || [],
    }));

    return res.json({ posts: postsWithComments, hasAccess: true });
  }

  // Get artist unlockable config (public — just settings, not gated content)
  const config = await getArtistConfig(sql, artist);

  // Also get reward count for this artist
  const rewardCount = await sql`
    SELECT COUNT(*) as count FROM rewards
    WHERE artist_address = ${artist} AND status = 'active'
  `;

  // Get post count
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
  const {
    artistAddress,
    privatePageEnabled,
    privatePageTitle,
    privatePageDescription,
    privatePageAccessType,
    privatePageReleaseId,
  } = req.body;

  if (!artistAddress) {
    return res.status(400).json({ error: 'Artist address required' });
  }

  await sql`
    INSERT INTO artist_unlockables (
      artist_address, private_page_enabled, private_page_title,
      private_page_description, private_page_access_type,
      private_page_release_id, tab_setup_complete, updated_at
    ) VALUES (
      ${artistAddress},
      ${privatePageEnabled || false},
      ${privatePageTitle || null},
      ${privatePageDescription || null},
      ${privatePageAccessType || 'any_nft'},
      ${privatePageReleaseId || null},
      true, NOW()
    )
    ON CONFLICT (artist_address) DO UPDATE SET
      private_page_enabled = ${privatePageEnabled || false},
      private_page_title = ${privatePageTitle || null},
      private_page_description = ${privatePageDescription || null},
      private_page_access_type = ${privatePageAccessType || 'any_nft'},
      private_page_release_id = ${privatePageReleaseId || null},
      tab_setup_complete = true,
      updated_at = NOW()
  `;

  console.log(`✅ Unlockable setup saved for ${artistAddress}`);
  return res.json({ success: true });
}

async function createPost(req, res, sql) {
  const { artistAddress, content, imageUrl, videoUrl } = req.body;

  if (!artistAddress) {
    return res.status(400).json({ error: 'Artist address required' });
  }

  if (!content && !imageUrl && !videoUrl) {
    return res.status(400).json({ error: 'Post must have content, image, or video' });
  }

  const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await sql`
    INSERT INTO private_posts (id, artist_address, content, image_url, video_url, created_at)
    VALUES (${id}, ${artistAddress}, ${content || null}, ${imageUrl || null}, ${videoUrl || null}, NOW())
  `;

  // Ensure tab is set up
  await sql`
    INSERT INTO artist_unlockables (artist_address, private_page_enabled, tab_setup_complete, updated_at)
    VALUES (${artistAddress}, true, true, NOW())
    ON CONFLICT (artist_address)
    DO UPDATE SET private_page_enabled = true, tab_setup_complete = true, updated_at = NOW()
  `;

  console.log(`✅ Private post created: ${id}`);
  return res.json({ success: true, id });
}

async function updatePost(req, res, sql) {
  const { id, artistAddress, content, imageUrl, videoUrl } = req.body;

  if (!id || !artistAddress) {
    return res.status(400).json({ error: 'Post ID and artist address required' });
  }

  const existing = await sql`
    SELECT id FROM private_posts WHERE id = ${id} AND artist_address = ${artistAddress}
  `;
  if (existing.length === 0) {
    return res.status(403).json({ error: 'Not your post' });
  }

  await sql`
    UPDATE private_posts SET
      content = COALESCE(${content}, content),
      image_url = ${imageUrl !== undefined ? imageUrl : null},
      video_url = ${videoUrl !== undefined ? videoUrl : null},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return res.json({ success: true });
}

async function deletePost(req, res, sql) {
  const { id, artistAddress } = req.body;

  if (!id || !artistAddress) {
    return res.status(400).json({ error: 'Post ID and artist address required' });
  }

  const existing = await sql`
    SELECT id FROM private_posts WHERE id = ${id} AND artist_address = ${artistAddress}
  `;
  if (existing.length === 0) {
    return res.status(403).json({ error: 'Not your post' });
  }

  await sql`DELETE FROM private_posts WHERE id = ${id}`;
  return res.json({ success: true });
}

async function addComment(req, res, sql) {
  const { postId, commenterAddress, content } = req.body;

  if (!postId || !commenterAddress || !content) {
    return res.status(400).json({ error: 'Post ID, commenter address, and content required' });
  }

  // Get the post to find artist
  const posts = await sql`
    SELECT artist_address FROM private_posts WHERE id = ${postId}
  `;
  if (posts.length === 0) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const artistAddress = posts[0].artist_address;

  // Check access (artist can always comment, others need NFT)
  if (commenterAddress.toLowerCase() !== artistAddress.toLowerCase()) {
    const config = await getArtistConfig(sql, artistAddress);
    const hasAccess = await checkNftAccess(sql, commenterAddress, {
      artist_address: artistAddress,
      access_type: config?.private_page_access_type || 'any_nft',
      required_release_id: config?.private_page_release_id,
    });
    if (!hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }
  }

  const id = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Get commenter name
  const profiles = await sql`
    SELECT display_name FROM profiles WHERE address = ${commenterAddress}
  `;

  await sql`
    INSERT INTO private_post_comments (id, post_id, commenter_address, commenter_name, content, created_at)
    VALUES (${id}, ${postId}, ${commenterAddress}, ${profiles[0]?.display_name || null}, ${content}, NOW())
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
