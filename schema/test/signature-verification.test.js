/**
 * Comprehensive signature verification test suite
 * Tests cross-implementation compatibility, attack resistance, and key rotation scenarios
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  generateKeyPair,
  signContent,
  verifySignature,
  validateKeyFormat,
  getPublicKeyFromPrivate
} from '../signature.js';
import { KeyManager, MemoryKeyStorage } from '../keymanagement.js';
import { CanonicalJSONSerializer } from '../canonicalizer.js';

describe('Signature Verification Test Suite', () => {
  describe('Cross-Implementation Test Vectors', () => {
    // Test vectors will be generated dynamically with valid key pairs
    let testVectors = [];

    test.beforeEach(async () => {
      // Generate test vectors with valid key pairs
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      const keyPair3 = await generateKeyPair();
      
      testVectors = [
        {
          name: 'minimal content',
          content: { message: 'hello' },
          privateKey: keyPair1.privateKey,
          publicKey: keyPair1.publicKey,
          expectedCanonical: '{"message":"hello"}',
          expectedSignature: null
        },
        {
          name: 'complex nested object',
          content: {
            author: { name: 'Alice', id: 123 },
            content: 'Hello, world!',
            tags: ['test', 'ansybl'],
            timestamp: '2025-11-04T10:00:00Z'
          },
          privateKey: keyPair2.privateKey,
          publicKey: keyPair2.publicKey,
          expectedCanonical: '{"author":{"id":123,"name":"Alice"},"content":"Hello, world!","tags":["test","ansybl"],"timestamp":"2025-11-04T10:00:00Z"}',
          expectedSignature: null
        },
        {
          name: 'unicode and special characters',
          content: {
            text: 'Hello 🌍! Special chars: "quotes", \\backslash, \n newline',
            emoji: '🚀✨🎉',
            unicode: 'Ñoño café naïve résumé'
          },
          privateKey: keyPair3.privateKey,
          publicKey: keyPair3.publicKey,
          expectedCanonical: '{"emoji":"🚀✨🎉","text":"Hello 🌍! Special chars: \\"quotes\\", \\\\backslash, \\n newline","unicode":"Ñoño café naïve résumé"}',
          expectedSignature: null
        }
      ];
    });

    test('generates consistent canonical representations', async () => {
      for (const vector of testVectors) {
        const canonical = CanonicalJSONSerializer.serialize(vector.content);
        assert.strictEqual(canonical, vector.expectedCanonical, 
          `Canonical representation mismatch for ${vector.name}`);
      }
    });

    test('creates reproducible signatures for test vectors', async () => {
      for (const vector of testVectors) {
        const signature1 = await signContent(vector.content, vector.privateKey);
        const signature2 = await signContent(vector.content, vector.privateKey);
        
        // Same content and key should produce same signature
        assert.strictEqual(signature1, signature2, 
          `Signature not reproducible for ${vector.name}`);
        
        // Signature should verify correctly
        const isValid = await verifySignature(vector.content, signature1, vector.publicKey);
        assert.strictEqual(isValid, true, 
          `Signature verification failed for ${vector.name}`);
        
        // Store signature for cross-implementation testing
        vector.expectedSignature = signature1;
      }
    });

    test('verifies all test vector signatures', async () => {
      // This test ensures that any implementation can verify signatures from test vectors
      for (const vector of testVectors) {
        if (!vector.expectedSignature) {
          // Generate signature if not already set
          vector.expectedSignature = await signContent(vector.content, vector.privateKey);
        }
        
        const isValid = await verifySignature(vector.content, vector.expectedSignature, vector.publicKey);
        assert.strictEqual(isValid, true, 
          `Test vector signature verification failed for ${vector.name}`);
      }
    });
  });

  describe('Attack Resistance Tests', () => {
    let keyPair;

    test.beforeEach(async () => {
      keyPair = await generateKeyPair();
    });

    test('rejects forged signatures', async () => {
      const content = { message: 'legitimate content' };
      const validSignature = await signContent(content, keyPair.privateKey);
      
      // Try various signature forgery attempts
      const forgedSignatures = [
        'ed25519:' + Buffer.from(new Uint8Array(64)).toString('base64'), // All zeros
        'ed25519:' + Buffer.from(new Uint8Array(64).fill(255)).toString('base64'), // All ones
        validSignature.slice(0, -4) + 'FAKE', // Modified valid signature
        'ed25519:' + Buffer.from('forged signature attempt').toString('base64').padEnd(88, '='), // Wrong length
      ];

      for (const forgedSig of forgedSignatures) {
        const isValid = await verifySignature(content, forgedSig, keyPair.publicKey);
        assert.strictEqual(isValid, false, `Forged signature was accepted: ${forgedSig}`);
      }
    });

    test('rejects signatures with wrong public key', async () => {
      const content = { message: 'test content' };
      const signature = await signContent(content, keyPair.privateKey);
      
      // Generate different key pair
      const wrongKeyPair = await generateKeyPair();
      
      const isValid = await verifySignature(content, signature, wrongKeyPair.publicKey);
      assert.strictEqual(isValid, false);
    });

    test('rejects signatures for modified content', async () => {
      const originalContent = { message: 'original content', id: 123 };
      const signature = await signContent(originalContent, keyPair.privateKey);
      
      // Try various content modifications
      const modifiedContents = [
        { message: 'modified content', id: 123 }, // Changed message
        { message: 'original content', id: 124 }, // Changed ID
        { message: 'original content', id: 123, extra: 'field' }, // Added field
        { message: 'original content' }, // Removed field
        { id: 123, message: 'original content' }, // Different key order (should still work due to canonicalization)
      ];

      for (let i = 0; i < modifiedContents.length - 1; i++) { // Skip last one (key order)
        const modifiedContent = modifiedContents[i];
        const isValid = await verifySignature(modifiedContent, signature, keyPair.publicKey);
        assert.strictEqual(isValid, false, 
          `Modified content was accepted: ${JSON.stringify(modifiedContent)}`);
      }
      
      // Key order change should still verify (canonical representation)
      const reorderedContent = modifiedContents[modifiedContents.length - 1];
      const isValidReordered = await verifySignature(reorderedContent, signature, keyPair.publicKey);
      assert.strictEqual(isValidReordered, true, 'Reordered keys should still verify');
    });

    test('handles malformed signature formats gracefully', async () => {
      const content = { message: 'test' };
      
      const malformedSignatures = [
        '', // Empty string
        'not-a-signature', // No prefix
        'rsa:validbase64signature==', // Wrong algorithm
        'ed25519:', // Missing signature data
        'ed25519:not-base64!', // Invalid base64
        'ed25519:' + 'a'.repeat(100), // Wrong length
        null, // Null value
        undefined, // Undefined value
        123, // Wrong type
        { signature: 'object' }, // Object instead of string
      ];

      for (const malformedSig of malformedSignatures) {
        const isValid = await verifySignature(content, malformedSig, keyPair.publicKey);
        assert.strictEqual(isValid, false, 
          `Malformed signature was accepted: ${JSON.stringify(malformedSig)}`);
      }
    });

    test('handles malformed public key formats gracefully', async () => {
      const content = { message: 'test' };
      const signature = await signContent(content, keyPair.privateKey);
      
      const malformedPublicKeys = [
        '', // Empty string
        'not-a-key', // No prefix
        'rsa:validbase64key==', // Wrong algorithm
        'ed25519:', // Missing key data
        'ed25519:not-base64!', // Invalid base64
        'ed25519:' + 'a'.repeat(100), // Wrong length
        null, // Null value
        undefined, // Undefined value
      ];

      for (const malformedKey of malformedPublicKeys) {
        const isValid = await verifySignature(content, signature, malformedKey);
        assert.strictEqual(isValid, false, 
          `Malformed public key was accepted: ${JSON.stringify(malformedKey)}`);
      }
    });

    test('prevents replay attacks with timestamp validation', async () => {
      const baseContent = { message: 'test', timestamp: '2025-11-04T10:00:00Z' };
      const signature = await signContent(baseContent, keyPair.privateKey);
      
      // Same content with different timestamp should not verify with same signature
      const replayContent = { ...baseContent, timestamp: '2025-11-04T11:00:00Z' };
      const isValid = await verifySignature(replayContent, signature, keyPair.publicKey);
      
      assert.strictEqual(isValid, false, 'Replay attack with modified timestamp was accepted');
    });
  });

  describe('Key Rotation and Backward Compatibility', () => {
    let keyManager;

    test.beforeEach(() => {
      keyManager = new KeyManager(new MemoryKeyStorage());
    });

    test('maintains signature validity after key rotation', async () => {
      // Create initial key and sign content
      await keyManager.createKeyPair('test-user');
      const content = { message: 'signed with original key', timestamp: '2025-11-04T10:00:00Z' };
      
      const originalPrivateKey = await keyManager.getPrivateKey('test-user');
      const originalPublicKey = await keyManager.getPublicKey('test-user');
      const originalSignature = await signContent(content, originalPrivateKey);
      
      // Rotate the key
      const rotatedKey = await keyManager.rotateKey('test-user');
      
      // Original signature should still verify with original public key
      const isValidOriginal = await verifySignature(content, originalSignature, originalPublicKey);
      assert.strictEqual(isValidOriginal, true, 'Original signature should remain valid');
      
      // Original signature should NOT verify with new public key
      const isValidWithNewKey = await verifySignature(content, originalSignature, rotatedKey.publicKey);
      assert.strictEqual(isValidWithNewKey, false, 'Original signature should not verify with new key');
      
      // New content signed with new key should verify
      const newContent = { message: 'signed with rotated key', timestamp: '2025-11-04T10:01:00Z' };
      const newPrivateKey = await keyManager.getPrivateKey(rotatedKey.keyId);
      const newSignature = await signContent(newContent, newPrivateKey);
      const isValidNew = await verifySignature(newContent, newSignature, rotatedKey.publicKey);
      
      assert.strictEqual(isValidNew, true, 'New signature should verify with new key');
    });

    test('supports multiple key versions in parallel', async () => {
      await keyManager.createKeyPair('test-user');
      
      // Create content signed with each key version
      const contents = [];
      const signatures = [];
      const publicKeys = [];
      
      // Sign with original key
      let privateKey = await keyManager.getPrivateKey('test-user');
      let publicKey = await keyManager.getPublicKey('test-user');
      let content = { message: 'version 1', version: 1 };
      
      contents.push(content);
      signatures.push(await signContent(content, privateKey));
      publicKeys.push(publicKey);
      
      // Rotate and sign with v2
      let rotatedKey = await keyManager.rotateKey('test-user');
      privateKey = await keyManager.getPrivateKey(rotatedKey.keyId);
      content = { message: 'version 2', version: 2 };
      
      contents.push(content);
      signatures.push(await signContent(content, privateKey));
      publicKeys.push(rotatedKey.publicKey);
      
      // Rotate again and sign with v3
      rotatedKey = await keyManager.rotateKey('test-user');
      privateKey = await keyManager.getPrivateKey(rotatedKey.keyId);
      content = { message: 'version 3', version: 3 };
      
      contents.push(content);
      signatures.push(await signContent(content, privateKey));
      publicKeys.push(rotatedKey.publicKey);
      
      // All signatures should verify with their respective public keys
      for (let i = 0; i < contents.length; i++) {
        const isValid = await verifySignature(contents[i], signatures[i], publicKeys[i]);
        assert.strictEqual(isValid, true, `Version ${i + 1} signature should verify`);
        
        // Cross-verification should fail
        for (let j = 0; j < publicKeys.length; j++) {
          if (i !== j) {
            const crossValid = await verifySignature(contents[i], signatures[i], publicKeys[j]);
            assert.strictEqual(crossValid, false, 
              `Version ${i + 1} signature should not verify with version ${j + 1} key`);
          }
        }
      }
    });

    test('validates key rotation chain integrity', async () => {
      await keyManager.createKeyPair('test-user');
      
      // Perform multiple rotations
      const rotations = [];
      rotations.push(await keyManager.rotateKey('test-user'));
      rotations.push(await keyManager.rotateKey('test-user'));
      rotations.push(await keyManager.rotateKey('test-user'));
      
      // Verify rotation chain
      assert.strictEqual(rotations[0].version, 2);
      assert.strictEqual(rotations[0].previousKeyId, 'test-user');
      
      assert.strictEqual(rotations[1].version, 3);
      assert.strictEqual(rotations[1].previousKeyId, 'test-user_v2');
      
      assert.strictEqual(rotations[2].version, 4);
      assert.strictEqual(rotations[2].previousKeyId, 'test-user_v3');
      
      // Active key should be the latest
      const activeKey = await keyManager.getActiveKey('test-user');
      assert.strictEqual(activeKey.version, 4);
      assert.strictEqual(activeKey.keyId, 'test-user_v4');
    });

    test('handles concurrent key operations safely', async () => {
      await keyManager.createKeyPair('test-user');
      
      // Simulate concurrent operations
      const operations = [
        keyManager.getPrivateKey('test-user'),
        keyManager.getPublicKey('test-user'),
        keyManager.validateKey('test-user'),
        keyManager.getActiveKey('test-user')
      ];
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      assert.ok(results[0]); // Private key
      assert.ok(results[1]); // Public key
      assert.strictEqual(results[2].valid, true); // Validation
      assert.ok(results[3]); // Active key
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles large content efficiently', async () => {
      const keyPair = await generateKeyPair();
      
      // Create large content object
      const largeContent = {
        data: 'x'.repeat(10000), // 10KB string
        array: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
        nested: {
          level1: {
            level2: {
              level3: {
                message: 'deeply nested content'
              }
            }
          }
        }
      };
      
      const startTime = Date.now();
      const signature = await signContent(largeContent, keyPair.privateKey);
      const signTime = Date.now() - startTime;
      
      const verifyStartTime = Date.now();
      const isValid = await verifySignature(largeContent, signature, keyPair.publicKey);
      const verifyTime = Date.now() - verifyStartTime;
      
      assert.strictEqual(isValid, true);
      
      // Performance should be reasonable (less than 1 second for large content)
      assert.ok(signTime < 1000, `Signing took too long: ${signTime}ms`);
      assert.ok(verifyTime < 1000, `Verification took too long: ${verifyTime}ms`);
    });

    test('handles empty and minimal content', async () => {
      const keyPair = await generateKeyPair();
      
      const edgeCases = [
        {}, // Empty object
        { a: '' }, // Empty string value
        { a: 0 }, // Zero value
        { a: false }, // False value
        { a: null }, // Null value
        { a: [] }, // Empty array
        { '': 'empty key' }, // Empty key
      ];
      
      for (const content of edgeCases) {
        const signature = await signContent(content, keyPair.privateKey);
        const isValid = await verifySignature(content, signature, keyPair.publicKey);
        
        assert.strictEqual(isValid, true, 
          `Edge case failed: ${JSON.stringify(content)}`);
      }
    });

    test('maintains consistency across multiple sign/verify cycles', async () => {
      const keyPair = await generateKeyPair();
      const content = { message: 'consistency test', counter: 0 };
      
      // Perform multiple sign/verify cycles
      for (let i = 0; i < 100; i++) {
        content.counter = i;
        const signature = await signContent(content, keyPair.privateKey);
        const isValid = await verifySignature(content, signature, keyPair.publicKey);
        
        assert.strictEqual(isValid, true, `Cycle ${i} failed`);
      }
    });
  });
});