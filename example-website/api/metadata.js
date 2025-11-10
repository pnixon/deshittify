/**
 * Metadata API routes
 * Provides endpoints for Dublin Core and Schema.org metadata
 */

import { Router } from 'express';
import { metadataManager } from '../lib/metadata.js';
import { posts, comments } from '../data/storage.js';

const router = Router();

/**
 * Convert content to Dublin Core metadata
 * POST /api/metadata/dublincore
 */
router.post('/dublincore', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Content object is required'
      });
    }
    
    const dc = metadataManager.toDublinCore(content);
    const validation = metadataManager.validateDublinCore(dc);
    
    res.json({
      success: true,
      metadata: dc,
      validation
    });
    
  } catch (error) {
    console.error('❌ Dublin Core conversion error:', error.message);
    res.status(500).json({
      error: 'Failed to convert to Dublin Core',
      message: error.message
    });
  }
});

/**
 * Convert content to Schema.org JSON-LD
 * POST /api/metadata/schemaorg
 */
router.post('/schemaorg', (req, res) => {
  try {
    const { content, type } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Content object is required'
      });
    }
    
    const schema = metadataManager.toSchemaOrg(content, type || 'Article');
    const validation = metadataManager.validateSchemaOrg(schema);
    
    res.json({
      success: true,
      metadata: schema,
      validation
    });
    
  } catch (error) {
    console.error('❌ Schema.org conversion error:', error.message);
    res.status(500).json({
      error: 'Failed to convert to Schema.org',
      message: error.message
    });
  }
});

/**
 * Get Dublin Core metadata for a post
 * GET /api/metadata/posts/:postId/dublincore
 */
router.get('/posts/:postId/dublincore', (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      });
    }
    
    const dc = metadataManager.toDublinCore(post);
    const validation = metadataManager.validateDublinCore(dc);
    
    res.json({
      success: true,
      postId,
      metadata: dc,
      validation
    });
    
  } catch (error) {
    console.error('❌ Post Dublin Core error:', error.message);
    res.status(500).json({
      error: 'Failed to get Dublin Core metadata',
      message: error.message
    });
  }
});

/**
 * Get Schema.org metadata for a post
 * GET /api/metadata/posts/:postId/schemaorg
 */
router.get('/posts/:postId/schemaorg', (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.query;
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      });
    }
    
    const schema = metadataManager.toSchemaOrg(post, type || 'Article');
    const validation = metadataManager.validateSchemaOrg(schema);
    
    res.json({
      success: true,
      postId,
      metadata: schema,
      validation
    });
    
  } catch (error) {
    console.error('❌ Post Schema.org error:', error.message);
    res.status(500).json({
      error: 'Failed to get Schema.org metadata',
      message: error.message
    });
  }
});

/**
 * Get HTML meta tags for a post
 * GET /api/metadata/posts/:postId/metatags
 */
router.get('/posts/:postId/metatags', (req, res) => {
  try {
    const { postId } = req.params;
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      });
    }
    
    const metaTags = metadataManager.generateMetaTags(post);
    
    res.json({
      success: true,
      postId,
      metaTags,
      html: metaTags
    });
    
  } catch (error) {
    console.error('❌ Meta tags error:', error.message);
    res.status(500).json({
      error: 'Failed to generate meta tags',
      message: error.message
    });
  }
});

/**
 * Extract metadata from content
 * POST /api/metadata/extract
 */
router.post('/extract', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Content object is required'
      });
    }
    
    const metadata = metadataManager.extractMetadata(content);
    
    res.json({
      success: true,
      metadata
    });
    
  } catch (error) {
    console.error('❌ Metadata extraction error:', error.message);
    res.status(500).json({
      error: 'Failed to extract metadata',
      message: error.message
    });
  }
});

/**
 * Validate Dublin Core metadata
 * POST /api/metadata/validate/dublincore
 */
router.post('/validate/dublincore', (req, res) => {
  try {
    const { metadata } = req.body;
    
    if (!metadata) {
      return res.status(400).json({
        error: 'Metadata object is required'
      });
    }
    
    const validation = metadataManager.validateDublinCore(metadata);
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error) {
    console.error('❌ Dublin Core validation error:', error.message);
    res.status(500).json({
      error: 'Failed to validate Dublin Core metadata',
      message: error.message
    });
  }
});

/**
 * Validate Schema.org metadata
 * POST /api/metadata/validate/schemaorg
 */
router.post('/validate/schemaorg', (req, res) => {
  try {
    const { metadata } = req.body;
    
    if (!metadata) {
      return res.status(400).json({
        error: 'Metadata object is required'
      });
    }
    
    const validation = metadataManager.validateSchemaOrg(metadata);
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error) {
    console.error('❌ Schema.org validation error:', error.message);
    res.status(500).json({
      error: 'Failed to validate Schema.org metadata',
      message: error.message
    });
  }
});

/**
 * Export all posts metadata in various formats
 * GET /api/metadata/export
 */
router.get('/export', (req, res) => {
  try {
    const { format } = req.query;
    
    if (!format || !['dublincore', 'schemaorg', 'both'].includes(format)) {
      return res.status(400).json({
        error: 'Format parameter is required (dublincore, schemaorg, or both)'
      });
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      postCount: posts.length,
      posts: []
    };
    
    for (const post of posts) {
      const postData = {
        id: post.id,
        title: post.title
      };
      
      if (format === 'dublincore' || format === 'both') {
        postData.dublinCore = metadataManager.toDublinCore(post);
      }
      
      if (format === 'schemaorg' || format === 'both') {
        postData.schemaOrg = metadataManager.toSchemaOrg(post);
      }
      
      exportData.posts.push(postData);
    }
    
    res.json({
      success: true,
      format,
      data: exportData
    });
    
  } catch (error) {
    console.error('❌ Metadata export error:', error.message);
    res.status(500).json({
      error: 'Failed to export metadata',
      message: error.message
    });
  }
});

/**
 * Import metadata and update posts
 * POST /api/metadata/import
 */
router.post('/import', (req, res) => {
  try {
    const { metadata, format } = req.body;
    
    if (!metadata || !format) {
      return res.status(400).json({
        error: 'Metadata and format are required'
      });
    }
    
    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };
    
    // This is a simplified import - in production, you'd want more robust handling
    if (Array.isArray(metadata)) {
      for (const item of metadata) {
        try {
          // Find matching post by ID
          const post = posts.find(p => p.id === item.id);
          if (post) {
            // Update post with metadata (simplified)
            if (format === 'dublincore' && item.dublinCore) {
              post.title = item.dublinCore['dc:title'] || post.title;
              post.summary = item.dublinCore['dc:description'] || post.summary;
            } else if (format === 'schemaorg' && item.schemaOrg) {
              post.title = item.schemaOrg.headline || post.title;
              post.summary = item.schemaOrg.description || post.summary;
            }
            results.imported++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            id: item.id,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('❌ Metadata import error:', error.message);
    res.status(500).json({
      error: 'Failed to import metadata',
      message: error.message
    });
  }
});

export default router;
