/**
 * XRP Music - Profile API
 * Vercel Serverless Function
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
    if (req.method === 'GET') {
      const { address } = req.query;
      
      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }
      
      const profiles = await sql`
        SELECT * FROM profiles WHERE wallet_address = ${address}
      `;
      
      if (profiles.length === 0) {
        return res.json({ profile: null });
      }
      
      return res.json({ profile: formatProfile(profiles[0]) });
      
    } else if (req.method === 'POST') {
      const { 
        address, 
        name, 
        bio, 
        avatarUrl, 
        avatarCid, 
        bannerUrl, 
        bannerCid, 
        website, 
        twitter,
        genrePrimary,
        genreSecondary,
        isArtist
      } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }
      
      console.log('Saving profile:', { address, name, bio, website, twitter, genrePrimary, genreSecondary, isArtist });
      
      // Upsert profile - update ALL fields that are provided
      const [profile] = await sql`
        INSERT INTO profiles (
          wallet_address,
          name,
          bio,
          avatar_url,
          banner_url,
          website,
          twitter,
          genre_primary,
          genre_secondary,
          is_artist,
          updated_at
        ) VALUES (
          ${address},
          ${name || null},
          ${bio || null},
          ${avatarUrl || null},
          ${bannerUrl || null},
          ${website || null},
          ${twitter || null},
          ${genrePrimary || null},
          ${genreSecondary || null},
          ${isArtist || false},
          NOW()
        )
        ON CONFLICT (wallet_address) DO UPDATE SET
          name = ${name || null},
          bio = ${bio || null},
          avatar_url = CASE WHEN ${avatarUrl || null} IS NOT NULL THEN ${avatarUrl} ELSE profiles.avatar_url END,
          banner_url = CASE WHEN ${bannerUrl || null} IS NOT NULL THEN ${bannerUrl} ELSE profiles.banner_url END,
          website = ${website || null},
          twitter = ${twitter || null},
          genre_primary = ${genrePrimary || null},
          genre_secondary = ${genreSecondary || null},
          is_artist = COALESCE(${isArtist}, profiles.is_artist, false),
          updated_at = NOW()
        RETURNING *
      `;
      
      console.log('Profile saved:', profile);
      
      return res.json({ success: true, profile: formatProfile(profile) });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function formatProfile(row) {
  return {
    address: row.wallet_address,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    website: row.website,
    twitter: row.twitter,
    pageTheme: row.page_theme,
    accentColor: row.accent_color,
    gradientStart: row.gradient_start,
    gradientEnd: row.gradient_end,
    gradientAngle: row.gradient_angle,
    genrePrimary: row.genre_primary,
    genreSecondary: row.genre_secondary,
    isArtist: row.is_artist,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
