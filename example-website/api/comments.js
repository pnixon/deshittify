/**
 * Enhanced Comments API routes with threading support
 */

import { Router } from 'express';
import { posts, comments, commentIdCounter, moderationActions, moderationIdCounter } from '../data/storage.js';
import { siteConfig } from '../data/config.js';
import webSocketService from '../lib/websocket.js';
import { recordInteractionAnalytics } from './interactions.js';

const router = Router();

// Get comments for a post with threading structure
router.get('/:postId', (req, res) => {
  const postComments = comments.filter(c => c.postId === req.params.postId && !c.deleted);
  
  // Build threaded structure
  const threadedComments = buildCommentTree(postComments);
  
  res.json({
    comments: threadedComments,
    total: postComments.length,
    threaded: true
  });
});

// Helper function to build comment tree structure
function buildCommentTree(comments) {
  const commentMap = new Map();
  const rootComments = [];
  
  // First pass: create map of all comments
  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });
  
  // Second pass: build tree structure
  comments.forEach(comment => {
    if (comment.parentCommentId) {
      const parent = commentMap.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(comment);
      } else {
        // Parent not found, treat as root comment
        rootComments.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  });
  
  return rootComments;
}

// Add a comment to a post (supports threading)
router.post('/:postId', async (req, res) => {
  try {
    const { author, content, parentCommentId } = req.body;
    const postId = req.params.postId;
    
    // Validate input
    if (!author || !content || !author.name || !content.trim()) {
      return res.status(400).json({
        error: 'Missing required fields: author.name and content are required'
      });
    }
    
    // Check if post exists
    const post = posts.find(p => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // If replying to a comment, validate parent exists
    if (parentCommentId) {
      const parentComment = comments.find(c => c.id === parentCommentId && !c.deleted);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }
    
    // Create comment
    const comment = {
      id: `comment-${commentIdCounter++}`,
      postId: postId,
      parentCommentId: parentCommentId || null,
      author: {
        name: author.name,
        url: author.url || null,
        avatar: author.avatar || null
      },
      content: content.trim(),
      contentHtml: `<p>${content.trim().replace(/\n/g, '<br>')}</p>`,
      datePublished: new Date().toISOString(),
      dateModified: null,
      deleted: false,
      moderated: false,
      inReplyTo: parentCommentId ? 
        `${siteConfig.baseUrl}/comment/${parentCommentId}` : 
        `${siteConfig.baseUrl}/post/${postId}`,
      replies: []
    };
    
    comments.unshift(comment); // Add to beginning for chronological order
    
    // Record analytics
    recordInteractionAnalytics('comments', postId, comment.author.name, comment.author.name, {
      commentId: comment.id,
      parentCommentId: parentCommentId,
      isReply: !!parentCommentId
    });
    
    // Broadcast real-time update
    webSocketService.broadcastComment(postId, {
      comment: comment,
      action: 'new_comment',
      isReply: !!parentCommentId
    });
    
    console.log(`💬 New ${parentCommentId ? 'reply' : 'comment'} added to ${postId} by ${author.name}`);
    
    res.status(201).json({
      success: true,
      comment: comment,
      message: `${parentCommentId ? 'Reply' : 'Comment'} added successfully and will appear in the Ansybl feed`
    });
    
  } catch (error) {
    console.error('❌ Comment creation error:', error.message);
    res.status(500).json({
      error: 'Failed to create comment',
      message: error.message
    });
  }
});

// Edit a comment
router.put('/:commentId', async (req, res) => {
  try {
    const { content, authorId } = req.body;
    const commentId = req.params.commentId;
    
    // Validate input
    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Content is required'
      });
    }
    
    // Find comment
    const comment = comments.find(c => c.id === commentId && !c.deleted);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Simple authorization check (in production, use proper auth)
    if (authorId && comment.author.name !== authorId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }
    
    // Update comment
    comment.content = content.trim();
    comment.contentHtml = `<p>${content.trim().replace(/\n/g, '<br>')}</p>`;
    comment.dateModified = new Date().toISOString();
    
    // Broadcast real-time update
    webSocketService.broadcastCommentUpdate(comment.postId, commentId, 'edit', comment);
    
    console.log(`✏️ Comment ${commentId} edited`);
    
    res.json({
      success: true,
      comment: comment,
      message: 'Comment updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Comment edit error:', error.message);
    res.status(500).json({
      error: 'Failed to edit comment',
      message: error.message
    });
  }
});

// Delete a comment (soft delete)
router.delete('/:commentId', async (req, res) => {
  try {
    const { authorId, reason } = req.body;
    const commentId = req.params.commentId;
    
    // Find comment
    const comment = comments.find(c => c.id === commentId && !c.deleted);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Simple authorization check (in production, use proper auth)
    if (authorId && comment.author.name !== authorId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    // Soft delete comment
    comment.deleted = true;
    comment.dateDeleted = new Date().toISOString();
    comment.deletionReason = reason || 'Deleted by author';
    
    // Record moderation action
    const moderationAction = {
      id: `moderation-${moderationIdCounter++}`,
      type: 'delete',
      targetType: 'comment',
      targetId: commentId,
      reason: reason || 'Deleted by author',
      moderatorId: authorId || 'system',
      timestamp: new Date().toISOString()
    };
    
    moderationActions.push(moderationAction);
    
    // Broadcast real-time update
    webSocketService.broadcastCommentUpdate(comment.postId, commentId, 'delete', {
      reason: reason || 'Deleted by author',
      deletedBy: authorId || 'system'
    });
    
    console.log(`🗑️ Comment ${commentId} deleted: ${reason || 'No reason provided'}`);
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Comment deletion error:', error.message);
    res.status(500).json({
      error: 'Failed to delete comment',
      message: error.message
    });
  }
});

// Moderate a comment (hide/approve)
router.post('/:commentId/moderate', async (req, res) => {
  try {
    const { action, reason, moderatorId } = req.body;
    const commentId = req.params.commentId;
    
    // Validate input
    if (!action || !['hide', 'approve', 'flag'].includes(action)) {
      return res.status(400).json({
        error: 'Valid action required: hide, approve, or flag'
      });
    }
    
    // Find comment
    const comment = comments.find(c => c.id === commentId && !c.deleted);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Apply moderation action
    if (action === 'hide') {
      comment.moderated = true;
      comment.moderationReason = reason || 'Hidden by moderator';
    } else if (action === 'approve') {
      comment.moderated = false;
      comment.moderationReason = null;
    }
    
    // Record moderation action
    const moderationAction = {
      id: `moderation-${moderationIdCounter++}`,
      type: action,
      targetType: 'comment',
      targetId: commentId,
      reason: reason || `Comment ${action}ed`,
      moderatorId: moderatorId || 'system',
      timestamp: new Date().toISOString()
    };
    
    moderationActions.push(moderationAction);
    
    // Broadcast real-time update
    webSocketService.broadcastCommentUpdate(comment.postId, commentId, 'moderate', {
      action: action,
      reason: reason || `Comment ${action}ed`,
      moderatedBy: moderatorId || 'system'
    });
    
    console.log(`🛡️ Comment ${commentId} ${action}ed by ${moderatorId || 'system'}: ${reason || 'No reason provided'}`);
    
    res.json({
      success: true,
      action: action,
      message: `Comment ${action}ed successfully`
    });
    
  } catch (error) {
    console.error('❌ Comment moderation error:', error.message);
    res.status(500).json({
      error: 'Failed to moderate comment',
      message: error.message
    });
  }
});

// Get all comments (for feed generation)
router.get('/', (_, res) => {
  res.json(comments);
});

export default router;