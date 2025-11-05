# Ansybl Example Website

This is a complete example website that demonstrates the implementation of the Ansybl social syndication protocol. It shows how to create, validate, and serve Ansybl feeds with cryptographic signatures.

## Features

- **Complete Ansybl Implementation**: Full support for the Ansybl protocol specification
- **Cryptographic Signatures**: Ed25519 signatures for all content items and feeds
- **Schema Validation**: Real-time validation against the Ansybl JSON schema
- **Interactive API**: REST endpoints for validation and parsing
- **Web Interface**: Clean, responsive web interface showcasing the protocol
- **Live Feed**: Generates and serves a valid Ansybl feed at `/feed.ansybl`

## Quick Start

1. **Install Dependencies**
   ```bash
   cd example-website
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Visit the Website**
   Open http://localhost:3000 in your browser

4. **Try the Feed**
   Visit http://localhost:3000/feed.ansybl to see the live Ansybl feed

## API Endpoints

### Feed Endpoints
- `GET /feed.ansybl` - Complete Ansybl feed with signatures
- `GET /api/feed/info` - Feed metadata and statistics

### Validation & Parsing
- `POST /api/validate` - Validate Ansybl documents against schema
- `POST /api/parse` - Parse and verify Ansybl documents with signature checking

### Example API Usage

**Validate a document:**
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "version": "https://ansybl.org/version/1.0",
    "title": "Test Feed",
    "home_page_url": "https://example.com",
    "feed_url": "https://example.com/feed.ansybl",
    "author": {
      "name": "Test Author",
      "public_key": "ed25519:test_key_here"
    },
    "items": []
  }'
```

**Parse the live feed:**
```bash
curl -X POST http://localhost:3000/api/parse?verify=true \
  -H "Content-Type: application/json" \
  -d "$(curl -s http://localhost:3000/feed.ansybl)"
```

## Project Structure

```
example-website/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── lib/                   # Ansybl implementation
│   ├── generator.js       # Feed and item generation
│   ├── validator.js       # Schema validation
│   ├── parser.js          # Document parsing
│   ├── signature.js       # Ed25519 cryptography
│   ├── canonicalizer.js   # JSON canonicalization
│   ├── media-handler.js   # Media attachment processing
│   └── ansybl-feed.schema.json  # JSON schema
└── README.md              # This file
```

## Key Implementation Details

### Cryptographic Signatures
- Uses Ed25519 for all signatures
- Canonical JSON serialization ensures consistent signing
- Both feed-level and item-level signatures supported
- Automatic key pair generation for demo purposes

### Schema Validation
- Complete JSON Schema validation
- Detailed error messages with suggestions
- Support for extension fields (prefixed with `_`)
- Warnings for missing optional but recommended fields

### Feed Generation
- Automatic signature generation for all items
- Support for multiple content formats (text, HTML, Markdown)
- Media attachment handling
- Interaction counts and social metadata

### Security Features
- HTTPS-only URLs enforced
- Rate limiting on API endpoints
- Content Security Policy headers
- Input validation and sanitization

## Development

**Development mode with auto-reload:**
```bash
npm run dev
```

**Run tests:**
```bash
npm test
```

## Ansybl Protocol Features Demonstrated

✅ **Core Protocol**
- Feed metadata with author information
- Content items with multiple format support
- Cryptographic signatures (Ed25519)
- Schema validation

✅ **Advanced Features**
- Media attachments
- Social interactions (likes, shares, replies)
- Content tagging
- Reply threading (`in_reply_to`)
- Extension fields

✅ **Security**
- HTTPS-only URLs
- Signature verification
- Canonical JSON serialization
- Input validation

✅ **Interoperability**
- Standard JSON Schema validation
- RESTful API design
- Content negotiation
- CORS support

## Example Feed Output

The website generates a complete Ansybl feed that looks like this:

```json
{
  "version": "https://ansybl.org/version/1.0",
  "title": "Ansybl Example Site",
  "description": "A demonstration of the Ansybl social syndication protocol",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "icon": "https://example.com/favicon.ico",
  "language": "en",
  "author": {
    "name": "Demo Author",
    "url": "https://example.com/author",
    "avatar": "https://example.com/avatar.jpg",
    "public_key": "ed25519:..."
  },
  "items": [
    {
      "id": "https://example.com/post/post-1",
      "url": "https://example.com/post/post-1",
      "title": "Welcome to Ansybl",
      "content_text": "This is an example post...",
      "content_html": "<p>This is an example post...</p>",
      "date_published": "2025-11-04T10:00:00Z",
      "tags": ["ansybl", "demo", "welcome"],
      "signature": "ed25519:..."
    }
  ],
  "signature": "ed25519:..."
}
```

## License

MIT License - see the main project for details.

## Contributing

This example demonstrates the recommended approach for implementing the Ansybl protocol. Feel free to use it as a starting point for your own implementations or contribute improvements back to the project.