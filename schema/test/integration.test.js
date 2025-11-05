/**
 * Comprehensive Integration Test Suite for Ansybl Protocol
 * Tests end-to-end workflows, cross-implementation compatibility, and performance
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { AnsyblParser } from '../parser.js';
import { AnsyblGenerator } from '../generator.js';
import { AnsyblValidator } from '../validator.js';
import { generateKeyPair, signContent, verifySignature } from '../signature.js';
import { CanonicalJSONSerializer } from '../canonicalizer.js';
import { ActivityPubBridge } from '../bridges/activitypub-bridge.js';
import { RssJsonBridge } from '../bridges/rss-json-bridge.js';
import { WebringRegistry } from '../webring-registry.js';
import { WebmentionEndpoint } from '../webmention-endpoint.js';

describe('Ansybl Protocol Integration Tests', () => {
  let parser;
  let generator;
  let validator;
  let canonicalizer;
  let testKeyPair;
  let activityPubBridge;
  let rssJsonBridge;
  let webringRegistry;
  let webmentionEndpoint;

  // Set up test fixtures
  test('setup integration test environment', async () => {
    parser = new AnsyblParser();
    generator = new AnsyblGenerator();
    validator = new AnsyblValidator();
    canonicalizer = new CanonicalJSONSerializer();
    testKeyPair = await generateKeyPair();
    
    activityPubBridge = new ActivityPubBridge();
    rssJsonBridge = new RssJsonBridge();
    webringRegistry = new WebringRegistry();
    webmentionEndpoint = new WebmentionEndpoint();
  });

  describe('End-to-End Content Workflow', () => {
    test('complete content creation and consumption workflow', async () => {
      // Step 1: Create a feed with generator
      const feedMetadata = {
        title: 'Integration Test Feed',
        home_page_url: 'https://integration-test.example.com',
        feed_url: 'https://integration-test.example.com/feed.ansybl',
        description: 'A feed for testing complete workflows',
        author: {
          name: 'Integration Test Author',
          url: 'https://integration-test.example.com/author',
          public_key: testKeyPair.publicKey
        }
      };

      const feed = generator.createFeed(feedMetadata);
      assert.strictEqual(feed.title, 'Integration Test Feed');

      // Step 2: Add content items with various features
      const textPost = {
        id: 'https://integration-test.example.com/post/1',
        url: 'https://integration-test.example.com/post/1',
        title: 'Text Post',
        content_text: 'This is a text-only post for integration testing.',
        tags: ['integration', 'test', 'text']
      };

      const mediaPost = {
        id: 'https://integration-test.example.com/post/2',
        url: 'https://integration-test.example.com/post/2',
        title: 'Media Post',
        content_html: '<p>This post has <strong>media attachments</strong>.</p>',
        attachments: [{
          url: 'https://integration-test.example.com/image.jpg',
          mime_type: 'image/jpeg',
          width: 1200,
          height: 800,
          alt_text: 'Integration test image'
        }],
        tags: ['integration', 'test', 'media']
      };

      const replyPost = {
        id: 'https://integration-test.example.com/post/3',
        url: 'https://integration-test.example.com/post/3',
        content_text: 'This is a reply to the first post.',
        in_reply_to: 'https://integration-test.example.com/post/1',
        tags: ['integration', 'test', 'reply']
      };

      // Add items to feed
      let updatedFeed = await generator.addItem(feed, textPost, testKeyPair.privateKey);
      updatedFeed = await generator.addItem(updatedFeed, mediaPost, testKeyPair.privateKey);
      updatedFeed = await generator.addItem(updatedFeed, replyPost, testKeyPair.privateKey);

      // Sign the complete feed
      const signedFeed = await generator.signFeed(updatedFeed, testKeyPair.privateKey);
      
      assert.strictEqual(signedFeed.items.length, 3);
      assert(signedFeed.signature);

      // Step 3: Serialize the feed
      const serializedFeed = generator.serialize(signedFeed);
      assert(typeof serializedFeed === 'string');

      // Step 4: Validate the serialized feed
      const validationResult = validator.validateDocument(serializedFeed);
      assert.strictEqual(validationResult.valid, true, 
        `Validation failed: ${JSON.stringify(validationResult.errors)}`);

      // Step 5: Parse the feed back
      const parseResult = await parser.parse(serializedFeed, { verifySignatures: true });
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.signatures.allValid, true);

      // Step 6: Verify content integrity
      const parsedFeed = parseResult.feed;
      assert.strictEqual(parsedFeed.title, 'Integration Test Feed');
      assert.strictEqual(parsedFeed.items.length, 3);
      
      // Verify specific items
      const textItem = parsedFeed.items.find(item => item.title === 'Text Post');
      assert(textItem);
      assert.deepStrictEqual(textItem.tags, ['integration', 'test', 'text']);

      const mediaItem = parsedFeed.items.find(item => item.title === 'Media Post');
      assert(mediaItem);
      assert.strictEqual(mediaItem.attachments.length, 1);
      assert.strictEqual(mediaItem.attachments[0].alt_text, 'Integration test image');

      const replyItem = parsedFeed.items.find(item => item.in_reply_to);
      assert(replyItem);
      assert.strictEqual(replyItem.in_reply_to, 'https://integration-test.example.com/post/1');

      // Step 7: Test filtering functionality
      const textItems = parser.getItems(parsedFeed, { tags: ['text'] });
      assert.strictEqual(textItems.length, 1);

      const mediaItems = parser.getItems(parsedFeed, { hasAttachments: true });
      assert.strictEqual(mediaItems.length, 1);

      const replyItems = parser.getItems(parsedFeed, { hasReplies: true });
      assert.strictEqual(replyItems.length, 1);
    });

    test('content update and versioning workflow', async () => {
      // Create initial feed
      const feed = await generator.createCompleteFeed({
        title: 'Version Test Feed',
        home_page_url: 'https://version-test.example.com',
        feed_url: 'https://version-test.example.com/feed.ansybl',
        author: {
          name: 'Version Test Author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://version-test.example.com/post/1',
        url: 'https://version-test.example.com/post/1',
        title: 'Original Post',
        content_text: 'This is the original content.'
      }], testKeyPair.privateKey);

      const originalSignature = feed.items[0].signature;

      // Update the item
      const updatedFeed = await generator.updateItem(
        feed,
        'https://version-test.example.com/post/1',
        { 
          content_text: 'This is the updated content.',
          title: 'Updated Post'
        },
        testKeyPair.privateKey
      );

      // Verify update
      const updatedItem = updatedFeed.items[0];
      assert.strictEqual(updatedItem.title, 'Updated Post');
      assert.strictEqual(updatedItem.content_text, 'This is the updated content.');
      assert(updatedItem.date_modified);
      assert.notStrictEqual(updatedItem.signature, originalSignature);

      // Verify signatures are still valid
      const serialized = generator.serialize(updatedFeed);
      const parseResult = await parser.parse(serialized, { verifySignatures: true });
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.signatures.allValid, true);
    });
  });

  describe('Cross-Implementation Compatibility', () => {
    test('canonical JSON serialization consistency', async () => {
      const testData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Test content',
        date_published: '2025-11-04T10:00:00Z',
        tags: ['test', 'canonical'],
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      };

      // Generate canonical representation multiple times
      const canonical1 = canonicalizer.canonicalize(testData);
      const canonical2 = canonicalizer.canonicalize(testData);
      const canonical3 = canonicalizer.canonicalize(JSON.parse(JSON.stringify(testData)));

      // All should be identical
      assert.strictEqual(canonical1, canonical2);
      assert.strictEqual(canonical2, canonical3);

      // Verify key ordering
      const parsed = JSON.parse(canonical1);
      const keys = Object.keys(parsed);
      const sortedKeys = [...keys].sort();
      assert.deepStrictEqual(keys, sortedKeys);
    });

    test('signature verification across different parsers', async () => {
      // Create content with one generator
      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Cross-parser test content',
        date_published: '2025-11-04T10:00:00Z'
      };

      const signature = await generator.signItem(itemData, testKeyPair.privateKey);
      const signedItem = { ...itemData, signature };

      // Create a second parser instance (simulating different implementation)
      const parser2 = new AnsyblParser();
      
      // Both parsers should verify the signature identically
      const feed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Cross-Parser Test',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [signedItem]
      };

      const result1 = await parser.parse(feed, { verifySignatures: true });
      const result2 = await parser2.parse(feed, { verifySignatures: true });

      assert.strictEqual(result1.signatures.allValid, result2.signatures.allValid);
      assert.strictEqual(result1.signatures.itemSignatures[0].valid, 
                        result2.signatures.itemSignatures[0].valid);
    });

    test('extension field preservation across implementations', async () => {
      const feedWithExtensions = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Extension Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey,
          _custom_author_field: 'author extension data'
        },
        _feed_extension: 'feed extension data',
        _complex_extension: {
          nested: 'data',
          array: [1, 2, 3]
        },
        items: [{
          id: 'https://example.com/post/1',
          url: 'https://example.com/post/1',
          content_text: 'Content with extensions',
          date_published: '2025-11-04T10:00:00Z',
          signature: 'ed25519:fake_signature',
          _item_extension: 'item extension data'
        }]
      };

      // Parse with extension preservation
      const result = await parser.parse(feedWithExtensions, { 
        verifySignatures: false,
        preserveExtensions: true 
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.feed._feed_extension, 'feed extension data');
      assert.deepStrictEqual(result.feed._complex_extension, {
        nested: 'data',
        array: [1, 2, 3]
      });
      assert.strictEqual(result.feed.author._custom_author_field, 'author extension data');
      assert.strictEqual(result.feed.items[0]._item_extension, 'item extension data');

      // Re-serialize and verify extensions are preserved
      const serialized = generator.serialize(result.feed);
      const reparsed = await parser.parse(serialized, { 
        verifySignatures: false,
        preserveExtensions: true 
      });

      assert.strictEqual(reparsed.feed._feed_extension, 'feed extension data');
      assert.strictEqual(reparsed.feed.items[0]._item_extension, 'item extension data');
    });
  });

  describe('Protocol Bridge Integration', () => {
    test('ActivityPub bridge round-trip conversion', async () => {
      // Create Ansybl feed
      const ansyblFeed = await generator.createCompleteFeed({
        title: 'ActivityPub Bridge Test',
        home_page_url: 'https://bridge-test.example.com',
        feed_url: 'https://bridge-test.example.com/feed.ansybl',
        author: {
          name: 'Bridge Test Author',
          url: 'https://bridge-test.example.com/author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://bridge-test.example.com/post/1',
        url: 'https://bridge-test.example.com/post/1',
        title: 'Bridge Test Post',
        content_html: '<p>Testing ActivityPub bridge conversion.</p>',
        tags: ['bridge', 'activitypub']
      }], testKeyPair.privateKey);

      // Convert to ActivityPub
      const activityPubData = await activityPubBridge.convertFromAnsybl(ansyblFeed);
      
      assert(activityPubData);
      assert.strictEqual(activityPubData.type, 'OrderedCollection');
      assert(activityPubData.orderedItems);
      assert(activityPubData.orderedItems.length > 0);

      // Verify ActivityPub structure
      const firstItem = activityPubData.orderedItems[0];
      assert.strictEqual(firstItem.type, 'Note');
      assert(firstItem.content.includes('Testing ActivityPub bridge conversion'));
      assert(firstItem.attributedTo);

      // Convert back to Ansybl (if supported)
      if (activityPubBridge.convertToAnsybl) {
        const convertedBack = await activityPubBridge.convertToAnsybl(activityPubData);
        assert(convertedBack);
        assert.strictEqual(convertedBack.title, 'ActivityPub Bridge Test');
      }
    });

    test('RSS/JSON Feed bridge conversion', async () => {
      // Create Ansybl feed
      const ansyblFeed = await generator.createCompleteFeed({
        title: 'RSS Bridge Test',
        home_page_url: 'https://rss-test.example.com',
        feed_url: 'https://rss-test.example.com/feed.ansybl',
        description: 'Testing RSS bridge functionality',
        author: {
          name: 'RSS Test Author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://rss-test.example.com/post/1',
        url: 'https://rss-test.example.com/post/1',
        title: 'RSS Bridge Test Post',
        content_text: 'Testing RSS bridge conversion.',
        date_published: '2025-11-04T10:00:00Z'
      }], testKeyPair.privateKey);

      // Convert to RSS
      const rssData = await rssJsonBridge.convertToRSS(ansyblFeed);
      
      assert(rssData);
      assert(rssData.includes('<rss'));
      assert(rssData.includes('<title>RSS Bridge Test</title>'));
      assert(rssData.includes('Testing RSS bridge conversion'));

      // Convert to JSON Feed
      const jsonFeedData = await rssJsonBridge.convertToJSONFeed(ansyblFeed);
      
      assert(jsonFeedData);
      assert.strictEqual(jsonFeedData.title, 'RSS Bridge Test');
      assert.strictEqual(jsonFeedData.items.length, 1);
      assert.strictEqual(jsonFeedData.items[0].title, 'RSS Bridge Test Post');
    });
  });

  describe('Discovery and Social Features Integration', () => {
    test('webring registry integration', async () => {
      // Register a feed in the webring
      const feedInfo = {
        url: 'https://webring-test.example.com/feed.ansybl',
        title: 'Webring Test Feed',
        description: 'A feed for testing webring functionality',
        tags: ['test', 'webring', 'discovery'],
        author: 'Webring Test Author'
      };

      await webringRegistry.registerFeed(feedInfo);

      // Search for feeds
      const searchResults = await webringRegistry.searchFeeds({ tags: ['webring'] });
      assert(searchResults.length > 0);
      
      const foundFeed = searchResults.find(feed => feed.url === feedInfo.url);
      assert(foundFeed);
      assert.strictEqual(foundFeed.title, 'Webring Test Feed');

      // Get feed health status
      const healthStatus = await webringRegistry.checkFeedHealth(feedInfo.url);
      assert(healthStatus);
      assert(['active', 'inactive', 'error'].includes(healthStatus.status));
    });

    test('webmention endpoint integration', async () => {
      // Set up webmention endpoint
      const sourceUrl = 'https://source.example.com/post/1';
      const targetUrl = 'https://target.example.com/post/1';

      // Send webmention
      const mentionResult = await webmentionEndpoint.sendWebmention(sourceUrl, targetUrl);
      assert(mentionResult);
      assert(['pending', 'verified', 'failed'].includes(mentionResult.status));

      // Verify webmention (mock verification)
      if (mentionResult.status === 'pending') {
        const verificationResult = await webmentionEndpoint.verifyWebmention(
          mentionResult.id,
          sourceUrl,
          targetUrl
        );
        assert(verificationResult);
        assert(typeof verificationResult.verified === 'boolean');
      }

      // Get webmentions for a target
      const mentions = await webmentionEndpoint.getWebmentions(targetUrl);
      assert(Array.isArray(mentions));
    });

    test('social interaction tracking', async () => {
      // Create feed with social interactions
      const feed = await generator.createCompleteFeed({
        title: 'Social Test Feed',
        home_page_url: 'https://social-test.example.com',
        feed_url: 'https://social-test.example.com/feed.ansybl',
        author: {
          name: 'Social Test Author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://social-test.example.com/post/1',
        url: 'https://social-test.example.com/post/1',
        title: 'Social Test Post',
        content_text: 'Testing social interactions.',
        interactions: {
          replies_count: 5,
          likes_count: 10,
          shares_count: 2,
          replies_url: 'https://social-test.example.com/post/1/replies'
        }
      }, {
        id: 'https://social-test.example.com/post/2',
        url: 'https://social-test.example.com/post/2',
        content_text: 'This is a reply to the first post.',
        in_reply_to: 'https://social-test.example.com/post/1',
        interactions: {
          replies_count: 0,
          likes_count: 3,
          shares_count: 1
        }
      }], testKeyPair.privateKey);

      // Parse and verify social features
      const serialized = generator.serialize(feed);
      const parseResult = await parser.parse(serialized, { verifySignatures: true });
      
      assert.strictEqual(parseResult.success, true);
      
      const originalPost = parseResult.feed.items.find(item => 
        item.id === 'https://social-test.example.com/post/1'
      );
      const replyPost = parseResult.feed.items.find(item => item.in_reply_to);

      assert(originalPost.interactions);
      assert.strictEqual(originalPost.interactions.replies_count, 5);
      assert.strictEqual(originalPost.interactions.likes_count, 10);

      assert(replyPost);
      assert.strictEqual(replyPost.in_reply_to, 'https://social-test.example.com/post/1');

      // Test reply threading
      const replies = parser.getItems(parseResult.feed, { 
        replyTo: 'https://social-test.example.com/post/1' 
      });
      assert.strictEqual(replies.length, 1);
      assert.strictEqual(replies[0].id, 'https://social-test.example.com/post/2');
    });
  });

  describe('Performance Testing', () => {
    test('large feed parsing performance', async () => {
      // Create a large feed (100 items)
      const largeFeedItems = [];
      for (let i = 1; i <= 100; i++) {
        largeFeedItems.push({
          id: `https://perf-test.example.com/post/${i}`,
          url: `https://perf-test.example.com/post/${i}`,
          title: `Performance Test Post ${i}`,
          content_text: `This is performance test post number ${i}. `.repeat(10),
          date_published: new Date(Date.now() - (i * 60000)).toISOString(),
          tags: ['performance', 'test', `post-${i}`]
        });
      }

      const largeFeed = await generator.createCompleteFeed({
        title: 'Performance Test Feed',
        home_page_url: 'https://perf-test.example.com',
        feed_url: 'https://perf-test.example.com/feed.ansybl',
        author: {
          name: 'Performance Test Author',
          public_key: testKeyPair.publicKey
        }
      }, largeFeedItems, testKeyPair.privateKey);

      const serialized = generator.serialize(largeFeed);
      
      // Measure parsing performance
      const parseStart = performance.now();
      const parseResult = await parser.parse(serialized, { verifySignatures: false });
      const parseEnd = performance.now();
      
      const parseTime = parseEnd - parseStart;
      
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.feed.items.length, 100);
      
      // Performance should be reasonable (less than 1 second for 100 items)
      assert(parseTime < 1000, `Parsing took ${parseTime}ms, should be under 1000ms`);
      
      console.log(`Large feed parsing performance: ${parseTime.toFixed(2)}ms for 100 items`);
    });

    test('signature verification performance', async () => {
      // Create feed with multiple signed items
      const signedItems = [];
      for (let i = 1; i <= 20; i++) {
        signedItems.push({
          id: `https://sig-perf-test.example.com/post/${i}`,
          url: `https://sig-perf-test.example.com/post/${i}`,
          content_text: `Signature performance test post ${i}`,
          date_published: new Date(Date.now() - (i * 60000)).toISOString()
        });
      }

      const signedFeed = await generator.createCompleteFeed({
        title: 'Signature Performance Test',
        home_page_url: 'https://sig-perf-test.example.com',
        feed_url: 'https://sig-perf-test.example.com/feed.ansybl',
        author: {
          name: 'Signature Test Author',
          public_key: testKeyPair.publicKey
        }
      }, signedItems, testKeyPair.privateKey);

      const serialized = generator.serialize(signedFeed);
      
      // Measure signature verification performance
      const verifyStart = performance.now();
      const parseResult = await parser.parse(serialized, { verifySignatures: true });
      const verifyEnd = performance.now();
      
      const verifyTime = verifyEnd - verifyStart;
      
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.signatures.allValid, true);
      
      // Signature verification should be reasonable (less than 2 seconds for 20 items)
      assert(verifyTime < 2000, `Signature verification took ${verifyTime}ms, should be under 2000ms`);
      
      console.log(`Signature verification performance: ${verifyTime.toFixed(2)}ms for 20 items`);
    });

    test('high-frequency update simulation', async () => {
      // Simulate rapid updates to a feed
      let feed = generator.createFeed({
        title: 'High Frequency Test Feed',
        home_page_url: 'https://hf-test.example.com',
        feed_url: 'https://hf-test.example.com/feed.ansybl',
        author: {
          name: 'High Frequency Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const updateStart = performance.now();
      
      // Add 50 items rapidly
      for (let i = 1; i <= 50; i++) {
        const item = {
          id: `https://hf-test.example.com/post/${i}`,
          url: `https://hf-test.example.com/post/${i}`,
          content_text: `High frequency update ${i}`,
          date_published: new Date().toISOString()
        };
        
        feed = await generator.addItem(feed, item, testKeyPair.privateKey);
      }
      
      const updateEnd = performance.now();
      const updateTime = updateEnd - updateStart;
      
      assert.strictEqual(feed.items.length, 50);
      
      // High-frequency updates should complete in reasonable time
      assert(updateTime < 5000, `High-frequency updates took ${updateTime}ms, should be under 5000ms`);
      
      console.log(`High-frequency update performance: ${updateTime.toFixed(2)}ms for 50 items`);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('graceful handling of network failures in discovery', async () => {
      // Test webring registry with simulated network failure
      const originalFetch = global.fetch;
      global.fetch = () => Promise.reject(new Error('Network error'));

      try {
        const searchResults = await webringRegistry.searchFeeds({ tags: ['test'] });
        // Should return empty results or cached data, not throw
        assert(Array.isArray(searchResults));
      } catch (error) {
        // If it throws, it should be a handled error with useful message
        assert(error.message.includes('Network') || error.message.includes('timeout'));
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('recovery from partial parsing failures', async () => {
      // Create a feed with one valid and one invalid item
      const mixedFeed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Mixed Validity Feed',
        home_page_url: 'https://mixed-test.example.com',
        feed_url: 'https://mixed-test.example.com/feed.ansybl',
        author: {
          name: 'Mixed Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [
          {
            id: 'https://mixed-test.example.com/post/1',
            url: 'https://mixed-test.example.com/post/1',
            content_text: 'Valid post',
            date_published: '2025-11-04T10:00:00Z',
            signature: 'ed25519:valid_signature'
          },
          {
            // Invalid item - missing required fields
            content_text: 'Invalid post without ID',
            signature: 'ed25519:invalid_signature'
          }
        ]
      };

      const result = await parser.parse(mixedFeed, { 
        verifySignatures: false,
        strictMode: false 
      });

      // Should have partial success with degradations
      assert.strictEqual(result.success, false);
      assert(result.errors.length > 0);
      assert(result.degradations || result.partialResults);
    });
  });

  describe('Security and Validation Integration', () => {
    test('comprehensive security validation', async () => {
      // Test various security scenarios
      const securityTests = [
        {
          name: 'XSS in content',
          feed: {
            version: 'https://ansybl.org/version/1.0',
            title: 'Security Test Feed',
            home_page_url: 'https://security-test.example.com',
            feed_url: 'https://security-test.example.com/feed.ansybl',
            author: {
              name: 'Security Test Author',
              public_key: testKeyPair.publicKey
            },
            items: [{
              id: 'https://security-test.example.com/post/1',
              url: 'https://security-test.example.com/post/1',
              content_html: '<script>alert("xss")</script><p>Safe content</p>',
              date_published: '2025-11-04T10:00:00Z',
              signature: 'ed25519:fake_signature'
            }]
          }
        },
        {
          name: 'Oversized content',
          feed: {
            version: 'https://ansybl.org/version/1.0',
            title: 'Size Test Feed',
            home_page_url: 'https://size-test.example.com',
            feed_url: 'https://size-test.example.com/feed.ansybl',
            author: {
              name: 'Size Test Author',
              public_key: testKeyPair.publicKey
            },
            items: [{
              id: 'https://size-test.example.com/post/1',
              url: 'https://size-test.example.com/post/1',
              content_text: 'x'.repeat(100000), // Very large content
              date_published: '2025-11-04T10:00:00Z',
              signature: 'ed25519:fake_signature'
            }]
          }
        }
      ];

      for (const testCase of securityTests) {
        const result = await parser.parse(testCase.feed, { 
          verifySignatures: false,
          securityMode: 'strict'
        });

        // Should either reject or sanitize dangerous content
        if (result.success) {
          // If parsing succeeded, dangerous content should be sanitized
          if (testCase.name === 'XSS in content') {
            const item = result.feed.items[0];
            assert(!item.content_html.includes('<script>'));
          }
        } else {
          // If parsing failed, should have security-related errors
          assert(result.errors.some(error => 
            error.code.includes('SECURITY') || 
            error.code.includes('SIZE') ||
            error.code.includes('CONTENT')
          ));
        }
      }
    });

    test('signature tampering detection', async () => {
      // Create valid signed content
      const validItem = {
        id: 'https://tamper-test.example.com/post/1',
        url: 'https://tamper-test.example.com/post/1',
        content_text: 'Original content',
        date_published: '2025-11-04T10:00:00Z'
      };

      const signature = await generator.signItem(validItem, testKeyPair.privateKey);
      
      // Tamper with the content but keep the signature
      const tamperedItem = {
        ...validItem,
        content_text: 'Tampered content',
        signature
      };

      const feed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Tamper Test Feed',
        home_page_url: 'https://tamper-test.example.com',
        feed_url: 'https://tamper-test.example.com/feed.ansybl',
        author: {
          name: 'Tamper Test Author',
          public_key: testKeyPair.publicKey
        },
        items: [tamperedItem]
      };

      const result = await parser.parse(feed, { verifySignatures: true });
      
      // Should detect signature mismatch
      assert.strictEqual(result.signatures.allValid, false);
      assert.strictEqual(result.signatures.itemSignatures[0].valid, false);
    });
  });
});