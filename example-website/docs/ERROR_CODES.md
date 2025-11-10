# Ansybl API Error Code Reference

Complete reference of error codes returned by the Ansybl Protocol API.

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {
    "field": "path.to.field",
    "expected": "Expected value",
    "received": "Actual value"
  },
  "timestamp": "2025-11-09T12:00:00Z"
}
```

## Validation Errors (VAL-xxx)

### VAL-001: SCHEMA_VALIDATION_FAILED
**Description:** Document doesn't match the JSON schema

**Common Causes:**
- Missing required fields
- Invalid data types
- Incorrect field names

**Solution:**
```javascript
// Ensure all required fields are present
const feed = {
  version: "https://ansybl.org/version/1.0",
  title: "My Feed",
  home_page_url: "https://example.com",
  feed_url: "https://example.com/feed.ansybl",
  items: []
};
```

### VAL-002: MISSING_REQUIRED_FIELD
**Description:** A required field is missing from the document

**Common Causes:**
- Incomplete feed metadata
- Missing item fields

**Solution:**
```javascript
// Feed level required fields
{
  "version": "https://ansybl.org/version/1.0",  // Required
  "title": "Feed Title",                         // Required
  "home_page_url": "https://example.com",        // Required
  "feed_url": "https://example.com/feed.ansybl", // Required
  "items": []                                    // Required
}

// Item level required fields
{
  "id": "https://example.com/post/1",  // Required
  "date_published": "2025-11-09T10:00:00Z"  // Required
}
```

### VAL-003: INVALID_URL_FORMAT
**Description:** URL is not properly formatted or doesn't use HTTPS

**Common Causes:**
- Using HTTP instead of HTTPS
- Malformed URLs
- Missing protocol

**Solution:**
```javascript
// ✅ Correct
"home_page_url": "https://example.com"

// ❌ Wrong
"home_page_url": "http://example.com"  // Must be HTTPS
"home_page_url": "example.com"         // Missing protocol
"home_page_url": "ftp://example.com"   // Wrong protocol
```

### VAL-004: INVALID_DATE_FORMAT
**Description:** Date is not in ISO 8601 format

**Common Causes:**
- Using non-standard date formats
- Missing timezone information

**Solution:**
```javascript
// ✅ Correct
"date_published": "2025-11-09T10:00:00Z"
"date_published": "2025-11-09T10:00:00+00:00"

// ❌ Wrong
"date_published": "11/09/2025"
"date_published": "2025-11-09"  // Missing time
"date_published": "Nov 9, 2025"
```

### VAL-005: EXTENSION_FIELD_INVALID
**Description:** Custom extension field doesn't follow naming convention

**Common Causes:**
- Custom fields not prefixed with underscore

**Solution:**
```javascript
// ✅ Correct
{
  "title": "My Post",
  "_custom_field": "Custom value",
  "_my_extension": { ... }
}

// ❌ Wrong
{
  "title": "My Post",
  "custom_field": "Custom value"  // Missing underscore prefix
}
```

### VAL-006: HTTPS_REQUIRED
**Description:** All URLs must use HTTPS protocol

**Solution:** Update all URLs to use HTTPS instead of HTTP

### VAL-007: INVALID_MIME_TYPE
**Description:** Attachment has invalid or unsupported MIME type

**Supported Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Videos: `video/mp4`, `video/webm`
- Audio: `audio/mp3`, `audio/ogg`, `audio/wav`
- Documents: `application/pdf`

## Parsing Errors (PRS-xxx)

### PRS-001: PARSE_ERROR
**Description:** Failed to parse the document

**Common Causes:**
- Invalid JSON syntax
- Malformed document structure

**Solution:**
```javascript
// Validate JSON before sending
try {
  JSON.parse(documentString);
} catch (e) {
  console.error('Invalid JSON:', e.message);
}
```

### PRS-002: SIGNATURE_VERIFICATION_FAILED
**Description:** Cryptographic signature is invalid

**Common Causes:**
- Content has been modified after signing
- Wrong public key used for verification
- Signature corruption

**Solution:**
```javascript
// Ensure content hasn't been modified
// Verify public key matches the private key used for signing
// Re-sign if necessary
const signature = await signContent(canonicalJSON, privateKey);
```

### PRS-003: MALFORMED_JSON
**Description:** JSON document is not well-formed

**Solution:** Validate JSON syntax using a JSON validator

### PRS-004: UNSUPPORTED_VERSION
**Description:** Ansybl protocol version is not supported

**Supported Versions:**
- `https://ansybl.org/version/1.0`

