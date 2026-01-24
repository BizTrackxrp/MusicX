/**
 * XRP Music - Discord Buy Bot Notifications
 * Posts real-time purchase alerts to Discord channel
 */

// Add this to your API route that processes purchases (broker-sale.js)
// You'll need to set DISCORD_WEBHOOK_URL in your environment variables

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send a purchase notification to Discord
 * @param {Object} purchase - Purchase details
 */
async function sendDiscordBuyAlert(purchase) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }

  const {
    trackTitle,
    releaseTitle,
    artistName,
    buyerAddress,
    price,
    editionNumber,
    totalEditions,
    coverUrl,
    releaseType,
    txHash,
  } = purchase;

  // Truncate addresses for display
  const buyerShort = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
  
  // Create embed message
  const embed = {
    embeds: [
      {
        title: '🎵 New NFT Purchase!',
        color: 0x3b82f6, // Blue color matching your brand
        thumbnail: {
          url: coverUrl || 'https://xrpmusic.app/placeholder.png',
        },
        fields: [
          {
            name: '🎤 Track',
            value: trackTitle || releaseTitle,
            inline: true,
          },
          {
            name: '👤 Artist',
            value: artistName || 'Unknown Artist',
            inline: true,
          },
          {
            name: '💰 Price',
            value: `${price} XRP`,
            inline: true,
          },
          {
            name: '🏷️ Edition',
            value: `#${editionNumber} of ${totalEditions}`,
            inline: true,
          },
          {
            name: '🛒 Buyer',
            value: `\`${buyerShort}\``,
            inline: true,
          },
          {
            name: '📀 Type',
            value: releaseType || 'Single',
            inline: true,
          },
        ],
        footer: {
          text: 'XRP Music • Powered by XRPL',
          icon_url: 'https://xrpmusic.app/logo.png',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // Add transaction link if available
  if (txHash) {
    embed.embeds[0].fields.push({
      name: '🔗 Transaction',
      value: `[View on XRPL](https://livenet.xrpl.org/transactions/${txHash})`,
      inline: false,
    });
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embed),
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text());
    } else {
      console.log('✅ Discord buy alert sent!');
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

/**
 * Send a new release notification to Discord
 * @param {Object} release - Release details
 */
async function sendDiscordReleaseAlert(release) {
  if (!DISCORD_WEBHOOK_URL) return;

  const {
    title,
    artistName,
    coverUrl,
    type,
    trackCount,
    price,
    editions,
  } = release;

  const embed = {
    embeds: [
      {
        title: '🚀 New Release Dropped!',
        color: 0xa855f7, // Purple for new releases
        image: {
          url: coverUrl || 'https://xrpmusic.app/placeholder.png',
        },
        fields: [
          {
            name: '📀 Title',
            value: title,
            inline: true,
          },
          {
            name: '🎤 Artist',
            value: artistName,
            inline: true,
          },
          {
            name: '🎵 Type',
            value: `${type} • ${trackCount} track${trackCount > 1 ? 's' : ''}`,
            inline: true,
          },
          {
            name: '💰 Price',
            value: `${price} XRP`,
            inline: true,
          },
          {
            name: '📊 Editions',
            value: `${editions} available`,
            inline: true,
          },
        ],
        footer: {
          text: 'XRP Music • Be the first to collect!',
          icon_url: 'https://xrpmusic.app/logo.png',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
    console.log('✅ Discord release alert sent!');
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

/**
 * Send a milestone notification (e.g., sold out, 100 sales)
 */
async function sendDiscordMilestoneAlert(milestone) {
  if (!DISCORD_WEBHOOK_URL) return;

  const { type, releaseTitle, artistName, coverUrl, details } = milestone;

  const titles = {
    'sold_out': '🔥 SOLD OUT!',
    'first_sale': '🎉 First Sale!',
    'milestone_10': '⭐ 10 Copies Sold!',
    'milestone_50': '🌟 50 Copies Sold!',
    'milestone_100': '💫 100 Copies Sold!',
  };

  const embed = {
    embeds: [
      {
        title: titles[type] || '🎵 Milestone!',
        description: `**${releaseTitle}** by ${artistName}`,
        color: type === 'sold_out' ? 0xef4444 : 0x22c55e,
        thumbnail: {
          url: coverUrl,
        },
        fields: details ? [{ name: 'Details', value: details }] : [],
        footer: {
          text: 'XRP Music',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
  } catch (error) {
    console.error('Discord milestone error:', error);
  }
}

module.exports = {
  sendDiscordBuyAlert,
  sendDiscordReleaseAlert,
  sendDiscordMilestoneAlert,
};
