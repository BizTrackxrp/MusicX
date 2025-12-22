/**
 * XRP Music - Broker Sale API
 * Automatically completes NFT purchases using platform wallet
 * 
 * Flow:
 * 1. Buyer pays XRP to platform
 * 2. This endpoint brokers the NFT transfer
 * 3. Platform sends 98% to artist, keeps 2%
 * 4. NFT goes to buyer
 */

import { neon } from '@neondatabase/serverless';
import xrpl from 'xrpl';

const PLATFORM_FEE_PERCENT = 2;

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      releaseId,
      buyerAddress,
      sellOfferIndex,
      paymentTxHash,
    } = req.body;
    
    if (!releaseId || !buyerAddress || !sellOfferIndex) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get platform wallet credentials
    const platformAddress = process.env.PLATFORM_WALLET_ADDRESS;
    const platformSeed = process.env.PLATFORM_WALLET_SEED;
    
    if (!platformAddress || !platformSeed) {
      console.error('Platform wallet not configured');
      return res.status(500).json({ error: 'Platform not configured' });
    }
    
    // Get release details
    const [release] = await sql`
      SELECT * FROM releases WHERE id = ${releaseId}
    `;
    
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }
    
    // Check if still available
    if (release.sold_editions >= release.total_editions) {
      return res.status(400).json({ error: 'Sold out' });
    }
    
    const price = parseFloat(release.song_price) || 0;
    const artistAddress = release.artist_address;
    
    // Connect to XRPL
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    try {
      // Create platform wallet from seed
      const platformWallet = xrpl.Wallet.fromSeed(platformSeed);
      
      // Calculate amounts
      const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
      const artistPayment = price - platformFee;
      
      // Step 1: Accept the NFT sell offer (broker the sale)
      // The buyer has already paid, now we transfer the NFT
      const acceptOfferTx = {
        TransactionType: 'NFTokenAcceptOffer',
        Account: platformWallet.address,
        NFTokenSellOffer: sellOfferIndex,
      };
      
      const acceptResult = await client.submitAndWait(acceptOfferTx, {
        wallet: platformWallet,
      });
      
      if (acceptResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`NFT transfer failed: ${acceptResult.result.meta.TransactionResult}`);
      }
      
      console.log('NFT transferred to buyer:', acceptResult.result.hash);
      
      // Step 2: Send artist their payment (98%)
      if (artistPayment > 0) {
        const paymentTx = {
          TransactionType: 'Payment',
          Account: platformWallet.address,
          Destination: artistAddress,
          Amount: xrpl.xrpToDrops(artistPayment.toString()),
          Memos: [{
            Memo: {
              MemoType: Buffer.from('XRPMusic', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(`Sale: ${release.title}`, 'utf8').toString('hex').toUpperCase(),
            }
          }],
        };
        
        const paymentResult = await client.submitAndWait(paymentTx, {
          wallet: platformWallet,
        });
        
        if (paymentResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          console.error('Artist payment failed:', paymentResult.result.meta.TransactionResult);
          // Don't throw - NFT already transferred, log for manual resolution
        } else {
          console.log('Artist paid:', paymentResult.result.hash);
        }
      }
      
      // Step 3: Update database
      await sql`
        UPDATE releases 
        SET sold_editions = sold_editions + 1
        WHERE id = ${releaseId}
      `;
      
      // Record the sale
      await sql`
        INSERT INTO sales (
          id,
          release_id,
          buyer_address,
          seller_address,
          price,
          platform_fee,
          tx_hash,
          created_at
        ) VALUES (
          ${'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)},
          ${releaseId},
          ${buyerAddress},
          ${artistAddress},
          ${price},
          ${platformFee},
          ${acceptResult.result.hash},
          NOW()
        )
      `;
      
      return res.json({
        success: true,
        txHash: acceptResult.result.hash,
        message: 'Purchase complete!',
      });
      
    } finally {
      await client.disconnect();
    }
    
  } catch (error) {
    console.error('Broker sale error:', error);
    return res.status(500).json({ error: error.message || 'Sale failed' });
  }
}
