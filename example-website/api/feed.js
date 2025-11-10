/**
 * Feed Serving and Syndication API
 * Optimized feed generation with caching, compression, and analytics
 */

import { Router } from 'express';
import { AnsyblGenerator } from '../lib/generator.js';
import { posts, comments, getKeyPair } from '../data/storage.js';
import { siteConfig } from '../data/config.js';
import { processMarkdownContent, generateContentSummary } from '../utils/content.js';
import { feedCache, feedAnalytics } from '../lib/feedCache.js';
import { createHash } from 'crypto';
import compression from 'compression';

const router = Router();
const generator = new AnsyblGenerator();

// Enable compression for feed responses
router.use(compression({
  filter: (req, res) => {
    // Compress JSON responses
    if (req.headers['accept-encoding']?.includes('gzip')) {
      return true;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
}));

/**
 * Generate content hash for cache invalidation
 */
function generateContentHash() {
  const contentData = {
    posts: posts.map(p => ({ id: p.id, modified: p.dateModified || p.datePublished })),
    comments: comments.map(c => ({ id: c.id, published: c.datePublished }))
  };
  
  return createHash('sha256')
    .update(JSON.stringify(contentData))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Generate Ansybl feed with caching
 */
async function generateAnsyblFeed(options = {}) {
  const startTime = Date.now();
  
  // Check cache first
  const contentHash = generateContentHash();
  const cacheKey = 'ansybl-feed';
  const cachedFeed = feedCache.get(cacheKey, { contentHash, filters: options.filters });
  
  if (cachedFeed) {
    const generationTime = Date.now() - startTime;
    
    feedAnalytics.trackRequest({
      cached: true,
      generationTime,
      responseSize: JSON.stringify(cachedFeed).length,
      filters: options.filters || null
    });
    
    return cachedFeed;
  }
  
  // Generate feed
  const feedMetadata = {
    title: siteConfig.title,
    description: siteConfig.description,
    home_page_url: siteConfig.baseUrl,
    feed_url: `${siteConfig.baseUrl}/feed.ansybl`,
    icon: `${siteConfig.baseUrl}/favicon.ico`,
    language: 'en',
    author: siteConfig.author
  };

  // Process markdown content for all posts
  posts.forEach(processMarkdownContent);
  
  // Combine posts and comments into feed items
  let postItems = posts.map(post => {
    const item = {
      id: `${siteConfig.baseUrl}/post/${post.id}`,
      url: `${siteConfig.baseUrl}/post/${post.id}`,
      title: post.title,
      date_published: post.datePublished,
      author: post.author
    };
    
    if (post.uuid) item.uuid = post.uuid;
    if (post.content_text) item.content_text = post.content_text;
    if (post.content_html) item.content_html = post.content_html;
    if (post.content_markdown) item.content_markdown = post.content_markdown;
    
    if (post.summary) {
      item.summary = post.summary;
    } else if (post.content_text) {
      item.summary = generateContentSummary(post.content_text);
    }
    
    if (post.dateModified) item.date_modified = post.dateModified;
    if (post.tags && post.tags.length > 0) item.tags = post.tags;
    if (post.attachments && post.attachments.length > 0) item.attachments = post.attachments;
    
    if (post.interactions) {
      item.interactions = {
        replies_count: post.interactions.replies_count,
        likes_count: post.interactions.likes_count,
        shares_count: post.interactions.shares_count,
        replies_url: `${siteConfig.baseUrl}/api/posts/${post.id}/comments`,
        likes_url: `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`,
        shares_url: `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`
      };
    }
    
    return item;
  });

  let commentItems = comments.map(comment => ({
    id: `${siteConfig.baseUrl}/comment/${comment.id}`,
    url: `${siteConfig.baseUrl}/post/${comment.postId}#${comment.id}`,
    title: `Comment on "${posts.find(p => p.id === comment.postId)?.title || 'Unknown Post'}"`,
    content_text: comment.content,
    content_html: comment.contentHtml,
    date_published: comment.datePublished,
    tags: ['comment'],
    author: comment.author,
    in_reply_to: comment.inReplyTo
  }));
  
  // Apply filters if provided
  if (options.filters) {
    if (options.filters.tags) {
      const filterTags = Array.isArray(options.filters.tags) ? 
        options.filters.tags : [options.filters.tags];
      postItems = postItems.filter(item => 
        item.tags && item.tags.some(tag => filterTags.includes(tag))
      );
    }
    
    if (options.filters.author) {
      postItems = postItems.filter(item => 
        item.author.name.toLowerCase().includes(options.filters.author.toLowerCase())
      );
      commentItems = commentItems.filter(item => 
        item.author.name.toLowerCase().includes(options.filters.author.toLowerCase())
      );
    }
    
    if (options.filters.dateFrom) {
      const fromDate = new Date(options.filters.dateFrom);
      postItems = postItems.filter(item => new Date(item.date_published) >= fromDate);
      commentItems = commentItems.filter(item => new Date(item.date_published) >= fromDate);
    }
    
    if (options.filters.dateTo) {
      const toDate = new Date(options.filters.dateTo);
      postItems = postItems.filter(item => new Date(item.date_published) <= toDate);
      commentItems = commentItems.filter(item => new Date(item.date_published) <= toDate);
    }
    
    if (options.filters.limit) {
      const limit = parseInt(options.filters.limit);
      postItems = postItems.slice(0, limit);
    }
  }

  // Combine and sort by date (newest first)
  const allItems = [...postItems, ...commentItems].sort((a, b) => 
    new Date(b.date_published) - new Date(a.date_published)
  );

  const keyPair = getKeyPair();
  const feed = await generator.createCompleteFeed(feedMetadata, allItems, keyPair.privateKey);
  
  // Cache the generated feed
  feedCache.set(cacheKey, feed, { contentHash, filters: options.filters });
  
  const generationTime = Date.now() - startTime;
  
  feedAnalytics.trackRequest({
    cached: false,
    generationTime,
    responseSize: JSON.stringify(feed).length,
    filters: options.filters || null
  });
  
  return feed;
}

/**
 * Main Ansybl feed endpoint
 */
router.get('/feed.ansybl', async (req, res) => {
  try {
    const filters = {
      tags: req.query.tags ? req.query.tags.split(',') : null,
      author: req.query.author || null,
      dateFrom: req.query.from || null,
      dateTo: req.query.to || null,
      limit: req.query.limit || null
    };
    
    // Remove null filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key];
    });
    
    const hasFilters = Object.keys(filters).length > 0;
    const feed = await generateAnsyblFeed({ filters: hasFilters ? filters : null });
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('ETag', `"${generateContentHash()}"`);
    res.setHeader('X-Feed-Items', feed.items.length);
    res.setHeader('X-Cache-Status', feedCache.get('ansybl-feed', { filters: hasFilters ? filters : null }) ? 'HIT' : 'MISS');
    
    res.json(feed);
  } catch (error) {
    console.error('Error generating feed:', error);
    res.status(500).json({ 
      error: 'Failed to generate feed',
      message: error.message 
    });
  }
});

/**
 * Feed metadata endpoint
 */
router.get('/feed/info', async (req, res) => {
  try {
    const lastPost = posts.length > 0 ? posts[0] : null;
    const lastComment = comments.length > 0 ? comments[0] : null;
    
    let lastUpdated = null;
    if (lastPost && lastComment) {
      lastUpdated = new Date(lastPost.datePublished) > new Date(lastComment.datePublished) ?
        lastPost.datePublished : lastComment.datePublished;
    } else if (lastPost) {
      lastUpdated = lastPost.datePublished;
    } else if (lastComment) {
      lastUpdated = lastComment.datePublished;
    }
    
    res.json({
      title: siteConfig.title,
      description: siteConfig.description,
      author: siteConfig.author,
      feedUrl: `${siteConfig.baseUrl}/feed.ansybl`,
      itemCount: posts.length + comments.length,
      postCount: posts.length,
      commentCount: comments.length,
      lastUpdated: lastUpdated || new Date().toISOString(),
      cacheStatus: feedCache.getStats()
    });
  } catch (error) {
    console.error('Error getting feed info:', error);
    res.status(500).json({ 
      error: 'Failed to get feed info',
      message: error.message 
    });
  }
});

/**
 * Feed cache management endpoints
 */
router.post('/feed/cache/invalidate', (req, res) => {
  try {
    const { pattern } = req.body;
    
    let count;
    if (pattern) {
      count = feedCache.invalidatePattern(pattern);
    } else {
      count = feedCache.clear();
    }
    
    res.json({
      success: true,
      message: `Invalidated ${count} cache entries`,
      count
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      message: error.message 
    });
  }
});

router.get('/feed/cache/stats', (req, res) => {
  try {
    const stats = feedCache.getStats();
    const cacheInfo = feedCache.getCacheInfo();
    
    res.json({
      success: true,
      stats,
      entries: cacheInfo
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
});

/**
 * Feed analytics endpoints
 */
router.get('/feed/analytics', (req, res) => {
  try {
    const timeRange = req.query.range ? parseInt(req.query.range) : 3600000; // 1 hour default
    const detailed = req.query.detailed === 'true';
    
    const analytics = detailed ? 
      feedAnalytics.getDetailed(timeRange) : 
      feedAnalytics.getSummary(timeRange);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get analytics',
      message: error.message 
    });
  }
});

/**
 * Feed health check endpoint
 */
router.get('/feed/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Try to generate feed
    const feed = await generateAnsyblFeed();
    const generationTime = Date.now() - startTime;
    
    // Validate feed structure
    const isValid = feed && feed.version && feed.items && Array.isArray(feed.items);
    
    const health = {
      status: isValid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        feedGeneration: {
          status: isValid ? 'pass' : 'fail',
          responseTime: `${generationTime}ms`
        },
        cache: {
          status: 'pass',
          stats: feedCache.getStats()
        },
        content: {
          status: 'pass',
          posts: posts.length,
          comments: comments.length,
          totalItems: feed.items.length
        }
      }
    };
    
    res.status(isValid ? 200 : 503).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Custom feed views with filters
 */
router.get('/feed/custom', async (req, res) => {
  try {
    const filters = {
      tags: req.query.tags ? req.query.tags.split(',') : null,
      author: req.query.author || null,
      dateFrom: req.query.from || null,
      dateTo: req.query.to || null,
      limit: req.query.limit || null,
      contentType: req.query.type || null // 'posts', 'comments', 'all'
    };
    
    // Remove null filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key];
    });
    
    const feed = await generateAnsyblFeed({ filters });
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Feed-Items', feed.items.length);
    res.setHeader('X-Filtered', 'true');
    
    res.json(feed);
  } catch (error) {
    console.error('Error generating custom feed:', error);
    res.status(500).json({ 
      error: 'Failed to generate custom feed',
      message: error.message 
    });
  }
});

