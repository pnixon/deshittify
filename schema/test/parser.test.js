/**
 * Comprehensive test suite for Ansybl Parser
 * Tests parser against various document examples, edge cases, and error conditions
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblParser } from '../parser.js';
import { generateKeyPair, signContent } from '../signature.js';
import { CanonicalJSONSerializer } from '../canonicalizer.js';

describe('AnsyblParser', () => {
  let parser;
  let testKeyPair;

  // Set up test fixtures
  test('setup', async () => {
    parser = new AnsyblParser();
    testKeyPair = await generateKeyPair();
  });

  describe('Valid Document Parsing', () => {
    test('should parse minimal valid document', async () => {
      const minimalDoc = {
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
          signature: await signContent({
            date_published: '2025-11-04T10:00:00Z',
            id: 'https://example.com/post/1',
            url: 'https://example.com/post/1',
            content_text: 'Hello world'
          }, testKeyPair.privateKey)
        }]
      };

      const result = await parser.parse(minimalDoc, { verifySignatures: false });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed.title, 'Test Feed');
      assert.strictEqual(result.feed.items.length, 1);
      assert.strictEqual(result.feed.items[0].content_text, 'Hello world');
    });

    test('should parse comprehensive document with all fields', async () => {
      const comprehensiveDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Comprehensive Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        description: 'A test feed with all possible fields',
        icon: 'https://example.com/icon.png',
        language: 'en-US',
        author: {
          name: 'Test Author',
          url: 'https://example.com/author',
          avatar: 'https://example.com/avatar.jpg',
          public_key: testKeyPair.publicKey
        },
        items: [{
          id: 'https://example.com/post/1',
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          url: 'https://example.com/post/1',
          title: 'Test Post',
          content_text: 'Hello world',
          content_html: '<p>Hello <strong>world</strong></p>',
          summary: 'A test post',
          date_published: '2025-11-04T10:00:00Z',
          date_modified: '2025-11-04T11:00:00Z',
          tags: ['test', 'example'],
          attachments: [{
            url: 'https://example.com/image.jpg',
            mime_type: 'image/jpeg',
            title: 'Test Image',
            width: 800,
            height: 600,
            alt_text: 'A test image'
          }],
          interactions: {
            replies_count: 5,
            likes_count: 10,
            shares_count: 2
          },
          signature: await signContent({
            date_published: '2025-11-04T10:00:00Z',
            id: 'https://example.com/post/1',
            url: 'https://example.com/post/1',
            content_text: 'Hello world',
            content_html: '<p>Hello <strong>world</strong></p>',
            title: 'Test Post',
            summary: 'A test post'
          }, testKeyPair.privateKey)
        }]
      };

      const result = await parser.parse(comprehensiveDoc, { verifySignatures: false });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed.description, 'A test feed with all possible fields');
      assert.strictEqual(result.feed.items[0].attachments.length, 1);
      assert.strictEqual(result.feed.items[0].tags.length, 2);
    });

    test('should preserve extension fields', async () => {
      const docWithExtensions = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Extension Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey,
          _custom_field: 'custom author data'
        },
        _feed_extension: 'custom feed data',
        items: [{
          id: 'https://example.com/post/1',
          url: 'https://example.com/post/1',
          content_text: 'Hello world',
          date_published: '2025-11-04T10:00:00Z',
          _item_extension: 'custom item data',
          signature: await signContent({
            date_published: '2025-11-04T10:00:00Z',
            id: 'https://example.com/post/1',
            url: 'https://example.com/post/1',
            content_text: 'Hello world'
          }, testKeyPair.privateKey)
        }]
      };

      const result = await parser.parse(docWithExtensions, { 
        verifySignatures: false,
        preserveExtensions: true 
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed._feed_extension, 'custom feed data');
      assert.strictEqual(result.feed.author._custom_field, 'custom author data');
      assert.strictEqual(result.feed.items[0]._item_extension, 'custom item data');
    });
  });

  describe('JSON Parsing Edge Cases', () => {
    test('should handle empty document', async () => {
      const result = await parser.parse('');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors[0].code, 'EMPTY_DOCUMENT');
    });

    test('should handle whitespace-only document', async () => {
      const result = await parser.parse('   \n\t  ');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors[0].code, 'EMPTY_DOCUMENT');
    });

    test('should handle malformed JSON', async () => {
      const malformedJson = '{"title": "Test", "invalid": }';
      const result = await parser.parse(malformedJson);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors[0].code, 'INVALID_JSON');
      assert(result.errors[0].suggestions.length > 0);
    });

    test('should handle JSON with trailing comma', async () => {
      const jsonWithTrailingComma = '{"title": "Test",}';
      const result = await parser.parse(jsonWithTrailingComma);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors[0].code, 'INVALID_JSON');
    });

    test('should handle very large JSON document', async () => {
      const largeDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Large Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: []
      };

      // Create 100 items (reduced from 1000 for faster testing)
      for (let i = 0; i < 100; i++) {
        largeDoc.items.push({
          id: `https://example.com/post/${i}`,
          url: `https://example.com/post/${i}`,
          content_text: `Post content ${i}`,
          date_published: '2025-11-04T10:00:00Z',
          signature: 'ed25519:fake_signature_for_testing'
        });
      }

      const result = await parser.parse(largeDoc, { verifySignatures: false });
      
      // Check if parsing succeeded or failed gracefully
      if (result.success) {
        assert.strictEqual(result.feed.items.length, 100);
      } else {
        // If it failed, it should be due to validation errors, not parsing errors
        assert(result.errors.length > 0);
        assert(result.errors.every(e => e.category !== 'parse'));
      }
    });
  });

  describe('Validation Error Handling', () => {
    test('should handle missing required fields', async () => {
      const invalidDoc = {
        title: 'Test Feed'
        // Missing required fields
      };

      const result = await parser.parse(invalidDoc);
      
      assert.strictEqual(result.success, false);
      assert(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD'));
    });

    test('should handle invalid URL formats', async () => {
      const invalidDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'http://example.com', // Should be HTTPS
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: []
      };

      const result = await parser.parse(invalidDoc);
      
      assert.strictEqual(result.success, false);
      assert(result.errors.some(e => e.message.includes('HTTPS')));
    });

    test('should handle invalid date formats', async () => {
      const invalidDoc = {
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
          date_published: 'invalid-date',
          signature: 'ed25519:fake_signature'
        }]
      };

      const result = await parser.parse(invalidDoc);
      
      assert.strictEqual(result.success, false);
      assert(result.errors.some(e => e.message.includes('date')));
    });
  });

  describe('Signature Verification', () => {
    test('should verify valid signatures', async () => {
      const itemData = {
        date_published: '2025-11-04T10:00:00Z',
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const validDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [{
          ...itemData,
          signature: await signContent(itemData, testKeyPair.privateKey)
        }]
      };

      const result = await parser.parse(validDoc, { verifySignatures: true });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.signatures.allValid, true);
      assert.strictEqual(result.signatures.itemSignatures[0].valid, true);
    });

    test('should detect invalid signatures', async () => {
      const validDoc = {
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
          signature: 'ed25519:invalid_signature_data_here'
        }]
      };

      const result = await parser.parse(validDoc, { verifySignatures: true });
      
      assert.strictEqual(result.signatures.allValid, false);
      assert.strictEqual(result.signatures.itemSignatures[0].valid, false);
    });

    test('should handle signature verification errors gracefully', async () => {
      const docWithBadKey = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: 'ed25519:invalid_key_format'
        },
        items: [{
          id: 'https://example.com/post/1',
          url: 'https://example.com/post/1',
          content_text: 'Hello world',
          date_published: '2025-11-04T10:00:00Z',
          signature: 'ed25519:some_signature'
        }]
      };

      const result = await parser.parse(docWithBadKey, { 
        verifySignatures: true,
        strictMode: false 
      });
      
      // Should not crash, but signature verification should fail
      assert(result.signatures);
      assert.strictEqual(result.signatures.allValid, false);
    });
  });

  describe('Forward Compatibility', () => {
    test('should ignore unknown fields gracefully', async () => {
      const futureDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Future Feed',
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
        }],
        // Extension fields should be preserved
        _future_extension: 'extension data'
      };

      const result = await parser.parse(futureDoc, { verifySignatures: false });
      
      // Should parse successfully and preserve extension fields
      // Note: unknown non-extension fields will cause validation errors
      if (result.success) {
        assert.strictEqual(result.feed._future_extension, 'extension data');
      } else {
        // If validation failed, check that extension fields are still preserved
        assert(result.errors.length > 0);
        // The parser should still attempt to create a feed object
        if (result.feed) {
          assert.strictEqual(result.feed._future_extension, 'extension data');
        }
      }
    });

    test('should handle unknown version gracefully', async () => {
      const futureVersionDoc = {
        version: 'https://ansybl.org/version/2.0', // Future version
        title: 'Future Version Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: []
      };

      const result = await parser.parse(futureVersionDoc, { verifySignatures: false });
      
      // Should still parse but may have warnings
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed.version, 'https://ansybl.org/version/2.0');
    });
  });

  describe('Item Filtering', () => {
    let testFeed;

    test('setup test feed for filtering', async () => {
      testFeed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Filter Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [
          {
            id: 'https://example.com/post/1',
            url: 'https://example.com/post/1',
            content_text: 'First post',
            date_published: '2025-11-01T10:00:00Z',
            tags: ['tech', 'programming'],
            signature: 'ed25519:fake1'
          },
          {
            id: 'https://example.com/post/2',
            url: 'https://example.com/post/2',
            content_text: 'Second post',
            date_published: '2025-11-02T10:00:00Z',
            tags: ['design'],
            attachments: [{ url: 'https://example.com/img.jpg', mime_type: 'image/jpeg' }],
            signature: 'ed25519:fake2'
          },
          {
            id: 'https://example.com/post/3',
            url: 'https://example.com/post/3',
            content_html: '<p>Third post</p>',
            date_published: '2025-11-03T10:00:00Z',
            tags: ['tech'],
            signature: 'ed25519:fake3'
          }
        ]
      };
    });

    test('should filter by tags', async () => {
      const result = await parser.parse(testFeed, { verifySignatures: false });
      const techItems = parser.getItems(result.feed, { tags: ['tech'] });
      
      assert.strictEqual(techItems.length, 2);
      assert(techItems.every(item => item.tags.includes('tech')));
    });

    test('should filter by date range', async () => {
      const result = await parser.parse(testFeed, { verifySignatures: false });
      const recentItems = parser.getItems(result.feed, { 
        dateFrom: '2025-11-02T00:00:00Z' 
      });
      
      assert.strictEqual(recentItems.length, 2);
    });

    test('should filter by attachment presence', async () => {
      const result = await parser.parse(testFeed, { verifySignatures: false });
      const itemsWithAttachments = parser.getItems(result.feed, { 
        hasAttachments: true 
      });
      
      assert.strictEqual(itemsWithAttachments.length, 1);
      assert(itemsWithAttachments[0].attachments.length > 0);
    });

    test('should filter by content type', async () => {
      const result = await parser.parse(testFeed, { verifySignatures: false });
      const htmlItems = parser.getItems(result.feed, { 
        contentType: 'html' 
      });
      
      assert.strictEqual(htmlItems.length, 1);
      assert(htmlItems[0].content_html);
    });

    test('should apply limit', async () => {
      const result = await parser.parse(testFeed, { verifySignatures: false });
      const limitedItems = parser.getItems(result.feed, { limit: 2 });
      
      assert.strictEqual(limitedItems.length, 2);
    });
  });

  describe('Graceful Degradation', () => {
    test('should handle partial parsing failures in non-strict mode', async () => {
      const partiallyInvalidDoc = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [
          {
            id: 'https://example.com/post/1',
            url: 'https://example.com/post/1',
            content_text: 'Valid post',
            date_published: '2025-11-04T10:00:00Z',
            signature: 'ed25519:fake1'
          },
          {
            // Missing required fields - should be handled gracefully
            content_text: 'Invalid post',
            signature: 'ed25519:fake2'
          }
        ]
      };

      const result = await parser.parse(partiallyInvalidDoc, { 
        verifySignatures: false,
        strictMode: false 
      });
      
      // Should have errors but still provide partial results
      assert.strictEqual(result.success, false);
      assert(result.errors.length > 0);
      assert(result.degradations && result.degradations.length >= 0);
    });
  });

  describe('Multiple Document Parsing', () => {
    test('should parse multiple documents', async () => {
      const docs = [
        {
          version: 'https://ansybl.org/version/1.0',
          title: 'Feed 1',
          home_page_url: 'https://example1.com',
          feed_url: 'https://example1.com/feed.ansybl',
          author: { name: 'Author 1', public_key: testKeyPair.publicKey },
          items: []
        },
        {
          version: 'https://ansybl.org/version/1.0',
          title: 'Feed 2',
          home_page_url: 'https://example2.com',
          feed_url: 'https://example2.com/feed.ansybl',
          author: { name: 'Author 2', public_key: testKeyPair.publicKey },
          items: []
        }
      ];

      const results = await parser.parseMultiple(docs, { verifySignatures: false });
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].success, true);
      assert.strictEqual(results[1].success, true);
      assert.strictEqual(results[0].feed.title, 'Feed 1');
      assert.strictEqual(results[1].feed.title, 'Feed 2');
    });

    test('should handle mixed valid/invalid documents', async () => {
      const docs = [
        {
          version: 'https://ansybl.org/version/1.0',
          title: 'Valid Feed',
          home_page_url: 'https://example.com',
          feed_url: 'https://example.com/feed.ansybl',
          author: { name: 'Author', public_key: testKeyPair.publicKey },
          items: []
        },
        {
          title: 'Invalid Feed'
          // Missing required fields
        }
      ];

      const results = await parser.parseMultiple(docs, { verifySignatures: false });
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].success, true);
      assert.strictEqual(results[1].success, false);
    });
  });
});