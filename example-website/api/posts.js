/**
 * Posts API routes
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { posts, interactions, interactionIdCounter } from '../data/storage.js';
import { siteConfig } from '../data/config.js';
import { processMarkdownContent, updateInteractionCounts } from '../utils/content.js';
import { processMediaFile, generateVideoMetadata, generateAudioMetadata } from '../utils/media.js';
import { upload } from '../middleware/upload.js';
import { recordInteractionAnalytics } from './interactions.js';
import webSocketService from '../lib/websocket.js';
import { join } from 'path';

const router = Router();

// Like/unlike a post
router.post('/:postId/like', (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, userName } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ error: 'userId and userName are required' });
    }
    
    // Check if post exists
    const post = posts.find(p => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Initialize interactions if not exists
    if (!interactions[postId]) {
      interactions[postId] = { likes: [], shares: [], replies: [] };
    }
    
    const userLike = interactions[postId].likes.find(like => like.userId === userId);
    
    if (userLike) {
      // Unlike - remove existing like
      interactions[postId].likes = interactions[postId].likes.filter(like => like.userId !== userId);
      updateInteractionCounts(postId, posts, interactions);
      
      // Record analytics (negative interaction)
      recordInteractionAnalytics('likes', postId, userId, userName, { action: 'unlike' });
      
      // Broadcast real-time update
      webSocketService.broadcastInteraction('unlike', postId, {
        userId,
        userName,
        action: 'unliked',
        likesCount: interactions[postId].likes.length,
        timestamp: new Date().toISOString()
      });
      
      console.log(`👎 ${userName} unliked ${postId}`);
      res.json({
        success: true,
        action: 'unliked',
        likesCount: interactions[postId].likes.length
      });
    } else {
      // Like - add new like
      const likeData = {
        userId,
        userName,
        timestamp: new Date().toISOString()
      };
      interactions[postId].likes.push(likeData);
      updateInteractionCounts(postId, posts, interactions);
      
      // Record analytics
      recordInteractionAnalytics('likes', postId, userId, userName, { action: 'like' });
      
      // Broadcast real-time update
      webSocketService.broadcastInteraction('like', postId, {
        userId,
        userName,
        action: 'liked',
        likesCount: interactions[postId].likes.length,
        timestamp: new Date().toISOString()
      });
      
      console.log(`👍 ${userName} liked ${postId}`);
      res.json({
        success: true,
        action: 'liked',
        likesCount: interactions[postId].likes.length
      });
    }
    
  } catch (error) {
    console.error('❌ Like error:', error.message);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

// Share a post
router.post('/:postId/share', (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, userName, message } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ error: 'userId and userName are required' });
    }
    
    // Check if post exists
    const post = posts.find(p => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Initialize interactions if not exists
    if (!interactions[postId]) {
      interactions[postId] = { likes: [], shares: [], replies: [] };
    }
    
    // Add share
    const shareId = `share-${interactionIdCounter++}`;
    const shareData = {
      id: shareId,
      userId,
      userName,
      message: message || null,
      timestamp: new Date().toISOString()
    };
    interactions[postId].shares.push(shareData);
    updateInteractionCounts(postId, posts, interactions);
    
    // Record analytics
    recordInteractionAnalytics('shares', postId, userId, userName, { 
      shareId, 
      message: message || null 
    });
    
    // Broadcast real-time update
    webSocketService.broadcastInteraction('share', postId, {
      userId,
      userName,
      shareId: shareId,
      message: message || null,
      sharesCount: interactions[postId].shares.length,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🔄 ${userName} shared ${postId}`);
    res.json({
      success: true,
      shareId: shareId,
      sharesCount: interactions[postId].shares.length
    });
    
  } catch (error) {
    console.error('❌ Share error:', error.message);
    res.status(500).json({ error: 'Failed to process share' });
  }
});

// Get interactions for a post
router.get('/:postId/interactions', (req, res) => {
  const { postId } = req.params;
  const postInteractions = interactions[postId] || { likes: [], shares: [], replies: [] };
  
  res.json({
    postId,
    likes: postInteractions.likes,
    shares: postInteractions.shares,
    replies: postInteractions.replies,
    counts: {
      likes: postInteractions.likes.length,
      shares: postInteractions.shares.length,
      replies: postInteractions.replies.length
    }
  });
});

// Create new post with media attachments
router.post('/', upload.array('attachments', 5), async (req, res) => {
  try {
    const { title, content_text, content_markdown, summary, tags, author } = req.body;
    
    if (!title || (!content_text && !content_markdown)) {
      return res.status(400).json({ 
        error: 'Title and content (text or markdown) are required' 
      });
    }
    
    // Process attachments if any
    let attachments = [];
    if (req.files && req.files.length > 0) {
      const uploadsDir = join(process.cwd(), 'public', 'uploads');
      
      for (const file of req.files) {
        const processedFile = await processMediaFile(file, uploadsDir);
        
        // Add alt text if provided
        if (req.body[`alt_${file.fieldname}`]) {
          processedFile.alt_text = req.body[`alt_${file.fieldname}`];
        }
        
        attachments.push(processedFile);
      }
    }
    
    // Create new post
    const postId = `post-${Date.now()}`;
    const newPost = {
      id: postId,
      uuid: randomUUID(),
      title: title,
      content_text: content_text || null,
      content_markdown: content_markdown || null,
      content_html: null, // Will be generated from markdown
      summary: summary || null,
      datePublished: new Date().toISOString(),
      dateModified: null,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      author: author ? JSON.parse(author) : siteConfig.author,
      attachments: attachments,
      interactions: {
        replies_count: 0,
        likes_count: 0,
        shares_count: 0
      }
    };
    
    // Process markdown content
    processMarkdownContent(newPost);
    
    // Add to posts array
    posts.unshift(newPost); // Add to beginning
    
    // Initialize interactions
    interactions[postId] = {
      likes: [],
      shares: [],
      replies: []
    };
    
    console.log(`📝 New post created: ${title} (${attachments.length} attachments)`);
    
    res.status(201).json({
      success: true,
      post: newPost,
      message: 'Post created successfully'
    });
    
  } catch (error) {
    console.error('❌ Post creation error:', error.message);
    res.status(500).json({
      error: 'Failed to create post',
      message: error.message
    });
  }
});

export default router;