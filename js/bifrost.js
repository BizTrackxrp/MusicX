/**
 * XRP Music - Bifrost / WalletConnect Wallet Integration
 *
 * Supports Bifrost, Joey, and any other WalletConnect-compatible XRPL wallet.
 * Uses WalletConnect v2 (Reown) SignClient with the XRPL namespace.
 *
 * XRPL WalletConnect chain IDs:
 *   xrpl:0 = mainnet
 *   xrpl:1 = testnet
 *
 * RPC methods used:
 *   xrpl_signTransaction  — sign + submit a tx, returns { tx_json }
 *
 * Connect flow:
 *   - Desktop: generates WC URI → shows QR modal → user scans with wallet
 *   - Mobile:  generates WC URI → deep-links into the chosen wallet app
 *              (Bifrost / Joey / generic). QR is shown as fallback only if
 *              the deep-link fails to navigate away within 3 seconds.
 *
 * After session is established, the WC URI is no longer needed — all
 * subsequent signing is a push to the active session (no new QR).
 *
 * Project ID is fetched from /api/upload-config (REOWN_PROJECT_ID env var).
 * SDK is loaded via esm.sh dynamic import — no bundler, no UMD issues.
 */

const WC_RELAY_URL   = 'wss://relay.walletconnect.com';
const XRPL_CHAIN     = 'xrpl:0'; // mainnet (xrpl:1 = testnet)
const WC_SESSION_KEY = 'xrpmusic_wc_session';

// ─── Mobile / in-app browser detection ────────────────────────────────────────

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent);
}

function detectInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('bifrost')) return 'bifrost';
  if (ua.includes('joey')) return 'joey';
  return null;
}

// ─── Deep-link builders per wallet ────────────────────────────────────────────
//
// Each wallet defines its own URL scheme for handling WC URIs. If a scheme
// changes upstream, edit it here — nothing else in the file references them.

const WALLET_DEEP_LINKS = {
  bifrost: (uri) => `bifrostwallet://wc?uri=${encodeURIComponent(uri)}`,
  joey:    (uri) => `joey://wc?uri=${encodeURIComponent(uri)}`,
  // Generic: raw wc: URI — OS will show a wallet picker to the user
  generic: (uri) => uri,
};

// Universal-link fallbacks (https) for wallets that support them.
// These work even if the user doesn't have the app installed: the link
// opens in browser and prompts to install. Used as second-attempt fallback.
const WALLET_UNIVERSAL_LINKS = {
  bifrost: (uri) => `https://bifrostwallet.com/wc?uri=${encodeURIComponent(uri)}`,
  joey:    null, // No known universal link; relies on scheme alone
  generic: null,
};

const WALLET_LABELS = {
  bifrost: 'Bifrost',
  joey:    'Joey',
  generic: 'your wallet',
};

// ─── QR Modal HTML (desktop + mobile fallback) ───────────────────────────────

function buildQRModalHTML(walletKey) {
  const label = WALLET_LABELS[walletKey] || 'Wallet';
  const logoSrc = walletKey === 'bifrost' ? '/public/bifrost-logo.png' : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${label}" style="width:28px;height:28px;border-radius:6px;object-fit:contain;">`
    : `<span style="width:28px;height:28px;border-radius:6px;background:var(--accent,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">${label[0]}</span>`;

  return `
    <div id="wc-qr-overlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);
      z-index:99999;display:flex;align-items:center;justify-content:center;
    ">
      <div id="wc-qr-box" style="
        background:var(--bg-card,#1a1a2e);border:1px solid var(--border-color,rgba(255,255,255,0.1));
        border-radius:20px;padding:32px;max-width:400px;width:90%;text-align:center;
        box-shadow:0 24px 80px rgba(0,0,0,0.6);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${logoHtml}
            <span style="font-size:16px;font-weight:700;color:var(--text-primary,#fff);">Connect ${label}</span>
          </div>
          <button id="wc-qr-close" style="
            background:none;border:none;cursor:pointer;
            color:var(--text-muted,#888);padding:4px;border-radius:6px;
            font-size:20px;line-height:1;
          ">✕</button>
        </div>

        <div id="wc-qr-canvas-wrap" style="
          background:#fff;border-radius:12px;padding:16px;
          display:inline-block;margin-bottom:16px;
        ">
          <canvas id="wc-qr-canvas" width="240" height="240"></canvas>
        </div>

        <p style="font-size:13px;color:var(--text-secondary,#aaa);margin:0 0 16px;">
          Scan with <strong>${label} Wallet</strong> or any WalletConnect wallet
        </p>

        <button id="wc-copy-uri" style="
          width:100%;padding:10px;border-radius:10px;
          background:var(--bg-hover,rgba(255,255,255,0.07));
          border:1px solid var(--border-color,rgba(255,255,255,0.1));
          color:var(--text-secondary,#aaa);font-size:13px;cursor:pointer;
        ">Copy Connection URI</button>

        <p id="wc-qr-status" style="
          font-size:12px;color:var(--text-muted,#666);margin:12px 0 0;min-height:18px;
        "></p>
      </div>
    </div>
  `;
}

