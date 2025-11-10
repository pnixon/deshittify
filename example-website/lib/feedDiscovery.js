/**
 * Feed Discovery and Subscription Management
 * Implements autodiscovery mechanisms and subscription features
 */

import { createHash } from 'crypto';

/**
 * Feed discovery service
 */
export class FeedDiscoveryService {
  constructor() {
    this.discoveredFeeds = new Map();
  }

  /**
   * Generate feed autodiscovery links for HTML pages
   */
  generateAutodiscoveryLinks(baseUrl) {
    return [
      {
        rel: 'alternate',
        type: 'application/json',
        title: 'Ansybl Feed',
        href: `${baseUrl}/feed.ansybl`
      },
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'RSS Feed',
        href: `${baseUrl}/feed.rss`
      },
      {
        rel: 'alternate',
        type: 'application/feed+json',
        title: 'JSON Feed',
        href: `${baseUrl}/feed.json`
      },
      {
        rel: 'hub',
        href: `${baseUrl}/api/feed/hub`
      },
      {
        rel: 'self',
        type: 'application/json',
        href: `${baseUrl}/feed.ansybl`
      }
    ];
  }

  /**
   * Generate HTML link tags for autodiscovery
   */
  generateLinkTags(baseUrl) {
    const links = this.generateAutodiscoveryLinks(baseUrl);
    return links.map(link => {
      const attrs = Object.entries(link)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      return `<link ${attrs}>`;
    }).join('\n');
  }

  /**
   * Generate HTTP Link headers for autodiscovery
   */
  generateLinkHeaders(baseUrl) {
    const links = this.generateAutodiscoveryLinks(baseUrl);
    return links.map(link => {
      const attrs = Object.entries(link)
        .filter(([key]) => key !== 'href')
        .map(([key, value]) => `${key}="${value}"`)
        .join('; ');
      return `<${link.href}>; ${attrs}`;
    }).join(', ');
  }

  /**
   * Discover feeds from a URL
   */
  async discoverFeeds(url) {
    try {
      // In a real implementation, this would fetch and parse the URL
      // For now, we'll return a mock discovery result
      const feedId = this._generateFeedId(url);
      
      const discovery = {
        url,
        feedId,
        discovered: new Date().toISOString(),
        feeds: [
          {
            type: 'ansybl',
            url: `${url}/feed.ansybl`,
            title: 'Ansybl Feed'
          },
          {
            type: 'rss',
            url: `${url}/feed.rss`,
            title: 'RSS Feed'
          },
          {
            type: 'json-feed',
            url: `${url}/feed.json`,
            title: 'JSON Feed'
          }
        ]
      };
      
      this.discoveredFeeds.set(feedId, discovery);
      return discovery;
    } catch (error) {
      throw new Error(`Failed to discover feeds: ${error.message}`);
    }
  }

  /**
   * Get discovered feeds
   */
  getDiscoveredFeeds() {
    return Array.from(this.discoveredFeeds.values());
  }

  /**
   * Generate feed ID from URL
   * @private
   */
  _generateFeedId(url) {
    return createHash('sha256')
      .update(url)
      .digest('hex')
      .substring(0, 16);
  }
}

/**
 * Subscription manager
 */
export class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map();
    this.subscribers = new Map();
    this.subscriptionIdCounter = 1;
  }

  /**
   * Subscribe to a feed
   */
  subscribe(feedUrl, subscriberInfo) {
    const subscriptionId = `sub-${this.subscriptionIdCounter++}`;
    
    const subscription = {
      id: subscriptionId,
      feedUrl,
      subscriber: {
        id: subscriberInfo.id || this._generateSubscriberId(subscriberInfo),
        name: subscriberInfo.name,
        email: subscriberInfo.email || null,
        callbackUrl: subscriberInfo.callbackUrl || null
      },
      subscribedAt: new Date().toISOString(),
      status: 'active',
      lastDelivery: null,
      deliveryCount: 0,
      failureCount: 0
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Track by subscriber
    if (!this.subscribers.has(subscription.subscriber.id)) {
      this.subscribers.set(subscription.subscriber.id, []);
    }
    this.subscribers.get(subscription.subscriber.id).push(subscriptionId);
    
    return subscription;
  }

  /**
   * Unsubscribe from a feed
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }
    
    // Remove from subscriber tracking
    const subscriberId = subscription.subscriber.id;
    const subscriberSubs = this.subscribers.get(subscriberId);
    if (subscriberSubs) {
      const index = subscriberSubs.indexOf(subscriptionId);
      if (index > -1) {
        subscriberSubs.splice(index, 1);
      }
      
      if (subscriberSubs.length === 0) {
        this.subscribers.delete(subscriberId);
      }
    }
    
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId) {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a subscriber
   */
  getSubscriberSubscriptions(subscriberId) {
    const subscriptionIds = this.subscribers.get(subscriberId) || [];
    return subscriptionIds.map(id => this.subscriptions.get(id)).filter(Boolean);
  }

  /**
   * Get all subscriptions for a feed
   */
  getFeedSubscriptions(feedUrl) {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.feedUrl === feedUrl);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active');
  }

  /**
   * Update subscription status
   */
  updateSubscriptionStatus(subscriptionId, status) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }
    
    subscription.status = status;
    subscription.lastUpdated = new Date().toISOString();
    
    return true;
  }

  /**
   * Record delivery attempt
   */
  recordDelivery(subscriptionId, success) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }
    
    subscription.lastDelivery = new Date().toISOString();
    subscription.deliveryCount++;
    
    if (!success) {
      subscription.failureCount++;
      
      // Suspend subscription after too many failures
      if (subscription.failureCount >= 10) {
        subscription.status = 'suspended';
      }
    } else {
      subscription.failureCount = 0; // Reset on success
    }
    
    return true;
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    const allSubs = Array.from(this.subscriptions.values());
    
    return {
      total: allSubs.length,
      active: allSubs.filter(s => s.status === 'active').length,
      suspended: allSubs.filter(s => s.status === 'suspended').length,
      paused: allSubs.filter(s => s.status === 'paused').length,
      totalSubscribers: this.subscribers.size,
      totalDeliveries: allSubs.reduce((sum, s) => sum + s.deliveryCount, 0),
      totalFailures: allSubs.reduce((sum, s) => sum + s.failureCount, 0)
    };
  }

  /**
   * Generate subscriber ID
   * @private
   */
  _generateSubscriberId(subscriberInfo) {
    const data = JSON.stringify(subscriberInfo);
    return createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 16);
  }
}

