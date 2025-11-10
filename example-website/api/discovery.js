/**
 * Content Discovery API routes
 * Provides search, recommendations, and analytics endpoints
 */

import { Router } from 'express';
import { contentSearch, recommendationEngine, contentAnalytics } from '../lib/discovery.js';
import { posts } from '../data/storage.js';

const router = Router();

/**
 * Advanced content search
 * POST /api/discovery/search
 */
router.post('/search', (req, res) => {
  try {
    const options = {
      query: req.body.query || '',
      tags: req.body.tags || [],
      author: req.body.author || '',
      dateFrom: req.body.dateFrom || null,
      dateTo: req.body.dateTo || null,
      hasMedia: req.body.hasMedia !== undefined ? req.body.hasMedia : null,
      sortBy: req.body.sortBy || 'relevance',
      sortOrder: req.body.sortOrder || 'desc',
      limit: parseInt(req.body.limit) || 50,
      offset: parseInt(req.body.offset) || 0
    };

    const results = contentSearch.search(posts, options);

    console.log(`🔍 Search completed: "${options.query}" - ${results.total} results`);

    res.json({
      success: true,
      ...results,
      query: options
    });

  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * Get search suggestions
 * GET /api/discovery/suggestions
 */
router.get('/suggestions', (req, res) => {
  try {
    const { q: query, limit } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = contentSearch.getSuggestions(
      posts,
      query,
      parseInt(limit) || 10
    );

    res.json({
      success: true,
      query,
      suggestions
    });

  } catch (error) {
    console.error('❌ Suggestions error:', error.message);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

/**
 * Get related posts
 * GET /api/discovery/related/:postId
 */
router.get('/related/:postId', (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const post = posts.find(p => p.id === postId);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      });
    }

    const related = recommendationEngine.getRelatedPosts(post, posts, limit);

    res.json({
      success: true,
      postId,
      count: related.length,
      relatedPosts: related
    });

  } catch (error) {
    console.error('❌ Related posts error:', error.message);
    res.status(500).json({
      error: 'Failed to get related posts',
      message: error.message
    });
  }
});

/**
 * Get trending posts
 * GET /api/discovery/trending
 */
router.get('/trending', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 10;

    const trending = recommendationEngine.getTrendingPosts(posts, hours, limit);

    res.json({
      success: true,
      timeWindow: `${hours} hours`,
      count: trending.length,
      posts: trending
    });

  } catch (error) {
    console.error('❌ Trending posts error:', error.message);
    res.status(500).json({
      error: 'Failed to get trending posts',
      message: error.message
    });
  }
});

/**
 * Get popular posts
 * GET /api/discovery/popular
 */
router.get('/popular', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const popular = recommendationEngine.getPopularPosts(posts, limit);

    res.json({
      success: true,
      count: popular.length,
      posts: popular
    });

  } catch (error) {
    console.error('❌ Popular posts error:', error.message);
    res.status(500).json({
      error: 'Failed to get popular posts',
      message: error.message
    });
  }
});

/**
 * Get content statistics
 * GET /api/discovery/statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const statistics = contentAnalytics.getStatistics(posts);

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('❌ Statistics error:', error.message);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * Get content insights
 * GET /api/discovery/insights
 */
router.get('/insights', (req, res) => {
  try {
    const insights = contentAnalytics.getInsights(posts);

    res.json({
      success: true,
      ...insights
    });

  } catch (error) {
    console.error('❌ Insights error:', error.message);
    res.status(500).json({
      error: 'Failed to get insights',
      message: error.message
    });
  }
});

/**
 * Get personalized recommendations
 * POST /api/discovery/recommendations
 */
router.post('/recommendations', (req, res) => {
  try {
    const { userId, preferences, limit } = req.body;
    const maxResults = parseInt(limit) || 10;

    // Simple recommendation based on preferences
    let recommendations = [];

    if (preferences?.tags && preferences.tags.length > 0) {
      // Find posts with matching tags
      const taggedPosts = posts.filter(post => {
        if (!post.tags) return false;
        return preferences.tags.some(tag => 
          post.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
        );
      });

      // Sort by interaction count
      recommendations = taggedPosts
        .map(post => {
          const score = (post.interactions?.likes_count || 0) +
                       (post.interactions?.shares_count || 0) +
                       (post.interactions?.replies_count || 0);
          return { post, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.post);
    } else {
      // Default to popular posts
      recommendations = recommendationEngine.getPopularPosts(posts, maxResults);
    }

    res.json({
      success: true,
      userId,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    console.error('❌ Recommendations error:', error.message);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

/**
 * Get content by category
 * GET /api/discovery/category/:category
 */
router.get('/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Find posts with the category tag
    const categoryPosts = posts
      .filter(post => {
        if (!post.tags) return false;
        return post.tags.map(t => t.toLowerCase()).includes(category.toLowerCase());
      })
      .slice(0, limit);

    res.json({
      success: true,
      category,
      count: categoryPosts.length,
      posts: categoryPosts
    });

  } catch (error) {
    console.error('❌ Category error:', error.message);
    res.status(500).json({
      error: 'Failed to get category posts',
      message: error.message
    });
  }
});

/**
 * Get similar content
 * POST /api/discovery/similar
 */
router.post('/similar', (req, res) => {
  try {
    const { content, limit } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content object is required'
      });
    }

    const maxResults = parseInt(limit) || 5;
    const similar = recommendationEngine.getRelatedPosts(content, posts, maxResults);

    res.json({
      success: true,
      count: similar.length,
      similarPosts: similar
    });

  } catch (error) {
    console.error('❌ Similar content error:', error.message);
    res.status(500).json({
      error: 'Failed to find similar content',
      message: error.message
    });
  }
});

export default router;
