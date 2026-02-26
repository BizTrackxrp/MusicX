/**
 * XRP Music - Comments API
 * 
 * Comment system for releases (songs/albums).
 * - Anyone with a connected wallet can comment
 * - 280 character limit (tweet-length)
 * - Artists can delete comments on their own releases
 * - Comments posted while release is in draft mode get is_draft_comment=true
 * - "Early Listener" badge shown on draft comments
 * 
 * Actions:
 *   list    — Get comments for a release (paginated, newest first)
 *   add     — Post a new comment
 *   delete  — Delete a comment (artist or commenter)
 *   preview — Get top 3 newest comments (for release card/player)
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  if (action === 'list') return handleList(req, res, sql);
  if (action === 'preview') return handlePreview(req, res, sql);
  if (action === 'add') return handleAdd(req, res, sql);
  if (action === 'delete') return handleDelete(req, res, sql);

  return res.status(400).json({ error: 'Invalid action' });
}

// ─── List comments (paginated, newest first) ─────────────────────────

async function handleList(req, res, sql) {
  try {
    const { releaseId, limit = 50, offset = 0 } = req.body;

    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }

    const comments = await sql`
      SELECT 
        c.id,
        c.release_id,
        c.track_id,
        c.commenter_address,
        c.content,
        c.is_draft_comment,
        c.created_at,
        p.display_name,
        p.avatar_url
      FROM comments c
      LEFT JOIN profiles p ON p.address = c.commenter_address
      WHERE c.release_id = ${releaseId}
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total FROM comments WHERE release_id = ${releaseId}
    `;
    const total = parseInt(countResult[0]?.total) || 0;

    return res.json({
      success: true,
      comments: comments.map(c => ({
        id: c.id,
        releaseId: c.release_id,
        trackId: c.track_id,
        commenterAddress: c.commenter_address,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        content: c.content,
        isDraftComment: c.is_draft_comment,
        createdAt: c.created_at,
      })),
      total,
      hasMore: offset + comments.length < total,
    });
  } catch (error) {
    console.error('List comments error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list comments' });
  }
}

// ─── Preview: top 3 newest comments ──────────────────────────────────

async function handlePreview(req, res, sql) {
  try {
    const { releaseId } = req.body;

    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }

    const comments = await sql`
      SELECT 
        c.id,
        c.commenter_address,
        c.content,
        c.is_draft_comment,
        c.created_at,
        p.display_name,
        p.avatar_url
      FROM comments c
      LEFT JOIN profiles p ON p.address = c.commenter_address
      WHERE c.release_id = ${releaseId}
      ORDER BY c.created_at DESC
      LIMIT 3
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total FROM comments WHERE release_id = ${releaseId}
    `;
    const total = parseInt(countResult[0]?.total) || 0;

    return res.json({
      success: true,
      comments: comments.map(c => ({
        id: c.id,
        commenterAddress: c.commenter_address,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        content: c.content,
        isDraftComment: c.is_draft_comment,
        createdAt: c.created_at,
      })),
      total,
    });
  } catch (error) {
    console.error('Preview comments error:', error);
    return res.status(500).json({ error: error.message || 'Failed to preview comments' });
  }
}

// ─── Add a comment ───────────────────────────────────────────────────

async function handleAdd(req, res, sql) {
  try {
    const { releaseId, trackId, commenterAddress, content } = req.body;

    if (!releaseId || !commenterAddress || !content) {
      return res.status(400).json({ error: 'Missing required fields (releaseId, commenterAddress, content)' });
    }

    // Validate content length
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (trimmed.length > 280) {
      return res.status(400).json({ error: 'Comment must be 280 characters or less' });
    }

    // Check if release exists and get its status
    const releases = await sql`
      SELECT id, status, is_minted, mint_fee_paid, artist_address 
      FROM releases WHERE id = ${releaseId}
    `;
    const release = releases[0];
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Determine if this is a draft comment
    // Draft = release hasn't been minted/finalized yet
    const isLive = release.is_minted === true || 
                   release.mint_fee_paid === true || 
                   release.status === 'live';
    const isDraftComment = !isLive;

    // Rate limit: max 1 comment per 10 seconds per user per release
    const recentComments = await sql`
      SELECT COUNT(*) as count FROM comments 
      WHERE commenter_address = ${commenterAddress} 
        AND release_id = ${releaseId}
        AND created_at > NOW() - INTERVAL '10 seconds'
    `;
    if (parseInt(recentComments[0]?.count) > 0) {
      return res.status(429).json({ error: 'Please wait before commenting again' });
    }

    const id = `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO comments (id, release_id, track_id, commenter_address, content, is_draft_comment, created_at)
      VALUES (${id}, ${releaseId}, ${trackId || null}, ${commenterAddress}, ${trimmed}, ${isDraftComment}, NOW())
    `;

    // Fetch the commenter's profile for the response
    const profiles = await sql`
      SELECT display_name, avatar_url FROM profiles WHERE address = ${commenterAddress}
    `;
    const profile = profiles[0];

    console.log(`💬 New comment on ${releaseId} by ${commenterAddress}${isDraftComment ? ' (draft)' : ''}`);

    return res.json({
      success: true,
      comment: {
        id,
        releaseId,
        trackId: trackId || null,
        commenterAddress,
        displayName: profile?.display_name || null,
        avatarUrl: profile?.avatar_url || null,
        content: trimmed,
        isDraftComment,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
}

// ─── Delete a comment ────────────────────────────────────────────────
// Only the commenter or the release artist can delete

async function handleDelete(req, res, sql) {
  try {
    const { commentId, requesterAddress } = req.body;

    if (!commentId || !requesterAddress) {
      return res.status(400).json({ error: 'Missing commentId or requesterAddress' });
    }

    // Get the comment and its release
    const comments = await sql`
      SELECT c.id, c.commenter_address, c.release_id, r.artist_address
      FROM comments c
      JOIN releases r ON r.id = c.release_id
      WHERE c.id = ${commentId}
    `;

    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = comments[0];

    // Check permission: commenter or artist can delete
    const isCommenter = comment.commenter_address === requesterAddress;
    const isArtist = comment.artist_address === requesterAddress;

    if (!isCommenter && !isArtist) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await sql`DELETE FROM comments WHERE id = ${commentId}`;

    console.log(`🗑️ Comment ${commentId} deleted by ${requesterAddress} (${isArtist ? 'artist' : 'commenter'})`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete comment' });
  }
}