**Solution:**
```javascript
{
  "version": "https://ansybl.org/version/1.0"  // Use supported version
}
```

### PRS-005: MISSING_SIGNATURE
**Description:** Signature is required but not present

**Solution:**
```javascript
// Sign the document before parsing with requireSignatures
const canonical = canonicalizeJSON(document);
const signature = await signContent(canonical, privateKey);
document.signature = signature;
```

### PRS-006: INVALID_PUBLIC_KEY
**Description:** Public key format is invalid

**Solution:**
```javascript
// Ensure public key is valid Ed25519 key in hex format
"public_key": "a1b2c3d4..."  // 64 character hex string
```

## Content Errors (CNT-xxx)

### CNT-001: POST_NOT_FOUND
**Description:** Requested post does not exist

**Solution:** Verify the post ID is correct

### CNT-002: COMMENT_NOT_FOUND
**Description:** Requested comment does not exist

**Solution:** Verify the comment ID is correct

### CNT-003: INVALID_CONTENT_FORMAT
**Description:** Content format is not supported

**Supported Formats:**
- `content_text` - Plain text
- `content_html` - HTML
- `content_markdown` - Markdown

**Solution:**
```javascript
{
  "content_text": "Plain text content",
  "content_html": "<p>HTML content</p>",
  "content_markdown": "# Markdown content"
}
```

### CNT-004: CONTENT_TOO_LONG
**Description:** Content exceeds maximum length

**Limits:**
- Title: 200 characters
- Summary: 500 characters
- Content: 50,000 characters

### CNT-005: INVALID_TAG_FORMAT
**Description:** Tag format is invalid

**Rules:**
- Lowercase letters, numbers, hyphens
- No spaces or special characters
- Max 50 characters per tag

**Solution:**
```javascript
// ✅ Correct
"tags": ["ansybl", "protocol", "social-media"]

// ❌ Wrong
"tags": ["Ansybl", "Protocol!", "social media"]
```

## Media Errors (MED-xxx)

### MED-001: ATTACHMENT_TOO_LARGE
**Description:** File exceeds maximum size limit

**Limit:** 10MB per file

**Solution:** Compress or resize the file before upload

### MED-002: UNSUPPORTED_MEDIA_TYPE
**Description:** Media type is not supported

**Solution:** Convert to a supported format (see VAL-007)

### MED-003: MEDIA_PROCESSING_FAILED
**Description:** Failed to process media file

**Common Causes:**
- Corrupted file
- Invalid file format
- Insufficient server resources

### MED-004: INVALID_IMAGE_FORMAT
**Description:** Image format is invalid or corrupted

**Solution:** Ensure image is a valid JPEG, PNG, GIF, or WebP file

### MED-005: VIDEO_CODEC_UNSUPPORTED
**Description:** Video codec is not supported

**Supported Codecs:**
- H.264 for MP4
- VP8/VP9 for WebM

## Rate Limiting Errors (RTE-xxx)

### RTE-001: RATE_LIMIT_EXCEEDED
**Description:** Too many requests in time window

**Limit:** 100 requests per 15 minutes per IP

