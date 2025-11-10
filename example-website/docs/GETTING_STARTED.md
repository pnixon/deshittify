# Getting Started with Ansybl Protocol

Welcome to the Ansybl Protocol! This guide will help you get started with implementing and using the Ansybl social syndication protocol.

## What is Ansybl?

Ansybl is a decentralized social syndication protocol that enables cryptographically signed content sharing across platforms. It provides:

- **Decentralized Content**: Host your own content, control your data
- **Cryptographic Security**: Ed25519 signatures ensure authenticity
- **Cross-Platform**: Works with RSS, JSON Feed, and ActivityPub
- **Rich Media**: Support for images, videos, audio, and documents
- **Social Features**: Likes, shares, comments, and interactions

## Quick Start

### Prerequisites

- Node.js 16+ installed
- Basic understanding of JSON and REST APIs
- (Optional) Understanding of cryptographic signatures

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ansybl/example-website.git
cd example-website
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser to `http://localhost:3000`

### Your First Feed

The example website automatically generates an Ansybl feed at `/feed.ansybl`. View it:

```bash
curl http://localhost:3000/feed.ansybl
```

## Core Concepts

### 1. Feed Document

An Ansybl feed is a JSON document containing metadata and content items:

```json
{
  "version": "https://ansybl.org/version/1.0",
  "title": "My Feed",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "author": {
    "name": "John Doe",
    "url": "https://example.com/author",
    "public_key": "ed25519_public_key"
  },
  "items": [],
  "signature": "feed_signature"
}
```

### 2. Content Items

Each item in the feed represents a post or comment:

```json
{
  "id": "https://example.com/post/1",
  "title": "My First Post",
  "content_text": "Hello, Ansybl!",
  "date_published": "2025-11-09T10:00:00Z",
  "author": { ... },
  "signature": "item_signature"
}
```

### 3. Cryptographic Signatures

Every item and the feed itself are signed with Ed25519:

- **Feed Signature**: Signs the entire feed metadata and items
- **Item Signatures**: Each item is individually signed
- **Public Key**: Included in author object for verification

### 4. Social Interactions

Ansybl supports social features:

```json
{
  "interactions": {
    "replies_count": 5,
    "likes_count": 12,
    "shares_count": 3,
    "replies_url": "https://example.com/api/posts/1/comments",
    "likes_url": "https://example.com/api/posts/1/interactions"
  }
}
```

## Basic Usage

### Creating a Post

```javascript
const response = await fetch('http://localhost:3000/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My First Post',
    content_markdown: '# Hello World\n\nThis is my first Ansybl post!',
    tags: ['welcome', 'first-post']
  })
});

const { post } = await response.json();
console.log('Post created:', post.id);
```

### Validating a Feed

```javascript
const feed = await fetch('http://localhost:3000/feed.ansybl')
  .then(r => r.json());

const validation = await fetch('http://localhost:3000/api/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(feed)
}).then(r => r.json());

if (validation.valid) {
  console.log('Feed is valid!');
} else {
  console.error('Validation errors:', validation.errors);
}
```

### Parsing with Signature Verification

```javascript
const parseResult = await fetch(
  'http://localhost:3000/api/parse?verify=true',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feed)
  }
).then(r => r.json());

if (parseResult.success && parseResult.verification.feedSignatureValid) {
  console.log('Feed signature is valid!');
  console.log('Items:', parseResult.feed.items.length);
}
```

## Next Steps

Now that you understand the basics, explore these topics:

1. **[Protocol Implementation Tutorial](./PROTOCOL_IMPLEMENTATION.md)** - Build your own Ansybl implementation
2. **[Best Practices](./BEST_PRACTICES.md)** - Learn recommended patterns and practices
3. **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
4. **[Security Guide](./SECURITY.md)** - Understand cryptographic security

## Common Tasks

### Adding Comments

```javascript
await fetch(`http://localhost:3000/api/posts/${postId}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    author: {
      name: 'Jane Doe',
      url: 'https://example.com/jane'
    },
    content: 'Great post!'
  })
});
```

### Liking a Post

```javascript
await fetch(`http://localhost:3000/api/posts/${postId}/like`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    userName: 'Jane Doe'
  })
});
```

### Uploading Media

```javascript
const formData = new FormData();
formData.append('files', imageFile);

const response = await fetch('http://localhost:3000/api/media/upload', {
  method: 'POST',
  body: formData
});

const { files } = await response.json();
console.log('Uploaded:', files[0].url);
```

### Searching Content

```javascript
const results = await fetch('http://localhost:3000/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'ansybl',
    tags: ['protocol'],
    sortBy: 'date',
    limit: 10
  })
}).then(r => r.json());

console.log(`Found ${results.total} results`);
```

## Troubleshooting

### Feed Not Loading

- Check that the server is running on port 3000
- Verify the feed URL is correct
- Check browser console for errors

### Validation Errors

- Ensure all required fields are present
- Check that URLs use HTTPS protocol
- Verify date formats are ISO 8601

### Signature Verification Fails

- Ensure public key matches private key used for signing
- Check that content hasn't been modified
- Verify canonical JSON serialization

## Resources

- **Specification**: https://ansybl.org/spec
- **GitHub**: https://github.com/ansybl/protocol
- **Community**: https://ansybl.org/community
- **Examples**: See `/examples` directory

## Support

Need help? Here's how to get support:

1. Check the [API Documentation](./API_DOCUMENTATION.md)
2. Review [Troubleshooting Guide](./troubleshooting.md)
3. Search [GitHub Issues](https://github.com/ansybl/protocol/issues)
4. Ask in the [Community Forum](https://ansybl.org/community)

Happy building with Ansybl! 🚀
