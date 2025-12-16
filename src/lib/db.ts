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

  // Create index for faster artist lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_releases_artist ON releases(artist_address)
  `;

  return { success: true };
}

// Profile functions
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
}) {
  const sql = getDb();
  
  await sql`
    INSERT INTO profiles (
      wallet_address, name, bio, avatar_url, banner_url,
      page_theme, accent_color, gradient_start, gradient_end, gradient_angle
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
      ${profile.gradientAngle || 135}
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
      updated_at = CURRENT_TIMESTAMP
  `;
  
  return { success: true };
}

// Release functions
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

// Helper to format database row to frontend format
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