/**
 * Feed export endpoint
 */
router.get('/feed/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const feed = await generateAnsyblFeed();
    
    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="ansybl-feed.json"');
        res.json(feed);
        break;
        
      case 'pretty':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="ansybl-feed-pretty.json"');
        res.send(JSON.stringify(feed, null, 2));
        break;
        
      default:
        res.status(400).json({ 
          error: 'Invalid format',
          message: 'Supported formats: json, pretty'
        });
    }
  } catch (error) {
    console.error('Error exporting feed:', error);
    res.status(500).json({ 
      error: 'Failed to export feed',
      message: error.message 
    });
  }
});

/**
 * Feed backup endpoint
 */
router.post('/feed/backup', async (req, res) => {
  try {
    const feed = await generateAnsyblFeed();
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      feed: feed,
      metadata: {
        posts: posts.length,
        comments: comments.length,
        totalItems: feed.items.length
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ansybl-backup-${Date.now()}.json"`);
    res.json(backup);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ 
      error: 'Failed to create backup',
      message: error.message 
    });
  }
});

export default router;

/**
 * Feed personalization and customization endpoints
 */

/**
 * Create personalized feed view
 */
router.post('/personalize', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    
    if (!userId || !preferences) {
      return res.status(400).json({
        error: 'userId and preferences are required'
      });
    }
    
    // Build filters from preferences
    const filters = {};
    
    if (preferences.tags && preferences.tags.length > 0) {
      filters.tags = preferences.tags;
    }
    
    if (preferences.authors && preferences.authors.length > 0) {
      filters.author = preferences.authors.join(',');
    }
    
    if (preferences.contentTypes) {
      filters.contentType = preferences.contentTypes;
    }
    
    if (preferences.dateRange) {
      if (preferences.dateRange.from) filters.dateFrom = preferences.dateRange.from;
      if (preferences.dateRange.to) filters.dateTo = preferences.dateRange.to;
    }
    
    if (preferences.limit) {
      filters.limit = preferences.limit;
    }
    
    const feed = await generateAnsyblFeed({ filters });
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Personalized', 'true');
    res.setHeader('X-User-Id', userId);
    
    res.json({
      success: true,
      userId,
      preferences,
      feed
    });
    
  } catch (error) {
    console.error('Error creating personalized feed:', error);
    res.status(500).json({ 
      error: 'Failed to create personalized feed',
      message: error.message 
    });
  }
});

