/**
 * Integration tests for protocol bridge workflows
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../../lib/generator.js';
import { RSSBridge } from '../../lib/bridges/rss-bridge.js';
import { ActivityPubBridge } from '../../lib/bridges/activitypub-bridge.js';
import { JSONFeedBridge } from '../../lib/bridges/jsonfeed-bridge.js';
import { generateKeyPair } from '../../lib/signature.js';

describe('Bridge Workflow Integration', () => {
  let generator;
  let testKeyPair;
  let sampleFeed;

  test('setup', async () => {
    generator = new AnsyblGenerator();
    testKeyPair = await generateKeyPair();

    // Create a sample feed for testing
    const feed = generator.createFeed({
      title: 'Bridge Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      description: 'Testing protocol bridges',
      author: {
        name: 'Test Author',
        public_key: testKeyPair.publicKey
      }
    });

    sampleFeed = await generator.addItem(feed, {
      id: 'https://example.com/post/1',
      url: 'https://example.com/post/1',
      title: 'Test Post',
      content_text: 'This is a test post for bridge conversion'
    }, testKeyPair.privateKey);
  });

  describe('RSS Bridge Workflow', () => {
    test('should convert Ansybl to RSS and maintain data integrity', () => {
      const rssBridge = new RSSBridge();
      const rss = rssBridge.ansyblToRss(sampleFeed);

      // Verify RSS structure
      assert(rss.includes('<?xml'));
      assert(rss.includes('<rss'));
      assert(rss.includes('Bridge Test Feed'));
      assert(rss.includes('Test Post'));
      assert(rss.includes('https://example.com/post/1'));
    });

    test('should handle feeds with multiple items', async () => {
      let feed = { ...sampleFeed };
      
      // Add more items
      feed = await generator.addItem(feed, {
        id: 'https://example.com/post/2',
        url: 'https://example.com/post/2',
        title: 'Second Post',
        content_text: 'Second post content'
      }, testKeyPair.privateKey);

      const rssBridge = new RSSBridge();
      const rss = rssBridge.ansyblToRss(feed);

      assert(rss.includes('Test Post'));
      assert(rss.includes('Second Post'));
    });
  });

  describe('ActivityPub Bridge Workflow', () => {
    test('should convert Ansybl item to ActivityPub activity', () => {
      const apBridge = new ActivityPubBridge();
      const activity = apBridge.ansyblItemToActivity(sampleFeed.items[0], sampleFeed);

      assert.strictEqual(activity.type, 'Create');
      assert(activity.object);
      assert(activity['@context']);
    });

    test('should convert feed to Actor profile', () => {
      const apBridge = new ActivityPubBridge();
      const actor = apBridge.ansyblFeedToActor(sampleFeed);

      assert.strictEqual(actor.type, 'Person');
      assert.strictEqual(actor.name, 'Test Author');
      assert(actor.inbox);
      assert(actor.outbox);
    });
  });

  describe('JSON Feed Bridge Workflow', () => {
    test('should convert Ansybl to JSON Feed format', () => {
      const jsonBridge = new JSONFeedBridge();
      const jsonFeed = jsonBridge.ansyblToJsonFeed(sampleFeed);

      assert.strictEqual(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
      assert.strictEqual(jsonFeed.title, 'Bridge Test Feed');
      assert.strictEqual(jsonFeed.items.length, sampleFeed.items.length);
    });

    test('should preserve content in JSON Feed conversion', () => {
      const jsonBridge = new JSONFeedBridge();
      const jsonFeed = jsonBridge.ansyblToJsonFeed(sampleFeed);

      const item = jsonFeed.items[0];
      assert.strictEqual(item.title, 'Test Post');
      assert.strictEqual(item.content_text, 'This is a test post for bridge conversion');
    });
  });

  describe('Cross-Bridge Compatibility', () => {
    test('should maintain data integrity across multiple bridge conversions', () => {
      const rssBridge = new RSSBridge();
      const jsonBridge = new JSONFeedBridge();

      const rss = rssBridge.ansyblToRss(sampleFeed);
      const jsonFeed = jsonBridge.ansyblToJsonFeed(sampleFeed);

      // Both should contain the same core data
      assert(rss.includes('Bridge Test Feed'));
      assert.strictEqual(jsonFeed.title, 'Bridge Test Feed');
      
      assert(rss.includes('Test Post'));
      assert.strictEqual(jsonFeed.items[0].title, 'Test Post');
    });
  });
});
