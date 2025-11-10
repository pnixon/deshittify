# Ansybl Protocol Implementation Tutorial

This tutorial guides you through implementing the Ansybl protocol from scratch. You'll learn how to create, validate, sign, and parse Ansybl feeds.

## Table of Contents

1. [Understanding the Protocol](#understanding-the-protocol)
2. [Implementing a Generator](#implementing-a-generator)
3. [Implementing a Validator](#implementing-a-validator)
4. [Implementing a Parser](#implementing-a-parser)
5. [Cryptographic Signatures](#cryptographic-signatures)
6. [Testing Your Implementation](#testing-your-implementation)

## Understanding the Protocol

### Protocol Structure

An Ansybl feed consists of:

1. **Feed Metadata**: Title, description, author, URLs
2. **Content Items**: Posts, comments, media
3. **Signatures**: Cryptographic signatures for verification

### Required Fields

**Feed Level:**
- `version` - Protocol version URL
- `title` - Feed title
- `home_page_url` - Website URL (HTTPS)
- `feed_url` - Feed URL (HTTPS)
- `items` - Array of content items

**Item Level:**
- `id` - Unique identifier (HTTPS URL)
- `date_published` - ISO 8601 timestamp

### Optional but Recommended

- `author` - Author information with public key
- `signature` - Ed25519 signature
- `content_text`, `content_html`, `content_markdown` - Content in multiple formats
- `attachments` - Media files
- `interactions` - Social interaction counts

## Implementing a Generator

### Step 1: Create the Generator Class

```javascript
import { signContent, canonicalizeJSON } from './signature.js';

export class AnsyblGenerator {
  constructor() {
    this.version = 'https://ansybl.org/version/1.0';
  }

  /**
   * Creates a complete Ansybl feed with signature
   */
  async createCompleteFeed(metadata, items, privateKey) {
    // Build feed structure
    const feed = {
      version: this.version,
      title: metadata.title,
      description: metadata.description,
      home_page_url: metadata.home_page_url,
      feed_url: metadata.feed_url,
      author: metadata.author,
      items: items
    };

    // Add optional fields
    if (metadata.icon) feed.icon = metadata.icon;
    if (metadata.language) feed.language = metadata.language;

    // Sign the feed
    if (privateKey) {
      const canonical = canonicalizeJSON(feed);
      feed.signature = await signContent(canonical, privateKey);
    }

    return feed;
  }

  /**
   * Creates a single content item with signature
   */
  async createContentItem(content, author, privateKey) {
    const item = {
      id: content.id,
      date_published: content.date_published || new Date().toISOString()
    };

    // Add optional fields
    if (content.uuid) item.uuid = content.uuid;
    if (content.url) item.url = content.url;
    if (content.title) item.title = content.title;
    if (content.content_text) item.content_text = content.content_text;
    if (content.content_html) item.content_html = content.content_html;
    if (content.content_markdown) item.content_markdown = content.content_markdown;
    if (content.summary) item.summary = content.summary;
    if (content.tags) item.tags = content.tags;
    if (content.attachments) item.attachments = content.attachments;
    if (content.in_reply_to) item.in_reply_to = content.in_reply_to;
    if (author) item.author = author;

    // Sign the item
    if (privateKey) {
      const canonical = canonicalizeJSON(item);
      item.signature = await signContent(canonical, privateKey);
    }

    return item;
  }
}
```

### Step 2: Use the Generator

```javascript
const generator = new AnsyblGenerator();

// Create feed metadata
const metadata = {
  title: 'My Ansybl Feed',
  description: 'A demonstration feed',
  home_page_url: 'https://example.com',
  feed_url: 'https://example.com/feed.ansybl',
  author: {
    name: 'John Doe',
    url: 'https://example.com/author',
    public_key: publicKey
  }
};

// Create content items
const items = [
  await generator.createContentItem({
    id: 'https://example.com/post/1',
    title: 'First Post',
    content_text: 'Hello, Ansybl!',
    date_published: new Date().toISOString()
  }, metadata.author, privateKey)
];

// Generate complete feed
const feed = await generator.createCompleteFeed(
  metadata,
  items,
  privateKey
);

console.log(JSON.stringify(feed, null, 2));
```

## Implementing a Validator

### Step 1: Load the JSON Schema

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './ansybl-feed.schema.json' assert { type: 'json' };

export class AnsyblValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.validate = this.ajv.compile(schema);
  }

  /**
   * Validates an Ansybl document
   */
  validateDocument(document, options = {}) {
    const result = {
      valid: false,
      errors: [],
      warnings: []
    };

    // Schema validation
    const valid = this.validate(document);
    
    if (!valid) {
      result.errors = this.validate.errors.map(err => ({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: err.message,
        field: err.instancePath,
        details: err.params
      }));
      return result;
    }

    // Business rule validation
    const businessRuleErrors = this.validateBusinessRules(document);
    if (businessRuleErrors.length > 0) {
      result.errors.push(...businessRuleErrors);
      return result;
    }

    // Extension field validation
    if (options.validateExtensions !== false) {
      const extensionWarnings = this.validateExtensions(document);
      result.warnings.push(...extensionWarnings);
    }

    result.valid = true;
    return result;
  }

  /**
   * Validates business rules beyond schema
   */
  validateBusinessRules(document) {
    const errors = [];

    // Check HTTPS URLs
    const urls = [
      document.home_page_url,
      document.feed_url,
      ...(document.items || []).map(item => item.id)
    ];

    urls.forEach(url => {
      if (url && !url.startsWith('https://')) {
        errors.push({
          code: 'HTTPS_REQUIRED',
          message: 'All URLs must use HTTPS protocol',
          field: url
        });
      }
    });

    // Check date formats
    (document.items || []).forEach((item, index) => {
      if (item.date_published) {
        try {
          new Date(item.date_published).toISOString();
        } catch (e) {
          errors.push({
            code: 'INVALID_DATE_FORMAT',
            message: 'Date must be valid ISO 8601 format',
            field: `items[${index}].date_published`
          });
        }
      }
    });

    return errors;
  }

  /**
   * Validates extension fields (must start with _)
   */
  validateExtensions(document) {
    const warnings = [];

    const checkExtensions = (obj, path = '') => {
      Object.keys(obj).forEach(key => {
        if (!key.startsWith('_') && !this.isStandardField(key)) {
          warnings.push({
            code: 'EXTENSION_FIELD_WARNING',
            message: 'Custom fields should be prefixed with underscore',
            field: `${path}${key}`
          });
        }
      });
    };

    checkExtensions(document, '');
    (document.items || []).forEach((item, i) => {
      checkExtensions(item, `items[${i}].`);
    });

    return warnings;
  }

  isStandardField(key) {
    const standardFields = [
      'version', 'title', 'description', 'home_page_url', 'feed_url',
      'icon', 'language', 'author', 'items', 'signature',
      'id', 'uuid', 'url', 'content_text', 'content_html',
      'content_markdown', 'summary', 'date_published', 'date_modified',
      'tags', 'attachments', 'in_reply_to', 'interactions',
      'name', 'avatar', 'public_key', 'mime_type', 'size_in_bytes',
      'duration_in_seconds', 'width', 'height', 'alt_text', 'blurhash',
      'replies_count', 'likes_count', 'shares_count'
    ];
    return standardFields.includes(key);
  }
}
```

### Step 2: Use the Validator

```javascript
const validator = new AnsyblValidator();

// Validate a feed
const result = validator.validateDocument(feed, {
  validateExtensions: true
});

if (result.valid) {
  console.log('✅ Feed is valid!');
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:', result.warnings);
  }
} else {
  console.error('❌ Validation failed:');
  result.errors.forEach(err => {
    console.error(`  - ${err.field}: ${err.message}`);
  });
}
```


## Implementing a Parser

### Step 1: Create the Parser Class

```javascript
import { verifySignature, canonicalizeJSON } from './signature.js';

export class AnsyblParser {
  constructor() {
    this.validator = new AnsyblValidator();
  }

  /**
   * Parses an Ansybl document with optional verification
   */
  async parse(document, options = {}) {
    const result = {
      success: false,
      feed: null,
      verification: null,
      errors: []
    };

    // Validate first
    const validation = this.validator.validateDocument(document);
    if (!validation.valid) {
      result.errors = validation.errors;
      return result;
    }

    // Parse the feed
    result.feed = { ...document };

    // Verify signatures if requested
    if (options.verifySignatures) {
      result.verification = await this.verifySignatures(document);
      
      if (options.requireSignatures && !result.verification.feedSignatureValid) {
        result.errors.push({
          code: 'SIGNATURE_VERIFICATION_FAILED',
          message: 'Feed signature verification failed'
        });
        return result;
      }
    }

    result.success = true;
    return result;
  }

  /**
   * Verifies all signatures in the document
   */
  async verifySignatures(document) {
    const verification = {
      feedSignatureValid: false,
      itemSignaturesValid: true,
      invalidItems: []
    };

    // Verify feed signature
    if (document.signature && document.author?.public_key) {
      const feedCopy = { ...document };
      delete feedCopy.signature;
      
      const canonical = canonicalizeJSON(feedCopy);
      verification.feedSignatureValid = await verifySignature(
        canonical,
        document.signature,
        document.author.public_key
      );
    }

    // Verify item signatures
    for (const item of document.items || []) {
      if (item.signature && item.author?.public_key) {
        const itemCopy = { ...item };
        delete itemCopy.signature;
        
        const canonical = canonicalizeJSON(itemCopy);
        const valid = await verifySignature(
          canonical,
          item.signature,
          item.author.public_key
        );

        if (!valid) {
          verification.itemSignaturesValid = false;
          verification.invalidItems.push(item.id);
        }
      }
    }

    return verification;
  }

  /**
   * Extracts metadata only (no content)
   */
  async parseMetadataOnly(document, options = {}) {
    const result = await this.parse(document, options);
    
    if (result.success && result.feed) {
      // Remove content from items
      result.feed.items = result.feed.items.map(item => ({
        id: item.id,
        uuid: item.uuid,
        url: item.url,
        title: item.title,
        summary: item.summary,
        date_published: item.date_published,
        date_modified: item.date_modified,
        author: item.author,
        tags: item.tags,
        interactions: item.interactions
      }));
    }

    return result;
  }

  /**
   * Filters items based on criteria
   */
  getItems(feed, filters = {}) {
    let items = feed.items || [];

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      items = items.filter(item => 
        new Date(item.date_published) >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      items = items.filter(item => 
        new Date(item.date_published) <= toDate
      );
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      items = items.filter(item =>
        item.tags && item.tags.some(tag => filters.tags.includes(tag))
      );
    }

    // Filter by author
    if (filters.author) {
      items = items.filter(item =>
        item.author?.name === filters.author
      );
    }

    // Filter by content type
    if (filters.hasAttachments) {
      items = items.filter(item =>
        item.attachments && item.attachments.length > 0
      );
    }

    return items;
  }
}
```

### Step 2: Use the Parser

```javascript
const parser = new AnsyblParser();

// Parse without verification
const result = await parser.parse(feedDocument);

if (result.success) {
  console.log('Feed parsed successfully');
  console.log('Items:', result.feed.items.length);
}

// Parse with signature verification
const verifiedResult = await parser.parse(feedDocument, {
  verifySignatures: true,
  requireSignatures: true
});

if (verifiedResult.success) {
  console.log('Feed signature valid:', 
    verifiedResult.verification.feedSignatureValid);
  console.log('All item signatures valid:', 
    verifiedResult.verification.itemSignaturesValid);
}

// Parse metadata only
const metadataResult = await parser.parseMetadataOnly(feedDocument);
console.log('Metadata:', metadataResult.feed.title);

// Filter items
const recentItems = parser.getItems(result.feed, {
  dateFrom: '2025-11-01T00:00:00Z',
  tags: ['ansybl']
});
console.log('Recent items:', recentItems.length);
```

## Cryptographic Signatures

### Step 1: Implement Signature Functions

```javascript
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Generates an Ed25519 key pair
 */
export async function generateKeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey)
  };
}

