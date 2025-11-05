/**
 * Canonical JSON Serialization Engine
 * Implements RFC 8785 with Ansybl-specific requirements for signature generation
 */

class CanonicalJSONSerializer {
  /**
   * Serialize object to canonical JSON representation
   * @param {any} obj - Object to serialize
   * @returns {string} Canonical JSON string
   */
  static serialize(obj) {
    return this._canonicalize(obj);
  }

  /**
   * Create canonical representation for signature generation
   * @param {object} feedOrItem - Feed document or content item
   * @param {string} type - 'feed' or 'item'
   * @returns {string} Canonical JSON for signing
   */
  static createSignatureData(feedOrItem, type = 'item') {
    if (type === 'feed') {
      return this._createFeedSignatureData(feedOrItem);
    } else {
      return this._createItemSignatureData(feedOrItem);
    }
  }

  /**
   * Validate that two JSON strings have the same canonical representation
   * @param {string} json1 - First JSON string
   * @param {string} json2 - Second JSON string
   * @returns {boolean} True if canonically equivalent
   */
  static areCanonicallyEquivalent(json1, json2) {
    try {
      const obj1 = JSON.parse(json1);
      const obj2 = JSON.parse(json2);
      return this.serialize(obj1) === this.serialize(obj2);
    } catch (error) {
      return false;
    }
  }

  /**
   * Core canonicalization function implementing RFC 8785
   * @private
   */
  static _canonicalize(obj) {
    if (obj === null) {
      return 'null';
    }
    
    if (typeof obj === 'boolean') {
      return obj ? 'true' : 'false';
    }
    
    if (typeof obj === 'number') {
      return this._canonicalizeNumber(obj);
    }
    
    if (typeof obj === 'string') {
      return this._canonicalizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return this._canonicalizeArray(obj);
    }
    
    if (typeof obj === 'object') {
      return this._canonicalizeObject(obj);
    }
    
    throw new Error(`Cannot canonicalize type: ${typeof obj}`);
  }

  /**
   * Canonicalize numbers according to RFC 8785
   * @private
   */
  static _canonicalizeNumber(num) {
    if (!isFinite(num)) {
      throw new Error('Cannot canonicalize non-finite numbers');
    }
    
    // Handle integers
    if (Number.isInteger(num) && num >= -(2**53) + 1 && num <= (2**53) - 1) {
      return num.toString();
    }
    
    // Handle floating point numbers
    // Use shortest representation without unnecessary precision
    let str = num.toString();
    
    // Remove unnecessary trailing zeros after decimal point
    if (str.includes('.')) {
      str = str.replace(/\.?0+$/, '');
    }
    
    // Handle scientific notation consistently
    if (str.includes('e')) {
      const [mantissa, exponent] = str.split('e');
      const exp = parseInt(exponent, 10);
      str = `${mantissa}e${exp >= 0 ? '+' : ''}${exp}`;
    }
    
    return str;
  }

  /**
   * Canonicalize strings with minimal escaping
   * @private
   */
  static _canonicalizeString(str) {
    let result = '"';
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const code = str.charCodeAt(i);
      
      // Escape required characters only
      if (char === '"') {
        result += '\\"';
      } else if (char === '\\') {
        result += '\\\\';
      } else if (code >= 0x00 && code <= 0x1F) {
        // Control characters
        switch (char) {
          case '\b': result += '\\b'; break;
          case '\f': result += '\\f'; break;
          case '\n': result += '\\n'; break;
          case '\r': result += '\\r'; break;
          case '\t': result += '\\t'; break;
          default:
            result += '\\u' + code.toString(16).padStart(4, '0');
        }
      } else {
        result += char;
      }
    }
    
