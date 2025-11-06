/**
 * Comprehensive Interaction Tracking API
 */

import { Router } from 'express';
import { posts, comments, interactions, interactionIdCounter } from '../data/storage.js';
import { siteConfig } from '../data/config.js';

const router = Router();

// Interaction analytics storage
let interactionAnalytics = {
  daily: {},
  weekly: {},
  monthly: {},
  userActivity: {},
  contentPerformance: {}
};

// Interaction audit trail storage
let interactionAuditTrail = [];

// Helper function to get date keys for analytics
function getDateKeys(date = new Date()) {
  const d = new Date(date);
  return {
    daily: d.toISOString().split('T')[0], // YYYY-MM-DD
    weekly: getWeekKey(d),
    monthly: d.toISOString().substring(0, 7) // YYYY-MM
  };
}

function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

// Record interaction in analytics
function recordInteractionAnalytics(type, postId, userId, userName, metadata = {}) {
  const timestamp = new Date().toISOString();
  const dateKeys = getDateKeys();
  
  // Initialize analytics structures if needed
  ['daily', 'weekly', 'monthly'].forEach(period => {
    const key = dateKeys[period];
    if (!interactionAnalytics[period][key]) {
      interactionAnalytics[period][key] = {
        likes: 0,
        shares: 0,
        comments: 0,
        total: 0,
        uniqueUsers: new Set()
      };
    }
    
    // Update counts
    interactionAnalytics[period][key][type]++;
    interactionAnalytics[period][key].total++;
    interactionAnalytics[period][key].uniqueUsers.add(userId);
  });
  
  // User activity tracking
  if (!interactionAnalytics.userActivity[userId]) {
    interactionAnalytics.userActivity[userId] = {
      userName: userName,
      totalInteractions: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      firstActivity: timestamp,
      lastActivity: timestamp,
      activeDays: new Set()
    };
  }
  
  const userActivity = interactionAnalytics.userActivity[userId];
  userActivity.totalInteractions++;
  userActivity[type]++;
  userActivity.lastActivity = timestamp;
  userActivity.activeDays.add(dateKeys.daily);
  
  // Content performance tracking
  if (!interactionAnalytics.contentPerformance[postId]) {
    interactionAnalytics.contentPerformance[postId] = {
      likes: 0,
      shares: 0,
      comments: 0,
      total: 0,
      engagementRate: 0,
      peakActivity: null,
      firstInteraction: timestamp
    };
  }
  
  const contentPerf = interactionAnalytics.contentPerformance[postId];
  contentPerf[type]++;
  contentPerf.total++;
  contentPerf.engagementRate = calculateEngagementRate(postId);
  
  // Record in audit trail
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: type,
    postId: postId,
    userId: userId,
    userName: userName,
    timestamp: timestamp,
    metadata: metadata,
    ipAddress: null, // Would be populated from request in production
    userAgent: null  // Would be populated from request in production
  };
  
  interactionAuditTrail.push(auditEntry);
  
  // Keep audit trail manageable (last 10000 entries)
  if (interactionAuditTrail.length > 10000) {
    interactionAuditTrail = interactionAuditTrail.slice(-10000);
  }
}

// Calculate engagement rate for content
function calculateEngagementRate(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return 0;
  
  const postInteractions = interactions[postId];
  if (!postInteractions) return 0;
  
  const totalInteractions = postInteractions.likes.length + 
                           postInteractions.shares.length + 
                           postInteractions.replies.length;
  
  // Simple engagement rate calculation (in production, would factor in views, time, etc.)
  return totalInteractions > 0 ? Math.min(totalInteractions * 10, 100) : 0;
}

