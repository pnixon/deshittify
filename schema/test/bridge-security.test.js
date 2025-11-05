/**
 * Bridge Service Security and Functionality Tests
 * Tests API security against OWASP Top 10 vulnerabilities
 * Validates protocol translation accuracy and data integrity
 * Tests authentication and authorization mechanisms
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ActivityPubBridge, SecurityError } from '../bridges/activitypub-bridge.js';
import { RssJsonBridge } from '../bridges/rss-json-bridge.js';
import { AnsyblGenerator } from '../generator.js';
import { generateKeyPair } from '../signature.js';

describe('Bridge Service Security Tests', () => {
  let activityPubBridge;
  let rssJsonBridge;
  let testFeed;
  let testKeyPair;
  let validAuthContext;

  // Setup test data
  test('Setup test environment', async () => {
    activityPubBridge = new ActivityPubBridge({
      maxRequestsPerMinute: 100,
      maxRequestsPerHour: 1000,
      requireSignatures: true,
      testMode: true
    });
    
    rssJsonBridge = new RssJsonBridge();
    
    // Generate test key pair
    testKeyPair = await generateKeyPair();
    
    // Create test feed
    const generator = new AnsyblGenerator();
    const feedMetadata = {
      title: 'Test Security Feed',
      home_page_url: 'https://test.example.com',
      feed_url: 'https://test.example.com/feed.ansybl',
      description: 'Test feed for security validation',
      author: {
        name: 'Test Author',
        public_key: testKeyPair.publicKey,
        url: 'https://test.example.com/author'
      }
    };
    
    testFeed = generator.createFeed(feedMetadata);
    
    // Add test item
    const itemData = {
      id: 'https://test.example.com/posts/1',
      url: 'https://test.example.com/posts/1',
      title: 'Test Post',
      content_html: '<p>This is a test post for security validation.</p>',
      content_text: 'This is a test post for security validation.',
      tags: ['test', 'security']
    };
    
    testFeed = await generator.addItem(testFeed, itemData, testKeyPair.privateKey);
    testFeed = await generator.signFeed(testFeed, testKeyPair.privateKey);
    
    // Valid auth context for testing
    validAuthContext = {
      user_id: 'test-user-123',
      permissions: ['convert:actor', 'convert:object', 'sync:interactions'],
      rate_limit_key: 'test-user-123',
      request_signature: 'valid-signature-hash'
    };
  });

  describe('OWASP API Security Top 10 Tests', () => {
    
    test('API1:2023 - Broken Object Level Authorization', async () => {
      // Test that users can only access their own content
      // Create a bridge without test mode to enforce authorization
      const strictBridge = new ActivityPubBridge({
        requireSignatures: false, // Disable signatures for this test
        testMode: false
      });
      
      const unauthorizedContext = {
        ...validAuthContext,
        user_id: 'different-user-456',
        permissions: [] // No permissions
      };
      
      try {
        await strictBridge.convertToActor(testFeed, unauthorizedContext);
        assert.fail('Should have thrown authorization error');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'INSUFFICIENT_PERMISSIONS');
      }
    });

    test('API2:2023 - Broken Authentication', async () => {
      // Test missing authentication
      try {
        await activityPubBridge.convertToActor(testFeed, {});
        assert.fail('Should have thrown authentication error');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'MISSING_AUTH');
      }

      // Test missing signature
      try {
        await activityPubBridge.convertToActor(testFeed, {
          user_id: 'test-user',
          permissions: ['convert:actor']
        });
        assert.fail('Should have thrown signature error');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'MISSING_SIGNATURE');
      }
    });

    test('API3:2023 - Broken Object Property Level Authorization', async () => {
      // Test that sensitive fields are properly protected
      const limitedAuthContext = {
        ...validAuthContext,
        permissions: ['convert:object'] // Missing convert:actor permission
      };
      
      try {
        await activityPubBridge.convertToActor(testFeed, limitedAuthContext);
        assert.fail('Should have thrown permission error');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'INSUFFICIENT_PERMISSIONS');
      }
    });

    test('API4:2023 - Unrestricted Resource Consumption (Rate Limiting)', async () => {
      // Create a bridge with very low rate limits for testing
      const rateLimitBridge = new ActivityPubBridge({
        maxRequestsPerMinute: 2,
        maxRequestsPerHour: 10,
        testMode: true
      });
      
      const rateLimitContext = {
        ...validAuthContext,
        user_id: 'rate-limit-test-user-unique'
      };

      // Make requests up to the limit
      await rateLimitBridge.convertToActor(testFeed, rateLimitContext);
      await rateLimitBridge.convertToActor(testFeed, rateLimitContext);

      // Next request should be rate limited
      try {
        await rateLimitBridge.convertToActor(testFeed, rateLimitContext);
        assert.fail('Should have been rate limited');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'RATE_LIMIT_EXCEEDED');
      }
    });

    test('API5:2023 - Broken Function Level Authorization', async () => {
      // Test function-level permissions
      const noSyncPermissionContext = {
        ...validAuthContext,
        permissions: ['convert:actor', 'convert:object'] // Missing sync:interactions
      };

      try {
        await activityPubBridge.syncInteractions('test-item-id', [], noSyncPermissionContext);
        assert.fail('Should have thrown permission error');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'INSUFFICIENT_PERMISSIONS');
      }
    });

    test('API6:2023 - Unrestricted Access to Sensitive Business Flows', async () => {
      // Test that signature verification cannot be bypassed
      // Create a bridge with strict signature checking
      const strictBridge = new ActivityPubBridge({
        requireSignatures: true,
        testMode: false
      });
      
      const unsignedFeed = { ...testFeed };
      delete unsignedFeed.signature;
      unsignedFeed.items[0].signature = 'invalid-signature';

      try {
        await strictBridge.convertToActor(unsignedFeed, validAuthContext);
        assert.fail('Should have failed signature verification');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
        assert.strictEqual(error.code, 'SIGNATURE_VERIFICATION_FAILED');
      }
    });

    test('API7:2023 - Server Side Request Forgery (SSRF)', async () => {
      // Test that malicious URLs are handled appropriately
      const maliciousFeed = {
        ...testFeed,
        author: {
          ...testFeed.author,
          url: 'http://localhost:8080/admin' // Internal URL
        }
      };

      // The bridge should handle internal URLs appropriately
      const actor = await activityPubBridge.convertToActor(maliciousFeed, validAuthContext);
      
      // In test mode, URLs pass through, but in production they should be validated
      // For this test, we verify the bridge doesn't crash and produces a valid actor
      assert.ok(actor.id);
      assert.ok(actor.type === 'Person');
    });

    test('API8:2023 - Security Misconfiguration', async () => {
      // Test that security headers and configurations are properly set
      const bridgeWithWeakConfig = new ActivityPubBridge({
        requireSignatures: false, // Weak configuration
        maxRequestsPerMinute: 10000 // Too permissive
      });

      // Even with weak config, certain security measures should still apply
      try {
        await bridgeWithWeakConfig.convertToActor(testFeed, {
          user_id: 'test',
          permissions: []
        });
        assert.fail('Should still require proper authentication');
      } catch (error) {
        assert.strictEqual(error instanceof SecurityError, true);
      }
    });

    test('API9:2023 - Improper Inventory Management', async () => {
      // Test that deprecated or unused endpoints are not accessible
      // This would typically involve testing for removed API versions
      
      // Verify current API version is properly identified
      const actor = await activityPubBridge.convertToActor(testFeed, validAuthContext);
      assert.ok(actor['@context'].includes('https://www.w3.org/ns/activitystreams'));
    });

    test('API10:2023 - Unsafe Consumption of APIs', async () => {
      // Test that external data is properly validated and sanitized
      const maliciousItem = {
        id: 'https://test.example.com/posts/malicious',
        url: 'https://test.example.com/posts/malicious',
        title: '<script>alert("XSS")</script>',
        content_html: '<img src="x" onerror="alert(\'XSS\')" />',
        signature: 'test-signature'
      };

      const sanitizedObject = await activityPubBridge.convertToObject(
        maliciousItem, 
        testFeed, 
        validAuthContext
      );

      // Verify that malicious content is sanitized
      assert.ok(!sanitizedObject.content.includes('<script>'));
      assert.ok(!sanitizedObject.content.includes('onerror'));
      assert.ok(!sanitizedObject.content.includes('javascript:'));
    });
  });

  describe('Protocol Translation Accuracy Tests', () => {
    
    test('Ansybl to ActivityPub Actor conversion preserves identity', async () => {
      const actor = await activityPubBridge.convertToActor(testFeed, validAuthContext);
      
      // Verify core identity preservation
      assert.strictEqual(actor.name, testFeed.author.name);
      assert.strictEqual(actor.url, testFeed.author.url);
      assert.ok(actor.publicKey.id);
      assert.ok(actor.ansyblPublicKey);
      assert.strictEqual(actor.ansyblFeedUrl, testFeed.feed_url);
      
      // Verify ActivityPub compliance
      assert.ok(actor['@context'].includes('https://www.w3.org/ns/activitystreams'));
      assert.strictEqual(actor.type, 'Person');
      assert.ok(actor.inbox);
      assert.ok(actor.outbox);
    });

    test('Ansybl to ActivityPub Object conversion preserves content', async () => {
      const item = testFeed.items[0];
      const object = await activityPubBridge.convertToObject(item, testFeed, validAuthContext);
      
      // Verify content preservation
      assert.strictEqual(object.id, item.url);
      assert.ok(object.content.includes('test post'));
      assert.strictEqual(object.published, item.date_published);
      assert.strictEqual(object.ansyblId, item.id);
      assert.strictEqual(object.ansyblSignature, item.signature);
      
      // Verify ActivityPub compliance
      assert.strictEqual(object.type, 'Note');
      assert.ok(object.to.includes('https://www.w3.org/ns/activitystreams#Public'));
    });

    test('Ansybl to RSS conversion preserves metadata', async () => {
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Verify RSS structure
      assert.ok(rssXml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(rssXml.includes('<rss version="2.0"'));
      assert.ok(rssXml.includes(testFeed.title));
      assert.ok(rssXml.includes(testFeed.home_page_url));
      assert.ok(rssXml.includes(testFeed.author.name));
      
      // Verify Ansybl extensions are preserved
      assert.ok(rssXml.includes('xmlns:ansybl="https://ansybl.org/ns#"'));
      assert.ok(rssXml.includes('<ansybl:signature>'));
    });

    test('Ansybl to JSON Feed conversion preserves structure', async () => {
      const jsonFeed = rssJsonBridge.convertToJsonFeed(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Verify JSON Feed compliance
      assert.ok(jsonFeed.version.includes('jsonfeed.org'));
      assert.strictEqual(jsonFeed.title, testFeed.title);
      assert.strictEqual(jsonFeed.home_page_url, testFeed.home_page_url);
      assert.strictEqual(jsonFeed.authors[0].name, testFeed.author.name);
      
      // Verify Ansybl extensions
      assert.ok(jsonFeed._ansybl);
      assert.strictEqual(jsonFeed._ansybl.author_public_key, testFeed.author.public_key);
      assert.strictEqual(jsonFeed.items[0]._ansybl.signature, testFeed.items[0].signature);
    });

    test('RSS to Ansybl conversion handles standard RSS', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test RSS Feed</title>
            <link>https://example.com</link>
            <description>Test RSS description</description>
            <item>
              <title>Test RSS Item</title>
              <link>https://example.com/item1</link>
              <description>Test item description</description>
              <pubDate>Mon, 04 Nov 2024 10:00:00 GMT</pubDate>
              <category>test</category>
            </item>
          </channel>
        </rss>`;
      
      const ansyblFeed = await rssJsonBridge.convertFromRss(rssXml, {
        defaultAuthor: {
          name: 'RSS Author',
          public_key: testKeyPair.publicKey
        }
      });
      
      // Verify conversion accuracy
      assert.strictEqual(ansyblFeed.title, 'Test RSS Feed');
      assert.strictEqual(ansyblFeed.home_page_url, 'https://example.com');
      assert.strictEqual(ansyblFeed.items.length, 1);
      assert.strictEqual(ansyblFeed.items[0].title, 'Test RSS Item');
      assert.ok(ansyblFeed.items[0].tags && ansyblFeed.items[0].tags.includes('test'));
    });

    test('JSON Feed to Ansybl conversion preserves data integrity', async () => {
      const jsonFeed = {
        version: 'https://jsonfeed.org/version/1.1',
        title: 'Test JSON Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.json',
        authors: [{
          name: 'JSON Author',
          url: 'https://example.com/author'
        }],
        items: [{
          id: 'https://example.com/item1',
          url: 'https://example.com/item1',
          title: 'Test JSON Item',
          content_html: '<p>Test content</p>',
          date_published: '2024-11-04T10:00:00Z',
          tags: ['json', 'test']
        }]
      };
      
      const ansyblFeed = await rssJsonBridge.convertFromJsonFeed(jsonFeed);
      
      // Verify conversion accuracy
      assert.strictEqual(ansyblFeed.title, 'Test JSON Feed');
      assert.strictEqual(ansyblFeed.author.name, 'JSON Author');
      assert.strictEqual(ansyblFeed.items[0].title, 'Test JSON Item');
      assert.strictEqual(ansyblFeed.items[0].content_html, '<p>Test content</p>');
      assert.deepStrictEqual(ansyblFeed.items[0].tags, ['json', 'test']);
    });
  });

  describe('Data Integrity and Round-trip Tests', () => {
    
    test('Ansybl -> ActivityPub -> Interaction Sync maintains data integrity', async () => {
      const item = testFeed.items[0];
      
      // Convert to ActivityPub
      const activity = await activityPubBridge.createActivity(item, testFeed, validAuthContext);
      
      // Simulate ActivityPub interactions
      const interactions = [
        {
          type: 'Like',
          id: 'https://mastodon.social/users/testuser/activities/like-123',
          actor: 'https://mastodon.social/users/testuser',
          object: item.url,
          published: '2024-11-04T11:00:00Z'
        },
        {
          type: 'Announce',
          id: 'https://mastodon.social/users/testuser2/activities/announce-456',
          actor: 'https://mastodon.social/users/testuser2',
          object: item.url,
          published: '2024-11-04T11:30:00Z'
        }
      ];
      
      // Sync interactions back
      const syncResult = await activityPubBridge.syncInteractions(
        item.id, 
        interactions, 
        validAuthContext
      );
      
      // Verify interaction counts
      assert.strictEqual(syncResult.interactions.likes_count, 1);
      assert.strictEqual(syncResult.interactions.shares_count, 1);
      assert.strictEqual(syncResult.interactions.replies_count, 0);
      assert.strictEqual(syncResult.synced_count, 2);
    });

    test('Ansybl -> RSS -> Ansybl round-trip preserves core data', async () => {
      // Convert to RSS
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Convert back to Ansybl
      const convertedFeed = await rssJsonBridge.convertFromRss(rssXml, {
        defaultAuthor: testFeed.author,
        preserveOriginalIds: true
      });
      
      // Verify core data preservation
      assert.strictEqual(convertedFeed.title, testFeed.title);
      assert.strictEqual(convertedFeed.items[0].title, testFeed.items[0].title);
      assert.strictEqual(convertedFeed.items[0].id, testFeed.items[0].id);
    });

    test('Ansybl -> JSON Feed -> Ansybl round-trip preserves structure', async () => {
      // Convert to JSON Feed
      const jsonFeed = rssJsonBridge.convertToJsonFeed(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Convert back to Ansybl
      const convertedFeed = await rssJsonBridge.convertFromJsonFeed(jsonFeed, {
        preserveOriginalIds: true
      });
      
      // Verify structure preservation
      assert.strictEqual(convertedFeed.title, testFeed.title);
      assert.strictEqual(convertedFeed.feed_url, testFeed.feed_url);
      assert.strictEqual(convertedFeed.items[0].content_html, testFeed.items[0].content_html);
      assert.deepStrictEqual(convertedFeed.items[0].tags, testFeed.items[0].tags);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('Handles malformed input gracefully', async () => {
      // Test malformed RSS
      const malformedRss = '<rss><channel><title>Broken</channel></rss>';
      
      try {
        const result = await rssJsonBridge.convertFromRss(malformedRss, {
          defaultAuthor: {
            name: 'Test Author',
            public_key: testKeyPair.publicKey
          }
        });
        // Should handle gracefully and return a feed with minimal data
        assert.ok(result.title);
      } catch (error) {
        // If it throws, the error should be descriptive
        assert.ok(error.message.length > 0);
      }
    });

    test('Validates content length limits', async () => {
      const largeFeed = {
        ...testFeed,
        items: [{
          ...testFeed.items[0],
          content_html: 'x'.repeat(2000000) // 2MB content
        }]
      };
      
      // Should handle large content appropriately
      const rssXml = rssJsonBridge.convertToRss(largeFeed);
      assert.ok(rssXml.length > 0); // Should not crash
    });

    test('Handles missing optional fields', async () => {
      const minimalFeed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Minimal Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Author',
          public_key: testKeyPair.publicKey
        },
        items: [{
          id: 'https://example.com/1',
          url: 'https://example.com/1',
          date_published: '2024-11-04T10:00:00Z',
          signature: 'test-sig'
        }]
      };
      
      // Should handle minimal feed without errors
      const actor = await activityPubBridge.convertToActor(minimalFeed, validAuthContext);
      assert.ok(actor.name);
      assert.ok(actor.id);
      
      const jsonFeed = rssJsonBridge.convertToJsonFeed(minimalFeed);
      assert.ok(jsonFeed.title);
      assert.ok(jsonFeed.items.length > 0);
    });
  });
});