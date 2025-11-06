/**
 * Ed25519 signature utilities for Ansybl protocol
 * Implements signature generation and verification over canonical JSON content
 * Includes key management, rotation, and secure storage features
 */

import * as ed25519 from '@noble/ed25519';
import { createHash, randomBytes } from 'node:crypto';
import { CanonicalJSONSerializer } from './canonicalizer.js';

// Configure the hash function for @noble/ed25519
ed25519.etc.sha512Sync = (...m) => createHash('sha512').update(Buffer.concat(m)).digest();

/**
 * Key management service for Ed25519 keys
 */
export class KeyManager {
  constructor() {
    this.keyStore = new Map(); // In-memory key storage (use secure storage in production)
    this.keyRotationHistory = new Map();
  }

  /**
   * Generate and store a new key pair
   * @param {string} keyId - Unique identifier for the key pair
   * @returns {Promise<{keyId: string, privateKey: string, publicKey: string}>}
   */
  async generateKeyPair(keyId) {
    const keyPair = await generateKeyPair();
    
    const keyData = {
      keyId,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      createdAt: new Date().toISOString(),
      isActive: true,
      rotationCount: 0
    };
    
    this.keyStore.set(keyId, keyData);
    
    return {
      keyId,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    };
  }

  /**
   * Rotate a key pair (generate new keys while keeping old ones for verification)
   * @param {string} keyId - Key identifier to rotate
   * @returns {Promise<{keyId: string, privateKey: string, publicKey: string, previousPublicKey: string}>}
   */
  async rotateKey(keyId) {
    const existingKey = this.keyStore.get(keyId);
    if (!existingKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Store the old key in rotation history
    const historyKey = `${keyId}_v${existingKey.rotationCount}`;
    this.keyRotationHistory.set(historyKey, {
      ...existingKey,
      isActive: false,
      rotatedAt: new Date().toISOString()
    });

    // Generate new key pair
    const newKeyPair = await generateKeyPair();
    
    const newKeyData = {
      keyId,
      privateKey: newKeyPair.privateKey,
      publicKey: newKeyPair.publicKey,
      createdAt: new Date().toISOString(),
      isActive: true,
      rotationCount: existingKey.rotationCount + 1,
      previousPublicKey: existingKey.publicKey
    };
    
    this.keyStore.set(keyId, newKeyData);
    
    return {
      keyId,
      privateKey: newKeyPair.privateKey,
      publicKey: newKeyPair.publicKey,
      previousPublicKey: existingKey.publicKey
    };
  }

  /**
   * Get active key pair
   * @param {string} keyId - Key identifier
   * @returns {object|null} Key data or null if not found
   */
  getActiveKey(keyId) {
    const keyData = this.keyStore.get(keyId);
    return keyData && keyData.isActive ? keyData : null;
  }

  /**
   * Get public key for verification (checks current and historical keys)
   * @param {string} keyId - Key identifier
   * @param {string} publicKey - Public key to find
   * @returns {object|null} Key data or null if not found
   */
  getPublicKeyData(keyId, publicKey) {
    // Check active key
    const activeKey = this.keyStore.get(keyId);
    if (activeKey && activeKey.publicKey === publicKey) {
      return activeKey;
    }

    // Check rotation history
    for (const [historyKeyId, keyData] of this.keyRotationHistory.entries()) {
      if (historyKeyId.startsWith(keyId) && keyData.publicKey === publicKey) {
        return keyData;
      }
    }

    return null;
  }

  /**
   * List all keys for an identifier
   * @param {string} keyId - Key identifier
   * @returns {object[]} Array of key data
   */
  getKeyHistory(keyId) {
    const keys = [];
    
    // Add active key
    const activeKey = this.keyStore.get(keyId);
    if (activeKey) {
      keys.push(activeKey);
    }

    // Add historical keys
    for (const [historyKeyId, keyData] of this.keyRotationHistory.entries()) {
      if (historyKeyId.startsWith(keyId)) {
        keys.push(keyData);
      }
    }

    return keys.sort((a, b) => b.rotationCount - a.rotationCount);
  }

  /**
   * Securely delete a key (marks as deleted, actual deletion should be handled by secure storage)
   * @param {string} keyId - Key identifier
   * @returns {boolean} Success status
   */
  deleteKey(keyId) {
    const keyData = this.keyStore.get(keyId);
    if (!keyData) {
      return false;
    }

    // Mark as deleted instead of actual deletion for audit trail
    keyData.isActive = false;
    keyData.deletedAt = new Date().toISOString();
    
    return true;
  }
}

/**
 * Generate an ed25519 key pair
 * @returns {Promise<{privateKey: string, publicKey: string}>} Base64-encoded key pair
 */
export async function generateKeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKey(privateKey);
  
  return {
    privateKey: `ed25519:${Buffer.from(privateKey).toString('base64')}`,
    publicKey: `ed25519:${Buffer.from(publicKey).toString('base64')}`
  };
}

