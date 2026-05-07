/**
 * XRP Music - Upload to Filecoin S3
 * Generates presigned URLs for direct browser → Filecoin uploads
 *
 * Handles BOTH:
 *   - Videos (.mp4, .mov, .m4v) → /videos/ folder
 *   - Images (.jpg, .png, .webp, .gif) → /thumbnails/ folder
 *
 * v4 FIXES (May 2026):
 * ✅ forcePathStyle: true — fil.one requires path-style URLs
 *    Without this, SDK builds URLs like https://xrpmusic.eu-west-1.s3.fil.one/...
 *    which doesn't resolve in DNS. With it, URLs are
 *    https://eu-west-1.s3.fil.one/xrpmusic/... which works.
 * ✅ publicUrl construction also matches path-style format
 * ✅ Allowlist for video AND image extensions (thumbnails use same endpoint)
 * ✅ Routes images to a separate folder for organization
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.FILONE_REGION,
  endpoint: process.env.FILONE_ENDPOINT,
  forcePathStyle: true, // ← REQUIRED for fil.one
  credentials: {
    accessKeyId: process.env.FILONE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILONE_SECRET_ACCESS_KEY,
  },
});

// ===== Allowlists =====

const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v']);
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILENAME_LENGTH = 255;

function getExtension(name) {
  const m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function classifyFile(extension, mimeType) {
  if (ALLOWED_VIDEO_EXTENSIONS.has(extension) || ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
    return 'video';
  }
  if (ALLOWED_IMAGE_EXTENSIONS.has(extension) || ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return 'image';
  }
  return null;
}

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

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType required' });
    }

    if (typeof fileName !== 'string' || fileName.length > MAX_FILENAME_LENGTH) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const ext = getExtension(fileName);
    const kind = classifyFile(ext, fileType);

    if (!kind) {
      if (fileType?.startsWith('image/')) {
        return res.status(400).json({
          error: `Unsupported image format ".${ext}". Allowed: JPG, PNG, WebP, GIF.`,
        });
      }
      if (fileType?.startsWith('video/')) {
        return res.status(400).json({
          error: `Unsupported video format ".${ext}". Please upload an MP4 or MOV file with H.264 video.`,
        });
      }
      return res.status(400).json({
        error: `Unsupported file type ".${ext}" (${fileType}). Allowed: MP4/MOV videos, JPG/PNG/WebP/GIF images.`,
      });
    }

    const timestamp = Date.now();
    const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = kind === 'video' ? 'videos' : 'thumbnails';
    const key = `${folder}/${timestamp}_${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: process.env.FILONE_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    // With forcePathStyle: true, the SDK generates a URL like:
    //   https://eu-west-1.s3.fil.one/xrpmusic/videos/12345_file.mp4
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Public URL needs to match the same path-style structure
    const publicUrl = `${process.env.FILONE_ENDPOINT}/${process.env.FILONE_BUCKET}/${key}`;

    console.log(`✅ Generated Filecoin upload URL [${kind}]:`, fileName, '→', key);

    res.status(200).json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
      kind,
    });
  } catch (error) {
    console.error('❌ Filecoin upload URL generation failed:', error);
    res.status(500).json({ error: error.message });
  }
}