/**
 * Feed health monitor
 */
export class FeedHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.checkInterval = 300000; // 5 minutes
  }

  /**
   * Register feed for health monitoring
   */
  registerFeed(feedUrl, options = {}) {
    const feedId = this._generateFeedId(feedUrl);
    
    this.healthChecks.set(feedId, {
      feedUrl,
      registered: new Date().toISOString(),
      lastCheck: null,
      status: 'unknown',
      checks: [],
      options: {
        checkInterval: options.checkInterval || this.checkInterval,
        alertThreshold: options.alertThreshold || 3
      }
    });
    
    return feedId;
  }

  /**
   * Perform health check on a feed
   */
  async checkFeedHealth(feedUrl) {
    const feedId = this._generateFeedId(feedUrl);
    const monitor = this.healthChecks.get(feedId);
    
    if (!monitor) {
      throw new Error('Feed not registered for monitoring');
    }
    
    const startTime = Date.now();
    const check = {
      timestamp: new Date().toISOString(),
      status: 'unknown',
      responseTime: 0,
      error: null
    };
    
    try {
      // In a real implementation, this would fetch and validate the feed
      // For now, we'll simulate a health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      check.status = 'healthy';
      check.responseTime = Date.now() - startTime;
      
      monitor.status = 'healthy';
    } catch (error) {
      check.status = 'unhealthy';
      check.error = error.message;
      check.responseTime = Date.now() - startTime;
      
      monitor.status = 'unhealthy';
    }
    
    monitor.lastCheck = check.timestamp;
    monitor.checks.push(check);
    
    // Keep only recent checks
    if (monitor.checks.length > 100) {
      monitor.checks.shift();
    }
    
    return check;
  }

  /**
   * Get feed health status
   */
  getFeedHealth(feedUrl) {
    const feedId = this._generateFeedId(feedUrl);
    const monitor = this.healthChecks.get(feedId);
    
    if (!monitor) {
      return null;
    }
    
    const recentChecks = monitor.checks.slice(-10);
    const healthyChecks = recentChecks.filter(c => c.status === 'healthy').length;
    const avgResponseTime = recentChecks.length > 0 ?
      recentChecks.reduce((sum, c) => sum + c.responseTime, 0) / recentChecks.length : 0;
    
    return {
      feedUrl: monitor.feedUrl,
      status: monitor.status,
      lastCheck: monitor.lastCheck,
      uptime: `${((healthyChecks / recentChecks.length) * 100).toFixed(2)}%`,
      avgResponseTime: `${Math.round(avgResponseTime)}ms`,
      recentChecks: recentChecks.length,
      healthyChecks,
      unhealthyChecks: recentChecks.length - healthyChecks
    };
  }

  /**
   * Get all monitored feeds
   */
  getAllFeedHealth() {
    return Array.from(this.healthChecks.values()).map(monitor => {
      const feedId = this._generateFeedId(monitor.feedUrl);
      return this.getFeedHealth(monitor.feedUrl);
    });
  }

  /**
   * Generate feed ID
   * @private
   */
  _generateFeedId(url) {
    return createHash('sha256')
      .update(url)
      .digest('hex')
      .substring(0, 16);
  }
}

// Create singleton instances
export const feedDiscovery = new FeedDiscoveryService();
export const subscriptionManager = new SubscriptionManager();
export const feedHealthMonitor = new FeedHealthMonitor();

export default {
  FeedDiscoveryService,
  SubscriptionManager,
  FeedHealthMonitor,
  feedDiscovery,
  subscriptionManager,
  feedHealthMonitor
};
