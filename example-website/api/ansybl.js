/**
 * Ansybl protocol API routes
 */

import { Router } from 'express';
import { AnsyblGenerator } from '../lib/generator.js';
import { AnsyblValidator } from '../lib/validator.js';
import { AnsyblParser } from '../lib/parser.js';
import { posts, comments, interactions, getKeyPair } from '../data/storage.js';
import { siteConfig } from '../data/config.js';
import { processMarkdownContent, generateContentSummary } from '../utils/content.js';

const router = Router();

// Initialize Ansybl components
const generator = new AnsyblGenerator();
const validator = new AnsyblValidator();
const parser = new AnsyblParser();

// Validate Ansybl document (enhanced with advanced features)
router.post('/validate', (req, res) => {
  try {
    console.log('📝 Validation request received');
    
    const startTime = Date.now();
    const options = {
      includeWarnings: req.query.warnings !== 'false',
      strictMode: req.query.strict === 'true',
      validateExtensions: req.query.extensions !== 'false',
      customSchema: req.body._customSchema || null
    };
    
    // Remove custom schema from document before validation
    const document = { ...req.body };
    delete document._customSchema;
    
    const result = validator.validateDocument(document, options);
    const processingTime = Date.now() - startTime;
    
    // Add performance metrics
    result.performance = {
      processingTimeMs: processingTime,
      documentSize: JSON.stringify(document).length,
      itemCount: document.items ? document.items.length : 0
    };
    
    console.log(`✅ Validation completed: ${result.valid ? 'VALID' : 'INVALID'} (${processingTime}ms)`);
    res.json(result);
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    res.status(400).json({
      valid: false,
      errors: [{
        code: 'VALIDATION_ERROR',
        message: error.message
      }]
    });
  }
});

