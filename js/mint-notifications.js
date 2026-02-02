/**
 * XRP Music - Notifications System
 * Shows mint status, artist sale notifications, AND gift notifications
 */

const MintNotifications = {
  dropdown: null,
  polling: null,
  
  /**
   * Initialize notifications - called by xaman.js on session restore
   */
  init() {
    this.checkForActiveJobs();
  },
  
  /**
   * Cleanup on logout
   */
  cleanup() {
    this.stopPolling();
    if (this.dropdown) {
      this.dropdown.style.display = 'none';
    }
    const bell = document.getElementById('mint-notifications-bell');
    const badge = bell?.querySelector('.mint-bell-badge');
    if (badge) {
      badge.style.display = 'none';
    }
  },
  
  toggleDropdown(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!this.dropdown) {
      this.createDropdown();
    }
    
    if (this.dropdown.style.display === 'none') {
      this.dropdown.style.display = 'block';
      this.positionDropdown();
      this.fetchAndRender();
      this.markAllReadOnView();
    } else {
      this.dropdown.style.display = 'none';
    }
  },
  
  /**
   * Mark all notifications as read when viewing dropdown
   * (Does NOT mark gift notifications as read — those need explicit accept/decline)
   */
  async markAllReadOnView() {
    let address = this.getAddress();
    if (!address) return;
    
    try {
      await fetch('/api/artist-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAllRead',
          address
        })
      });
    } catch (e) {}
  },
  
  positionDropdown() {
    const bell = document.getElementById('mint-notifications-bell');
    if (!bell || !this.dropdown) return;
    
    const rect = bell.getBoundingClientRect();
    const dropdownWidth = 360;
    
    let rightPos = window.innerWidth - rect.right;
    
    if (rect.right - dropdownWidth < 10) {
      rightPos = window.innerWidth - dropdownWidth - 10;
    }
    
    this.dropdown.style.top = `${rect.bottom + 8}px`;
    this.dropdown.style.right = `${rightPos}px`;
  },
  
  createDropdown() {
    document.getElementById('mint-dropdown')?.remove();
    
    this.dropdown = document.createElement('div');
    this.dropdown.id = 'mint-dropdown';
    this.dropdown.className = 'mint-notifications-dropdown';
    this.dropdown.innerHTML = `
      <div class="mint-dropdown-header">
        <span>Notifications</span>
        <div class="mint-dropdown-header-actions">
          <button class="mint-mark-all-read" id="mark-all-read-btn" title="Mark all as read">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </button>
          <button class="mint-dropdown-close" onclick="MintNotifications.toggleDropdown(event)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="mint-dropdown-content" id="mint-dropdown-content">
        <div class="mint-dropdown-loading">
          <div class="spinner"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.dropdown);
    
    document.getElementById('mark-all-read-btn')?.addEventListener('click', () => {
      this.markAllRead();
    });
    
    document.addEventListener('click', (e) => {
      if (this.dropdown && 
          this.dropdown.style.display !== 'none' &&
          !this.dropdown.contains(e.target) && 
          !document.getElementById('mint-notifications-bell')?.contains(e.target)) {
        this.dropdown.style.display = 'none';
      }
    });
    
    window.addEventListener('resize', () => {
      if (this.dropdown && this.dropdown.style.display !== 'none') {
        this.positionDropdown();
      }
    });
  },
  
  /**
   * Helper: get user address from AppState or sessionStorage
   */
  getAddress() {
    let address = window.AppState?.user?.address;
    if (!address) {
      try {
        const session = sessionStorage.getItem('xrpmusic_session');
        if (session) {
          const parsed = JSON.parse(session);
          address = parsed.address || parsed.wallet_address || parsed.walletAddress;
        }
      } catch (e) {}
    }
    return address;
  },
  
  async fetchAndRender() {
    const content = document.getElementById('mint-dropdown-content');
    if (!content) return;
    
    let address = this.getAddress();
    
    if (!address) {
      content.innerHTML = `
        <div class="mint-dropdown-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Connect wallet to view notifications</span>
        </div>
      `;
      return;
    }
    
    content.innerHTML = `<div class="mint-dropdown-loading"><div class="spinner"></div></div>`;
    
    try {
      // Fetch mint jobs, sale notifications, AND pending gifts in parallel
      const [mintRes, salesRes, giftsRes] = await Promise.all([
        fetch(`/api/my-mint-jobs?address=${address}`).catch(e => ({ ok: false })),
        fetch(`/api/artist-notifications?address=${address}&limit=20`).catch(e => ({ ok: false })),
        fetch(`/api/gifts?address=${address}&type=pending`).catch(e => ({ ok: false }))
      ]);
      
      let mintData = { success: false, jobs: {} };
      let salesData = { success: false, notifications: [], unreadCount: 0 };
      let giftsData = { success: false, gifts: [], pendingCount: 0 };
      
      if (mintRes.ok) {
        try { mintData = await mintRes.json(); } catch (e) {}
      }
      
      if (salesRes.ok) {
        try { salesData = await salesRes.json(); } catch (e) {}
      }
      
      if (giftsRes.ok) {
        try { giftsData = await giftsRes.json(); } catch (e) {}
      }
      
      // Combine all notifications
      let allItems = [];
      
      // Add mint jobs
      if (mintData.success) {
        const mintJobs = [
          ...(mintData.jobs?.active || []),
          ...(mintData.jobs?.completedUnseen || []),
          ...(mintData.jobs?.failed || []),
          ...(mintData.jobs?.recentCompleted || [])
        ];
        
        mintJobs.forEach(job => {
          allItems.push({
            type: 'mint',
            id: job.id,
            title: job.release_title || 'Untitled Release',
            status: job.status,
            progress: job.total_nfts > 0 ? Math.round((job.minted_count / job.total_nfts) * 100) : 0,
            mintedCount: job.minted_count,
            totalNfts: job.total_nfts,
            error: job.error,
            createdAt: new Date(job.created_at),
            isRead: job.status === 'complete'
          });
        });
      }
      
      // Add sale notifications (filter out gift types — we show those separately)
      if (salesData.success && salesData.notifications) {
        salesData.notifications.forEach(notif => {
          if (notif.type === 'gift') return; // Skip — handled by gifts section
          allItems.push({
            type: notif.type === 'gift_accepted' ? 'gift_accepted' : 'sale',
            id: notif.id,
            title: notif.title,
            message: notif.message,
            amount: notif.amount,
            releaseId: notif.release_id,
            createdAt: new Date(notif.created_at),
            isRead: notif.is_read
          });
        });
      }
      
      // Add pending gifts (these get special Accept/Decline UI)
      if (giftsData.success && giftsData.gifts) {
        giftsData.gifts.forEach(gift => {
          allItems.push({
            type: 'gift_pending',
            id: gift.id,
            title: `🎁 Gift from ${gift.sender_name || gift.sender_address?.slice(0, 8) + '...'}`,
            message: `"${gift.track_title || gift.release_title}"`,
            coverUrl: gift.cover_url,
            senderAvatar: gift.sender_avatar,
            senderName: gift.sender_name,
            releaseId: gift.release_id,
            createdAt: new Date(gift.created_at),
            isRead: false
          });
        });
      }
      
      // Sort by date (newest first)
      allItems.sort((a, b) => b.createdAt - a.createdAt);
      
      // Update badge
      this.updateBadge(mintData, salesData, giftsData);
      
      if (allItems.length === 0) {
        content.innerHTML = `
          <div class="mint-dropdown-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span>No notifications yet</span>
            <small>Sales, gifts, and minting updates will appear here</small>
          </div>
        `;
        return;
      }
      
      content.innerHTML = allItems.map(item => this.renderItem(item)).join('');
      
      // Bind click events for sale notifications
      content.querySelectorAll('.notification-item[data-type="sale"]').forEach(item => {
        item.addEventListener('click', () => {
          const notifId = item.dataset.id;
          this.markAsRead(notifId);
          item.classList.remove('unread');
        });
      });
      
      // Bind Accept/Decline buttons for gift notifications
      content.querySelectorAll('.gift-accept-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const giftId = btn.dataset.giftId;
          this.acceptGift(giftId, btn);
        });
      });
      
      content.querySelectorAll('.gift-decline-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const giftId = btn.dataset.giftId;
          this.declineGift(giftId, btn);
        });
      });
      
    } catch(e) {
      console.error('Fetch error:', e);
      content.innerHTML = `<div class="mint-dropdown-error">Failed to load notifications</div>`;
    }
  },
  
  renderItem(item) {
    if (item.type === 'mint') {
      return this.renderMintJob(item);
    } else if (item.type === 'gift_pending') {
      return this.renderGiftNotification(item);
    } else if (item.type === 'gift_accepted') {
      return this.renderGiftAcceptedNotification(item);
    } else if (item.type === 'sale') {
      return this.renderSaleNotification(item);
    }
    return '';
  },
  
  renderMintJob(job) {
    const isActive = job.status === 'pending' || job.status === 'minting';
    const isComplete = job.status === 'complete';
    const isFailed = job.status === 'failed';
    
    let statusClass = '';
    let statusHtml = '';
    let progressHtml = '';
    
    if (isActive) {
      statusClass = 'active';
      statusHtml = `<div class="notification-status minting">Minting... ${job.mintedCount}/${job.totalNfts} NFTs</div>`;
      progressHtml = `
        <div class="notification-progress">
          <div class="notification-progress-fill" style="width: ${job.progress}%"></div>
        </div>
      `;
    } else if (isComplete) {
      statusClass = 'complete';
      statusHtml = `<div class="notification-status complete">✓ ${job.totalNfts} NFTs minted!</div>`;
    } else if (isFailed) {
      statusClass = 'failed';
      statusHtml = `<div class="notification-status failed">✗ Failed: ${job.error || 'Unknown error'}</div>`;
    }
    
    return `
      <div class="notification-item mint ${statusClass}" data-type="mint" data-id="${job.id}">
        <div class="notification-icon mint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
        <div class="notification-content">
          <div class="notification-title">${job.title}</div>
          ${statusHtml}
          ${progressHtml}
          <div class="notification-time">${this.formatTime(job.createdAt)}</div>
        </div>
      </div>
    `;
  },
  
  renderSaleNotification(notif) {
    const unreadClass = notif.isRead ? '' : 'unread';
    
    return `
      <div class="notification-item sale ${unreadClass}" data-type="sale" data-id="${notif.id}">
        <div class="notification-icon sale">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          ${notif.message ? `<div class="notification-message">${notif.message}</div>` : ''}
          ${notif.amount ? `<div class="notification-amount">+${notif.amount} XRP</div>` : ''}
          <div class="notification-time">${this.formatTime(notif.createdAt)}</div>
        </div>
        ${!notif.isRead ? '<div class="notification-unread-dot"></div>' : ''}
      </div>
    `;
  },
  
  renderGiftNotification(gift) {
    return `
      <div class="notification-item gift-pending unread" data-type="gift_pending" data-id="${gift.id}">
        <div class="notification-icon gift">
          <span style="font-size: 18px;">🎁</span>
        </div>
        <div class="notification-content">
          <div class="notification-title">${gift.title}</div>
          <div class="notification-message">${gift.message}</div>
          <div class="gift-notification-actions">
            <button class="gift-accept-btn" data-gift-id="${gift.id}">Accept</button>
            <button class="gift-decline-btn" data-gift-id="${gift.id}">Decline</button>
          </div>
          <div class="notification-time">${this.formatTime(gift.createdAt)}</div>
        </div>
      </div>
    `;
  },
  
  renderGiftAcceptedNotification(notif) {
    const unreadClass = notif.isRead ? '' : 'unread';
    
    return `
      <div class="notification-item gift-accepted ${unreadClass}" data-type="sale" data-id="${notif.id}">
        <div class="notification-icon gift">
          <span style="font-size: 18px;">🎁</span>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          ${notif.message ? `<div class="notification-message">${notif.message}</div>` : ''}
          <div class="notification-time">${this.formatTime(notif.createdAt)}</div>
        </div>
        ${!notif.isRead ? '<div class="notification-unread-dot"></div>' : ''}
      </div>
    `;
  },
  
  /**
   * Accept a gift — triggers lazy mint + Xaman signing
   * Uses XamanWallet.acceptSellOffer() (same as purchase flow)
   */
  async acceptGift(giftId, btnEl) {
    const address = this.getAddress();
    if (!address) return;
    
    const container = btnEl.closest('.gift-notification-actions');
    if (container) {
      container.innerHTML = `
        <div class="gift-processing">
          <div class="spinner" style="width: 16px; height: 16px;"></div>
          <span>Minting your NFT...</span>
        </div>
      `;
    }
    
    try {
      // Step 1: Call accept endpoint — lazy mints + creates sell offer
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          giftId,
          recipientAddress: address
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process gift');
      }
      
      // Step 2: Accept the sell offer via Xaman (same as purchase flow)
      if (container) {
        container.innerHTML = `
          <div class="gift-processing">
            <div class="spinner" style="width: 16px; height: 16px;"></div>
            <span>Sign in Xaman to claim...</span>
          </div>
        `;
      }
      
      const acceptResult = await XamanWallet.acceptSellOffer(result.sellOfferIndex);
      
      if (!acceptResult.success) {
        throw new Error(acceptResult.error || 'Transaction cancelled');
      }
      
      // Step 3: Confirm the gift in the database
      await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          giftId,
          acceptTxHash: acceptResult.txHash
        })
      });
      
      if (container) {
        container.innerHTML = `
          <div class="gift-success">✅ NFT claimed!</div>
        `;
      }
      
      setTimeout(() => this.fetchAndRender(), 2000);
      
    } catch (error) {
      console.error('Gift accept failed:', error);
      if (container) {
        container.innerHTML = `
          <div class="gift-error">${error.message}</div>
          <div class="gift-notification-actions" style="margin-top: 8px;">
            <button class="gift-accept-btn" data-gift-id="${giftId}">Retry</button>
            <button class="gift-decline-btn" data-gift-id="${giftId}">Decline</button>
          </div>
        `;
        container.querySelector('.gift-accept-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.acceptGift(giftId, e.target);
        });
        container.querySelector('.gift-decline-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.declineGift(giftId, e.target);
        });
      }
    }
  },
  
  /**
   * Decline a gift
   */
  async declineGift(giftId, btnEl) {
    const address = this.getAddress();
    if (!address) return;
    
    const container = btnEl.closest('.gift-notification-actions') || btnEl.closest('.notification-item');
    
    try {
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          giftId,
          recipientAddress: address
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to decline gift');
      }
      
      // Remove the notification item from the UI
      const notifItem = btnEl.closest('.notification-item');
      if (notifItem) {
        notifItem.style.opacity = '0';
        notifItem.style.transform = 'translateX(20px)';
        notifItem.style.transition = 'all 300ms ease';
        setTimeout(() => {
          notifItem.remove();
          // Check if empty
          const content = document.getElementById('mint-dropdown-content');
          if (content && content.children.length === 0) {
            content.innerHTML = `
              <div class="mint-dropdown-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>No notifications yet</span>
              </div>
            `;
          }
        }, 300);
      }
      
    } catch (error) {
      console.error('Gift decline failed:', error);
    }
  },
  
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  },
  
  updateBadge(mintData, salesData, giftsData) {
    const bell = document.getElementById('mint-notifications-bell');
    const badge = bell?.querySelector('.mint-bell-badge');
    if (!badge) return;
    
    const hasActiveMint = mintData?.hasActive;
    const hasUnreadSales = salesData?.unreadCount > 0;
    const hasUnreadMint = mintData?.hasUnread;
    const hasPendingGifts = giftsData?.pendingCount > 0;
    
    if (hasPendingGifts) {
      // Gifts get highest priority — pulsing badge
      badge.style.display = 'block';
      badge.className = 'mint-bell-badge gift';
    } else if (hasActiveMint) {
      badge.style.display = 'block';
      badge.className = 'mint-bell-badge active';
    } else if (hasUnreadSales || hasUnreadMint) {
      badge.style.display = 'block';
      badge.className = 'mint-bell-badge unread';
    } else {
      badge.style.display = 'none';
    }
  },
  
  async markAsRead(notificationId) {
    let address = this.getAddress();
    if (!address || !notificationId) return;
    
    try {
      await fetch('/api/artist-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markRead',
          notificationId,
          address
        })
      });
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  },
  
  async markAllRead() {
    let address = this.getAddress();
    if (!address) return;
    
    try {
      await fetch('/api/artist-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAllRead',
          address
        })
      });
      
      this.fetchAndRender();
      
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  },
  
  async checkForActiveJobs() {
    let address = this.getAddress();
    if (!address) return;
    
    try {
      const [mintRes, salesRes, giftsRes] = await Promise.all([
        fetch(`/api/my-mint-jobs?address=${address}`),
        fetch(`/api/artist-notifications?address=${address}&unreadOnly=true&limit=1`),
        fetch(`/api/gifts?address=${address}&type=pending`)
      ]);
      
      const mintData = await mintRes.json();
      const salesData = await salesRes.json();
      const giftsData = await giftsRes.json();
      
      this.updateBadge(mintData, salesData, giftsData);
      
      if (mintData.hasActive) {
        this.startPolling();
      }
    } catch(e) {
      console.error('Error checking notifications:', e);
    }
  },
  
  startPolling() {
    if (this.polling) return;
    this.polling = setInterval(() => {
      if (this.dropdown?.style.display !== 'none') {
        this.fetchAndRender();
      } else {
        this.checkForActiveJobs();
      }
    }, 5000);
  },
  
  stopPolling() {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }
};

// Add styles
const mintNotificationStyles = document.createElement('style');
mintNotificationStyles.textContent = `
  .mint-notifications-dropdown {
    position: fixed;
    top: 60px;
    right: 20px;
    width: 360px;
    max-height: 500px;
    background: var(--bg-card, #18181b);
    border: 1px solid var(--border-color, #27272a);
    border-radius: 16px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 9999;
    display: none;
    overflow: hidden;
  }
  
  .mint-dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    border-bottom: 1px solid var(--border-color, #27272a);
  }
  
  .mint-dropdown-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .mint-mark-all-read,
  .mint-dropdown-close {
    background: none;
    border: none;
    color: var(--text-muted, #71717a);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: all 150ms;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .mint-mark-all-read:hover,
  .mint-dropdown-close:hover {
    color: var(--text-primary, #fff);
    background: var(--bg-hover, #27272a);
  }
  
  .mint-dropdown-content {
    padding: 8px;
    max-height: 380px;
    overflow-y: auto;
  }
  
  .mint-dropdown-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }
  
  .mint-dropdown-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    color: var(--text-muted, #71717a);
    text-align: center;
  }
  
  .mint-dropdown-empty svg {
    opacity: 0.5;
  }
  
  .mint-dropdown-empty span {
    font-size: 14px;
  }
  
  .mint-dropdown-empty small {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .mint-dropdown-error {
    padding: 24px;
    text-align: center;
    color: var(--error, #ef4444);
    font-size: 14px;
  }
  
  /* Notification Items */
  .notification-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: background 150ms;
    position: relative;
  }
  
  .notification-item:last-child {
    margin-bottom: 0;
  }
  
  .notification-item:hover {
    background: var(--bg-hover, #27272a);
  }
  
  .notification-item.unread {
    background: rgba(59, 130, 246, 0.1);
  }
  
  .notification-item.unread:hover {
    background: rgba(59, 130, 246, 0.15);
  }
  
  /* Gift pending notification — special highlight */
  .notification-item.gift-pending {
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
  }
  
  .notification-item.gift-pending:hover {
    background: rgba(139, 92, 246, 0.15);
  }
  
  .notification-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .notification-icon.sale {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .notification-icon.mint {
    background: rgba(139, 92, 246, 0.2);
    color: #8b5cf6;
  }
  
  .notification-icon.gift {
    background: rgba(236, 72, 153, 0.2);
  }
  
  .notification-content {
    flex: 1;
    min-width: 0;
  }
  
  .notification-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .notification-message {
    font-size: 13px;
    color: var(--text-secondary, #a1a1aa);
    margin-bottom: 4px;
  }
  
  .notification-amount {
    font-size: 13px;
    font-weight: 600;
    color: #3b82f6;
    margin-bottom: 4px;
  }
  
  .notification-status {
    font-size: 12px;
    margin-bottom: 4px;
  }
  
  .notification-status.minting {
    color: #8b5cf6;
  }
  
  .notification-status.complete {
    color: #22c55e;
  }
  
  .notification-status.failed {
    color: #ef4444;
  }
  
  .notification-progress {
    height: 4px;
    background: rgba(0,0,0,0.3);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  
  .notification-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a855f7);
    border-radius: 2px;
    transition: width 300ms ease;
  }
  
  .notification-time {
    font-size: 11px;
    color: var(--text-muted, #71717a);
  }
  
  .notification-unread-dot {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent, #3b82f6);
  }
  
  /* Gift Accept/Decline buttons */
  .gift-notification-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    margin-bottom: 4px;
  }
  
  .gift-accept-btn {
    padding: 5px 16px;
    border-radius: 8px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms;
    background: linear-gradient(135deg, #8b5cf6, #a855f7);
    color: white;
  }
  
  .gift-accept-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  }
  
  .gift-decline-btn {
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #27272a);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
    background: transparent;
    color: var(--text-muted, #71717a);
  }
  
  .gift-decline-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
  
  .gift-processing {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 12px;
    color: #8b5cf6;
  }
  
  .gift-success {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #22c55e;
  }
  
  .gift-error {
    margin-top: 8px;
    font-size: 12px;
    color: #ef4444;
  }
  
  /* Bell badge styles */
  .mint-bell-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary, #000);
  }
  
  .mint-bell-badge.active {
    background: #8b5cf6;
    animation: mintPulse 1.5s ease-in-out infinite;
  }
  
  .mint-bell-badge.unread {
    background: #3b82f6;
  }
  
  .mint-bell-badge.gift {
    background: #ec4899;
    animation: mintPulse 1.5s ease-in-out infinite;
  }
  
  @keyframes mintPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.8; }
  }
  
  /* Mobile responsive */
  @media (max-width: 480px) {
    .mint-notifications-dropdown {
      right: 10px;
      left: 10px;
      width: auto;
    }
  }
`;
document.head.appendChild(mintNotificationStyles);

// Auto-check for notifications on page load (only if signed in)
document.addEventListener('DOMContentLoaded', () => {
  const bell = document.getElementById('mint-notifications-bell');
  if (bell) {
    bell.removeAttribute('onclick');
    bell.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      MintNotifications.toggleDropdown(event);
    });
  }
  
  setTimeout(() => {
    if (window.AppState?.user?.address) {
      MintNotifications.checkForActiveJobs();
    } else {
      try {
        const session = sessionStorage.getItem('xrpmusic_session');
        if (session) {
          MintNotifications.checkForActiveJobs();
        }
      } catch (e) {}
    }
  }, 1500);
});