/**
 * Signs content with Ed25519
 */
export async function signContent(content, privateKeyHex) {
  const privateKey = hexToBytes(privateKeyHex);
  const message = new TextEncoder().encode(content);
  const signature = ed25519.sign(message, privateKey);

  return bytesToHex(signature);
}

/**
 * Verifies an Ed25519 signature
 */
export async function verifySignature(content, signatureHex, publicKeyHex) {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    const signature = hexToBytes(signatureHex);
    const message = new TextEncoder().encode(content);

    return ed25519.verify(signature, message, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Canonicalizes JSON for consistent signing
 */
export function canonicalizeJSON(obj) {
  // Sort keys recursively
  const sortKeys = (o) => {
    if (Array.isArray(o)) {
      return o.map(sortKeys);
    } else if (o !== null && typeof o === 'object') {
      return Object.keys(o)
        .sort()
        .reduce((result, key) => {
          result[key] = sortKeys(o[key]);
          return result;
        }, {});
    }
    return o;
  };

  const sorted = sortKeys(obj);
  return JSON.stringify(sorted);
}
```

### Step 2: Sign and Verify Content

```javascript
// Generate keys
const { privateKey, publicKey } = await generateKeyPair();
console.log('Public Key:', publicKey);

// Create content
const content = {
  id: 'https://example.com/post/1',
  title: 'My Post',
  content_text: 'Hello, world!',
  date_published: new Date().toISOString()
};

// Sign the content
const canonical = canonicalizeJSON(content);
const signature = await signContent(canonical, privateKey);
content.signature = signature;

console.log('Signed content:', content);

// Verify the signature
const contentCopy = { ...content };
delete contentCopy.signature;

const canonicalCopy = canonicalizeJSON(contentCopy);
const isValid = await verifySignature(
  canonicalCopy,
  signature,
  publicKey
);

console.log('Signature valid:', isValid);
```

## Testing Your Implementation

### Unit Tests

```javascript
import { describe, it, expect } from 'vitest';

describe('AnsyblGenerator', () => {
  it('should create a valid feed', async () => {
    const generator = new AnsyblGenerator();
    const { privateKey, publicKey } = await generateKeyPair();

    const metadata = {
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: {
        name: 'Test Author',
        public_key: publicKey
      }
    };

    const feed = await generator.createCompleteFeed(
      metadata,
      [],
      privateKey
    );

    expect(feed.version).toBe('https://ansybl.org/version/1.0');
    expect(feed.title).toBe('Test Feed');
    expect(feed.signature).toBeDefined();
  });
});

describe('AnsyblValidator', () => {
  it('should validate a correct feed', () => {
    const validator = new AnsyblValidator();
    
    const feed = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      items: []
    };

    const result = validator.validateDocument(feed);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-HTTPS URLs', () => {
    const validator = new AnsyblValidator();
    
    const feed = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'http://example.com', // HTTP not HTTPS
      feed_url: 'https://example.com/feed.ansybl',
      items: []
    };

    const result = validator.validateDocument(feed);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'HTTPS_REQUIRED')).toBe(true);
  });
});

