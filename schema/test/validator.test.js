/**
 * Comprehensive tests for Ansybl schema validation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblValidator } from '../validator.js';

describe('AnsyblValidator', () => {
  const validator = new AnsyblValidator();

  // Valid test documents
  const validMinimalFeed = {
    "version": "https://ansybl.org/version/1.0",
    "title": "Test Feed",
    "home_page_url": "https://example.com",
    "feed_url": "https://example.com/feed.ansybl",
    "author": {
      "name": "Test Author",
      "public_key": "ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=="
    },
    "items": [
      {
        "id": "https://example.com/post/1",
        "url": "https://example.com/post/1",
        "content_text": "Hello world!",
        "date_published": "2025-11-04T10:00:00Z",
        "signature": "ed25519:dGVzdHNpZ25hdHVyZWRhdGE="
      }
    ]
  };

  const validComprehensiveFeed = {
    "version": "https://ansybl.org/version/1.0",
    "title": "Comprehensive Test Feed",
    "home_page_url": "https://example.com",
    "feed_url": "https://example.com/feed.ansybl",
    "description": "A test feed with all features",
    "icon": "https://example.com/icon.png",
    "language": "en-US",
    "author": {
      "name": "Test Author",
      "url": "https://example.com/author",
      "avatar": "https://example.com/avatar.jpg",
      "public_key": "ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=="
    },
    "items": [
      {
        "id": "https://example.com/post/1",
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "url": "https://example.com/post/1",
        "title": "Test Post",
        "content_text": "Hello world!",
        "content_html": "<p>Hello <strong>world</strong>!</p>",
        "summary": "A test post",
        "date_published": "2025-11-04T10:00:00Z",
        "date_modified": "2025-11-04T10:30:00Z",
        "tags": ["test", "hello-world"],
        "attachments": [
          {
            "url": "https://example.com/image.jpg",
            "mime_type": "image/jpeg",
            "title": "Test Image",
            "size_in_bytes": 12345,
            "width": 800,
            "height": 600,
            "alt_text": "A test image",
            "blurhash": "LGF5]+Yk^6#M@-5c,1J5@[or[Q6."
          }
        ],
        "interactions": {
          "replies_count": 5,
          "likes_count": 10,
          "shares_count": 2,
          "replies_url": "https://example.com/post/1/replies"
        },
        "signature": "ed25519:dGVzdHNpZ25hdHVyZWRhdGE="
      }
    ],
    "signature": "ed25519:ZmVlZHNpZ25hdHVyZWRhdGE=",
    "_custom_extension": "extension data"
  };

  describe('Valid Documents', () => {
    test('validates minimal valid feed', () => {
      const result = validator.validateDocument(validMinimalFeed);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('validates comprehensive valid feed', () => {
      const result = validator.validateDocument(validComprehensiveFeed);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('validates JSON string input', () => {
      const jsonString = JSON.stringify(validMinimalFeed);
      const result = validator.validateDocument(jsonString);
      assert.strictEqual(result.valid, true);
    });

    test('generates warnings for missing optional fields', () => {
      const result = validator.validateDocument(validMinimalFeed);
      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.length > 0);
      
      const warningCodes = result.warnings.map(w => w.code);
      assert.ok(warningCodes.includes('MISSING_DESCRIPTION'));
      assert.ok(warningCodes.includes('MISSING_ICON'));
    });
  });

  describe('Invalid JSON', () => {
    test('handles malformed JSON', () => {
      const malformedJson = '{"title": "test", "invalid": }';
      const result = validator.validateDocument(malformedJson);
      
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors[0].code, 'INVALID_JSON');
      assert.ok(result.errors[0].suggestions.length > 0);
    });
  });

  describe('Required Fields', () => {
    test('fails when missing version', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      delete invalid.version;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'MISSING_REQUIRED_FIELD');
      assert.ok(error);
      assert.ok(error.message.includes('version'));
    });

    test('fails when missing title', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      delete invalid.title;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'MISSING_REQUIRED_FIELD');
      assert.ok(error);
      assert.ok(error.message.includes('title'));
    });

    test('fails when missing author public_key', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      delete invalid.author.public_key;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'MISSING_REQUIRED_FIELD');
      assert.ok(error);
      assert.ok(error.message.includes('public_key'));
    });

    test('fails when item missing content', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      delete invalid.items[0].content_text;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'MISSING_CONTENT');
      assert.ok(error);
    });
  });

  describe('URL Validation', () => {
    test('fails with non-HTTPS URLs', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.home_page_url = "http://example.com";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_PATTERN');
      assert.ok(error);
      assert.ok(error.message.includes('HTTPS'));
    });

    test('fails with invalid URL format', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.feed_url = "not-a-url";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_FORMAT' || e.code === 'INVALID_PATTERN');
      assert.ok(error);
    });
  });

  describe('Signature Validation', () => {
    test('fails with invalid signature format', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.items[0].signature = "invalid-signature";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_PATTERN');
      assert.ok(error);
      assert.ok(error.message.includes('ed25519'));
    });

    test('accepts valid ed25519 signature format', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0].signature = "ed25519:dGVzdHNpZ25hdHVyZWRhdGE=";
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Date Validation', () => {
    test('fails with invalid date format', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.items[0].date_published = "2025-13-45";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_FORMAT');
      assert.ok(error);
      assert.ok(error.message.includes('ISO 8601'));
    });

    test('accepts valid ISO 8601 dates', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0].date_published = "2025-11-04T10:00:00.000Z";
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Extension Fields', () => {
    test('accepts extension fields with underscore prefix', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid._custom_field = "custom data";
      valid.items[0]._item_extension = "item data";
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });

    test('fails with unknown fields without underscore', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.unknown_field = "should fail";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'UNKNOWN_FIELD');
      assert.ok(error);
      assert.ok(error.message.includes('underscore'));
    });
  });

  describe('Content Type Validation', () => {
    test('accepts content_text only', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0] = {
        ...valid.items[0],
        content_text: "Text content"
      };
      delete valid.items[0].content_html;
      delete valid.items[0].content_markdown;
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });

    test('accepts content_html only', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0] = {
        ...valid.items[0],
        content_html: "<p>HTML content</p>"
      };
      delete valid.items[0].content_text;
      delete valid.items[0].content_markdown;
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });

    test('accepts multiple content types', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0] = {
        ...valid.items[0],
        content_text: "Text content",
        content_html: "<p>HTML content</p>",
        content_markdown: "# Markdown content"
      };
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Attachment Validation', () => {
    test('validates image attachments', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid.items[0].attachments = [
        {
          url: "https://example.com/image.jpg",
          mime_type: "image/jpeg",
          width: 800,
          height: 600,
          alt_text: "Test image"
        }
      ];
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });

    test('fails with invalid MIME type', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.items[0].attachments = [
        {
          url: "https://example.com/file",
          mime_type: "invalid/mime/type"
        }
      ];
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_PATTERN');
      assert.ok(error);
    });
  });

  describe('Language Code Validation', () => {
    test('accepts valid language codes', () => {
      const testCases = ['en', 'en-US', 'fr', 'de-DE', 'zh-CN'];
      
      testCases.forEach(lang => {
        const valid = JSON.parse(JSON.stringify(validMinimalFeed));
        valid.language = lang;
        
        const result = validator.validateDocument(valid);
        assert.strictEqual(result.valid, true, `Language ${lang} should be valid`);
      });
    });

    test('fails with invalid language codes', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.language = "invalid-lang-code";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'INVALID_PATTERN');
      assert.ok(error);
    });
  });

  describe('Field Length Validation', () => {
    test('fails with title too long', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.title = "a".repeat(201); // Max is 200
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'TOO_LONG');
      assert.ok(error);
      assert.ok(error.message.includes('200'));
    });

    test('fails with empty required string', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.title = "";
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      
      const error = result.errors.find(e => e.code === 'TOO_SHORT');
      assert.ok(error);
    });
  });

  describe('Error Message Quality', () => {
    test('provides actionable suggestions', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      delete invalid.author.public_key;
      
      const result = validator.validateDocument(invalid);
      const error = result.errors[0];
      
      assert.ok(error.suggestions);
      assert.ok(error.suggestions.length > 0);
      assert.ok(error.suggestions.some(s => s.includes('ed25519')));
    });

    test('includes field path in errors', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.items[0].date_published = "invalid-date";
      
      const result = validator.validateDocument(invalid);
      const error = result.errors[0];
      
      assert.ok(error.field);
      assert.ok(error.field.includes('date_published'));
    });
  });
});