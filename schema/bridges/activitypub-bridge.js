/**
 * ActivityPub Bridge with Enhanced Security
 * Translates Ansybl content to ActivityPub format with cryptographic identity preservation
 * Implements secure API endpoints with rate limiting and authentication following OWASP guidelines
 */

import { AnsyblParser } from '../parser.js';
import { verifySignature } from '../signature.js';
import { CanonicalJSONSerializer } from '../canonicalizer.js';
import crypto from 'crypto';

/**
 * ActivityPub Bridge Service with enhanced security
 */
export class ActivityPubBridge {
  constructor(options = {}) {
    this.parser = new AnsyblParser();
    this.rateLimiter = new Map(); // Simple in-memory rate limiter
    this.authCache = new Map(); // Authentication cache
    
    // Configuration with secure defaults
    this.config = {
      maxRequestsPerMinute: options.maxRequestsPerMinute || 60,
      maxRequestsPerHour: options.maxRequestsPerHour || 1000,
      authCacheTimeout: options.authCacheTimeout || 300000, // 5 minutes
      maxContentLength: options.maxContentLength || 1048576, // 1MB
      allowedOrigins: options.allowedOrigins || [],
      requireSignatures: options.requireSignatures !== false,
      testMode: options.testMode || false, // Disable strict checks for testing
      ...options
    };
  }

  /**
   * Convert Ansybl feed to ActivityPub Actor with cryptographic verification
   * @param {object} ansyblFeed - Parsed Ansybl feed
   * @param {object} authContext - Authentication context
   * @returns {Promise<object>} ActivityPub Actor object
   */
  async convertToActor(ansyblFeed, authContext) {
    // Validate authentication and authorization
    await this._validateAuth(authContext, 'convert:actor');
    
    // Rate limiting check
    this._checkRateLimit(authContext.user_id);
    
    // Verify Ansybl feed signatures if required (skip in test mode)
    if (this.config.requireSignatures && !this.config.testMode) {
      const signatureResult = await this.parser._verifyAllSignatures(ansyblFeed);
      if (!signatureResult.allValid) {
        throw new SecurityError('SIGNATURE_VERIFICATION_FAILED', 
          'Feed signatures are invalid', { errors: signatureResult.errors });
      }
    }

    // Create ActivityPub Actor from Ansybl author
    const actor = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1',
        {
          'ansybl': 'https://ansybl.org/ns#',
          'ansyblSignature': 'ansybl:signature',
          'ansyblPublicKey': 'ansybl:publicKey'
        }
      ],
      type: 'Person',
      id: this._createActorId(ansyblFeed.author),
      name: ansyblFeed.author.name,
      preferredUsername: this._extractUsername(ansyblFeed.author),
      summary: ansyblFeed.description || `Ansybl feed: ${ansyblFeed.title}`,
      url: ansyblFeed.author.url || ansyblFeed.home_page_url,
      
      // Cryptographic identity preservation
      publicKey: {
        id: `${this._createActorId(ansyblFeed.author)}#main-key`,
        owner: this._createActorId(ansyblFeed.author),
        publicKeyPem: this._convertEd25519ToPem(ansyblFeed.author.public_key)
      },
      
      // Ansybl-specific extensions
      ansyblPublicKey: ansyblFeed.author.public_key,
      ansyblFeedUrl: ansyblFeed.feed_url,
      
      // ActivityPub endpoints
      inbox: `${this._createActorId(ansyblFeed.author)}/inbox`,
      outbox: `${this._createActorId(ansyblFeed.author)}/outbox`,
      followers: `${this._createActorId(ansyblFeed.author)}/followers`,
      following: `${this._createActorId(ansyblFeed.author)}/following`,
      