// Batch validate multiple Ansybl documents
router.post('/validate/batch', (req, res) => {
  try {
    console.log('📝 Batch validation request received');
    
    const { documents, options = {} } = req.body;
    
    if (!Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: 'Documents must be an array'
      });
    }
    
    if (documents.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 documents per batch request'
      });
    }
    
    const startTime = Date.now();
    const results = [];
    let validCount = 0;
    let totalErrors = 0;
    
    documents.forEach((document, index) => {
      try {
        const docStartTime = Date.now();
        const result = validator.validateDocument(document, {
          includeWarnings: options.includeWarnings !== false,
          strictMode: options.strictMode === true,
          validateExtensions: options.validateExtensions !== false
        });
        
        result.index = index;
        result.performance = {
          processingTimeMs: Date.now() - docStartTime,
          documentSize: JSON.stringify(document).length
        };
        
        if (result.valid) {
          validCount++;
        } else {
          totalErrors += result.errors.length;
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          index,
          valid: false,
          errors: [{
            code: 'VALIDATION_ERROR',
            message: error.message
          }],
          warnings: []
        });
        totalErrors++;
      }
    });
    
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Batch validation completed: ${validCount}/${documents.length} valid (${totalTime}ms)`);
    
    res.json({
      success: true,
      summary: {
        total: documents.length,
        valid: validCount,
        invalid: documents.length - validCount,
        totalErrors,
        processingTimeMs: totalTime
      },
      results
    });
    
  } catch (error) {
    console.error('❌ Batch validation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch validation',
      message: error.message
    });
  }
});

// Validate with custom schema extensions
router.post('/validate/custom', (req, res) => {
  try {
    console.log('📝 Custom schema validation request received');
    
    const { document, customSchema, options = {} } = req.body;
    
    if (!document) {
      return res.status(400).json({
        valid: false,
        errors: [{
          code: 'MISSING_DOCUMENT',
          message: 'Document is required'
        }]
      });
    }
    
    const startTime = Date.now();
    
    // Create enhanced validator with custom schema if provided
    let validatorInstance = validator;
    if (customSchema) {
      validatorInstance = validator.createCustomValidator(customSchema);
    }
    
    const result = validatorInstance.validateDocument(document, {
      includeWarnings: options.includeWarnings !== false,
      strictMode: options.strictMode === true,
      validateExtensions: options.validateExtensions !== false,
      customValidation: true
    });
    
    result.performance = {
      processingTimeMs: Date.now() - startTime,
      documentSize: JSON.stringify(document).length,
      customSchemaUsed: !!customSchema
    };
    
    console.log(`✅ Custom validation completed: ${result.valid ? 'VALID' : 'INVALID'}`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Custom validation error:', error.message);
    res.status(400).json({
      valid: false,
      errors: [{
        code: 'CUSTOM_VALIDATION_ERROR',
        message: error.message
      }]
    });
  }
});

// Get validation performance metrics
router.get('/validate/metrics', (req, res) => {
  try {
    const metrics = validator.getPerformanceMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('❌ Metrics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get validation metrics'
    });
  }
});

// Parse Ansybl document (enhanced with advanced options)
router.post('/parse', async (req, res) => {
  try {
    console.log('🔍 Parse request received');
    
    const startTime = Date.now();
    const options = {
      verifySignatures: req.query.verify === 'true',
      preserveExtensions: req.query.extensions !== 'false',
      strictMode: req.query.strict === 'true',
      requireSignatures: req.query.requireSig === 'true',
      signatureLevel: req.query.sigLevel || 'all', // 'all', 'feed-only', 'items-only'
      metadataOnly: req.query.metadata === 'true',
      contentOnly: req.query.content === 'true',
      includePerformance: req.query.performance !== 'false'
    };
    
    let result;
    
    if (options.metadataOnly) {
      result = await parser.parseMetadataOnly(req.body, options);
    } else if (options.contentOnly) {
      result = await parser.parseContentOnly(req.body, options);
    } else {
      result = await parser.parse(req.body, options);
    }
    
    // Add performance metrics if requested
    if (options.includePerformance) {
      const processingTime = Date.now() - startTime;
      result.performance = {
        processingTimeMs: processingTime,
        documentSize: JSON.stringify(req.body).length,
        options: options
      };
    }
    
    console.log(`✅ Parse completed: ${result.success ? 'SUCCESS' : 'FAILED'} (${Date.now() - startTime}ms)`);
    res.json(result);
  } catch (error) {
    console.error('❌ Parse error:', error.message);
    res.status(400).json({
      success: false,
      errors: [{
        code: 'PARSE_ERROR',
        message: error.message
      }]
    });
  }
});

// Parse with specific verification levels
router.post('/parse/verify/:level', async (req, res) => {
  try {
    const level = req.params.level; // 'strict', 'relaxed', 'optional'
    
    if (!['strict', 'relaxed', 'optional'].includes(level)) {
      return res.status(400).json({
        success: false,
        errors: [{
          code: 'INVALID_VERIFICATION_LEVEL',
          message: 'Verification level must be: strict, relaxed, or optional'
        }]
      });
    }
    
    console.log(`🔍 Parse request with ${level} verification`);
    
    const startTime = Date.now();
    const result = await parser.parseWithVerification(req.body, level);
    
    result.performance = {
      processingTimeMs: Date.now() - startTime,
      verificationLevel: level,
      documentSize: JSON.stringify(req.body).length
    };
    
    console.log(`✅ ${level} parse completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Parse verification error:', error.message);
    res.status(400).json({
      success: false,
      errors: [{
        code: 'PARSE_VERIFICATION_ERROR',
        message: error.message
      }]
    });
  }
});

