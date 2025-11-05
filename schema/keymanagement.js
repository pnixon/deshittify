/**
 * Key management system for Ansybl protocol
 * Handles key pair generation, storage, retrieval, and rotation
 */

import { generateKeyPair, validateKeyFormat, getPublicKeyFromPrivate } from './signature.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

/**
 * Key storage interface for different environments
 */
export class KeyStorage {
  /**
   * Store a key pair with metadata
   * @param {string} keyId - Unique identifier for the key pair
   * @param {object} keyData - Key pair data with metadata
   */
  async storeKeyPair(keyId, keyData) {
    throw new Error('storeKeyPair must be implemented by subclass');
  }

  /**
   * Retrieve a key pair by ID
   * @param {string} keyId - Key pair identifier
   * @returns {Promise<object|null>} Key pair data or null if not found
   */
  async getKeyPair(keyId) {
    throw new Error('getKeyPair must be implemented by subclass');
  }

  /**
   * List all stored key pairs
   * @returns {Promise<string[]>} Array of key IDs
   */
  async listKeyPairs() {
    throw new Error('listKeyPairs must be implemented by subclass');
  }

  /**
   * Delete a key pair
   * @param {string} keyId - Key pair identifier
   */
  async deleteKeyPair(keyId) {
    throw new Error('deleteKeyPair must be implemented by subclass');
  }
}

/**
 * File-based key storage implementation
 */
export class FileKeyStorage extends KeyStorage {
  constructor(baseDir = null) {
    super();
    this.baseDir = baseDir || join(homedir(), '.ansybl', 'keys');
  }

