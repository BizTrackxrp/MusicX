/**
 * XRP Music - Profile Image Upload
 * Uploads avatar/banner images to Vercel Blob (fast CDN)
 * 
 * NOT for NFT media — use Lighthouse/IPFS for that.
 * This is for profile pics and banners only.
 */

import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data
  },
};

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form
    const form = new IncomingForm({
      maxFileSize: MAX_SIZE_BYTES,
      keepExtensions: true,
    });

    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate type
    const mimeType = file.mimetype || file.type || '';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Invalid file type. Use JPG, PNG, GIF, or WebP.' });
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: 'File too large. Maximum 5MB.' });
    }

    // Read file buffer
    const buffer = fs.readFileSync(file.filepath || file.path);

    // Generate a clean filename: profile-images/<timestamp>-<random>.<ext>
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `profile-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    // Clean up temp file
    try { fs.unlinkSync(file.filepath || file.path); } catch {}

    return res.status(200).json({
      success: true,
      url: blob.url,
    });

  } catch (err) {
    console.error('upload-image error:', err);

    if (err.message?.includes('maxFileSize')) {
      return res.status(400).json({ error: 'File too large. Maximum 5MB.' });
    }

    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
}
