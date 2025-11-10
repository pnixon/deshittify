# Feed Serving and Syndication Implementation

This document describes the complete implementation of feed serving, caching, discovery, subscription, and customization features for the Ansybl protocol.

## Overview

The feed serving system provides optimized, cached, and customizable Ansybl feeds with comprehensive discovery and subscription management capabilities.

## Features Implemented

### 1. Feed Caching and Optimization (Task 9.1)

#### Feed Cache Manager
- **Intelligent caching** with content-based invalidation
- **Compression support** using gzip for large feeds
- **LRU eviction** when cache size limit is reached
- **Cache statistics** tracking hits, misses, and compression savings

**Location**: `lib/feedCache.js`

**Key Features**:
- Configurable cache TTL (default: 5 minutes)
- Content hash-based invalidation
- Automatic compression for feeds > 1KB
- Per-filter caching support

**API Endpoints**:
```
GET  /api/feed/cache/stats       - Get cache statistics
POST /api/feed/cache/invalidate  - Invalidate cache entries
```

#### Feed Analytics
- **Request tracking** with timestamps and metadata
- **Performance metrics** including generation time and response size
- **Timeline analysis** with 5-minute buckets
- **Hit rate calculation** for cache effectiveness

**API Endpoints**:
```
GET /api/feed/analytics?range=3600000&detailed=true
```

#### Optimized Feed Generation
- **Lazy content processing** - markdown conversion on demand
- **Efficient serialization** using canonical JSON
- **Compression middleware** for HTTP responses
- **ETag support** for conditional requests

**API Endpoints**:
```
GET /api/feed.ansybl              - Main feed endpoint (cached)
GET /api/feed/info                - Feed metadata
GET /api/feed/health              - Health check endpoint
GET /api/feed/export?format=json  - Export feed
POST /api/feed/backup             - Create feed backup
```

### 2. Feed Discovery and Subscription (Task 9.2)

#### Feed Discovery Service
- **Autodiscovery links** generation for HTML pages
- **WebFinger support** (RFC 7033)
- **Host-meta endpoint** for discovery
- **Multiple format support** (Ansybl, RSS, JSON Feed, ActivityPub)

**Location**: `lib/feedDiscovery.js`

**API Endpoints**:
```
GET /.well-known/webfinger?resource=acct:user@domain
GET /.well-known/host-meta
GET /api/feed-discovery/discover?url=https://example.com
GET /api/feed-discovery/feed-links
GET /api/feed-discovery/discovered
```

**Autodiscovery Links**:
```html
<link rel="alternate" type="application/json" title="Ansybl Feed" href="/feed.ansybl">
<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.rss">
<link rel="alternate" type="application/feed+json" title="JSON Feed" href="/feed.json">
<link rel="hub" href="/api/feed/hub">
<link rel="self" type="application/json" href="/feed.ansybl">
```

#### Subscription Manager
- **Subscribe/unsubscribe** functionality
- **Subscription status tracking** (active, paused, suspended)
- **Delivery tracking** with success/failure counts
- **Auto-suspension** after repeated failures
- **Per-subscriber management**

**API Endpoints**:
```
POST   /api/feed-discovery/subscribe
DELETE /api/feed-discovery/subscribe/:subscriptionId
GET    /api/feed-discovery/subscribe/:subscriptionId
GET    /api/feed-discovery/subscriptions/:subscriberId
GET    /api/feed-discovery/subscriptions/stats
PATCH  /api/feed-discovery/subscribe/:subscriptionId
```

**Subscription Object**:
```json
{
  "id": "sub-1",
  "feedUrl": "https://example.com/feed.ansybl",
  "subscriber": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com",
    "callbackUrl": "https://subscriber.com/callback"
  },
  "subscribedAt": "2025-11-09T10:00:00Z",
  "status": "active",
  "lastDelivery": "2025-11-09T10:05:00Z",
  "deliveryCount": 42,
  "failureCount": 0
}
```

