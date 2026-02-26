/**
 * XRP Music - Comments API
 * 
 * Comment system for releases (songs/albums).
 * - Anyone with a connected wallet can comment
 * - 280 character limit (tweet-length)
 * - Reply threading via parent_comment_id
 * - Artists can delete comments on their own releases
 * - Notifications sent on: new comment on your release (artist), reply to your comment (anyone)
 * - Comments posted while release is in draft mode get is_draft_comment=true
 * 
 * Actions:
 *   list    — Get comments for a release (paginated, newest first)
 *   add     — Post a new comment (or reply)
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

// ─── Helper: Get display name for an address ─────────────────────────

async function getDisplayName(sql, address) {
  try {
    const profiles = await sql`
      SELECT name, avatar_url FROM profiles WHERE wallet_address = ${address}
    `;
    return profiles[0] || null;
  } catch (e) {
    return null;
  }
}

// ─── Helper: Truncate address for display ────────────────────────────

function shortAddress(addr) {
  if (!addr || addr.length < 12) return addr || 'Unknown';
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}

// ─── Helper: Create notification ─────────────────────────────────────

async function createNotification(sql, { recipientAddress, type, title, message, releaseId, trackId, commentId, senderAddress, senderName }) {
  try {
    // Don't notify yourself
    if (recipientAddress === senderAddress) return;
    
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, comment_id, sender_address, sender_name, is_read, created_at)
      VALUES (${id}, ${recipientAddress}, ${type}, ${title}, ${message || null}, ${releaseId || null}, ${trackId || null}, ${commentId || null}, ${senderAddress || null}, ${senderName || null}, false, NOW())
    `;
  } catch (e) {
    console.error('Failed to create notification:', e.message);
  }
}

// ─── List comments (paginated, newest first, with replies) ───────────

async function handleList(req, res, sql) {
  try {
    const { releaseId, limit = 50, offset = 0 } = req.body;

    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID required' });
    }

    // Get top-level comments
    const comments = await sql`
      SELECT 
        c.id,
        c.release_id,
        c.track_id,
        c.commenter_address,
        c.content,
        c.is_draft_comment,
        c.parent_comment_id,
        c.created_at,
        p.name as display_name,
        p.avatar_url
      FROM comments c
      LEFT JOIN profiles p ON p.wallet_address = c.commenter_address
      WHERE c.release_id = ${releaseId} AND c.parent_comment_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    // Get all reply counts in one query
    const replyCounts = await sql`
      SELECT parent_comment_id, COUNT(*) as count 
      FROM comments 
      WHERE release_id = ${releaseId} AND parent_comment_id IS NOT NULL
      GROUP BY parent_comment_id
    `;
    const replyCountMap = {};
    replyCounts.forEach(r => { replyCountMap[r.parent_comment_id] = parseInt(r.count); });

    // Get replies for these comments
    const commentIds = comments.map(c => c.id);
    let replies = [];
    if (commentIds.length > 0) {
      replies = await sql`
        SELECT 
          c.id,
          c.release_id,
          c.commenter_address,
          c.content,
          c.is_draft_comment,
          c.parent_comment_id,
          c.created_at,
          p.name as display_name,
          p.avatar_url
        FROM comments c
        LEFT JOIN profiles p ON p.wallet_address = c.commenter_address
        WHERE c.parent_comment_id = ANY(${commentIds})
        ORDER BY c.created_at ASC
      `;
    }

    // Group replies by parent
    const replyMap = {};
    replies.forEach(r => {
      if (!replyMap[r.parent_comment_id]) replyMap[r.parent_comment_id] = [];
      replyMap[r.parent_comment_id].push(formatComment(r));
    });

    const countResult = await sql`
      SELECT COUNT(*) as total FROM comments 
      WHERE release_id = ${releaseId} AND parent_comment_id IS NULL
    `;
    const total = parseInt(countResult[0]?.total) || 0;

    return res.json({
      success: true,
      comments: comments.map(c => ({
        ...formatComment(c),
        replyCount: replyCountMap[c.id] || 0,
        replies: replyMap[c.id] || [],
      })),
      total,
      hasMore: offset + comments.length < total,
    });
  } catch (error) {
    console.error('List comments error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list comments' });
  }
}

// ─── Preview: top 3 newest comments (top-level only) ─────────────────

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
        c.parent_comment_id,
        c.created_at,
        p.name as display_name,
        p.avatar_url
      FROM comments c
      LEFT JOIN profiles p ON p.wallet_address = c.commenter_address
      WHERE c.release_id = ${releaseId} AND c.parent_comment_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 3
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total FROM comments WHERE release_id = ${releaseId}
    `;
    const total = parseInt(countResult[0]?.total) || 0;

    const commentIds = comments.map(c => c.id);
    let replyCounts = [];
    if (commentIds.length > 0) {
      replyCounts = await sql`
        SELECT parent_comment_id, COUNT(*) as count 
        FROM comments 
        WHERE parent_comment_id = ANY(${commentIds})
        GROUP BY parent_comment_id
      `;
    }
    const replyCountMap = {};
    replyCounts.forEach(r => { replyCountMap[r.parent_comment_id] = parseInt(r.count); });

    return res.json({
      success: true,
      comments: comments.map(c => ({
        ...formatComment(c),
        replyCount: replyCountMap[c.id] || 0,
      })),
      total,
    });
  } catch (error) {
    console.error('Preview comments error:', error);
    return res.status(500).json({ error: error.message || 'Failed to preview comments' });
  }
}

// ─── Add a comment or reply ──────────────────────────────────────────

async function handleAdd(req, res, sql) {
  try {
    const { releaseId, trackId, commenterAddress, content, parentCommentId } = req.body;

    if (!releaseId || !commenterAddress || !content) {
      return res.status(400).json({ error: 'Missing required fields (releaseId, commenterAddress, content)' });
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (trimmed.length > 280) {
      return res.status(400).json({ error: 'Comment must be 280 characters or less' });
    }

    // Check if release exists
    const releases = await sql`
      SELECT id, status, is_minted, mint_fee_paid, artist_address, title
      FROM releases WHERE id = ${releaseId}
    `;
    const release = releases[0];
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // If this is a reply, verify parent exists
    let parentComment = null;
    if (parentCommentId) {
      const parents = await sql`
        SELECT id, commenter_address, content FROM comments WHERE id = ${parentCommentId}
      `;
      if (parents.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      parentComment = parents[0];
    }

    // Draft detection
    const isLive = release.is_minted === true || 
                   release.mint_fee_paid === true || 
                   release.status === 'live';
    const isDraftComment = !isLive;

    // Rate limit: 1 comment per 10 seconds per user per release
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
      INSERT INTO comments (id, release_id, track_id, commenter_address, content, is_draft_comment, parent_comment_id, created_at)
      VALUES (${id}, ${releaseId}, ${trackId || null}, ${commenterAddress}, ${trimmed}, ${isDraftComment}, ${parentCommentId || null}, NOW())
    `;

    // Get commenter profile
    const commenterProfile = await getDisplayName(sql, commenterAddress);
    const commenterName = commenterProfile?.name || shortAddress(commenterAddress);
    const previewText = trimmed.length > 80 ? trimmed.substring(0, 77) + '...' : trimmed;

    // ─── Send notifications ────────────────────────────────────────

    if (parentCommentId && parentComment) {
      // REPLY → notify the parent comment author
      await createNotification(sql, {
        recipientAddress: parentComment.commenter_address,
        type: 'reply',
        title: `${commenterName} replied to your comment`,
        message: previewText,
        releaseId,
        commentId: id,
        senderAddress: commenterAddress,
        senderName: commenterName,
      });

      // Also notify artist if they didn't write the parent and aren't the replier
      if (release.artist_address !== parentComment.commenter_address && release.artist_address !== commenterAddress) {
        await createNotification(sql, {
          recipientAddress: release.artist_address,
          type: 'comment',
          title: `${commenterName} replied on "${release.title}"`,
          message: previewText,
          releaseId,
          commentId: id,
          senderAddress: commenterAddress,
          senderName: commenterName,
        });
      }
    } else {
      // TOP-LEVEL comment → notify the artist
      await createNotification(sql, {
        recipientAddress: release.artist_address,
        type: 'comment',
        title: `${commenterName} commented on "${release.title}"`,
        message: previewText,
        releaseId,
        commentId: id,
        senderAddress: commenterAddress,
        senderName: commenterName,
      });
    }

    console.log(`💬 ${parentCommentId ? 'Reply' : 'Comment'} on ${releaseId} by ${commenterAddress}`);

    return res.json({
      success: true,
      comment: {
        id,
        releaseId,
        trackId: trackId || null,
        commenterAddress,
        displayName: commenterProfile?.name || null,
        avatarUrl: commenterProfile?.avatar_url || null,
        content: trimmed,
        isDraftComment,
        parentCommentId: parentCommentId || null,
        replyCount: 0,
        replies: [],
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
}

// ─── Delete a comment ────────────────────────────────────────────────

async function handleDelete(req, res, sql) {
  try {
    const { commentId, requesterAddress } = req.body;

    if (!commentId || !requesterAddress) {
      return res.status(400).json({ error: 'Missing commentId or requesterAddress' });
    }

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
    const isCommenter = comment.commenter_address === requesterAddress;
    const isArtist = comment.artist_address === requesterAddress;

    if (!isCommenter && !isArtist) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete replies first, then the comment itself
    await sql`DELETE FROM comments WHERE parent_comment_id = ${commentId}`;
    await sql`DELETE FROM comments WHERE id = ${commentId}`;

    // Clean up related notifications
    await sql`DELETE FROM artist_notifications WHERE comment_id = ${commentId}`;

    console.log(`🗑️ Comment ${commentId} deleted by ${requesterAddress} (${isArtist ? 'artist' : 'commenter'})`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete comment' });
  }
}

// ─── Format helper ───────────────────────────────────────────────────

function formatComment(c) {
  return {
    id: c.id,
    releaseId: c.release_id,
    trackId: c.track_id,
    commenterAddress: c.commenter_address,
    displayName: c.display_name,
    avatarUrl: c.avatar_url,
    content: c.content,
    isDraftComment: c.is_draft_comment,
    parentCommentId: c.parent_comment_id,
    createdAt: c.created_at,
  };
}
