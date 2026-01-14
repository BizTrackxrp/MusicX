/**
 * XRP Music - IPFS Helper
 * 
 * Converts IPFS URLs to use our proxy for better compatibility
 * with devices that block IPFS gateways directly.
 */

const IpfsHelper = {
  /**
   * Convert any IPFS URL to use our proxy
   * 
   * Input formats supported:
   * - ipfs://QmXxx...
   * - https://gateway.lighthouse.storage/ipfs/QmXxx...
   * - https://ipfs.io/ipfs/QmXxx...
   * - /ipfs/QmXxx...
   * - QmXxx... (raw CID)
   * 
   * Output: /api/ipfs/QmXxx...
   */
  toProxyUrl(url) {
    if (!url) return url;
    
    let cid = null;
    
    // Already proxied
    if (url.startsWith('/api/ipfs/')) {
      return url;
    }
    
    // ipfs://QmXxx...
    if (url.startsWith('ipfs://')) {
      cid = url.replace('ipfs://', '');
    }
    // https://gateway.xxx/ipfs/QmXxx...
    else if (url.includes('/ipfs/')) {
      cid = url.split('/ipfs/')[1];
    }
    // Raw CID starting with Qm or bafy
    else if (url.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,})/)) {
      cid = url;
    }
    
    if (cid) {
      // Remove any trailing path or query params for the CID
      cid = cid.split('?')[0].split('#')[0];
      return `/api/ipfs/${cid}`;
    }
    
    // Not an IPFS URL, return as-is
    return url;
  },
  
  /**
   * Convert to full absolute proxy URL
   */
  toAbsoluteProxyUrl(url) {
    const proxyPath = this.toProxyUrl(url);
    if (proxyPath.startsWith('/api/ipfs/')) {
      return `${window.location.origin}${proxyPath}`;
    }
    return url;
  },
  
  /**
   * Extract CID from any IPFS URL format
   */
  extractCid(url) {
    if (!url) return null;
    
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '').split('?')[0];
    }
    
    if (url.includes('/ipfs/')) {
      return url.split('/ipfs/')[1].split('?')[0];
    }
    
    if (url.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{50,})/)) {
      return url.split('?')[0];
    }
    
    return null;
  }
};

// Make it globally available
window.IpfsHelper = IpfsHelper;
