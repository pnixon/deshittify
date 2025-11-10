/**
 * Unit tests for Ansybl Generator (example-website implementation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../lib/generator.js';
import { generateKeyPair } from '../lib/signature.js';

describe('AnsyblGenerator - example-website', () => {
  let generator;
  let testKeyPair;

  test('setup', async () => {
    generator = new AnsyblGenerator();
    testKeyPair = await generateKeyPair();
  });

  describe('Feed Creation', () => {
    test('should create minimal valid feed', () => {
      const metadata = {
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      };

      const feed = generator.createFeed(metadata);

      assert.strictEqual(feed.title, 'Test Feed');
      assert.strictEqual(feed.home_page_url, 'https://example.com');
      assert.strictEqual(feed.version, 'https://ansybl.org/version/1.0');
      assert(Array.isArray(feed.items));
    });

    test('should create feed with optional fields', () => {
      const metadata = {
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        description: 'Test description',
        icon: 'https://example.com/icon.png',
        language: 'en-US',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey,
          url: 'https://example.com/author',
          avatar: 'https://example.com/avatar.jpg'
        }
      };

      const feed = generator.createFeed(metadata);

      assert.strictEqual(feed.description, 'Test description');
      assert.strictEqual(feed.icon, 'https://example.com/icon.png');
      assert.strictEqual(feed.language, 'en-US');
    });
  });

  describe('Content Item Creation', () => {
    test('should add content item with text', async () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const updatedFeed = await generator.addItem(feed, itemData, testKeyPair.privateKey);

      assert.strictEqual(updatedFeed.items.length, 1);
      assert.strictEqual(updatedFeed.items[0].id, 'https://example.com/post/1');
      assert.strictEqual(updatedFeed.items[0].content_text, 'Hello world');
      assert(updatedFeed.items[0].date_published);
      assert(updatedFeed.items[0].signature);
    });

    test('should add item with all content formats', async () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world',
        content_html: '<p>Hello world</p>',
        content_markdown: '# Hello world'
      };

      const updatedFeed = await generator.addItem(feed, itemData, testKeyPair.privateKey);
      const item = updatedFeed.items[0];

      assert.strictEqual(item.content_text, 'Hello world');
      assert.strictEqual(item.content_html, '<p>Hello world</p>');
      assert.strictEqual(item.content_markdown, '# Hello world');
    });
  });

  describe('Signature Generation', () => {
    test('should generate valid signatures', async () => {
      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world',
        date_published: '2025-11-04T10:00:00Z'
      };

      const signature = await generator.signItem(itemData, testKeyPair.privateKey);

      assert(signature);
      assert(signature.startsWith('ed25519:'));
    });
  });
});