    result += '"';
    return result;
  }

  /**
   * Canonicalize arrays
   * @private
   */
  static _canonicalizeArray(arr) {
    const elements = arr.map(item => this._canonicalize(item));
    return '[' + elements.join(',') + ']';
  }

  /**
   * Canonicalize objects with sorted keys
   * @private
   */
  static _canonicalizeObject(obj) {
    // Sort keys by Unicode code point (lexicographic order)
    const sortedKeys = Object.keys(obj).sort();
    
    const pairs = sortedKeys.map(key => {
      const canonicalKey = this._canonicalizeString(key);
      const canonicalValue = this._canonicalize(obj[key]);
      return canonicalKey + ':' + canonicalValue;
    });
    
    return '{' + pairs.join(',') + '}';
  }

  /**
   * Create canonical signature data for feed-level signatures
   * @private
   */
  static _createFeedSignatureData(feed) {
    // Extract only the fields that should be signed for feeds
    const signableData = {
      author: {
        name: feed.author.name,
        public_key: feed.author.public_key
      },
      feed_url: feed.feed_url,
      home_page_url: feed.home_page_url,
      timestamp: new Date().toISOString(), // Current timestamp for feed signature
      title: feed.title,
      version: feed.version
    };
    
    // Add optional author fields if present
    if (feed.author.url) {
      signableData.author.url = feed.author.url;
    }
    
    return this.serialize(signableData);
  }

  /**
   * Create canonical signature data for item-level signatures
   * @private
   */
  static _createItemSignatureData(item) {
    // Extract only the fields that should be signed for items
    const signableData = {
      date_published: item.date_published,
      id: item.id,
      url: item.url
    };
    
    // Add author if present (item-level author override)
    if (item.author) {
      signableData.author = {
        name: item.author.name,
        public_key: item.author.public_key
      };
      if (item.author.url) {
        signableData.author.url = item.author.url;
      }
    }
    
    // Add content fields if present (at least one is required)
    if (item.content_text) {
      signableData.content_text = item.content_text;
    }
    if (item.content_html) {
      signableData.content_html = item.content_html;
    }
    if (item.content_markdown) {
      signableData.content_markdown = item.content_markdown;
    }
    
    // Add optional fields that affect content integrity
    if (item.title) {
      signableData.title = item.title;
    }
    if (item.summary) {
      signableData.summary = item.summary;
    }
    if (item.in_reply_to) {
      signableData.in_reply_to = item.in_reply_to;
    }
    if (item.attachments && item.attachments.length > 0) {
      signableData.attachments = item.attachments.map(att => ({
        url: att.url,
        mime_type: att.mime_type,
        ...(att.size_in_bytes && { size_in_bytes: att.size_in_bytes }),
        ...(att.alt_text && { alt_text: att.alt_text })
      }));
    }
    
    return this.serialize(signableData);
  }

  /**
   * Verify canonical representation consistency
   * @param {string} json - JSON string to verify
   * @returns {object} Verification result
   */
  static verifyCanonicalConsistency(json) {
    try {
      const parsed = JSON.parse(json);
      const canonical = this.serialize(parsed);
      const reparsed = JSON.parse(canonical);
      const recanonical = this.serialize(reparsed);
      
      const isConsistent = canonical === recanonical;
      
      return {
        consistent: isConsistent,
        original_length: json.length,
        canonical_length: canonical.length,
        canonical_form: canonical,
        differences: isConsistent ? [] : this._findDifferences(canonical, recanonical)
      };
    } catch (error) {
      return {
        consistent: false,
        error: error.message,
        canonical_form: null
      };
    }
  }

  /**
   * Find differences between two canonical representations
   * @private
   */
  static _findDifferences(str1, str2) {
    const differences = [];
    const maxLen = Math.max(str1.length, str2.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (str1[i] !== str2[i]) {
        differences.push({
          position: i,
          expected: str1[i] || 'EOF',
          actual: str2[i] || 'EOF'
        });
      }
    }
    
    return differences;
  }
}

export { CanonicalJSONSerializer };
export default CanonicalJSONSerializer;