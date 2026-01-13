/**
 * XRP Music - Mint Notifications Service
 * 
 * Creates a notification bell in the header that shows mint job progress.
 * Polls for updates when there are active jobs.
 * Persists across page navigation.
 */

const MintNotifications = {
  pollInterval: null,
  isPolling: false,
  bellElement: null,
  dropdownElement: null,
  lastData: null,
  
  /**
   * Initialize the notification system
   * Call this on page load if user is logged in
   */
  init() {
    if (!window.AppState?.user?.address) {
      return;
    }
    
    this.createBellUI();
    this.fetchJobs(); // Initial fetch
    this.startPolling();
  },
  
  /**
   * Clean up when user logs out
   */
  destroy() {
    this.stopPolling();
    // Hide the bell (don't remove it)
    if (this.bellElement) {
      this.bellElement.style.display = 'none';
      this.bellElement = null;
    }
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }
  },
  
  /**
   * Create the bell icon in the header
   */
  createBellUI() {
    // Use existing bell from HTML
    this.bellElement = document.getElementById('mint-notifications-bell');
    if (!this.bellElement) {
      console.warn('MintNotifications: Could not find #mint-notifications-bell');
      return;
    }
    
    // Show the bell when user is logged in
    this.bellElement.style.display = '';
    
    // Remove old dropdown if exists
    document.getElementById('mint-notifications-dropdown')?.remove();
    
    // Create dropdown
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.id = 'mint-notifications-dropdown';
    this.dropdownElement.className = 'mint-dropdown';
    this.dropdownElement.style.display = 'none';
    this.dropdownElement.innerHTML = `
      <div class="mint-dropdown-header">Mint Status</div>
      <div class="mint-dropdown-content">
        <div class="mint-dropdown-empty">No recent mints</div>
      </div>
    `;
    document.body.appendChild(this.dropdownElement);
    
    // Add click handler
    this.bellElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.dropdownElement?.contains(e.target) && !this.bellElement?.contains(e.target)) {
        this.closeDropdown();
      }
    });
    
    // Add styles
    this.addStyles();
  },
  
  /**
   * Add CSS styles for the notification UI
   */
  addStyles() {
    if (document.getElementById('mint-notifications-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'mint-notifications-styles';
    style.textContent = `
      .mint-bell {
        position: relative;
      }
      
      .mint-bell-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        border: 2px solid var(--bg-primary);
      }
      
      .mint-bell.has-active .mint-bell-badge {
        background: #8b5cf6;
        animation: mint-pulse 1.5s ease-in-out infinite;
      }
      
      .mint-bell.has-unread .mint-bell-badge {
        background: #22c55e;
      }
      
      @keyframes mint-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
      }
      
      .mint-dropdown {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 320px;
        max-height: 450px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 1000;
        overflow: hidden;
      }
      
      .mint-dropdown-header {
        padding: 16px 20px;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-color);
      }
      
      .mint-dropdown-content {
        max-height: 350px;
        overflow-y: auto;
      }
      
      .mint-dropdown-empty {
        padding: 32px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
      }
      
      .mint-job-item {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background 150ms;
      }
      
      .mint-job-item:last-child {
        border-bottom: none;
      }
      
      .mint-job-item:hover {
        background: var(--bg-hover);
      }
      
      .mint-job-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 6px;
      }
      
      .mint-job-status {
        font-size: 13px;
      }
      
      .mint-job-status.minting {
        color: #8b5cf6;
      }
      
      .mint-job-status.complete {
        color: #22c55e;
      }
      
      .mint-job-status.failed {
        color: #ef4444;
      }
      
      .mint-job-progress {
        margin-top: 10px;
        height: 6px;
        background: var(--bg-hover);
        border-radius: 3px;
        overflow: hidden;
      }
      
      .mint-job-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #8b5cf6, #a855f7);
        border-radius: 3px;
        transition: width 300ms ease;
      }
      
      .mint-job-time {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 8px;
      }
    `;
    document.head.appendChild(style);
  },
  
  /**
   * Toggle dropdown visibility
   */
  toggleDropdown() {
    if (this.dropdownElement.style.display === 'none') {
      this.openDropdown();
    } else {
      this.closeDropdown();
    }
  },
  
  /**
   * Open dropdown and fetch fresh data
   */
  openDropdown() {
    this.dropdownElement.style.display = 'block';
    this.fetchJobs(); // Refresh when opening
  },
  
  /**
   * Close dropdown
   */
  closeDropdown() {
    if (this.dropdownElement) {
      this.dropdownElement.style.display = 'none';
    }
  },
  
  /**
   * Start polling for job updates
   */
  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    this.pollInterval = setInterval(() => {
      this.fetchJobs();
    }, 5000); // Poll every 5 seconds
  },
  
  /**
   * Stop polling
   */
  stopPolling() {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },
  
  /**
   * Fetch jobs from API
   */
  async fetchJobs() {
    if (!window.AppState?.user?.address) return;
    
    try {
      const response = await fetch(`/api/my-mint-jobs?address=${AppState.user.address}`);
      const data = await response.json();
      
      if (data.success) {
        this.lastData = data;
        this.updateUI(data);
        
        // If no active jobs, slow down polling
        if (!data.hasActive && this.isPolling) {
          this.stopPolling();
          // Check again in 30 seconds in case a new job starts
          setTimeout(() => {
            if (window.AppState?.user?.address) {
              this.fetchJobs();
              // If there are now active jobs, resume fast polling
              if (this.lastData?.hasActive) {
                this.startPolling();
              }
            }
          }, 30000);
        } else if (data.hasActive && !this.isPolling) {
          // Resume polling if there are active jobs
          this.startPolling();
        }
      }
    } catch (error) {
      console.error('MintNotifications: Failed to fetch jobs', error);
    }
  },
  
  /**
   * Update the UI based on job data
   */
  updateUI(data) {
    if (!this.bellElement || !this.dropdownElement) return;
    
    const badge = this.bellElement.querySelector('.mint-bell-badge');
    
    // Update bell state
    this.bellElement.classList.remove('has-active', 'has-unread');
    badge.style.display = 'none';
    
    if (data.hasActive) {
      this.bellElement.classList.add('has-active');
      badge.style.display = 'block';
    } else if (data.hasUnread) {
      this.bellElement.classList.add('has-unread');
      badge.style.display = 'block';
    }
    
    // Update dropdown content
    const content = this.dropdownElement.querySelector('.mint-dropdown-content');
    const allJobs = [
      ...data.jobs.active,
      ...data.jobs.completedUnseen,
      ...data.jobs.failed,
      ...data.jobs.recentCompleted,
    ];
    
    if (allJobs.length === 0) {
      content.innerHTML = '<div class="mint-dropdown-empty">No recent mints</div>';
      return;
    }
    
    content.innerHTML = allJobs.map(job => this.renderJobItem(job)).join('');
    
    // Add click handlers for completed jobs
    content.querySelectorAll('.mint-job-item[data-job-id]').forEach(item => {
      item.addEventListener('click', () => {
        const jobId = item.dataset.jobId;
        const releaseId = item.dataset.releaseId;
        this.handleJobClick(jobId, releaseId);
      });
    });
  },
  
  /**
   * Render a single job item
   */
  renderJobItem(job) {
    const isActive = job.status === 'pending' || job.status === 'minting';
    const isComplete = job.status === 'complete';
    const isFailed = job.status === 'failed';
    
    let statusText = '';
    let statusClass = '';
    let progressBar = '';
    let timeEstimate = '';
    
    if (isActive) {
      const percent = job.total_nfts > 0 ? Math.round((job.minted_count / job.total_nfts) * 100) : 0;
      statusText = `Minting... ${job.minted_count}/${job.total_nfts} NFTs`;
      statusClass = 'minting';
      progressBar = `
        <div class="mint-job-progress">
          <div class="mint-job-progress-fill" style="width: ${percent}%"></div>
        </div>
      `;
      
      // Calculate time estimate
      if (job.minted_count > 10) {
        const elapsed = (new Date() - new Date(job.created_at)) / 1000; // seconds
        const perNft = elapsed / job.minted_count;
        const remaining = (job.total_nfts - job.minted_count) * perNft;
        
        if (remaining > 3600) {
          const hours = Math.floor(remaining / 3600);
          const mins = Math.ceil((remaining % 3600) / 60);
          timeEstimate = `<div class="mint-job-time">~${hours}h ${mins}m remaining</div>`;
        } else if (remaining > 60) {
          timeEstimate = `<div class="mint-job-time">~${Math.ceil(remaining / 60)} minutes remaining</div>`;
        } else {
          timeEstimate = `<div class="mint-job-time">Almost done...</div>`;
        }
      } else {
        timeEstimate = `<div class="mint-job-time">Calculating time...</div>`;
      }
    } else if (isComplete) {
      statusText = `✓ ${job.total_nfts} NFTs minted!`;
      statusClass = 'complete';
    } else if (isFailed) {
      statusText = `✗ Failed: ${job.error || 'Unknown error'}`;
      statusClass = 'failed';
    }
    
    return `
      <div class="mint-job-item" data-job-id="${job.job_id}" data-release-id="${job.release_id}">
        <div class="mint-job-title">${job.release_title || 'Untitled Release'}</div>
        <div class="mint-job-status ${statusClass}">${statusText}</div>
        ${progressBar}
        ${timeEstimate}
      </div>
    `;
  },
  
  /**
   * Handle click on a job item
   */
  async handleJobClick(jobId, releaseId) {
    // Mark as seen
    try {
      await fetch('/api/mark-job-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          address: AppState.user.address,
        }),
      });
    } catch (error) {
      console.error('Failed to mark job as seen:', error);
    }
    
    // Close dropdown
    this.closeDropdown();
    
    // Navigate to profile releases tab
    if (typeof Router !== 'undefined') {
      Router.navigate('profile');
    }
    
    // Refresh to update badge
    this.fetchJobs();
  },
  
  /**
   * Manually add a job (called after successful queue)
   * This gives immediate feedback while waiting for first poll
   */
  addJob(jobData) {
    if (!this.bellElement) {
      this.init();
    }
    
    // Show active state immediately
    const badge = this.bellElement?.querySelector('.mint-bell-badge');
    if (badge) {
      badge.style.display = 'block';
      this.bellElement.classList.add('has-active');
    }
    
    // Start polling if not already
    if (!this.isPolling) {
      this.startPolling();
    }
    
    // Fetch fresh data
    this.fetchJobs();
  },
};

