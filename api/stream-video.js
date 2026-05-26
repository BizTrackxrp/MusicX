/**
 * XRP Music - Video Streaming Proxy (fil.one / S3)
 *
 * WHY THIS EXISTS:
 *   Browsers hitting https://eu-west-1.s3.fil.one/... directly fail with
 *   net::ERR_SSL_PROTOCOL_ERROR — the TLS handshake from the browser to
 *   fil.one's S3 endpoint is broken. Our SERVER can reach fil.one fine
 *   (it's how we generate presigned URLs), so we fetch the bytes
 *   server-side and pipe them back through our own domain.
 *
 * This is the same strategy that makes music videos work via /api/ipfs/[cid].
 *
 * USAGE (GET so it can be used directly as a <video src>):
 *   /api/stream-video?u=<URL-ENCODED presigned fil.one URL>
 *
 * SECURITY:
 *   Only proxies URLs whose host ends in .fil.one (prevents this becoming
 *   an open proxy for arbitrary URLs).
 *
 * FEATURES:
 *   - Forwards Range header (seeking works)
 *   - Returns 206 Partial Content when appropriate
 *   - Forces a correct video/mp4 Content-Type (iOS Safari refuses octet-stream)
 *   - Streams the response body (no full-file buffering in memory)
 */

const ALLOWED_HOST_SUFFIX = '.fil.one';

const EXT_MAP = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

function resolveVideoContentType(gatewayType, urlPath) {
  const gType = (gatewayType || '').toLowerCase().split(';')[0].trim();
  const generic =
    gType === '' ||
    gType === 'application/octet-stream' ||
    gType === 'binary/octet-stream';

  const lower = (urlPath || '').toLowerCase();
  const ext = Object.keys(EXT_MAP).find((e) => lower.includes(e));

  if (ext) {
    // If gateway type is generic or not a video/* type, use the extension's type.
    if (generic || !gType.startsWith('video/')) return EXT_MAP[ext];
    return gType;
  }

  // No extension we recognize. If gateway type is already video/*, keep it.
  if (gType.startsWith('video/')) return gType;

  // Last resort: assume mp4 (most common; lets iOS attempt playback).
  return 'video/mp4';
}

export default async function handler(req, res) {
  const { u } = req.query;

  if (!u) {
    return res.status(400).json({ error: 'Missing url parameter (u)' });
  }

  let target;
  try {
    target = new URL(u);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow fil.one hosts — do NOT turn this into an open proxy.
  if (target.protocol !== 'https:' || !target.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return res.status(403).json({ error: 'URL host not allowed' });
  }

  const rangeHeader = req.headers.range;

  try {
    const fetchHeaders = {
      'User-Agent': 'XRPMusic/1.0',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(target.toString(), {
      headers: fetchHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      console.error('stream-video upstream error:', upstream.status, text.slice(0, 200));
      return res.status(502).json({
        error: 'Upstream fetch failed',
        status: upstream.status,
      });
    }

    const upstreamType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    const contentType = resolveVideoContentType(upstreamType, target.pathname);

    // Headers
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

    // Stream the body straight through (no full buffering).
    // Vercel Node runtime: upstream.body is a web ReadableStream.
    if (upstream.body && typeof upstream.body.getReader === 'function') {
      const reader = upstream.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // value is a Uint8Array
        if (!res.write(Buffer.from(value))) {
          // Respect backpressure
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      return res.end();
    }

    // Fallback if body isn't a stream for some reason
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.end(buf);
  } catch (error) {
    console.error('stream-video error:', error.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Stream failed', details: error.message });
    }
    try {
      res.end();
    } catch (e) {}
  }
}
