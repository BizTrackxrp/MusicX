/**
 * XRP Music - IPFS Image Proxy
 * 
 * Proxies IPFS content through our domain to bypass security software
 * that blocks IPFS gateways directly.
 * 
 * Usage: /api/ipfs/[cid]
 * Example: /api/ipfs/QmZw9HdDHPZrvJwqrhfM9is3YaxSNLYvQUuav15LqMg
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
  const { cid } = req.query;
  
  if (!cid) {
    return res.status(400).json({ error: 'Missing IPFS CID' });
  }
  
  // Validate CID format (basic check)
  if (!/^Qm[a-zA-Z0-9]{44}$|^bafy[a-zA-Z0-9]{50,}$/.test(cid)) {
    return res.status(400).json({ error: 'Invalid IPFS CID format' });
  }
  
  // Try each gateway until one works
  let lastError = null;
  
  for (const gateway of GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        headers: {
          'User-Agent': 'XRPMusic/1.0',
        },
      });
      
      if (!response.ok) {
        lastError = `${gateway} returned ${response.status}`;
        continue;
      }
      
      // Get content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      // Get the content as buffer
      const buffer = await response.arrayBuffer();
      
      // Set caching headers
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION}, immutable`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-IPFS-Gateway', gateway);
      
      // Send the content
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
