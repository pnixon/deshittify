/**
 * Tests for ed25519 signature utilities
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

describe('Ed25519 Signature Utilities', () => {
  test('generateKeyPair creates valid key pair', async () => {
    const keyPair = await generateKeyPair();
    
    assert.ok(keyPair.privateKey.startsWith('ed25519:'));
    assert.ok(keyPair.publicKey.startsWith('ed25519:'));
    
    // Validate key formats
    const privateValidation = validateKeyFormat(keyPair.privateKey, 'private');
    const publicValidation = validateKeyFormat(keyPair.publicKey, 'public');
    
    assert.strictEqual(privateValidation.valid, true);
    assert.strictEqual(publicValidation.valid, true);
  });

  test('signContent and verifySignature work together', async () => {
    const keyPair = await generateKeyPair();
    const content = { message: 'Hello, Ansybl!', timestamp: '2025-11-04T10:00:00Z' };
    
    const signature = await signContent(content, keyPair.privateKey);
    assert.ok(signature.startsWith('ed25519:'));
    
    const isValid = await verifySignature(content, signature, keyPair.publicKey);
    assert.strictEqual(isValid, true);
  });

  test('signature verification fails with wrong public key', async () => {
    const keyPair1 = await generateKeyPair();
    const keyPair2 = await generateKeyPair();
    const content = { message: 'Hello, Ansybl!' };
    
    const signature = await signContent(content, keyPair1.privateKey);
    const isValid = await verifySignature(content, signature, keyPair2.publicKey);
    
    assert.strictEqual(isValid, false);
  });

  test('signature verification fails with modified content', async () => {
    const keyPair = await generateKeyPair();
    const originalContent = { message: 'Hello, Ansybl!' };
    const modifiedContent = { message: 'Hello, World!' };
    
    const signature = await signContent(originalContent, keyPair.privateKey);
    const isValid = await verifySignature(modifiedContent, signature, keyPair.publicKey);
    
    assert.strictEqual(isValid, false);
  });

  test('validateKeyFormat validates private keys correctly', () => {
    const validPrivateKey = 'ed25519:' + Buffer.from(new Uint8Array(32)).toString('base64');
    const invalidPrefix = 'rsa:' + Buffer.from(new Uint8Array(32)).toString('base64');
    const invalidLength = 'ed25519:' + Buffer.from(new Uint8Array(16)).toString('base64');
    const invalidBase64 = 'ed25519:invalid-base64!';
    
    assert.strictEqual(validateKeyFormat(validPrivateKey, 'private').valid, true);
    assert.strictEqual(validateKeyFormat(invalidPrefix, 'private').valid, false);
    assert.strictEqual(validateKeyFormat(invalidLength, 'private').valid, false);
    assert.strictEqual(validateKeyFormat(invalidBase64, 'private').valid, false);
    assert.strictEqual(validateKeyFormat('', 'private').valid, false);
    assert.strictEqual(validateKeyFormat(null, 'private').valid, false);
  });

  test('validateKeyFormat validates public keys correctly', () => {
    const validPublicKey = 'ed25519:' + Buffer.from(new Uint8Array(32)).toString('base64');
    const invalidLength = 'ed25519:' + Buffer.from(new Uint8Array(64)).toString('base64');
    
    assert.strictEqual(validateKeyFormat(validPublicKey, 'public').valid, true);
    assert.strictEqual(validateKeyFormat(invalidLength, 'public').valid, false);
  });

  test('getPublicKeyFromPrivate extracts correct public key', async () => {
    const keyPair = await generateKeyPair();
    const extractedPublicKey = await getPublicKeyFromPrivate(keyPair.privateKey);
    
    assert.strictEqual(extractedPublicKey, keyPair.publicKey);
  });

  test('signContent throws error for invalid private key', async () => {
    const content = { message: 'test' };
    
    await assert.rejects(
      () => signContent(content, 'invalid-key'),
      /Private key must be in format "ed25519:base64"/
    );
    
    await assert.rejects(
      () => signContent(content, 'ed25519:invalid-base64!'),
      /Invalid private key length/
    );
  });

  test('verifySignature handles malformed signatures gracefully', async () => {
    const keyPair = await generateKeyPair();
    const content = { message: 'test' };
    
    // Invalid signature formats should return false, not throw
    assert.strictEqual(await verifySignature(content, 'invalid-sig', keyPair.publicKey), false);
    assert.strictEqual(await verifySignature(content, 'ed25519:invalid!', keyPair.publicKey), false);
    assert.strictEqual(await verifySignature(content, 'ed25519:' + Buffer.from(new Uint8Array(32)).toString('base64'), keyPair.publicKey), false);
  });

  test('canonical content produces consistent signatures', async () => {
    const keyPair = await generateKeyPair();
    
    // Same content in different key orders should produce same signature
    const content1 = { b: 'value2', a: 'value1' };
    const content2 = { a: 'value1', b: 'value2' };
    
    const signature1 = await signContent(content1, keyPair.privateKey);
    const signature2 = await signContent(content2, keyPair.privateKey);
    
    assert.strictEqual(signature1, signature2);
    
    // Both should verify successfully
    assert.strictEqual(await verifySignature(content1, signature1, keyPair.publicKey), true);
    assert.strictEqual(await verifySignature(content2, signature1, keyPair.publicKey), true);
  });
});