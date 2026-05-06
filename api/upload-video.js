/**
 * XRP Music - Video Upload to Filecoin S3
 * Generates presigned URLs for direct browser → Filecoin uploads
 * Bypasses Lighthouse completely for videos
 *
 * v2 GUARDS (added May 2026):
 * - Extension allowlist (.mp4, .mov, .m4v) — rejects junk before it reaches Filecoin
 * - Content-Type allowlist (video/mp4, video/quicktime)
 * - Filename length cap to prevent absurd keys
 *
 * The browser-side VideoValidator already does the heavy lifting (codec probe).
 * These server-side checks are belt-and-suspenders against direct API calls
 * that bypass the frontend validator.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.FILONE_REGION,
  endpoint: process.env.FILONE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.FILONE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILONE_SECRET_ACCESS_KEY,
  },
});

// ===== Allowlists =====
const ALLOWED_EXTENSIONS = new Set(['mp4', 'mov', 'm4v']);
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
]);
const MAX_FILENAME_LENGTH = 255;

function getExtension(name) {
  const m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export default async function handler(req, res) {
  // CORS
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

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileType } = req.body;

    // ===== Basic presence =====
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType required' });
    }

    // ===== Filename sanity =====
    if (typeof fileName !== 'string' || fileName.length > MAX_FILENAME_LENGTH) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // ===== Extension allowlist =====
    const ext = getExtension(fileName);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({
        error: `Unsupported video format ".${ext}". Please upload an MP4 or MOV file with H.264 video.`,
      });
    }

    // ===== Content-Type allowlist =====
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return res.status(400).json({
        error: `Unsupported content type "${fileType}". Allowed: video/mp4, video/quicktime.`,
      });
    }

    // ===== Build storage key =====
    const timestamp = Date.now();
    const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `videos/${timestamp}_${sanitized}`;

    // ===== Generate presigned URL =====
    const command = new PutObjectCommand({
      Bucket: process.env.FILONE_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    const publicUrl = `${process.env.FILONE_ENDPOINT}/${process.env.FILONE_BUCKET}/${key}`;

    console.log('✅ Generated Filecoin upload URL for:', fileName);

    res.status(200).json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    console.error('❌ Filecoin upload URL generation failed:', error);
    res.status(500).json({ error: error.message });
  }
}
