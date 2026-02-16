/**
 * XRP Music - Royalty Audit API
 * 
 * Admin endpoint to track:
 * 1. All secondary market sales (resales) on the platform
 * 2. All NFTs categorized by mint type (pre-lazy-mint vs lazy-mint)
 * 3. Royalty liability - which lazy-minted NFTs have been resold
 *    and where the royalty went (platform wallet vs artist)
 * 
 * Actions:
 * - 'secondary-sales': All secondary market sales
 * - 'mint-audit': All releases categorized by mint type
 * - 'royalty-liability': NFTs where royalty may have gone to wrong wallet
 * - 'summary': Dashboard summary stats
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const action = req.query.action || req.body?.action || 'summary';
  
  try {
    switch (action) {
      case 'secondary-sales':
        return await getSecondarySales(req, res, sql);
      case 'mint-audit':
        return await getMintAudit(req, res, sql);
      case 'royalty-liability':
        return await getRoyaltyLiability(req, res, sql);
      case 'summary':
        return await getSummary(req, res, sql);
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Royalty audit error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get all secondary market sales
 * A secondary sale is where the seller is NOT the platform and NOT the original artist
 * These are resales by collectors
 */
async function getSecondarySales(req, res, sql) {
  // Get all sales where the seller is not the artist for that release
  // This catches resales on our platform
  const secondarySales = await sql`
    SELECT 
      s.id,
      s.release_id,
      s.track_id,
      s.buyer_address,
      s.seller_address,
      s.nft_token_id,
      s.edition_number,
      s.price,
      s.platform_fee,
      s.tx_hash,
      s.created_at,
      r.title as release_title,
      r.artist_name,
      r.artist_address,
      r.mint_fee_paid,
      r.is_minted,
      r.royalty_percent,
      t.title as track_title
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    LEFT JOIN tracks t ON t.id = s.track_id
    WHERE s.seller_address != r.artist_address
      AND s.seller_address != ${process.env.PLATFORM_WALLET_ADDRESS || ''}
    ORDER BY s.created_at DESC
  `;
  
  // Calculate royalty impact for each secondary sale
  const salesWithRoyaltyInfo = secondarySales.map(sale => {
    const isLazyMint = sale.mint_fee_paid === true;
    const royaltyPercent = sale.royalty_percent || 5;
    const salePrice = parseFloat(sale.price) || 0;
    const royaltyAmount = salePrice * (royaltyPercent / 100);
    
    return {
      ...sale,
      mintType: isLazyMint ? 'lazy_mint' : 'pre_mint',
      royaltyPercent,
      estimatedRoyalty: royaltyAmount,
      // For lazy-minted NFTs (without the Issuer fix), royalty goes to platform wallet
      // For pre-minted NFTs, royalty goes to the artist (they were the original minter)
      royaltyRecipient: isLazyMint ? 'platform_wallet' : 'artist',
      royaltyOwedToArtist: isLazyMint ? royaltyAmount : 0,
    };
  });
  
  const totalRoyaltyOwed = salesWithRoyaltyInfo
    .reduce((sum, s) => sum + s.royaltyOwedToArtist, 0);
  
  return res.json({
    secondarySales: salesWithRoyaltyInfo,
    totalCount: salesWithRoyaltyInfo.length,
    totalRoyaltyOwedToArtists: totalRoyaltyOwed,
  });
}

/**
 * Get all releases/tracks categorized by mint type
 * Pre-lazy-mint: artist minted directly (is_minted=true, mint_fee_paid=false/null)
 * Post-lazy-mint: platform mints on behalf (mint_fee_paid=true)
 */
