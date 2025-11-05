// webpage/utils/interactionHandler.js
// Handles social interactions (likes, shares, replies) with local state management

window.InteractionHandler = {
  STORAGE_KEY: 'ansybl_interactions',
  
  // Get all stored interactions
  getInteractions: function() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load interactions:', error);
      return {};
    }
  },

  // Get interactions for specific item
  getItemInteractions: function(itemId) {
    const interactions = this.getInteractions();
    return interactions[itemId] || {
      liked: false,
      shared: false,
      replied: false,
      likeCount: 0,
      shareCount: 0,
      replyCount: 0
    };
  },

  // Toggle like for an item
  toggleLike: function(itemId, currentCount = 0) {
    const interactions = this.getInteractions();
    const itemInteractions = interactions[itemId] || {};
    
    const wasLiked = itemInteractions.liked || false;
    const newLiked = !wasLiked;
    const newCount = wasLiked ? currentCount - 1 : currentCount + 1;

    interactions[itemId] = {
      ...itemInteractions,
      liked: newLiked,
      likeCount: Math.max(0, newCount)
    };

    this.saveInteractions(interactions);
    return {
      liked: newLiked,
      count: interactions[itemId].likeCount
    };
  },

  // Toggle share for an item
  toggleShare: function(itemId, currentCount = 0) {
    const interactions = this.getInteractions();
    const itemInteractions = interactions[itemId] || {};
    
    const wasShared = itemInteractions.shared || false;
    const newShared = !wasShared;
    const newCount = wasShared ? currentCount - 1 : currentCount + 1;

    interactions[itemId] = {
      ...itemInteractions,
      shared: newShared,
      shareCount: Math.max(0, newCount)
    };

    this.saveInteractions(interactions);
    return {
      shared: newShared,
      count: interactions[itemId].shareCount
    };
  },

  // Add reply to an item
  addReply: function(itemId, replyText, currentCount = 0) {
    const interactions = this.getInteractions();
    const itemInteractions = interactions[itemId] || {};
    
    const replies = itemInteractions.replies || [];
    const newReply = {
      id: this.generateId(),
      text: replyText,
      timestamp: new Date().toISOString(),
      author: 'You' // In a real app, this would be the current user
    };

    replies.push(newReply);

    interactions[itemId] = {
      ...itemInteractions,
      replied: true,
      replies: replies,
      replyCount: currentCount + 1
    };

    this.saveInteractions(interactions);
    return {
      reply: newReply,
      count: interactions[itemId].replyCount
    };
  },

  // Get replies for an item
  getReplies: function(itemId) {
    const interactions = this.getInteractions();
    const itemInteractions = interactions[itemId] || {};
    return itemInteractions.replies || [];
  },

  // Share item to external platform
  shareToExternal: function(item, platform) {
    const url = item.url || item.id;
    const title = item.title || 'Ansybl Post';
    const text = item.summary || item.content_text || '';

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      mastodon: `https://mastodon.social/share?text=${encodeURIComponent(title + ' ' + url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      
      // Track the share
      this.toggleShare(item.id, item.interactions?.shares_count || 0);
      return true;
    }

    return false;
  },

  // Copy item link to clipboard
  copyLink: function(item) {
    const url = item.url || item.id;
    
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(url).then(() => {
        this.toggleShare(item.id, item.interactions?.shares_count || 0);
        return true;
      }).catch(() => false);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          this.toggleShare(item.id, item.interactions?.shares_count || 0);
        }
        
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  },

  // Get interaction summary for display
  getInteractionSummary: function(itemId, originalInteractions = {}) {
    const localInteractions = this.getItemInteractions(itemId);
    
    return {
      likes_count: Math.max(
        originalInteractions.likes_count || 0,
        localInteractions.likeCount
      ),
      shares_count: Math.max(
        originalInteractions.shares_count || 0,
        localInteractions.shareCount
      ),
      replies_count: Math.max(
        originalInteractions.replies_count || 0,
        localInteractions.replyCount
      ),
      user_liked: localInteractions.liked,
      user_shared: localInteractions.shared,
      user_replied: localInteractions.replied
    };
  },

  // Save interactions to localStorage
  saveInteractions: function(interactions) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(interactions));
    } catch (error) {
      console.error('Failed to save interactions:', error);
    }
  },

  // Generate unique ID
  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Clear all interactions
  clearAll: function() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  // Export interactions
  exportInteractions: function() {
    const interactions = this.getInteractions();
    return JSON.stringify({
      version: '1.0',
      exported: new Date().toISOString(),
      interactions: interactions
    }, null, 2);
  }
};