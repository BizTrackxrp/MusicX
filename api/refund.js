/**
 * Refund API
 * Auto-refund users if upload fails after payment
 */

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
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
    const { paymentTxHash, userAddress, amount, reason } = req.body;
    
    if (!paymentTxHash || !userAddress || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: paymentTxHash, userAddress, amount' 
      });
    }

    console.log(`Processing refund: ${amount} XRP to ${userAddress} (reason: ${reason})`);

    // 1. Verify payment exists (optional but recommended)
    // const payment = await verifyPaymentOnLedger(paymentTxHash);
    // if (!payment) throw new Error('Original payment not found');

    // 2. Send refund via XRPL
    const xrpl = require('xrpl');
    const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_PLATFORM_SEED);
    const client = new xrpl.Client(process.env.XRPL_RPC_URL || 'wss://xrplcluster.com');
    
    await client.connect();
    
    const refundPayment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: userAddress,
      Amount: xrpl.xrpToDrops(amount.toString()),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('refund', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(`Refund for failed upload: ${reason || 'Unknown error'}`, 'utf8').toString('hex').toUpperCase(),
        }
      }]
    };
    
    const prepared = await client.autofill(refundPayment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Refund transaction failed: ${result.result.meta.TransactionResult}`);
    }
    
    const refundTxHash = result.result.hash;
    console.log(`Refund sent: ${refundTxHash}`);

    // 3. Update database (mark as refunded)
    try {
      await sql`
        UPDATE releases 
        SET payment_status = 'refunded',
            refund_tx_hash = ${refundTxHash},
            upload_failed_reason = ${reason || 'Upload failed'}
        WHERE payment_tx_hash = ${paymentTxHash}
      `;
    } catch (dbErr) {
      console.error('Failed to update database:', dbErr);
      // Don't fail the refund if DB update fails - user already got their money back
    }
    
    return res.json({ 
      success: true, 
      refundTxHash,
      amount,
      message: `Refunded ${amount} XRP to ${userAddress}`
    });
    
  } catch (err) {
    console.error('Refund error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'Refund failed'
    });
  }
}
