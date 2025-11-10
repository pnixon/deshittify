# Ansybl Protocol API Documentation

Complete API reference for the Ansybl social syndication protocol implementation.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [Validation API](#validation-api)
6. [Parsing API](#parsing-api)
7. [Content Management API](#content-management-api)
8. [Interactions API](#interactions-api)
9. [Media API](#media-api)
10. [Feed API](#feed-api)
11. [Search API](#search-api)
12. [Tags API](#tags-api)
13. [Metadata API](#metadata-api)
14. [Bridge APIs](#bridge-apis)
15. [Discovery API](#discovery-api)

## Overview

The Ansybl Protocol API provides comprehensive endpoints for creating, managing, and consuming decentralized social content. All endpoints return JSON responses unless otherwise specified.

**Base URL:** `http://localhost:3000` (development) or `https://example.com` (production)

**API Version:** 1.0.0

## Authentication

Most endpoints are publicly accessible. Protected endpoints require authentication headers:

```http
Authorization: Bearer <token>
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Limit:** 100 requests per 15 minutes per IP address
- **Headers:** Rate limit information is included in response headers
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Error Handling

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Document failed schema validation |
| `PARSE_ERROR` | Failed to parse document |
| `NOT_FOUND` | Resource not found |
| `INVALID_REQUEST` | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SIGNATURE_VERIFICATION_FAILED` | Cryptographic signature invalid |


## Validation API

### Validate Document

Validates an Ansybl document against the JSON schema.

**Endpoint:** `POST /api/validate`

**Query Parameters:**
- `warnings` (boolean, default: true) - Include validation warnings
- `strict` (boolean, default: false) - Enable strict validation mode
- `extensions` (boolean, default: true) - Validate extension fields

**Request Body:**
```json
{
  "version": "https://ansybl.org/version/1.0",
  "title": "My Feed",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "items": []
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "performance": {
    "processingTimeMs": 15,
    "documentSize": 1024,
    "itemCount": 5
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d @feed.json
```

### Batch Validate

Validates multiple documents in a single request (max 100).

**Endpoint:** `POST /api/validate/batch`

**Request Body:**
```json
{
  "documents": [
    { "version": "...", "title": "Feed 1", ... },
    { "version": "...", "title": "Feed 2", ... }
  ],
  "options": {
    "includeWarnings": true,
    "strictMode": false,
    "validateExtensions": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "valid": 2,
    "invalid": 0,
    "totalErrors": 0,
    "processingTimeMs": 45
  },
  "results": [
    { "index": 0, "valid": true, "errors": [], "warnings": [] },
    { "index": 1, "valid": true, "errors": [], "warnings": [] }
  ]
}
```

### Custom Schema Validation

Validates with custom schema extensions.

**Endpoint:** `POST /api/validate/custom`

**Request Body:**
```json
{
  "document": { ... },
  "customSchema": { ... },
  "options": {
    "includeWarnings": true,
    "strictMode": false
  }
}
```


## Parsing API

### Parse Document

Parses an Ansybl document with optional signature verification.

**Endpoint:** `POST /api/parse`

**Query Parameters:**
- `verify` (boolean, default: false) - Verify cryptographic signatures
- `extensions` (boolean, default: true) - Preserve extension fields
- `strict` (boolean, default: false) - Enable strict parsing mode
- `metadata` (boolean, default: false) - Parse metadata only
- `content` (boolean, default: false) - Parse content only
- `performance` (boolean, default: true) - Include performance metrics

**Request Body:**
```json
{
  "version": "https://ansybl.org/version/1.0",
  "title": "My Feed",
  "items": [...],
  "signature": "base64_signature"
}
```

**Response:**
```json
{
  "success": true,
  "feed": { ... },
  "verification": {
    "feedSignatureValid": true,
    "itemSignaturesValid": true,
    "invalidItems": []
  },
  "performance": {
    "processingTimeMs": 25,
    "documentSize": 2048
  }
}
```

**Example with Signature Verification:**
```bash
curl -X POST "http://localhost:3000/api/parse?verify=true" \
  -H "Content-Type: application/json" \
  -d @signed-feed.json
```

### Parse with Verification Level

Parses with specific verification strictness.

**Endpoint:** `POST /api/parse/verify/{level}`

**Path Parameters:**
- `level` - Verification level: `strict`, `relaxed`, or `optional`

**Verification Levels:**
- **strict**: All signatures must be valid, fails on any invalid signature
- **relaxed**: Validates signatures but continues on errors
- **optional**: Signature verification is informational only

**Example:**
```bash
curl -X POST http://localhost:3000/api/parse/verify/strict \
  -H "Content-Type: application/json" \
  -d @feed.json
```

### Parse Content by Type

Extracts specific content formats.

**Endpoint:** `POST /api/parse/content/{type}`

**Path Parameters:**
- `type` - Content type: `text`, `html`, `markdown`, or `all`

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "...",
      "content_text": "Plain text content",
      "content_html": "<p>HTML content</p>",
      "content_markdown": "# Markdown content"
    }
  ],
  "contentType": "all"
}
```


## Content Management API

### Create Post

Creates a new post with optional media attachments.

**Endpoint:** `POST /api/posts`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `title` (required) - Post title
- `content_text` - Plain text content
- `content_markdown` - Markdown content
- `summary` - Post summary
- `tags` - Comma-separated tags
- `author` - JSON-encoded author object
- `attachments` - Media files (max 5, 10MB each)

**Example:**
```bash
curl -X POST http://localhost:3000/api/posts \
  -F "title=My First Post" \
  -F "content_markdown=# Hello World\n\nThis is my first post!" \
  -F "tags=welcome,first-post" \
  -F "attachments=@image.jpg"
```

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "post-1234567890",
    "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "title": "My First Post",
    "content_markdown": "# Hello World...",
    "content_html": "<h1>Hello World</h1>...",
    "datePublished": "2025-11-09T10:00:00Z",
    "tags": ["welcome", "first-post"],
    "attachments": [...]
  },
  "message": "Post created successfully"
}
```

### Get Comments

Retrieves all comments for a specific post.

**Endpoint:** `GET /api/posts/{postId}/comments`

**Response:**
```json
[
  {
    "id": "comment-1",
    "postId": "post-1",
    "author": {
      "name": "John Doe",
      "url": "https://example.com/john",
      "avatar": "https://example.com/avatar.jpg"
    },
    "content": "Great post!",
    "contentHtml": "<p>Great post!</p>",
    "datePublished": "2025-11-09T11:00:00Z",
    "inReplyTo": "https://example.com/post/post-1"
  }
]
```

### Add Comment

Creates a new comment on a post.

**Endpoint:** `POST /api/posts/{postId}/comments`

**Request Body:**
```json
{
  "author": {
    "name": "John Doe",
    "url": "https://example.com/john",
    "avatar": "https://example.com/avatar.jpg"
  },
  "content": "This is a great post! Thanks for sharing."
}
```

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": "comment-2",
    "postId": "post-1",
    "author": { ... },
    "content": "This is a great post!",
    "datePublished": "2025-11-09T12:00:00Z"
  },
  "message": "Comment added successfully"
}
```


## Interactions API

### Like Post

Toggles like status for a post (like/unlike).

**Endpoint:** `POST /api/posts/{postId}/like`

**Request Body:**
```json
{
  "userId": "user-123",
  "userName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "action": "liked",
  "likesCount": 5
}
```

### Share Post

Creates a share record for a post.

**Endpoint:** `POST /api/posts/{postId}/share`

**Request Body:**
```json
{
  "userId": "user-123",
  "userName": "John Doe",
  "message": "Check out this amazing post!"
}
```

**Response:**
```json
{
  "success": true,
  "shareId": "share-456",
  "sharesCount": 3
}
```

### Get Interactions

Retrieves all interactions for a post.

**Endpoint:** `GET /api/posts/{postId}/interactions`

**Response:**
```json
{
  "postId": "post-1",
  "likes": [
    {
      "userId": "user-123",
      "userName": "John Doe",
      "timestamp": "2025-11-09T10:30:00Z"
    }
  ],
  "shares": [
    {
      "id": "share-456",
      "userId": "user-789",
      "userName": "Jane Smith",
      "message": "Great content!",
      "timestamp": "2025-11-09T11:00:00Z"
    }
  ],
  "replies": [],
  "counts": {
    "likes": 1,
    "shares": 1,
    "replies": 0
  }
}
```

### Get Interaction Analytics

Retrieves comprehensive interaction analytics.

**Endpoint:** `GET /api/interactions/analytics`

**Query Parameters:**
- `period` - Time period: `daily`, `weekly`, `monthly`
- `limit` - Number of data points (default: 30)

**Response:**
```json
{
  "summary": {
    "totalLikes": 150,
    "totalShares": 45,
    "totalComments": 78,
    "period": "daily"
  },
  "timeline": [
    {
      "date": "2025-11-09",
      "likes": 12,
      "shares": 5,
      "comments": 8
    }
  ],
  "topPosts": [
    {
      "postId": "post-1",
      "title": "Popular Post",
      "totalInteractions": 45
    }
  ]
}
```


## Media API

### Upload Media

Uploads and processes media files (images, videos, audio, PDFs).

**Endpoint:** `POST /api/media/upload`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `files` - Media files (max 5, 10MB each)
- `skipErrors` (boolean) - Continue processing if individual files fail

**Supported Formats:**
- **Images:** JPEG, PNG, GIF, WebP, AVIF
- **Videos:** MP4, WebM
- **Audio:** MP3, OGG, WAV
- **Documents:** PDF

**Example:**
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -F "files=@photo.jpg" \
  -F "files=@video.mp4"
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "url": "https://example.com/uploads/abc123.jpg",
      "mime_type": "image/jpeg",
      "title": "photo.jpg",
      "size_in_bytes": 245760,
      "width": 1920,
      "height": 1080,
      "thumbnail_url": "https://example.com/uploads/thumb_abc123.jpg",
      "blurhash": "L9AB8Sj[ayj["
    },
    {
      "url": "https://example.com/uploads/def456.mp4",
      "mime_type": "video/mp4",
      "title": "video.mp4",
      "size_in_bytes": 5242880,
      "width": 1920,
      "height": 1080,
      "duration_in_seconds": 30.5
    }
  ],
  "count": 2
}
```

**Image Processing:**
- Automatic thumbnail generation for images > 800x600
- BlurHash generation for progressive loading
- Image optimization and compression
- Metadata extraction (dimensions, format)

**Video Processing:**
- Metadata extraction (duration, dimensions, codec)
- Thumbnail generation (first frame)
- Format validation

**Audio Processing:**
- Metadata extraction (duration, bitrate, format)
- ID3 tag parsing (if available)

## Feed API

### Get Ansybl Feed

Returns the complete Ansybl feed with all posts and comments.

**Endpoint:** `GET /feed.ansybl`

**Response Headers:**
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *`

**Response:**
```json
{
  "version": "https://ansybl.org/version/1.0",
  "title": "Ansybl Example Site",
  "description": "A demonstration of the Ansybl protocol",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "icon": "https://example.com/favicon.ico",
  "language": "en",
  "author": {
    "name": "Demo Author",
    "url": "https://example.com/author",
    "avatar": "https://example.com/avatar.jpg",
    "public_key": "ed25519_public_key_base64"
  },
  "items": [...],
  "signature": "feed_signature_base64"
}
```

### Get Feed Info

Returns feed metadata and statistics.

**Endpoint:** `GET /api/feed/info`

**Response:**
```json
{
  "title": "Ansybl Example Site",
  "description": "A demonstration of the Ansybl protocol",
  "author": { ... },
  "feedUrl": "https://example.com/feed.ansybl",
  "itemCount": 25,
  "lastUpdated": "2025-11-09T12:00:00Z"
}
```


## Search API

### Search Content

Advanced content search with filtering, sorting, and pagination.

**Endpoint:** `POST /api/search`

**Request Body:**
```json
{
  "query": "decentralized social media",
  "tags": ["ansybl", "decentralization"],
  "author": "John Doe",
  "dateFrom": "2025-11-01T00:00:00Z",
  "dateTo": "2025-11-09T23:59:59Z",
  "contentType": "posts",
  "sortBy": "date",
  "sortOrder": "desc",
  "limit": 50,
  "offset": 0
}
```

**Parameters:**
- `query` - Search query (searches title, content, summary)
- `tags` - Array of tags to filter by
- `author` - Filter by author name
- `dateFrom` - Start date (ISO 8601)
- `dateTo` - End date (ISO 8601)
- `contentType` - Filter by type: `all`, `posts`, `comments`, `media`
- `sortBy` - Sort field: `date`, `title`, `author`, `interactions`
- `sortOrder` - Sort order: `asc`, `desc`
- `limit` - Results per page (max 100, default 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "post-1",
      "type": "post",
      "title": "Decentralized Social Media",
      "content_text": "...",
      "datePublished": "2025-11-05T10:00:00Z",
      "tags": ["ansybl", "decentralization"],
      "author": { ... }
    }
  ],
  "total": 15,
  "offset": 0,
  "limit": 50,
  "hasMore": false,
  "query": { ... }
}
```

### Get Search Suggestions

Returns search suggestions based on query.

**Endpoint:** `GET /api/search/suggestions`

**Query Parameters:**
- `q` - Search query (min 2 characters)
- `type` - Suggestion type: `all`, `tags`, `authors`, `titles`

**Example:**
```bash
curl "http://localhost:3000/api/search/suggestions?q=dec&type=tags"
```

**Response:**
```json
{
  "suggestions": [
    "tag:decentralization",
    "tag:decentralized",
    "author:Demo Author",
    "title:Decentralized Social Media"
  ],
  "query": "dec"
}
```

## Tags API

### Get Trending Tags

Returns currently trending tags based on recent usage.

**Endpoint:** `GET /api/tags/trending`

**Query Parameters:**
- `limit` - Number of tags to return (default: 10)

**Response:**
```json
{
  "success": true,
  "tags": [
    {
      "tag": "ansybl",
      "count": 15,
      "trend": "rising",
      "recentUses": 8
    },
    {
      "tag": "decentralization",
      "count": 12,
      "trend": "stable",
      "recentUses": 5
    }
  ]
}
```

### Validate Tags

Validates and normalizes tags.

**Endpoint:** `POST /api/tags/validate`

**Request Body:**
```json
{
  "tags": ["Ansybl", "DECENTRALIZATION", "social-media"]
}
```

**Response:**
```json
{
  "success": true,
  "valid": ["ansybl", "decentralization", "social-media"],
  "invalid": [],
  "normalized": {
    "Ansybl": "ansybl",
    "DECENTRALIZATION": "decentralization"
  }
}
```

### Get Tag Statistics

Returns statistics for a specific tag.

**Endpoint:** `GET /api/tags/stats/{tag}`

**Response:**
```json
{
  "success": true,
  "tag": "ansybl",
  "stats": {
    "totalUses": 25,
    "postsCount": 20,
    "commentsCount": 5,
    "firstUsed": "2025-11-01T10:00:00Z",
    "lastUsed": "2025-11-09T12:00:00Z",
    "relatedTags": ["decentralization", "protocol", "social-media"]
  }
}
```


## Metadata API

### Generate Dublin Core Metadata

Generates Dublin Core metadata for content.

**Endpoint:** `POST /api/metadata/dublincore`

**Request Body:**
```json
{
  "content": {
    "title": "My Post",
    "author": "John Doe",
    "datePublished": "2025-11-09T10:00:00Z",
    "description": "Post description",
    "tags": ["ansybl", "metadata"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "dc:title": "My Post",
    "dc:creator": "John Doe",
    "dc:date": "2025-11-09",
    "dc:description": "Post description",
    "dc:subject": ["ansybl", "metadata"],
    "dc:format": "text/html",
    "dc:type": "Text"
  }
}
```

### Generate Schema.org Metadata

Generates Schema.org structured data.

**Endpoint:** `POST /api/metadata/schemaorg`

**Request Body:**
```json
{
  "content": { ... },
  "type": "BlogPosting"
}
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "My Post",
    "author": {
      "@type": "Person",
      "name": "John Doe"
    },
    "datePublished": "2025-11-09T10:00:00Z",
    "description": "Post description"
  }
}
```

### Get Post Metadata

Retrieves all metadata for a specific post.

**Endpoint:** `GET /api/metadata/posts/{postId}/metatags`

**Response:**
```json
{
  "success": true,
  "postId": "post-1",
  "metatags": {
    "og:title": "My Post",
    "og:description": "Post description",
    "og:type": "article",
    "og:url": "https://example.com/post/post-1",
    "twitter:card": "summary_large_image",
    "twitter:title": "My Post"
  }
}
```

## Bridge APIs

### RSS Bridge

Converts Ansybl feed to RSS 2.0 format.

**Endpoint:** `GET /feed.rss` or `GET /api/bridges/rss/feed.rss`

**Response:** RSS 2.0 XML document

**Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ansybl Example Site</title>
    <link>https://example.com</link>
    <description>A demonstration of the Ansybl protocol</description>
    <item>
      <title>Welcome to Ansybl</title>
      <link>https://example.com/post/post-1</link>
      <description>This is an example post...</description>
      <pubDate>Mon, 04 Nov 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

### JSON Feed Bridge

Converts Ansybl feed to JSON Feed 1.1 format.

**Endpoint:** `GET /feed.json` or `GET /api/bridges/jsonfeed/feed.json`

**Response:**
```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Ansybl Example Site",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.json",
  "items": [
    {
      "id": "https://example.com/post/post-1",
      "url": "https://example.com/post/post-1",
      "title": "Welcome to Ansybl",
      "content_html": "<p>This is an example post...</p>",
      "date_published": "2025-11-04T10:00:00Z"
    }
  ]
}
```

### ActivityPub Bridge

Provides ActivityPub actor and outbox endpoints.

**Actor Endpoint:** `GET /actor` or `GET /api/bridges/activitypub/actor`

**Response:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Person",
  "id": "https://example.com/actor",
  "name": "Demo Author",
  "preferredUsername": "demo",
  "inbox": "https://example.com/inbox",
  "outbox": "https://example.com/outbox",
  "publicKey": {
    "id": "https://example.com/actor#main-key",
    "owner": "https://example.com/actor",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

**Outbox Endpoint:** `GET /outbox` or `GET /api/bridges/activitypub/outbox`

**Response:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://example.com/outbox",
  "totalItems": 3,
  "orderedItems": [
    {
      "type": "Create",
      "actor": "https://example.com/actor",
      "object": {
        "type": "Note",
        "content": "This is an example post..."
      }
    }
  ]
}
```


## Discovery API

### WebFinger

Implements RFC 7033 WebFinger protocol for resource discovery.

**Endpoint:** `GET /.well-known/webfinger`

**Query Parameters:**
- `resource` - Resource identifier (e.g., `acct:user@example.com`)

**Example:**
```bash
curl "http://localhost:3000/.well-known/webfinger?resource=acct:demo@example.com"
```

**Response:**
```json
{
  "subject": "acct:demo@example.com",
  "aliases": [
    "https://example.com/author",
    "https://example.com/actor"
  ],
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://example.com/actor"
    },
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://example.com/author"
    },
    {
      "rel": "alternate",
      "type": "application/json",
      "href": "https://example.com/feed.ansybl"
    }
  ]
}
```

### Feed Discovery

Discovers Ansybl feeds from a URL.

**Endpoint:** `GET /api/discovery/discover`

**Query Parameters:**
- `url` - URL to discover feeds from

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "feeds": [
    {
      "type": "ansybl",
      "url": "https://example.com/feed.ansybl",
      "title": "Ansybl Example Site"
    },
    {
      "type": "rss",
      "url": "https://example.com/feed.rss",
      "title": "Ansybl Example Site"
    }
  ]
}
```

### Subscribe to Feed

Creates a subscription to a feed.

**Endpoint:** `POST /api/discovery/subscribe`

**Request Body:**
```json
{
  "feedUrl": "https://example.com/feed.ansybl",
  "subscriber": {
    "id": "user-123",
    "name": "John Doe",
    "callbackUrl": "https://subscriber.com/callback"
  }
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub-456",
    "feedUrl": "https://example.com/feed.ansybl",
    "subscriberId": "user-123",
    "status": "active",
    "createdAt": "2025-11-09T12:00:00Z"
  }
}
```

### Feed Health Check

Checks the health and validity of a feed.

**Endpoint:** `POST /api/discovery/health/check`

**Request Body:**
```json
{
  "feedUrl": "https://example.com/feed.ansybl"
}
```

**Response:**
```json
{
  "success": true,
  "feedUrl": "https://example.com/feed.ansybl",
  "health": {
    "status": "healthy",
    "accessible": true,
    "validFormat": true,
    "signatureValid": true,
    "lastChecked": "2025-11-09T12:00:00Z",
    "responseTime": 150,
    "itemCount": 25
  }
}
```

## Error Reference

### Validation Errors

| Code | Description | Solution |
|------|-------------|----------|
| `SCHEMA_VALIDATION_FAILED` | Document doesn't match schema | Check required fields and data types |
| `INVALID_URL_FORMAT` | URL is not properly formatted | Ensure URLs are valid HTTPS URLs |
| `MISSING_REQUIRED_FIELD` | Required field is missing | Add the required field to document |
| `INVALID_DATE_FORMAT` | Date is not ISO 8601 format | Use ISO 8601 date format |
| `EXTENSION_FIELD_INVALID` | Extension field doesn't start with _ | Prefix custom fields with underscore |

### Parsing Errors

| Code | Description | Solution |
|------|-------------|----------|
| `SIGNATURE_VERIFICATION_FAILED` | Signature is invalid | Check signature and public key |
| `MALFORMED_JSON` | JSON is not valid | Validate JSON syntax |
| `UNSUPPORTED_VERSION` | Ansybl version not supported | Use supported version |
| `MISSING_SIGNATURE` | Signature required but missing | Add signature to document |

### Content Errors

| Code | Description | Solution |
|------|-------------|----------|
| `POST_NOT_FOUND` | Post doesn't exist | Check post ID |
| `INVALID_CONTENT_FORMAT` | Content format is invalid | Use supported content formats |
| `ATTACHMENT_TOO_LARGE` | File exceeds size limit | Reduce file size to under 10MB |
| `UNSUPPORTED_MEDIA_TYPE` | Media type not supported | Use supported media formats |

### Rate Limiting Errors

| Code | Description | Solution |
|------|-------------|----------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait for rate limit to reset |
| `QUOTA_EXCEEDED` | API quota exceeded | Upgrade plan or wait for reset |

## Best Practices

### Performance

1. **Use Batch Operations**: When validating multiple documents, use `/api/validate/batch`
2. **Enable Caching**: Set appropriate cache headers for feed endpoints
3. **Pagination**: Always use pagination for large result sets
4. **Compression**: Enable gzip compression for API responses

### Security

1. **Verify Signatures**: Always verify signatures when consuming external feeds
2. **Validate Input**: Validate all user input before processing
3. **Use HTTPS**: Always use HTTPS for production deployments
4. **Rate Limiting**: Implement rate limiting on client side

### Content Creation

1. **Provide Multiple Formats**: Include text, HTML, and markdown content
2. **Add Metadata**: Include comprehensive metadata for better discovery
3. **Optimize Media**: Compress images and videos before upload
4. **Use Tags**: Add relevant tags for content organization

### Error Handling

1. **Check Response Status**: Always check HTTP status codes
2. **Parse Error Messages**: Read error messages for debugging
3. **Implement Retry Logic**: Retry failed requests with exponential backoff
4. **Log Errors**: Log errors for debugging and monitoring

## Code Examples

### JavaScript/Node.js

```javascript
// Validate a document
const response = await fetch('http://localhost:3000/api/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ansyblDocument)
});
const result = await response.json();

if (result.valid) {
  console.log('Document is valid!');
} else {
  console.error('Validation errors:', result.errors);
}
```

### Python

```python
import requests

# Create a post
response = requests.post(
    'http://localhost:3000/api/posts',
    data={
        'title': 'My Post',
        'content_markdown': '# Hello World',
        'tags': 'python,api'
    },
    files={'attachments': open('image.jpg', 'rb')}
)

if response.status_code == 201:
    post = response.json()['post']
    print(f"Post created: {post['id']}")
```

### cURL

```bash
# Search for content
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ansybl",
    "tags": ["protocol"],
    "sortBy": "date",
    "limit": 10
  }'
```

## Support

For additional help and support:

- **Documentation**: https://ansybl.org/docs
- **GitHub**: https://github.com/ansybl/protocol
- **Issues**: https://github.com/ansybl/protocol/issues
- **Community**: https://ansybl.org/community

## Changelog

### Version 1.0.0 (2025-11-09)

- Initial API release
- Complete Ansybl protocol implementation
- Validation, parsing, and content management endpoints
- Social interactions support
- Media handling and processing
- Protocol bridges (RSS, JSON Feed, ActivityPub)
- Feed discovery and subscription
- Comprehensive error handling