// Parse and extract specific content types
router.post('/parse/content/:type', async (req, res) => {
  try {
    const contentType = req.params.type; // 'text', 'html', 'markdown', 'all'
    
    if (!['text', 'html', 'markdown', 'all'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        errors: [{
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content type must be: text, html, markdown, or all'
        }]
      });
    }
    
    console.log(`🔍 Parse request for ${contentType} content`);
    
    const startTime = Date.now();
    const options = {
      verifySignatures: req.query.verify === 'true',
      preserveExtensions: req.query.extensions !== 'false',
      contentFilter: contentType
    };
    
    const result = await parser.parseWithContentFilter(req.body, options);
    
    result.performance = {
      processingTimeMs: Date.now() - startTime,
      contentType: contentType,
      documentSize: JSON.stringify(req.body).length
    };
    
    console.log(`✅ Content parse completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Content parse error:', error.message);
    res.status(400).json({
      success: false,
      errors: [{
        code: 'CONTENT_PARSE_ERROR',
        message: error.message
      }]
    });
  }
});

// Get parser performance metrics
router.get('/parse/metrics', (req, res) => {
  try {
    const metrics = parser.getPerformanceMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('❌ Parser metrics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get parser metrics'
    });
  }
});

// Parse items with filtering
router.post('/parse/items', async (req, res) => {
  try {
    const { document, filters = {} } = req.body;
    
    if (!document) {
      return res.status(400).json({
        success: false,
        errors: [{
          code: 'MISSING_DOCUMENT',
          message: 'Document is required'
        }]
      });
    }
    
    console.log('🔍 Parse items request with filters:', filters);
    
    const startTime = Date.now();
    
    // First parse the document
    const parseResult = await parser.parse(document, {
      verifySignatures: req.query.verify === 'true',
      preserveExtensions: req.query.extensions !== 'false'
    });
    
    if (!parseResult.success) {
      return res.json(parseResult);
    }
    
    // Filter items
    const filteredItems = parser.getItems(parseResult.feed, filters);
    
    const result = {
      success: true,
      items: filteredItems,
      totalItems: parseResult.feed.items ? parseResult.feed.items.length : 0,
      filteredCount: filteredItems.length,
      filters: filters,
      performance: {
        processingTimeMs: Date.now() - startTime,
        documentSize: JSON.stringify(document).length
      }
    };
    
    console.log(`✅ Items parse completed: ${filteredItems.length}/${parseResult.feed.items?.length || 0} items`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Items parse error:', error.message);
    res.status(400).json({
      success: false,
      errors: [{
        code: 'ITEMS_PARSE_ERROR',
        message: error.message
      }]
    });
  }
});

// Get feed metadata
router.get('/feed/info', (_, res) => {
  res.json({
    title: siteConfig.title,
    description: siteConfig.description,
    author: siteConfig.author,
    feedUrl: `${siteConfig.baseUrl}/feed.ansybl`,
    itemCount: posts.length + comments.length,
    lastUpdated: posts.length > 0 ? posts[0].datePublished : new Date().toISOString()
  });
});

// Generate Ansybl feed
async function generateAnsyblFeed() {
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
  const postItems = posts.map(post => {
    const item = {
      id: `${siteConfig.baseUrl}/post/${post.id}`,
      url: `${siteConfig.baseUrl}/post/${post.id}`,
      title: post.title,
      date_published: post.datePublished,
      author: post.author
    };
    
    // Add optional UUID
    if (post.uuid) item.uuid = post.uuid;
    
    // Add content in available formats
    if (post.content_text) item.content_text = post.content_text;
    if (post.content_html) item.content_html = post.content_html;
    if (post.content_markdown) item.content_markdown = post.content_markdown;
    
    // Add summary
    if (post.summary) {
      item.summary = post.summary;
    } else if (post.content_text) {
      item.summary = generateContentSummary(post.content_text);
    }
    
    // Add modification date if exists
    if (post.dateModified) item.date_modified = post.dateModified;
    
    // Add tags
    if (post.tags && post.tags.length > 0) item.tags = post.tags;
    
    // Add attachments if any
    if (post.attachments && post.attachments.length > 0) item.attachments = post.attachments;
    
    // Add interactions
    if (post.interactions) {
      item.interactions = {
        replies_count: post.interactions.replies_count,
        likes_count: post.interactions.likes_count,
        shares_count: post.interactions.shares_count
      };
      
      // Add interaction URLs
      item.interactions.replies_url = `${siteConfig.baseUrl}/api/posts/${post.id}/comments`;
      item.interactions.likes_url = `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`;
      item.interactions.shares_url = `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`;
    }
    
    return item;
  });

  const commentItems = comments.map(comment => ({
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

  // Combine and sort by date (newest first)
  const allItems = [...postItems, ...commentItems].sort((a, b) => 
    new Date(b.date_published) - new Date(a.date_published)
  );

  const keyPair = getKeyPair();
  return await generator.createCompleteFeed(feedMetadata, allItems, keyPair.privateKey);
}

// Ansybl feed endpoint
router.get('/feed.ansybl', async (_, res) => {
  try {
    const feed = await generateAnsyblFeed();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(feed);
  } catch (error) {
    console.error('Error generating feed:', error);
    res.status(500).json({ error: 'Failed to generate feed' });
  }
});

// Content search and filtering endpoints
router.get('/content/search', async (req, res) => {
  try {
    const {
      q: query,
      tags,
      author,
      dateFrom,
      dateTo,
      contentType,
      limit = 50,
      offset = 0,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    console.log('🔍 Content search request:', { query, tags, author, contentType });
    
    const startTime = Date.now();
    
    // Get all content (posts and comments)
    let allContent = [
      ...posts.map(post => ({ ...post, type: 'post' })),
      ...comments.map(comment => ({ ...comment, type: 'comment' }))
    ];
    
    // Apply filters
    if (query) {
      const searchTerm = query.toLowerCase();
      allContent = allContent.filter(item => 
        (item.title && item.title.toLowerCase().includes(searchTerm)) ||
        (item.content && item.content.toLowerCase().includes(searchTerm)) ||
        (item.content_text && item.content_text.toLowerCase().includes(searchTerm)) ||
        (item.summary && item.summary.toLowerCase().includes(searchTerm))
      );
    }
    
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      allContent = allContent.filter(item => 
        item.tags && item.tags.some(tag => tagList.includes(tag.toLowerCase()))
      );
    }
    
    if (author) {
      allContent = allContent.filter(item => 
        item.author && item.author.name.toLowerCase().includes(author.toLowerCase())
      );
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      allContent = allContent.filter(item => 
        new Date(item.datePublished || item.date_published) >= fromDate
      );
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      allContent = allContent.filter(item => 
        new Date(item.datePublished || item.date_published) <= toDate
      );
    }
    
    if (contentType) {
      allContent = allContent.filter(item => {
        if (contentType === 'post') return item.type === 'post';
        if (contentType === 'comment') return item.type === 'comment';
        if (contentType === 'text') return !!item.content_text;
        if (contentType === 'html') return !!item.content_html;
        if (contentType === 'markdown') return !!item.content_markdown;
        return true;
      });
    }
    
    // Sort results
    allContent.sort((a, b) => {
      const aDate = new Date(a.datePublished || a.date_published);
      const bDate = new Date(b.datePublished || b.date_published);
      
      if (sortBy === 'date') {
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
      } else if (sortBy === 'title') {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        return sortOrder === 'desc' ? bTitle.localeCompare(aTitle) : aTitle.localeCompare(bTitle);
      }
      
      return 0;
    });
    
    // Apply pagination
    const total = allContent.length;
    const paginatedContent = allContent.slice(offset, offset + parseInt(limit));
    
    const result = {
      success: true,
      results: paginatedContent,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + parseInt(limit) < total
      },
      filters: {
        query,
        tags,
        author,
        dateFrom,
        dateTo,
        contentType,
        sortBy,
        sortOrder
      },
      performance: {
        processingTimeMs: Date.now() - startTime,
        totalScanned: posts.length + comments.length
      }
    };
    
    console.log(`✅ Search completed: ${paginatedContent.length}/${total} results`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Content search error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to search content',
      message: error.message
    });
  }
});

// Content versioning and history
router.get('/content/:id/history', (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📜 Content history request for: ${id}`);
    
    // Find content item
    const post = posts.find(p => p.id === id);
    const comment = comments.find(c => c.id === id);
    const item = post || comment;
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }
    
    // Get version history (in a real app, this would come from a database)
    const history = item._history || [{
      version: 1,
      timestamp: item.datePublished || item.date_published,
      changes: 'Initial creation',
      author: item.author.name,
      content: {
        title: item.title,
        content_text: item.content_text || item.content,
        content_html: item.content_html || item.contentHtml,
        content_markdown: item.content_markdown,
        summary: item.summary
      }
    }];
    
    // Add current version if modified
    if (item.dateModified || item.date_modified) {
      history.push({
        version: history.length + 1,
        timestamp: item.dateModified || item.date_modified,
        changes: 'Content updated',
        author: item.author.name,
        content: {
          title: item.title,
          content_text: item.content_text || item.content,
          content_html: item.content_html || item.contentHtml,
          content_markdown: item.content_markdown,
          summary: item.summary
        }
      });
    }
    
    res.json({
      success: true,
      contentId: id,
      contentType: post ? 'post' : 'comment',
      currentVersion: history.length,
      history: history.reverse() // Most recent first
    });
    
  } catch (error) {
    console.error('❌ Content history error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get content history'
    });
  }
});