async function getMintAudit(req, res, sql) {
  const releases = await sql`
    SELECT 
      r.id,
      r.title,
      r.artist_name,
      r.artist_address,
      r.type,
      r.total_editions,
      r.sold_editions,
      r.minted_editions,
      r.mint_fee_paid,
      r.is_minted,
      r.status,
      r.royalty_percent,
      r.created_at,
      r.song_price,
      r.album_price,
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'sold_count', COALESCE(t.sold_count, 0),
            'minted_editions', COALESCE(t.minted_editions, 0)
          )
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as tracks,
      (SELECT COUNT(*) FROM sales s WHERE s.release_id = r.id) as total_sales,
      (SELECT COUNT(*) FROM nfts n WHERE n.release_id = r.id) as total_nfts_tracked
    FROM releases r
    LEFT JOIN tracks t ON t.release_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  
  const categorized = {
    preLazyMint: [],
    lazyMint: [],
    lazyMintPreFix: [],  // lazy mint but before issuer fix
  };
  
  for (const release of releases) {
    const mintType = release.mint_fee_paid === true ? 'lazy_mint' : 'pre_mint';
    const entry = {
      ...release,
      mintType,
      trackCount: release.tracks?.length || 0,
      issuerOnChain: mintType === 'lazy_mint' ? 'platform_wallet' : 'artist',
      royaltyRecipient: mintType === 'lazy_mint' ? 'platform_wallet' : 'artist',
    };
    
    if (mintType === 'pre_mint') {
      categorized.preLazyMint.push(entry);
    } else {
      // All lazy mint releases before the Issuer fix
      categorized.lazyMint.push(entry);
      categorized.lazyMintPreFix.push(entry);
    }
  }
  
  return res.json({
    releases: categorized,
    counts: {
      preLazyMint: categorized.preLazyMint.length,
      lazyMint: categorized.lazyMint.length,
      lazyMintPreFix: categorized.lazyMintPreFix.length,
      total: releases.length,
    },
  });
}

/**
 * Get royalty liability - which artists are owed money from
 * secondary sales on lazy-minted NFTs
 */
async function getRoyaltyLiability(req, res, sql) {
  // Find all secondary sales on lazy-minted releases
  const liabilitySales = await sql`
    SELECT 
      s.id as sale_id,
      s.price,
      s.tx_hash,
      s.created_at as sale_date,
      s.nft_token_id,
      s.buyer_address,
      s.seller_address,
      r.title as release_title,
      r.artist_name,
      r.artist_address,
      r.royalty_percent,
      t.title as track_title
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    LEFT JOIN tracks t ON t.id = s.track_id
    WHERE r.mint_fee_paid = true
      AND s.seller_address != r.artist_address
      AND s.seller_address != ${process.env.PLATFORM_WALLET_ADDRESS || ''}
    ORDER BY r.artist_address, s.created_at DESC
  `;
  
  // Group by artist
  const byArtist = {};
  
  for (const sale of liabilitySales) {
    const key = sale.artist_address;
    if (!byArtist[key]) {
      byArtist[key] = {
        artistAddress: sale.artist_address,
        artistName: sale.artist_name,
        sales: [],
        totalOwed: 0,
      };
    }
    
    const royaltyPercent = sale.royalty_percent || 5;
    const salePrice = parseFloat(sale.price) || 0;
    const royaltyOwed = salePrice * (royaltyPercent / 100);
    
    byArtist[key].sales.push({
      ...sale,
      royaltyPercent,
      royaltyOwed,
    });
    byArtist[key].totalOwed += royaltyOwed;
  }
  
  const artists = Object.values(byArtist).sort((a, b) => b.totalOwed - a.totalOwed);
  const grandTotal = artists.reduce((sum, a) => sum + a.totalOwed, 0);
  
  return res.json({
    artists,
    grandTotalOwed: grandTotal,
    totalSecondarySales: liabilitySales.length,
  });
}

/**
 * Dashboard summary
 */
async function getSummary(req, res, sql) {
  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS || '';
  
  // Total releases by mint type
  const releaseCounts = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE mint_fee_paid = true) as lazy_mint_count,
      COUNT(*) FILTER (WHERE mint_fee_paid IS NOT true AND (is_minted = true OR status = 'live')) as pre_mint_count,
      COUNT(*) as total
    FROM releases
  `;
  
  // Total primary sales
  const primarySales = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as volume
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    WHERE s.seller_address = r.artist_address
      OR s.seller_address = ${platformAddress}
  `;
  
  // Total secondary sales  
  const secondarySales = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as volume
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    WHERE s.seller_address != r.artist_address
      AND s.seller_address != ${platformAddress}
  `;
  
  // Secondary sales on lazy-minted NFTs (royalty went to wrong place)
  const affectedSales = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(s.price), 0) as volume
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true
      AND s.seller_address != r.artist_address
      AND s.seller_address != ${platformAddress}
  `;
  
  // Estimated royalty liability
  const royaltyLiability = await sql`
    SELECT COALESCE(SUM(s.price * COALESCE(r.royalty_percent, 5) / 100), 0) as total_owed
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true
      AND s.seller_address != r.artist_address
      AND s.seller_address != ${platformAddress}
  `;
  
  // Unique affected artists
  const affectedArtists = await sql`
    SELECT COUNT(DISTINCT r.artist_address) as count
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true
      AND s.seller_address != r.artist_address
      AND s.seller_address != ${platformAddress}
  `;
  
  // Total NFTs minted by type
  const nftCounts = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE r.mint_fee_paid = true) as lazy_minted,
      COUNT(*) FILTER (WHERE r.mint_fee_paid IS NOT true) as pre_minted,
      COUNT(*) as total
    FROM nfts n
    JOIN releases r ON r.id = n.release_id
  `;
  
  return res.json({
    releases: {
      lazyMint: parseInt(releaseCounts[0]?.lazy_mint_count) || 0,
      preMint: parseInt(releaseCounts[0]?.pre_mint_count) || 0,
      total: parseInt(releaseCounts[0]?.total) || 0,
    },
    primarySales: {
      count: parseInt(primarySales[0]?.count) || 0,
      volume: parseFloat(primarySales[0]?.volume) || 0,
    },
    secondarySales: {
      count: parseInt(secondarySales[0]?.count) || 0,
      volume: parseFloat(secondarySales[0]?.volume) || 0,
    },
    royaltyIssue: {
      affectedSalesCount: parseInt(affectedSales[0]?.count) || 0,
      affectedSalesVolume: parseFloat(affectedSales[0]?.volume) || 0,
      estimatedRoyaltyOwed: parseFloat(royaltyLiability[0]?.total_owed) || 0,
      affectedArtists: parseInt(affectedArtists[0]?.count) || 0,
    },
    nfts: {
      lazyMinted: parseInt(nftCounts[0]?.lazy_minted) || 0,
      preMinted: parseInt(nftCounts[0]?.pre_minted) || 0,
      total: parseInt(nftCounts[0]?.total) || 0,
    },
  });
}
