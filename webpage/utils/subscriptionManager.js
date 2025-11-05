// webpage/utils/subscriptionManager.js
// Manages feed subscriptions with localStorage persistence

window.SubscriptionManager = {
  STORAGE_KEY: 'ansybl_subscriptions',
  
  // Get all subscriptions
  getSubscriptions: function() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      return [];
    }
  },

  // Add new subscription
  addSubscription: function(feedUrl, feedData) {
    const subscriptions = this.getSubscriptions();
    
    // Check if already subscribed
    const existing = subscriptions.find(sub => sub.feedUrl === feedUrl);
    if (existing) {
      throw new Error('Already subscribed to this feed');
    }

    const subscription = {
      id: this.generateId(),
      feedUrl: feedUrl,
      title: feedData.title,
      description: feedData.description || '',
      author: feedData.author,
      homePageUrl: feedData.home_page_url,
      icon: feedData.icon,
      language: feedData.language,
      dateAdded: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      itemCount: feedData.items ? feedData.items.length : 0,
      unreadCount: feedData.items ? feedData.items.length : 0,
      tags: [],
      isActive: true
    };

    subscriptions.push(subscription);
    this.saveSubscriptions(subscriptions);
    return subscription;
  },

  // Remove subscription
  removeSubscription: function(subscriptionId) {
    const subscriptions = this.getSubscriptions();
    const filtered = subscriptions.filter(sub => sub.id !== subscriptionId);
    this.saveSubscriptions(filtered);
  },

  // Update subscription metadata
  updateSubscription: function(subscriptionId, updates) {
    const subscriptions = this.getSubscriptions();
    const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
    
    if (index === -1) {
      throw new Error('Subscription not found');
    }

    subscriptions[index] = { ...subscriptions[index], ...updates };
    this.saveSubscriptions(subscriptions);
    return subscriptions[index];
  },

  // Mark items as read
  markAsRead: function(subscriptionId, itemIds = null) {
    const subscriptions = this.getSubscriptions();
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (itemIds === null) {
      // Mark all as read
      subscription.unreadCount = 0;
    } else {
      // Mark specific items as read
      const readCount = Array.isArray(itemIds) ? itemIds.length : 1;
      subscription.unreadCount = Math.max(0, subscription.unreadCount - readCount);
    }

    this.saveSubscriptions(subscriptions);
  },

  // Update feed data after fetching
  updateFeedData: function(subscriptionId, feedData) {
    const subscriptions = this.getSubscriptions();
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newItemCount = feedData.items ? feedData.items.length : 0;
    const newItems = Math.max(0, newItemCount - subscription.itemCount);

    const updates = {
      title: feedData.title,
      description: feedData.description || '',
      author: feedData.author,
      icon: feedData.icon,
      language: feedData.language,
      lastFetched: new Date().toISOString(),
      itemCount: newItemCount,
      unreadCount: subscription.unreadCount + newItems
    };

    return this.updateSubscription(subscriptionId, updates);
  },

  // Get subscription by ID
  getSubscription: function(subscriptionId) {
    const subscriptions = this.getSubscriptions();
    return subscriptions.find(sub => sub.id === subscriptionId);
  },

  // Get subscription by feed URL
  getSubscriptionByUrl: function(feedUrl) {
    const subscriptions = this.getSubscriptions();
    return subscriptions.find(sub => sub.feedUrl === feedUrl);
  },

  // Save subscriptions to localStorage
  saveSubscriptions: function(subscriptions) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(subscriptions));
    } catch (error) {
      console.error('Failed to save subscriptions:', error);
      throw new Error('Failed to save subscriptions');
    }
  },

  // Generate unique ID
  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Export subscriptions
  exportSubscriptions: function() {
    const subscriptions = this.getSubscriptions();
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      subscriptions: subscriptions.map(sub => ({
        feedUrl: sub.feedUrl,
        title: sub.title,
        tags: sub.tags,
        dateAdded: sub.dateAdded
      }))
    };
    return JSON.stringify(exportData, null, 2);
  },

  // Import subscriptions
  importSubscriptions: function(importData) {
    try {
      const data = typeof importData === 'string' ? JSON.parse(importData) : importData;
      
      if (!data.subscriptions || !Array.isArray(data.subscriptions)) {
        throw new Error('Invalid import format');
      }

      const currentSubs = this.getSubscriptions();
      const imported = [];
      const skipped = [];

      for (const sub of data.subscriptions) {
        if (!sub.feedUrl) continue;
        
        // Check if already exists
        if (currentSubs.find(existing => existing.feedUrl === sub.feedUrl)) {
          skipped.push(sub.feedUrl);
          continue;
        }

        // Create minimal subscription entry (will be updated when feed is fetched)
        const subscription = {
          id: this.generateId(),
          feedUrl: sub.feedUrl,
          title: sub.title || 'Imported Feed',
          description: '',
          author: { name: 'Unknown' },
          homePageUrl: '',
          icon: '',
          language: '',
          dateAdded: sub.dateAdded || new Date().toISOString(),
          lastFetched: null,
          itemCount: 0,
          unreadCount: 0,
          tags: sub.tags || [],
          isActive: true
        };

        currentSubs.push(subscription);
        imported.push(sub.feedUrl);
      }

      this.saveSubscriptions(currentSubs);
      return { imported, skipped };
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  },

  // Clear all subscriptions
  clearAll: function() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};