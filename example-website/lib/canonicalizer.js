/**
 * Canonical JSON Serializer for Ansybl Protocol
 * Ensures consistent serialization for cryptographic signatures
 */

export class CanonicalJSONSerializer {
  /**
   * Serialize object to canonical JSON format
   * @param {any} obj - Object to serialize
   * @returns {string} Canonical JSON string
   */
  static serialize(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
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
    
    return this.serialize(signableObj);
  }
}