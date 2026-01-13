/**
 * XRP Music - Mint Worker for Railway
 * 
 * This worker runs continuously and processes mint jobs from the queue.
 * No timeout limits - can mint 1000+ NFTs per batch.
 * 
 * Deploy to Railway:
 * 1. Create new project on railway.app
 * 2. Connect this repo or deploy from GitHub
 * 3. Set environment variables (same as Vercel)
 * 4. Worker runs continuously, polling for jobs
 */

const { neon } = require('@neondatabase/serverless');
const xrpl = require('xrpl');

// Environment variables (set in Railway dashboard)
const DATABASE_URL = process.env.DATABASE_URL;
const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS;
const PLATFORM_WALLET_SEED = process.env.PLATFORM_WALLET_SEED;

// Polling interval (check for new jobs every 5 seconds)
const POLL_INTERVAL = 5000;

/**
 * Extract NFT Token ID from mint transaction result
 */
function extractNFTokenID(meta) {
  for (const node of meta.AffectedNodes || []) {
    if (node.ModifiedNode?.LedgerEntryType === 'NFTokenPage') {
      const finalTokens = node.ModifiedNode.FinalFields?.NFTokens || [];
      const prevTokens = node.ModifiedNode.PreviousFields?.NFTokens || [];
      
      const prevIds = new Set(prevTokens.map(t => t.NFToken?.NFTokenID));
      for (const token of finalTokens) {
        if (token.NFToken?.NFTokenID && !prevIds.has(token.NFToken.NFTokenID)) {
          return token.NFToken.NFTokenID;
        }
      }
      
      if (prevTokens.length === 0 && finalTokens.length > 0) {
        const lastToken = finalTokens[finalTokens.length - 1];
        if (lastToken?.NFToken?.NFTokenID) {
          return lastToken.NFToken.NFTokenID;
        }
      }
    }
    
    if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
      const tokens = node.CreatedNode.NewFields?.NFTokens || [];
      if (tokens.length > 0) {
        const lastToken = tokens[tokens.length - 1];
        if (lastToken?.NFToken?.NFTokenID) {
          return lastToken.NFToken.NFTokenID;
        }
      }
    }
  }
  
  if (meta.nftoken_id) return meta.nftoken_id;
  if (meta.nftoken_ids?.length > 0) return meta.nftoken_ids[0];
  
  return null;
}

/**
 * Process a single mint job
 */