/**
 * Save feed view configuration
 */
const savedViews = new Map();

router.post('/views', (req, res) => {
  try {
    const { userId, name, filters, description } = req.body;
    
    if (!userId || !name || !filters) {
      return res.status(400).json({
        error: 'userId, name, and filters are required'
      });
    }
    
    const viewId = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const view = {
      id: viewId,
      userId,
      name,
      description: description || '',
      filters,
      created: new Date().toISOString(),
      lastUsed: null,
      useCount: 0
    };
    
    savedViews.set(viewId, view);
    
    res.status(201).json({
      success: true,
      view,
      message: 'Feed view saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving feed view:', error);
    res.status(500).json({ 
      error: 'Failed to save feed view',
      message: error.message 
    });
  }
});

/**
 * Get saved feed views for a user
 */
router.get('/views/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const userViews = Array.from(savedViews.values())
      .filter(view => view.userId === userId)
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      success: true,
      count: userViews.length,
      views: userViews
    });
    
  } catch (error) {
    console.error('Error getting feed views:', error);
    res.status(500).json({ 
      error: 'Failed to get feed views',
      message: error.message 
    });
  }
});

/**
 * Get feed using saved view
 */
router.get('/views/:viewId/feed', async (req, res) => {
  try {
    const { viewId } = req.params;
    
    const view = savedViews.get(viewId);
    
    if (!view) {
      return res.status(404).json({
        error: 'Feed view not found'
      });
    }
    
    // Update usage stats
    view.lastUsed = new Date().toISOString();
    view.useCount++;
    
    const feed = await generateAnsyblFeed({ filters: view.filters });
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-View-Id', viewId);
    res.setHeader('X-View-Name', view.name);
    
    res.json({
      success: true,
      view: {
        id: view.id,
        name: view.name,
        description: view.description
      },
      feed
    });
    
  } catch (error) {
    console.error('Error getting feed with view:', error);
    res.status(500).json({ 
      error: 'Failed to get feed',
      message: error.message 
    });
  }
});

