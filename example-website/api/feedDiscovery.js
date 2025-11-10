/**
 * Feed Discovery and Subscription API
 * Implements WebFinger, feed discovery, and subscription management
 */

import { Router } from 'express';
import { siteConfig } from '../data/config.js';
import { 
  feedDiscovery, 
  subscriptionManager, 
  feedHealthMonitor 
} from '../lib/feedDiscovery.js';

const router = Router();

/**
 * WebFinger endpoint for feed discovery
 * Implements RFC 7033
 */
router.get('/.well-known/webfinger', (req, res) => {
  try {
    const resource = req.query.resource;
    
    if (!resource) {
      return res.status(400).json({
        error: 'Missing resource parameter'
      });
    }
    
    // Parse resource (e.g., acct:user@domain or https://domain/user)
    let identifier;
    if (resource.startsWith('acct:')) {
      identifier = resource.substring(5);
    } else if (resource.startsWith('http')) {
      const url = new URL(resource);
      identifier = url.pathname.substring(1);
    } else {
      return res.status(400).json({
        error: 'Invalid resource format'
      });
    }
    
    // For demo, we'll return the site's feed information
    const webfingerResponse = {
      subject: resource,
      aliases: [
        siteConfig.baseUrl,
        `${siteConfig.baseUrl}/author`
      ],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `${siteConfig.baseUrl}/actor`
        },
        {
          rel: 'alternate',
          type: 'application/json',
          href: `${siteConfig.baseUrl}/feed.ansybl`
        },
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          href: `${siteConfig.baseUrl}/feed.rss`
        },
        {
          rel: 'alternate',
          type: 'application/feed+json',
          href: `${siteConfig.baseUrl}/feed.json`
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: siteConfig.baseUrl
        },
        {
          rel: 'http://webfinger.net/rel/avatar',
          href: siteConfig.author.avatar || `${siteConfig.baseUrl}/avatar.jpg`
        }
      ]
    };
    
    res.setHeader('Content-Type', 'application/jrd+json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(webfingerResponse);
    
  } catch (error) {
    console.error('WebFinger error:', error);
    res.status(500).json({
      error: 'Failed to process WebFinger request',
      message: error.message
    });
  }
});

/**
 * Host-meta endpoint for discovery
 */
