/**
 * XRP Music - IPFS Proxy with Range Request Support
 * 
 * Proxies IPFS content through our domain to bypass security software
 * that blocks IPFS gateways directly.
 * 
 * NOW SUPPORTS:
 * - Range requests for audio/video seeking
 * - Proper Content-Length headers
 * - Accept-Ranges header
 * - Directory-style IPFS paths (e.g., bafyXXX/31.png)
 * 
 * Usage: /api/ipfs/[cid]
 * Example: /api/ipfs/QmZw9HdDHPZrvJwqrhfM9is3YaxSNLYvQUuav15LqMg
 * Example: /api/ipfs/bafybeiej3o.../31.png (directory-style, handled via rewrite)
 */

const GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];

// Cache for 1 day
const CACHE_DURATION = 86400;

export default async function handler(req, res) {
  // Get CID from path
  const { cid, path } = req.query;
  
  if (!cid) {
    return res.status(400).json({ error: 'Missing IPFS CID' });
  }
  
  // Validate CID format (basic check - just the CID part)
  if (!/^Qm[a-zA-Z0-9]{44}$|^bafy[a-zA-Z0-9]{50,}$/.test(cid)) {
    return res.status(400).json({ error: 'Invalid IPFS CID format' });
  }
  
  // Support directory-style paths (e.g., bafybeiej.../31.png)
  const ipfsPath = path ? `${cid}/${path}` : cid;
  
  // Check for Range header (for seeking in audio/video)
  const rangeHeader = req.headers.range;
  
  // Try each gateway until one works
  let lastError = null;
  
  for (const gateway of GATEWAYS) {
    try {
      // Build request headers
      const fetchHeaders = {
        'User-Agent': 'XRPMusic/1.0',
      };
      
      // Forward Range header if present
      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }
      
      const response = await fetch(`${gateway}${ipfsPath}`, {
        headers: fetchHeaders,
      });
      
      if (!response.ok && response.status !== 206) {
        lastError = `${gateway} returned ${response.status}`;
        continue;
      }
      
      // Get content info from response headers
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      const acceptRanges = response.headers.get('accept-ranges');
      
      // Get the content as buffer
      const buffer = await response.arrayBuffer();
      
      // Set caching headers
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION}, immutable`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-IPFS-Gateway', gateway);
      
      // IMPORTANT: Enable range requests for seeking
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Set content length
      if (contentLength) {
        res.setHeader('Content-Length', buffer.byteLength);
      }
      
      // Handle Range response (206 Partial Content)
      if (response.status === 206 && contentRange) {
        res.setHeader('Content-Range', contentRange);
        res.status(206);
        return res.send(Buffer.from(buffer));
      }
      
      // Regular response (200 OK)
      res.status(200);
      return res.send(Buffer.from(buffer));
      
    } catch (error) {
      lastError = `${gateway}: ${error.message}`;
      continue;
    }
  }
  
  // All gateways failed
  console.error('All IPFS gateways failed:', lastError);
  return res.status(502).json({ 
    error: 'Failed to fetch from IPFS',
    details: lastError 
  });
}
