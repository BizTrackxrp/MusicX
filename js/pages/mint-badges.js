/**
 * XRP Music - Mint Provenance Badges
 * 
 * Shows the minting provenance of each release across the entire site.
 * Three tiers:
 * 
 *   OG MINT    — Pre-lazy-mint. Artist minted directly, they are the on-chain
 *                issuer. Secondary royalties flow correctly to the artist.
 * 
 *   LEGACY     — Lazy mint BEFORE the Issuer fix. Platform wallet is the
 *                on-chain issuer. Secondary royalties would go to the
 *                platform wallet instead of the artist.
 * 
 *   VERIFIED   — Lazy mint AFTER the Issuer fix. Platform mints with the
 *                Issuer field set to the artist. Royalties flow correctly.
 * 
 * Usage:
 *   MintBadge.getHTML(release)        → returns badge HTML string
 *   MintBadge.getType(release)        → returns 'og' | 'legacy' | 'verified'
 *   MintBadge.getTooltip(release)     → returns tooltip text
 *   MintBadge.injectAll()             → scans DOM and adds badges to cards
 * 
 * The fix deployment date is stored here. Update ISSUER_FIX_DATE when
 * you deploy the Issuer field fix to broker-sale.js and broker-album-sale.js.
 */

const MintBadge = {

  // ⚠️ UPDATE THIS DATE when you deploy the Issuer fix!
  // Set to null until the fix is live. Once deployed, set to the ISO date string.
  ISSUER_FIX_DATE: null, // e.g. '2026-02-17T00:00:00Z'

  /**
   * Determine mint type for a release
   * @param {Object} release - Release object with mint_fee_paid, is_minted, created_at, mintFeePaid, isMinted
   * @returns {'og'|'legacy'|'verified'}
   */
 getType(release) {
    const mintFeePaid = release.mint_fee_paid ?? release.mintFeePaid ?? false;
    const isMinted = release.is_minted ?? release.isMinted ?? false;
    const createdAt = release.created_at ?? release.createdAt;

    // Pre-lazy-mint: artist minted directly, mint fee system didn't exist
    if (isMinted && !mintFeePaid) {
      return 'og';
    }

    // Lazy mint — platform mints on demand
    if (mintFeePaid) {
      if (this.ISSUER_FIX_DATE && createdAt) {
        const fixDate = new Date(this.ISSUER_FIX_DATE);
        const releaseDate = new Date(createdAt);
        if (releaseDate >= fixDate) {
          return 'verified';
        }
      }
      return 'legacy';
    }

    // Fallback: neither minted nor mint fee paid (draft/unknown)
    return 'og';
  },
  /**
   * Get tooltip text for a mint type
   */
  getTooltip(release) {
    const type = typeof release === 'string' ? release : this.getType(release);
    switch (type) {
      case 'og':
        return 'OG Mint — Artist minted directly. On-chain issuer is the artist. Secondary royalties flow to artist.';
      case 'legacy':
        return 'Legacy Mint — Platform minted on behalf of artist. On-chain issuer is the platform wallet. Secondary royalties may need manual forwarding.';
      case 'verified':
        return 'Verified Mint — Platform minted with artist set as on-chain issuer. Secondary royalties flow to artist.';
      default:
        return '';
    }
  },

  /**
   * Get badge HTML for a release
   * @param {Object} release
   * @param {Object} options - { size: 'sm'|'md', showTooltip: boolean }
   */
  getHTML(release, options = {}) {
    const { size = 'sm', showTooltip = true } = options;
    const type = this.getType(release);
    const tooltip = showTooltip ? this.getTooltip(type) : '';
    
    const configs = {
      og: {
        label: 'OG MINT',
        icon: '⛏',
        cssClass: 'mint-badge-og',
      },
      legacy: {
        label: 'LEGACY',
        icon: '⚠',
        cssClass: 'mint-badge-legacy',
      },
      verified: {
        label: 'VERIFIED',
        icon: '✓',
        cssClass: 'mint-badge-verified',
      },
    };

    const cfg = configs[type];
    if (!cfg) return '';

    return `<span class="mint-badge mint-badge-${size} ${cfg.cssClass}" ${tooltip ? `title="${tooltip}"` : ''} data-mint-type="${type}"><span class="mint-badge-icon">${cfg.icon}</span>${cfg.label}</span>`;
  },

  /**
   * Get just the CSS class for a mint type (for custom rendering)
   */
  getClass(release) {
    const type = this.getType(release);
    return `mint-badge-${type}`;
  },

  /**
   * Inject badges into all release cards on the current page
   * Call after rendering any page with release cards.
   * 
   * Looks for elements with data-release-id and data attributes:
   *   data-mint-fee-paid, data-is-minted, data-created-at
   * 
   * Or you can just call getHTML() inline when building cards.
   */
  injectAll() {
    document.querySelectorAll('.release-card[data-mint-fee-paid]').forEach(card => {
      // Skip if already has a badge
      if (card.querySelector('.mint-badge')) return;

      const release = {
        mint_fee_paid: card.dataset.mintFeePaid === 'true',
        is_minted: card.dataset.isMinted === 'true',
        status: card.dataset.status,
        created_at: card.dataset.createdAt,
      };

      const badge = this.getHTML(release);
      const coverEl = card.querySelector('.release-card-cover');
      if (coverEl && badge) {
        coverEl.insertAdjacentHTML('beforeend', badge);
      }
    });
  },

  /**
   * Get the CSS styles for mint badges
   * Inject once into the page via <style> tag
   */
  getStyles() {
    return `
      /* ===== Mint Provenance Badges ===== */
      .mint-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: -apple-system, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-radius: 4px;
        cursor: default;
        white-space: nowrap;
        line-height: 1;
        z-index: 2;
        position: relative;
      }

      .mint-badge-icon {
        font-style: normal;
        line-height: 1;
      }

      /* Size: small (for card overlays) */
      .mint-badge-sm {
        font-size: 9px;
        padding: 3px 6px;
      }

      /* Size: medium (for modals, detail views) */
      .mint-badge-md {
        font-size: 11px;
        padding: 4px 10px;
      }

      /* OG Mint — green */
      .mint-badge-og {
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      /* Legacy — amber/warning */
      .mint-badge-legacy {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      /* Verified — blue/purple */
      .mint-badge-verified {
        background: rgba(139, 92, 246, 0.2);
        color: #a78bfa;
        border: 1px solid rgba(139, 92, 246, 0.3);
      }

      /* Positioning when inside release-card-cover */
      .release-card-cover .mint-badge {
        position: absolute;
        bottom: 8px;
        left: 8px;
      }

      /* If release-type-badge is top-left, mint-badge goes bottom-left */
      .release-card-cover .release-type-badge + .mint-badge,
      .release-card-cover .mint-badge {
        bottom: 8px;
        left: 8px;
        top: auto;
        right: auto;
      }

      /* Light theme adjustments */
      .light .mint-badge-og {
        background: rgba(34, 197, 94, 0.12);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.25);
      }

      .light .mint-badge-legacy {
        background: rgba(245, 158, 11, 0.12);
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.25);
      }

      .light .mint-badge-verified {
        background: rgba(139, 92, 246, 0.12);
        color: #7c3aed;
        border-color: rgba(139, 92, 246, 0.25);
      }

      /* In modals / detail views */
      .release-modal-badge-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }

      .release-modal-badge-row .mint-badge {
        position: static;
      }
    `;
  },

  /**
   * Initialize — inject styles into page once
   */
  init() {
    if (document.getElementById('mint-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'mint-badge-styles';
    style.textContent = this.getStyles();
    document.head.appendChild(style);
  },
};

// Auto-initialize when script loads
if (typeof document !== 'undefined') {
  MintBadge.init();
}
