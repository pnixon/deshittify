/**
 * Bridge Service Functionality Tests
 * Additional tests for bridge service functionality and edge cases
 * Tests protocol-specific features and compatibility
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ActivityPubBridge } from '../bridges/activitypub-bridge.js';
import { RssJsonBridge } from '../bridges/rss-json-bridge.js';
import { AnsyblGenerator } from '../generator.js';
import { generateKeyPair } from '../signature.js';

describe('Bridge Service Functionality Tests', () => {
  let activityPubBridge;
  let rssJsonBridge;
  let testFeed;
  let testKeyPair;
  let validAuthContext;

  test('Setup test environment', async () => {
    activityPubBridge = new ActivityPubBridge({
      testMode: true,
      maxRequestsPerMinute: 1000
    });
    rssJsonBridge = new RssJsonBridge();
    testKeyPair = await generateKeyPair();
    
    const generator = new AnsyblGenerator();
    const feedMetadata = {
      title: 'Functionality Test Feed',
      home_page_url: 'https://test.example.com',
      feed_url: 'https://test.example.com/feed.ansybl',
      description: 'Test feed for functionality validation',
      language: 'en-US',
      icon: 'https://test.example.com/icon.png',
      author: {
        name: 'Test Author',
        public_key: testKeyPair.publicKey,
        url: 'https://test.example.com/author',
        avatar: 'https://test.example.com/avatar.jpg'
      }
    };
    
    testFeed = generator.createFeed(feedMetadata);
    
    // Add multiple test items with different features
    const items = [
      {
        id: 'https://test.example.com/posts/1',
        url: 'https://test.example.com/posts/1',
        title: 'Text Post',
        content_text: 'This is a plain text post.',
        tags: ['text', 'simple']
      },
      {
        id: 'https://test.example.com/posts/2',
        url: 'https://test.example.com/posts/2',
        title: 'HTML Post',
        content_html: '<p>This is an <strong>HTML</strong> post with <a href="https://example.com">links</a>.</p>',
        summary: 'HTML post with formatting',
        tags: ['html', 'formatting'],
        attachments: [{
          url: 'https://test.example.com/image.jpg',
          mime_type: 'image/jpeg',
          alt_text: 'Test image',
          width: 800,
          height: 600
        }]
      },
      {
        id: 'https://test.example.com/posts/3',
        url: 'https://test.example.com/posts/3',
        title: 'Reply Post',
        content_text: 'This is a reply to another post.',
        in_reply_to: 'https://other.example.com/posts/original',
        interactions: {
          replies_count: 2,
          likes_count: 5,
          shares_count: 1
        }
      }
    ];
    
    for (const itemData of items) {
      testFeed = await generator.addItem(testFeed, itemData, testKeyPair.privateKey);
    }
    
    testFeed = await generator.signFeed(testFeed, testKeyPair.privateKey);
    
    validAuthContext = {
      user_id: 'test-user-123',
      permissions: ['convert:actor', 'convert:object', 'sync:interactions'],
      rate_limit_key: 'test-user-123',
      request_signature: 'valid-signature-hash'
    };
  });

  describe('ActivityPub Bridge Advanced Features', () => {
    
    test('Converts complex content with attachments', async () => {
      const htmlItem = testFeed.items[1]; // HTML post with attachment
      const object = await activityPubBridge.convertToObject(htmlItem, testFeed, validAuthContext);
      
      // Verify attachment conversion
      assert.ok(object.attachment);
      assert.strictEqual(object.attachment.length, 1);
      assert.strictEqual(object.attachment[0].type, 'Document');
      assert.strictEqual(object.attachment[0].mediaType, 'image/jpeg');
      assert.strictEqual(object.attachment[0].name, 'Test image');
      assert.strictEqual(object.attachment[0].width, 800);
      assert.strictEqual(object.attachment[0].height, 600);
    });

    test('Handles reply threading correctly', async () => {
      const replyItem = testFeed.items[2]; // Reply post
      const object = await activityPubBridge.convertToObject(replyItem, testFeed, validAuthContext);
      
      // Verify reply handling
      assert.strictEqual(object.inReplyTo, 'https://other.example.com/posts/original');
      assert.strictEqual(object['ansybl:replies'], 2);
      assert.strictEqual(object['ansybl:likes'], 5);
      assert.strictEqual(object['ansybl:shares'], 1);
    });

    test('Creates proper ActivityPub Create activities', async () => {
      const item = testFeed.items[0];
      const activity = await activityPubBridge.createActivity(item, testFeed, validAuthContext);
      
      // Verify Create activity structure
      assert.strictEqual(activity.type, 'Create');
      assert.strictEqual(activity.actor, activity.object.attributedTo);
      assert.strictEqual(activity.published, item.date_published);
      assert.ok(activity.to.includes('https://www.w3.org/ns/activitystreams#Public'));
    });

    test('Generates deterministic actor IDs', async () => {
      const actor1 = await activityPubBridge.convertToActor(testFeed, validAuthContext);
      const actor2 = await activityPubBridge.convertToActor(testFeed, validAuthContext);
      
      // Actor IDs should be consistent
      assert.strictEqual(actor1.id, actor2.id);
      assert.strictEqual(actor1.publicKey.id, actor2.publicKey.id);
    });

    test('Preserves cryptographic identity in ActivityPub format', async () => {
      const actor = await activityPubBridge.convertToActor(testFeed, validAuthContext);
      
      // Verify cryptographic identity preservation
      assert.ok(actor.publicKey);
      assert.ok(actor.publicKey.publicKeyPem);
      assert.strictEqual(actor.ansyblPublicKey, testFeed.author.public_key);
      assert.strictEqual(actor.assertionMethod, actor.publicKey.id);
    });
  });

  describe('RSS Bridge Advanced Features', () => {
    
    test('Generates valid RSS with all optional elements', async () => {
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeContent: true,
        includeEnclosures: true,
        includeCategories: true,
        includeAnsyblExtensions: true
      });
      
      // Verify RSS structure and elements
      assert.ok(rssXml.includes('<title>Functionality Test Feed</title>'));
      assert.ok(rssXml.includes('<language>en-US</language>'));
      assert.ok(rssXml.includes('<image>'));
      assert.ok(rssXml.includes('<width>144</width>'));
      assert.ok(rssXml.includes('<content:encoded>'));
      assert.ok(rssXml.includes('<category>'));
      assert.ok(rssXml.includes('<enclosure'));
      assert.ok(rssXml.includes('xmlns:ansybl="https://ansybl.org/ns#"'));
    });

    test('Handles media enclosures correctly', async () => {
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeEnclosures: true
      });
      
      // Verify enclosure for media attachment
      assert.ok(rssXml.includes('<enclosure url="https://test.example.com/image.jpg"'));
      assert.ok(rssXml.includes('type="image/jpeg"'));
      assert.ok(rssXml.includes('length="0"')); // No size specified in test data
    });

    test('Preserves Ansybl extensions in RSS', async () => {
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Verify Ansybl-specific elements
      assert.ok(rssXml.includes('<ansybl:signature>'));
      assert.ok(rssXml.includes('<ansybl:id>'));
      assert.ok(rssXml.includes('<ansybl:replies>2</ansybl:replies>'));
      assert.ok(rssXml.includes('<ansybl:likes>5</ansybl:likes>'));
      assert.ok(rssXml.includes('<ansybl:inReplyTo>'));
    });

    test('Creates compliant JSON Feed with extensions', async () => {
      const jsonFeed = rssJsonBridge.convertToJsonFeed(testFeed, {
        includeAnsyblExtensions: true
      });
      
      // Verify JSON Feed compliance
      assert.ok(jsonFeed.version.includes('jsonfeed.org'));
      assert.ok(Array.isArray(jsonFeed.authors));
      assert.strictEqual(jsonFeed.authors[0].name, testFeed.author.name);
      assert.strictEqual(jsonFeed.authors[0].avatar, testFeed.author.avatar);
      
      // Verify Ansybl extensions
      assert.ok(jsonFeed._ansybl);
      assert.strictEqual(jsonFeed._ansybl.version, testFeed.version);
      assert.ok(jsonFeed._ansybl.converted_at);
      
      // Verify item extensions
      const itemWithExtensions = jsonFeed.items.find(item => item._ansybl?.interactions);
      assert.ok(itemWithExtensions);
      assert.strictEqual(itemWithExtensions._ansybl.interactions.replies_count, 2);
    });

    test('Handles content truncation for RSS descriptions', async () => {
      // Create feed with very long content
      const longContentFeed = { ...testFeed };
      longContentFeed.items = [{
        ...testFeed.items[0],
        content_text: 'x'.repeat(1000) // Very long content
      }];
      
      const rssXml = rssJsonBridge.convertToRss(longContentFeed);
      
      // Verify description is truncated
      const descriptionMatch = rssXml.match(/<description>(.*?)<\/description>/);
      assert.ok(descriptionMatch);
      assert.ok(descriptionMatch[1].length <= 503); // 500 + "..."
    });
  });

  describe('Bidirectional Conversion Features', () => {
    
    test('RSS round-trip preserves essential data', async () => {
      // Convert to RSS and back
      const rssXml = rssJsonBridge.convertToRss(testFeed, {
        includeAnsyblExtensions: true
      });
      
      const convertedFeed = await rssJsonBridge.convertFromRss(rssXml, {
        defaultAuthor: testFeed.author,
        preserveOriginalIds: true
      });
      
      // Verify essential data preservation
      assert.strictEqual(convertedFeed.title, testFeed.title);
      assert.strictEqual(convertedFeed.home_page_url, testFeed.home_page_url);
      assert.strictEqual(convertedFeed.items.length, testFeed.items.length);
      
      // Check first item
      const originalItem = testFeed.items[0];
      const convertedItem = convertedFeed.items.find(item => item.id === originalItem.id);
      assert.ok(convertedItem);
      assert.strictEqual(convertedItem.title, originalItem.title);
    });

    test('JSON Feed round-trip maintains structure', async () => {
      // Convert to JSON Feed and back
      const jsonFeed = rssJsonBridge.convertToJsonFeed(testFeed, {
        includeAnsyblExtensions: true
      });
      
      const convertedFeed = await rssJsonBridge.convertFromJsonFeed(jsonFeed, {
        preserveOriginalIds: true
      });
      
      // Verify structure maintenance
      assert.strictEqual(convertedFeed.title, testFeed.title);
      assert.strictEqual(convertedFeed.author.name, testFeed.author.name);
      assert.strictEqual(convertedFeed.items.length, testFeed.items.length);
      
      // Check HTML content preservation
      const htmlItem = convertedFeed.items.find(item => item.content_html);
      assert.ok(htmlItem);
      assert.ok(htmlItem.content_html.includes('<strong>HTML</strong>'));
    });

    test('Handles different content types appropriately', async () => {
      const jsonFeed = rssJsonBridge.convertToJsonFeed(testFeed);
      
      // Verify different content types are preserved
      const textItem = jsonFeed.items.find(item => item.content_text && !item.content_html);
      const htmlItem = jsonFeed.items.find(item => item.content_html);
      
      assert.ok(textItem);
      assert.ok(htmlItem);
      assert.strictEqual(textItem.content_text, 'This is a plain text post.');
      assert.ok(htmlItem.content_html.includes('<strong>HTML</strong>'));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('Handles feeds with no items', async () => {
      const emptyFeed = {
        ...testFeed,
        items: []
      };
      
      // Should handle empty feeds gracefully
      const actor = await activityPubBridge.convertToActor(emptyFeed, validAuthContext);
      assert.ok(actor.id);
      
      const rssXml = rssJsonBridge.convertToRss(emptyFeed);
      assert.ok(rssXml.includes('<channel>'));
      assert.ok(rssXml.includes('</channel>'));
      
      const jsonFeed = rssJsonBridge.convertToJsonFeed(emptyFeed);
      assert.strictEqual(jsonFeed.items.length, 0);
    });

    test('Handles items with minimal required fields', async () => {
      const minimalItem = {
        id: 'https://example.com/minimal',
        url: 'https://example.com/minimal',
        date_published: '2024-11-04T10:00:00Z',
        signature: 'test-signature'
      };
      
      // Should handle minimal items without errors
      const object = await activityPubBridge.convertToObject(
        minimalItem, 
        testFeed, 
        validAuthContext
      );
      
      assert.strictEqual(object.id, minimalItem.url);
      assert.strictEqual(object.published, minimalItem.date_published);
    });

    test('Sanitizes potentially dangerous content', async () => {
      const dangerousItem = {
        id: 'https://example.com/dangerous',
        url: 'https://example.com/dangerous',
        title: '<script>alert("XSS")</script>Dangerous Title',
        content_html: '<p>Safe content</p><script>alert("XSS")</script><iframe src="evil.com"></iframe>',
        date_published: '2024-11-04T10:00:00Z',
        signature: 'test-signature'
      };
      
      const object = await activityPubBridge.convertToObject(
        dangerousItem, 
        testFeed, 
        validAuthContext
      );
      
      // Verify dangerous content is sanitized
      assert.ok(!object.content.includes('<script>'));
      assert.ok(!object.content.includes('<iframe>'));
      assert.ok(!object.content.includes('alert('));
      assert.ok(object.content.includes('Safe content'));
    });

    test('Handles invalid URLs gracefully', async () => {
      const invalidUrlFeed = {
        ...testFeed,
        author: {
          ...testFeed.author,
          url: 'not-a-valid-url'
        }
      };
      
      // Should handle invalid URLs without crashing
      const actor = await activityPubBridge.convertToActor(invalidUrlFeed, validAuthContext);
      assert.ok(actor.id); // Should generate a fallback ID
    });

    test('Preserves Unicode and special characters', async () => {
      const unicodeFeed = {
        ...testFeed,
        title: 'Test Feed with 🚀 Emoji and ñoñó characters',
        items: [{
          id: 'https://example.com/unicode',
          url: 'https://example.com/unicode',
          title: 'Unicode Test: 中文 العربية русский',
          content_text: 'Content with émojis 🎉 and spëcial characters',
          date_published: '2024-11-04T10:00:00Z',
          signature: 'test-signature'
        }]
      };
      
      // Test RSS conversion
      const rssXml = rssJsonBridge.convertToRss(unicodeFeed);
      assert.ok(rssXml.includes('🚀'));
      assert.ok(rssXml.includes('中文'));
      assert.ok(rssXml.includes('🎉'));
      
      // Test JSON Feed conversion
      const jsonFeed = rssJsonBridge.convertToJsonFeed(unicodeFeed);
      assert.ok(jsonFeed.title.includes('🚀'));
      assert.ok(jsonFeed.items[0].content_text.includes('🎉'));
    });
  });
});