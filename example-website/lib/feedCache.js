/**
 * Feed Caching System with Intelligent Invalidation
 * Optimizes feed generation and serving with smart cache management
 */

import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

/**
 * Feed cache manager with intelligent invalidation
 */
export class FeedCacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.metadata = new Map();
    this.maxAge = options.maxAge || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 100; // Max cached feeds
    this.compressionEnabled = options.compression !== false;
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      compressionSavings: 0
    };
  }

  /**
   * Get cached feed if valid
   */
  get(key, options = {}) {
    const cacheKey = this._generateCacheKey(key, options);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    const meta = this.metadata.get(cacheKey);
    
    // Check if cache is expired
    if (Date.now() - meta.timestamp > this.maxAge) {
      this.invalidate(key, options);
      this.stats.misses++;
      return null;
    }
    
    // Check if cache is stale based on content hash
    if (options.contentHash && meta.contentHash !== options.contentHash) {
      this.invalidate(key, options);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    meta.lastAccessed = Date.now();
    meta.accessCount++;
    
    // Decompress if needed
    if (meta.compressed) {
      return JSON.parse(gunzipSync(cached).toString());
    }
    
    return cached;
  }

  /**
   * Store feed in cache
   */
  set(key, feed, options = {}) {
    const cacheKey = this._generateCacheKey(key, options);
    
    // Enforce cache size limit
    if (this.cache.size >= this.maxSize) {
      this._evictLeastUsed();
    }
    
    let cachedData = feed;
    let compressed = false;
    let originalSize = JSON.stringify(feed).length;
    let cachedSize = originalSize;
    
    // Compress if enabled and feed is large enough
    if (this.compressionEnabled && originalSize > 1024) {
      const compressed = gzipSync(JSON.stringify(feed));
      cachedSize = compressed.length;
      
      // Only use compression if it saves significant space
      if (cachedSize < originalSize * 0.8) {
        cachedData = compressed;
        compressed = true;
        this.stats.compressionSavings += (originalSize - cachedSize);
      }
    }
    
    this.cache.set(cacheKey, cachedData);
    this.metadata.set(cacheKey, {
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      compressed: compressed,
      originalSize: originalSize,
      cachedSize: cachedSize,
      contentHash: options.contentHash || this._hashContent(feed),
      filters: options.filters || null
    });
    
    return true;
  }

  /**
   * Invalidate cached feed
   */
  invalidate(key, options = {}) {
    const cacheKey = this._generateCacheKey(key, options);
    const deleted = this.cache.delete(cacheKey);
    this.metadata.delete(cacheKey);
    
    if (deleted) {
      this.stats.invalidations++;
    }
    
    return deleted;
  }

  /**
   * Invalidate all caches matching a pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.metadata.delete(key);
        count++;
      }
    }
    
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Clear all caches
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.metadata.clear();
    this.stats.invalidations += size;
    return size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    let totalSize = 0;
    let totalOriginalSize = 0;
    
    for (const meta of this.metadata.values()) {
      totalSize += meta.cachedSize;
      totalOriginalSize += meta.originalSize;
    }
    
    return {
      ...this.stats,
      totalRequests,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.maxSize,
      totalCachedBytes: totalSize,
      totalOriginalBytes: totalOriginalSize,
      compressionRatio: totalOriginalSize > 0 ? 
        ((1 - totalSize / totalOriginalSize) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Get cache metadata for monitoring
   */
  getCacheInfo() {
    const entries = [];
    
    for (const [key, meta] of this.metadata.entries()) {
      entries.push({
        key,
        age: Date.now() - meta.timestamp,
        lastAccessed: Date.now() - meta.lastAccessed,
        accessCount: meta.accessCount,
        compressed: meta.compressed,
        size: meta.cachedSize,
        originalSize: meta.originalSize,
        compressionSavings: meta.originalSize - meta.cachedSize,
        filters: meta.filters
      });
    }
    
    // Sort by access count (most accessed first)
    entries.sort((a, b) => b.accessCount - a.accessCount);
    
    return entries;
  }

  /**
   * Generate cache key from feed key and options
   * @private
   */
  _generateCacheKey(key, options) {
    if (!options.filters && !options.format) {
      return key;
    }
    
    const parts = [key];
    
    if (options.filters) {
      parts.push(JSON.stringify(options.filters));
    }
    
    if (options.format) {
      parts.push(options.format);
    }
    
    return parts.join(':');
  }

  /**
   * Hash content for change detection
   * @private
   */
  _hashContent(content) {
    return createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Evict least recently used cache entry
   * @private
   */
  _evictLeastUsed() {
    let oldestKey = null;
    let oldestAccess = Infinity;
    
    for (const [key, meta] of this.metadata.entries()) {
      if (meta.lastAccessed < oldestAccess) {
        oldestAccess = meta.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metadata.delete(oldestKey);
    }
  }
}

/**
 * Feed analytics tracker
 */
export class FeedAnalytics {
  constructor() {
    this.requests = [];
    this.maxHistory = 1000;
  }

  /**
   * Track feed request
   */
  trackRequest(metadata) {
    this.requests.push({
      timestamp: Date.now(),
      ...metadata
    });
    
    // Keep only recent history
    if (this.requests.length > this.maxHistory) {
      this.requests.shift();
    }
  }

  /**
   * Get analytics summary
   */
  getSummary(timeRange = 3600000) { // 1 hour default
    const now = Date.now();
    const cutoff = now - timeRange;
    
    const recentRequests = this.requests.filter(r => r.timestamp >= cutoff);
    
    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: '0%',
        avgGenerationTime: 0,
        avgResponseSize: 0,
        timeRange: timeRange
      };
    }
    
    const cacheHits = recentRequests.filter(r => r.cached).length;
    const cacheMisses = recentRequests.length - cacheHits;
    const hitRate = ((cacheHits / recentRequests.length) * 100).toFixed(2);
    
    const totalGenerationTime = recentRequests.reduce((sum, r) => sum + (r.generationTime || 0), 0);
    const avgGenerationTime = Math.round(totalGenerationTime / recentRequests.length);
    
    const totalSize = recentRequests.reduce((sum, r) => sum + (r.responseSize || 0), 0);
    const avgResponseSize = Math.round(totalSize / recentRequests.length);
    
    return {
      totalRequests: recentRequests.length,
      cacheHits,
      cacheMisses,
      hitRate: `${hitRate}%`,
      avgGenerationTime: `${avgGenerationTime}ms`,
      avgResponseSize: `${Math.round(avgResponseSize / 1024)}KB`,
      timeRange: timeRange,
      requestsPerMinute: Math.round(recentRequests.length / (timeRange / 60000))
    };
  }

  /**
   * Get detailed analytics
   */
  getDetailed(timeRange = 3600000) {
    const now = Date.now();
    const cutoff = now - timeRange;
    
    const recentRequests = this.requests.filter(r => r.timestamp >= cutoff);
    
    // Group by time buckets (5 minute intervals)
    const bucketSize = 300000; // 5 minutes
    const buckets = new Map();
    
    for (const request of recentRequests) {
      const bucket = Math.floor(request.timestamp / bucketSize) * bucketSize;
      
      if (!buckets.has(bucket)) {
        buckets.set(bucket, {
          timestamp: bucket,
          requests: 0,
          cacheHits: 0,
          totalGenerationTime: 0,
          totalSize: 0
        });
      }
      
      const data = buckets.get(bucket);
      data.requests++;
      if (request.cached) data.cacheHits++;
      data.totalGenerationTime += request.generationTime || 0;
      data.totalSize += request.responseSize || 0;
    }
    
    // Convert to array and calculate averages
    const timeline = Array.from(buckets.values()).map(bucket => ({
      timestamp: new Date(bucket.timestamp).toISOString(),
      requests: bucket.requests,
      cacheHits: bucket.cacheHits,
      cacheMisses: bucket.requests - bucket.cacheHits,
      hitRate: `${((bucket.cacheHits / bucket.requests) * 100).toFixed(2)}%`,
      avgGenerationTime: `${Math.round(bucket.totalGenerationTime / bucket.requests)}ms`,
      avgSize: `${Math.round(bucket.totalSize / bucket.requests / 1024)}KB`
    }));
    
    return {
      summary: this.getSummary(timeRange),
      timeline: timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    };
  }
}

// Create singleton instances
export const feedCache = new FeedCacheManager({
  maxAge: 300000, // 5 minutes
  maxSize: 100,
  compression: true
});

export const feedAnalytics = new FeedAnalytics();

export default {
  FeedCacheManager,
  FeedAnalytics,
  feedCache,
  feedAnalytics
};
