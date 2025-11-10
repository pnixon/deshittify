/**
 * Integration tests for signature verification workflows
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../../lib/generator.js';
import { AnsyblParser } from '../../lib/parser.js';
import { generateKeyPair, signContent, verifySignature } from '../../lib/signature.js';

describe('Signature Workflow Integration', () => {
  let generator;
  let parser;
  let testKeyPair;

  test('setup', async () => {
    generator = new AnsyblGenerator();
    parser = new AnsyblParser();
    testKeyPair = await generateKeyPair();
  });

  describe('End-to-End Signature Verification', () => {
    test('should create, sign, and verify a complete feed', async () => {
      // Create feed
      const feed = generator.createFeed({
        title: 'Signature Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      // Add signed item
      const updatedFeed = await generator.addItem(feed, {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Signed content'
      }, testKeyPair.privateKey);

      // Sign the feed
      const signedFeed = await generator.signFeed(updatedFeed, testKeyPair.privateKey);

      // Parse with signature verification
      const parseResult = await parser.parse(signedFeed, { 
        verifySignatures: true 
      });

      // Verify signatures were checked
      assert(parseResult.signatures);
      assert.strictEqual(parseResult.success, true);
    });

    test('should detect tampered content', async () => {
      // Create and sign feed
      const feed = generator.createFeed({
        title: 'Tamper Test Feed',
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
        content_text: 'Original content'
      }, testKeyPair.privateKey);

      // Tamper with content after signing
      updatedFeed.items[0].content_text = 'Tampered content';

      // Parse with signature verification
      const parseResult = await parser.parse(updatedFeed, { 
        verifySignatures: true 
      });

      // Should detect invalid signature
      if (parseResult.signatures) {
        assert.strictEqual(parseResult.signatures.allValid, false);
      }
    });
  });

  describe('Key Pair Management', () => {
    test('should work with multiple key pairs', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      // Create content with first key
      const content1 = { id: 'test-1', text: 'Content 1' };
      const sig1 = await signContent(content1, keyPair1.privateKey);

      // Create content with second key
      const content2 = { id: 'test-2', text: 'Content 2' };
      const sig2 = await signContent(content2, keyPair2.privateKey);

      // Verify with correct keys
      const valid1 = await verifySignature(content1, sig1, keyPair1.publicKey);
      const valid2 = await verifySignature(content2, sig2, keyPair2.publicKey);

      assert.strictEqual(valid1, true);
      assert.strictEqual(valid2, true);

      // Verify with wrong keys should fail
      const invalid1 = await verifySignature(content1, sig1, keyPair2.publicKey);
      const invalid2 = await verifySignature(content2, sig2, keyPair1.publicKey);

      assert.strictEqual(invalid1, false);
      assert.strictEqual(invalid2, false);
    });
  });

  describe('Signature Consistency', () => {
    test('should produce consistent signatures for same content', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Consistent content',
        date_published: '2025-11-04T10:00:00Z'
      };

      const sig1 = await signContent(content, testKeyPair.privateKey);
      const sig2 = await signContent(content, testKeyPair.privateKey);

      assert.strictEqual(sig1, sig2);
    });

    test('should produce different signatures for different content', async () => {
      const content1 = { id: 'test-1', text: 'Content 1' };
      const content2 = { id: 'test-2', text: 'Content 2' };

      const sig1 = await signContent(content1, testKeyPair.privateKey);
      const sig2 = await signContent(content2, testKeyPair.privateKey);

      assert.notStrictEqual(sig1, sig2);
    });
  });
});
