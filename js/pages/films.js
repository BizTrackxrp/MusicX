/**
 * XRP Music - Films Page
 * Coming soon — NFT-distributed films on XRPL
 */

const FilmsPage = {
  async render() {
    UI.renderPage(`
      ${this.getStyles()}
      <div class="films-page">
        <div class="films-hero">
          <div class="films-bg-grid"></div>
          <div class="films-hero-content">
            <div class="films-badge">🎬 Coming Soon</div>
            <h1 class="films-title">Films on XRP Music</h1>
            <p class="films-subtitle">
              The first platform to distribute films as NFTs on the XRP Ledger.<br>
              Own a piece of the film. Earn on every resale.
            </p>
            <div class="films-actions">
              <button class="btn btn-primary films-notify-btn" style="font-size:15px;padding:14px 32px;">
                🔔 Notify Me When It Launches
              </button>
              <button class="btn films-creator-btn" style="padding:14px 28px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);">
                🎥 I Have a Film to Release
              </button>
            </div>
          </div>
        </div>

        <div class="films-features">
          <div class="films-feature">
            <div class="films-feature-icon">🎟️</div>
            <h3>NFT Screening Passes</h3>
            <p>Mint limited edition screening passes as NFTs. Each one is a collectible and a ticket.</p>
          </div>
          <div class="films-feature">
            <div class="films-feature-icon">💰</div>
            <h3>Royalties on Resale</h3>
            <p>Every time your NFT changes hands, you earn. No middlemen, no waiting for checks.</p>
          </div>
          <div class="films-feature">
            <div class="films-feature-icon">🌐</div>
            <h3>Decentralized Distribution</h3>
            <p>Your film lives on IPFS. No streaming platform can pull it. Your work, your terms.</p>
          </div>
          <div class="films-feature">
            <div class="films-feature-icon">🤝</div>
            <h3>Direct to Audience</h3>
            <p>Build a community of actual owners. They're invested in your success — literally.</p>
          </div>
        </div>

        <div class="films-cta-banner">
          <div class="films-cta-text">
            <h2>Are you a filmmaker?</h2>
            <p>XRP Music is actively looking for indie films, documentaries, and short films to be the first titles on the platform. Get your film in front of an audience that owns what they watch.</p>
          </div>
          <button class="btn btn-primary films-creator-btn" style="font-size:15px;padding:14px 32px;white-space:nowrap;">
            🎥 Claim Your Spot
          </button>
        </div>
      </div>
    `);

    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll('.films-notify-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Modals.showToast('We\'ll reach out when Films launches! Follow @xrpmusic for updates.');
      });
    });
    document.querySelectorAll('.films-creator-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open('mailto:sales@aventra.consulting?subject=XRP Music Films - I have a film to release', '_blank');
      });
    });
  },

  getStyles() {
    return `
      <style>
        .films-page { max-width: 1100px; margin: 0 auto; padding: 0 24px 120px; }

        /* ── Hero ── */
        .films-hero {
          position: relative;
          text-align: center;
          padding: 80px 24px 72px;
          border-radius: 24px;
          overflow: hidden;
          margin-bottom: 56px;
          background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04));
          border: 1px solid rgba(239,68,68,0.2);
        }
        .films-bg-grid {
          position: absolute; inset: 0; z-index: 0;
          background-image: linear-gradient(rgba(239,68,68,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .films-hero-content { position: relative; z-index: 1; }
        .films-badge { display: inline-block; padding: 6px 16px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 20px; font-size: 13px; font-weight: 600; color: #f87171; margin-bottom: 20px; }
        .films-title { font-size: 48px; font-weight: 800; margin-bottom: 16px; }
        @media (max-width: 640px) { .films-title { font-size: 32px; } }
        .films-subtitle { font-size: 17px; color: var(--text-muted); line-height: 1.6; margin-bottom: 36px; max-width: 560px; margin-left: auto; margin-right: auto; }
        .films-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

        /* ── Features ── */
        .films-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 48px; }
        .films-feature { padding: 28px 24px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; }
        .films-feature-icon { font-size: 36px; margin-bottom: 14px; }
        .films-feature h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .films-feature p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }

        /* ── CTA Banner ── */
        .films-cta-banner { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 36px 40px; background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.05)); border: 1px solid rgba(239,68,68,0.25); border-radius: 20px; }
        @media (max-width: 700px) { .films-cta-banner { flex-direction: column; text-align: center; padding: 28px 24px; } }
        .films-cta-text h2 { font-size: 22px; font-weight: 700; margin: 0 0 10px; }
        .films-cta-text p { font-size: 14px; color: var(--text-muted); margin: 0; line-height: 1.6; max-width: 520px; }
      </style>
    `;
  },
};
