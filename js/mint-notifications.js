/**
 * XRP Music - Mint Notifications Service
 * 
 * Handles the notification bell for mint job status.
 * - Polls for job status in background
 * - Persists across page navigation
 * - Shows progress, completion, and errors
 */

const MintNotifications = {
  pollInterval: null,
  isPolling: false,
  
  // Current state
  state: {
    hasUnread: false,
    hasActive: false,
    activeCount: 0,
    unreadCount: 0,
    jobs: {
      active: [],
      completedUnseen: [],
      failed: [],
      recentCompleted: [],
    }
  },
  
  /**
   * Initialize the notification service
   * Call this on page load
   */
  async init() {
    if (!AppState.user?.address) {
      console.log('MintNotifications: No user logged in, skipping init');
      return;
    }
    
    console.log('MintNotifications: Initializing...');
    
    // Create the notification bell UI if it doesn't exist
    this.createBellUI();
    
    // Fetch initial state
    await this.fetchJobs();
    
    // Start polling if there are active jobs
    if (this.state.hasActive) {
      this.startPolling();
    }
    
    // Update UI
    this.updateUI();
  },
  
  /**
   * Create the notification bell UI element
   */
  createBellUI() {
    // Check if bell already exists
    if (document.getElementById('mint-notification-bell')) {
      return;
    }
    
    // Find the header/nav area to insert the bell
    const header = document.querySelector('.nav-actions') || 
                   document.querySelector('header nav') ||
                   document.querySelector('header');
    
    if (!header) {
      console.warn('MintNotifications: Could not find header to insert bell');
      return;
    }
    
    // Create bell container
    const bellContainer = document.createElement('div');
    bellContainer.id = 'mint-notification-bell';
    bellContainer.className = 'mint-notification-bell';
    bellContainer.innerHTML = `
      <button class="bell-button" onclick="MintNotifications.toggleDropdown()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="bell-badge" style="display: none;"></span>
        <span class="bell-spinner" style="display: none;"></span>
      </button>
      <div class="bell-dropdown" style="display: none;">
        <div class="dropdown-header">Mint Status</div>
        <div class="dropdown-content">
          <div class="empty-state">No recent mints</div>
        </div>
      </div>
    `;
    
    // Insert before the profile/wallet button if possible
    const walletBtn = header.querySelector('.wallet-button') || 
                      header.querySelector('[class*="wallet"]') ||
                      header.lastElementChild;
    
    if (walletBtn) {
      header.insertBefore(bellContainer, walletBtn);
    } else {
      header.appendChild(bellContainer);
    }
    
    // Add styles if not already added
    this.addStyles();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const bell = document.getElementById('mint-notification-bell');
      if (bell && !bell.contains(e.target)) {
        this.closeDropdown();
      }
    });
  },
  
  /**
   * Add CSS styles for the notification bell
   */
  addStyles() {
    if (document.getElementById('mint-notification-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 'mint-notification-styles';
    styles.textContent = `
      .mint-notification-bell {
        position: relative;
        margin-right: 12px;
      }
      
      .bell-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        color: #fff;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }
      
      .bell-button:hover {
        background: rgba(255,255,255,0.1);
      }
      
      .bell-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        border: 2px solid #1a1a2e;
      }
      
      .bell-spinner {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        border: 2px solid rgba(139, 92, 246, 0.3);
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: bell-spin 1s linear infinite;
      }
      
      @keyframes bell-spin {
        to { transform: rotate(360deg); }
      }
      
      .bell-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        width: 320px;
        max-height: 400px;
        overflow-y: auto;
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        z-index: 1000;
        margin-top: 8px;
      }
      
      .dropdown-header {
        padding: 12px 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        color: #fff;
      }
      
      .dropdown-content {
        padding: 8px;
      }
      
      .empty-state {
        padding: 24px;
        text-align: center;
        color: rgba(255,255,255,0.5);
      }
      
      .notification-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .notification-item:hover {
        background: rgba(255,255,255,0.05);
      }
      
      .notification-item.unread {
        background: rgba(139, 92, 246, 0.1);
      }
      
      .notification-thumb {
        width: 48px;
        height: 48px;
        border-radius: 6px;
        object-fit: cover;
        background: rgba(255,255,255,0.1);
      }
      
      .notification-info {
        flex: 1;
        min-width: 0;
      }
      
      .notification-title {
        font-weight: 500;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }
      
      .notification-status {
        font-size: 13px;
        color: rgba(255,255,255,0.6);
      }
      
      .notification-status.success {
        color: #22c55e;
      }
      
      .notification-status.error {
        color: #ef4444;
      }
      
      .notification-status.minting {
        color: #8b5cf6;
      }
      
      .notification-progress {
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        margin-top: 6px;
        overflow: hidden;
      }
      
      .notification-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #8b5cf6, #6366f1);
        border-radius: 2px;
        transition: width 0.3s;
      }
    `;
    
    document.head.appendChild(styles);
  },
  
  /**
   * Fetch mint jobs from API
   */
  async fetchJobs() {
    if (!AppState.user?.address) return;
    
    try {
      const response = await fetch(`/api/my-mint-jobs?address=${AppState.user.address}`);
      const data = await response.json();
      
      if (data.success) {
        this.state = {
          hasUnread: data.hasUnread,
          hasActive: data.hasActive,
          activeCount: data.summary.activeCount,
          unreadCount: data.summary.unreadCount,
          jobs: data.jobs,
        };
        
        // Start/stop polling based on active jobs
        if (this.state.hasActive && !this.isPolling) {
          this.startPolling();
        } else if (!this.state.hasActive && this.isPolling) {
          this.stopPolling();
        }
      }
    } catch (error) {
      console.error('MintNotifications: Failed to fetch jobs', error);
    }
  },
  
  /**
   * Start polling for job updates
   */
  startPolling() {
    if (this.isPolling) return;
    
    console.log('MintNotifications: Starting polling...');
    this.isPolling = true;
    
    this.pollInterval = setInterval(async () => {
      await this.fetchJobs();
      this.updateUI();
    }, 5000); // Poll every 5 seconds
  },
  
  /**
   * Stop polling
   */
  stopPolling() {
    if (!this.isPolling) return;
    
    console.log('MintNotifications: Stopping polling');
    this.isPolling = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },
  
  /**
   * Update the notification bell UI
   */
  updateUI() {
    const badge = document.querySelector('.bell-badge');
    const spinner = document.querySelector('.bell-spinner');
    const content = document.querySelector('.bell-dropdown .dropdown-content');
    
    if (!badge || !spinner || !content) return;
    
    // Update badge/spinner visibility
    if (this.state.hasActive) {
      badge.style.display = 'none';
      spinner.style.display = 'block';
    } else if (this.state.hasUnread) {
      badge.style.display = 'block';
      spinner.style.display = 'none';
    } else {
      badge.style.display = 'none';
      spinner.style.display = 'none';
    }
    
    // Build dropdown content
    const allJobs = [
      ...this.state.jobs.active,
      ...this.state.jobs.completedUnseen,
      ...this.state.jobs.failed,
      ...this.state.jobs.recentCompleted,
    ];
    
    if (allJobs.length === 0) {
      content.innerHTML = '<div class="empty-state">No recent mints</div>';
      return;
    }
    
    content.innerHTML = allJobs.map(job => this.renderJobItem(job)).join('');
  },
  
  /**
   * Render a single job notification item
   */
  renderJobItem(job) {
    const isUnread = (job.status === 'complete' || job.status === 'failed') && !job.seen;
    const isActive = job.status === 'pending' || job.status === 'minting';
    
    let statusText = '';
    let statusClass = '';
    
    if (job.status === 'pending') {
      statusText = 'Waiting to mint...';
      statusClass = 'minting';
    } else if (job.status === 'minting') {
      statusText = `Minting... ${job.minted_count}/${job.total_nfts} NFTs`;
      statusClass = 'minting';
    } else if (job.status === 'complete') {
      statusText = `✓ ${job.minted_count} NFTs minted!`;
      statusClass = 'success';
    } else if (job.status === 'failed') {
      statusText = `✗ Failed: ${job.error || 'Unknown error'}`;
      statusClass = 'error';
    }
    
    const progress = job.total_nfts > 0 ? Math.round((job.minted_count / job.total_nfts) * 100) : 0;
    
    const coverUrl = job.cover_art_url || '/images/default-cover.png';
    
    return `
      <div class="notification-item ${isUnread ? 'unread' : ''}" 
           onclick="MintNotifications.handleItemClick('${job.job_id}', '${job.release_id}', ${isUnread})">
        <img class="notification-thumb" src="${coverUrl}" alt="${job.release_title}" onerror="this.src='/images/default-cover.png'">
        <div class="notification-info">
          <div class="notification-title">${job.release_title || 'Untitled Release'}</div>
          <div class="notification-status ${statusClass}">${statusText}</div>
          ${isActive ? `
            <div class="notification-progress">
              <div class="notification-progress-bar" style="width: ${progress}%"></div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },
  
  /**
   * Handle click on a notification item
   */
  async handleItemClick(jobId, releaseId, isUnread) {
    // Mark as seen if unread
    if (isUnread && AppState.user?.address) {
      try {
        await fetch('/api/mark-job-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: jobId,
            address: AppState.user.address,
          }),
        });
        
        // Refresh jobs
        await this.fetchJobs();
        this.updateUI();
      } catch (error) {
        console.error('Failed to mark job as seen:', error);
      }
    }
    
    // Navigate to profile releases tab
    this.closeDropdown();
    
    // If we have a profile page navigation function, use it
    if (typeof navigateToProfile === 'function') {
      navigateToProfile('releases');
    } else if (typeof UI !== 'undefined' && UI.showProfile) {
      UI.showProfile(AppState.user.address, 'releases');
    } else {
      // Fallback: just go to profile page
      window.location.hash = `#/profile/${AppState.user.address}/releases`;
    }
  },
  
  /**
   * Toggle dropdown visibility
   */
  toggleDropdown() {
    const dropdown = document.querySelector('.bell-dropdown');
    if (!dropdown) return;
    
    if (dropdown.style.display === 'none') {
      dropdown.style.display = 'block';
      // Refresh when opening
      this.fetchJobs().then(() => this.updateUI());
    } else {
      dropdown.style.display = 'none';
    }
  },
  
  /**
   * Close the dropdown
   */
  closeDropdown() {
    const dropdown = document.querySelector('.bell-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  },
  
  /**
   * Add a new job (called after queueing a mint)
   */
  addJob(jobId, releaseId, totalNFTs) {
    console.log('MintNotifications: Adding new job', jobId);
    
    // Start polling immediately
    this.startPolling();
    
    // Fetch fresh data
    this.fetchJobs().then(() => this.updateUI());
  },
  
  /**
   * Clean up when user logs out
   */
  cleanup() {
    this.stopPolling();
    this.state = {
      hasUnread: false,
      hasActive: false,
      activeCount: 0,
      unreadCount: 0,
      jobs: { active: [], completedUnseen: [], failed: [], recentCompleted: [] }
    };
    
    const bell = document.getElementById('mint-notification-bell');
    if (bell) {
      bell.remove();
    }
  }
};

// Auto-initialize when DOM is ready and user is logged in
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for AppState to be populated
  setTimeout(() => {
    if (AppState.user?.address) {
      MintNotifications.init();
    }
  }, 1000);
});

// Re-initialize when user logs in
window.addEventListener('userLoggedIn', () => {
  MintNotifications.init();
});

// Cleanup when user logs out
window.addEventListener('userLoggedOut', () => {
  MintNotifications.cleanup();
});