describe('AnsyblParser', () => {
  it('should parse a valid feed', async () => {
    const parser = new AnsyblParser();
    
    const feed = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      items: []
    };

    const result = await parser.parse(feed);
    expect(result.success).toBe(true);
    expect(result.feed).toBeDefined();
  });

  it('should verify signatures', async () => {
    const parser = new AnsyblParser();
    const generator = new AnsyblGenerator();
    const { privateKey, publicKey } = await generateKeyPair();

    const metadata = {
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: {
        name: 'Test Author',
        public_key: publicKey
      }
    };

    const feed = await generator.createCompleteFeed(
      metadata,
      [],
      privateKey
    );

    const result = await parser.parse(feed, {
      verifySignatures: true
    });

    expect(result.success).toBe(true);
    expect(result.verification.feedSignatureValid).toBe(true);
  });
});
```

### Integration Tests

```javascript
describe('End-to-End Workflow', () => {
  it('should create, sign, validate, and parse a feed', async () => {
    // 1. Generate keys
    const { privateKey, publicKey } = await generateKeyPair();

    // 2. Create feed
    const generator = new AnsyblGenerator();
    const metadata = {
      title: 'Integration Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: {
        name: 'Test Author',
        public_key: publicKey
      }
    };

    const item = await generator.createContentItem({
      id: 'https://example.com/post/1',
      title: 'Test Post',
      content_text: 'Hello, Ansybl!',
      date_published: new Date().toISOString()
    }, metadata.author, privateKey);

    const feed = await generator.createCompleteFeed(
      metadata,
      [item],
      privateKey
    );

    // 3. Validate feed
    const validator = new AnsyblValidator();
    const validation = validator.validateDocument(feed);
    expect(validation.valid).toBe(true);

    // 4. Parse and verify
    const parser = new AnsyblParser();
    const result = await parser.parse(feed, {
      verifySignatures: true
    });

    expect(result.success).toBe(true);
    expect(result.verification.feedSignatureValid).toBe(true);
    expect(result.verification.itemSignaturesValid).toBe(true);
    expect(result.feed.items).toHaveLength(1);
  });
});
```

## Best Practices

### 1. Always Validate Before Processing

```javascript
const validator = new AnsyblValidator();
const validation = validator.validateDocument(feed);