// Auto-initialize when DOM is ready and user is logged in
document.addEventListener('DOMContentLoaded', () => {
  // Check periodically for login state
  const checkLogin = () => {
    // Check multiple signals for logged-in state
    const hasAppState = window.AppState?.user?.address;
    const userCardVisible = document.getElementById('user-card') && 
                           !document.getElementById('user-card').classList.contains('hidden');
    
    if ((hasAppState || userCardVisible) && !MintNotifications.bellElement) {
      // If AppState isn't ready but user card is visible, try to get address from localStorage
      if (!hasAppState && userCardVisible) {
        const stored = localStorage.getItem('xrpmusic_user');
        if (stored) {
          try {
            const userData = JSON.parse(stored);
            if (userData.address) {
              // Ensure AppState exists
              window.AppState = window.AppState || {};
              window.AppState.user = window.AppState.user || {};
              window.AppState.user.address = userData.address;
            }
          } catch (e) {
            console.warn('MintNotifications: Could not parse stored user data');
          }
        }
      }
      
      if (window.AppState?.user?.address) {
        MintNotifications.init();
      }
    }
  };
  
  // Check immediately and then periodically
  setTimeout(checkLogin, 500); // Small delay to let other scripts load
  setInterval(checkLogin, 2000);
});

// Listen for login/logout events if AppState fires them
window.addEventListener('user-login', () => MintNotifications.init());
window.addEventListener('user-logout', () => MintNotifications.destroy());
