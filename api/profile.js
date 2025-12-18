/**
 * XRP Music - Profile API
 * Vercel Serverless Function
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      return await getProfile(req, res);
    } else if (req.method === 'POST') {
      return await saveProfile(req, res);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProfile(req, res) {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  const profiles = await sql`
    SELECT * FROM profiles WHERE address = ${address}
  `;
  
  if (profiles.length === 0) {
    return res.json({ profile: null });
  }
  
  return res.json({ profile: formatProfile(profiles[0]) });
}

async function saveProfile(req, res) {
  const { address, name, bio, avatarUrl, avatarCid, bannerUrl, bannerCid, website, twitter } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  // Upsert profile
  const [profile] = await sql`
    INSERT INTO profiles (
      address,
      name,
      bio,
      avatar_url,
      avatar_cid,
      banner_url,
      banner_cid,
      website,
      twitter,
      updated_at
    ) VALUES (
      ${address},
      ${name || null},
      ${bio || null},
      ${avatarUrl || null},
      ${avatarCid || null},
      ${bannerUrl || null},
      ${bannerCid || null},
      ${website || null},
      ${twitter || null},
      NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, profiles.name),
      bio = COALESCE(EXCLUDED.bio, profiles.bio),
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      avatar_cid = COALESCE(EXCLUDED.avatar_cid, profiles.avatar_cid),
      banner_url = COALESCE(EXCLUDED.banner_url, profiles.banner_url),
      banner_cid = COALESCE(EXCLUDED.banner_cid, profiles.banner_cid),
      website = COALESCE(EXCLUDED.website, profiles.website),
      twitter = COALESCE(EXCLUDED.twitter, profiles.twitter),
      updated_at = NOW()
    RETURNING *
  `;
  
  return res.json({ success: true, profile: formatProfile(profile) });
}

function formatProfile(row) {
  return {
    address: row.address,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    avatarCid: row.avatar_cid,
    bannerUrl: row.banner_url,
    bannerCid: row.banner_cid,
    website: row.website,
    twitter: row.twitter,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
