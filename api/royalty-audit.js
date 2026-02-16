/**
 * XRP Music - Mint Provenance & Royalty Audit API
 * 
 * Public-facing endpoint:
 * - 'summary': Dashboard stats (optional ?wallet= for personal view)
 * - 'secondary-sales': Secondary sales (optional ?wallet= filter)
 * - 'mint-audit': Releases by mint type (optional ?wallet= filter)
 * - 'royalty-liability': Royalty forwarding obligations (optional ?wallet=)
 * - 'sale-detail': Single sale with full details (?sale_id=)
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const action = req.query.action || req.body?.action || 'summary';
  const wallet = req.query.wallet || req.body?.wallet || null;
  
  try {
    switch (action) {
      case 'summary':
        return await getSummary(req, res, sql, wallet);
      case 'secondary-sales':
        return await getSecondarySales(req, res, sql, wallet);
      case 'mint-audit':
        return await getMintAudit(req, res, sql, wallet);
      case 'royalty-liability':
        return await getRoyaltyLiability(req, res, sql, wallet);
      case 'sale-detail':
        return await getSaleDetail(req, res, sql);
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Royalty audit error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function getSecondarySales(req, res, sql, wallet) {
  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS || '';
  
  let secondarySales;
  
  if (wallet) {
    secondarySales = await sql`
      SELECT s.id, s.release_id, s.track_id, s.buyer_address, s.seller_address,
        s.nft_token_id, s.edition_number, s.price, s.platform_fee, s.tx_hash, s.created_at,
        r.title as release_title, r.artist_name, r.artist_address,
        r.mint_fee_paid, r.is_minted, r.royalty_percent, r.cover_art_url,
        t.title as track_title
      FROM sales s
      JOIN releases r ON r.id = s.release_id
      LEFT JOIN tracks t ON t.id = s.track_id
      WHERE s.seller_address != r.artist_address
        AND s.seller_address != ${platformAddress}
        AND (r.artist_address = ${wallet} OR s.seller_address = ${wallet} OR s.buyer_address = ${wallet})
      ORDER BY s.created_at DESC
    `;
  } else {
    secondarySales = await sql`
      SELECT s.id, s.release_id, s.track_id, s.buyer_address, s.seller_address,
        s.nft_token_id, s.edition_number, s.price, s.platform_fee, s.tx_hash, s.created_at,
        r.title as release_title, r.artist_name, r.artist_address,
        r.mint_fee_paid, r.is_minted, r.royalty_percent, r.cover_art_url,
        t.title as track_title
      FROM sales s
      JOIN releases r ON r.id = s.release_id
      LEFT JOIN tracks t ON t.id = s.track_id
      WHERE s.seller_address != r.artist_address
        AND s.seller_address != ${platformAddress}
      ORDER BY s.created_at DESC
    `;
  }
  
  const salesWithRoyaltyInfo = secondarySales.map(sale => {
    const isLazyMint = sale.mint_fee_paid === true;
    const isPreMint = sale.is_minted === true && !sale.mint_fee_paid;
    const royaltyPercent = sale.royalty_percent || 5;
    const salePrice = parseFloat(sale.price) || 0;
    const royaltyAmount = salePrice * (royaltyPercent / 100);
    
    return {
      ...sale,
      mintType: isPreMint ? 'pre_mint' : 'lazy_mint',
      badgeType: isPreMint ? 'og' : 'legacy',
      royaltyPercent,
      estimatedRoyalty: royaltyAmount,
      royaltyRecipient: isLazyMint ? 'platform_wallet' : 'artist',
      royaltyOwedToArtist: isLazyMint ? royaltyAmount : 0,
    };
  });
  
  const totalRoyaltyOwed = salesWithRoyaltyInfo.reduce((sum, s) => sum + s.royaltyOwedToArtist, 0);
  
  return res.json({
    secondarySales: salesWithRoyaltyInfo,
    totalCount: salesWithRoyaltyInfo.length,
    totalRoyaltyOwedToArtists: totalRoyaltyOwed,
  });
}

async function getSaleDetail(req, res, sql) {
  const saleId = req.query.sale_id || req.body?.sale_id;
  if (!saleId) return res.status(400).json({ error: 'sale_id required' });
  
  const sale = await sql`
    SELECT s.*, r.title as release_title, r.artist_name, r.artist_address,
      r.mint_fee_paid, r.is_minted, r.royalty_percent, r.cover_art_url,
      t.title as track_title
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    LEFT JOIN tracks t ON t.id = s.track_id
    WHERE s.id = ${saleId}
  `;
  
  if (sale.length === 0) return res.status(404).json({ error: 'Sale not found' });
  
  const s = sale[0];
  const isLazyMint = s.mint_fee_paid === true;
  const royaltyPercent = s.royalty_percent || 5;
  const salePrice = parseFloat(s.price) || 0;
  
  return res.json({
    ...s,
    mintType: isLazyMint ? 'lazy_mint' : 'pre_mint',
    badgeType: isLazyMint ? 'legacy' : 'og',
    royaltyPercent,
    estimatedRoyalty: salePrice * (royaltyPercent / 100),
    royaltyRecipient: isLazyMint ? 'platform_wallet' : 'artist',
  });
}

async function getMintAudit(req, res, sql, wallet) {
  let releases;
  const whereClause = wallet ? sql`WHERE r.artist_address = ${wallet}` : sql``;
  
  releases = await sql`
    SELECT r.id, r.title, r.artist_name, r.artist_address, r.type,
      r.total_editions, r.sold_editions, r.minted_editions,
      r.mint_fee_paid, r.is_minted, r.status, r.royalty_percent,
      r.created_at, r.song_price, r.album_price, r.cover_art_url,
      (SELECT COUNT(*) FROM tracks t WHERE t.release_id = r.id) as track_count,
      (SELECT COUNT(*) FROM sales s WHERE s.release_id = r.id) as total_sales
    FROM releases r
    ${whereClause}
    ORDER BY r.created_at DESC
  `;
  
  const categorized = { preLazyMint: [], lazyMint: [], verified: [] };
  
  for (const release of releases) {
    const isPreMint = release.is_minted === true && !release.mint_fee_paid;
    const isLazyMint = release.mint_fee_paid === true;
    
    const entry = {
      ...release,
      mintType: isLazyMint ? 'lazy_mint' : 'pre_mint',
      badgeType: isPreMint ? 'og' : (isLazyMint ? 'legacy' : 'og'),
      issuerOnChain: isLazyMint ? 'platform_wallet' : 'artist',
      royaltyRecipient: isLazyMint ? 'platform_wallet' : 'artist',
    };
    
    if (isPreMint) {
      categorized.preLazyMint.push(entry);
    } else if (isLazyMint) {
      categorized.lazyMint.push(entry);
    } else {
      categorized.preLazyMint.push(entry);
    }
  }
  
  return res.json({
    releases: categorized,
    counts: {
      preLazyMint: categorized.preLazyMint.length,
      lazyMint: categorized.lazyMint.length,
      verified: categorized.verified.length,
      total: releases.length,
    },
  });
}

async function getRoyaltyLiability(req, res, sql, wallet) {
  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS || '';
  
  const walletFilter = wallet ? sql`AND r.artist_address = ${wallet}` : sql``;
  
  const liabilitySales = await sql`
    SELECT s.id as sale_id, s.price, s.tx_hash, s.created_at as sale_date,
      s.nft_token_id, s.buyer_address, s.seller_address,
      r.title as release_title, r.artist_name, r.artist_address,
      r.royalty_percent, r.cover_art_url, t.title as track_title
    FROM sales s
    JOIN releases r ON r.id = s.release_id
    LEFT JOIN tracks t ON t.id = s.track_id
    WHERE r.mint_fee_paid = true
      AND s.seller_address != r.artist_address
      AND s.seller_address != ${platformAddress}
      ${walletFilter}
    ORDER BY r.artist_address, s.created_at DESC
  `;
  
  const byArtist = {};
  for (const sale of liabilitySales) {
    const key = sale.artist_address;
    if (!byArtist[key]) {
      byArtist[key] = { artistAddress: sale.artist_address, artistName: sale.artist_name, sales: [], totalOwed: 0 };
    }
    const royaltyPercent = sale.royalty_percent || 5;
    const salePrice = parseFloat(sale.price) || 0;
    const royaltyOwed = salePrice * (royaltyPercent / 100);
    byArtist[key].sales.push({ ...sale, royaltyPercent, royaltyOwed });
    byArtist[key].totalOwed += royaltyOwed;
  }
  
  const artists = Object.values(byArtist).sort((a, b) => b.totalOwed - a.totalOwed);
  const grandTotal = artists.reduce((sum, a) => sum + a.totalOwed, 0);
  
  return res.json({ artists, grandTotalOwed: grandTotal, totalSecondarySales: liabilitySales.length });
}

async function getSummary(req, res, sql, wallet) {
  const platformAddress = process.env.PLATFORM_WALLET_ADDRESS || '';
  
  const releaseCounts = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE mint_fee_paid = true) as lazy_mint_count,
      COUNT(*) FILTER (WHERE is_minted = true AND mint_fee_paid IS NOT true) as pre_mint_count,
      COUNT(*) as total
    FROM releases
  `;
  
  const secondarySales = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as volume
    FROM sales s JOIN releases r ON r.id = s.release_id
    WHERE s.seller_address != r.artist_address AND s.seller_address != ${platformAddress}
  `;
  
  const affectedSales = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(s.price), 0) as volume
    FROM sales s JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true AND s.seller_address != r.artist_address AND s.seller_address != ${platformAddress}
  `;
  
  const royaltyLiability = await sql`
    SELECT COALESCE(SUM(s.price * COALESCE(r.royalty_percent, 5) / 100), 0) as total_owed
    FROM sales s JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true AND s.seller_address != r.artist_address AND s.seller_address != ${platformAddress}
  `;
  
  const affectedArtists = await sql`
    SELECT COUNT(DISTINCT r.artist_address) as count
    FROM sales s JOIN releases r ON r.id = s.release_id
    WHERE r.mint_fee_paid = true AND s.seller_address != r.artist_address AND s.seller_address != ${platformAddress}
  `;
  
  const result = {
    releases: {
      lazyMint: parseInt(releaseCounts[0]?.lazy_mint_count) || 0,
      preMint: parseInt(releaseCounts[0]?.pre_mint_count) || 0,
      total: parseInt(releaseCounts[0]?.total) || 0,
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
  };
  
  if (wallet) {
    const myReleases = await sql`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE mint_fee_paid = true) as lazy_mint,
        COUNT(*) FILTER (WHERE is_minted = true AND mint_fee_paid IS NOT true) as pre_mint
      FROM releases WHERE artist_address = ${wallet}
    `;
    const mySecondary = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(s.price), 0) as volume
      FROM sales s JOIN releases r ON r.id = s.release_id
      WHERE s.seller_address != r.artist_address AND s.seller_address != ${platformAddress}
        AND (r.artist_address = ${wallet} OR s.seller_address = ${wallet} OR s.buyer_address = ${wallet})
    `;
    const myOwed = await sql`
      SELECT COALESCE(SUM(s.price * COALESCE(r.royalty_percent, 5) / 100), 0) as total_owed
      FROM sales s JOIN releases r ON r.id = s.release_id
      WHERE r.mint_fee_paid = true AND s.seller_address != r.artist_address
        AND s.seller_address != ${platformAddress} AND r.artist_address = ${wallet}
    `;
    
    result.personal = {
      releases: {
        total: parseInt(myReleases[0]?.total) || 0,
        lazyMint: parseInt(myReleases[0]?.lazy_mint) || 0,
        preMint: parseInt(myReleases[0]?.pre_mint) || 0,
      },
      secondarySales: {
        count: parseInt(mySecondary[0]?.count) || 0,
        volume: parseFloat(mySecondary[0]?.volume) || 0,
      },
      royaltyOwed: parseFloat(myOwed[0]?.total_owed) || 0,
    };
  }
  
  return res.json(result);
}
