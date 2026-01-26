/**
 * XRP Music - Search API
 * Vercel Serverless Function
 * 
 * Searches across artists, tracks, and albums
 * Returns categorized results for the search dropdown
 */

import { neon } from '@neondatabase/serverless';

// Helper for address truncation (server-side)
function truncateAddress(address, start = 6, end = 4) {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ artists: [], tracks: [], albums: [], singles: [], releases: [] });
    }
    
    const query = q.trim().toLowerCase();
    const searchPattern = `%${query}%`;
    const limitNum = Math.min(parseInt(limit) || 10, 20);
    
    // Search artists - from releases with optional profile join
    const artists = await sql`
      SELECT 
        r.artist_address as address,
        COALESCE(p.name, r.artist_name) as name,
        p.avatar_url as avatar,
        p.bio,
        COUNT(DISTINCT r.id) as release_count
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND (
          LOWER(COALESCE(p.name, r.artist_name, '')) LIKE ${searchPattern}
          OR LOWER(r.artist_address) LIKE ${searchPattern}
        )
      GROUP BY r.artist_address, p.name, r.artist_name, p.avatar_url, p.bio
      ORDER BY COUNT(DISTINCT r.id) DESC
      LIMIT ${limitNum}
    `;
    
    // Search tracks
    const tracks = await sql`
      SELECT 
        t.id,
        t.title,
        t.duration,
        t.audio_cid,
        t.audio_url,
        r.id as release_id,
        r.title as release_title,
        r.cover_url,
        r.artist_address,
        COALESCE(p.name, r.artist_name) as artist_name,
        r.song_price,
        r.type as release_type,
        p.avatar_url as artist_avatar
      FROM tracks t
      JOIN releases r ON r.id = t.release_id
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND LOWER(t.title) LIKE ${searchPattern}
      ORDER BY t.title
      LIMIT ${limitNum}
    `;
    
    // Search albums (releases with type = 'album')
    const albums = await sql`
      SELECT 
        r.id,
        r.title,
        r.cover_url,
        r.artist_address,
        COALESCE(p.name, r.artist_name) as artist_name,
        r.album_price,
        r.song_price,
        r.total_editions,
        r.type,
        r.created_at,
        p.avatar_url as artist_avatar,
        (SELECT COUNT(*) FROM tracks WHERE release_id = r.id) as track_count
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.type = 'album'
        AND LOWER(r.title) LIKE ${searchPattern}
      ORDER BY r.created_at DESC
      LIMIT ${limitNum}
    `;
    
    // Search singles (releases with type = 'single')
    const singles = await sql`
      SELECT 
        r.id,
        r.title,
        r.cover_url,
        r.artist_address,
        COALESCE(p.name, r.artist_name) as artist_name,
        r.song_price,
        r.total_editions,
        r.type,
        r.created_at,
        p.avatar_url as artist_avatar
      FROM releases r
      LEFT JOIN profiles p ON p.wallet_address = r.artist_address
      WHERE (r.is_minted = true OR r.mint_fee_paid = true OR r.status = 'live')
        AND r.type = 'single'
        AND LOWER(r.title) LIKE ${searchPattern}
      ORDER BY r.created_at DESC
      LIMIT ${limitNum}
    `;
    
    // Format results
    const formattedArtists = artists.map(a => ({
      type: 'artist',
      address: a.address,
      name: a.name || truncateAddress(a.address),
      avatar: a.avatar || null,
      bio: a.bio || null,
      releaseCount: parseInt(a.release_count) || 0
    }));
    
    const formattedTracks = tracks.map(t => ({
      type: 'track',
      id: t.id,
      title: t.title,
      duration: t.duration,
      audioCid: t.audio_cid,
      audioUrl: t.audio_url,
      releaseId: t.release_id,
      releaseTitle: t.release_title,
      coverUrl: t.cover_url,
      artistAddress: t.artist_address,
      artistName: t.artist_name,
      artistAvatar: t.artist_avatar || null,
      price: parseFloat(t.song_price) || 0,
      releaseType: t.release_type
    }));
    
    const formattedAlbums = albums.map(a => ({
      type: 'album',
      id: a.id,
      title: a.title,
      coverUrl: a.cover_url,
      artistAddress: a.artist_address,
      artistName: a.artist_name,
      artistAvatar: a.artist_avatar || null,
      price: parseFloat(a.album_price) || parseFloat(a.song_price) || 0,
      trackCount: parseInt(a.track_count) || 0,
      totalEditions: a.total_editions
    }));
    
    const formattedSingles = singles.map(s => ({
      type: 'single',
      id: s.id,
      title: s.title,
      coverUrl: s.cover_url,
      artistAddress: s.artist_address,
      artistName: s.artist_name,
      artistAvatar: s.artist_avatar || null,
      price: parseFloat(s.song_price) || 0,
      totalEditions: s.total_editions
    }));

    // Combined releases for backwards compatibility
    const allReleases = [...formattedAlbums, ...formattedSingles].map(r => ({
      id: r.id,
      title: r.title,
      coverUrl: r.coverUrl,
      artistAddress: r.artistAddress,
      artistName: r.artistName,
      songPrice: r.price,
      type: r.type
    }));
    
    return res.json({
      artists: formattedArtists,
      tracks: formattedTracks,
      albums: formattedAlbums,
      singles: formattedSingles,
      releases: allReleases,
      query: q
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