**Solution:**
```javascript
// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### RTE-002: QUOTA_EXCEEDED
**Description:** API quota has been exceeded

**Solution:** Wait for quota reset or upgrade plan

### RTE-003: TOO_MANY_REQUESTS
**Description:** Request rate is too high

**Solution:** Implement request throttling on client side

## Authentication Errors (AUTH-xxx)

### AUTH-001: UNAUTHORIZED
**Description:** Authentication required but not provided

**Solution:**
```javascript
fetch('/api/protected', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

### AUTH-002: INVALID_TOKEN
**Description:** Authentication token is invalid or expired

**Solution:** Refresh or obtain a new authentication token

### AUTH-003: INSUFFICIENT_PERMISSIONS
**Description:** User doesn't have required permissions

**Solution:** Request appropriate permissions or use authorized account

## Server Errors (SRV-xxx)

### SRV-001: INTERNAL_SERVER_ERROR
**Description:** Unexpected server error occurred

**Solution:** Retry the request. If persists, contact support

### SRV-002: SERVICE_UNAVAILABLE
**Description:** Service is temporarily unavailable

**Solution:** Retry after a delay

### SRV-003: DATABASE_ERROR
**Description:** Database operation failed

**Solution:** Retry the request

### SRV-004: EXTERNAL_SERVICE_ERROR
**Description:** External service dependency failed

**Solution:** Retry or check service status

## Request Errors (REQ-xxx)

### REQ-001: INVALID_REQUEST
**Description:** Request format or parameters are invalid

**Solution:** Check API documentation for correct format

### REQ-002: MISSING_PARAMETER
**Description:** Required parameter is missing

**Solution:**
```javascript
// Ensure all required parameters are provided
fetch('/api/posts', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Required',
    content_text: 'Required'
  })
});
```

### REQ-003: INVALID_PARAMETER_TYPE
**Description:** Parameter has wrong data type

**Solution:**
```javascript
// ✅ Correct
{ "limit": 10 }

// ❌ Wrong
{ "limit": "10" }  // Should be number, not string
```

### REQ-004: PARAMETER_OUT_OF_RANGE
**Description:** Parameter value is outside allowed range

**Solution:** Check API documentation for valid ranges

## Troubleshooting Guide

### General Debugging Steps

1. **Check Error Code**: Identify the specific error code
2. **Read Error Message**: Review the detailed error message
3. **Examine Details**: Check the `details` object for specific information
4. **Verify Input**: Ensure all input data is correct
5. **Check Documentation**: Review API documentation
6. **Test with Examples**: Use provided examples to verify

### Common Issues

#### Issue: Validation Always Fails
**Check:**
- All required fields are present
- URLs use HTTPS protocol
- Dates are in ISO 8601 format
- JSON is well-formed

#### Issue: Signature Verification Fails
**Check:**
- Content hasn't been modified after signing
- Using correct public key
- Canonical JSON serialization is consistent
- Signature is properly encoded

#### Issue: Rate Limit Errors
**Solution:**
- Implement request throttling
- Use exponential backoff
- Cache responses when possible
- Batch operations when available

### Getting Help

If you continue to experience issues:

1. Check the [API Documentation](./API_DOCUMENTATION.md)
2. Review [Troubleshooting Guide](./troubleshooting.md)
3. Search [GitHub Issues](https://github.com/ansybl/protocol/issues)
4. Ask in [Community Forum](https://ansybl.org/community)

## HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |
| 503 | Service Unavailable | Service temporarily unavailable |

## Best Practices

1. **Always Check Status Codes**: Examine HTTP status codes first
2. **Parse Error Responses**: Read error codes and messages
3. **Implement Retry Logic**: Use exponential backoff for transient errors
4. **Log Errors**: Keep detailed error logs for debugging
5. **Validate Before Sending**: Validate data client-side when possible
6. **Handle Errors Gracefully**: Provide user-friendly error messages
7. **Monitor Error Rates**: Track error frequency and patterns

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Getting Started Guide](./GETTING_STARTED.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Troubleshooting Guide](./troubleshooting.md)
