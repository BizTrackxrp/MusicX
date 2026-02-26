/**
 * XRP Music - Burn Spam NFTs
 * 
 * One-off utility to burn the 5,626 "Elevated Spaceman" NFTs that were
 * accidentally batch-minted on 1/13/26. These clog the platform wallet
 * and lock up ~1,125 XRP in reserve.
 * 
 * Usage: POST /api/burn-spam with { action: 'count' } to preview,
 *        POST /api/burn-spam with { action: 'burn', batchSize: 25 } to burn a batch.
 * 
 * The target URI (hex-encoded) for Elevated Spaceman metadata.
 * Run multiple times until count reaches 0.
 */

import * as xrpl from 'xrpl';

// The IPFS URI of the spam NFT (Elevated Spaceman)
const SPAM_URI_HEX = xrpl.convertStringToHex('ipfs://QmZw9HdDHPZrvJwqrhfM9is3YaxSNLYvQUuav15LqMgHjh');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { action, batchSize = 25, adminKey } = req.body;
  
  // Simple admin protection — set ADMIN_KEY in your Vercel env vars
  const expectedKey = process.env.ADMIN_KEY || 'burn-elevated-spaceman-2026';
  if (adminKey !== expectedKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
  const platformSeed = process.env.PLATFORM_WALLET_SEED;
  if (!platformAddress || !platformSeed) {
    return res.status(500).json({ error: 'Platform not configured' });
  }
  
  const client = new xrpl.Client('wss://s1.ripple.com');
  await client.connect();
  
  try {
    if (action === 'count') {
      // Count how many spam NFTs remain
      let totalSpam = 0;
      let totalNfts = 0;
      let marker = undefined;
      
      do {
        const request = { command: 'account_nfts', account: platformAddress, limit: 400 };
        if (marker) request.marker = marker;
        const response = await client.request(request);
        const nfts = response.result.account_nfts || [];
        totalNfts += nfts.length;
        totalSpam += nfts.filter(n => n.URI === SPAM_URI_HEX).length;
        marker = response.result.marker;
      } while (marker);
      
      await client.disconnect();
      
      const reserveLocked = (totalSpam * 0.2).toFixed(1);
      return res.json({
        totalNfts,
        spamNfts: totalSpam,
        reserveLockedXRP: reserveLocked,
        message: `Found ${totalSpam} Elevated Spaceman NFTs locking ${reserveLocked} XRP in reserve`,
      });
    }
    
    if (action === 'burn') {
      const limit = Math.min(batchSize, 50); // Cap at 50 per request to stay under Vercel timeout
      
      // Find spam NFTs (just fetch first page — spam NFTs are spread across pages)
      let spamNfts = [];
      let marker = undefined;
      
      // Paginate until we have enough to burn
      while (spamNfts.length < limit) {
        const request = { command: 'account_nfts', account: platformAddress, limit: 400 };
        if (marker) request.marker = marker;
        const response = await client.request(request);
        const nfts = response.result.account_nfts || [];
        const spam = nfts.filter(n => n.URI === SPAM_URI_HEX);
        spamNfts = spamNfts.concat(spam);
        marker = response.result.marker;
        if (!marker) break; // No more pages
      }
      
      spamNfts = spamNfts.slice(0, limit);
      
      if (spamNfts.length === 0) {
        await client.disconnect();
        return res.json({ burned: 0, message: 'No more spam NFTs found! All clean.' });
      }
      
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      let burned = 0;
      let errors = 0;
      
      for (const nft of spamNfts) {
        try {
          const burnTx = await client.autofill({
            TransactionType: 'NFTokenBurn',
            Account: platformAddress,
            NFTokenID: nft.NFTokenID,
          });
          const signed = platformWallet.sign(burnTx);
          const result = await client.submitAndWait(signed.tx_blob);
          
          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            burned++;
          } else {
            console.error(`Burn failed for ${nft.NFTokenID}: ${result.result.meta.TransactionResult}`);
            errors++;
          }
        } catch (e) {
          console.error(`Burn error for ${nft.NFTokenID}: ${e.message}`);
          errors++;
          // If we hit rate limits, stop early
          if (e.message?.includes('slowDown') || e.message?.includes('tooBusy')) {
            console.warn('Rate limited, stopping batch early');
            break;
          }
        }
      }
      
      await client.disconnect();
      
      return res.json({
        burned,
        errors,
        message: `Burned ${burned} Elevated Spaceman NFTs (${errors} errors). Run again to continue.`,
      });
    }
    
    await client.disconnect();
    return res.status(400).json({ error: 'Invalid action. Use "count" or "burn".' });
    
  } catch (error) {
    try { await client.disconnect(); } catch (e) {}
    console.error('Burn error:', error);
    return res.status(500).json({ error: error.message });
  }
}
