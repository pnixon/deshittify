/**
 * Ansybl Social Interactions System
 * Handles reply threading, interaction tracking, and social metadata management
 */

/**
 * Reply Threading System
 * Manages conversation threads and reply relationships
 */
export class ReplyThreadingSystem {
  constructor() {
    this.threadCache = new Map();
  }

  /**
   * Build thread reconstruction from distributed reply chains
   * @param {Array<AnsyblItem>} items - Array of items that may contain replies
   * @returns {Map<string, ThreadNode>} Map of thread roots to thread structures
   */
  reconstructThreads(items) {
    const threads = new Map();
    const itemMap = new Map();
    const orphanReplies = [];

    // First pass: index all items by their ID
    items.forEach(item => {
      itemMap.set(item.id, item);
    });

    // Second pass: build thread structure
    items.forEach(item => {
      if (!item.in_reply_to) {
        // This is a root item
        const threadNode = this._createThreadNode(item);
        threads.set(item.id, threadNode);
      } else {
        // This is a reply
        const parentItem = itemMap.get(item.in_reply_to);
        if (parentItem) {
          // Parent exists, add to thread
          this._addReplyToThread(threads, item, parentItem);
        } else {
          // Parent not found, mark as orphan
          orphanReplies.push(item);
        }
      }
    });

    // Third pass: handle orphan replies by creating placeholder threads
    orphanReplies.forEach(orphanItem => {
      const placeholderThread = this._createPlaceholderThread(orphanItem);
      threads.set(orphanItem.in_reply_to, placeholderThread);
    });

    return threads;
  }

