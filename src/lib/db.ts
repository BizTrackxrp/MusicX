import { neon } from '@neondatabase/serverless';

// Get database connection
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

// Initialize database tables
export async function initDb() {
  const sql = getDb();
  
  // Create profiles table
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      wallet_address VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      bio TEXT,
      avatar_url TEXT,
      banner_url TEXT,
      page_theme VARCHAR(50) DEFAULT 'gradient',
      accent_color VARCHAR(50) DEFAULT '#3B82F6',
      gradient_start VARCHAR(50) DEFAULT '#0066FF',
      gradient_end VARCHAR(50) DEFAULT '#00D4FF',
      gradient_angle INTEGER DEFAULT 135,
      genres TEXT[], -- Array of up to 2 genres
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create releases table
  await sql`
    CREATE TABLE IF NOT EXISTS releases (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      artist_address VARCHAR(255) NOT NULL,
      artist_name VARCHAR(255),
      cover_url TEXT,
      cover_cid VARCHAR(255),
      song_price DECIMAL(10, 2),
      album_price DECIMAL(10, 2),
      total_editions INTEGER DEFAULT 100,
      sold_editions INTEGER DEFAULT 0,
      metadata_cid VARCHAR(255),
      tx_hash VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create tracks table
  await sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id VARCHAR(255) PRIMARY KEY,
      release_id VARCHAR(255) REFERENCES releases(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      audio_url TEXT,
      audio_cid VARCHAR(255),
      duration INTEGER,
      track_order INTEGER DEFAULT 0,
      nft_token_id VARCHAR(255)
    )
  `;

  // Create playlists table
  await sql`
    CREATE TABLE IF NOT EXISTS playlists (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      owner_address VARCHAR(255) NOT NULL,
      cover_url TEXT,
      is_public BOOLEAN DEFAULT false,
      likes_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create playlist_tracks table (tracks in a playlist)
  await sql`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id VARCHAR(255) PRIMARY KEY,
      playlist_id VARCHAR(255) REFERENCES playlists(id) ON DELETE CASCADE,
      track_id VARCHAR(255) NOT NULL,
      release_id VARCHAR(255) NOT NULL,
      position INTEGER NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create playlist_likes table (who liked which playlist)
  await sql`
    CREATE TABLE IF NOT EXISTS playlist_likes (
      playlist_id VARCHAR(255) REFERENCES playlists(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (playlist_id, user_address)
    )
  `;

  // Create liked_tracks table (user's liked/favorited tracks)
  await sql`
    CREATE TABLE IF NOT EXISTS liked_tracks (
      user_address VARCHAR(255) NOT NULL,
      track_id VARCHAR(255) NOT NULL,
      release_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_address, track_id)
    )
  `;

  // Create indexes for faster lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_artist ON releases(artist_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_liked_tracks_user ON liked_tracks(user_address)`;

  return { success: true };
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

export async function getProfile(walletAddress: string) {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM profiles WHERE wallet_address = ${walletAddress}
  `;
  return result[0] || null;
}

export async function saveProfile(profile: {
  walletAddress: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pageTheme?: string;
  accentColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  genres?: string[];
}) {
  const sql = getDb();
  
  await sql`
    INSERT INTO profiles (
      wallet_address, name, bio, avatar_url, banner_url,
      page_theme, accent_color, gradient_start, gradient_end, gradient_angle, genres
    ) VALUES (
      ${profile.walletAddress},
      ${profile.name || null},
      ${profile.bio || null},
      ${profile.avatarUrl || null},
      ${profile.bannerUrl || null},
      ${profile.pageTheme || 'gradient'},
      ${profile.accentColor || '#3B82F6'},
      ${profile.gradientStart || '#0066FF'},
      ${profile.gradientEnd || '#00D4FF'},
      ${profile.gradientAngle || 135},
      ${profile.genres || null}
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      name = EXCLUDED.name,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      banner_url = EXCLUDED.banner_url,
      page_theme = EXCLUDED.page_theme,
      accent_color = EXCLUDED.accent_color,
      gradient_start = EXCLUDED.gradient_start,
      gradient_end = EXCLUDED.gradient_end,
      gradient_angle = EXCLUDED.gradient_angle,
      genres = EXCLUDED.genres,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  return { success: true };
}

// ============================================
// RELEASE FUNCTIONS
// ============================================

export async function getAllReleases() {
  const sql = getDb();
  
  const releases = await sql`
    SELECT r.*, 
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'audioUrl', t.audio_url,
            'audioCid', t.audio_cid,
            'duration', t.duration,
            'nftTokenId', t.nft_token_id
          ) ORDER BY t.track_order
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as tracks
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  
  return releases.map(formatRelease);
}

export async function getReleasesByArtist(artistAddress: string) {
  const sql = getDb();
  
  const releases = await sql`
    SELECT r.*, 
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'audioUrl', t.audio_url,
            'audioCid', t.audio_cid,
            'duration', t.duration,
            'nftTokenId', t.nft_token_id
          ) ORDER BY t.track_order
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as tracks
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    WHERE r.artist_address = ${artistAddress}
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  
  return releases.map(formatRelease);
}

export async function getReleaseById(id: string) {
  const sql = getDb();
  
  const releases = await sql`
    SELECT r.*, 
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'audioUrl', t.audio_url,
            'audioCid', t.audio_cid,
            'duration', t.duration,
            'nftTokenId', t.nft_token_id
          ) ORDER BY t.track_order
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as tracks
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    WHERE r.id = ${id}
    GROUP BY r.id
  `;
  
  return releases[0] ? formatRelease(releases[0]) : null;
}

export async function searchReleases(query: string) {
  const sql = getDb();
  const searchTerm = `%${query}%`;
  
  const releases = await sql`
    SELECT r.*, 
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'audioUrl', t.audio_url,
            'audioCid', t.audio_cid,
            'duration', t.duration,
            'nftTokenId', t.nft_token_id
          ) ORDER BY t.track_order
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as tracks
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    WHERE r.title ILIKE ${searchTerm}
      OR r.artist_name ILIKE ${searchTerm}
      OR t.title ILIKE ${searchTerm}
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 50
  `;
  
  return releases.map(formatRelease);
}

export async function saveRelease(release: {
  id: string;
  type: string;
  title: string;
  description?: string;
  artistAddress: string;
  artistName?: string;
  coverUrl?: string;
  coverCid?: string;
  songPrice?: number;
  albumPrice?: number;
  totalEditions?: number;
  soldEditions?: number;
  metadataCid?: string;
  txHash?: string;
  tracks: {
    id: string;
    title: string;
    audioUrl?: string;
    audioCid?: string;
    duration?: number;
    nftTokenId?: string;
  }[];
}) {
  const sql = getDb();
  
  // Insert release
  await sql`
    INSERT INTO releases (
      id, type, title, description, artist_address, artist_name,
      cover_url, cover_cid, song_price, album_price,
      total_editions, sold_editions, metadata_cid, tx_hash
    ) VALUES (
      ${release.id},
      ${release.type},
      ${release.title},
      ${release.description || null},
      ${release.artistAddress},
      ${release.artistName || null},
      ${release.coverUrl || null},
      ${release.coverCid || null},
      ${release.songPrice || null},
      ${release.albumPrice || null},
      ${release.totalEditions || 100},
      ${release.soldEditions || 0},
      ${release.metadataCid || null},
      ${release.txHash || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      sold_editions = EXCLUDED.sold_editions,
      tx_hash = EXCLUDED.tx_hash
  `;
  
  // Insert tracks
  for (let i = 0; i < release.tracks.length; i++) {
    const track = release.tracks[i];
    await sql`
      INSERT INTO tracks (
        id, release_id, title, audio_url, audio_cid, duration, track_order, nft_token_id
      ) VALUES (
        ${track.id},
        ${release.id},
        ${track.title},
        ${track.audioUrl || null},
        ${track.audioCid || null},
        ${track.duration || null},
        ${i},
        ${track.nftTokenId || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        audio_url = EXCLUDED.audio_url,
        nft_token_id = EXCLUDED.nft_token_id
    `;
  }
  
  return { success: true };
}

// ============================================
// PLAYLIST FUNCTIONS
// ============================================

export async function createPlaylist(playlist: {
  id: string;
  name: string;
  description?: string;
  ownerAddress: string;
  coverUrl?: string;
  isPublic?: boolean;
}) {
  const sql = getDb();
  
  await sql`
    INSERT INTO playlists (id, name, description, owner_address, cover_url, is_public)
    VALUES (
      ${playlist.id},
      ${playlist.name},
      ${playlist.description || null},
      ${playlist.ownerAddress},
      ${playlist.coverUrl || null},
      ${playlist.isPublic || false}
    )
  `;
  
  return { success: true };
}

export async function updatePlaylist(playlistId: string, ownerAddress: string, updates: {
  name?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
}) {
  const sql = getDb();
  
  // Verify ownership
  const existing = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}`;
  if (existing.length === 0) {
    throw new Error('Playlist not found or not owned by user');
  }
  
  await sql`
    UPDATE playlists SET
      name = COALESCE(${updates.name}, name),
      description = COALESCE(${updates.description}, description),
      cover_url = COALESCE(${updates.coverUrl}, cover_url),
      is_public = COALESCE(${updates.isPublic}, is_public),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
  `;
  
  return { success: true };
}

export async function deletePlaylist(playlistId: string, ownerAddress: string) {
  const sql = getDb();
  
  await sql`
    DELETE FROM playlists 
    WHERE id = ${playlistId} AND owner_address = ${ownerAddress}
  `;
  
  return { success: true };
}

export async function getPlaylistsByUser(ownerAddress: string) {
  const sql = getDb();
  
  const playlists = await sql`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
    FROM playlists p
    WHERE p.owner_address = ${ownerAddress}
    ORDER BY p.updated_at DESC
  `;
  
  return playlists.map(formatPlaylist);
}

export async function getPlaylistById(playlistId: string) {
  const sql = getDb();
  
  const playlists = await sql`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
    FROM playlists p
    WHERE p.id = ${playlistId}
  `;
  
  return playlists[0] ? formatPlaylist(playlists[0]) : null;
}

export async function getPlaylistWithTracks(playlistId: string) {
  const sql = getDb();
  
  // Get playlist
  const playlists = await sql`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
    FROM playlists p
    WHERE p.id = ${playlistId}
  `;
  
  if (playlists.length === 0) return null;
  
  // Get tracks with release info
  const tracks = await sql`
    SELECT pt.*, t.title as track_title, t.audio_url, t.audio_cid, t.duration,
      r.id as release_id, r.title as release_title, r.artist_name, r.artist_address, r.cover_url, r.song_price,
      r.total_editions, r.sold_editions
    FROM playlist_tracks pt
    JOIN tracks t ON t.id = pt.track_id
    JOIN releases r ON r.id = pt.release_id
    WHERE pt.playlist_id = ${playlistId}
    ORDER BY pt.position ASC
  `;
  
  return {
    ...formatPlaylist(playlists[0]),
    tracks: tracks.map(t => ({
      id: t.id,
      trackId: t.track_id,
      releaseId: t.release_id,
      position: t.position,
      title: t.track_title,
      releaseTitle: t.release_title,
      artistName: t.artist_name,
      artistAddress: t.artist_address,
      coverUrl: t.cover_url,
      audioUrl: t.audio_url,
      audioCid: t.audio_cid,
      duration: t.duration,
      songPrice: Number(t.song_price),
      totalEditions: t.total_editions,
      soldEditions: t.sold_editions,
    }))
  };
}

export async function getPublicPlaylists(sortBy: 'newest' | 'popular' = 'newest', limit = 20) {
  const sql = getDb();
  
  const orderClause = sortBy === 'popular' ? 'p.likes_count DESC' : 'p.created_at DESC';
  
  const playlists = await sql`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
      pr.name as owner_name, pr.avatar_url as owner_avatar
    FROM playlists p
    LEFT JOIN profiles pr ON pr.wallet_address = p.owner_address
    WHERE p.is_public = true
    ORDER BY ${sortBy === 'popular' ? sql`p.likes_count DESC` : sql`p.created_at DESC`}
    LIMIT ${limit}
  `;
  
  return playlists.map(p => ({
    ...formatPlaylist(p),
    ownerName: p.owner_name,
    ownerAvatar: p.owner_avatar,
  }));
}

export async function addTrackToPlaylist(playlistId: string, ownerAddress: string, trackId: string, releaseId: string) {
  const sql = getDb();
  
  // Verify ownership
  const existing = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}`;
  if (existing.length === 0) {
    throw new Error('Playlist not found or not owned by user');
  }
  
  // Get next position
  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_tracks WHERE playlist_id = ${playlistId}`;
  const nextPosition = (maxPos[0]?.max_pos ?? -1) + 1;
  
  const id = Math.random().toString(36).substr(2, 9);
  
  await sql`
    INSERT INTO playlist_tracks (id, playlist_id, track_id, release_id, position)
    VALUES (${id}, ${playlistId}, ${trackId}, ${releaseId}, ${nextPosition})
    ON CONFLICT DO NOTHING
  `;
  
  // Update playlist timestamp
  await sql`UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ${playlistId}`;
  
  return { success: true };
}

export async function removeTrackFromPlaylist(playlistId: string, ownerAddress: string, playlistTrackId: string) {
  const sql = getDb();
  
  // Verify ownership
  const existing = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}`;
  if (existing.length === 0) {
    throw new Error('Playlist not found or not owned by user');
  }
  
  await sql`DELETE FROM playlist_tracks WHERE id = ${playlistTrackId} AND playlist_id = ${playlistId}`;
  
  // Re-order remaining tracks
  const remainingTracks = await sql`SELECT id FROM playlist_tracks WHERE playlist_id = ${playlistId} ORDER BY position`;
  for (let i = 0; i < remainingTracks.length; i++) {
    await sql`UPDATE playlist_tracks SET position = ${i} WHERE id = ${remainingTracks[i].id}`;
  }
  
  return { success: true };
}

