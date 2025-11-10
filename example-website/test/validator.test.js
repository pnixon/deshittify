/**
 * Unit tests for Ansybl Validator (example-website implementation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblValidator } from '../lib/validator.js';

describe('AnsyblValidator - example-website', () => {
  const validator = new AnsyblValidator();

  const validMinimalFeed = {
    version: 'https://ansybl.org/version/1.0',
    title: 'Test Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    author: {
      name: 'Test Author',
      public_key: 'ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=='
    },
    items: [
      {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world',
        date_published: '2025-11-04T10:00:00Z',
        signature: 'ed25519:dGVzdHNpZ25hdHVyZQ=='
      }
    ]
  };

  describe('Valid Documents', () => {
    test('should validate minimal feed', () => {
      const result = validator.validateDocument(validMinimalFeed);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should validate JSON string', () => {
      const jsonString = JSON.stringify(validMinimalFeed);
      const result = validator.validateDocument(jsonString);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('Required Fields', () => {
    test('should fail when missing version', () => {
      const invalid = { ...validMinimalFeed };
      delete invalid.version;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.message.includes('version')));
    });

    test('should fail when missing title', () => {
      const invalid = { ...validMinimalFeed };
      delete invalid.title;
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.message.includes('title')));
    });
  });

  describe('URL Validation', () => {
    test('should fail with non-HTTPS URLs', () => {
      const invalid = JSON.parse(JSON.stringify(validMinimalFeed));
      invalid.home_page_url = 'http://example.com';
      
      const result = validator.validateDocument(invalid);
      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.message.includes('HTTPS') || e.message.includes('https')));
    });
  });

  describe('Extension Fields', () => {
    test('should accept extension fields with underscore', () => {
      const valid = JSON.parse(JSON.stringify(validMinimalFeed));
      valid._custom_field = 'custom data';
      
      const result = validator.validateDocument(valid);
      assert.strictEqual(result.valid, true);
    });
  });
});