// Bulk content operations
router.post('/content/bulk', async (req, res) => {
  try {
    const { operation, items, options = {} } = req.body;
    
    if (!operation || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Operation and items array are required'
      });
    }
    
    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 items per bulk operation'
      });
    }
    
    console.log(`🔄 Bulk ${operation} operation on ${items.length} items`);
    
    const startTime = Date.now();
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const itemId of items) {
      try {
        let result = { id: itemId, success: false };
        
        switch (operation) {
          case 'delete':
            result = await bulkDeleteItem(itemId, options);
            break;
          case 'update_tags':
            result = await bulkUpdateTags(itemId, options.tags || []);
            break;
          case 'update_author':
            result = await bulkUpdateAuthor(itemId, options.author);
            break;
          case 'export':
            result = await bulkExportItem(itemId, options.format || 'json');
            break;
          default:
            result = {
              id: itemId,
              success: false,
              error: `Unknown operation: ${operation}`
            };
        }
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        
        results.push(result);
        
      } catch (error) {
        errorCount++;
        results.push({
          id: itemId,
          success: false,
          error: error.message
        });
      }
    }
    
    const response = {
      success: true,
      operation,
      summary: {
        total: items.length,
        successful: successCount,
        failed: errorCount,
        processingTimeMs: Date.now() - startTime
      },
      results
    };
    
    console.log(`✅ Bulk operation completed: ${successCount}/${items.length} successful`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Bulk operation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk operation',
      message: error.message
    });
  }
});