#### Feed Health Monitor
- **Periodic health checks** for registered feeds
- **Uptime tracking** with percentage calculation
- **Response time monitoring**
- **Alert thresholds** for unhealthy feeds

**API Endpoints**:
```
POST /api/feed-discovery/health/register
POST /api/feed-discovery/health/check
GET  /api/feed-discovery/health/:feedUrl
GET  /api/feed-discovery/health
```

### 3. Feed Customization and Filtering (Task 9.3)

#### Custom Feed Views
- **Filter by tags** - include specific tags
- **Filter by author** - content from specific authors
- **Date range filtering** - from/to dates
- **Content type filtering** - posts, comments, media
- **Limit results** - pagination support

**API Endpoints**:
```
GET /api/feed/custom?tags=tech,news&author=john&from=2025-01-01&limit=20
```

**Query Parameters**:
- `tags` - Comma-separated list of tags
- `author` - Author name (partial match)
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Maximum items to return
- `type` - Content type filter

#### Personalized Feeds
- **User preferences** based filtering
- **Saved view configurations**
- **Usage tracking** for views
- **Preset filters** for common use cases

**API Endpoints**:
```
POST   /api/feed/personalize
POST   /api/feed/views
GET    /api/feed/views/:userId
GET    /api/feed/views/:viewId/feed
DELETE /api/feed/views/:viewId
GET    /api/feed/presets
GET    /api/feed/presets/:presetId/feed
```

**Personalization Request**:
```json
{
  "userId": "user-123",
  "preferences": {
    "tags": ["technology", "science"],
    "authors": ["John Doe", "Jane Smith"],
    "contentTypes": ["posts"],
    "dateRange": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-12-31T23:59:59Z"
    },
    "limit": 50
  }
}
```

**Saved View Object**:
```json
{
  "id": "view-123",
  "userId": "user-123",
  "name": "Tech News",
  "description": "Latest technology and science posts",
  "filters": {
    "tags": ["technology", "science"],
    "limit": 50
  },
  "created": "2025-11-09T10:00:00Z",
  "lastUsed": "2025-11-09T12:00:00Z",
  "useCount": 15
}
```

#### Feed Presets
Built-in filter presets for common use cases:

1. **Recent Posts** - Last 7 days, 50 items
2. **Popular Content** - Most interactions, 20 items
3. **Media Posts** - Posts with attachments, 30 items
4. **Active Discussions** - Most comments, 25 items

## Cache Invalidation Strategy

The feed cache is automatically invalidated when:

1. **Content changes** - New posts or comments added
2. **Content modified** - Existing posts updated
3. **Interactions change** - Likes, shares, or comments added
4. **Manual invalidation** - Via API endpoint

**Content Hash Calculation**:
```javascript
{
  posts: [{ id, modified }],
  comments: [{ id, published }]
}
```

The hash is computed from post IDs and modification dates, ensuring cache invalidation only when content actually changes.

## Performance Optimizations

### 1. Compression
- Gzip compression for feeds > 1KB
- Typical compression ratio: 70-80%
- Automatic fallback if compression doesn't save space

### 2. Caching Strategy
- In-memory cache with LRU eviction
- Per-filter cache keys
- Content-based invalidation
- Configurable TTL (default: 5 minutes)

### 3. Response Headers
```
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=300
ETag: "abc123def456"
X-Feed-Items: 42
X-Cache-Status: HIT
```

### 4. Analytics Tracking
- Request timestamps
- Cache hit/miss tracking
- Generation time measurement
- Response size tracking
- Timeline bucketing (5-minute intervals)

## Usage Examples

### Basic Feed Request
```bash
curl https://example.com/feed.ansybl
```

### Filtered Feed
```bash
curl "https://example.com/api/feed/custom?tags=tech&limit=10"
```