export async function reorderPlaylistTracks(playlistId: string, ownerAddress: string, trackIds: string[]) {
  const sql = getDb();
  
  // Verify ownership
  const existing = await sql`SELECT * FROM playlists WHERE id = ${playlistId} AND owner_address = ${ownerAddress}`;
  if (existing.length === 0) {
    throw new Error('Playlist not found or not owned by user');
  }
  
  // Update positions
  for (let i = 0; i < trackIds.length; i++) {
    await sql`UPDATE playlist_tracks SET position = ${i} WHERE id = ${trackIds[i]} AND playlist_id = ${playlistId}`;
  }
  
  return { success: true };
}

// ============================================
// PLAYLIST LIKES FUNCTIONS
// ============================================

export async function likePlaylist(playlistId: string, userAddress: string) {
  const sql = getDb();
  
  await sql`
    INSERT INTO playlist_likes (playlist_id, user_address)
    VALUES (${playlistId}, ${userAddress})
    ON CONFLICT DO NOTHING
  `;
  
  // Update likes count
  await sql`
    UPDATE playlists SET likes_count = (
      SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = ${playlistId}
    ) WHERE id = ${playlistId}
  `;
  
  return { success: true };
}

export async function unlikePlaylist(playlistId: string, userAddress: string) {
  const sql = getDb();
  
  await sql`DELETE FROM playlist_likes WHERE playlist_id = ${playlistId} AND user_address = ${userAddress}`;
  
  // Update likes count
  await sql`
    UPDATE playlists SET likes_count = (
      SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = ${playlistId}
    ) WHERE id = ${playlistId}
  `;
  
  return { success: true };
}

