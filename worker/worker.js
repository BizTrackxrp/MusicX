/**
 * XRP Music - Mint Worker for Railway
 * 
 * BULLETPROOF VERSION with:
 * - Resume from where it left off (checks minted_count)
 * - Picks up interrupted 'minting' jobs
 * - Auto-retry on transient errors
 * - Graceful error handling
 * - Auto-restart on crash
 */

const { neon } = require('@neondatabase/serverless');
const xrpl = require('xrpl');

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS;
const PLATFORM_WALLET_SEED = process.env.PLATFORM_WALLET_SEED;

// Config
const POLL_INTERVAL = 5000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 10000;
const MINT_DELAY = 500; // Delay between mints (ms)
const RATE_LIMIT_DELAY = 30000; // Wait 30s when rate limited

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
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry wrapper for transient errors
 */
async function withRetry(fn, description, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`  ⚠ ${description} failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      // Don't retry on permanent errors
      if (error.message.includes('not authorized') || 
          error.message.includes('not found') ||
          error.message.includes('tecNO_PERMISSION')) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.log(`  ⏳ Retrying in ${RETRY_DELAY/1000}s...`);
        await sleep(RETRY_DELAY);
      }
    }
  }
  throw lastError;
}

/**
 * Process a single mint job with RESUME CAPABILITY
 */
async function processJob(job) {
  const sql = neon(DATABASE_URL);
  let client = null;
  
  // Check how many already minted (for resume)
  const alreadyMinted = job.minted_count || 0;
  const isResume = alreadyMinted > 0;
  
  console.log(`\n🚀 Processing job ${job.id}: ${job.total_nfts} NFTs for release ${job.release_id}`);
  if (isResume) {
    console.log(`📍 RESUMING from ${alreadyMinted}/${job.total_nfts} (${Math.round(alreadyMinted/job.total_nfts*100)}% done)`);
  }
  
  try {
    // Update status to 'minting'
    await sql`
      UPDATE mint_jobs 
      SET status = 'minting', 
          started_at = COALESCE(started_at, NOW()), 
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
    
    // Get release details
    const releases = await sql`SELECT * FROM releases WHERE id = ${job.release_id}`;
    if (releases.length === 0) throw new Error('Release not found');
    const release = releases[0];
    
    // Get tracks
    const tracks = await sql`
      SELECT * FROM tracks WHERE release_id = ${job.release_id} ORDER BY track_number
    `;
    
    // Parse job data
    const jobData = job.job_data || {};
    const quantity = jobData.quantity || job.total_nfts;
    const transferFee = jobData.transferFee || 500;
    const artistAddress = jobData.artistAddress || release.artist_address;
    
    const trackUris = tracks.map(t => t.metadata_url || `ipfs://${t.metadata_cid}`);
    const trackIds = tracks.map(t => t.id);
    
    if (trackUris.length === 0) throw new Error('No tracks found for release');
    
    const totalNFTs = trackUris.length * quantity;
    
    console.log(`🎧 Minting ${trackUris.length} tracks × ${quantity} editions = ${totalNFTs} NFTs`);
    console.log(`🎨 Artist: ${artistAddress}`);
    
    // Connect to XRPL with retry
    client = new xrpl.Client('wss://xrplcluster.com');
    await withRetry(async () => {
      await client.connect();
    }, 'XRPL connect');
    console.log('✅ Connected to XRPL');
    
    const wallet = xrpl.Wallet.fromSeed(PLATFORM_WALLET_SEED);
    
    // Verify authorization
    const accountInfo = await client.request({
      command: 'account_info',
      account: artistAddress,
    });
    
    if (accountInfo.result.account_data.NFTokenMinter !== PLATFORM_WALLET_ADDRESS) {
      throw new Error('Platform not authorized as minter');
    }
    console.log('✅ Platform authorized');
    
    // Mint NFTs - RESUME FROM WHERE WE LEFT OFF
    let totalMinted = alreadyMinted;
    let totalStoredInDb = alreadyMinted;
    const allNftTokenIds = [];
    
    // Calculate which edition to start from
    let globalEditionIndex = 0;
    
    for (let t = 0; t < trackUris.length; t++) {
      const trackUri = trackUris[t];
      const trackId = trackIds[t];
      const uriHex = xrpl.convertStringToHex(trackUri);
      
      console.log(`\n🎵 Track ${t + 1}/${trackUris.length}: ${trackUri.substring(0, 50)}...`);
      
      for (let i = 0; i < quantity; i++) {
        const editionNumber = i + 1;
        globalEditionIndex++;
        
        // SKIP if already minted (resume logic)
        if (globalEditionIndex <= alreadyMinted) {
          continue; // Skip this one, already done
        }
        
        // Mint with retry
        let mintSuccess = false;
        for (let attempt = 1; attempt <= MAX_RETRIES && !mintSuccess; attempt++) {
          try {
            // Reconnect if disconnected
            if (!client.isConnected()) {
              console.log('  🔄 Reconnecting to XRPL...');
              client = new xrpl.Client('wss://xrplcluster.com');
              await client.connect();
            }
            
            const mintTx = await client.autofill({
              TransactionType: 'NFTokenMint',
              Account: PLATFORM_WALLET_ADDRESS,
              Issuer: artistAddress,
              URI: uriHex,
              Flags: 8,
              TransferFee: transferFee,
              NFTokenTaxon: t,
            });
            
            const signed = wallet.sign(mintTx);
            const result = await client.submitAndWait(signed.tx_blob);
            
            if (result.result.meta.TransactionResult === 'tesSUCCESS') {
              const nftTokenId = extractNFTokenID(result.result.meta);
              
              if (nftTokenId) {
                console.log(`  ✓ Edition ${editionNumber}/${quantity} minted: ${nftTokenId.substring(0, 20)}...`);
                
                // Store in DB
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
              }
              
              totalMinted++;
              mintSuccess = true;
              
              // Update progress
              await sql`
                UPDATE mint_jobs 
                SET minted_count = ${totalMinted}, updated_at = NOW()
                WHERE id = ${job.id}
              `;
              
            } else {
              throw new Error(result.result.meta.TransactionResult);
            }
            
          } catch (mintError) {
            const errorMsg = mintError.message || String(mintError);
            console.error(`  ✗ Mint error (attempt ${attempt}/${MAX_RETRIES}): ${errorMsg}`);
            
            // Check if rate limited (429)
            if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('Too Many')) {
              console.log(`  ⏳ Rate limited! Waiting ${RATE_LIMIT_DELAY/1000}s...`);
              await sleep(RATE_LIMIT_DELAY);
            } else if (attempt < MAX_RETRIES) {
              await sleep(RETRY_DELAY);
            }
          }
        }
        
        if (!mintSuccess) {
          console.error(`  ⚠ Skipping edition ${editionNumber} after ${MAX_RETRIES} failures`);
        }
        
        // Delay between mints to avoid rate limits
        await sleep(MINT_DELAY);
      }
    }
    
    // Update release
    if (allNftTokenIds.length > 0) {
      // Get existing token IDs and merge
      const existingRelease = await sql`SELECT nft_token_ids FROM releases WHERE id = ${job.release_id}`;
      let existingIds = [];
      try {
        existingIds = JSON.parse(existingRelease[0]?.nft_token_ids || '[]');
      } catch (e) {}
      
      const mergedIds = [...existingIds, ...allNftTokenIds];
      
      await sql`
        UPDATE releases 
        SET nft_token_ids = ${JSON.stringify(mergedIds)},
            is_minted = true,
            total_editions = ${totalStoredInDb}
        WHERE id = ${job.release_id}
      `;
    }
    
    // Mark complete
    await sql`
      UPDATE mint_jobs 
      SET status = 'complete', 
          minted_count = ${totalMinted},
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
    
    console.log(`\n✅ Job ${job.id} complete: ${totalMinted}/${totalNFTs} minted`);
    
  } catch (error) {
    console.error(`\n❌ Job ${job.id} failed: ${error.message}`);
    
    await sql`
      UPDATE mint_jobs 
      SET status = 'failed', 
          error = ${error.message},
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
  } finally {
    // Always disconnect
    try {
      if (client?.isConnected()) await client.disconnect();
    } catch (e) {}
  }
}

/**
 * Main worker loop with auto-recovery
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
      // Find jobs: PENDING first, then interrupted MINTING jobs
      const jobs = await sql`
        SELECT * FROM mint_jobs 
        WHERE status IN ('pending', 'minting')
        ORDER BY 
          CASE status WHEN 'minting' THEN 0 ELSE 1 END,
          created_at ASC
        LIMIT 1
      `;
      
      if (jobs.length > 0) {
        await processJob(jobs[0]);
      } else {
        process.stdout.write('.');
      }
      
    } catch (error) {
      console.error('\n⚠ Worker loop error:', error.message);
      console.log('⏳ Recovering in 10s...');
      await sleep(10000);
    }
    
    await sleep(POLL_INTERVAL);
  }
}

// Handle crashes gracefully
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err.message);
  console.log('🔄 Worker will restart...');
  // Railway will auto-restart the process
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled rejection:', err.message);
  // Don't exit, try to keep running
});

// Start
runWorker().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
