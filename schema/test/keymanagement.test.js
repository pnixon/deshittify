/**
 * Tests for key management system
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { KeyManager, FileKeyStorage, MemoryKeyStorage } from '../keymanagement.js';
import { validateKeyFormat } from '../signature.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

describe('Key Management System', () => {
  describe('MemoryKeyStorage', () => {
    test('stores and retrieves key pairs', async () => {
      const storage = new MemoryKeyStorage();
      const keyData = {
        privateKey: 'ed25519:test-private-key',
        publicKey: 'ed25519:test-public-key',
        status: 'active'
      };

      await storage.storeKeyPair('test-key', keyData);
      const retrieved = await storage.getKeyPair('test-key');

      assert.strictEqual(retrieved.keyId, 'test-key');
      assert.strictEqual(retrieved.privateKey, keyData.privateKey);
      assert.strictEqual(retrieved.publicKey, keyData.publicKey);
      assert.ok(retrieved.createdAt);
      assert.ok(retrieved.lastUsed);
    });

    test('returns null for non-existent keys', async () => {
      const storage = new MemoryKeyStorage();
      const result = await storage.getKeyPair('non-existent');
      assert.strictEqual(result, null);
    });

    test('lists stored key pairs', async () => {
      const storage = new MemoryKeyStorage();
      await storage.storeKeyPair('key1', { privateKey: 'test1', publicKey: 'test1' });
      await storage.storeKeyPair('key2', { privateKey: 'test2', publicKey: 'test2' });

      const keyIds = await storage.listKeyPairs();
      assert.deepStrictEqual(keyIds.sort(), ['key1', 'key2']);
    });

    test('deletes key pairs', async () => {
      const storage = new MemoryKeyStorage();
      await storage.storeKeyPair('test-key', { privateKey: 'test', publicKey: 'test' });

      const deleted = await storage.deleteKeyPair('test-key');
      assert.strictEqual(deleted, true);

      const retrieved = await storage.getKeyPair('test-key');
      assert.strictEqual(retrieved, null);
    });
  });

  describe('FileKeyStorage', () => {
    let tempDir;
    let storage;

    test.beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'ansybl-test-'));
      storage = new FileKeyStorage(tempDir);
    });

    test.afterEach(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('stores and retrieves key pairs from filesystem', async () => {
      const keyData = {
        privateKey: 'ed25519:test-private-key',
        publicKey: 'ed25519:test-public-key',
        status: 'active'
      };

      await storage.storeKeyPair('test-key', keyData);
      const retrieved = await storage.getKeyPair('test-key');

      assert.strictEqual(retrieved.keyId, 'test-key');
      assert.strictEqual(retrieved.privateKey, keyData.privateKey);
      assert.strictEqual(retrieved.publicKey, keyData.publicKey);
    });

    test('creates directory if it does not exist', async () => {
      const keyData = { privateKey: 'test', publicKey: 'test' };
      await storage.storeKeyPair('test-key', keyData);
      
      const retrieved = await storage.getKeyPair('test-key');
      assert.ok(retrieved);
    });
  });

  describe('KeyManager', () => {
    let keyManager;

    test.beforeEach(() => {
      keyManager = new KeyManager(new MemoryKeyStorage());
    });

    test('creates new key pairs', async () => {
      const result = await keyManager.createKeyPair('test-user', { purpose: 'testing' });

      assert.strictEqual(result.keyId, 'test-user');
      assert.ok(result.publicKey.startsWith('ed25519:'));
      assert.strictEqual(result.status, 'active');
      assert.strictEqual(result.version, 1);
      assert.strictEqual(result.metadata.purpose, 'testing');
      assert.ok(!result.privateKey); // Should not include private key in response
    });

    test('prevents duplicate key creation', async () => {
      await keyManager.createKeyPair('test-user');

      await assert.rejects(
        () => keyManager.createKeyPair('test-user'),
        /Key pair with ID 'test-user' already exists/
      );
    });

    test('retrieves key pairs with and without private key', async () => {
      await keyManager.createKeyPair('test-user');

      const publicOnly = await keyManager.getKeyPair('test-user', false);
      assert.ok(!publicOnly.privateKey);
      assert.ok(publicOnly.publicKey);

      const withPrivate = await keyManager.getKeyPair('test-user', true);
      assert.ok(withPrivate.privateKey);
      assert.ok(withPrivate.publicKey);
    });

    test('gets private and public keys separately', async () => {
      await keyManager.createKeyPair('test-user');

      const privateKey = await keyManager.getPrivateKey('test-user');
      const publicKey = await keyManager.getPublicKey('test-user');

      assert.ok(privateKey.startsWith('ed25519:'));
      assert.ok(publicKey.startsWith('ed25519:'));

      // Validate key formats
      assert.strictEqual(validateKeyFormat(privateKey, 'private').valid, true);
      assert.strictEqual(validateKeyFormat(publicKey, 'public').valid, true);
    });

    test('lists key pairs', async () => {
      await keyManager.createKeyPair('user1');
      await keyManager.createKeyPair('user2');

      const keyPairs = await keyManager.listKeyPairs();
      assert.strictEqual(keyPairs.length, 2);
      
      const keyIds = keyPairs.map(kp => kp.keyId).sort();
      assert.deepStrictEqual(keyIds, ['user1', 'user2']);

      // Ensure no private keys in list
      keyPairs.forEach(kp => {
        assert.ok(!kp.privateKey);
        assert.ok(kp.publicKey);
      });
    });

    test('rotates keys with version increment', async () => {
      await keyManager.createKeyPair('test-user');
      const rotated = await keyManager.rotateKey('test-user', { reason: 'scheduled rotation' });

      assert.strictEqual(rotated.keyId, 'test-user_v2');
      assert.strictEqual(rotated.version, 2);
      assert.strictEqual(rotated.previousKeyId, 'test-user');
      assert.strictEqual(rotated.status, 'active');
      assert.strictEqual(rotated.metadata.reason, 'scheduled rotation');

      // Original key should be deprecated
      const originalKey = await keyManager.getKeyPair('test-user', true);
      assert.strictEqual(originalKey.status, 'deprecated');
      assert.ok(originalKey.deprecatedAt);
    });

    test('gets active key from key family', async () => {
      await keyManager.createKeyPair('test-user');
      await keyManager.rotateKey('test-user');
      await keyManager.rotateKey('test-user');

      const activeKey = await keyManager.getActiveKey('test-user');
      assert.strictEqual(activeKey.keyId, 'test-user_v3');
      assert.strictEqual(activeKey.version, 3);
      assert.strictEqual(activeKey.status, 'active');
    });

    test('validates key integrity', async () => {
      await keyManager.createKeyPair('test-user');

      const validation = await keyManager.validateKey('test-user');
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.keyId, 'test-user');
      assert.strictEqual(validation.status, 'active');
      assert.strictEqual(validation.version, 1);
      assert.strictEqual(validation.algorithm, 'ed25519');
    });

    test('handles validation of non-existent keys', async () => {
      const validation = await keyManager.validateKey('non-existent');
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.error, 'Key not found');
    });

    test('deletes key pairs', async () => {
      await keyManager.createKeyPair('test-user');
      
      const deleted = await keyManager.deleteKeyPair('test-user');
      assert.strictEqual(deleted, true);

      const retrieved = await keyManager.getKeyPair('test-user');
      assert.strictEqual(retrieved, null);
    });

    test('handles rotation of non-existent keys', async () => {
      await assert.rejects(
        () => keyManager.rotateKey('non-existent'),
        /Key pair 'non-existent' not found/
      );
    });

    test('returns null for non-existent keys', async () => {
      assert.strictEqual(await keyManager.getKeyPair('non-existent'), null);
      assert.strictEqual(await keyManager.getPrivateKey('non-existent'), null);
      assert.strictEqual(await keyManager.getPublicKey('non-existent'), null);
      assert.strictEqual(await keyManager.getActiveKey('non-existent'), null);
    });
  });
});