export async function hasUserLikedPlaylist(playlistId: string, userAddress: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT 1 FROM playlist_likes WHERE playlist_id = ${playlistId} AND user_address = ${userAddress}
  `;
  return result.length > 0;
}

// ============================================
// LIKED TRACKS FUNCTIONS
// ============================================

export async function likeTrack(userAddress: string, trackId: string, releaseId: string) {
  const sql = getDb();
  
  await sql`
    INSERT INTO liked_tracks (user_address, track_id, release_id)
    VALUES (${userAddress}, ${trackId}, ${releaseId})
    ON CONFLICT DO NOTHING
  `;
  
  return { success: true };
}

export async function unlikeTrack(userAddress: string, trackId: string) {
  const sql = getDb();
  
  await sql`DELETE FROM liked_tracks WHERE user_address = ${userAddress} AND track_id = ${trackId}`;
  
  return { success: true };
}

export async function getLikedTracks(userAddress: string) {
  const sql = getDb();
  
  const tracks = await sql`
    SELECT lt.*, t.title as track_title, t.audio_url, t.audio_cid, t.duration,
      r.id as release_id, r.title as release_title, r.artist_name, r.artist_address, r.cover_url, r.song_price,
      r.total_editions, r.sold_editions, r.type as release_type
    FROM liked_tracks lt
    JOIN tracks t ON t.id = lt.track_id
    JOIN releases r ON r.id = lt.release_id
    WHERE lt.user_address = ${userAddress}
    ORDER BY lt.created_at DESC
  `;
  
  return tracks.map(t => ({
    trackId: t.track_id,
    releaseId: t.release_id,
    title: t.track_title,
    releaseTitle: t.release_title,
    releaseType: t.release_type,
    artistName: t.artist_name,
    artistAddress: t.artist_address,
    coverUrl: t.cover_url,
    audioUrl: t.audio_url,
    audioCid: t.audio_cid,
    duration: t.duration,
    songPrice: Number(t.song_price),
    totalEditions: t.total_editions,
    soldEditions: t.sold_editions,
    likedAt: t.created_at,
  }));
}

export async function isTrackLiked(userAddress: string, trackId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT 1 FROM liked_tracks WHERE user_address = ${userAddress} AND track_id = ${trackId}
  `;
  return result.length > 0;
}

export async function getUserLikedTrackIds(userAddress: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT track_id FROM liked_tracks WHERE user_address = ${userAddress}
  `;
  return result.map(r => r.track_id as string);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRelease(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    description: row.description as string,
    artistAddress: row.artist_address as string,
    artistName: row.artist_name as string,
    coverUrl: row.cover_url as string,
    coverCid: row.cover_cid as string,
    songPrice: Number(row.song_price),
    albumPrice: Number(row.album_price),
    totalEditions: row.total_editions as number,
    soldEditions: row.sold_editions as number,
    metadataCid: row.metadata_cid as string,
    txHash: row.tx_hash as string,
    createdAt: row.created_at as string,
    tracks: row.tracks as Array<{
      id: string;
      title: string;
      audioUrl: string;
      audioCid: string;
      duration: number;
      nftTokenId: string;
    }>,
  };
}

function formatPlaylist(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    ownerAddress: row.owner_address as string,
    coverUrl: row.cover_url as string | null,
    isPublic: row.is_public as boolean,
    likesCount: row.likes_count as number,
    trackCount: row.track_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
