# Ansybl Schema

This directory contains the core JSON Schema definition and validation utilities for the Ansybl protocol.

## Contents

### Core Files

- **[ansybl-feed.schema.json](./ansybl-feed.schema.json)** - JSON Schema definition for Ansybl feeds
- **[validator.js](./validator.js)** - Feed validation utilities
- **[parser.js](./parser.js)** - Feed parsing and processing
- **[generator.js](./generator.js)** - Feed generation utilities

### Features

- **[canonicalizer.js](./canonicalizer.js)** - Content canonicalization for consistent hashing
- **[signature.js](./signature.js)** - Cryptographic signature support
- **[keymanagement.js](./keymanagement.js)** - Key generation and management
- **[version-manager.js](./version-manager.js)** - Version compatibility handling
- **[media-handler.js](./media-handler.js)** - Media attachment processing

### Social Features

- **[social-interactions.js](./social-interactions.js)** - Like, share, and interaction handling
- **[social-metadata.js](./social-metadata.js)** - Social metadata management
- **[webmention-endpoint.js](./webmention-endpoint.js)** - Webmention protocol support
- **[webfinger.js](./webfinger.js)** - WebFinger discovery

### Infrastructure

- **[discovery-service.js](./discovery-service.js)** - Feed and node discovery
- **[webring-registry.js](./webring-registry.js)** - Webring network support
- **[dashboard.js](./dashboard.js)** - Monitoring dashboard
- **[monitoring.js](./monitoring.js)** - Metrics and health checks
- **[error-handler.js](./error-handler.js)** - Error handling utilities

### Migration & Compatibility

- **[migration-tools.js](./migration-tools.js)** - Tools for migrating from other platforms
- **[bridges/](./bridges/)** - Bridge implementations for other protocols

### Testing

- **[test/](./test/)** - Test suite for schema validation and utilities

## Installation

```bash
npm install
```

## Usage

### Validating a Feed

```javascript
import { validateFeed } from './validator.js';

const feed = { /* your feed data */ };
const result = validateFeed(feed);
```

### Generating a Feed

```javascript
import { generateFeed } from './generator.js';

const feed = generateFeed({
  // feed configuration
});
```

### Running Tests

```bash
npm test
```

## Example Usage

See [example-usage.js](./example-usage.js) for detailed examples of using the schema utilities.

## Documentation

For more information about the Ansybl protocol specification, see the [project documentation](../.kiro/specs/).
