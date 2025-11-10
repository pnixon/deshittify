# Ansybl Protocol Best Practices

This guide covers recommended patterns, practices, and design decisions for implementing and using the Ansybl protocol.

## Table of Contents

1. [Content Creation](#content-creation)
2. [Security](#security)
3. [Performance](#performance)
4. [Data Management](#data-management)
5. [Error Handling](#error-handling)
6. [Testing](#testing)
7. [Deployment](#deployment)

## Content Creation

### Provide Multiple Content Formats

Always provide content in multiple formats when possible:

```javascript
const post = {
  content_text: 'Hello, **Ansybl**!',
  content_markdown: 'Hello, **Ansybl**!',
  content_html: '<p>Hello, <strong>Ansybl</strong>!</p>'
};
```

**Why?** Different clients may prefer different formats. Text is universal, HTML is rich, Markdown is editable.

### Write Meaningful Summaries

Provide concise summaries for better discovery:

```javascript
const post = {
  title: 'Understanding Decentralized Social Media',
  summary: 'An exploration of how decentralized protocols like Ansybl enable user-controlled social networking.',
  content_text: '...' // Full content
};
```

**Best Length:** 150-200 characters

### Use Descriptive Titles

Make titles clear and descriptive:

```javascript
// ✅ Good
title: 'How to Implement Ansybl Protocol in Node.js'

// ❌ Avoid
title: 'Tutorial'
```

### Tag Appropriately

Use relevant, normalized tags:

```javascript
// ✅ Good
tags: ['ansybl', 'protocol', 'decentralization', 'tutorial']

// ❌ Avoid
tags: ['ANSYBL', 'Protocol!!!', 'ansybl-protocol-tutorial-guide']
```

**Guidelines:**
- Use lowercase
- Use hyphens for multi-word tags
- Keep tags focused and relevant
- Limit to 5-10 tags per post

### Optimize Media

Compress and optimize media before upload:

```javascript
// Resize large images
if (image.width > 1920) {
  image = await sharp(image)
    .resize(1920, null, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
```

**Guidelines:**
- Images: Max 1920px width, 85% JPEG quality
- Videos: H.264 codec, max 1080p
- Audio: MP3 or OGG, 128-192 kbps
- Keep files under 10MB

### Add Alt Text

Always provide alt text for accessibility:

```javascript
const attachment = {
  url: 'https://example.com/image.jpg',
  mime_type: 'image/jpeg',
  alt_text: 'A sunset over mountains with orange and purple sky'
};
```

## Security

### Always Use HTTPS

All URLs must use HTTPS protocol:

```javascript
// ✅ Correct
home_page_url: 'https://example.com'

// ❌ Wrong
home_page_url: 'http://example.com'
```

### Verify Signatures

Always verify signatures for external content:

```javascript
const result = await parser.parse(externalFeed, {
  verifySignatures: true,
  requireSignatures: true
});

if (!result.verification.feedSignatureValid) {
  throw new Error('Invalid signature - content may be tampered');
}
```

### Sanitize HTML Content

Always sanitize HTML to prevent XSS:

```javascript
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title']
});
```

### Validate User Input

Validate all user input before processing:

```javascript
function validatePost(data) {
  if (!data.title || data.title.length > 200) {
    throw new Error('Title must be 1-200 characters');
  }
  
  if (!data.content_text && !data.content_markdown) {
    throw new Error('Content is required');
  }
  
  if (data.tags && data.tags.length > 10) {
    throw new Error('Maximum 10 tags allowed');
  }
}
```

### Secure Key Storage

Never expose private keys:

```javascript
// ✅ Good - Store securely
const privateKey = process.env.ANSYBL_PRIVATE_KEY;

// ❌ Never do this
const privateKey = 'abc123...'; // Hardcoded in source
```

**Best Practices:**
- Use environment variables
- Encrypt keys at rest
- Use key management services (AWS KMS, HashiCorp Vault)
- Rotate keys periodically

### Rate Limiting

Implement rate limiting to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

## Performance

### Cache Feed Generation

Cache generated feeds to reduce computation:

```javascript
class FeedCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }
}

const feedCache = new FeedCache();

app.get('/feed.ansybl', async (req, res) => {
  let feed = feedCache.get('main-feed');
  
  if (!feed) {
    feed = await generateAnsyblFeed();
    feedCache.set('main-feed', feed);
  }
  
  res.json(feed);
});
```

### Use Pagination

Paginate large result sets:

```javascript
app.get('/api/posts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  
  const paginatedPosts = posts.slice(offset, offset + limit);
  
  res.json({
    posts: paginatedPosts,
    pagination: {
      total: posts.length,
      limit,
      offset,
      hasMore: offset + limit < posts.length
    }
  });
});
```

### Optimize Database Queries

Index frequently queried fields:

```javascript
// Example with MongoDB
await db.collection('posts').createIndex({ datePublished: -1 });
await db.collection('posts').createIndex({ tags: 1 });
await db.collection('posts').createIndex({ 'author.name': 1 });
```

### Compress Responses

Enable gzip compression:

```javascript
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));
```

### Lazy Load Media

Load media on demand:

```javascript
// Generate BlurHash for progressive loading
const blurhash = await generateBlurhash(image);

const attachment = {
  url: imageUrl,
  blurhash: blurhash,
  thumbnail_url: thumbnailUrl
};

// Client-side: Show blurhash while loading full image
```

## Data Management

### Use UUIDs for Content

Generate unique identifiers:

```javascript
import { randomUUID } from 'crypto';

const post = {
  id: `https://example.com/post/${Date.now()}`,
  uuid: randomUUID(), // e.g., 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  // ...
};
```

### Implement Soft Deletes

Mark content as deleted instead of removing:

```javascript
function deletePost(postId) {
  const post = posts.find(p => p.id === postId);
  if (post) {
    post._deleted = true;
    post._deletedAt = new Date().toISOString();
  }
}

// Filter deleted posts from feeds
const activePosts = posts.filter(p => !p._deleted);
```

### Version Content

Track content changes:

```javascript
function updatePost(postId, updates) {
  const post = posts.find(p => p.id === postId);
  if (post) {
    // Save version history
    if (!post._history) post._history = [];
    post._history.push({
      version: post._history.length + 1,
      timestamp: new Date().toISOString(),
      content: { ...post }
    });
    
    // Apply updates
    Object.assign(post, updates);
    post.date_modified = new Date().toISOString();
  }
}
```

### Backup Regularly

Implement automated backups:

```javascript
import { writeFile } from 'fs/promises';

async function backupData() {
  const backup = {
    timestamp: new Date().toISOString(),
    posts: posts,
    comments: comments,
    interactions: interactions
  };
  
  const filename = `backup-${Date.now()}.json`;
  await writeFile(`./backups/${filename}`, JSON.stringify(backup, null, 2));
  
  console.log(`Backup created: ${filename}`);
}

// Run daily backups
setInterval(backupData, 24 * 60 * 60 * 1000);
```


## Error Handling

### Use Consistent Error Format

Return errors in a consistent structure:

```javascript
function createError(code, message, details = {}) {
  return {
    success: false,
    error: code,
    message: message,
    details: details,
    timestamp: new Date().toISOString()
  };
}

app.post('/api/posts', async (req, res) => {
  try {
    // Process request
  } catch (error) {
    res.status(500).json(
      createError('POST_CREATION_FAILED', error.message, {
        requestId: req.id
      })
    );
  }
});
```

### Validate Early

Validate input at the API boundary:

```javascript
app.post('/api/posts', async (req, res) => {
  // Validate first
  const errors = validatePostInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors
    });
  }
  
  // Then process
  const post = await createPost(req.body);
  res.status(201).json({ success: true, post });
});
```

### Log Errors Appropriately

Log errors with context:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

app.post('/api/posts', async (req, res) => {
  try {
    const post = await createPost(req.body);
    logger.info('Post created', { postId: post.id, userId: req.user?.id });
    res.status(201).json({ success: true, post });
  } catch (error) {
    logger.error('Post creation failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestBody: req.body
    });
    res.status(500).json(createError('POST_CREATION_FAILED', error.message));
  }
});
```

### Handle Async Errors

Use try-catch for async operations:

```javascript
// ✅ Good
async function processPost(postId) {
  try {
    const post = await fetchPost(postId);
    const validated = await validatePost(post);
    return validated;
  } catch (error) {
    console.error('Post processing failed:', error);
    throw error;
  }
}

// ❌ Avoid - unhandled promise rejection
async function processPost(postId) {
  const post = await fetchPost(postId); // May throw
  return validatePost(post); // May throw
}
```

### Provide Helpful Error Messages

Make errors actionable:

```javascript
// ✅ Good
throw new Error('Title must be between 1 and 200 characters. Current length: 250');

// ❌ Avoid
throw new Error('Invalid title');
```

## Testing

### Write Unit Tests

Test individual components:

```javascript
import { describe, it, expect } from 'vitest';

describe('AnsyblGenerator', () => {
  it('should create valid feed structure', async () => {
    const generator = new AnsyblGenerator();
    const feed = await generator.createCompleteFeed(metadata, items, privateKey);
    
    expect(feed.version).toBe('https://ansybl.org/version/1.0');
    expect(feed.title).toBe(metadata.title);
    expect(feed.items).toHaveLength(items.length);
    expect(feed.signature).toBeDefined();
  });

  it('should handle missing optional fields', async () => {
    const generator = new AnsyblGenerator();
    const minimalMetadata = {
      title: 'Test',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl'
    };
    
    const feed = await generator.createCompleteFeed(minimalMetadata, [], null);
    expect(feed.icon).toBeUndefined();
    expect(feed.language).toBeUndefined();
  });
});
```

### Write Integration Tests

Test complete workflows:

```javascript
describe('Post Creation Workflow', () => {
  it('should create, validate, and retrieve post', async () => {
    // Create post
    const response = await request(app)
      .post('/api/posts')
      .send({
        title: 'Test Post',
        content_text: 'Test content'
      });
    
    expect(response.status).toBe(201);
    const postId = response.body.post.id;
    
    // Validate feed includes post
    const feedResponse = await request(app).get('/feed.ansybl');
    expect(feedResponse.status).toBe(200);
    
    const feed = feedResponse.body;
    const post = feed.items.find(item => item.id.includes(postId));
    expect(post).toBeDefined();
    expect(post.title).toBe('Test Post');
  });
});
```

### Test Error Cases

Test failure scenarios:

```javascript
describe('Error Handling', () => {
  it('should reject invalid feed', async () => {
    const invalidFeed = {
      version: 'https://ansybl.org/version/1.0',
      // Missing required fields
    };
    
    const response = await request(app)
      .post('/api/validate')
      .send(invalidFeed);
    
    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('should handle signature verification failure', async () => {
    const feed = { ...validFeed };
    feed.signature = 'invalid_signature';
    
    const result = await parser.parse(feed, { verifySignatures: true });
    expect(result.verification.feedSignatureValid).toBe(false);
  });
});
```

### Use Test Fixtures

Create reusable test data:

```javascript
// test/fixtures/feeds.js
export const validFeed = {
  version: 'https://ansybl.org/version/1.0',
  title: 'Test Feed',
  home_page_url: 'https://example.com',
  feed_url: 'https://example.com/feed.ansybl',
  items: []
};

export const validPost = {
  id: 'https://example.com/post/1',
  title: 'Test Post',
  content_text: 'Test content',
  date_published: '2025-11-09T10:00:00Z'
};

// Use in tests
import { validFeed, validPost } from './fixtures/feeds.js';

it('should validate fixture feed', () => {
  const result = validator.validateDocument(validFeed);
  expect(result.valid).toBe(true);
});
```

### Mock External Dependencies

Mock external services:

```javascript
import { vi } from 'vitest';

describe('Feed Discovery', () => {
  it('should discover feeds from URL', async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<link rel="alternate" type="application/json" href="/feed.ansybl">')
      })
    );

    const feeds = await discoverFeeds('https://example.com');
    expect(feeds).toHaveLength(1);
    expect(feeds[0].type).toBe('ansybl');
  });
});
```

## Deployment

### Use Environment Variables

Configure via environment:

```javascript
// config.js
export const config = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  privateKey: process.env.ANSYBL_PRIVATE_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required variables
if (!config.privateKey && config.nodeEnv === 'production') {
  throw new Error('ANSYBL_PRIVATE_KEY is required in production');
}
```

### Implement Health Checks

Add health check endpoint:

```javascript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };
  
  res.json(health);
});
```

### Enable Monitoring

Monitor application metrics:

```javascript
import prometheus from 'prom-client';

const register = new prometheus.Registry();

// Collect default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Use Process Managers

Run with PM2 or similar:

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ansybl-server',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### Implement Graceful Shutdown

Handle shutdown signals:

```javascript
const server = app.listen(PORT);

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections
    // Close other resources
    
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});
```

### Use HTTPS in Production

Always use HTTPS:

```javascript
import https from 'https';
import { readFileSync } from 'fs';

if (process.env.NODE_ENV === 'production') {
  const options = {
    key: readFileSync(process.env.SSL_KEY_PATH),
    cert: readFileSync(process.env.SSL_CERT_PATH)
  };
  
  https.createServer(options, app).listen(443);
} else {
  app.listen(3000);
}
```

## Summary

Following these best practices will help you:

- Create high-quality, accessible content
- Build secure, performant applications
- Handle errors gracefully
- Test thoroughly
- Deploy reliably

For more information:

- **[Getting Started Guide](./GETTING_STARTED.md)**
- **[Protocol Implementation](./PROTOCOL_IMPLEMENTATION.md)**
- **[API Documentation](./API_DOCUMENTATION.md)**
- **[Security Guide](./SECURITY.md)**

Happy building! 🚀
