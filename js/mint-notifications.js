/**
 * XRP Music - Notifications System
 * Shows mint status AND artist sale notifications
 */

const MintNotifications = {
  dropdown: null,
  polling: null,
  
  /**
   * Initialize notifications - called by xaman.js on session restore
   */
  init() {
    // Check for notifications on init
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
    // Clear badge
    const bell = document.getElementById('mint-notifications-bell');
    const badge = bell?.querySelector('.mint-bell-badge');
    if (badge) {
      badge.style.display = 'none';
    }
  },
  
  toggleDropdown(event) {
    // Prevent event from bubbling up and causing page reload/navigation
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
      
      // Mark all as read when opening dropdown (removes the badge)
      this.markAllReadOnView();
    } else {
      this.dropdown.style.display = 'none';
    }
  },
  
  /**
   * Mark all notifications as read when viewing dropdown
   */
  async markAllReadOnView() {
    let address = window.AppState?.user?.address;
    
    if (!address) {
      try {
        const session = localStorage.getItem('xrpmusic_wallet_session');
        if (session) {
          const parsed = JSON.parse(session);
          address = parsed.address;
        }
      } catch (e) {}
    }
    
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
      
      // Hide the badge
      const bell = document.getElementById('mint-notifications-bell');
      const badge = bell?.querySelector('.mint-bell-badge');
      if (badge) {
        badge.style.display = 'none';
      }
    } catch (e) {
      // Ignore errors
    }
  },
  
  positionDropdown() {
    const bell = document.getElementById('mint-notifications-bell');
    if (!bell || !this.dropdown) return;
    
    const rect = bell.getBoundingClientRect();
    const dropdownWidth = 360;
    
    // Position dropdown below the bell, aligned to right edge of bell
    let rightPos = window.innerWidth - rect.right;
    
    // Make sure it doesn't go off left edge of screen
    if (rect.right - dropdownWidth < 10) {
      rightPos = window.innerWidth - dropdownWidth - 10;
    }
    
    this.dropdown.style.top = `${rect.bottom + 8}px`;
    this.dropdown.style.right = `${rightPos}px`;
  },
  
  createDropdown() {
    // Remove if exists
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
      <div class="mint-dropdown-tabs">
        <button class="mint-tab active" data-tab="all">All</button>
        <button class="mint-tab" data-tab="sales">Sales</button>
        <button class="mint-tab" data-tab="mints">Mints</button>
      </div>
      <div class="mint-dropdown-content" id="mint-dropdown-content">
        <div class="mint-dropdown-loading">
          <div class="spinner"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.dropdown);
    
    // Bind tab clicks
    this.dropdown.querySelectorAll('.mint-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.dropdown.querySelectorAll('.mint-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.fetchAndRender(tab.dataset.tab);
      });
    });
    
    // Bind mark all read
    document.getElementById('mark-all-read-btn')?.addEventListener('click', () => {
      this.markAllRead();
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.dropdown && 
          this.dropdown.style.display !== 'none' &&
          !this.dropdown.contains(e.target) && 
          !document.getElementById('mint-notifications-bell')?.contains(e.target)) {
        this.dropdown.style.display = 'none';
      }
    });
    
    // Reposition on window resize
    window.addEventListener('resize', () => {
      if (this.dropdown && this.dropdown.style.display !== 'none') {
        this.positionDropdown();
      }
    });
  },
  
  async fetchAndRender(filter = 'all') {
    const content = document.getElementById('mint-dropdown-content');
    if (!content) return;
    
    // Check multiple sources for user address
    // xrpmusic_wallet_session stores the session object with address
    let address = window.AppState?.user?.address;
    
    if (!address) {
      try {
        const session = localStorage.getItem('xrpmusic_wallet_session');
        if (session) {
          const parsed = JSON.parse(session);
          address = parsed.address || parsed.wallet_address || parsed.walletAddress;
        }
      } catch (e) {
        console.error('Failed to parse wallet session:', e);
      }
    }
    
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
      // Fetch both mint jobs and sale notifications in parallel
      const [mintRes, salesRes] = await Promise.all([
        fetch(`/api/my-mint-jobs?address=${address}`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/artist-notifications?address=${address}&limit=20`).catch(e => ({ ok: false, error: e }))
      ]);
      
      let mintData = { success: false, jobs: {} };
      let salesData = { success: false, notifications: [], unreadCount: 0 };
      
      // Parse mint response
      if (mintRes.ok) {
        try {
          mintData = await mintRes.json();
        } catch (e) {
          console.error('Failed to parse mint response:', e);
        }
      }
      
      // Parse sales response
      if (salesRes.ok) {
        try {
          salesData = await salesRes.json();
        } catch (e) {
          console.error('Failed to parse sales response:', e);
        }
      } else {
        console.log('Artist notifications API not available (this is OK if not deployed yet)');
      }
      
      // Combine and sort all notifications
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
      
      // Add sale notifications
      if (salesData.success && salesData.notifications) {
        salesData.notifications.forEach(notif => {
          allItems.push({
            type: 'sale',
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
      
      // Filter based on tab
      if (filter === 'sales') {
        allItems = allItems.filter(item => item.type === 'sale');
      } else if (filter === 'mints') {
        allItems = allItems.filter(item => item.type === 'mint');
      }
      
      // Sort by date (newest first)
      allItems.sort((a, b) => b.createdAt - a.createdAt);
      
      // Update badge
      this.updateBadge(mintData, salesData);
      
      if (allItems.length === 0) {
        content.innerHTML = `
          <div class="mint-dropdown-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span>No notifications yet</span>
            <small>Sales and minting updates will appear here</small>
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
      
    } catch(e) {
      console.error('Fetch error:', e);
      content.innerHTML = `<div class="mint-dropdown-error">Failed to load notifications</div>`;
    }
  },
  
  renderItem(item) {
    if (item.type === 'mint') {
      return this.renderMintJob(item);
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
  
  updateBadge(mintData, salesData) {
    const bell = document.getElementById('mint-notifications-bell');
    const badge = bell?.querySelector('.mint-bell-badge');
    if (!badge) return;
    
    const hasActiveMint = mintData?.hasActive;
    const hasUnreadSales = salesData?.unreadCount > 0;
    const hasUnreadMint = mintData?.hasUnread;
    
    if (hasActiveMint) {
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
    const address = window.AppState?.user?.address;
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
    const address = window.AppState?.user?.address;
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
      
      // Refresh the dropdown
      const activeTab = this.dropdown?.querySelector('.mint-tab.active')?.dataset.tab || 'all';
      this.fetchAndRender(activeTab);
      
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  },
  
  // Check for active jobs and unread notifications (called on page load if signed in)
  async checkForActiveJobs() {
    // Check multiple sources for user address
    let address = window.AppState?.user?.address;
    
    if (!address) {
      try {
        const session = localStorage.getItem('xrpmusic_wallet_session');
        if (session) {
          const parsed = JSON.parse(session);
          address = parsed.address || parsed.wallet_address || parsed.walletAddress;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (!address) return;
    
    try {
      const [mintRes, salesRes] = await Promise.all([
        fetch(`/api/my-mint-jobs?address=${address}`),
        fetch(`/api/artist-notifications?address=${address}&unreadOnly=true&limit=1`)
      ]);
      
      const mintData = await mintRes.json();
      const salesData = await salesRes.json();
      
      this.updateBadge(mintData, salesData);
      
      if (mintData.hasActive) {
        this.startPolling();
      }
    } catch(e) {
      console.error('Error checking notifications:', e);
    }
  },
  
  // Start polling for active jobs
  startPolling() {
    if (this.polling) return;
    this.polling = setInterval(() => {
      if (this.dropdown?.style.display !== 'none') {
        const activeTab = this.dropdown?.querySelector('.mint-tab.active')?.dataset.tab || 'all';
        this.fetchAndRender(activeTab);
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
  
  .mint-dropdown-tabs {
    display: flex;
    padding: 8px 12px;
    gap: 4px;
    border-bottom: 1px solid var(--border-color, #27272a);
  }
  
  .mint-tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted, #71717a);
    background: none;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 150ms;
  }
  
  .mint-tab:hover {
    color: var(--text-primary, #fff);
    background: var(--bg-hover, #27272a);
  }
  
  .mint-tab.active {
    color: var(--text-primary, #fff);
    background: var(--accent, #3b82f6);
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
  // Bind the bell click handler properly to prevent event bubbling issues
  const bell = document.getElementById('mint-notifications-bell');
  if (bell) {
    // Remove any existing onclick attribute and use proper event listener
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
      // Also check localStorage session
      try {
        const session = localStorage.getItem('xrpmusic_wallet_session');
        if (session) {
          MintNotifications.checkForActiveJobs();
        }
      } catch (e) {}
    }
  }, 1500);
});