// Get comprehensive analytics dashboard
router.get('/analytics', (req, res) => {
  const { period = 'daily', limit = 30 } = req.query;
  
  try {
    // Convert Sets to arrays for JSON serialization
    const analyticsData = JSON.parse(JSON.stringify(interactionAnalytics, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
    
    // Get recent period data
    const periodData = analyticsData[period] || {};
    const sortedPeriods = Object.keys(periodData)
      .sort()
      .slice(-limit)
      .reduce((acc, key) => {
        acc[key] = {
          ...periodData[key],
          uniqueUsers: periodData[key].uniqueUsers.length
        };
        return acc;
      }, {});
    
    // Calculate totals
    const totals = {
      likes: 0,
      shares: 0,
      comments: 0,
      total: 0,
      uniqueUsers: new Set()
    };
    
    Object.values(periodData).forEach(data => {
      totals.likes += data.likes;
      totals.shares += data.shares;
      totals.comments += data.comments;
      totals.total += data.total;
      data.uniqueUsers.forEach(user => totals.uniqueUsers.add(user));
    });
    
    // Top performing content
    const topContent = Object.entries(analyticsData.contentPerformance)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 10)
      .map(([postId, data]) => {
        const post = posts.find(p => p.id === postId);
        return {
          postId,
          title: post?.title || 'Unknown Post',
          ...data
        };
      });
    
    // Most active users
    const topUsers = Object.entries(analyticsData.userActivity)
      .sort(([,a], [,b]) => b.totalInteractions - a.totalInteractions)
      .slice(0, 10)
      .map(([userId, data]) => ({
        userId,
        ...data,
        activeDays: data.activeDays.length
      }));
    
    res.json({
      success: true,
      period: period,
      data: sortedPeriods,
      totals: {
        ...totals,
        uniqueUsers: totals.uniqueUsers.size
      },
      topContent,
      topUsers,
      summary: {
        totalPosts: posts.length,
        totalComments: comments.filter(c => !c.deleted).length,
        totalInteractions: totals.total,
        averageEngagement: topContent.length > 0 ? 
          topContent.reduce((sum, item) => sum + item.engagementRate, 0) / topContent.length : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Analytics error:', error.message);
    res.status(500).json({
      error: 'Failed to generate analytics',
      message: error.message
    });
  }
});

// Get interaction history for a specific post
router.get('/history/:postId', (req, res) => {
  const { postId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  try {
    // Get audit trail for this post
    const postHistory = interactionAuditTrail
      .filter(entry => entry.postId === postId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + parseInt(limit));
    
    // Get current interaction state
    const currentState = interactions[postId] || { likes: [], shares: [], replies: [] };
    
    res.json({
      success: true,
      postId,
      history: postHistory,
      currentState: {
        likes: currentState.likes.length,
        shares: currentState.shares.length,
        replies: currentState.replies.length
      },
      total: interactionAuditTrail.filter(entry => entry.postId === postId).length
    });
    
  } catch (error) {
    console.error('❌ History error:', error.message);
    res.status(500).json({
      error: 'Failed to get interaction history',
      message: error.message
    });
  }
});

// Get user interaction history
router.get('/user/:userId/history', (req, res) => {
  const { userId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  try {
    // Get audit trail for this user
    const userHistory = interactionAuditTrail
      .filter(entry => entry.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + parseInt(limit));
    
    // Get user activity summary
    const userActivity = interactionAnalytics.userActivity[userId];
    
    res.json({
      success: true,
      userId,
      history: userHistory,
      activity: userActivity ? {
        ...userActivity,
        activeDays: userActivity.activeDays.size
      } : null,
      total: interactionAuditTrail.filter(entry => entry.userId === userId).length
    });
    
  } catch (error) {
    console.error('❌ User history error:', error.message);
    res.status(500).json({
      error: 'Failed to get user history',
      message: error.message
    });
  }
});

// Export interaction data
router.get('/export', (req, res) => {
  const { format = 'json', startDate, endDate } = req.query;
  
  try {
    let exportData = {
      interactions: interactions,
      analytics: interactionAnalytics,
      auditTrail: interactionAuditTrail
    };
    
    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      exportData.auditTrail = interactionAuditTrail.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= start && entryDate <= end;
      });
    }
    
    // Convert Sets to arrays for serialization
    exportData = JSON.parse(JSON.stringify(exportData, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
    
    if (format === 'csv') {
      // Simple CSV export of audit trail
      const csvHeaders = 'timestamp,type,postId,userId,userName,metadata\n';
      const csvData = exportData.auditTrail.map(entry => 
        `${entry.timestamp},${entry.type},${entry.postId},${entry.userId},"${entry.userName}","${JSON.stringify(entry.metadata).replace(/"/g, '""')}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="interactions-export.csv"');
      res.send(csvHeaders + csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="interactions-export.json"');
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        dateRange: { startDate, endDate },
        data: exportData
      });
    }
    
  } catch (error) {
    console.error('❌ Export error:', error.message);
    res.status(500).json({
      error: 'Failed to export interaction data',
      message: error.message
    });
  }
});

// Get real-time interaction stats
router.get('/realtime', (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get interactions from last hour
    const recentInteractions = interactionAuditTrail.filter(entry => 
      new Date(entry.timestamp) >= oneHourAgo
    );
    
    // Group by 5-minute intervals
    const intervals = {};
    recentInteractions.forEach(entry => {
      const timestamp = new Date(entry.timestamp);
      const intervalKey = new Date(Math.floor(timestamp.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)).toISOString();
      
      if (!intervals[intervalKey]) {
        intervals[intervalKey] = { likes: 0, shares: 0, comments: 0, total: 0 };
      }
      
      intervals[intervalKey][entry.type]++;
      intervals[intervalKey].total++;
    });
    
    res.json({
      success: true,
      timeRange: '1 hour',
      interval: '5 minutes',
      data: intervals,
      summary: {
        totalInteractions: recentInteractions.length,
        uniqueUsers: new Set(recentInteractions.map(e => e.userId)).size,
        mostActivePost: getMostActivePost(recentInteractions)
      }
    });
    
  } catch (error) {
    console.error('❌ Realtime stats error:', error.message);
    res.status(500).json({
      error: 'Failed to get realtime stats',
      message: error.message
    });
  }
});

function getMostActivePost(interactions) {
  const postCounts = {};
  interactions.forEach(entry => {
    postCounts[entry.postId] = (postCounts[entry.postId] || 0) + 1;
  });
  
  const mostActive = Object.entries(postCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (!mostActive) return null;
  
  const post = posts.find(p => p.id === mostActive[0]);
  return {
    postId: mostActive[0],
    title: post?.title || 'Unknown Post',
    interactions: mostActive[1]
  };
}

// Export the analytics recording function for use in other modules
export { recordInteractionAnalytics };

export default router;