// ─── Mobile "Waiting for wallet" interstitial ─────────────────────────────────

function buildMobileInterstitialHTML(walletKey) {
  const label = WALLET_LABELS[walletKey] || 'Wallet';
  const logoSrc = walletKey === 'bifrost' ? '/public/bifrost-logo.png' : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${label}" style="width:48px;height:48px;border-radius:10px;object-fit:contain;">`
    : `<div style="width:48px;height:48px;border-radius:10px;background:var(--accent,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:24px;">${label[0]}</div>`;

  return `
    <div id="wc-mobile-overlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);
      z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;
    ">
      <div style="
        background:var(--bg-card,#1a1a2e);border:1px solid var(--border-color,rgba(255,255,255,0.1));
        border-radius:20px;padding:28px 24px;max-width:380px;width:100%;text-align:center;
        box-shadow:0 24px 80px rgba(0,0,0,0.6);
      ">
        <div style="display:flex;justify-content:center;margin-bottom:16px;">
          ${logoHtml}
        </div>

        <h3 style="font-size:18px;font-weight:700;color:var(--text-primary,#fff);margin:0 0 8px;">
          Opening ${label}…
        </h3>

        <p style="font-size:14px;color:var(--text-secondary,#aaa);margin:0 0 20px;line-height:1.5;">
          Approve the connection request in ${label}, then return here.
        </p>

        <div style="
          width:32px;height:32px;border:3px solid rgba(255,255,255,0.1);
          border-top-color:var(--accent,#7c3aed);border-radius:50%;
          margin:0 auto 20px;animation:wc-spin 0.8s linear infinite;
        "></div>

        <button id="wc-mobile-retry" style="
          width:100%;padding:12px;border-radius:10px;margin-bottom:8px;
          background:var(--accent,#7c3aed);border:none;color:#fff;
          font-size:14px;font-weight:600;cursor:pointer;
        ">Didn't open? Tap to retry</button>

        <button id="wc-mobile-show-qr" style="
          width:100%;padding:10px;border-radius:10px;margin-bottom:8px;
          background:var(--bg-hover,rgba(255,255,255,0.07));
          border:1px solid var(--border-color,rgba(255,255,255,0.1));
          color:var(--text-secondary,#aaa);font-size:13px;cursor:pointer;
        ">Show QR code instead</button>

        <button id="wc-mobile-cancel" style="
          width:100%;padding:8px;background:none;border:none;
          color:var(--text-muted,#666);font-size:12px;cursor:pointer;
        ">Cancel</button>
      </div>
    </div>
    <style>
      @keyframes wc-spin { to { transform: rotate(360deg); } }
    </style>
  `;
}

// ─── QR Code renderer ─────────────────────────────────────────────────────────

