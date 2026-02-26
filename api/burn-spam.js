/**
 * XRP Music - Burn Spam NFTs (Vercel version)
 * 
 * Burns "Elevated Spaceman" NFTs from platform wallet.
 * Maximizes throughput within Vercel's 60s timeout.
 * 
 * POST /api/burn-spam { action: "count", adminKey: "..." }
 * POST /api/burn-spam { action: "burn", adminKey: "..." }
 */

import * as xrpl from 'xrpl';

const SPAM_URI_HEX = xrpl.convertStringToHex('ipfs://QmZw9HdDHPZrvJwqrhfM9is3YaxSNLYvQUuav15LqMgHjh');
const MAX_RUNTIME_MS = 50000; // Stop at 50s to leave buffer for response

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { action, adminKey } = req.body;
  
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
      return res.json({
        totalNfts,
        spamNfts: totalSpam,
        reserveLockedXRP: (totalSpam * 0.2).toFixed(1),
      });
    }
    
    if (action === 'burn') {
      const startTime = Date.now();
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Collect ALL spam NFT IDs first
      let spamIds = [];
      let marker = undefined;
      
      do {
        const request = { command: 'account_nfts', account: platformAddress, limit: 400 };
        if (marker) request.marker = marker;
        const response = await client.request(request);
        const nfts = response.result.account_nfts || [];
        spamIds = spamIds.concat(nfts.filter(n => n.URI === SPAM_URI_HEX).map(n => n.NFTokenID));
        marker = response.result.marker;
      } while (marker);
      
      if (spamIds.length === 0) {
        await client.disconnect();
        return res.json({ submitted: 0, remaining: 0, message: 'All clean! No spam NFTs left.' });
      }
      
      // Get sequence and ledger
      let acctInfo = await client.request({ command: 'account_info', account: platformAddress });
      let sequence = acctInfo.result.account_data.Sequence;
      let currentLedger = await client.getLedgerIndex();
      
      let submitted = 0;
      let errors = 0;
      
      for (let i = 0; i < spamIds.length; i++) {
        // Time check — stop before Vercel kills us
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          console.log(`⏰ Hitting time limit at ${submitted} submissions`);
          break;
        }
        
        try {
          const burnTx = {
            TransactionType: 'NFTokenBurn',
            Account: platformAddress,
            NFTokenID: spamIds[i],
            Fee: '15',
            Sequence: sequence,
            LastLedgerSequence: currentLedger + 500,
          };
          
          const signed = platformWallet.sign(burnTx);
          const result = await client.submit(signed.tx_blob);
          const engineResult = result.result?.engine_result;
          
          if (engineResult === 'tesSUCCESS' || engineResult === 'terQUEUED' || engineResult === 'terPRE_SEQ') {
            submitted++;
            sequence++;
          } else if (engineResult === 'telCAN_NOT_QUEUE_FULL') {
            // Queue full — wait for ledger close
            await new Promise(r => setTimeout(r, 4000));
            acctInfo = await client.request({ command: 'account_info', account: platformAddress });
            sequence = acctInfo.result.account_data.Sequence;
            currentLedger = await client.getLedgerIndex();
            i--; // retry
            continue;
          } else if (engineResult === 'tefPAST_SEQ') {
            acctInfo = await client.request({ command: 'account_info', account: platformAddress });
            sequence = acctInfo.result.account_data.Sequence;
            i--;
            continue;
          } else {
            errors++;
            sequence++;
          }
        } catch (e) {
          errors++;
          if (e.message?.includes('slowDown') || e.message?.includes('tooBusy')) {
            await new Promise(r => setTimeout(r, 5000));
            acctInfo = await client.request({ command: 'account_info', account: platformAddress });
            sequence = acctInfo.result.account_data.Sequence;
            currentLedger = await client.getLedgerIndex();
            i--;
            continue;
          }
        }
        
        // Tiny delay to not spam the node
        if (submitted % 25 === 0 && submitted > 0) {
          await new Promise(r => setTimeout(r, 300));
          currentLedger = await client.getLedgerIndex();
        }
      }
      
      await client.disconnect();
      
      const remaining = spamIds.length - submitted;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      return res.json({
        submitted,
        errors,
        remaining,
        elapsed: `${elapsed}s`,
        freedXRP: (submitted * 0.2).toFixed(1),
        message: remaining > 0 
          ? `Burned ${submitted} in ${elapsed}s. ${remaining} left — run again!` 
          : `Done! All ${submitted} Elevated Spaceman NFTs burned. ${(submitted * 0.2).toFixed(1)} XRP freed.`,
      });
    }
    
    await client.disconnect();
    return res.status(400).json({ error: 'Use action: "count" or "burn"' });
    
  } catch (error) {
    try { await client.disconnect(); } catch (e) {}
    return res.status(500).json({ error: error.message });
  }
}
