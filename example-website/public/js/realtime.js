/**
 * Real-time WebSocket client for Ansybl interactions
 */

class AnsyblRealtimeClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.user = null;
    this.subscribedPosts = new Set();
    this.typingTimeouts = new Map();
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // Event handlers
    this.onInteractionUpdate = null;
    this.onCommentUpdate = null;
    this.onFeedUpdate = null;
    this.onNotification = null;
    this.onConnectionChange = null;
    this.onTypingUpdate = null;
  }

  // Initialize WebSocket connection
  connect(userData = null) {
    if (this.socket && this.connected) {
      console.log('Already connected to WebSocket');
      return;
    }

    try {
      // Load Socket.IO from CDN if not already loaded
      if (typeof io === 'undefined') {
        this.loadSocketIO().then(() => this.establishConnection(userData));
        return;
      }

      this.establishConnection(userData);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.handleConnectionError();
    }
  }

  // Load Socket.IO library dynamically
  loadSocketIO() {
    return new Promise((resolve, reject) => {
      if (typeof io !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Establish WebSocket connection
  establishConnection(userData) {
    this.socket = io({
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventHandlers();

    if (userData) {
      this.user = userData;
    }
  }

  // Setup WebSocket event handlers
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      this.connected = true;
      this.connectionAttempts = 0;

      // Identify user if available
      if (this.user) {
        this.socket.emit('identify', this.user);
      }

      // Re-subscribe to posts if any
      this.subscribedPosts.forEach(postId => {
        this.socket.emit('subscribe_post', postId);
      });

      // Subscribe to global feed
      this.socket.emit('subscribe_feed');

      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
      this.connected = false;

      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }

      // Attempt to reconnect
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    });

    // Handle identification response
    this.socket.on('identified', (response) => {
      console.log('User identified:', response);
    });

    // Handle subscription confirmations
    this.socket.on('subscribed', (response) => {
      console.log('Subscribed:', response);
    });

    // Handle interaction updates
    this.socket.on('interaction_update', (data) => {
      console.log('Interaction update received:', data);
      this.handleInteractionUpdate(data);
    });

    // Handle comment updates
    this.socket.on('comment_update', (data) => {
      console.log('Comment update received:', data);
      this.handleCommentUpdate(data);
    });

    // Handle feed updates
    this.socket.on('feed_update', (data) => {
      console.log('Feed update received:', data);
      if (this.onFeedUpdate) {
        this.onFeedUpdate(data);
      }
    });

    // Handle notifications
    this.socket.on('notification', (notification) => {
      console.log('Notification received:', notification);
      if (this.onNotification) {
        this.onNotification(notification);
      }
    });

    // Handle typing indicators
    this.socket.on('user_typing', (data) => {
      if (this.onTypingUpdate) {
        this.onTypingUpdate(data, 'start');
      }
    });

    this.socket.on('user_stopped_typing', (data) => {
      if (this.onTypingUpdate) {
        this.onTypingUpdate(data, 'stop');
      }
    });

    // Handle connection stats
    this.socket.on('connection_stats', (stats) => {
      console.log('Connection stats:', stats);
    });
  }

  // Handle interaction updates
  handleInteractionUpdate(data) {
    const { postId, action, data: interactionData } = data;

    // Update UI elements
    this.updateInteractionCounts(postId, action, interactionData);

    // Call custom handler if set
    if (this.onInteractionUpdate) {
      this.onInteractionUpdate(data);
    }

    // Show notification if it's not from current user
    if (this.user && interactionData.userId !== this.user.id) {
      this.showInteractionNotification(action, interactionData);
    }
  }

  // Handle comment updates
  handleCommentUpdate(data) {
    const { postId, action, commentId, data: commentData } = data;

    // Update comment section
    this.updateCommentSection(postId, action, commentId, commentData);

    // Call custom handler if set
    if (this.onCommentUpdate) {
      this.onCommentUpdate(data);
    }

    // Show notification for new comments
    if (action === 'new_comment' && this.user && 
        commentData.comment.author.name !== this.user.name) {
      this.showCommentNotification(commentData.comment);
    }
  }

  // Update interaction counts in UI
  updateInteractionCounts(postId, action, data) {
    const likeBtn = document.querySelector(`#like-btn-${postId}, #like-btn`);
    const shareBtn = document.querySelector(`#share-btn-${postId}, #share-btn`);
    const likeCount = document.querySelector(`#like-count-${postId}, #like-count`);
    const shareCount = document.querySelector(`#share-count-${postId}, #share-count`);

    if (action === 'like' || action === 'unlike') {
      if (likeCount) {
        likeCount.textContent = data.likesCount;
      }
      if (likeBtn && this.user && data.userId === this.user.id) {
        if (action === 'like') {
          likeBtn.classList.add('active');
        } else {
          likeBtn.classList.remove('active');
        }
      }
    } else if (action === 'share') {
      if (shareCount) {
        shareCount.textContent = data.sharesCount;
      }
      if (shareBtn && this.user && data.userId === this.user.id) {
        shareBtn.classList.add('active');
        setTimeout(() => shareBtn.classList.remove('active'), 2000);
      }
    }

    // Add visual feedback for real-time updates
    this.addUpdateAnimation(postId, action);
  }

  // Update comment section
  updateCommentSection(postId, action, commentId, data) {
    const commentsList = document.querySelector(`#comments-list-${postId}, #comments-list`);
    
    if (!commentsList) return;

    if (action === 'new_comment' && data.comment) {
      this.addNewComment(commentsList, data.comment);
    } else if (action === 'edit' && data) {
      this.updateComment(commentId, data);
    } else if (action === 'delete') {
      this.removeComment(commentId);
    } else if (action === 'moderate') {
      this.moderateComment(commentId, data);
    }

    // Update reply count
    const replyCount = document.querySelector(`#reply-count-${postId}, #reply-count`);
    if (replyCount && action === 'new_comment') {
      const currentCount = parseInt(replyCount.textContent) || 0;
      replyCount.textContent = currentCount + 1;
    }
  }

  // Add new comment to UI
  addNewComment(commentsList, comment) {
    const commentHtml = this.generateCommentHTML(comment);
    
    // Check if this is a reply
    if (comment.parentCommentId) {
      const parentComment = document.querySelector(`#comment-${comment.parentCommentId}`);
      if (parentComment) {
        let repliesContainer = parentComment.querySelector('.comment-replies');
        if (!repliesContainer) {
          repliesContainer = document.createElement('div');
          repliesContainer.className = 'comment-replies';
          parentComment.appendChild(repliesContainer);
        }
        repliesContainer.insertAdjacentHTML('beforeend', commentHtml);
      } else {
        // Parent not found, add as top-level comment
        commentsList.insertAdjacentHTML('afterbegin', commentHtml);
      }
    } else {
      // Top-level comment
      commentsList.insertAdjacentHTML('afterbegin', commentHtml);
    }

    // Add animation
    const newComment = document.getElementById(`comment-${comment.id}`);
    if (newComment) {
      newComment.classList.add('new-comment-animation');
      setTimeout(() => newComment.classList.remove('new-comment-animation'), 3000);
    }
  }

  // Generate HTML for a comment
  generateCommentHTML(comment) {
    const isReply = !!comment.parentCommentId;
    return `
      <div class="comment ${isReply ? 'comment-reply' : ''}" id="comment-${comment.id}">
        <div class="comment-header">
          <strong class="comment-author">
            ${comment.author.url ? 
              `<a href="${comment.author.url}" target="_blank">${comment.author.name}</a>` : 
              comment.author.name
            }
          </strong>
          <time class="comment-date" datetime="${comment.datePublished}">
            ${new Date(comment.datePublished).toLocaleString()}
          </time>
          ${comment.dateModified ? 
            `<span class="comment-edited">(edited)</span>` : ''
          }
        </div>
        <div class="comment-content">
          ${comment.contentHtml}
        </div>
        <div class="comment-actions">
          <button class="reply-btn" onclick="replyToComment('${comment.id}')">Reply</button>
          ${this.user && this.user.name === comment.author.name ? 
            `<button class="edit-btn" onclick="editComment('${comment.id}')">Edit</button>
             <button class="delete-btn" onclick="deleteComment('${comment.id}')">Delete</button>` : ''
          }
        </div>
        <div class="comment-meta">
          <small>Ansybl ID: <code>${comment.inReplyTo}</code></small>
        </div>
      </div>
    `;
  }

  // Subscribe to post updates
  subscribeToPost(postId) {
    if (!this.socket || !this.connected) {
      console.warn('WebSocket not connected, cannot subscribe to post');
      return;
    }

    this.subscribedPosts.add(postId);
    this.socket.emit('subscribe_post', postId);
    console.log(`Subscribed to post ${postId} updates`);
  }

  // Unsubscribe from post updates
  unsubscribeFromPost(postId) {
    if (!this.socket || !this.connected) {
      return;
    }

    this.subscribedPosts.delete(postId);
    this.socket.emit('unsubscribe_post', postId);
    console.log(`Unsubscribed from post ${postId} updates`);
  }

  // Send typing indicator
  startTyping(postId) {
    if (!this.socket || !this.connected || !this.user) {
      return;
    }

    this.socket.emit('typing_start', { postId });

    // Clear existing timeout
    if (this.typingTimeouts.has(postId)) {
      clearTimeout(this.typingTimeouts.get(postId));
    }

    // Auto-stop typing after 3 seconds
    const timeout = setTimeout(() => {
      this.stopTyping(postId);
    }, 3000);

    this.typingTimeouts.set(postId, timeout);
  }

  // Stop typing indicator
  stopTyping(postId) {
    if (!this.socket || !this.connected || !this.user) {
      return;
    }

    this.socket.emit('typing_stop', { postId });

    if (this.typingTimeouts.has(postId)) {
      clearTimeout(this.typingTimeouts.get(postId));
      this.typingTimeouts.delete(postId);
    }
  }

  // Set user information
  setUser(userData) {
    this.user = userData;
    if (this.socket && this.connected) {
      this.socket.emit('identify', userData);
    }
  }

  // Show interaction notification
  showInteractionNotification(action, data) {
    const message = `${data.userName} ${action}d this post`;
    this.showNotification(message, 'interaction');
  }

  // Show comment notification
  showCommentNotification(comment) {
    const message = `${comment.author.name} added a new comment`;
    this.showNotification(message, 'comment');
  }

  // Show notification
  showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notificationContainer = document.getElementById('realtime-notifications');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'realtime-notifications';
      notificationContainer.className = 'realtime-notifications';
      document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    notificationContainer.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Add update animation
  addUpdateAnimation(postId, action) {
    const element = document.querySelector(`[data-post-id="${postId}"], .post`);
    if (element) {
      element.classList.add(`update-${action}`);
      setTimeout(() => element.classList.remove(`update-${action}`), 1000);
    }
  }

  // Handle connection errors
  handleConnectionError() {
    this.connectionAttempts++;
    console.log(`Connection attempt ${this.connectionAttempts} failed`);

    if (this.connectionAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        this.connect(this.user);
      }, Math.pow(2, this.connectionAttempts) * 1000); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
      this.showNotification('Connection lost. Please refresh the page.', 'error');
    }
  }

  // Handle reconnection
  handleReconnection() {
    setTimeout(() => {
      if (!this.connected) {
        this.connect(this.user);
      }
    }, 2000);
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.subscribedPosts.clear();
    this.typingTimeouts.clear();
  }

  // Get connection status
  isConnected() {
    return this.connected;
  }
}

// Create global instance
window.ansyblRealtime = new AnsyblRealtimeClient();

// Auto-connect when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize user from localStorage or create demo user
  let user = localStorage.getItem('ansyblUser');
  if (!user) {
    user = {
      id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
      name: 'Demo User'
    };
    localStorage.setItem('ansyblUser', JSON.stringify(user));
  } else {
    user = JSON.parse(user);
  }

  // Connect to WebSocket
  window.ansyblRealtime.connect(user);

  // Subscribe to current post if on post page
  const postId = window.location.pathname.match(/\/post\/(.+)/)?.[1];
  if (postId) {
    window.ansyblRealtime.subscribeToPost(postId);
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnsyblRealtimeClient;
}