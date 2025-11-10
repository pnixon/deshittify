/**
 * Performance and load testing for Ansybl implementation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../../lib/generator.js';
import { AnsyblParser } from '../../lib/parser.js';
import { AnsyblValidator } from '../../lib/validator.js';
import { generateKeyPair } from '../../lib/signature.js';

describe('Performance Testing', () => {
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

  describe('Large Feed Handling', () => {
    test('should handle feed with 100 items efficiently', async () => {
      const startTime = Date.now();

      let feed = generator.createFeed({
        title: 'Large Feed Test',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      // Add 100 items
      for (let i = 1; i <= 100; i++) {
        feed = await generator.addItem(feed, {
          id: `https://example.com/post/${i}`,
          url: `https://example.com/post/${i}`,
          title: `Post ${i}`,
          content_text: `Content for post ${i}`
        }, testKeyPair.privateKey);
      }

      const creationTime = Date.now() - startTime;

      assert.strictEqual(feed.items.length, 100);
      assert(creationTime < 30000, `Feed creation took ${creationTime}ms, should be under 30s`);

      // Test parsing performance
      const parseStart = Date.now();
      const parseResult = await parser.parse(feed, { verifySignatures: false });
      const parseTime = Date.now() - parseStart;

      assert.strictEqual(parseResult.success, true);
      assert(parseTime < 5000, `Parsing took ${parseTime}ms, should be under 5s`);
    });

    test('should validate large feeds efficiently', async () => {
      let feed = generator.createFeed({
        title: 'Validation Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      // Add 50 items
      for (let i = 1; i <= 50; i++) {
        feed = await generator.addItem(feed, {
          id: `https://example.com/post/${i}`,
          url: `https://example.com/post/${i}`,
          content_text: `Content ${i}`
        }, testKeyPair.privateKey);
      }

      const startTime = Date.now();
      const validationResult = validator.validateDocument(feed);
      const validationTime = Date.now() - startTime;

      assert.strictEqual(validationResult.valid, true);
      assert(validationTime < 2000, `Validation took ${validationTime}ms, should be under 2s`);
    });
  });

  describe('Signature Performance', () => {
    test('should sign multiple items efficiently', async () => {
      const startTime = Date.now();
      const signatures = [];

      for (let i = 0; i < 50; i++) {
        const content = {
          id: `https://example.com/post/${i}`,
          content_text: `Content ${i}`,
          date_published: new Date().toISOString()
        };

        const signature = await generator.signItem(content, testKeyPair.privateKey);
        signatures.push(signature);
      }

      const signingTime = Date.now() - startTime;

      assert.strictEqual(signatures.length, 50);
      assert(signingTime < 5000, `Signing 50 items took ${signingTime}ms, should be under 5s`);
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 20; i++) {
        let feed = generator.createFeed({
          title: `Memory Test ${i}`,
          home_page_url: 'https://example.com',
          feed_url: 'https://example.com/feed.ansybl',
          author: {
            name: 'Test Author',
            public_key: testKeyPair.publicKey
          }
        });

        feed = await generator.addItem(feed, {
          id: `https://example.com/post/${i}`,
          url: `https://example.com/post/${i}`,
          content_text: `Content ${i}`
        }, testKeyPair.privateKey);

        await parser.parse(feed, { verifySignatures: false });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (less than 50MB for 20 operations)
      assert(memoryIncreaseMB < 50, `Memory increased by ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent parsing', async () => {
      const feed = generator.createFeed({
        title: 'Concurrent Test',
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
        content_text: 'Test content'
      }, testKeyPair.privateKey);

      const startTime = Date.now();

      // Parse the same feed 10 times concurrently
      const parsePromises = Array(10).fill(null).map(() => 
        parser.parse(updatedFeed, { verifySignatures: false })
      );

      const results = await Promise.all(parsePromises);
      const concurrentTime = Date.now() - startTime;

      assert.strictEqual(results.length, 10);
      assert(results.every(r => r.success === true));
      assert(concurrentTime < 3000, `Concurrent parsing took ${concurrentTime}ms`);
    });
  });
});
