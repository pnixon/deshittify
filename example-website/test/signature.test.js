/**
 * Unit tests for Signature Service (example-website implementation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateKeyPair, signContent, verifySignature } from '../lib/signature.js';

describe('SignatureService - example-website', () => {
  let testKeyPair;

  test('setup', async () => {
    testKeyPair = await generateKeyPair();
  });

  describe('Key Generation', () => {
    test('should generate valid key pair', async () => {
      const keyPair = await generateKeyPair();
      
      assert(keyPair.publicKey);
      assert(keyPair.privateKey);
      assert(keyPair.publicKey.startsWith('ed25519:'));
      assert(keyPair.privateKey.startsWith('ed25519:'));
    });

    test('should generate unique key pairs', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      
      assert.notStrictEqual(keyPair1.publicKey, keyPair2.publicKey);
      assert.notStrictEqual(keyPair1.privateKey, keyPair2.privateKey);
    });
  });

  describe('Content Signing', () => {
    test('should sign content', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Hello world',
        date_published: '2025-11-04T10:00:00Z'
      };

      const signature = await signContent(content, testKeyPair.privateKey);
      
      assert(signature);
      assert(signature.startsWith('ed25519:'));
    });

    test('should produce consistent signatures for same content', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const sig1 = await signContent(content, testKeyPair.privateKey);
      const sig2 = await signContent(content, testKeyPair.privateKey);
      
      assert.strictEqual(sig1, sig2);
    });
  });

  describe('Signature Verification', () => {
    test('should verify valid signature', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const signature = await signContent(content, testKeyPair.privateKey);
      const isValid = await verifySignature(content, signature, testKeyPair.publicKey);
      
      assert.strictEqual(isValid, true);
    });

    test('should reject invalid signature', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const fakeSignature = 'ed25519:aW52YWxpZHNpZ25hdHVyZQ==';
      const isValid = await verifySignature(content, fakeSignature, testKeyPair.publicKey);
      
      assert.strictEqual(isValid, false);
    });

    test('should reject tampered content', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const signature = await signContent(content, testKeyPair.privateKey);
      
      // Tamper with content
      content.content_text = 'Tampered content';
      
      const isValid = await verifySignature(content, signature, testKeyPair.publicKey);
      
      assert.strictEqual(isValid, false);
    });
  });
});
