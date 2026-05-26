/**
 * XRP Music - Video Streaming Proxy (fil.one / S3)
 *
 * WHY THIS EXISTS:
 *   Browsers hitting https://eu-west-1.s3.fil.one/... directly fail with
 *   net::ERR_SSL_PROTOCOL_ERROR. Our SERVER can reach fil.one fine, so we
 *   fetch the bytes server-side and pipe them back through our own domain.
 *
 * v2 FIX (403 AccessDenied):
 *   The presigned URL from fil.one contains a signature in its query string
 *   (X-Amz-Signature, x-id=GetObject, etc.). Re-parsing it through
 *   `new URL().toString()` re-encoded/reordered those params and BROKE the
 *   signature, causing 403 AccessDenied. We now:
 *     - decode the ?u= param exactly once
 *     - validate the host with a cheap regex (NOT a new URL round-trip)
 *     - fetch the decoded URL string AS-IS, signature intact
 *
 * USAGE (GET so it can be a <video src>):
 *   /api/stream-video?u=<URL-ENCODED presigned fil.one URL>
 *
 * SECURITY:
 *   Only proxies URLs whose host ends in .fil.one
 */

const ALLOWED_HOST_SUFFIX = '.fil.one';

const EXT_MAP = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

function resolveVideoContentType(gatewayType, urlString) {
  const gType = (gatewayType || '').toLowerCase().split(';')[0].trim();
  const generic =
    gType === '' ||
    gType === 'application/octet-stream' ||
    gType === 'binary/octet-stream';

  const pathPart = (urlString || '').split('?')[0].toLowerCase();
  const ext = Object.keys(EXT_MAP).find((e) => pathPart.includes(e));

  if (ext) {
    if (generic || !gType.startsWith('video/')) return EXT_MAP[ext];
    return gType;
  }

  if (gType.startsWith('video/')) return gType;

  return 'video/mp4';
}

/**
 * Extract the host without using new URL().toString() (which re-serializes
 * and can mangle a signed query string).
 */
function getHost(urlString) {
  const m = /^https:\/\/([^/?#]+)/i.exec(urlString);
  return m ? m[1].toLowerCase() : null;
}

export default async function handler(req, res) {
  const { u } = req.query;

  if (!u) {
    return res.status(400).json({ error: 'Missing url parameter (u)' });
  }

  // Decode exactly once. Vercel may already decode query params, so only
  // decode again if it still looks percent-encoded.
  let target = u;
  if (/%[0-9a-fA-F]{2}/.test(target)) {
    try {
      target = decodeURIComponent(target);
    } catch (e) {
      // keep as-is if decode fails
    }
  }

  const host = getHost(target);
  if (!target.toLowerCase().startsWith('https://') || !host || !host.endsWith(ALLOWED_HOST_SUFFIX)) {
    return res.status(403).json({ error: 'URL host not allowed', host: host || 'none' });
  }

  const rangeHeader = req.headers.range;

  try {
    const fetchHeaders = {
      'User-Agent': 'XRPMusic/1.0',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // Fetch the presigned URL EXACTLY as given — do NOT re-parse it.
    const upstream = await fetch(target, {
      headers: fetchHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      console.error('stream-video upstream error:', upstream.status, text.slice(0, 300));
      return res.status(502).json({
        error: 'Upstream fetch failed',
        status: upstream.status,
      });
    }

    const upstreamType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    const contentType = resolveVideoContentType(upstreamType, target);

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
    try {
      res.end();
    } catch (e) {}
  }
}
