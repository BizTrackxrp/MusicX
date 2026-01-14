/**
 * BURN NFTs by Issuer - API Endpoint
 * 
 * POST /api/burn-by-issuer
 * 
 * Actions:
 *   - preview: Shows what will be burned vs kept (SAFE - no burning)
 *   - burn: Actually burns the NFTs (requires secret)
 */

import xrpl from 'xrpl';

const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS;
const PLATFORM_WALLET_SEED = process.env.PLATFORM_WALLET_SEED;
const BURN_SECRET = process.env.BURN_SECRET || 'burn-6038-test-nfts';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, secret, issuerToBurn } = req.body;

  // Default to your test wallet
  const targetIssuer = issuerToBurn || 'r4P4LBCoen3sHiJS8StMcWTZ82yEUJg4ac';

  const client = new xrpl.Client('wss://xrplcluster.com');

  try {
    await client.connect();

    // Fetch all NFTs from platform wallet
    let allNFTs = [];
    let marker = undefined;

    do {
      const response = await client.request({
        command: 'account_nfts',
        account: PLATFORM_WALLET_ADDRESS,
        limit: 400,
        marker
      });
      allNFTs = allNFTs.concat(response.result.account_nfts);
      marker = response.result.marker;
    } while (marker);

    // Split into burn vs keep
    const nftsToBurn = allNFTs.filter(nft => nft.Issuer === targetIssuer);
    const nftsToKeep = allNFTs.filter(nft => nft.Issuer !== targetIssuer);

    // Group keepers by issuer for display
    const keepByIssuer = {};
    for (const nft of nftsToKeep) {
      keepByIssuer[nft.Issuer] = (keepByIssuer[nft.Issuer] || 0) + 1;
    }

    // PREVIEW MODE - just show what would happen
    if (action === 'preview') {
      return res.json({
        success: true,
        mode: 'PREVIEW - Nothing burned',
        totalNFTs: allNFTs.length,
        toBurn: {
          issuer: targetIssuer,
          count: nftsToBurn.length
        },
        toKeep: {
          count: nftsToKeep.length,
          byIssuer: keepByIssuer
        },
        estimatedTime: `${Math.round(nftsToBurn.length * 0.4 / 60)} minutes`,
        xrpToFree: `~${(nftsToBurn.length / 24 * 0.2).toFixed(2)} XRP`,
        nextStep: "Call with action: 'burn' and secret to actually burn"
      });
    }

    // BURN MODE - requires secret
    if (action === 'burn') {
      if (secret !== BURN_SECRET) {
        return res.status(401).json({ error: 'Invalid secret' });
      }

      if (nftsToBurn.length === 0) {
        return res.json({ success: true, message: 'Nothing to burn!' });
      }

      const wallet = xrpl.Wallet.fromSeed(PLATFORM_WALLET_SEED);
      
      let burned = 0;
      let failed = 0;
      const errors = [];

      console.log(`🔥 Starting burn of ${nftsToBurn.length} NFTs from issuer ${targetIssuer}`);

      for (const nft of nftsToBurn) {
        try {
          const burnTx = {
            TransactionType: 'NFTokenBurn',
            Account: wallet.address,
            NFTokenID: nft.NFTokenID
          };

          await client.submitAndWait(burnTx, { wallet });
          burned++;

          if (burned % 100 === 0) {
            console.log(`🔥 Progress: ${burned}/${nftsToBurn.length}`);
          }

        } catch (err) {
          failed++;
          errors.push({ id: nft.NFTokenID.slice(0, 20), error: err.message });
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      }

      console.log(`✅ Burn complete: ${burned} burned, ${failed} failed`);

      return res.json({
        success: true,
        burned,
        failed,
        errors: errors.slice(0, 10), // First 10 errors only
        xrpFreed: `~${(burned / 24 * 0.2).toFixed(2)} XRP`,
        nftsPreserved: nftsToKeep.length
      });
    }

    return res.status(400).json({ error: "Invalid action. Use 'preview' or 'burn'" });

  } catch (err) {
    console.error('Burn error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await client.disconnect();
  }
}