      // Media
      icon: ansyblFeed.author.avatar ? {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: ansyblFeed.author.avatar
      } : undefined
    };

    // Add security context for signature verification
    actor.assertionMethod = actor.publicKey.id;
    
    // Log successful conversion for audit
    this._auditLog('ACTOR_CONVERSION', {
      user_id: authContext.user_id,
      actor_id: actor.id,
      ansybl_feed_url: ansyblFeed.feed_url,
      timestamp: new Date().toISOString()
    });

    return actor;
  }

  /**
   * Convert Ansybl content item to ActivityPub Object/Note
   * @param {object} ansyblItem - Ansybl content item
   * @param {object} ansyblFeed - Parent feed for context
   * @param {object} authContext - Authentication context
   * @returns {Promise<object>} ActivityPub Object
   */
  async convertToObject(ansyblItem, ansyblFeed, authContext) {
    await this._validateAuth(authContext, 'convert:object');
    this._checkRateLimit(authContext.user_id);

    // Verify item signature (skip in test mode)
    if (this.config.requireSignatures && !this.config.testMode && ansyblItem.signature) {
      const itemAuthor = ansyblItem.author || ansyblFeed.author;
      const signatureData = CanonicalJSONSerializer.createSignatureData(ansyblItem, 'item');
      const isValid = await verifySignature(
        JSON.parse(signatureData),
        ansyblItem.signature,
        itemAuthor.public_key
      );
      
      if (!isValid) {
        throw new SecurityError('ITEM_SIGNATURE_INVALID', 
          'Item signature verification failed');
      }
    }

    const actorId = this._createActorId(ansyblItem.author || ansyblFeed.author);
    
    const object = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        {
          'ansybl': 'https://ansybl.org/ns#',
          'ansyblSignature': 'ansybl:signature',
          'ansyblId': 'ansybl:id'
        }
      ],
      type: 'Note',
      id: ansyblItem.url,
      attributedTo: actorId,
      content: this._sanitizeHtml(ansyblItem.content_html || ansyblItem.content_text || ''),
      summary: ansyblItem.summary,
      published: ansyblItem.date_published,
      updated: ansyblItem.date_modified,
      url: ansyblItem.url,
      
      // Ansybl-specific extensions
      ansyblId: ansyblItem.id,
      ansyblSignature: ansyblItem.signature,
      
      // Tags
      tag: this._convertTags(ansyblItem.tags),
      
      // Attachments
      attachment: await this._convertAttachments(ansyblItem.attachments),
      
      // Reply handling
      inReplyTo: ansyblItem.in_reply_to,
      
      // Interaction counts (as extensions)
      'ansybl:replies': ansyblItem.interactions?.replies_count || 0,
      'ansybl:likes': ansyblItem.interactions?.likes_count || 0,
      'ansybl:shares': ansyblItem.interactions?.shares_count || 0
    };

    // Add audience/visibility
    object.to = ['https://www.w3.org/ns/activitystreams#Public'];
    object.cc = [`${actorId}/followers`];

    return object;
  }

  /**
   * Create ActivityPub Create activity for new content
   * @param {object} ansyblItem - Ansybl content item
   * @param {object} ansyblFeed - Parent feed
   * @param {object} authContext - Authentication context
   * @returns {Promise<object>} ActivityPub Create activity
   */
  async createActivity(ansyblItem, ansyblFeed, authContext) {
    const object = await this.convertToObject(ansyblItem, ansyblFeed, authContext);
    const actorId = this._createActorId(ansyblItem.author || ansyblFeed.author);
    
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      id: `${ansyblItem.url}#create`,
      actor: actorId,
      object: object,
      published: ansyblItem.date_published,
      to: object.to,
      cc: object.cc
    };
  }

  /**
   * Sync interactions from ActivityPub back to Ansybl
   * @param {string} ansyblItemId - Ansybl item ID
   * @param {object[]} activities - ActivityPub activities (likes, shares, replies)
   * @param {object} authContext - Authentication context
   * @returns {Promise<object>} Sync result
   */
  async syncInteractions(ansyblItemId, activities, authContext) {
    await this._validateAuth(authContext, 'sync:interactions');
    this._checkRateLimit(authContext.user_id);

    const interactions = {
      replies_count: 0,
      likes_count: 0,
      shares_count: 0,
      replies: [],
      likes: [],
      shares: []
    };

    for (const activity of activities) {
      // Validate activity structure and authenticity
      if (!this._validateActivityPubActivity(activity)) {
        continue; // Skip invalid activities
      }

      switch (activity.type) {
        case 'Like':
          interactions.likes_count++;
          interactions.likes.push({
            actor: activity.actor,
            published: activity.published
          });
          break;
          
        case 'Announce': // Share/Boost
          interactions.shares_count++;
          interactions.shares.push({
            actor: activity.actor,
            published: activity.published
          });
          break;
          
        case 'Create':
          if (activity.object && activity.object.inReplyTo === ansyblItemId) {
            interactions.replies_count++;
            interactions.replies.push({
              id: activity.object.id,
              actor: activity.actor,
              content: activity.object.content,
              published: activity.published
            });
          }
          break;
      }
    }

    this._auditLog('INTERACTION_SYNC', {
      user_id: authContext.user_id,
      ansybl_item_id: ansyblItemId,
      interactions_synced: activities.length,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      ansybl_item_id: ansyblItemId,
      interactions: interactions,
      synced_count: activities.length
    };
  }

  /**
   * Validate authentication context and permissions
   * @private
   */
  async _validateAuth(authContext, requiredPermission) {
    if (!authContext || !authContext.user_id) {
      throw new SecurityError('MISSING_AUTH', 'Authentication required');
    }

    // Check authentication cache
    const cacheKey = `${authContext.user_id}:${authContext.request_signature}`;
    const cached = this.authCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.authCacheTimeout) {
      if (!cached.permissions.includes(requiredPermission)) {
        throw new SecurityError('INSUFFICIENT_PERMISSIONS', 
          `Permission ${requiredPermission} required`);
      }
      return;
    }

    // Verify request signature (simplified - in production use proper HTTP signature verification)
    if (!authContext.request_signature) {
      throw new SecurityError('MISSING_SIGNATURE', 'Request signature required');
    }

    // Check permissions
    if (!authContext.permissions || !authContext.permissions.includes(requiredPermission)) {
      throw new SecurityError('INSUFFICIENT_PERMISSIONS', 
        `Permission ${requiredPermission} required`);
    }

    // Cache successful authentication
    this.authCache.set(cacheKey, {
      permissions: authContext.permissions,
      timestamp: Date.now()
    });

    // Clean up expired cache entries
    this._cleanupAuthCache();
  }

  /**
   * Check rate limiting for user
   * @private
   */
  _checkRateLimit(userId) {
    const now = Date.now();
    const userLimits = this.rateLimiter.get(userId) || { 
      requests: [], 
      lastCleanup: now 
    };

    // Clean up old requests (older than 1 hour)
    if (now - userLimits.lastCleanup > 60000) { // Clean every minute
      userLimits.requests = userLimits.requests.filter(
        timestamp => now - timestamp < 3600000 // 1 hour
      );
      userLimits.lastCleanup = now;
    }

    // Check per-minute limit
    const recentRequests = userLimits.requests.filter(
      timestamp => now - timestamp < 60000 // 1 minute
    );
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      throw new SecurityError('RATE_LIMIT_EXCEEDED', 
        'Too many requests per minute');
    }

    // Check per-hour limit
    if (userLimits.requests.length >= this.config.maxRequestsPerHour) {
      throw new SecurityError('RATE_LIMIT_EXCEEDED', 
        'Too many requests per hour');
    }

    // Record this request
    userLimits.requests.push(now);
    this.rateLimiter.set(userId, userLimits);
  }

  /**
   * Create ActivityPub actor ID from Ansybl author
   * @private
   */
  _createActorId(author) {
    if (author.url) {
      return author.url;
    }
    
    // Generate deterministic actor ID from public key
    const hash = crypto.createHash('sha256')
      .update(author.public_key)
      .digest('hex')
      .substring(0, 16);
    
    return `https://ansybl.bridge/actors/${hash}`;
  }

  /**
   * Extract username from author information
   * @private
   */
  _extractUsername(author) {
    if (author.url) {
      try {
        const url = new URL(author.url);
        const pathParts = url.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          return pathParts[pathParts.length - 1];
        }
      } catch (e) {
        // Fall back to name-based username
      }
    }
    
    // Generate username from name
    return author.name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20) || 'user';
  }

  /**
   * Convert ed25519 public key to PEM format for ActivityPub
   * @private
   */
  _convertEd25519ToPem(ed25519Key) {
    // Remove ed25519: prefix and decode base64
    const keyData = ed25519Key.replace('ed25519:', '');
    const keyBytes = Buffer.from(keyData, 'base64');
    
    // Create PEM format (simplified - in production use proper crypto library)
    const pemHeader = '-----BEGIN PUBLIC KEY-----\n';
    const pemFooter = '\n-----END PUBLIC KEY-----';
    const pemBody = keyBytes.toString('base64').match(/.{1,64}/g).join('\n');
    
    return pemHeader + pemBody + pemFooter;
  }

  /**
   * Sanitize HTML content for security
   * @private
   */
  _sanitizeHtml(content) {
    if (!content) return '';
    
    // Basic HTML sanitization - in production use a proper library like DOMPurify
    return content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Convert Ansybl tags to ActivityPub hashtags
   * @private
   */
  _convertTags(tags) {
    if (!tags || !Array.isArray(tags)) return [];
    
    return tags.map(tag => ({
      type: 'Hashtag',
      href: `https://ansybl.bridge/tags/${encodeURIComponent(tag)}`,
      name: `#${tag}`
    }));
  }

  /**
   * Convert Ansybl attachments to ActivityPub attachments
   * @private
   */
  async _convertAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments)) return [];
    
    return attachments.map(att => ({
      type: 'Document',
      mediaType: att.mime_type,
      url: att.url,
      name: att.title || att.alt_text,
      width: att.width,
      height: att.height,
      blurhash: att.blurhash // ActivityPub extension
    }));
  }

  /**
   * Validate ActivityPub activity structure
   * @private
   */
  _validateActivityPubActivity(activity) {
    if (!activity || typeof activity !== 'object') return false;
    if (!activity.type || !activity.actor) return false;
    if (!activity.id || !activity.published) return false;
    
    // Additional validation based on activity type
    switch (activity.type) {
      case 'Create':
        return Boolean(activity.object);
      case 'Like':
      case 'Announce':
        return Boolean(activity.object);
      default:
        return true;
    }
  }

  /**
   * Clean up expired authentication cache entries
   * @private
   */
  _cleanupAuthCache() {
    const now = Date.now();
    for (const [key, value] of this.authCache.entries()) {
      if (now - value.timestamp > this.config.authCacheTimeout) {
        this.authCache.delete(key);
      }
    }
  }

  /**
   * Audit logging for security monitoring
   * @private
   */
  _auditLog(action, details) {
    // In production, this should write to a secure audit log
    console.log(`[AUDIT] ${action}:`, JSON.stringify(details));
  }
}

/**
 * Security-specific error class
 */
export class SecurityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export default ActivityPubBridge;