async function processJob(job) {
  const sql = neon(DATABASE_URL);
  const client = new xrpl.Client('wss://xrplcluster.com');
  
  console.log(`\n🚀 Processing job ${job.id}: ${job.total_nfts} NFTs for release ${job.release_id}`);
  
  try {
    // Update status to 'minting'
    await sql`
      UPDATE mint_jobs 
      SET status = 'minting', started_at = NOW(), updated_at = NOW()
      WHERE id = ${job.id}
    `;
    
    // Get job details from releases table
    const releases = await sql`
      SELECT * FROM releases WHERE id = ${job.release_id}
    `;
    
    if (releases.length === 0) {
      throw new Error('Release not found');
    }
    
    const release = releases[0];
    
    // Get tracks for this release
    const tracks = await sql`
      SELECT * FROM tracks WHERE release_id = ${job.release_id} ORDER BY track_number
    `;
    
    // Parse job data
    const jobData = job.job_data || {};
    const quantity = jobData.quantity || job.total_nfts;
    const transferFee = jobData.transferFee || 500;
    const artistAddress = jobData.artistAddress || release.artist_address;
    
    // Build track URIs from tracks table
    const trackUris = tracks.map(t => t.metadata_url || `ipfs://${t.metadata_cid}`);
    const trackIds = tracks.map(t => t.id);
    
    if (trackUris.length === 0) {
      throw new Error('No tracks found for release');
    }
    
    const totalNFTs = trackUris.length * quantity;
    
    console.log(`📀 Minting ${trackUris.length} tracks × ${quantity} editions = ${totalNFTs} NFTs`);
    console.log(`🎨 Artist: ${artistAddress}`);
    
    // Connect to XRPL
    await client.connect();
    console.log('✅ Connected to XRPL');
    
    const wallet = xrpl.Wallet.fromSeed(PLATFORM_WALLET_SEED);
    
    // Verify artist has authorized platform
    const accountInfo = await client.request({
      command: 'account_info',
      account: artistAddress,
    });
    
    const authorizedMinter = accountInfo.result.account_data.NFTokenMinter;
    if (authorizedMinter !== PLATFORM_WALLET_ADDRESS) {
      throw new Error('Platform not authorized as minter');
    }
    
    console.log('✅ Platform authorized');
    
    // Mint NFTs
    let totalMinted = 0;
    let totalStoredInDb = 0;
    const allNftTokenIds = [];
    
    for (let t = 0; t < trackUris.length; t++) {
      const trackUri = trackUris[t];
      const trackId = trackIds[t];
      const uriHex = xrpl.convertStringToHex(trackUri);
      
      console.log(`\n🎵 Track ${t + 1}/${trackUris.length}: ${trackUri.substring(0, 50)}...`);
      
      for (let i = 0; i < quantity; i++) {
        const editionNumber = i + 1;
        
        try {
          const mintTx = await client.autofill({
            TransactionType: 'NFTokenMint',
            Account: PLATFORM_WALLET_ADDRESS,
            Issuer: artistAddress,
            URI: uriHex,
            Flags: 8, // tfTransferable
            TransferFee: transferFee,
            NFTokenTaxon: t,
          });
          
          const signed = wallet.sign(mintTx);
          const result = await client.submitAndWait(signed.tx_blob);
          
          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            const nftTokenId = extractNFTokenID(result.result.meta);
            
            if (nftTokenId) {
              console.log(`  ✓ Edition ${editionNumber}/${quantity} minted: ${nftTokenId.substring(0, 20)}...`);
              
              // Store in nfts table
              const nftId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              try {
                await sql`
                  INSERT INTO nfts (
                    id, nft_token_id, track_id, release_id, edition_number,
                    status, owner_address, tx_hash, minted_at
                  ) VALUES (
                    ${nftId}, ${nftTokenId}, ${trackId}, ${job.release_id},
                    ${editionNumber}, 'available', ${PLATFORM_WALLET_ADDRESS},
                    ${result.result.hash}, NOW()
                  )
                  ON CONFLICT (nft_token_id) DO NOTHING
                `;
                totalStoredInDb++;
              } catch (dbError) {
                console.error(`  ⚠ DB insert failed: ${dbError.message}`);
              }
              
              allNftTokenIds.push(nftTokenId);
              totalMinted++;
            } else {
              console.error(`  ⚠ Minted but couldn't extract token ID`);
              totalMinted++;
            }
            
            // UPDATE PROGRESS after each NFT
            await sql`
              UPDATE mint_jobs 
              SET minted_count = ${totalMinted}, updated_at = NOW()
              WHERE id = ${job.id}
            `;
            
          } else {
            console.error(`  ✗ Failed: ${result.result.meta.TransactionResult}`);
          }
          
          // Small delay between mints
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (mintError) {
          console.error(`  ✗ Mint error: ${mintError.message}`);
        }
      }
    }
    
    // Update release with NFT token IDs
    if (allNftTokenIds.length > 0) {
      await sql`
        UPDATE releases 
        SET nft_token_ids = ${JSON.stringify(allNftTokenIds)},
            is_minted = true,
            total_editions = ${totalStoredInDb}
        WHERE id = ${job.release_id}
      `;
    }
    
    // Mark job complete
    await sql`
      UPDATE mint_jobs 
      SET status = 'complete', 
          minted_count = ${totalMinted},
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
    
    console.log(`\n✅ Job ${job.id} complete: ${totalMinted}/${totalNFTs} minted, ${totalStoredInDb} stored in DB`);
    
    await client.disconnect();
    
  } catch (error) {
    console.error(`\n❌ Job ${job.id} failed: ${error.message}`);
    
    // Mark job as failed
    await sql`
      UPDATE mint_jobs 
      SET status = 'failed', 
          error = ${error.message},
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
    
    try {
      await client.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

/**
 * Main worker loop
 */
async function runWorker() {
  console.log('🎵 XRP Music Mint Worker started');
  console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'NOT SET!'}`);
  console.log(`💳 Platform: ${PLATFORM_WALLET_ADDRESS || 'NOT SET!'}`);
  
  if (!DATABASE_URL || !PLATFORM_WALLET_ADDRESS || !PLATFORM_WALLET_SEED) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
  }
  
  const sql = neon(DATABASE_URL);
  
  while (true) {
    try {
      // Find pending jobs
      const pendingJobs = await sql`
        SELECT * FROM mint_jobs 
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      `;
      
      if (pendingJobs.length > 0) {
        await processJob(pendingJobs[0]);
      } else {
        // No jobs, wait and poll again
        process.stdout.write('.');
      }
      
    } catch (error) {
      console.error('Worker error:', error.message);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

// Start the worker
runWorker().catch(err => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
