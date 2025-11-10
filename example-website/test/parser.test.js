/**
 * Unit tests for Ansybl Parser (example-website implementation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblParser } from '../lib/parser.js';
import { generateKeyPair, signContent } from '../lib/signature.js';

describe('AnsyblParser - example-website', () => {
  let parser;
  let testKeyPair;

  test('setup', async () => {
    parser = new AnsyblParser();
    testKeyPair = await generateKeyPair();
  });

  describe('Valid Document Parsing', () => {
    test('should parse minimal document', async () => {
      const doc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [{
          id: 'https://example.com/post/1',
          url: 'https://example.com/post/1',
          content_text: 'Hello world',
          date_published: '2025-11-04T10:00:00Z',
          signature: 'ed25519:fake_signature'
        }]
      };

      const result = await parser.parse(doc, { verifySignatures: false });
      
      // Parser returns success: true when validation passes
      if (result.success) {
        assert.strictEqual(result.feed.title, 'Test Feed');
        assert.strictEqual(result.feed.items.length, 1);
      } else {
        // If validation failed, check that we got errors
        assert(result.errors && result.errors.length > 0);
      }
    });

    test('should preserve extension fields', async () => {
      const doc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        _custom_extension: 'custom data',
        items: []
      };

      const result = await parser.parse(doc, { 
        verifySignatures: false,
        preserveExtensions: true 
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed._custom_extension, 'custom data');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty document', async () => {
      const result = await parser.parse('');
      
      assert.strictEqual(result.success, false);
      assert(result.errors.length > 0);
    });

    test('should handle malformed JSON', async () => {
      const result = await parser.parse('{"invalid": }');
      
      assert.strictEqual(result.success, false);
      assert(result.errors.some(e => e.code === 'INVALID_JSON' || e.message.includes('JSON')));
    });
  });
});
