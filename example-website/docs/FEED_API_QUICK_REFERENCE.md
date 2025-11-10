# Feed API Quick Reference

Quick reference guide for the Ansybl feed serving and syndication API.

## Main Feed Endpoints

### Get Ansybl Feed
```
GET /feed.ansybl
GET /api/feed.ansybl
```

**Query Parameters:**
- `tags` - Filter by tags (comma-separated)
- `author` - Filter by author name
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Maximum items

**Response Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: public, max-age=300`
- `ETag: "hash"`
- `X-Feed-Items: count`
- `X-Cache-Status: HIT|MISS`

### Get Feed Info
```
GET /api/feed/info
```

**Response:**
```json
{
  "title": "Site Title",
  "description": "Site Description",
  "author": { ... },
  "feedUrl": "https://example.com/feed.ansybl",
  "itemCount": 42,
  "postCount": 40,
  "commentCount": 2,
  "lastUpdated": "2025-11-09T12:00:00Z",
  "cacheStatus": { ... }
}
```

### Health Check
```
GET /api/feed/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T12:00:00Z",
  "checks": {
    "feedGeneration": { "status": "pass", "responseTime": "42ms" },
    "cache": { "status": "pass", "stats": { ... } },
    "content": { "status": "pass", "posts": 3, "comments": 0 }
  }
}
```

## Caching

### Get Cache Stats
```
GET /api/feed/cache/stats
```

**Response:**
```json
{
  "hits": 150,
  "misses": 50,
  "invalidations": 10,
  "totalRequests": 200,
  "hitRate": "75.00%",
  "cacheSize": 15,
  "compressionRatio": "75.00%"
}
```

### Invalidate Cache
```
POST /api/feed/cache/invalidate
Content-Type: application/json

{
  "pattern": "optional-pattern"
}
```

## Analytics

### Get Analytics
```
GET /api/feed/analytics?range=3600000&detailed=true
```

**Parameters:**
- `range` - Time range in milliseconds (default: 3600000 = 1 hour)
- `detailed` - Include timeline breakdown (default: false)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "summary": {
      "totalRequests": 200,
      "cacheHits": 150,
      "cacheMisses": 50,
      "hitRate": "75.00%",
      "avgGenerationTime": "45ms",
      "avgResponseSize": "128KB"
    },
    "timeline": [ ... ]
  }
}
```

## Customization

### Custom Filtered Feed
```
GET /api/feed/custom?tags=tech,news&author=john&from=2025-01-01&limit=20
```

**Query Parameters:**
- `tags` - Comma-separated tags
- `author` - Author name (partial match)
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Maximum items
- `type` - Content type (posts, comments, all)

### Personalized Feed
```
POST /api/feed/personalize
Content-Type: application/json

{
  "userId": "user-123",
  "preferences": {
    "tags": ["technology", "science"],
    "authors": ["John Doe"],
    "contentTypes": ["posts"],
    "dateRange": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-12-31T23:59:59Z"
    },
    "limit": 50
  }
}
```

### Saved Views

#### Create View
```
POST /api/feed/views
Content-Type: application/json

{
  "userId": "user-123",
  "name": "My Tech Feed",
  "description": "Technology posts",
  "filters": {
    "tags": ["technology"],
    "limit": 50
  }
}
```

#### Get User Views
```
GET /api/feed/views/:userId
```

#### Get Feed with View
```
GET /api/feed/views/:viewId/feed
```

#### Delete View
```
DELETE /api/feed/views/:viewId
```

### Presets

#### Get Available Presets
```
GET /api/feed/presets
```

**Response:**
```json
{
  "success": true,
  "presets": [
    {
      "id": "recent",
      "name": "Recent Posts",
      "description": "Latest posts from the last 7 days"
    },
    {
      "id": "popular",
      "name": "Popular Content",
      "description": "Most liked and shared posts"
    },
    {
      "id": "media",
      "name": "Media Posts",
      "description": "Posts with images, videos, or audio"
    },
    {
      "id": "discussions",
      "name": "Active Discussions",
      "description": "Posts with the most comments"
    }
  ]
}
```

#### Apply Preset
```
GET /api/feed/presets/:presetId/feed
```

## Export and Backup

### Export Feed
```
GET /api/feed/export?format=json
GET /api/feed/export?format=pretty
```

**Formats:**
- `json` - Compact JSON
- `pretty` - Pretty-printed JSON

### Create Backup
```
POST /api/feed/backup
```

