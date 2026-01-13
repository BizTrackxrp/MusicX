/**
 * XRP Music - Mint Notifications
 * Simple, bulletproof version
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
    this.dropdown.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      width: 320px;
      max-height: 400px;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      z-index: 9999;
      display: none;
      overflow: hidden;
    `;
    this.dropdown.innerHTML = `
      <div style="padding: 16px 20px; font-size: 16px; font-weight: 600; border-bottom: 1px solid #333;">
        Mint Status
      </div>
      <div id="mint-dropdown-content" style="padding: 12px; max-height: 320px; overflow-y: auto;">
        Loading...
      </div>
    `;
    document.body.appendChild(this.dropdown);
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.dropdown && 
          !this.dropdown.contains(e.target) && 
          !document.getElementById('mint-notifications-bell')?.contains(e.target)) {
        this.dropdown.style.display = 'none';
      }
    });
  },
  
  async fetchAndRender() {
    const content = document.getElementById('mint-dropdown-content');
    if (!content) return;
    
    // Get address from AppState or localStorage
    let address = window.AppState?.user?.address;
    if (!address) {
      try {
        const stored = localStorage.getItem('xrpmusic_user');
        if (stored) address = JSON.parse(stored).address;
      } catch(e) {}
    }
    
    if (!address) {
      content.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Please sign in</div>';
      return;
    }
    
    try {
      const res = await fetch(`/api/my-mint-jobs?address=${address}`);
      const data = await res.json();
      
      if (!data.success) {
        content.innerHTML = '<div style="color: #f66; padding: 20px;">Error loading jobs</div>';
        return;
      }
      
      const allJobs = [
        ...(data.jobs.active || []),
        ...(data.jobs.completedUnseen || []),
        ...(data.jobs.failed || []),
        ...(data.jobs.recentCompleted || [])
      ];
      
      if (allJobs.length === 0) {
        content.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No recent mints</div>';
        return;
      }
      
      content.innerHTML = allJobs.map(job => this.renderJob(job)).join('');
      
      // Update bell badge
      this.updateBadge(data);
      
    } catch(e) {
      console.error('Fetch error:', e);
      content.innerHTML = '<div style="color: #f66; padding: 20px;">Failed to load</div>';
    }
  },
  
  renderJob(job) {
    const isActive = job.status === 'pending' || job.status === 'minting';
    const isComplete = job.status === 'complete';
    const isFailed = job.status === 'failed';
    
    let statusHtml = '';
    let progressHtml = '';
    let timeHtml = '';
    
    if (isActive) {
      const pct = job.total_nfts > 0 ? Math.round((job.minted_count / job.total_nfts) * 100) : 0;
      statusHtml = `<div style="color: #8b5cf6;">Minting... ${job.minted_count}/${job.total_nfts} NFTs</div>`;
      progressHtml = `
        <div style="margin-top: 8px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #8b5cf6, #a855f7); border-radius: 3px;"></div>
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
          timeHtml = `<div style="color: #888; font-size: 12px; margin-top: 6px;">~${hrs}h ${mins}m remaining</div>`;
        } else if (remaining > 60) {
          timeHtml = `<div style="color: #888; font-size: 12px; margin-top: 6px;">~${Math.ceil(remaining / 60)} min remaining</div>`;
        } else {
          timeHtml = `<div style="color: #888; font-size: 12px; margin-top: 6px;">Almost done...</div>`;
        }
      } else {
        timeHtml = `<div style="color: #888; font-size: 12px; margin-top: 6px;">Calculating...</div>`;
      }
    } else if (isComplete) {
      statusHtml = `<div style="color: #22c55e;">✓ ${job.total_nfts} NFTs minted!</div>`;
    } else if (isFailed) {
      statusHtml = `<div style="color: #ef4444;">✗ Failed: ${job.error || 'Unknown'}</div>`;
    }
    
    return `
      <div style="padding: 14px; background: #252540; border-radius: 8px; margin-bottom: 8px;">
        <div style="font-weight: 600; margin-bottom: 6px;">${job.release_title || 'Untitled'}</div>
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
      badge.style.background = '#8b5cf6';
      badge.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else if (data.hasUnread) {
      badge.style.display = 'block';
      badge.style.background = '#22c55e';
      badge.style.animation = 'none';
    } else {
      badge.style.display = 'none';
    }
  },
  
  // Start polling for active jobs
  startPolling() {
    if (this.polling) return;
    this.polling = setInterval(() => {
      if (this.dropdown?.style.display !== 'none') {
        this.fetchAndRender();
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

// Auto-check for active jobs on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Get address
    let address = window.AppState?.user?.address;
    if (!address) {
      try {
        const stored = localStorage.getItem('xrpmusic_user');
        if (stored) address = JSON.parse(stored).address;
      } catch(e) {}
    }
    
    if (address) {
      // Check if there are active jobs to show badge
      fetch(`/api/my-mint-jobs?address=${address}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            MintNotifications.updateBadge(data);
            if (data.hasActive) {
              MintNotifications.startPolling();
            }
          }
        })
        .catch(() => {});
    }
  }, 1000);
});

// Add badge pulse animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.8; }
  }
  .mint-bell-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #0f0f1a;
  }
`;
document.head.appendChild(style);
