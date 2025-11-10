/**
 * Integration tests for complete feed workflow
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../../lib/generator.js';
import { AnsyblParser } from '../../lib/parser.js';
import { AnsyblValidator } from '../../lib/validator.js';
import { generateKeyPair } from '../../lib/signature.js';

describe('Feed Workflow Integration', () => {
  let generator;
  let parser;
  let validator;
  let testKeyPair;

  test('setup', async () => {
    generator = new AnsyblGenerator();
    parser = new AnsyblParser();
    validator = new AnsyblValidator();
    testKeyPair = await generateKeyPair();
  });

  describe('Complete Feed Creation and Parsing', () => {
    test('should create, sign, validate, and parse a complete feed', async () => {
      // Step 1: Create feed
      const feed = generator.createFeed({
        title: 'Integration Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        description: 'A test feed for integration testing',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      assert.strictEqual(feed.title, 'Integration Test Feed');

      // Step 2: Add items
      const updatedFeed = await generator.addItem(feed, {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        title: 'First Post',
        content_text: 'This is the first post'
      }, testKeyPair.privateKey);

      assert.strictEqual(updatedFeed.items.length, 1);
      assert(updatedFeed.items[0].signature);

      // Step 3: Sign the feed
      const signedFeed = await generator.signFeed(updatedFeed, testKeyPair.privateKey);
      assert(signedFeed.signature);

      // Step 4: Validate the feed
      const validationResult = validator.validateDocument(signedFeed);
      assert.strictEqual(validationResult.valid, true);

      // Step 5: Parse the feed
      const parseResult = await parser.parse(signedFeed, { verifySignatures: false });
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.feed.title, 'Integration Test Feed');
      assert.strictEqual(parseResult.feed.items.length, 1);
    });

    test('should handle multiple items in workflow', async () => {
      let feed = generator.createFeed({
        title: 'Multi-Item Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      // Add multiple items
      for (let i = 1; i <= 3; i++) {
        feed = await generator.addItem(feed, {
          id: `https://example.com/post/${i}`,
          url: `https://example.com/post/${i}`,
          title: `Post ${i}`,
          content_text: `Content for post ${i}`
        }, testKeyPair.privateKey);
      }

      assert.strictEqual(feed.items.length, 3);

      // Validate and parse
      const validationResult = validator.validateDocument(feed);
      assert.strictEqual(validationResult.valid, true);

      const parseResult = await parser.parse(feed, { verifySignatures: false });
      assert.strictEqual(parseResult.success, true);
      assert.strictEqual(parseResult.feed.items.length, 3);
    });
  });

  describe('Content Format Conversion', () => {
    test('should handle markdown to HTML conversion', async () => {
      const feed = generator.createFeed({
        title: 'Markdown Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const updatedFeed = await generator.addItem(feed, {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_markdown: '# Hello World\n\nThis is **bold** text.'
      }, testKeyPair.privateKey);

      const item = updatedFeed.items[0];
      assert(item.content_markdown);
      assert(item.content_html);
      assert(item.content_html.includes('<h1>'));
      assert(item.content_html.includes('<strong>'));
    });
  });

  describe('Error Handling in Workflow', () => {
    test('should handle validation errors gracefully', async () => {
      const invalidFeed = {
        title: 'Invalid Feed',
        // Missing required fields
        items: []
      };

      const validationResult = validator.validateDocument(invalidFeed);
      assert.strictEqual(validationResult.valid, false);
      assert(validationResult.errors.length > 0);

      const parseResult = await parser.parse(invalidFeed, { verifySignatures: false });
      assert.strictEqual(parseResult.success, false);
    });
  });
});
