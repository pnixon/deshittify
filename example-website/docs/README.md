# Ansybl Protocol Documentation

Complete documentation for the Ansybl social syndication protocol implementation.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./GETTING_STARTED.md)** - Quick start guide for new users
- **[Protocol Implementation Tutorial](./PROTOCOL_IMPLEMENTATION.md)** - Build your own Ansybl implementation
- **[Best Practices](./BEST_PRACTICES.md)** - Recommended patterns and practices

### API Reference
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with examples
- **[OpenAPI Specification](./openapi.yaml)** - Machine-readable API specification
- **[Error Code Reference](./ERROR_CODES.md)** - Complete error code documentation

### Interactive Tools
- **[API Playground](http://localhost:3000/playground.html)** - Test API endpoints interactively
- **[Protocol Demo](http://localhost:3000/demo.html)** - Interactive protocol demonstrations

### Implementation Guides
- **[Security Implementation](./SECURITY.md)** - Security best practices and implementation
- **[Feed Serving](./FEED_SERVING_IMPLEMENTATION.md)** - Feed generation and serving
- **[Content Organization](./CONTENT_ORGANIZATION_IMPLEMENTATION.md)** - Tagging and metadata

### Troubleshooting
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions
- **[Deployment Guide](./deployment-guide.md)** - Production deployment instructions

## 🚀 Quick Links

### For Developers

**New to Ansybl?**
1. Start with [Getting Started Guide](./GETTING_STARTED.md)
2. Try the [API Playground](http://localhost:3000/playground.html)
3. Read [Protocol Implementation Tutorial](./PROTOCOL_IMPLEMENTATION.md)

**Building an Implementation?**
1. Review [API Documentation](./API_DOCUMENTATION.md)
2. Study [Best Practices](./BEST_PRACTICES.md)
3. Check [Security Implementation](./SECURITY.md)

**Integrating with Existing Systems?**
1. See [Protocol Bridges](./API_DOCUMENTATION.md#bridge-apis)
2. Review [Feed Serving](./FEED_SERVING_IMPLEMENTATION.md)
3. Check [Error Code Reference](./ERROR_CODES.md)

### For Users

**Want to Try It Out?**
- Visit [Protocol Demo](http://localhost:3000/demo.html)
- Explore [API Playground](http://localhost:3000/playground.html)

**Having Issues?**
- Check [Troubleshooting Guide](./troubleshooting.md)
- Review [Error Code Reference](./ERROR_CODES.md)

## 📖 Documentation Structure

```
docs/
├── README.md                              # This file
├── GETTING_STARTED.md                     # Quick start guide
├── PROTOCOL_IMPLEMENTATION.md             # Implementation tutorial
├── BEST_PRACTICES.md                      # Best practices guide
├── API_DOCUMENTATION.md                   # Complete API reference
├── openapi.yaml                           # OpenAPI specification
├── ERROR_CODES.md                         # Error code reference
├── SECURITY.md                            # Security guide
├── FEED_SERVING_IMPLEMENTATION.md         # Feed serving guide
├── CONTENT_ORGANIZATION_IMPLEMENTATION.md # Content organization
├── troubleshooting.md                     # Troubleshooting
└── deployment-guide.md                    # Deployment guide
```

## 🎯 Key Concepts

### Ansybl Protocol

Ansybl is a decentralized social syndication protocol that enables:

- **Decentralized Content**: Host your own content, control your data
- **Cryptographic Security**: Ed25519 signatures ensure authenticity
- **Cross-Platform**: Works with RSS, JSON Feed, and ActivityPub
- **Rich Media**: Support for images, videos, audio, and documents
- **Social Features**: Likes, shares, comments, and interactions

### Core Components

1. **Feed Document**: JSON document containing metadata and content items
2. **Content Items**: Individual posts, comments, or media
3. **Signatures**: Ed25519 cryptographic signatures for verification
4. **Interactions**: Social features like likes, shares, and comments
5. **Bridges**: Protocol conversion for RSS, JSON Feed, ActivityPub

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Interface Layer                       │
│  (HTML/CSS/JS - Responsive UI, Forms, Interactive Demo)     │
├─────────────────────────────────────────────────────────────┤
│                      API Layer                              │
│  (Express.js - REST endpoints, Validation, Error Handling)  │
├─────────────────────────────────────────────────────────────┤
│                   Business Logic Layer                      │
│  (Ansybl Core - Generator, Parser, Validator, Signature)    │
├─────────────────────────────────────────────────────────────┤
│                    Storage Layer                            │
│  (In-Memory - Posts, Comments, Interactions, Media Files)   │
├─────────────────────────────────────────────────────────────┤
│                   Security Layer                            │
│  (Helmet, CORS, Rate Limiting, Input Validation)           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 API Overview

### Validation API
- Validate Ansybl documents against JSON schema
- Batch validation for multiple documents
- Custom schema validation

### Parsing API
- Parse Ansybl documents with signature verification
- Extract metadata or content selectively
- Filter items by criteria

### Content Management API
- Create posts with media attachments
- Add comments to posts
- Manage content lifecycle

### Interactions API
- Like/unlike posts
- Share posts with messages
- Track interaction analytics

### Media API
- Upload images, videos, audio, PDFs
- Automatic processing and optimization
- Thumbnail generation

### Feed API
- Serve Ansybl feeds
- Feed metadata and statistics
- Cache management

### Search API
- Full-text content search
- Tag-based filtering
- Advanced query options

### Tags API
- Tag validation and normalization
- Trending tags
- Tag statistics

### Metadata API
- Dublin Core metadata generation
- Schema.org structured data
- Metadata validation

### Bridge APIs
- RSS 2.0 conversion
- JSON Feed 1.1 conversion
- ActivityPub translation

### Discovery API
- WebFinger protocol support
- Feed autodiscovery
- Subscription management

## 📝 Examples

### Create a Post

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

### Validate a Feed

```javascript
const feed = await fetch('http://localhost:3000/feed.ansybl')
  .then(r => r.json());

const validation = await fetch('http://localhost:3000/api/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(feed)
}).then(r => r.json());

console.log('Valid:', validation.valid);
```

### Search Content

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

## 🛠️ Development Tools

### API Playground
Interactive tool for testing API endpoints:
- Validate documents
- Parse feeds with signature verification
- Generate feeds
- Search content

**Access:** http://localhost:3000/playground.html

### Protocol Demo
Interactive demonstrations of protocol features:
- Feed generation
- Validation
- Signature verification
- Protocol bridges
- Content search
- Social interactions

**Access:** http://localhost:3000/demo.html

## 🔒 Security

### Cryptographic Signatures
- Ed25519 elliptic curve cryptography
- Canonical JSON serialization
- Feed and item-level signatures

### Input Validation
- Schema validation
- Business rule validation
- XSS protection
- SQL injection prevention

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable limits
- Exponential backoff recommended

### HTTPS Enforcement
- All URLs must use HTTPS
- Secure file serving
- Content Security Policy headers

## 📊 Performance

### Caching
- Feed caching with TTL
- Validation result caching
- Media file caching

### Optimization
- Response compression (gzip)
- Pagination for large datasets
- Lazy loading for media
- Database query optimization

## 🌐 Protocol Bridges

### RSS 2.0
Convert Ansybl feeds to RSS format for compatibility with RSS readers.

### JSON Feed 1.1
Convert to JSON Feed format for modern feed readers.

### ActivityPub
Translate to ActivityPub for federated social networks.

## 📞 Support

### Resources
- **Specification**: https://ansybl.org/spec
- **GitHub**: https://github.com/ansybl/protocol
- **Community**: https://ansybl.org/community
- **Issues**: https://github.com/ansybl/protocol/issues

### Getting Help
1. Check the documentation
2. Review troubleshooting guide
3. Search GitHub issues
4. Ask in community forum

## 🤝 Contributing

Contributions are welcome! Please:
1. Read the documentation
2. Follow best practices
3. Write tests
4. Submit pull requests

## 📄 License

MIT License - See LICENSE file for details

## 🎉 Acknowledgments

Built with:
- Node.js & Express
- Ed25519 cryptography (@noble/curves)
- JSON Schema validation (AJV)
- Sharp for image processing
- And many other open source libraries

---

**Happy building with Ansybl!** 🚀

For questions or feedback, visit our [community forum](https://ansybl.org/community).
