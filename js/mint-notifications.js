/**
 * XRP Music - Mint Notifications
 * Shows background minting job status
 */

const MintNotifications = {
  dropdown: null,
  polling: null,
  
  toggleDropdown() {
    if (!this.dropdown) {
      this.createDropdown();
    }
    
    if (this.dropdown.style.display === 'none') {
      this.dropdown.style.display = 'block';
      this.fetchAndRender();
    } else {
      this.dropdown.style.display = 'none';
    }
  },
  
  createDropdown() {
    // Remove if exists
    document.getElementById('mint-dropdown')?.remove();
    
    this.dropdown = document.createElement('div');
    this.dropdown.id = 'mint-dropdown';
    this.dropdown.className = 'mint-notifications-dropdown';
    this.dropdown.innerHTML = `
      <div class="mint-dropdown-header">
        <span>Mint Status</span>
        <button class="mint-dropdown-close" onclick="MintNotifications.toggleDropdown()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="mint-dropdown-content" id="mint-dropdown-content">
        <div class="mint-dropdown-loading">
          <div class="spinner"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.dropdown);
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.dropdown && 
          this.dropdown.style.display !== 'none' &&
          !this.dropdown.contains(e.target) && 
          !document.getElementById('mint-notifications-bell')?.contains(e.target)) {
        this.dropdown.style.display = 'none';
      }
    });
  },
  
  async fetchAndRender() {
    const content = document.getElementById('mint-dropdown-content');
    if (!content) return;
    
    // IMPORTANT: Only use AppState.user - NOT localStorage
    // This ensures we don't show data when signed out
    const address = window.AppState?.user?.address;
    
    if (!address) {
      content.innerHTML = `
        <div class="mint-dropdown-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span>Connect wallet to view mint status</span>
        </div>
      `;
      return;
    }
    
    try {
      const res = await fetch(`/api/my-mint-jobs?address=${address}`);
      const data = await res.json();
      
      if (!data.success) {
        content.innerHTML = `<div class="mint-dropdown-error">Error loading jobs</div>`;
        return;
      }
      
      const allJobs = [
        ...(data.jobs.active || []),
        ...(data.jobs.completedUnseen || []),
        ...(data.jobs.failed || []),
        ...(data.jobs.recentCompleted || [])
      ];
      
      if (allJobs.length === 0) {
        content.innerHTML = `
          <div class="mint-dropdown-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            <span>No recent mints</span>
            <small>Your minting jobs will appear here</small>
          </div>
        `;
        return;
      }
      
      content.innerHTML = allJobs.map(job => this.renderJob(job)).join('');
      
      // Update bell badge
      this.updateBadge(data);
      
    } catch(e) {
      console.error('Fetch error:', e);
      content.innerHTML = `<div class="mint-dropdown-error">Failed to load</div>`;
    }
  },
  
  renderJob(job) {
    const isActive = job.status === 'pending' || job.status === 'minting';
    const isComplete = job.status === 'complete';
    const isFailed = job.status === 'failed';
    
    let statusClass = '';
    let statusHtml = '';
    let progressHtml = '';
    let timeHtml = '';
    
    if (isActive) {
      statusClass = 'active';
      const pct = job.total_nfts > 0 ? Math.round((job.minted_count / job.total_nfts) * 100) : 0;
      statusHtml = `<div class="mint-job-status minting">Minting... ${job.minted_count}/${job.total_nfts} NFTs</div>`;
      progressHtml = `
        <div class="mint-job-progress">
          <div class="mint-job-progress-fill" style="width: ${pct}%"></div>
        </div>
      `;
      
      // Time estimate
      if (job.minted_count > 10) {
        const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
        const perNft = elapsed / job.minted_count;
        const remaining = (job.total_nfts - job.minted_count) * perNft;
        
        if (remaining > 3600) {
          const hrs = Math.floor(remaining / 3600);
          const mins = Math.ceil((remaining % 3600) / 60);
          timeHtml = `<div class="mint-job-time">~${hrs}h ${mins}m remaining</div>`;
        } else if (remaining > 60) {
          timeHtml = `<div class="mint-job-time">~${Math.ceil(remaining / 60)} min remaining</div>`;
        } else {
          timeHtml = `<div class="mint-job-time">Almost done...</div>`;
        }
      } else {
        timeHtml = `<div class="mint-job-time">Calculating...</div>`;
      }
    } else if (isComplete) {
      statusClass = 'complete';
      statusHtml = `<div class="mint-job-status complete">✓ ${job.total_nfts} NFTs minted!</div>`;
    } else if (isFailed) {
      statusClass = 'failed';
      statusHtml = `<div class="mint-job-status failed">✗ Failed: ${job.error || 'Unknown error'}</div>`;
    }
    
    return `
      <div class="mint-job-card ${statusClass}">
        <div class="mint-job-title">${job.release_title || 'Untitled Release'}</div>
        ${statusHtml}
        ${progressHtml}
        ${timeHtml}
      </div>
    `;
  },
  
  updateBadge(data) {
    const bell = document.getElementById('mint-notifications-bell');
    const badge = bell?.querySelector('.mint-bell-badge');
    if (!badge) return;
    
    if (data.hasActive) {
      badge.style.display = 'block';
      badge.className = 'mint-bell-badge active';
    } else if (data.hasUnread) {
      badge.style.display = 'block';
      badge.className = 'mint-bell-badge unread';
    } else {
      badge.style.display = 'none';
    }
  },
  
  // Check for active jobs (called on page load if signed in)
  async checkForActiveJobs() {
    const address = window.AppState?.user?.address;
    if (!address) return;
    
    try {
      const res = await fetch(`/api/my-mint-jobs?address=${address}`);
      const data = await res.json();
      
      if (data.success) {
        this.updateBadge(data);
        if (data.hasActive) {
          this.startPolling();
        }
      }
    } catch(e) {
      console.error('Error checking mint jobs:', e);
    }
  },
  
  // Start polling for active jobs
  startPolling() {
    if (this.polling) return;
    this.polling = setInterval(() => {
      if (this.dropdown?.style.display !== 'none') {
        this.fetchAndRender();
      } else {
        // Still update badge even if dropdown closed
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
    width: 340px;
    max-height: 420px;
    background: var(--bg-card, #1a1a2e);
    border: 1px solid var(--border-color, #333);
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
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    border-bottom: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #15152a);
  }
  
  .mint-dropdown-close {
    background: none;
    border: none;
    color: var(--text-muted, #666);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: all 150ms;
  }
  
  .mint-dropdown-close:hover {
    color: var(--text-primary, #fff);
    background: var(--bg-hover, #252540);
  }
  
  .mint-dropdown-content {
    padding: 12px;
    max-height: 350px;
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
    padding: 32px 20px;
    color: var(--text-muted, #666);
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
  
  .mint-job-card {
    padding: 16px;
    background: var(--bg-hover, #252540);
    border-radius: 12px;
    margin-bottom: 10px;
    border: 1px solid transparent;
    transition: border-color 150ms;
  }
  
  .mint-job-card:last-child {
    margin-bottom: 0;
  }
  
  .mint-job-card.active {
    border-color: rgba(139, 92, 246, 0.3);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), transparent);
  }
  
  .mint-job-card.complete {
    border-color: rgba(34, 197, 94, 0.3);
  }
  
  .mint-job-card.failed {
    border-color: rgba(239, 68, 68, 0.3);
  }
  
  .mint-job-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin-bottom: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .mint-job-status {
    font-size: 13px;
    margin-bottom: 8px;
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
    height: 6px;
    background: rgba(0,0,0,0.3);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  
  .mint-job-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a855f7);
    border-radius: 3px;
    transition: width 300ms ease;
  }
  
  .mint-job-time {
    font-size: 12px;
    color: var(--text-muted, #888);
  }
  
  /* Bell badge styles */
  .mint-bell-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary, #0f0f1a);
  }
  
  .mint-bell-badge.active {
    background: #8b5cf6;
    animation: mintPulse 1.5s ease-in-out infinite;
  }
  
  .mint-bell-badge.unread {
    background: #22c55e;
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

// Auto-check for active jobs on page load (only if signed in)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Only check if actually signed in via AppState
    if (window.AppState?.user?.address) {
      MintNotifications.checkForActiveJobs();
    }
  }, 1500);
});
