/**
 * XRP Music - Get Video Read URL
 * Generates short-lived presigned READ URLs for files in our fil.one bucket.
 *
 * Why this exists:
 *   fil.one doesn't yet support public bucket policies (Phase 2 feature).
 *   Files we PUT to the bucket can only be GET'd with a presigned URL.
 *   This endpoint generates one whenever a video player needs to load.
 *
 * Security:
 *   - Only allows reads of `videos/` and `thumbnails/` prefixes
 *   - URL expires after 6 hours (long enough for any feature film)
 *   - Same CORS allowlist as upload-video.js
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.FILONE_REGION,
  endpoint: process.env.FILONE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.FILONE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILONE_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_PREFIXES = ['videos/', 'thumbnails/'];
const URL_EXPIRY_SECONDS = 60 * 60 * 6; // 6 hours

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://xrpmusic.io',
    'https://www.xrpmusic.io',
    'https://music-x-three.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept key from either POST body or GET query string
    let key = req.method === 'POST' ? req.body?.key : req.query?.key;

    // Also accept a full URL — we'll extract the key from it
    if (!key && req.method === 'POST' && req.body?.url) {
      key = extractKeyFromUrl(req.body.url);
    } else if (!key && req.method === 'GET' && req.query?.url) {
      key = extractKeyFromUrl(req.query.url);
    }

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key (or url) required' });
    }

    // Strip leading slashes
    key = key.replace(/^\/+/, '');

    // Allowlist check — only let the API generate URLs for our own folders
    if (!ALLOWED_PREFIXES.some(p => key.startsWith(p))) {
      return res.status(400).json({
        error: `Key must start with one of: ${ALLOWED_PREFIXES.join(', ')}`,
      });
    }

    // Build the presigned GET URL
    const command = new GetObjectCommand({
      Bucket: process.env.FILONE_BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    res.status(200).json({
      success: true,
      url: signedUrl,
      key,
      expiresIn: URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error('❌ get-video-url failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Extract the S3 key from a full fil.one URL.
 * Example:
 *   https://eu-west-1.s3.fil.one/xrpmusic/videos/123_file.mp4
 *   →  videos/123_file.mp4
 */
function extractKeyFromUrl(url) {
  if (typeof url !== 'string') return null;
  const bucket = process.env.FILONE_BUCKET || 'xrpmusic';
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}