async function renderQRToCanvas(canvas, text) {
  if (typeof QRCode === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
  }
  const tmp = document.createElement('div');
  tmp.style.display = 'none';
  document.body.appendChild(tmp);
  try {
    new QRCode(tmp, {
      text,
      width: 240,
      height: 240,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    await new Promise(r => setTimeout(r, 100));
    const img = tmp.querySelector('img') || tmp.querySelector('canvas');
    if (img) {
      const ctx = canvas.getContext('2d');
      const drawImg = new Image();
      drawImg.onload = () => ctx.drawImage(drawImg, 0, 0, 240, 240);
      drawImg.src = img.src || img.toDataURL();
    }
  } catch (e) {
    console.error('QR render error', e);
  } finally {
    document.body.removeChild(tmp);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Main BifrostWallet object ────────────────────────────────────────────────

const BifrostWallet = {
  client: null,
  session: null,
  initialized: false,
  isConnecting: false,

  // Deep-link timeout fallback handle
  _deepLinkFallbackTimer: null,

  // ── Init ───────────────────────────────────────────────────────────────────

  async init() {
    if (this.initialized) return;
    try {
      const configRes = await fetch('/api/upload-config');
      const config = await configRes.json();
      const projectId = config.reownProjectId;
      if (!projectId) throw new Error('Reown project ID not configured — add REOWN_PROJECT_ID to Vercel env vars');

      await this._loadSDK();

      this.client = await window.SignClient.init({
        projectId,
        relayUrl: WC_RELAY_URL,
        metadata: {
          name: 'XRP Music',
          description: 'Music NFT marketplace on the XRP Ledger',
          url: 'https://xrpmusic.io',
          icons: ['https://xrpmusic.io/public/bifrost-logo.png'],
        },
      });

      this.client.on('session_event',  (e) => console.log('WC session_event', e));
      this.client.on('session_update', ({ topic, params }) => {
        this.session = { ...this.session, namespaces: params.namespaces };
      });
      this.client.on('session_delete', () => {
        console.log('WC session deleted by wallet');
        this._onDisconnect();
      });

      await this._restoreSession();

      this.initialized = true;
      console.log('BifrostWallet initialized ✓');
    } catch (err) {
      console.error('BifrostWallet init error:', err);
      throw err;
    }
  },

  // ── Load SDK via esm.sh dynamic import (no bundler needed) ────────────────

  async _loadSDK() {
    if (window.SignClient) return;
    try {
      console.log('Loading WalletConnect SDK via esm.sh...');
      const module = await import('https://esm.sh/@walletconnect/sign-client@2.17.0');
      window.SignClient = module.SignClient || module.default?.SignClient || module.default;
      if (!window.SignClient) throw new Error('SignClient not found in module exports');
      console.log('WalletConnect SDK loaded ✓');
    } catch (err) {
      console.error('esm.sh load failed:', err);
      throw new Error('WalletConnect SDK failed to load: ' + err.message);
    }
  },

  // ── Session management ─────────────────────────────────────────────────────

  async _restoreSession() {
    try {
      const stored = sessionStorage.getItem(WC_SESSION_KEY);
      if (!stored) return;
      const { topic } = JSON.parse(stored);
      const sessions = this.client.session.getAll();
      const existing = sessions.find(s => s.topic === topic);
      if (existing) {
        this.session = existing;
        const address = this._extractAddress(existing);
        if (address) {
          console.log('WC session restored:', address);
          saveSession(address);
          AppState.walletType = 'bifrost';
          await this._afterLogin(address);
        }
      } else {
        sessionStorage.removeItem(WC_SESSION_KEY);
      }
    } catch (e) {
      console.warn('WC session restore error:', e);
      sessionStorage.removeItem(WC_SESSION_KEY);
    }
  },

  _extractAddress(session) {
    try {
      const accounts = session.namespaces?.xrpl?.accounts || [];
      const entry = accounts.find(a => a.startsWith('xrpl:0:'));
      return entry ? entry.split(':')[2] : null;
    } catch {
      return null;
    }
  },

  _saveSession(session) {
    this.session = session;
    sessionStorage.setItem(WC_SESSION_KEY, JSON.stringify({ topic: session.topic }));
  },

  async _onDisconnect() {
    this.session = null;
    sessionStorage.removeItem(WC_SESSION_KEY);
    AppState.walletType = null;
    clearSession();
    UI.updateAuthUI();
    UI.showLoggedOutState();
    if (typeof MintNotifications !== 'undefined') MintNotifications.cleanup();
  },

  async _afterLogin(address) {
    try {
      await XamanWallet.loadUserData(address);
    } catch (e) {
      console.warn('loadUserData error (bifrost)', e);
    }
    AppState.walletType = 'bifrost';
    UI.updateAuthUI();
    UI.showLoggedInState();
    if (typeof MintNotifications !== 'undefined') MintNotifications.init();
  },

  // ── Connect ────────────────────────────────────────────────────────────────
  //
  // walletChoice: 'bifrost' | 'joey' | 'generic' | 'auto'
  //   'auto' (default) → uses in-app browser detection, falls back to 'bifrost'
  //
  // Desktop:  always shows QR modal (existing behavior).
  // Mobile:   deep-links into the chosen wallet, with QR as fallback.

  async connect(walletChoice = 'auto') {
    if (!this.client || this.isConnecting) return;
    this.isConnecting = true;

    // Resolve walletChoice
    if (walletChoice === 'auto') {
      walletChoice = detectInAppBrowser() || 'bifrost';
    }
    if (!WALLET_DEEP_LINKS[walletChoice]) {
      walletChoice = 'generic';
    }

    try {
      const { uri, approval } = await this.client.connect({
        requiredNamespaces: {
          xrpl: {
            methods: ['xrpl_signTransaction'],
            chains: [XRPL_CHAIN],
            events: [],
          },
        },
      });

      if (!uri) throw new Error('No WalletConnect URI generated');

      // Branch on platform
      if (isMobile()) {
        this._showMobileInterstitial(uri, walletChoice);
      } else {
        this._showQRModal(uri, walletChoice);
      }

      // Wait for approval (resolves once user signs in the wallet)
      const session = await approval();

      this._dismissAllModals();
      this._saveSession(session);

      const address = this._extractAddress(session);
      if (!address) throw new Error('Could not extract XRPL address from WC session');

      console.log(`${WALLET_LABELS[walletChoice]} connected:`, address);
      saveSession(address);
      localStorage.setItem('xrpmusic_user', JSON.stringify({ address }));
      await this._afterLogin(address);

      if (typeof Modals !== 'undefined' && Modals.close) Modals.close();

    } catch (err) {
      this._dismissAllModals();
      console.error('WC connect error:', err);
      if (err.message && !err.message.includes('cancelled')) {
        if (typeof Modals !== 'undefined' && Modals.showToast) {
          Modals.showToast(`${WALLET_LABELS[walletChoice]} connection failed. Please try again.`);
        }
      }
    } finally {
      this.isConnecting = false;
      this._clearDeepLinkFallback();
    }
  },

  // ── Mobile interstitial + deep-link logic ─────────────────────────────────

  _showMobileInterstitial(uri, walletKey) {
    this._dismissAllModals();

    const wrap = document.createElement('div');
    wrap.id = 'wc-mobile-root';
    wrap.innerHTML = buildMobileInterstitialHTML(walletKey);
    document.body.appendChild(wrap);

    // Trigger the deep-link
    this._triggerDeepLink(uri, walletKey);

    // Wire up retry / show-qr / cancel
    document.getElementById('wc-mobile-retry')?.addEventListener('click', () => {
      this._triggerDeepLink(uri, walletKey);
    });

    document.getElementById('wc-mobile-show-qr')?.addEventListener('click', () => {
      this._dismissAllModals();
      this._showQRModal(uri, walletKey);
    });

    document.getElementById('wc-mobile-cancel')?.addEventListener('click', () => {
      this._dismissAllModals();
      this.isConnecting = false;
      // Note: we don't reject the connect promise here; the user can re-tap Connect
    });

    // Safety net: if after 4 seconds the user is still on this page (deep-link
    // didn't fire), surface the QR option more prominently.
    this._deepLinkFallbackTimer = setTimeout(() => {
      const status = document.getElementById('wc-mobile-show-qr');
      if (status) {
        status.style.background = 'var(--accent,#7c3aed)';
        status.style.color = '#fff';
        status.style.borderColor = 'transparent';
        status.textContent = 'Wallet didn\'t open — show QR code';
      }
    }, 4000);
  },

  _triggerDeepLink(uri, walletKey) {
    const builder = WALLET_DEEP_LINKS[walletKey] || WALLET_DEEP_LINKS.generic;
    const deepLink = builder(uri);

    console.log(`Deep-linking to ${walletKey}:`, deepLink.slice(0, 80) + '...');

    // Primary attempt: scheme-based deep link
    window.location.href = deepLink;

    // Universal-link fallback after 1.5s if user is still here
    const universalBuilder = WALLET_UNIVERSAL_LINKS[walletKey];
    if (universalBuilder) {
      setTimeout(() => {
        if (!document.hidden) {
          const universalLink = universalBuilder(uri);
          console.log(`Universal-link fallback to ${walletKey}:`, universalLink.slice(0, 80) + '...');
          window.location.href = universalLink;
        }
      }, 1500);
    }
  },

  _clearDeepLinkFallback() {
    if (this._deepLinkFallbackTimer) {
      clearTimeout(this._deepLinkFallbackTimer);
      this._deepLinkFallbackTimer = null;
    }
  },

  // ── QR modal (desktop, or mobile fallback) ────────────────────────────────

  _showQRModal(uri, walletKey = 'bifrost') {
    this._dismissAllModals();

    const wrap = document.createElement('div');
    wrap.id = 'wc-qr-root';
    wrap.innerHTML = buildQRModalHTML(walletKey);
    document.body.appendChild(wrap);

    const canvas = document.getElementById('wc-qr-canvas');
    if (canvas) renderQRToCanvas(canvas, uri);

    document.getElementById('wc-qr-close')?.addEventListener('click', () => {
      this._dismissAllModals();
      this.isConnecting = false;
    });

    document.getElementById('wc-copy-uri')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(uri);
        const btn = document.getElementById('wc-copy-uri');
        if (btn) {
          btn.textContent = '✓ Copied!';
          setTimeout(() => { if (btn) btn.textContent = 'Copy Connection URI'; }, 2000);
        }
      } catch {}
    });
  },

  _dismissAllModals() {
    document.getElementById('wc-qr-root')?.remove();
    document.getElementById('wc-mobile-root')?.remove();
    this._clearDeepLinkFallback();
  },

  // Backwards compatibility
  _dismissQRModal() { this._dismissAllModals(); },

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async disconnect() {
    if (this.session && this.client) {
      try {
        await this.client.disconnect({
          topic: this.session.topic,
          reason: { code: 6000, message: 'User disconnected' },
        });
      } catch (e) {
        console.warn('WC disconnect error:', e);
      }
    }
    await this._onDisconnect();
  },

  isConnected() {
    return !!AppState.user?.address && AppState.walletType === 'bifrost';
  },

  getAddress() {
    return AppState.user?.address || null;
  },

  // ── Core signing helper ────────────────────────────────────────────────────
  //
  // After session is established, signing also benefits from deep-linking
  // on mobile — the request would otherwise sit silently until the user
  // manually opens the wallet. We fire the deep-link to nudge focus to
  // the wallet, then await the signing response.

  async _signTx(txJson) {
    if (!this.session) throw new Error('No active Bifrost session — please connect first');
    if (!this.client) throw new Error('WalletConnect not initialized');

    // On mobile, nudge the user back to their wallet so the request is visible.
    // We use the wallet's own deep-link with no URI — most wallets interpret
    // a bare scheme as "open the app".
    if (isMobile()) {
      try {
        const walletKey = detectInAppBrowser() || 'bifrost';
        const wakeLink = walletKey === 'bifrost'
          ? 'bifrostwallet://'
          : walletKey === 'joey'
            ? 'joey://'
            : null;
        if (wakeLink) {
          // Fire-and-forget; don't block signing on this.
          setTimeout(() => { window.location.href = wakeLink; }, 50);
        }
      } catch (e) {
        // Non-fatal
      }
    }

    try {
      const result = await this.client.request({
        topic: this.session.topic,
        chainId: XRPL_CHAIN,
        request: {
          method: 'xrpl_signTransaction',
          params: { tx_json: txJson },
        },
      });

      const hash = result?.tx_json?.hash || result?.hash || null;
      console.log('WC tx signed & submitted, hash:', hash);
      return { success: true, txHash: hash };
    } catch (err) {
      console.error('WC signTx error:', err);
      if (err?.message?.toLowerCase().includes('reject') ||
          err?.message?.toLowerCase().includes('cancel') ||
          err?.code === 5000) {
        return { success: false, txHash: null, error: 'rejected' };
      }
      throw err;
    }
  },

  // ── Public signing methods (mirror XamanWallet interface) ─────────────────

  async createPayment(amountXRP, destination, memo) {
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    console.log(`[Bifrost] createPayment: ${amountXRP} XRP → ${destination}`);
    const drops = Math.floor(amountXRP * 1_000_000).toString();
    return this._signTx({
      TransactionType: 'Payment',
      Account: AppState.user.address,
      Destination: destination,
      Amount: drops,
      Memos: [{ Memo: { MemoType: this._toHex('XRPMusic'), MemoData: this._toHex(memo || `XRP Music payment: ${amountXRP} XRP`) } }],
    });
  },

  async createTransferOffer(nftTokenId, destination) {
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    console.log('[Bifrost] createTransferOffer:', nftTokenId);
    const result = await this._signTx({
      TransactionType: 'NFTokenCreateOffer',
      Account: AppState.user.address,
      NFTokenID: nftTokenId,
      Amount: '0',
      Flags: 1,
      Destination: destination,
      Memos: [{ Memo: { MemoType: this._toHex('XRPMusic'), MemoData: this._toHex('NFT listing transfer') } }],
    });
    if (result.success && result.txHash) {
      try {
        const offerIndex = await this._getOfferIndexFromTx(result.txHash);
        if (offerIndex) result.offerIndex = offerIndex;
      } catch (e) {
        console.warn('[Bifrost] Could not extract offer index:', e);
      }
    }
    return result;
  },

  async acceptSellOffer(offerIndex) {
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    console.log('[Bifrost] acceptSellOffer:', offerIndex);
    return this._signTx({
      TransactionType: 'NFTokenAcceptOffer',
      Account: AppState.user.address,
      NFTokenSellOffer: offerIndex,
      Memos: [{ Memo: { MemoType: this._toHex('XRPMusic'), MemoData: this._toHex('XRP Music NFT purchase') } }],
    });
  },

  async createSellOffer(nftTokenId, priceXRP) {
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    console.log('[Bifrost] createSellOffer:', nftTokenId, priceXRP, 'XRP');
    const drops = Math.floor(priceXRP * 1_000_000).toString();
    const result = await this._signTx({
      TransactionType: 'NFTokenCreateOffer',
      Account: AppState.user.address,
      NFTokenID: nftTokenId,
      Amount: drops,
      Flags: 1,
      Memos: [{ Memo: { MemoType: this._toHex('XRPMusic'), MemoData: this._toHex(`XRP Music listing: ${priceXRP} XRP`) } }],
    });
    if (result.success && result.txHash) {
      try {
        const offerIndex = await this._getOfferIndexFromTx(result.txHash);
        if (offerIndex) result.offerIndex = offerIndex;
      } catch (e) {
        console.warn('[Bifrost] Could not extract offer index from sell offer:', e);
      }
    }
    return result;
  },

  async cancelSellOffer(offerIndex) {
    if (!AppState.user?.address) throw new Error('Wallet not connected');
    console.log('[Bifrost] cancelSellOffer:', offerIndex);
    return this._signTx({
      TransactionType: 'NFTokenCancelOffer',
      Account: AppState.user.address,
      NFTokenOffers: [offerIndex],
      Memos: [{ Memo: { MemoType: this._toHex('XRPMusic'), MemoData: this._toHex('Cancel NFT offer') } }],
    });
  },

  async payMintFee(amountXRP, destination, memo) {
    return this.createPayment(amountXRP, destination, memo);
  },

  // ── XRPL helpers ──────────────────────────────────────────────────────────

  async _getOfferIndexFromTx(txHash) {
    const XRPL_NODE = 'https://s1.ripple.com';
    try {
      const res = await fetch(XRPL_NODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tx',
          params: [{ transaction: txHash, binary: false }],
        }),
      });
      const data = await res.json();
      const nodes = data?.result?.meta?.AffectedNodes || [];
      for (const node of nodes) {
        const created = node.CreatedNode;
        if (created?.LedgerEntryType === 'NFTokenOffer') {
          return created.LedgerIndex;
        }
      }
    } catch (e) {
      console.warn('[Bifrost] _getOfferIndexFromTx error:', e);
    }
    return null;
  },

  _toHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
  },

  xrpToDrops(xrp) {
    return Math.floor(xrp * 1_000_000).toString();
  },

  dropsToXrp(drops) {
    return Number(drops) / 1_000_000;
  },

  stopMintProgress() {},
};
