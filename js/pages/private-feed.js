// js/pages/private-feed.js

const PrivateFeed = {
  posts: [],
  
  async render() {
    const userAddress = AppState.session?.address;
    
    if (!userAddress) {
      return `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-icon">🔒</div>
            <h2>Connect Your Wallet</h2>
            <p>Sign in to view your private feed</p>
            <button class="btn-primary" onclick="XamanAuth.connect()">Connect Wallet</button>
          </div>
        </div>
      `;
    }

    // Mark feed as viewed (clear notification badge)
    this.markAsViewed(userAddress);

    // Fetch posts
    await this.loadPosts(userAddress);

    if (this.posts.length === 0) {
      return `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h2>No Private Content Yet</h2>
            <p>Purchase NFTs from artists to unlock exclusive content</p>
            <button class="btn-primary" onclick="UI.navigateTo('marketplace')">Browse Marketplace</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="page-container private-feed-page">
        <div class="page-header">
          <h1>🔒 Private Feed</h1>
          <p class="page-subtitle">Exclusive content from artists whose NFTs you own</p>
        </div>

        <div class="private-feed-grid" id="private-feed-grid">
          ${this.posts.map(post => this.renderPost(post)).join('')}
        </div>
      </div>
    `;
  },

  renderPost(post) {
    const isLiked = post.user_liked;
    const mediaUrl = post.media_url || `https://gateway.lighthouse.storage/ipfs/${post.media_cid}`;
    const thumbnailUrl = post.thumbnail_url || (post.thumbnail_cid ? `https://gateway.lighthouse.storage/ipfs/${post.thumbnail_cid}` : null);
    const timeAgo = this.getTimeAgo(post.created_at);

    return `
      <div class="private-post" data-post-id="${post.id}">
        <div class="post-header">
          <div class="post-artist" onclick="UI.navigateTo('profile', '${post.artist_address}')">
            ${post.artist_avatar 
              ? `<img src="${post.artist_avatar}" alt="${post.artist_name}" class="artist-avatar">`
              : `<div class="artist-avatar-placeholder">${post.artist_name[0]}</div>`
            }
            <div class="artist-info">
              <span class="artist-name">${post.artist_name}</span>
              <span class="post-time">${timeAgo}</span>
            </div>
          </div>
        </div>

        ${post.title ? `<h3 class="post-title">${post.title}</h3>` : ''}
        ${post.caption ? `<p class="post-caption">${post.caption}</p>` : ''}

        ${this.renderMedia(post.content_type, mediaUrl, thumbnailUrl)}

        <div class="post-actions">
          <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="PrivateFeed.toggleLike(${post.id})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span id="like-count-${post.id}">${post.like_count || 0}</span>
          </button>

          <button class="post-action-btn" onclick="PrivateFeed.showComments(${post.id})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span id="comment-count-${post.id}">${post.comment_count || 0}</span>
          </button>

          <button class="post-action-btn" onclick="ShareUtils.sharePost('${post.artist_name}', '${post.title || 'Private Post'}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
        </div>

        <div class="post-comments-section" id="comments-section-${post.id}" style="display: none;">
          <div class="comments-list" id="comments-list-${post.id}"></div>
          <div class="comment-input-container">
            <input type="text" placeholder="Add a comment..." id="comment-input-${post.id}" class="comment-input">
            <button onclick="PrivateFeed.addComment(${post.id})" class="btn-primary btn-small">Post</button>
          </div>
        </div>
      </div>
    `;
  },

  renderMedia(contentType, mediaUrl, thumbnailUrl) {
    if (contentType === 'image') {
      return `
        <div class="post-media">
          <img src="${mediaUrl}" alt="Post image" loading="lazy" oncontextmenu="return false;">
        </div>
      `;
    }

    if (contentType === 'video') {
      return `
        <div class="post-media">
          <video controls controlsList="nodownload" oncontextmenu="return false;" ${thumbnailUrl ? `poster="${thumbnailUrl}"` : ''}>
            <source src="${mediaUrl}" type="video/mp4">
          </video>
        </div>
      `;
    }

    if (contentType === 'audio') {
      return `
        <div class="post-media audio">
          <audio controls controlsList="nodownload">
            <source src="${mediaUrl}" type="audio/mpeg">
          </audio>
        </div>
      `;
    }

    return '';
  },

  async loadPosts(userAddress) {
    try {
      const response = await fetch(`/api/private-feed?action=feed&userAddress=${userAddress}`);
      const data = await response.json();
      this.posts = data.posts || [];
    } catch (error) {
      console.error('Error loading private feed:', error);
      this.posts = [];
    }
  },

  async markAsViewed(userAddress) {
    try {
      await fetch('/api/private-feed?action=mark-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress })
      });
      
      // Hide notification badge
      const badge = document.getElementById('private-feed-badge');
      if (badge) badge.style.display = 'none';
    } catch (error) {
      console.error('Error marking feed as viewed:', error);
    }
  },

  async toggleLike(postId) {
    const userAddress = AppState.session?.address;
    if (!userAddress) return;

    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.user_liked;
    const action = isLiked ? 'unlike' : 'like';

    try {
      await fetch(`/api/private-feed?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userAddress })
      });

      // Update UI
      post.user_liked = !isLiked;
      post.like_count = isLiked ? post.like_count - 1 : post.like_count + 1;

      const likeBtn = document.querySelector(`[data-post-id="${postId}"] .post-action-btn`);
      const likeCount = document.getElementById(`like-count-${postId}`);
      
      if (likeBtn) {
        likeBtn.classList.toggle('liked');
        const svg = likeBtn.querySelector('svg path');
        if (svg) svg.setAttribute('fill', isLiked ? 'none' : 'currentColor');
      }
      if (likeCount) likeCount.textContent = post.like_count;

    } catch (error) {
      console.error('Error toggling like:', error);
    }
  },

  async showComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (!section) return;

    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      await this.loadComments(postId);
    }
  },

  async loadComments(postId) {
    try {
      const response = await fetch(`/api/private-feed?action=comments&postId=${postId}`);
      const data = await response.json();
      
      const commentsList = document.getElementById(`comments-list-${postId}`);
      if (!commentsList) return;

      commentsList.innerHTML = data.comments.map(c => `
        <div class="comment">
          ${c.user_avatar 
            ? `<img src="${c.user_avatar}" alt="${c.user_name}" class="comment-avatar">`
            : `<div class="comment-avatar-placeholder">${c.user_name[0]}</div>`
          }
          <div class="comment-content">
            <span class="comment-author">${c.user_name}</span>
            <p class="comment-text">${c.comment_text}</p>
            <span class="comment-time">${this.getTimeAgo(c.created_at)}</span>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  },

  async addComment(postId) {
    const userAddress = AppState.session?.address;
    if (!userAddress) return;

    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;

    const commentText = input.value.trim();
    if (!commentText) return;

    try {
      await fetch('/api/private-feed?action=comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userAddress, commentText })
      });

      input.value = '';
      
      // Update comment count
      const post = this.posts.find(p => p.id === postId);
      if (post) {
        post.comment_count++;
        const countEl = document.getElementById(`comment-count-${postId}`);
        if (countEl) countEl.textContent = post.comment_count;
      }

      // Reload comments
      await this.loadComments(postId);

    } catch (error) {
      console.error('Error adding comment:', error);
    }
  },

  getTimeAgo(timestamp) {
    const now = new Date();
    const posted = new Date(timestamp);
    const diffMs = now - posted;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return posted.toLocaleDateString();
  }
};

// Export for use in app.js
window.PrivateFeed = PrivateFeed;