// Content analytics and statistics
router.get('/content/analytics', (req, res) => {
  try {
    const { period = '30d', groupBy = 'day' } = req.query;
    
    console.log(`📊 Content analytics request: ${period}, grouped by ${groupBy}`);
    
    const now = new Date();
    let startDate;
    
    // Calculate date range
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Filter content by date range
    const filteredPosts = posts.filter(post => 
      new Date(post.datePublished) >= startDate
    );
    
    const filteredComments = comments.filter(comment => 
      new Date(comment.datePublished) >= startDate
    );
    
    // Calculate analytics
    const analytics = {
      summary: {
        totalPosts: filteredPosts.length,
        totalComments: filteredComments.length,
        totalContent: filteredPosts.length + filteredComments.length,
        period,
        dateRange: {
          from: startDate.toISOString(),
          to: now.toISOString()
        }
      },
      contentTypes: {
        posts: filteredPosts.length,
        comments: filteredComments.length,
        withText: filteredPosts.filter(p => p.content_text).length,
        withHtml: filteredPosts.filter(p => p.content_html).length,
        withMarkdown: filteredPosts.filter(p => p.content_markdown).length,
        withAttachments: filteredPosts.filter(p => p.attachments && p.attachments.length > 0).length
      },
      interactions: {
        totalLikes: Object.values(interactions).reduce((sum, int) => sum + int.likes.length, 0),
        totalShares: Object.values(interactions).reduce((sum, int) => sum + int.shares.length, 0),
        totalReplies: Object.values(interactions).reduce((sum, int) => sum + int.replies.length, 0)
      },
      topTags: calculateTopTags(filteredPosts),
      topAuthors: calculateTopAuthors([...filteredPosts, ...filteredComments]),
      timeline: generateTimeline(filteredPosts, filteredComments, groupBy, startDate, now)
    };
    
    res.json({
      success: true,
      analytics
    });
    
  } catch (error) {
    console.error('❌ Content analytics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics'
    });
  }
});

// Helper functions for bulk operations
async function bulkDeleteItem(itemId, options) {
  const post = posts.find(p => p.id === itemId);
  const comment = comments.find(c => c.id === itemId);
  
  if (post) {
    const index = posts.indexOf(post);
    if (options.softDelete) {
      posts[index]._deleted = true;
      posts[index]._deletedAt = new Date().toISOString();
    } else {
      posts.splice(index, 1);
    }
    return { id: itemId, success: true, action: 'deleted', type: 'post' };
  } else if (comment) {
    const index = comments.indexOf(comment);
    if (options.softDelete) {
      comments[index]._deleted = true;
      comments[index]._deletedAt = new Date().toISOString();
    } else {
      comments.splice(index, 1);
    }
    return { id: itemId, success: true, action: 'deleted', type: 'comment' };
  }
  
  return { id: itemId, success: false, error: 'Item not found' };
}

async function bulkUpdateTags(itemId, newTags) {
  const post = posts.find(p => p.id === itemId);
  
  if (post) {
    post.tags = [...new Set([...(post.tags || []), ...newTags])]; // Merge and deduplicate
    post.dateModified = new Date().toISOString();
    return { id: itemId, success: true, action: 'tags_updated', newTags: post.tags };
  }
  
  return { id: itemId, success: false, error: 'Post not found' };
}

async function bulkUpdateAuthor(itemId, newAuthor) {
  const post = posts.find(p => p.id === itemId);
  const comment = comments.find(c => c.id === itemId);
  
  if (post) {
    post.author = { ...post.author, ...newAuthor };
    post.dateModified = new Date().toISOString();
    return { id: itemId, success: true, action: 'author_updated', type: 'post' };
  } else if (comment) {
    comment.author = { ...comment.author, ...newAuthor };
    comment.dateModified = new Date().toISOString();
    return { id: itemId, success: true, action: 'author_updated', type: 'comment' };
  }
  
  return { id: itemId, success: false, error: 'Item not found' };
}

