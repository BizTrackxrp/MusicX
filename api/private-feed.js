// api/private-feed.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, userAddress } = req.query;

    // GET FEED: Return all posts from artists whose NFTs the user holds
    if (req.method === 'GET' && action === 'feed') {
      if (!userAddress) {
        return res.status(400).json({ error: 'userAddress required' });
      }

      // Step 1: Get all artists whose NFTs this user holds
      const userNFTs = await sql`
        SELECT DISTINCT artist_address 
        FROM user_nfts 
        WHERE owner_address = ${userAddress}
      `;

      if (userNFTs.length === 0) {
        return res.json({ posts: [], hasNewContent: false });
      }

      const artistAddresses = userNFTs.map(n => n.artist_address);

      // Step 2: Get all posts from these artists (newest first)
      const posts = await sql`
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM private_post_likes WHERE post_id = p.id) as like_count,
          (SELECT COUNT(*) FROM private_post_comments WHERE post_id = p.id) as comment_count,
          (SELECT EXISTS(SELECT 1 FROM private_post_likes WHERE post_id = p.id AND user_address = ${userAddress})) as user_liked
        FROM private_posts p
        WHERE p.artist_address = ANY(${artistAddresses})
        ORDER BY p.created_at DESC
        LIMIT 100
      `;

      // Step 3: Get artist profiles for each post
      const postsWithArtists = await Promise.all(
        posts.map(async (post) => {
          const [profile] = await sql`
            SELECT display_name, profile_image_cid 
            FROM profiles 
            WHERE address = ${post.artist_address}
          `;
          return {
            ...post,
            artist_name: profile?.display_name || post.artist_address.slice(0, 8),
            artist_avatar: profile?.profile_image_cid 
              ? `https://gateway.lighthouse.storage/ipfs/${profile.profile_image_cid}`
              : null
          };
        })
      );

      // Step 4: Check if there's new content since last viewed
      const [viewRecord] = await sql`
        SELECT last_viewed_at FROM private_feed_views WHERE user_address = ${userAddress}
      `;

      const hasNewContent = viewRecord 
        ? posts.some(p => new Date(p.created_at) > new Date(viewRecord.last_viewed_at))
        : posts.length > 0;

      return res.json({ 
        posts: postsWithArtists,
        hasNewContent 
      });
    }

    // MARK AS VIEWED: Update last viewed timestamp
    if (req.method === 'POST' && action === 'mark-viewed') {
      const { userAddress } = req.body;
      if (!userAddress) {
        return res.status(400).json({ error: 'userAddress required' });
      }

      await sql`
        INSERT INTO private_feed_views (user_address, last_viewed_at)
        VALUES (${userAddress}, NOW())
        ON CONFLICT (user_address) 
        DO UPDATE SET last_viewed_at = NOW()
      `;

      return res.json({ success: true });
    }

    // LIKE POST
    if (req.method === 'POST' && action === 'like') {
      const { postId, userAddress } = req.body;
      if (!postId || !userAddress) {
        return res.status(400).json({ error: 'postId and userAddress required' });
      }

      await sql`
        INSERT INTO private_post_likes (post_id, user_address)
        VALUES (${postId}, ${userAddress})
        ON CONFLICT (post_id, user_address) DO NOTHING
      `;

      return res.json({ success: true });
    }

    // UNLIKE POST
    if (req.method === 'POST' && action === 'unlike') {
      const { postId, userAddress } = req.body;
      if (!postId || !userAddress) {
        return res.status(400).json({ error: 'postId and userAddress required' });
      }

      await sql`
        DELETE FROM private_post_likes 
        WHERE post_id = ${postId} AND user_address = ${userAddress}
      `;

      return res.json({ success: true });
    }

    // ADD COMMENT
    if (req.method === 'POST' && action === 'comment') {
      const { postId, userAddress, commentText } = req.body;
      if (!postId || !userAddress || !commentText) {
        return res.status(400).json({ error: 'postId, userAddress, and commentText required' });
      }

      const [comment] = await sql`
        INSERT INTO private_post_comments (post_id, user_address, comment_text)
        VALUES (${postId}, ${userAddress}, ${commentText})
        RETURNING *
      `;

      return res.json({ success: true, comment });
    }

    // GET COMMENTS FOR A POST
    if (req.method === 'GET' && action === 'comments') {
      const { postId } = req.query;
      if (!postId) {
        return res.status(400).json({ error: 'postId required' });
      }

      const comments = await sql`
        SELECT 
          c.*,
          p.display_name as user_name,
          p.profile_image_cid as user_avatar_cid
        FROM private_post_comments c
        LEFT JOIN profiles p ON c.user_address = p.address
        WHERE c.post_id = ${postId}
        ORDER BY c.created_at ASC
      `;

      const commentsWithAvatars = comments.map(c => ({
        ...c,
        user_name: c.user_name || c.user_address.slice(0, 8),
        user_avatar: c.user_avatar_cid 
          ? `https://gateway.lighthouse.storage/ipfs/${c.user_avatar_cid}`
          : null
      }));

      return res.json({ comments: commentsWithAvatars });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Private feed error:', error);
    return res.status(500).json({ error: error.message });
  }
}