  /**
   * Validate reply relationship integrity
   * @param {AnsyblItem} replyItem - Item that claims to be a reply
   * @param {AnsyblItem} parentItem - Item being replied to
   * @returns {ValidationResult} Validation result with errors if any
   */
  validateReplyRelationship(replyItem, parentItem) {
    const errors = [];
    const warnings = [];

    // Basic validation
    if (!replyItem.in_reply_to) {
      errors.push({
        code: 'MISSING_REPLY_TO',
        message: 'Reply item must have in_reply_to field',
        field: 'in_reply_to'
      });
    }

    if (!parentItem) {
      errors.push({
        code: 'PARENT_NOT_FOUND',
        message: `Parent item ${replyItem.in_reply_to} not found`,
        field: 'in_reply_to'
      });
      return { valid: false, errors, warnings };
    }

    // URL validation
    if (replyItem.in_reply_to !== parentItem.id && replyItem.in_reply_to !== parentItem.url) {
      errors.push({
        code: 'REPLY_URL_MISMATCH',
        message: 'in_reply_to must match parent item ID or URL',
        field: 'in_reply_to'
      });
    }

    // Temporal validation - reply should be after parent
    const parentDate = new Date(parentItem.date_published);
    const replyDate = new Date(replyItem.date_published);
    
    if (replyDate < parentDate) {
      warnings.push({
        code: 'REPLY_BEFORE_PARENT',
        message: 'Reply appears to be published before parent item',
        field: 'date_published'
      });
    }

    // Circular reference detection
    if (this._detectCircularReference(replyItem, parentItem)) {
      errors.push({
        code: 'CIRCULAR_REFERENCE',
        message: 'Circular reference detected in reply chain',
        field: 'in_reply_to'
      });
    }

    // Thread depth validation (prevent excessively deep threads)
    const threadDepth = this._calculateThreadDepth(parentItem);
    if (threadDepth > 50) {
      warnings.push({
        code: 'DEEP_THREAD',
        message: 'Thread depth exceeds recommended maximum (50 levels)',
        field: 'in_reply_to'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get conversation thread for a specific item
   * @param {string} itemId - ID of the item to get thread for
   * @param {Array<AnsyblItem>} allItems - All available items
   * @param {object} options - Thread retrieval options
   * @returns {ThreadStructure} Complete thread structure
   */
  getConversationThread(itemId, allItems, options = {}) {
    const {
      maxDepth = 100,
      sortReplies = 'chronological', // 'chronological' or 'reverse'
      includeMetadata = true
    } = options;

    const threads = this.reconstructThreads(allItems);
    
    // Find the thread containing this item
    let targetThread = null;
    let targetNode = null;

    for (const [rootId, thread] of threads) {
      const found = this._findNodeInThread(thread, itemId);
      if (found) {
        targetThread = thread;
        targetNode = found;
        break;
      }
    }

    if (!targetThread) {
      return {
        root: null,
        target: null,
        ancestors: [],
        descendants: [],
        metadata: includeMetadata ? this._generateThreadMetadata(null) : null
      };
    }

    // Get ancestors (path from root to target)
    const ancestors = this._getAncestors(targetNode);
    
    // Get descendants (all replies under target)
    const descendants = this._getDescendants(targetNode, maxDepth);

    // Sort replies if requested
    if (sortReplies === 'reverse') {
      descendants.reverse();
    }

    return {
      root: targetThread,
      target: targetNode,
      ancestors,
      descendants,
      metadata: includeMetadata ? this._generateThreadMetadata(targetThread) : null
    };
  }

  /**
   * Create a new reply item with proper threading metadata
   * @param {AnsyblItem} parentItem - Item being replied to
   * @param {object} replyData - Reply content data
   * @returns {object} Reply item data with threading information
   */
  createReply(parentItem, replyData) {
    const reply = {
      ...replyData,
      in_reply_to: parentItem.id,
      date_published: replyData.date_published || new Date().toISOString()
    };

    // Add threading metadata
    if (!reply._thread_metadata) {
      reply._thread_metadata = {
        parent_id: parentItem.id,
        parent_author: parentItem.author?.name || 'Unknown',
        thread_root: this._findThreadRoot(parentItem),
        reply_depth: this._calculateReplyDepth(parentItem) + 1
      };
    }

    return reply;
  }

  /**
   * Create thread node structure
   * @private
   */
  _createThreadNode(item) {
    return {
      item,
      replies: [],
      metadata: {
        reply_count: 0,
        last_reply_date: item.date_published,
        participants: new Set([item.author?.name || 'Unknown'])
      }
    };
  }

  /**
   * Create placeholder thread for orphaned replies
   * @private
   */
  _createPlaceholderThread(orphanItem) {
    const placeholderItem = {
      id: orphanItem.in_reply_to,
      url: orphanItem.in_reply_to,
      title: '[Unavailable]',
      content_text: 'This item is not available',
      date_published: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      author: { name: 'Unknown', public_key: '' },
      signature: '',
      _placeholder: true
    };

    const threadNode = this._createThreadNode(placeholderItem);
    threadNode.replies.push(this._createThreadNode(orphanItem));
    threadNode.metadata.reply_count = 1;
    threadNode.metadata.last_reply_date = orphanItem.date_published;
    threadNode.metadata.participants.add(orphanItem.author?.name || 'Unknown');

    return threadNode;
  }

  /**
   * Add reply to existing thread structure
   * @private
   */
  _addReplyToThread(threads, replyItem, parentItem) {
    // Find the thread containing the parent
    for (const [rootId, thread] of threads) {
      const parentNode = this._findNodeInThread(thread, parentItem.id);
      if (parentNode) {
        const replyNode = this._createThreadNode(replyItem);
        parentNode.replies.push(replyNode);
        
        // Update metadata
        this._updateThreadMetadata(thread, replyItem);
        return;
      }
    }
  }

  /**
   * Find a node in thread structure
   * @private
   */
  _findNodeInThread(threadNode, itemId) {
    if (threadNode.item.id === itemId) {
      return threadNode;
    }

    for (const reply of threadNode.replies) {
      const found = this._findNodeInThread(reply, itemId);
      if (found) return found;
    }

    return null;
  }

  /**
   * Update thread metadata when adding replies
   * @private
   */
  _updateThreadMetadata(threadNode, replyItem) {
    threadNode.metadata.reply_count++;
    threadNode.metadata.last_reply_date = replyItem.date_published;
    threadNode.metadata.participants.add(replyItem.author?.name || 'Unknown');
  }

  /**
   * Get ancestors of a node (path from root to node)
   * @private
   */
  _getAncestors(node, ancestors = []) {
    // This is a simplified version - in a real implementation,
    // you'd need to track parent references during thread construction
    return ancestors;
  }

  /**
   * Get all descendants of a node
   * @private
   */
  _getDescendants(node, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    
    let descendants = [];
    
    for (const reply of node.replies) {
      descendants.push(reply);
      descendants = descendants.concat(
        this._getDescendants(reply, maxDepth, currentDepth + 1)
      );
    }
    
    return descendants;
  }

  /**
   * Detect circular references in reply chains
   * @private
   */
  _detectCircularReference(replyItem, parentItem, visited = new Set()) {
    if (visited.has(parentItem.id)) {
      return true; // Circular reference detected
    }

    visited.add(parentItem.id);

    if (parentItem.in_reply_to) {
      // This would require access to all items to follow the chain
      // Simplified implementation for now
      return false;
    }

    return false;
  }

  /**
   * Calculate thread depth for an item
   * @private
   */
  _calculateThreadDepth(item, depth = 0) {
    if (!item.in_reply_to || depth > 100) {
      return depth;
    }
    
    // In a real implementation, you'd follow the reply chain
    // This is a simplified version
    return depth + 1;
  }

  /**
   * Calculate reply depth for an item
   * @private
   */
  _calculateReplyDepth(item) {
    return this._calculateThreadDepth(item);
  }

  /**
   * Find the root of a thread
   * @private
   */
  _findThreadRoot(item) {
    if (!item.in_reply_to) {
      return item.id;
    }
    
    // In a real implementation, you'd follow the chain to the root
    // This is a simplified version
    return item.in_reply_to;
  }

  /**
   * Generate thread metadata
   * @private
   */
  _generateThreadMetadata(threadNode) {
    if (!threadNode) {
      return {
        total_items: 0,
        participants: [],
        date_range: null,
        max_depth: 0
      };
    }

    return {
      total_items: this._countThreadItems(threadNode),
      participants: Array.from(threadNode.metadata.participants),
      date_range: {
        start: threadNode.item.date_published,
        end: threadNode.metadata.last_reply_date
      },
      max_depth: this._calculateMaxDepth(threadNode)
    };
  }

  /**
   * Count total items in thread
   * @private
   */
  _countThreadItems(threadNode) {
    let count = 1; // Count this node
    
    for (const reply of threadNode.replies) {
      count += this._countThreadItems(reply);
    }
    
    return count;
  }

  /**
   * Calculate maximum depth of thread
   * @private
   */
  _calculateMaxDepth(threadNode, currentDepth = 0) {
    let maxDepth = currentDepth;
    
    for (const reply of threadNode.replies) {
      const replyDepth = this._calculateMaxDepth(reply, currentDepth + 1);
      maxDepth = Math.max(maxDepth, replyDepth);
    }
    
    return maxDepth;
  }
}
/**
 * I
nteraction Tracking System
 * Manages likes, shares, replies counting and cross-platform synchronization
 */
export class InteractionTrackingSystem {
  constructor() {
    this.interactionCache = new Map();
    this.syncHandlers = new Map();
  }

  /**
   * Update interaction counts for an item
   * @param {string} itemId - ID of the item
   * @param {object} interactions - New interaction counts
   * @param {number} interactions.replies_count - Number of replies
   * @param {number} interactions.likes_count - Number of likes  
   * @param {number} interactions.shares_count - Number of shares
   * @returns {object} Updated interaction object
   */
  updateInteractionCounts(itemId, interactions) {
    this._validateInteractionCounts(interactions);

    const updatedInteractions = {
      replies_count: Math.max(0, interactions.replies_count || 0),
      likes_count: Math.max(0, interactions.likes_count || 0),
      shares_count: Math.max(0, interactions.shares_count || 0),
      last_updated: new Date().toISOString()
    };

    // Preserve endpoint URLs if they exist
    if (interactions.replies_url) updatedInteractions.replies_url = interactions.replies_url;
    if (interactions.likes_url) updatedInteractions.likes_url = interactions.likes_url;
    if (interactions.shares_url) updatedInteractions.shares_url = interactions.shares_url;

    // Cache the updated interactions
    this.interactionCache.set(itemId, updatedInteractions);

    return updatedInteractions;
  }

  /**
   * Increment specific interaction count
   * @param {string} itemId - ID of the item
   * @param {string} interactionType - Type of interaction ('replies', 'likes', 'shares')
   * @param {number} increment - Amount to increment (default: 1)
   * @returns {object} Updated interaction counts
   */
  incrementInteraction(itemId, interactionType, increment = 1) {
    const validTypes = ['replies', 'likes', 'shares'];
    if (!validTypes.includes(interactionType)) {
      throw new Error(`Invalid interaction type: ${interactionType}`);
    }

    const current = this.interactionCache.get(itemId) || {
      replies_count: 0,
      likes_count: 0,
      shares_count: 0
    };

    const countField = `${interactionType}_count`;
    current[countField] = Math.max(0, (current[countField] || 0) + increment);
    current.last_updated = new Date().toISOString();

    this.interactionCache.set(itemId, current);
    return current;
  }

  /**
   * Create interaction endpoints for an item
   * @param {string} itemId - ID of the item
   * @param {string} baseUrl - Base URL for the endpoints
   * @returns {object} Interaction endpoints
   */
  createInteractionEndpoints(itemId, baseUrl) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const encodedItemId = encodeURIComponent(itemId);

    return {
      replies_url: `${cleanBaseUrl}/interactions/${encodedItemId}/replies`,
      likes_url: `${cleanBaseUrl}/interactions/${encodedItemId}/likes`,
      shares_url: `${cleanBaseUrl}/interactions/${encodedItemId}/shares`
    };
  }

  /**
   * Register a cross-platform sync handler
   * @param {string} platform - Platform name (e.g., 'activitypub', 'atproto')
   * @param {function} handler - Sync handler function
   */
  registerSyncHandler(platform, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Sync handler must be a function');
    }
    this.syncHandlers.set(platform, handler);
  }

  /**
   * Synchronize interactions across platforms
   * @param {string} itemId - ID of the item
   * @param {Array<string>} platforms - Platforms to sync with
   * @param {object} options - Sync options
   * @returns {Promise<object>} Sync results
   */
  async syncInteractions(itemId, platforms = [], options = {}) {
    const {
      timeout = 5000,
      retryAttempts = 2,
      aggregateResults = true
    } = options;

    const syncResults = {
      itemId,
      platforms: {},
      aggregated: null,
      errors: []
    };

    // Sync with each platform
    for (const platform of platforms) {
      const handler = this.syncHandlers.get(platform);
      if (!handler) {
        syncResults.errors.push({
          platform,
          error: `No sync handler registered for platform: ${platform}`
        });
        continue;
      }

      try {
        const platformResult = await this._syncWithPlatform(
          handler, 
          itemId, 
          platform, 
          timeout, 
          retryAttempts
        );
        syncResults.platforms[platform] = platformResult;
      } catch (error) {
        syncResults.errors.push({
          platform,
          error: error.message
        });
      }
    }

    // Aggregate results if requested
    if (aggregateResults) {
      syncResults.aggregated = this._aggregateInteractionCounts(syncResults.platforms);
    }

    return syncResults;
  }

  /**
   * Get interaction statistics for an item
   * @param {string} itemId - ID of the item
   * @returns {object} Interaction statistics
   */
  getInteractionStats(itemId) {
    const interactions = this.interactionCache.get(itemId);
    if (!interactions) {
      return {
        total_interactions: 0,
        breakdown: { replies: 0, likes: 0, shares: 0 },
        engagement_rate: 0,
        last_updated: null
      };
    }

    const total = (interactions.replies_count || 0) + 
                  (interactions.likes_count || 0) + 
                  (interactions.shares_count || 0);

    return {
      total_interactions: total,
      breakdown: {
        replies: interactions.replies_count || 0,
        likes: interactions.likes_count || 0,
        shares: interactions.shares_count || 0
      },
      engagement_rate: this._calculateEngagementRate(interactions),
      last_updated: interactions.last_updated
    };
  }

  /**
   * Batch update interactions for multiple items
   * @param {Array<object>} updates - Array of interaction updates
   * @returns {Array<object>} Results for each update
   */
  batchUpdateInteractions(updates) {
    const results = [];

    for (const update of updates) {
      try {
        const result = this.updateInteractionCounts(update.itemId, update.interactions);
        results.push({
          itemId: update.itemId,
          success: true,
          interactions: result
        });
      } catch (error) {
        results.push({
          itemId: update.itemId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate interaction counts
   * @private
   */
  _validateInteractionCounts(interactions) {
    const requiredFields = ['replies_count', 'likes_count', 'shares_count'];
    
    for (const field of requiredFields) {
      if (interactions[field] !== undefined) {
        if (!Number.isInteger(interactions[field]) || interactions[field] < 0) {
          throw new Error(`${field} must be a non-negative integer`);
        }
      }
    }

    // Validate URLs if provided
    const urlFields = ['replies_url', 'likes_url', 'shares_url'];
    for (const field of urlFields) {
      if (interactions[field]) {
        try {
          new URL(interactions[field]);
        } catch (error) {
          throw new Error(`Invalid URL for ${field}: ${interactions[field]}`);
        }
      }
    }
  }

  /**
   * Sync with a specific platform
   * @private
   */
  async _syncWithPlatform(handler, itemId, platform, timeout, retryAttempts) {
    let lastError;
    
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Sync timeout')), timeout);
        });

        const syncPromise = handler(itemId, {
          platform,
          attempt: attempt + 1,
          maxAttempts: retryAttempts + 1
        });

        const result = await Promise.race([syncPromise, timeoutPromise]);
        
        // Validate result format
        this._validateSyncResult(result, platform);
        
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < retryAttempts) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Validate sync result format
   * @private
   */
  _validateSyncResult(result, platform) {
    if (!result || typeof result !== 'object') {
      throw new Error(`Invalid sync result from ${platform}: must be an object`);
    }

    const requiredFields = ['replies_count', 'likes_count', 'shares_count'];
    for (const field of requiredFields) {
      if (result[field] !== undefined && (!Number.isInteger(result[field]) || result[field] < 0)) {
        throw new Error(`Invalid ${field} from ${platform}: must be a non-negative integer`);
      }
    }
  }

  /**
   * Aggregate interaction counts from multiple platforms
   * @private
   */
  _aggregateInteractionCounts(platformResults) {
    const aggregated = {
      replies_count: 0,
      likes_count: 0,
      shares_count: 0,
      platforms_synced: 0,
      sync_timestamp: new Date().toISOString()
    };

    for (const [platform, result] of Object.entries(platformResults)) {
      if (result && typeof result === 'object') {
        aggregated.replies_count += result.replies_count || 0;
        aggregated.likes_count += result.likes_count || 0;
        aggregated.shares_count += result.shares_count || 0;
        aggregated.platforms_synced++;
      }
    }

    return aggregated;
  }

  /**
   * Calculate engagement rate (simplified)
   * @private
   */
  _calculateEngagementRate(interactions) {
    const total = (interactions.replies_count || 0) + 
                  (interactions.likes_count || 0) + 
                  (interactions.shares_count || 0);
    
    // This is a simplified calculation - in reality you'd need view counts
    // or other metrics to calculate a meaningful engagement rate
    return total > 0 ? Math.min(total / 100, 1.0) : 0;
  }
}