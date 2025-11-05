/**
 * Ansybl Feed Document Parser
 * Parses and validates Ansybl documents with signature verification
 */

import { AnsyblValidator } from './validator.js';
import { verifySignature } from './signature.js';
import { CanonicalJSONSerializer } from './canonicalizer.js';

export class AnsyblParser {
  constructor() {
    this.validator = new AnsyblValidator();
  }

  /**
   * Parse an Ansybl feed document
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options
   * @returns {Promise<ParseResult>}
   */
  async parse(document, options = {}) {
    const {
      verifySignatures = false,
      preserveExtensions = true,
      strictMode = false
    } = options;

    // First validate the document structure
    const validationResult = this.validator.validateDocument(document);
    
    if (!validationResult.valid) {
      return {
        success: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };
    }

    const parsedDoc = typeof document === 'string' ? JSON.parse(document) : document;
    
    // Verify signatures if requested
    let signatureResults = {
      allValid: true,
      feedSignatureValid: null,
      itemSignatures: []
    };

    if (verifySignatures) {
      signatureResults = await this._verifySignatures(parsedDoc);
      
      if (strictMode && !signatureResults.allValid) {
        return {
          success: false,
          errors: [{
            code: 'SIGNATURE_VERIFICATION_FAILED',
            message: 'One or more signatures are invalid',
            details: 'Signature verification failed in strict mode'
          }],
          signatures: signatureResults
        };
      }
    }

    // Process the document
    const processedFeed = this._processFeed(parsedDoc, { preserveExtensions });

    return {
      success: true,
      feed: processedFeed,
      signatures: signatureResults,
      warnings: validationResult.warnings
    };
  }

  /**
   * Get items from a feed with optional filtering
   * @param {object} feed - Parsed feed document
   * @param {object} filters - Filter options
   * @returns {object[]} Filtered items
   */
  getItems(feed, filters = {}) {
    let items = [...feed.items];

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      items = items.filter(item => 
        item.tags && filters.tags.some(tag => item.tags.includes(tag))
      );
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      items = items.filter(item => 
        new Date(item.date_published) >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      items = items.filter(item => 
        new Date(item.date_published) <= toDate
      );
    }

    // Filter by author
    if (filters.author) {
      items = items.filter(item => 
        (item.author && item.author.name === filters.author) ||
        (!item.author && feed.author.name === filters.author)
      );
    }

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }

  /**
   * Verify signatures in the document
   * @private
   */
  async _verifySignatures(document) {
    const results = {
      allValid: true,
      feedSignatureValid: null,
      itemSignatures: []
    };

    // Verify feed signature if present
    if (document.signature) {
      try {
        const feedData = CanonicalJSONSerializer.createSignatureData(document, 'feed');
        const signableContent = JSON.parse(feedData);
        
        results.feedSignatureValid = await verifySignature(
          signableContent,
          document.signature,
          document.author.public_key
        );
        
        if (!results.feedSignatureValid) {
          results.allValid = false;
        }
      } catch (error) {
        results.feedSignatureValid = false;
        results.allValid = false;
      }
    }

    // Verify item signatures
    for (let i = 0; i < document.items.length; i++) {
      const item = document.items[i];
      const itemResult = {
        index: i,
        id: item.id,
        valid: false,
        error: null
      };

      if (item.signature) {
        try {
          const itemData = CanonicalJSONSerializer.createSignatureData(item, 'item');
          const signableContent = JSON.parse(itemData);
          
          // Use item author's public key if available, otherwise use feed author's
          const publicKey = item.author ? item.author.public_key : document.author.public_key;
          
          itemResult.valid = await verifySignature(
            signableContent,
            item.signature,
            publicKey
          );
          
          if (!itemResult.valid) {
            results.allValid = false;
            itemResult.error = 'Signature verification failed';
          }
        } catch (error) {
          itemResult.valid = false;
          itemResult.error = error.message;
          results.allValid = false;
        }
      } else {
        itemResult.error = 'No signature present';
        results.allValid = false;
      }

      results.itemSignatures.push(itemResult);
    }

    return results;
  }

  /**
   * Process the feed document
   * @private
   */
  _processFeed(document, options) {
    const processed = { ...document };

    // Remove extension fields if not preserving them
    if (!options.preserveExtensions) {
      this._removeExtensionFields(processed);
    }

    // Sort items by date (newest first)
    if (processed.items) {
      processed.items.sort((a, b) => 
        new Date(b.date_published) - new Date(a.date_published)
      );
    }

    return processed;
  }

  /**
   * Remove extension fields (those starting with _)
   * @private
   */
  _removeExtensionFields(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key in obj) {
      if (key.startsWith('_')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        this._removeExtensionFields(obj[key]);
      }
    }
  }
}

export default AnsyblParser;