**Response:** Downloads backup file with timestamp

## Discovery

### WebFinger
```
GET /.well-known/webfinger?resource=acct:user@domain
GET /.well-known/webfinger?resource=https://example.com/user
```

### Host-meta
```
GET /.well-known/host-meta
```

### Discover Feeds
```
GET /api/feed-discovery/discover?url=https://example.com
```

### Get Autodiscovery Links
```
GET /api/feed-discovery/feed-links
```

**Response:**
```json
{
  "success": true,
  "links": [ ... ],
  "html": "<link rel=\"alternate\" ...>",
  "headers": "<https://...>; rel=\"alternate\""
}
```

## Subscriptions

### Subscribe
```
POST /api/feed-discovery/subscribe
Content-Type: application/json

{
  "feedUrl": "https://example.com/feed.ansybl",
  "subscriber": {
    "name": "John Doe",
    "email": "john@example.com",
    "callbackUrl": "https://subscriber.com/callback"
  }
}
```

### Unsubscribe
```
DELETE /api/feed-discovery/subscribe/:subscriptionId
```

### Get Subscription
```
GET /api/feed-discovery/subscribe/:subscriptionId
```

### Get User Subscriptions
```
GET /api/feed-discovery/subscriptions/:subscriberId
```

### Get Subscription Stats
```
GET /api/feed-discovery/subscriptions/stats
```

### Update Subscription Status
```
PATCH /api/feed-discovery/subscribe/:subscriptionId
Content-Type: application/json

{
  "status": "active|paused|suspended"
}
```

## Health Monitoring

### Register Feed
```
POST /api/feed-discovery/health/register
Content-Type: application/json

{
  "feedUrl": "https://example.com/feed.ansybl",
  "options": {
    "checkInterval": 300000,
    "alertThreshold": 3
  }
}
```

### Check Feed Health
```
POST /api/feed-discovery/health/check
Content-Type: application/json

{
  "feedUrl": "https://example.com/feed.ansybl"
}
```

### Get Feed Health
```
GET /api/feed-discovery/health/:feedUrl
```

### Get All Monitored Feeds
```
GET /api/feed-discovery/health
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limiting

All `/api/*` endpoints are rate limited:
- **Window**: 15 minutes
- **Max Requests**: 100 per IP

**Rate Limit Headers:**
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 95`
- `X-RateLimit-Reset: 1699545600`

## CORS

All feed endpoints support CORS:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, DELETE, PATCH`
- `Access-Control-Allow-Headers: Content-Type`

## Examples

### cURL Examples

```bash
# Get main feed
curl https://example.com/feed.ansybl

# Get filtered feed
curl "https://example.com/api/feed/custom?tags=tech&limit=10"

# Subscribe to feed
curl -X POST https://example.com/api/feed-discovery/subscribe \
  -H "Content-Type: application/json" \
  -d '{"feedUrl":"https://example.com/feed.ansybl","subscriber":{"name":"John"}}'

# Get cache stats
curl https://example.com/api/feed/cache/stats

# Get analytics
curl "https://example.com/api/feed/analytics?range=3600000"

# Create personalized feed
curl -X POST https://example.com/api/feed/personalize \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","preferences":{"tags":["tech"],"limit":20}}'

# Save feed view
curl -X POST https://example.com/api/feed/views \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","name":"Tech Feed","filters":{"tags":["tech"]}}'

# Export feed
curl https://example.com/api/feed/export?format=pretty -o feed.json

# Check health
curl https://example.com/api/feed/health
```

### JavaScript Examples

```javascript
// Get main feed
const feed = await fetch('https://example.com/feed.ansybl')
  .then(r => r.json());

// Subscribe to feed
const subscription = await fetch('https://example.com/api/feed-discovery/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    feedUrl: 'https://example.com/feed.ansybl',
    subscriber: { name: 'John Doe', email: 'john@example.com' }
  })
}).then(r => r.json());

// Get personalized feed
const personalFeed = await fetch('https://example.com/api/feed/personalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    preferences: {
      tags: ['technology'],
      limit: 20
    }
  })
}).then(r => r.json());

// Get cache stats
const stats = await fetch('https://example.com/api/feed/cache/stats')
  .then(r => r.json());
```

## Support

For more detailed documentation, see:
- `FEED_SERVING_IMPLEMENTATION.md` - Complete implementation guide
- `FEED_SERVING_SUMMARY.md` - Implementation summary
- Main README.md - Project overview
