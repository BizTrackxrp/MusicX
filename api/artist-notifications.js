/**
 * XRP Music - Artist Notifications API
 * /api/artist-notifications
 * 
 * Handles fetching and managing notifications (sales, comments, replies, milestones).
 * Now serves ALL users, not just artists — anyone can get reply notifications.
 * 
 * Notification types:
 *   sale           — Someone bought your track
 *   comment        — Someone commented on your release
 *   reply          — Someone replied to your comment
 *   milestone      — Sales milestone reached
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - Fetch notifications for a user
    if (req.method === 'GET') {
      const { address, limit = 30, unreadOnly } = req.query;
      
      if (!address) {
        return res.status(400).json({ success: false, error: 'Address required' });
      }
      
      let notifications;
      
      if (unreadOnly === 'true') {
        notifications = await sql`
          SELECT * FROM artist_notifications 
          WHERE artist_address = ${address} AND is_read = FALSE
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else {
        notifications = await sql`
          SELECT * FROM artist_notifications 
          WHERE artist_address = ${address}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      }
      
      // Get unread count
      const unreadCount = await sql`
        SELECT COUNT(*) as count FROM artist_notifications 
        WHERE artist_address = ${address} AND is_read = FALSE
      `;
      
      return res.json({ 
        success: true, 
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          releaseId: n.release_id,
          trackId: n.track_id,
          commentId: n.comment_id,
          senderAddress: n.sender_address,
          senderName: n.sender_name,
          amount: n.amount,
          isRead: n.is_read,
          createdAt: n.created_at,
        })),
        unreadCount: parseInt(unreadCount[0]?.count || 0)
      });
    }
    
    // POST - Actions
    if (req.method === 'POST') {
      const { action } = req.body;
      
      // Mark single notification as read
      if (action === 'markRead') {
        const { notificationId, address } = req.body;
        
        if (!notificationId || !address) {
          return res.status(400).json({ success: false, error: 'Notification ID and address required' });
        }
        
        await sql`
          UPDATE artist_notifications 
          SET is_read = TRUE 
          WHERE id = ${notificationId} AND artist_address = ${address}
        `;
        
        return res.json({ success: true });
      }
      
      // Mark all notifications as read
      if (action === 'markAllRead') {
        const { address } = req.body;
        
        if (!address) {
          return res.status(400).json({ success: false, error: 'Address required' });
        }
        
        await sql`
          UPDATE artist_notifications 
          SET is_read = TRUE 
          WHERE artist_address = ${address} AND is_read = FALSE
        `;
        
        return res.json({ success: true });
      }
      
      // Create a notification (internal use - called from purchase flow, etc.)
      if (action === 'create') {
        const { artistAddress, type, title, message, releaseId, trackId, commentId, amount, senderAddress, senderName } = req.body;
        
        if (!artistAddress || !type || !title) {
          return res.status(400).json({ success: false, error: 'Artist address, type, and title required' });
        }
        
        const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await sql`
          INSERT INTO artist_notifications (id, artist_address, type, title, message, release_id, track_id, comment_id, amount, sender_address, sender_name, is_read, created_at)
          VALUES (${id}, ${artistAddress}, ${type}, ${title}, ${message || null}, ${releaseId || null}, ${trackId || null}, ${commentId || null}, ${amount || null}, ${senderAddress || null}, ${senderName || null}, false, NOW())
        `;
        
        return res.json({ success: true, notificationId: id });
      }
      
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    return res.status(405).json({ success: false, error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
