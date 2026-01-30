import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  if (req.method === 'POST') {
    // Create a new gift
    const { senderAddress, recipientAddress, releaseId, trackId } = req.body;
    
    if (!senderAddress || !recipientAddress || !releaseId || !trackId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    try {
      // Verify sender owns this release
      const [release] = await sql`
        SELECT id, artist_address, total_editions 
        FROM releases 
        WHERE id = ${releaseId} AND artist_address = ${senderAddress}
      `;
      
      if (!release) {
        return res.status(403).json({ success: false, error: 'You can only gift from your own releases' });
      }
      
      // Check track availability
      const [track] = await sql`
        SELECT id, sold_count FROM tracks WHERE id = ${trackId} AND release_id = ${releaseId}
      `;
      
      if (!track) {
        return res.status(404).json({ success: false, error: 'Track not found' });
      }
      
      const soldCount = track.sold_count || 0;
      const available = release.total_editions - soldCount;
      
      if (available <= 0) {
        return res.status(400).json({ success: false, error: 'No editions available to gift' });
      }
      
      // Create gift record
      const [gift] = await sql`
        INSERT INTO gifts (sender_address, recipient_address, release_id, track_id, status)
        VALUES (${senderAddress}, ${recipientAddress}, ${releaseId}, ${trackId}, 'pending')
        RETURNING id, created_at
      `;
      
      // Increment the gifted count (we'll add this column if needed)
      // For now, we'll track via the gifts table
      
      // TODO: Create notification for recipient
      // TODO: Trigger lazy mint when recipient accepts
      
      return res.status(200).json({ 
        success: true, 
        giftId: gift.id,
        message: 'Gift created successfully'
      });
      
    } catch (error) {
      console.error('Gift creation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  if (req.method === 'GET') {
    // Get gifts for a user (as sender or recipient)
    const { address, type } = req.query;
    
    if (!address) {
      return res.status(400).json({ success: false, error: 'Address required' });
    }
    
    try {
      let gifts;
      
      if (type === 'sent') {
        gifts = await sql`
          SELECT g.*, r.title as release_title, r.cover_url, t.title as track_title
          FROM gifts g
          JOIN releases r ON g.release_id = r.id
          JOIN tracks t ON g.track_id = t.id
          WHERE g.sender_address = ${address}
          ORDER BY g.created_at DESC
        `;
      } else if (type === 'received') {
        gifts = await sql`
          SELECT g.*, r.title as release_title, r.cover_url, r.artist_name, t.title as track_title
          FROM gifts g
          JOIN releases r ON g.release_id = r.id
          JOIN tracks t ON g.track_id = t.id
          WHERE g.recipient_address = ${address}
          ORDER BY g.created_at DESC
        `;
      } else {
        // Both
        gifts = await sql`
          SELECT g.*, r.title as release_title, r.cover_url, r.artist_name, t.title as track_title
          FROM gifts g
          JOIN releases r ON g.release_id = r.id
          JOIN tracks t ON g.track_id = t.id
          WHERE g.sender_address = ${address} OR g.recipient_address = ${address}
          ORDER BY g.created_at DESC
        `;
      }
      
      return res.status(200).json({ success: true, gifts });
      
    } catch (error) {
      console.error('Get gifts error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