/**
 * Sign content using ed25519 private key
 * @param {any} content - Content to sign (will be canonicalized)
 * @param {string} privateKeyString - Private key in format "ed25519:base64"
 * @returns {Promise<string>} Signature in format "ed25519:base64"
 */
export async function signContent(content, privateKeyString) {
  if (!privateKeyString || !privateKeyString.startsWith('ed25519:')) {
    throw new Error('Private key must be in format "ed25519:base64"');
  }
  
  const privateKeyBase64 = privateKeyString.slice(8); // Remove "ed25519:" prefix
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  
  if (privateKey.length !== 32) {
    throw new Error('Invalid private key length. Expected 32 bytes.');
  }
  
  // Canonicalize the content for consistent signing
  const canonicalContent = CanonicalJSONSerializer.serialize(content);
  const contentBytes = Buffer.from(canonicalContent, 'utf8');
  
  const signature = await ed25519.sign(contentBytes, privateKey);
  return `ed25519:${Buffer.from(signature).toString('base64')}`;
}

/**
 * Verify signature against content using ed25519 public key
 * @param {any} content - Content to verify (will be canonicalized)
 * @param {string} signatureString - Signature in format "ed25519:base64"
 * @param {string} publicKeyString - Public key in format "ed25519:base64"
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(content, signatureString, publicKeyString) {
  try {
    if (!signatureString || !signatureString.startsWith('ed25519:')) {
      return false;
    }
    
    if (!publicKeyString || !publicKeyString.startsWith('ed25519:')) {
      return false;
    }
    
    const signatureBase64 = signatureString.slice(8); // Remove "ed25519:" prefix
    const publicKeyBase64 = publicKeyString.slice(8); // Remove "ed25519:" prefix
    
    const signature = Buffer.from(signatureBase64, 'base64');
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    
    if (publicKey.length !== 32) {
      return false;
    }
    
    if (signature.length !== 64) {
      return false;
    }
    
    // Canonicalize the content for consistent verification
    const canonicalContent = CanonicalJSONSerializer.serialize(content);
    const contentBytes = Buffer.from(canonicalContent, 'utf8');
    
    return await ed25519.verify(signature, contentBytes, publicKey);
  } catch (error) {
    return false;
  }
}

/**
 * Validate key format and convert between representations
 * @param {string} keyString - Key in format "ed25519:base64"
 * @param {'private'|'public'} keyType - Expected key type
 * @returns {{valid: boolean, bytes?: Uint8Array, error?: string}} Validation result
 */
export function validateKeyFormat(keyString, keyType) {
  if (!keyString || typeof keyString !== 'string') {
    return { valid: false, error: 'Key must be a non-empty string' };
  }
  
  if (!keyString.startsWith('ed25519:')) {
    return { valid: false, error: 'Key must start with "ed25519:" prefix' };
  }
  
  const keyBase64 = keyString.slice(8);
  
  try {
    const keyBytes = Buffer.from(keyBase64, 'base64');
    
    const expectedLength = keyType === 'private' ? 32 : 32;
    if (keyBytes.length !== expectedLength) {
      return { 
        valid: false, 
        error: `Invalid ${keyType} key length. Expected ${expectedLength} bytes, got ${keyBytes.length}` 
      };
    }
    
    return { valid: true, bytes: new Uint8Array(keyBytes) };
  } catch (error) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }
}

/**
 * Extract public key from private key
 * @param {string} privateKeyString - Private key in format "ed25519:base64"
 * @returns {string} Public key in format "ed25519:base64"
 */
export function getPublicKeyFromPrivate(privateKeyString) {
  const validation = validateKeyFormat(privateKeyString, 'private');
  if (!validation.valid) {
    throw new Error(`Invalid private key: ${validation.error}`);
  }
  
  const privateKeyBase64 = privateKeyString.slice(8);
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  
  const publicKey = ed25519.getPublicKey(privateKey);
  return `ed25519:${Buffer.from(publicKey).toString('base64')}`;
}

/**
 * Enhanced signature service with key management
 */
export class SignatureService {
  constructor() {
    this.keyManager = new KeyManager();
    this.canonicalizer = new EnhancedCanonicalJSONSerializer();
  }

  /**
   * Sign content with enhanced canonicalization
   * @param {any} content - Content to sign
   * @param {string} privateKeyString - Private key
   * @param {object} options - Signing options
   * @returns {Promise<string>} Signature
   */
  async signContent(content, privateKeyString, options = {}) {
    const { 
      includeTimestamp = false,
      customFields = {},
      canonicalizationVersion = '1.0'
    } = options;

    // Enhance content with additional fields if requested
    let signingContent = { ...content };
    
    if (includeTimestamp) {
      signingContent._timestamp = new Date().toISOString();
    }
    
    // Add custom fields
    Object.assign(signingContent, customFields);

    return await signContent(signingContent, privateKeyString);
  }

