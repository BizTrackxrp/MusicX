/**
 * XRP Music - Video Streaming Proxy (fil.one / S3)
 *
 * WHY THIS EXISTS:
 *   Browsers hitting https://eu-west-1.s3.fil.one/... directly fail with
 *   net::ERR_SSL_PROTOCOL_ERROR. Our SERVER can reach fil.one fine, so we
 *   fetch the bytes server-side and pipe them back through our own domain.
 *
 * v3 FIX (signature lost in transit / 403 / 502):
 *   A presigned URL contains '&' params (X-Amz-Signature, x-id=GetObject...).
 *   When passed as /api/stream-video?u=<signedUrl>, those '&' collided with
 *   the proxy's own query string and the signature got truncated — fil.one
 *   then returned 403, surfacing as a 502 here.
 *
 *   FIX: we do NOT pass a signed URL through the browser at all. We pass only
 *   the S3 KEY (e.g. videos/123_file.mov), which contains no '&' and no
 *   signature. This proxy signs the GET request ITSELF, server-side, using the
 *   same fil.one credentials as get-video-url.js, then fetches the bytes.
 *
 * USAGE (GET so it can be a <video src>):
 *   /api/stream-video?key=videos/123_file.mov
 *   (Backwards compatible: also accepts ?u=<full fil.one url>, key extracted from it.)
 *
 * SECURITY:
 *   Only signs keys under videos/ or thumbnails/ (same allowlist as get-video-url).
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
const URL_EXPIRY_SECONDS = 60 * 60; // 1 hour is plenty for a single stream

const EXT_MAP = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

function resolveVideoContentType(gatewayType, key) {
  const gType = (gatewayType || '').toLowerCase().split(';')[0].trim();
  const generic =
    gType === '' ||
    gType === 'application/octet-stream' ||
    gType === 'binary/octet-stream';

  const lower = (key || '').toLowerCase();
  const ext = Object.keys(EXT_MAP).find((e) => lower.includes(e));

  if (ext) {
    if (generic || !gType.startsWith('video/')) return EXT_MAP[ext];
    return gType;
  }
  if (gType.startsWith('video/')) return gType;
  return 'video/mp4';
}

function extractKeyFromUrl(url) {
  if (typeof url !== 'string') return null;
  const bucket = process.env.FILONE_BUCKET || 'xrpmusic';
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  // Cut off any query string (signature) — we only want the key path.
  return url.substring(idx + marker.length).split('?')[0];
}

export default async function handler(req, res) {
  // Accept ?key= directly, or ?u=<full url> and extract the key from it.
  let key = req.query.key || null;
  if (!key && req.query.u) {
    let u = req.query.u;
    if (/%[0-9a-fA-F]{2}/.test(u)) {
      try { u = decodeURIComponent(u); } catch (e) {}
    }
    key = extractKeyFromUrl(u);
  }

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'key (or u) required' });
  }

  key = key.replace(/^\/+/, '');

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return res.status(400).json({
      error: `Key must start with one of: ${ALLOWED_PREFIXES.join(', ')}`,
    });
  }

  const rangeHeader = req.headers.range;

  try {
    // Sign a fresh GET URL server-side — signature never touches the browser.
    const command = new GetObjectCommand({
      Bucket: process.env.FILONE_BUCKET,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    const fetchHeaders = { 'User-Agent': 'XRPMusic/1.0' };
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    const upstream = await fetch(signedUrl, { headers: fetchHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      console.error('stream-video upstream error:', upstream.status, text.slice(0, 300));
      return res.status(502).json({ error: 'Upstream fetch failed', status: upstream.status });
    }

    const upstreamType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    const contentType = resolveVideoContentType(upstreamType, key);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (upstream.status === 206 && contentRange) {
      res.setHeader('Content-Range', contentRange);
      res.status(206);
    } else {
      res.status(200);
    }

    if (upstream.body && typeof upstream.body.getReader === 'function') {
      const reader = upstream.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      return res.end();
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.end(buf);
  } catch (error) {
    console.error('stream-video error:', error.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Stream failed', details: error.message });
    }
    try { res.end(); } catch (e) {}
  }
}