async function bulkExportItem(itemId, format) {
  const post = posts.find(p => p.id === itemId);
  const comment = comments.find(c => c.id === itemId);
  const item = post || comment;
  
  if (!item) {
    return { id: itemId, success: false, error: 'Item not found' };
  }
  
  let exportData;
  
  switch (format) {
    case 'json':
      exportData = JSON.stringify(item, null, 2);
      break;
    case 'markdown':
      exportData = convertToMarkdown(item);
      break;
    case 'html':
      exportData = convertToHtml(item);
      break;
    default:
      return { id: itemId, success: false, error: `Unsupported format: ${format}` };
  }
  
  return {
    id: itemId,
    success: true,
    action: 'exported',
    format,
    data: exportData,
    size: exportData.length
  };
}

// Helper functions for analytics
function calculateTopTags(posts) {
  const tagCounts = {};
  
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  return Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
}

function calculateTopAuthors(content) {
  const authorCounts = {};
  
  content.forEach(item => {
    if (item.author && item.author.name) {
      const name = item.author.name;
      authorCounts[name] = (authorCounts[name] || 0) + 1;
    }
  });
  
  return Object.entries(authorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([author, count]) => ({ author, count }));
}

function generateTimeline(posts, comments, groupBy, startDate, endDate) {
  const timeline = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const periodStart = new Date(current);
    let periodEnd;
    
    if (groupBy === 'day') {
      periodEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    } else if (groupBy === 'week') {
      periodEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (groupBy === 'month') {
      periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    
    const periodPosts = posts.filter(post => {
      const date = new Date(post.datePublished);
      return date >= periodStart && date < periodEnd;
    });
    
    const periodComments = comments.filter(comment => {
      const date = new Date(comment.datePublished);
      return date >= periodStart && date < periodEnd;
    });
    
    timeline.push({
      period: periodStart.toISOString().split('T')[0],
      posts: periodPosts.length,
      comments: periodComments.length,
      total: periodPosts.length + periodComments.length
    });
    
    current.setTime(periodEnd.getTime());
  }
  
  return timeline;
}

// Helper functions for export formats
function convertToMarkdown(item) {
  let markdown = '';
  
  if (item.title) {
    markdown += `# ${item.title}\n\n`;
  }
  
  if (item.author) {
    markdown += `**Author:** ${item.author.name}\n`;
    if (item.author.url) {
      markdown += `**Website:** ${item.author.url}\n`;
    }
    markdown += '\n';
  }
  
  if (item.datePublished || item.date_published) {
    markdown += `**Published:** ${item.datePublished || item.date_published}\n\n`;
  }
  
  if (item.tags && item.tags.length > 0) {
    markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
  }
  
  if (item.summary) {
    markdown += `**Summary:** ${item.summary}\n\n`;
  }
  
  if (item.content_markdown) {
    markdown += item.content_markdown;
  } else if (item.content_text || item.content) {
    markdown += item.content_text || item.content;
  } else if (item.content_html || item.contentHtml) {
    markdown += `\`\`\`html\n${item.content_html || item.contentHtml}\n\`\`\``;
  }
  
  return markdown;
}

function convertToHtml(item) {
  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  
  if (item.title) {
    html += `<title>${item.title}</title>`;
  }
  
  html += '</head><body>';
  
  if (item.title) {
    html += `<h1>${item.title}</h1>`;
  }
  
  if (item.author) {
    html += `<p><strong>Author:</strong> ${item.author.name}`;
    if (item.author.url) {
      html += ` (<a href="${item.author.url}">${item.author.url}</a>)`;
    }
    html += '</p>';
  }
  
  if (item.datePublished || item.date_published) {
    html += `<p><strong>Published:</strong> ${item.datePublished || item.date_published}</p>`;
  }
  
  if (item.tags && item.tags.length > 0) {
    html += `<p><strong>Tags:</strong> ${item.tags.join(', ')}</p>`;
  }
  
  if (item.summary) {
    html += `<p><strong>Summary:</strong> ${item.summary}</p>`;
  }
  
  if (item.content_html || item.contentHtml) {
    html += item.content_html || item.contentHtml;
  } else if (item.content_text || item.content) {
    html += `<p>${(item.content_text || item.content).replace(/\n/g, '<br>')}</p>`;
  }
  
  html += '</body></html>';
  
  return html;
}

export default router;