/**
 * Tags API routes
 * Provides endpoints for tag management, analytics, and discovery
 */

import { Router } from 'express';
import { tagManager, contentDiscovery } from '../lib/tagging.js';
import { posts } from '../data/storage.js';

const router = Router();

/**
 * Validate tags
 * POST /api/tags/validate
 */
router.post('/validate', (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!tags) {
      return res.status(400).json({
        error: 'Tags array is required'
      });
    }
    
    const result = tagManager.processTags(tags);
    
    res.json({
      success: true,
      valid: result.valid,
      invalid: result.invalid,
      count: result.valid.length
    });
    
  } catch (error) {
    console.error('❌ Tag validation error:', error.message);
    res.status(500).json({
      error: 'Failed to validate tags',
      message: error.message
    });
  }
});

/**
 * Normalize a tag
 * POST /api/tags/normalize
 */
router.post('/normalize', (req, res) => {
  try {
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({
        error: 'Tag is required'
      });
    }
    
    const normalized = tagManager.normalizeTag(tag);
    const validation = tagManager.validateTag(normalized);
    
    res.json({
      success: true,
      original: tag,
      normalized,
      valid: validation.valid,
      errors: validation.errors
    });
    
  } catch (error) {
    console.error('❌ Tag normalization error:', error.message);
    res.status(500).json({
      error: 'Failed to normalize tag',
      message: error.message
    });
  }
});

/**
 * Get tag statistics
 * GET /api/tags/stats/:tag
 */
router.get('/stats/:tag', (req, res) => {
  try {
    const { tag } = req.params;
    const normalizedTag = tagManager.normalizeTag(tag);
    const stats = tagManager.getTagStats(normalizedTag);
    
    if (!stats) {
      return res.status(404).json({
        error: 'Tag not found',
        tag: normalizedTag
      });
    }
    
    // Get posts with this tag
    const tagPosts = contentDiscovery.getPostsByTag(posts, normalizedTag);
    
    res.json({
      success: true,
      tag: normalizedTag,
      stats,
      postCount: tagPosts.length,
      posts: tagPosts.map(p => ({
        id: p.id,
        title: p.title,
        datePublished: p.datePublished
      }))
    });
    
  } catch (error) {
    console.error('❌ Tag stats error:', error.message);
    res.status(500).json({
      error: 'Failed to get tag statistics',
      message: error.message
    });
  }
});

/**
 * Get all tag statistics
 * GET /api/tags/stats
 */
router.get('/stats', (req, res) => {
  try {
    const allStats = tagManager.getAllTagStats();
    
    res.json({
      success: true,
      count: allStats.length,
      tags: allStats
    });
    
  } catch (error) {
    console.error('❌ All tag stats error:', error.message);
    res.status(500).json({
      error: 'Failed to get tag statistics',
      message: error.message
    });
  }
});

/**
 * Get trending tags
 * GET /api/tags/trending
 */
router.get('/trending', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const hours = parseInt(req.query.hours) || 24;
    
    const trending = tagManager.getTrendingTags(limit, hours);
    
    res.json({
      success: true,
      timeWindow: `${hours} hours`,
      count: trending.length,
      tags: trending
    });
    
  } catch (error) {
    console.error('❌ Trending tags error:', error.message);
    res.status(500).json({
      error: 'Failed to get trending tags',
      message: error.message
    });
  }
});

/**
 * Get popular tags
 * GET /api/tags/popular
 */
router.get('/popular', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const popular = tagManager.getPopularTags(limit);
    
    res.json({
      success: true,
      count: popular.length,
      tags: popular
    });
    
  } catch (error) {
    console.error('❌ Popular tags error:', error.message);
    res.status(500).json({
      error: 'Failed to get popular tags',
      message: error.message
    });
  }
});

/**
 * Search tags
 * GET /api/tags/search
 */
router.get('/search', (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Search query (q) is required'
      });
    }
    
    const results = tagManager.searchTags(q, parseInt(limit) || 10);
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      tags: results
    });
    
  } catch (error) {
    console.error('❌ Tag search error:', error.message);
    res.status(500).json({
      error: 'Failed to search tags',
      message: error.message
    });
  }
});

/**
 * Get related tags
 * GET /api/tags/:tag/related
 */
router.get('/:tag/related', (req, res) => {
  try {
    const { tag } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    
    const normalizedTag = tagManager.normalizeTag(tag);
    const related = tagManager.getRelatedTags(normalizedTag, posts, limit);
    
    res.json({
      success: true,
      tag: normalizedTag,
      count: related.length,
      relatedTags: related
    });
    
  } catch (error) {
    console.error('❌ Related tags error:', error.message);
    res.status(500).json({
      error: 'Failed to get related tags',
      message: error.message
    });
  }
});

/**
 * Get tag cloud
 * GET /api/tags/cloud
 */
router.get('/cloud', (req, res) => {
  try {
    const tagCloud = contentDiscovery.getTagCloud(posts);
    
    res.json({
      success: true,
      count: tagCloud.length,
      tags: tagCloud
    });
    
  } catch (error) {
    console.error('❌ Tag cloud error:', error.message);
    res.status(500).json({
      error: 'Failed to get tag cloud',
      message: error.message
    });
  }
});

/**
 * Filter posts by tags
 * GET /api/tags/filter
 */
router.get('/filter', (req, res) => {
  try {
    const { tags, mode } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        error: 'Tags parameter is required (comma-separated)'
      });
    }
    
    const tagArray = tags.split(',').map(t => t.trim());
    const filtered = contentDiscovery.filterByTags(posts, tagArray, mode || 'any');
    
    res.json({
      success: true,
      tags: tagArray,
      mode: mode || 'any',
      count: filtered.length,
      posts: filtered.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        tags: p.tags,
        datePublished: p.datePublished
      }))
    });
    
  } catch (error) {
    console.error('❌ Tag filter error:', error.message);
    res.status(500).json({
      error: 'Failed to filter posts by tags',
      message: error.message
    });
  }
});

/**
 * Get content categories
 * GET /api/tags/categories
 */
router.get('/categories', (req, res) => {
  try {
    const categories = contentDiscovery.getCategories(posts);
    
    res.json({
      success: true,
      count: categories.length,
      categories
    });
    
  } catch (error) {
    console.error('❌ Categories error:', error.message);
    res.status(500).json({
      error: 'Failed to get categories',
      message: error.message
    });
  }
});

export default router;