router.get('/.well-known/host-meta', (req, res) => {
  try {
    const hostMeta = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" template="${siteConfig.baseUrl}/.well-known/webfinger?resource={uri}"/>
</XRD>`;
    
    res.setHeader('Content-Type', 'application/xrd+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(hostMeta);
    
  } catch (error) {
    console.error('Host-meta error:', error);
    res.status(500).json({
      error: 'Failed to generate host-meta',
      message: error.message
    });
  }
});

/**
 * Feed autodiscovery endpoint
 */
router.get('/discover', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL parameter is required'
      });
    }
    
    const discovery = await feedDiscovery.discoverFeeds(url);
    
    res.json({
      success: true,
      discovery
    });
    
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({
      error: 'Failed to discover feeds',
      message: error.message
    });
  }
});

/**
 * Get all discovered feeds
 */
router.get('/discovered', (req, res) => {
  try {
    const feeds = feedDiscovery.getDiscoveredFeeds();
    
    res.json({
      success: true,
      count: feeds.length,
      feeds
    });
  } catch (error) {
    console.error('Error getting discovered feeds:', error);
    res.status(500).json({
      error: 'Failed to get discovered feeds',
      message: error.message
    });
  }
});

/**
 * Feed links for HTML autodiscovery
 */
router.get('/feed-links', (req, res) => {
  try {
    const links = feedDiscovery.generateAutodiscoveryLinks(siteConfig.baseUrl);
    const html = feedDiscovery.generateLinkTags(siteConfig.baseUrl);
    const headers = feedDiscovery.generateLinkHeaders(siteConfig.baseUrl);
    
    res.json({
      success: true,
      links,
      html,
      headers
    });
    
  } catch (error) {
    console.error('Feed links error:', error);
    res.status(500).json({
      error: 'Failed to generate feed links',
      message: error.message
    });
  }
});

/**
 * Subscribe to feed
 */
router.post('/subscribe', (req, res) => {
  try {
    const { feedUrl, subscriber } = req.body;
    
    if (!feedUrl || !subscriber || !subscriber.name) {
      return res.status(400).json({
        error: 'feedUrl and subscriber.name are required'
      });
    }
    
    const subscription = subscriptionManager.subscribe(feedUrl, subscriber);
    
    res.status(201).json({
      success: true,
      subscription,
      message: 'Successfully subscribed to feed'
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      error: 'Failed to subscribe',
      message: error.message
    });
  }
});

/**
 * Unsubscribe from feed
 */
router.delete('/subscribe/:subscriptionId', (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const success = subscriptionManager.unsubscribe(subscriptionId);
    
    if (!success) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed'
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      error: 'Failed to unsubscribe',
      message: error.message
    });
  }
});

/**
 * Get subscription details
 */
router.get('/subscribe/:subscriptionId', (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = subscriptionManager.getSubscription(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }
    
    res.json({
      success: true,
      subscription
    });
    
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      error: 'Failed to get subscription',
      message: error.message
    });
  }
});

/**
 * Get all subscriptions for a subscriber
 */
router.get('/subscriptions/:subscriberId', (req, res) => {
  try {
    const { subscriberId } = req.params;
    
    const subscriptions = subscriptionManager.getSubscriberSubscriptions(subscriberId);
    
    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions
    });
    
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      error: 'Failed to get subscriptions',
      message: error.message
    });
  }
});

/**
 * Get subscription statistics
 */
router.get('/subscriptions/stats', (req, res) => {
  try {
    const stats = subscriptionManager.getStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({
      error: 'Failed to get subscription stats',
      message: error.message
    });
  }
});

/**
 * Update subscription status
 */
router.patch('/subscribe/:subscriptionId', (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'paused', 'suspended'].includes(status)) {
      return res.status(400).json({
        error: 'Valid status is required (active, paused, suspended)'
      });
    }
    
    const success = subscriptionManager.updateSubscriptionStatus(subscriptionId, status);
    
    if (!success) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }
    
    res.json({
      success: true,
      message: `Subscription status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      error: 'Failed to update subscription',
      message: error.message
    });
  }
});

/**
 * Register feed for health monitoring
 */
router.post('/health/register', (req, res) => {
  try {
    const { feedUrl, options } = req.body;
    
    if (!feedUrl) {
      return res.status(400).json({
        error: 'feedUrl is required'
      });
    }
    
    const feedId = feedHealthMonitor.registerFeed(feedUrl, options);
    
    res.status(201).json({
      success: true,
      feedId,
      message: 'Feed registered for health monitoring'
    });
    
  } catch (error) {
    console.error('Register health monitor error:', error);
    res.status(500).json({
      error: 'Failed to register feed',
      message: error.message
    });
  }
});

/**
 * Check feed health
 */
router.post('/health/check', async (req, res) => {
  try {
    const { feedUrl } = req.body;
    
    if (!feedUrl) {
      return res.status(400).json({
        error: 'feedUrl is required'
      });
    }
    
    const check = await feedHealthMonitor.checkFeedHealth(feedUrl);
    
    res.json({
      success: true,
      check
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Failed to check feed health',
      message: error.message
    });
  }
});

/**
 * Get feed health status
 */
router.get('/health/:feedUrl', (req, res) => {
  try {
    const feedUrl = decodeURIComponent(req.params.feedUrl);
    
    const health = feedHealthMonitor.getFeedHealth(feedUrl);
    
    if (!health) {
      return res.status(404).json({
        error: 'Feed not registered for monitoring'
      });
    }
    
    res.json({
      success: true,
      health
    });
    
  } catch (error) {
    console.error('Get health error:', error);
    res.status(500).json({
      error: 'Failed to get feed health',
      message: error.message
    });
  }
});

/**
 * Get all monitored feeds health
 */
router.get('/health', (req, res) => {
  try {
    const allHealth = feedHealthMonitor.getAllFeedHealth();
    
    res.json({
      success: true,
      count: allHealth.length,
      feeds: allHealth
    });
    
  } catch (error) {
    console.error('Get all health error:', error);
    res.status(500).json({
      error: 'Failed to get feed health',
      message: error.message
    });
  }
});

export default router;
