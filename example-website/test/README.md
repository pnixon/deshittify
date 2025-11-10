# Ansybl Example Website - Test Suite

This directory contains comprehensive tests for the Ansybl protocol implementation.

## Test Structure

### Unit Tests (`test/*.test.js`)
Core functionality tests for individual components:

- **api-interactions.test.js** - Tests for like, share, and interaction management
- **api-posts.test.js** - Tests for post storage and validation
- **bridges.test.js** - Tests for RSS, ActivityPub, and JSON Feed bridges
- **canonicalizer.test.js** - Tests for canonical JSON serialization
- **generator.test.js** - Tests for Ansybl feed generation
- **media-handler.test.js** - Tests for media file handling
- **parser.test.js** - Tests for Ansybl document parsing
- **security.test.js** - Tests for security utilities
- **signature.test.js** - Tests for Ed25519 signature operations
- **validator.test.js** - Tests for schema validation

### Integration Tests (`test/integration/*.test.js`)
End-to-end workflow tests:

- **feed-workflow.test.js** - Complete feed creation, signing, validation, and parsing workflows
- **bridge-workflow.test.js** - Protocol bridge conversion workflows
- **signature-workflow.test.js** - End-to-end signature verification workflows

### Performance Tests (`test/performance/*.test.js`)
Load and performance testing:

- **load-testing.test.js** - Tests for handling large feeds, concurrent operations, and memory usage

### Security Tests (`test/security/*.test.js`)
Security and penetration testing:

- **security-testing.test.js** - Tests for XSS prevention, injection prevention, signature security, and DoS prevention

## Running Tests

### Run all tests:
```bash
npm test
```

### Run specific test categories:
```bash
# Unit tests only
node --test test/*.test.js

# Integration tests only
node --test test/integration/*.test.js

# Performance tests only
node --test test/performance/*.test.js

# Security tests only
node --test test/security/*.test.js

# All tests including subdirectories
node --test test/**/*.test.js
```

## Test Coverage

### Core Functionality (66 tests)
- Feed creation and management
- Content item creation with multiple formats
- Signature generation and verification
- Schema validation
- Protocol bridges (RSS, ActivityPub, JSON Feed)
- Media handling
- Security utilities
- Canonical JSON serialization

### Integration Workflows (19 tests)
- Complete feed lifecycle (create → sign → validate → parse)
- Multi-item feed handling
- Content format conversion (Markdown → HTML)
- Protocol bridge conversions
- Signature verification workflows
- Key pair management

### Performance (7 tests)
- Large feed handling (100+ items)
- Validation performance
- Signature performance (50+ items)
- Memory leak detection
- Concurrent operation handling

### Security (15 tests)
- XSS prevention in HTML content
- Path traversal prevention
- File type validation
- Signature forgery detection
- Content tampering detection
- Signature replay attack prevention
- URL validation
- Input validation
- DoS prevention (nested objects, long strings)

## Test Results

All 107 tests pass successfully:
- ✅ 66 unit tests
- ✅ 19 integration tests
- ✅ 7 performance tests
- ✅ 15 security tests

## Test Fixtures

Test data and fixtures are located in:
- `test/fixtures/test-data.js` - Sample feeds, posts, attachments, and invalid data for testing

## Performance Benchmarks

Based on test results:
- Feed creation with 100 items: < 30 seconds
- Parsing 100-item feed: < 5 seconds
- Validation of 50-item feed: < 2 seconds
- Signing 50 items: < 5 seconds
- Concurrent parsing (10 operations): < 3 seconds

## Security Validation

All security tests pass, confirming:
- ✅ XSS attacks are prevented through HTML sanitization
- ✅ Path traversal attacks are blocked
- ✅ Signature forgery is detected
- ✅ Content tampering is detected
- ✅ Replay attacks are prevented
- ✅ Non-HTTPS URLs are rejected
- ✅ Input validation prevents oversized/malformed data
- ✅ DoS attacks (nested objects, long strings) are handled gracefully

## Continuous Testing

Tests should be run:
- Before committing code changes
- As part of CI/CD pipeline
- Before deploying to production
- After dependency updates

## Contributing

When adding new features:
1. Write unit tests for new functions
2. Add integration tests for new workflows
3. Include performance tests for operations that may impact scalability
4. Add security tests for any user-facing functionality
5. Ensure all tests pass before submitting PR
