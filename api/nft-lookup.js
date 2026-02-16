const BASE_URL = 'https://xrpmusic.io';
const PLATFORM_WALLET = 'rBvqEKtZXZk95VarHPCYWRYc6YTnLWKtkp';

async function findTestNFTs() {
  console.log('🔍 Finding legacy lazy-minted NFTs to test...\n');

  const relRes = await fetch(`${BASE_URL}/api/releases`);
  const releases = await relRes.json();

  const lazyReleases = releases.filter(r => r.mint_fee_paid === true);
  console.log(`Found ${lazyReleases.length} lazy-minted releases out of ${releases.length} total`);

  if (lazyReleases.length === 0) {
    console.log('⚠️  No lazy-minted releases found. Nothing to test.');
    return [];
  }

  lazyReleases.forEach(r => {
    console.log(`  Release #${r.id}: "${r.title}" by ${r.artist_name} (${r.artist_address})`);
  });

  const testCases = [];
  for (const rel of lazyReleases.slice(0, 5)) {
    try {
      const colRes = await fetch(`${BASE_URL}/api/collectors?release_id=${rel.id}`);
      const collectors = await colRes.json();
      if (collectors.length > 0 && collectors[0].nft_token_id) {
        testCases.push({
          nft_token_id: collectors[0].nft_token_id,
          expected_artist_address: rel.artist_address,
          expected_artist_name: rel.artist_name,
          release_title: rel.title,
          release_id: rel.id,
        });
      }
    } catch (e) {}
  }

  console.log(`\nFound ${testCases.length} NFTs to test against\n`);
  return testCases;
}

async function testSingleLookup(nftId, expected) {
  const res = await fetch(`${BASE_URL}/api/nft-lookup?nft_id=${nftId}`);
  const data = await res.json();

  const checks = {
    found: data.found === true,
    artistAddress: data.artistAddress === expected.expected_artist_address,
    notPlatformWallet: data.artistAddress !== PLATFORM_WALLET,
    artistName: data.artistName === expected.expected_artist_name,
    hasReleaseTitle: !!data.releaseTitle,
    hasTrackTitle: !!data.trackTitle,
  };

  const allPassed = Object.values(checks).every(v => v);
  const icon = allPassed ? '✅' : '❌';

  console.log(`${icon} "${expected.release_title}" — NFT ${nftId.slice(0, 16)}...`);

  if (!checks.artistAddress) {
    console.log(`   ❌ artistAddress MISMATCH: got "${data.artistAddress}", expected "${expected.expected_artist_address}"`);
  }
  if (!checks.notPlatformWallet) {
    console.log(`   ❌ CRITICAL: artistAddress is the PLATFORM WALLET — this is the bug we're preventing!`);
  }
  if (!checks.found) {
    console.log(`   ❌ NFT not found in lookup API`);
  }

  return { nftId, checks, allPassed, data };
}

async function testBatchLookup(testCases) {
  if (testCases.length < 2) {
    console.log('⏭️  Skipping batch test (need 2+ NFTs)\n');
    return;
  }

  const nftIds = testCases.map(t => t.nft_token_id);
  const res = await fetch(`${BASE_URL}/api/nft-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nft_ids: nftIds }),
  });
  const data = await res.json();

  console.log(`\n📦 Batch lookup: ${data.found} found, ${data.not_found} not found`);

  let allGood = true;
  for (const result of data.results) {
    if (!result.found) {
      console.log(`   ❌ ${result.nft_id} — not found`);
      allGood = false;
      continue;
    }

    const expected = testCases.find(t => t.nft_token_id === result.nft_id);
    if (expected && result.artistAddress !== expected.expected_artist_address) {
      console.log(`   ❌ ${result.nft_id.slice(0, 16)}... — wrong artist: ${result.artistAddress}`);
      allGood = false;
    } else if (result.artistAddress === PLATFORM_WALLET) {
      console.log(`   ❌ ${result.nft_id.slice(0, 16)}... — RETURNED PLATFORM WALLET!`);
      allGood = false;
    }
  }

  if (allGood) console.log('   ✅ All batch results correct');
}

async function testEdgeCases() {
  console.log('\n🧪 Edge case tests:');

  const fakeRes = await fetch(`${BASE_URL}/api/nft-lookup?nft_id=FAKE_TOKEN_12345`);
  console.log(`   ${fakeRes.status === 404 ? '✅' : '❌'} Fake NFT returns 404: status=${fakeRes.status}`);

  const noParamRes = await fetch(`${BASE_URL}/api/nft-lookup`);
  console.log(`   ${noParamRes.status === 400 ? '✅' : '❌'} Missing param returns 400: status=${noParamRes.status}`);

  const emptyRes = await fetch(`${BASE_URL}/api/nft-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nft_ids: [] }),
  });
  console.log(`   ${emptyRes.status === 400 ? '✅' : '❌'} Empty batch returns 400: status=${emptyRes.status}`);
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════');
  console.log(' NFT Lookup API — Legacy Track Test Suite  ');
  console.log('═══════════════════════════════════════════\n');

  const testCases = await findTestNFTs();

  if (testCases.length > 0) {
    console.log('── Single Lookup Tests ──');
    let passed = 0;
    for (const tc of testCases) {
      const result = await testSingleLookup(tc.nft_token_id, tc);
      if (result.allPassed) passed++;
    }
    console.log(`\n${passed}/${testCases.length} single lookups passed`);
  }

  console.log('\n── Batch Lookup Test ──');
  await testBatchLookup(testCases);

  await testEdgeCases();

  console.log('\n═══════════════════════════════════════════');
  console.log(' Tests complete');
  console.log('═══════════════════════════════════════════');
}

runAllTests();