/**
 * Delete saved feed view
 */
router.delete('/views/:viewId', (req, res) => {
  try {
    const { viewId } = req.params;
    
    const deleted = savedViews.delete(viewId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Feed view not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Feed view deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting feed view:', error);
    res.status(500).json({ 
      error: 'Failed to delete feed view',
      message: error.message 
    });
  }
});

/**
 * Feed filtering presets
 */
router.get('/presets', (req, res) => {
  try {
    const presets = [
      {
        id: 'recent',
        name: 'Recent Posts',
        description: 'Latest posts from the last 7 days',
        filters: {
          dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 50
        }
      },
      {
        id: 'popular',
        name: 'Popular Content',
        description: 'Most liked and shared posts',
        filters: {
          sortBy: 'interactions',
          limit: 20
        }
      },
      {
        id: 'media',
        name: 'Media Posts',
        description: 'Posts with images, videos, or audio',
        filters: {
          hasMedia: true,
          limit: 30
        }
      },
      {
        id: 'discussions',
        name: 'Active Discussions',
        description: 'Posts with the most comments',
        filters: {
          sortBy: 'comments',
          limit: 25
        }
      }
    ];
    
    res.json({
      success: true,
      count: presets.length,
      presets
    });
    
  } catch (error) {
    console.error('Error getting presets:', error);
    res.status(500).json({ 
      error: 'Failed to get presets',
      message: error.message 
    });
  }
});

/**
 * Apply preset to generate feed
 */
router.get('/presets/:presetId/feed', async (req, res) => {
  try {
    const { presetId } = req.params;
    
    const presets = {
      recent: {
        dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 50
      },
      popular: {
        sortBy: 'interactions',
        limit: 20
      },
      media: {
        hasMedia: true,
        limit: 30
      },
      discussions: {
        sortBy: 'comments',
        limit: 25
      }
    };
    
    const filters = presets[presetId];
    
    if (!filters) {
      return res.status(404).json({
        error: 'Preset not found'
      });
    }
    
    const feed = await generateAnsyblFeed({ filters });
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Preset', presetId);
    
    res.json({
      success: true,
      preset: presetId,
      feed
    });
    
  } catch (error) {
    console.error('Error applying preset:', error);
    res.status(500).json({ 
      error: 'Failed to apply preset',
      message: error.message 
    });
  }
});

export { savedViews };
