/**
 * Unit tests for Protocol Bridges
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RSSBridge } from '../lib/bridges/rss-bridge.js';
import { ActivityPubBridge } from '../lib/bridges/activitypub-bridge.js';
import { JSONFeedBridge } from '../lib/bridges/jsonfeed-bridge.js';

describe('Protocol Bridges - example-website', () => {
  const sampleFeed = {
    version: 'https://ansybl.org/version/1.0',
    title: 'Test Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    description: 'Test description',
    author: {
      name: 'Test Author',
      public_key: 'ed25519:test_key'
    },
    items: [
      {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        title: 'Test Post',
        content_text: 'Test content',
        date_published: '2025-11-04T10:00:00Z',
        signature: 'ed25519:test_sig'
      }
    ]
  };

  describe('RSS Bridge', () => {
    test('should convert Ansybl to RSS', () => {
      const rssBridge = new RSSBridge();
      const rss = rssBridge.ansyblToRss(sampleFeed);

      assert(rss.includes('<?xml'));
      assert(rss.includes('<rss'));
      assert(rss.includes('Test Feed'));
      assert(rss.includes('Test Post'));
    });

    test('should include required RSS elements', () => {
      const rssBridge = new RSSBridge();
      const rss = rssBridge.ansyblToRss(sampleFeed);

      assert(rss.includes('<channel>'));
      assert(rss.includes('<title>'));
      assert(rss.includes('<link>'));
      assert(rss.includes('<description>'));
      assert(rss.includes('<item>'));
    });
  });

  describe('ActivityPub Bridge', () => {
    test('should convert Ansybl item to ActivityPub', () => {
      const apBridge = new ActivityPubBridge();
      const activity = apBridge.ansyblItemToActivity(sampleFeed.items[0], sampleFeed);

      assert.strictEqual(activity.type, 'Create');
      assert(activity.object);
      assert(activity.published);
    });

    test('should create valid ActivityStreams object', () => {
      const apBridge = new ActivityPubBridge();
      const activity = apBridge.ansyblItemToActivity(sampleFeed.items[0], sampleFeed);

      assert(activity['@context']);
      assert(activity.id);
      assert(activity.type);
    });
  });

  describe('JSON Feed Bridge', () => {
    test('should convert Ansybl to JSON Feed', () => {
      const jsonBridge = new JSONFeedBridge();
      const jsonFeed = jsonBridge.ansyblToJsonFeed(sampleFeed);

      assert.strictEqual(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
      assert.strictEqual(jsonFeed.title, 'Test Feed');
      assert.strictEqual(jsonFeed.items.length, 1);
    });

    test('should map content fields correctly', () => {
      const jsonBridge = new JSONFeedBridge();
      const jsonFeed = jsonBridge.ansyblToJsonFeed(sampleFeed);

      const item = jsonFeed.items[0];
      assert.strictEqual(item.id, 'https://example.com/post/1');
      assert.strictEqual(item.content_text, 'Test content');
    });
  });
});