if (!validation.valid) {
  console.error('Invalid feed:', validation.errors);
  return;
}

// Proceed with processing
```

### 2. Verify Signatures for External Feeds

```javascript
const parser = new AnsyblParser();
const result = await parser.parse(externalFeed, {
  verifySignatures: true,
  requireSignatures: true
});

if (!result.success || !result.verification.feedSignatureValid) {
  console.error('Signature verification failed');
  return;
}
```

### 3. Use Canonical JSON for Signing

```javascript
// Always canonicalize before signing
const canonical = canonicalizeJSON(content);
const signature = await signContent(canonical, privateKey);
```

### 4. Handle Errors Gracefully

```javascript
try {
  const result = await parser.parse(feed, { verifySignatures: true });
  
  if (!result.success) {
    result.errors.forEach(error => {
      console.error(`${error.code}: ${error.message}`);
    });
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### 5. Implement Caching

```javascript
class CachedParser extends AnsyblParser {
  constructor() {
    super();
    this.cache = new Map();
  }

  async parse(document, options = {}) {
    const key = JSON.stringify(document);
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const result = await super.parse(document, options);
    this.cache.set(key, result);
    
    return result;
  }
}
```

## Next Steps

Now that you understand protocol implementation:

1. **[Best Practices Guide](./BEST_PRACTICES.md)** - Learn recommended patterns
2. **[Security Guide](./SECURITY.md)** - Understand security considerations
3. **[API Documentation](./API_DOCUMENTATION.md)** - Explore the complete API
4. **Build Your Own**: Create a custom Ansybl implementation

## Resources

- **JSON Schema**: `/lib/ansybl-feed.schema.json`
- **Example Implementation**: `/lib/generator.js`, `/lib/validator.js`, `/lib/parser.js`
- **Test Suite**: `/test/` directory
- **Specification**: https://ansybl.org/spec

Happy implementing! 🚀
