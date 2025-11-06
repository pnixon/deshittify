/**
 * Canonical JSON Serializer for Ansybl Protocol
 * Ensures consistent serialization for cryptographic signatures
 */

import { createHash as cryptoCreateHash } from 'node:crypto';

export class CanonicalJSONSerializer {
  /**
   * Serialize object to canonical JSON format
   * @param {any} obj - Object to serialize
   * @returns {string} Canonical JSON string
   */
  static serialize(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return JSON.stringify(obj.map(item => 
        typeof item === 'object' && item !== null ? 
        JSON.parse(this.serialize(item)) : item
      ));
    }

    // Sort keys and create canonical representation
    const sortedKeys = Object.keys(obj).sort();
    const canonical = {};
    
    for (const key of sortedKeys) {
      canonical[key] = obj[key];
    }
    
    return JSON.stringify(canonical, sortedKeys);
  }

  /**
   * Create signature data for an object
   * @param {object} obj - Object to create signature data for
   * @param {string} type - Type of object ('feed' or 'item')
   * @returns {string} Canonical signature data
   */
  static createSignatureData(obj, type) {
    // Create a copy without the signature field
    const signableObj = { ...obj };
    delete signableObj.signature;
    
    // Remove any temporary fields used for signing
    delete signableObj._timestamp;
    delete signableObj._previousHash;
    delete signableObj._chainIndex;
    
    return this.serialize(signableObj);
  }

  /**
   * Create deterministic hash of an object
   * @param {object} obj - Object to hash
   * @param {string} algorithm - Hash algorithm (default: 'sha256')
   * @returns {string} Hex-encoded hash
   */
  static createHash(obj, algorithm = 'sha256') {
    const canonical = this.serialize(obj);
    return cryptoCreateHash(algorithm).update(canonical).digest('hex');
  }

  /**
   * Validate canonical JSON format
   * @param {string} jsonString - JSON string to validate
   * @returns {boolean} True if canonical
   */
  static isCanonical(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const canonical = this.serialize(parsed);
      return jsonString === canonical;
    } catch (error) {
      return false;
    }
  }
}