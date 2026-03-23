/**
 * XRP Music - ActiveWallet Router
 *
 * Thin proxy that delegates all wallet calls to whichever wallet the user
 * connected with — Xaman or Bifrost (WalletConnect).
 *
 * Usage everywhere in the codebase:
 *   ActiveWallet.createPayment(...)
 *   ActiveWallet.acceptSellOffer(...)
 *   ... etc.
 *
 * AppState.walletType is set to 'xaman' or 'bifrost' on login.
 * If walletType is unset, defaults to XamanWallet for backwards compat.
 */

const ActiveWallet = {
  /**
   * Returns the correct wallet handler based on current session.
   */
  get() {
    if (typeof AppState !== 'undefined' && AppState.walletType === 'bifrost') {
      return BifrostWallet;
    }
    return XamanWallet;
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  isConnected() {
    return this.get().isConnected();
  },

  getAddress() {
    return this.get().getAddress();
  },

  async disconnect() {
    return this.get().disconnect();
  },

  // ── Payments ──────────────────────────────────────────────────────────────

  async createPayment(amountXRP, destination, memo) {
    return this.get().createPayment(amountXRP, destination, memo);
  },

  async payMintFee(amountXRP, destination, memo) {
    const wallet = this.get();
    // XamanWallet exposes mint fee as part of its full mint flow;
    // BifrostWallet has a dedicated payMintFee method.
    if (typeof wallet.payMintFee === 'function') {
      return wallet.payMintFee(amountXRP, destination, memo);
    }
    return wallet.createPayment(amountXRP, destination, memo);
  },

  // ── NFT Operations ────────────────────────────────────────────────────────

  async createTransferOffer(nftTokenId, destination) {
    return this.get().createTransferOffer(nftTokenId, destination);
  },

  async acceptSellOffer(offerIndex) {
    return this.get().acceptSellOffer(offerIndex);
  },

  async createSellOffer(nftTokenId, priceXRP) {
    return this.get().createSellOffer(nftTokenId, priceXRP);
  },

  async cancelSellOffer(offerIndex) {
    return this.get().cancelSellOffer(offerIndex);
  },

  // ── Misc helpers (delegated) ──────────────────────────────────────────────

  stopMintProgress() {
    return this.get().stopMintProgress?.();
  },

  xrpToDrops(xrp) {
    return this.get().xrpToDrops(xrp);
  },

  dropsToXrp(drops) {
    return this.get().dropsToXrp(drops);
  },
};