### Subscribe to Feed
```bash
curl -X POST https://example.com/api/feed-discovery/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "feedUrl": "https://example.com/feed.ansybl",
    "subscriber": {
      "name": "John Doe",
      "email": "john@example.com",
      "callbackUrl": "https://subscriber.com/callback"
    }
  }'
```

### Create Personalized Feed
```bash
curl -X POST https://example.com/api/feed/personalize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "preferences": {
      "tags": ["technology"],
      "limit": 20
    }
  }'
```

### Save Feed View
```bash
curl -X POST https://example.com/api/feed/views \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "name": "My Tech Feed",
    "description": "Technology posts I follow",
    "filters": {
      "tags": ["technology", "programming"],
      "limit": 50
    }
  }'
```

### Get Cache Statistics
```bash
curl https://example.com/api/feed/cache/stats
```

### Get Feed Analytics
```bash
curl "https://example.com/api/feed/analytics?range=3600000&detailed=true"
```

## Monitoring and Debugging

### Cache Statistics
```json
{
  "hits": 150,
  "misses": 50,
  "invalidations": 10,
  "compressionSavings": 524288,
  "totalRequests": 200,
  "hitRate": "75.00%",
  "cacheSize": 15,
  "maxSize": 100,
  "totalCachedBytes": 1048576,
  "totalOriginalBytes": 4194304,
  "compressionRatio": "75.00%"
}
```

### Feed Analytics Summary
```json
{
  "totalRequests": 200,
  "cacheHits": 150,
  "cacheMisses": 50,
  "hitRate": "75.00%",
  "avgGenerationTime": "45ms",
  "avgResponseSize": "128KB",
  "timeRange": 3600000,
  "requestsPerMinute": 3
}
```

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T12:00:00Z",
  "checks": {
    "feedGeneration": {
      "status": "pass",
      "responseTime": "42ms"
    },
    "cache": {
      "status": "pass",
      "stats": { ... }
    },
    "content": {
      "status": "pass",
      "posts": 3,
      "comments": 0,
      "totalItems": 3
    }
  }
}
```

## Integration with Server

The feed serving features are integrated into the main server via:

```javascript
import feedRouter from './api/feed.js';
import feedDiscoveryRouter from './api/feedDiscovery.js';

app.use('/api/feed', feedRouter);
app.use('/api/feed-discovery', feedDiscoveryRouter);
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 6.1**: Feed served at /feed.ansybl endpoint ✓
- **Requirement 6.2**: Complete feed with all posts and comments ✓
- **Requirement 6.3**: Appropriate HTTP headers including Content-Type and CORS ✓
- **Requirement 6.4**: Feed-level metadata with author information ✓
- **Requirement 6.5**: All URLs use HTTPS protocol ✓

## Future Enhancements

Potential improvements for future iterations:

1. **WebSub (PubSubHubbub)** support for real-time updates
2. **Feed pagination** with cursor-based navigation
3. **Conditional requests** with If-None-Match support
4. **Feed versioning** to track changes over time
5. **Advanced analytics** with user behavior tracking
6. **Machine learning** recommendations
7. **A/B testing** for feed algorithms
8. **Rate limiting** per subscriber
9. **Webhook delivery** for subscriptions
10. **Feed aggregation** from multiple sources

## Testing

To test the feed serving features:

1. Start the server: `npm start`
2. Access the main feed: `http://localhost:3000/feed.ansybl`
3. Check cache stats: `http://localhost:3000/api/feed/cache/stats`
4. View analytics: `http://localhost:3000/api/feed/analytics`
5. Test health check: `http://localhost:3000/api/feed/health`
6. Try filtered feed: `http://localhost:3000/api/feed/custom?tags=ansybl&limit=5`

## Conclusion

The feed serving and syndication implementation provides a complete, production-ready system for serving Ansybl feeds with caching, discovery, subscription management, and customization features. The system is optimized for performance with intelligent caching and compression, while providing comprehensive monitoring and analytics capabilities.