  async _ensureDirectory() {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }
  }

  async storeKeyPair(keyId, keyData) {
    await this._ensureDirectory();
    const filePath = join(this.baseDir, `${keyId}.json`);
    
    // Add metadata
    const dataWithMetadata = {
      ...keyData,
      keyId,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    await writeFile(filePath, JSON.stringify(dataWithMetadata, null, 2));
  }

  async getKeyPair(keyId) {
    try {
      const filePath = join(this.baseDir, `${keyId}.json`);
      const data = await readFile(filePath, 'utf8');
      const keyData = JSON.parse(data);
      
      // Update last used timestamp
      keyData.lastUsed = new Date().toISOString();
      await writeFile(filePath, JSON.stringify(keyData, null, 2));
      
      return keyData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listKeyPairs() {
    try {
      await this._ensureDirectory();
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.baseDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  async deleteKeyPair(keyId) {
    try {
      const { unlink } = await import('node:fs/promises');
      const filePath = join(this.baseDir, `${keyId}.json`);
      await unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}

/**
 * In-memory key storage for testing and temporary use
 */
export class MemoryKeyStorage extends KeyStorage {
  constructor() {
    super();
    this.keys = new Map();
  }

  async storeKeyPair(keyId, keyData) {
    const dataWithMetadata = {
      ...keyData,
      keyId,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    this.keys.set(keyId, dataWithMetadata);
  }

  async getKeyPair(keyId) {
    const keyData = this.keys.get(keyId);
    if (keyData) {
      keyData.lastUsed = new Date().toISOString();
      return keyData;
    }
    return null;
  }

  async listKeyPairs() {
    return Array.from(this.keys.keys());
  }

  async deleteKeyPair(keyId) {
    return this.keys.delete(keyId);
  }
}

/**
 * Key management system with rotation support
 */
export class KeyManager {
  constructor(storage = null) {
    this.storage = storage || new FileKeyStorage();
  }

  /**
   * Generate and store a new key pair
   * @param {string} keyId - Unique identifier for the key pair
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} Generated key pair with metadata
   */
  async createKeyPair(keyId, metadata = {}) {
    // Check if key already exists
    const existing = await this.storage.getKeyPair(keyId);
    if (existing) {
      throw new Error(`Key pair with ID '${keyId}' already exists`);
    }

    const keyPair = await generateKeyPair();
    
    const keyData = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      status: 'active',
      version: 1,
      metadata: {
        purpose: 'signing',
        algorithm: 'ed25519',
        ...metadata
      }
    };

    await this.storage.storeKeyPair(keyId, keyData);
    
    // Return without private key for security
    return {
      keyId,
      publicKey: keyPair.publicKey,
      status: 'active',
      version: 1,
      createdAt: keyData.createdAt,
      metadata: keyData.metadata
    };
  }

  /**
   * Get a key pair by ID
   * @param {string} keyId - Key pair identifier
   * @param {boolean} includePrivateKey - Whether to include private key in response
   * @returns {Promise<object|null>} Key pair data or null if not found
   */
  async getKeyPair(keyId, includePrivateKey = false) {
    const keyData = await this.storage.getKeyPair(keyId);
    if (!keyData) {
      return null;
    }

    if (!includePrivateKey) {
      const { privateKey, ...publicData } = keyData;
      return publicData;
    }

    return keyData;
  }

  /**
   * Get the private key for signing operations
   * @param {string} keyId - Key pair identifier
   * @returns {Promise<string|null>} Private key or null if not found
   */
  async getPrivateKey(keyId) {
    const keyData = await this.storage.getKeyPair(keyId);
    return keyData ? keyData.privateKey : null;
  }

  /**
   * Get the public key for verification operations
   * @param {string} keyId - Key pair identifier
   * @returns {Promise<string|null>} Public key or null if not found
   */
  async getPublicKey(keyId) {
    const keyData = await this.storage.getKeyPair(keyId);
    return keyData ? keyData.publicKey : null;
  }

  /**
   * List all key pairs
   * @returns {Promise<object[]>} Array of key pair metadata (without private keys)
   */
  async listKeyPairs() {
    const keyIds = await this.storage.listKeyPairs();
    const keyPairs = [];
    
    for (const keyId of keyIds) {
      const keyData = await this.getKeyPair(keyId, false);
      if (keyData) {
        keyPairs.push(keyData);
      }
    }
    
    return keyPairs;
  }

  /**
   * Rotate a key pair (create new version, mark old as deprecated)
   * @param {string} baseKeyId - Base key pair identifier (without version)
   * @param {object} metadata - Additional metadata for new key
   * @returns {Promise<object>} New key pair data
   */
  async rotateKey(baseKeyId, metadata = {}) {
    // Find the current active key in the family
    const activeKey = await this.getActiveKey(baseKeyId);
    if (!activeKey) {
      throw new Error(`Key pair '${baseKeyId}' not found`);
    }

    // Mark current active key as deprecated
    activeKey.status = 'deprecated';
    activeKey.deprecatedAt = new Date().toISOString();
    await this.storage.storeKeyPair(activeKey.keyId, activeKey);

    // Create new key with incremented version
    const newVersion = activeKey.version + 1;
    const newKeyId = newVersion === 2 ? `${baseKeyId}_v${newVersion}` : `${baseKeyId}_v${newVersion}`;
    const newKeyPair = await generateKeyPair();
    
    const newKeyData = {
      privateKey: newKeyPair.privateKey,
      publicKey: newKeyPair.publicKey,
      status: 'active',
      version: newVersion,
      previousKeyId: activeKey.keyId,
      metadata: {
        purpose: 'signing',
        algorithm: 'ed25519',
        rotatedFrom: activeKey.keyId,
        ...metadata
      }
    };

    await this.storage.storeKeyPair(newKeyId, newKeyData);

    return {
      keyId: newKeyId,
      publicKey: newKeyPair.publicKey,
      status: 'active',
      version: newKeyData.version,
      previousKeyId: activeKey.keyId,
      metadata: newKeyData.metadata
    };
  }

  /**
   * Get the active key for a key family (handles rotation)
   * @param {string} baseKeyId - Base key identifier (without version suffix)
   * @returns {Promise<object|null>} Active key data or null if not found
   */
  async getActiveKey(baseKeyId) {
    const allKeys = await this.storage.listKeyPairs();
    const familyKeys = allKeys
      .filter(keyId => keyId === baseKeyId || keyId.startsWith(`${baseKeyId}_v`))
      .map(async keyId => {
        const keyData = await this.storage.getKeyPair(keyId);
        return { keyId, ...keyData };
      });

    const resolvedKeys = await Promise.all(familyKeys);
    const activeKeys = resolvedKeys.filter(key => key.status === 'active');
    
    if (activeKeys.length === 0) {
      return null;
    }

    // Return the key with the highest version
    return activeKeys.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
  }

  /**
   * Validate key integrity and format
   * @param {string} keyId - Key pair identifier
   * @returns {Promise<object>} Validation result
   */
  async validateKey(keyId) {
    const keyData = await this.storage.getKeyPair(keyId);
    if (!keyData) {
      return { valid: false, error: 'Key not found' };
    }

    // Validate private key format
    const privateValidation = validateKeyFormat(keyData.privateKey, 'private');
    if (!privateValidation.valid) {
      return { valid: false, error: `Invalid private key: ${privateValidation.error}` };
    }

    // Validate public key format
    const publicValidation = validateKeyFormat(keyData.publicKey, 'public');
    if (!publicValidation.valid) {
      return { valid: false, error: `Invalid public key: ${publicValidation.error}` };
    }

    // Verify that public key matches private key
    try {
      const derivedPublicKey = await getPublicKeyFromPrivate(keyData.privateKey);
      if (derivedPublicKey !== keyData.publicKey) {
        return { valid: false, error: 'Public key does not match private key' };
      }
    } catch (error) {
      return { valid: false, error: `Key derivation failed: ${error.message}` };
    }

    return { 
      valid: true, 
      keyId,
      status: keyData.status,
      version: keyData.version,
      algorithm: keyData.metadata?.algorithm || 'ed25519'
    };
  }

  /**
   * Delete a key pair (use with caution)
   * @param {string} keyId - Key pair identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteKeyPair(keyId) {
    return await this.storage.deleteKeyPair(keyId);
  }
}