  /**
   * Verify signature with enhanced validation
   * @param {any} content - Content to verify
   * @param {string} signatureString - Signature
   * @param {string} publicKeyString - Public key
   * @param {object} options - Verification options
   * @returns {Promise<object>} Verification result with details
   */
  async verifySignature(content, signatureString, publicKeyString, options = {}) {
    const {
      allowTimestampSkew = 300000, // 5 minutes in milliseconds
      requireTimestamp = false
    } = options;

    try {
      // Basic signature verification
      const isValid = await verifySignature(content, signatureString, publicKeyString);
      
      const result = {
        valid: isValid,
        publicKey: publicKeyString,
        signature: signatureString,
        timestamp: content._timestamp || null,
        errors: []
      };

      if (!isValid) {
        result.errors.push('Signature verification failed');
        return result;
      }

      // Additional validations
      if (requireTimestamp && !content._timestamp) {
        result.valid = false;
        result.errors.push('Timestamp is required but not present');
      }

      if (content._timestamp) {
        const signatureTime = new Date(content._timestamp);
        const now = new Date();
        const timeDiff = Math.abs(now.getTime() - signatureTime.getTime());
        
        if (timeDiff > allowTimestampSkew) {
          result.valid = false;
          result.errors.push(`Timestamp skew too large: ${timeDiff}ms > ${allowTimestampSkew}ms`);
        }
        
        result.timestampValid = timeDiff <= allowTimestampSkew;
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        publicKey: publicKeyString,
        signature: signatureString,
        errors: [error.message]
      };
    }
  }

  /**
   * Create a signature chain for multiple related items
   * @param {object[]} items - Items to sign in sequence
   * @param {string} privateKeyString - Private key
   * @returns {Promise<object[]>} Signed items with chain references
   */
  async createSignatureChain(items, privateKeyString) {
    const signedItems = [];
    let previousHash = null;

    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i] };
      
      // Add chain reference
      if (previousHash) {
        item._previousHash = previousHash;
      }
      item._chainIndex = i;
      
      // Sign the item
      item.signature = await this.signContent(item, privateKeyString);
      
      // Calculate hash for next item
      const canonical = this.canonicalizer.serialize(item);
      previousHash = createHash('sha256').update(canonical).digest('hex');
      
      signedItems.push(item);
    }

    return signedItems;
  }

  /**
   * Verify a signature chain
   * @param {object[]} items - Signed items to verify
   * @param {string} publicKeyString - Public key
   * @returns {Promise<object>} Chain verification result
   */
  async verifySignatureChain(items, publicKeyString) {
    const result = {
      valid: true,
      chainValid: true,
      itemResults: [],
      errors: []
    };

    let expectedPreviousHash = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemResult = {
        index: i,
        signatureValid: false,
        chainValid: true,
        errors: []
      };

      // Verify signature
      const sigResult = await this.verifySignature(item, item.signature, publicKeyString);
      itemResult.signatureValid = sigResult.valid;
      
      if (!sigResult.valid) {
        result.valid = false;
        itemResult.errors.push(...sigResult.errors);
      }

      // Verify chain integrity
      if (i > 0) {
        if (item._previousHash !== expectedPreviousHash) {
          result.chainValid = false;
          itemResult.chainValid = false;
          itemResult.errors.push(`Chain break: expected ${expectedPreviousHash}, got ${item._previousHash}`);
        }
      }

      // Calculate hash for next verification
      const itemCopy = { ...item };
      delete itemCopy.signature;
      const canonical = this.canonicalizer.serialize(itemCopy);
      expectedPreviousHash = createHash('sha256').update(canonical).digest('hex');

      result.itemResults.push(itemResult);
    }

    result.valid = result.valid && result.chainValid;
    return result;
  }
}

/**
 * Enhanced canonical JSON serializer with improved deterministic ordering
 */
export class EnhancedCanonicalJSONSerializer extends CanonicalJSONSerializer {
  /**
   * Serialize with enhanced canonicalization rules
   * @param {any} obj - Object to serialize
   * @param {object} options - Serialization options
   * @returns {string} Canonical JSON string
   */
  static serialize(obj, options = {}) {
    const {
      sortArrays = false,
      normalizeWhitespace = true,
      excludeFields = ['signature']
    } = options;

    // Deep clone and process the object
    const processed = this._processObject(obj, { sortArrays, normalizeWhitespace, excludeFields });
    
    // Use deterministic JSON serialization
    return JSON.stringify(processed, this._createReplacer(options));
  }

  /**
   * Process object recursively for canonicalization
   * @private
   */
  static _processObject(obj, options) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      const processed = obj.map(item => this._processObject(item, options));
      return options.sortArrays ? processed.sort() : processed;
    }

    const processed = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      if (options.excludeFields.includes(key)) {
        continue;
      }
      
      let value = obj[key];
      
      if (typeof value === 'string' && options.normalizeWhitespace) {
        value = value.trim().replace(/\s+/g, ' ');
      }
      
      processed[key] = this._processObject(value, options);
    }

    return processed;
  }

  /**
   * Create JSON replacer function
   * @private
   */
  static _createReplacer(options) {
    return function(key, value) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Sort object keys
        const sorted = {};
        Object.keys(value).sort().forEach(k => {
          sorted[k] = value[k];
        });
        return sorted;
      }
      return value;
    };
  }
}