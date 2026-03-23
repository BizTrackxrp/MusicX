/**
 * XRP Music - Bifrost / WalletConnect Wallet Integration
 * 
 * Supports Bifrost and any other WalletConnect-compatible XRPL wallet.
 * Uses WalletConnect v2 (Reown) SignClient with the XRPL namespace.
 * 
 * XRPL WalletConnect chain IDs:
 *   xrpl:0 = mainnet
 *   xrpl:1 = testnet
 * 
 * RPC methods used:
 *   xrpl_signTransaction  — sign + submit a tx, returns { tx_json }
 * 
 * Flow:
 *   1. connect() → generates WC URI → shows QR modal → user scans with Bifrost
 *   2. Session established → extract XRPL address from account "xrpl:0:rADDRESS"
 *   3. All subsequent signing is a push to the active WC session (no new QR)
 * 
 * Project ID is fetched from /api/upload-config (stored in Vercel env as REOWN_PROJECT_ID)
 * SDK is loaded via esm.sh dynamic import — no bundler needed, no CDN UMD issues.
 */

const WC_RELAY_URL   = 'wss://relay.walletconnect.com';
const XRPL_CHAIN     = 'xrpl:0'; // mainnet (xrpl:1 = testnet)
const WC_SESSION_KEY = 'xrpmusic_wc_session';

// ─── QR Modal HTML ────────────────────────────────────────────────────────────

function buildQRModalHTML() {
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
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="/public/bifrost-logo.png" alt="Bifrost" style="width:28px;height:28px;border-radius:6px;object-fit:contain;">
            <span style="font-size:16px;font-weight:700;color:var(--text-primary,#fff);">Connect Bifrost</span>
          </div>
          <button id="wc-qr-close" style="
            background:none;border:none;cursor:pointer;
            color:var(--text-muted,#888);padding:4px;border-radius:6px;
            font-size:20px;line-height:1;
          ">✕</button>
        </div>

        <!-- QR canvas area -->
        <div id="wc-qr-canvas-wrap" style="
          background:#fff;border-radius:12px;padding:16px;
          display:inline-block;margin-bottom:16px;
        ">
          <canvas id="wc-qr-canvas" width="240" height="240"></canvas>
        </div>

        <p style="font-size:13px;color:var(--text-secondary,#aaa);margin:0 0 16px;">
          Scan with <strong>Bifrost Wallet</strong> or any WalletConnect wallet
        </p>

        <!-- Copy URI button -->
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

  // ── Init ───────────────────────────────────────────────────────────────────

  async init() {
    if (this.initialized) return;
    try {
      // Fetch project ID from server (stored in Vercel env as REOWN_PROJECT_ID)
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
      // mainnet accounts are prefixed xrpl:0:rADDRESS
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

  // ── Connect (shows QR modal) ───────────────────────────────────────────────

  async connect() {
    if (!this.client || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const { uri, approval } = await this.client.connect({
        requiredNamespaces: {
          xrpl: {
            methods: ['xrpl_signTransaction'],
            chains: [XRPL_CHAIN], // xrpl:0 mainnet
            events: [],
          },
        },
      });

      if (!uri) throw new Error('No WalletConnect URI generated');

      this._showQRModal(uri);

      const session = await approval();
      this._dismissQRModal();
      this._saveSession(session);

      const address = this._extractAddress(session);
      if (!address) throw new Error('Could not extract XRPL address from WC session');

      console.log('Bifrost connected:', address);
      saveSession(address);
      localStorage.setItem('xrpmusic_user', JSON.stringify({ address }));
      await this._afterLogin(address);

      if (typeof Modals !== 'undefined' && Modals.close) Modals.close();

    } catch (err) {
      this._dismissQRModal();
      console.error('Bifrost connect error:', err);
      if (err.message && !err.message.includes('cancelled')) {
        if (typeof Modals !== 'undefined' && Modals.showToast) {
          Modals.showToast('Bifrost connection failed. Please try again.');
        }
      }
    } finally {
      this.isConnecting = false;
    }
  },

  // ── QR modal helpers ───────────────────────────────────────────────────────

  _showQRModal(uri) {
    this._dismissQRModal();
    const wrap = document.createElement('div');
    wrap.id = 'wc-qr-root';
    wrap.innerHTML = buildQRModalHTML();
    document.body.appendChild(wrap);

    const canvas = document.getElementById('wc-qr-canvas');
    if (canvas) renderQRToCanvas(canvas, uri);

    document.getElementById('wc-qr-close')?.addEventListener('click', () => {
      this._dismissQRModal();
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

  _dismissQRModal() {
    document.getElementById('wc-qr-root')?.remove();
  },

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

  async _signTx(txJson) {
    if (!this.session) throw new Error('No active Bifrost session — please connect first');
    if (!this.client) throw new Error('WalletConnect not initialized');

    try {
      const result = await this.client.request({
        topic: this.session.topic,
        chainId: XRPL_CHAIN, // xrpl:0 mainnet
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
