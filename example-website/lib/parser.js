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
    
    // Performance tracking
    this.performanceMetrics = {
      totalParses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successfulParses: 0,
      failedParses: 0,
      signatureVerifications: 0,
      validSignatures: 0,
      lastReset: new Date().toISOString(),
      parseTypeFrequency: new Map(),
      documentSizeStats: {
        min: Infinity,
        max: 0,
        average: 0,
        total: 0
      }
    };
  }

  /**
   * Parse an Ansybl feed document
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options
   * @returns {Promise<ParseResult>}
   */
  async parse(document, options = {}) {
    const startTime = Date.now();
    this._updateParseMetrics('full');
    
    const {
      verifySignatures = false,
      preserveExtensions = true,
      strictMode = false,
      requireSignatures = false,
      signatureLevel = 'all' // 'all', 'feed-only', 'items-only'
    } = options;

    // First validate the document structure
    const validationResult = this.validator.validateDocument(document);
    
    if (!validationResult.valid) {
      this._updatePerformanceMetrics(Date.now() - startTime, document, false);
      return {
        success: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };
    }

    const parsedDoc = typeof document === 'string' ? JSON.parse(document) : document;
    
    // Check signature requirements
    if (requireSignatures) {
      const signatureCheckResult = this._checkSignatureRequirements(parsedDoc, signatureLevel);
      if (!signatureCheckResult.valid) {
        this._updatePerformanceMetrics(Date.now() - startTime, parsedDoc, false);
        return {
          success: false,
          errors: signatureCheckResult.errors,
          warnings: []
        };
      }
    }
    
    // Verify signatures if requested
    let signatureResults = {
      allValid: true,
      feedSignatureValid: null,
      itemSignatures: [],
      verificationLevel: signatureLevel,
      errors: []
    };

    if (verifySignatures) {
      this.performanceMetrics.signatureVerifications++;
      signatureResults = await this._verifySignatures(parsedDoc, signatureLevel);
      
      if (signatureResults.allValid) {
        this.performanceMetrics.validSignatures++;
      }
      
      if (strictMode && !signatureResults.allValid) {
        this._updatePerformanceMetrics(Date.now() - startTime, parsedDoc, false);
        return {
          success: false,
          errors: [{
            code: 'SIGNATURE_VERIFICATION_FAILED',
            message: 'One or more signatures are invalid',
            details: 'Signature verification failed in strict mode',
            field: 'signatures'
          }],
          signatures: signatureResults
        };
      }
    }

    // Process the document
    const processedFeed = this._processFeed(parsedDoc, { preserveExtensions });
    
    // Update performance metrics
    this._updatePerformanceMetrics(Date.now() - startTime, parsedDoc, true);

    return {
      success: true,
      feed: processedFeed,
      signatures: signatureResults,
      warnings: validationResult.warnings,
      metadata: this._extractMetadata(parsedDoc)
    };
  }

  /**
   * Parse with signature verification levels
   * @param {string|object} document - JSON string or parsed object
   * @param {string} level - Verification level: 'strict', 'relaxed', 'optional'
   * @returns {Promise<ParseResult>}
   */
  async parseWithVerification(document, level = 'relaxed') {
    const options = {
      verifySignatures: true,
      preserveExtensions: true,
      strictMode: level === 'strict',
      requireSignatures: level === 'strict',
      signatureLevel: 'all'
    };

    return await this.parse(document, options);
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
   * Parse metadata only (fast parsing without full content processing)
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options
   * @returns {Promise<ParseResult>}
   */
  async parseMetadataOnly(document, options = {}) {
    const startTime = Date.now();
    this._updateParseMetrics('metadata-only');
    
    try {
      const parsedDoc = typeof document === 'string' ? JSON.parse(document) : document;
      
      // Quick validation of structure
      if (!parsedDoc.version || !parsedDoc.title) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_METADATA',
            message: 'Document missing required metadata fields'
          }]
        };
      }
      
      const metadata = this._extractMetadata(parsedDoc);
      
      // Add signature status without verification
      metadata.signatureStatus = {
        feedSigned: !!parsedDoc.signature,
        itemsSigned: parsedDoc.items ? parsedDoc.items.filter(item => !!item.signature).length : 0,
        totalItems: parsedDoc.items ? parsedDoc.items.length : 0
      };
      
      this._updatePerformanceMetrics(Date.now() - startTime, parsedDoc, true);
      
      return {
        success: true,
        metadata,
        performance: {
          processingTimeMs: Date.now() - startTime,
          parseType: 'metadata-only'
        }
      };
      
    } catch (error) {
      this._updatePerformanceMetrics(Date.now() - startTime, {}, false);
      return {
        success: false,
        errors: [{
          code: 'METADATA_PARSE_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Parse content only (skip metadata and signature verification)
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options
   * @returns {Promise<ParseResult>}
   */
  async parseContentOnly(document, options = {}) {
    const startTime = Date.now();
    this._updateParseMetrics('content-only');
    
    try {
      const parsedDoc = typeof document === 'string' ? JSON.parse(document) : document;
      
      if (!parsedDoc.items || !Array.isArray(parsedDoc.items)) {
        return {
          success: false,
          errors: [{
            code: 'NO_CONTENT_ITEMS',
            message: 'Document contains no content items'
          }]
        };
      }
      
      // Extract and process content
      const content = {
        items: parsedDoc.items.map((item, index) => ({
          index,
          id: item.id,
          title: item.title,
          content_text: item.content_text,
          content_html: item.content_html,
          content_markdown: item.content_markdown,
          summary: item.summary,
          date_published: item.date_published,
          tags: item.tags,
          attachments: item.attachments
        })),
        totalItems: parsedDoc.items.length,
        contentTypes: this._analyzeContentTypes(parsedDoc.items)
      };
      
      this._updatePerformanceMetrics(Date.now() - startTime, parsedDoc, true);
      
      return {
        success: true,
        content,
        performance: {
          processingTimeMs: Date.now() - startTime,
          parseType: 'content-only'
        }
      };
      
    } catch (error) {
      this._updatePerformanceMetrics(Date.now() - startTime, {}, false);
      return {
        success: false,
        errors: [{
          code: 'CONTENT_PARSE_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Parse with content filtering
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options with contentFilter
   * @returns {Promise<ParseResult>}
   */
  async parseWithContentFilter(document, options = {}) {
    const startTime = Date.now();
    this._updateParseMetrics('content-filtered');
    
    try {
      // First do a full parse
      const fullResult = await this.parse(document, options);
      
      if (!fullResult.success) {
        return fullResult;
      }
      
      const { contentFilter } = options;
      
      // Filter content based on type
      if (contentFilter && contentFilter !== 'all') {
        fullResult.feed.items = fullResult.feed.items.map(item => {
          const filteredItem = { ...item };
          
          // Keep only the requested content type
          if (contentFilter === 'text') {
            delete filteredItem.content_html;
            delete filteredItem.content_markdown;
          } else if (contentFilter === 'html') {
            delete filteredItem.content_text;
            delete filteredItem.content_markdown;
          } else if (contentFilter === 'markdown') {
            delete filteredItem.content_text;
            delete filteredItem.content_html;
          }
          
          return filteredItem;
        });
      }
      
      fullResult.contentFilter = contentFilter;
      fullResult.performance.parseType = 'content-filtered';
      
      return fullResult;
      
    } catch (error) {
      this._updatePerformanceMetrics(Date.now() - startTime, {}, false);
      return {
        success: false,
        errors: [{
          code: 'CONTENT_FILTER_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Get performance metrics
   * @returns {object}
   */
  getPerformanceMetrics() {
    const metrics = { ...this.performanceMetrics };
    
    // Convert Map to object for JSON serialization
    metrics.parseTypeFrequency = Object.fromEntries(this.performanceMetrics.parseTypeFrequency);
    
    // Calculate additional stats
    if (metrics.totalParses > 0) {
      metrics.averageProcessingTime = metrics.totalProcessingTime / metrics.totalParses;
      metrics.successRate = (metrics.successfulParses / metrics.totalParses) * 100;
      metrics.signatureSuccessRate = metrics.signatureVerifications > 0 ? 
        (metrics.validSignatures / metrics.signatureVerifications) * 100 : 0;
    }
    
    return metrics;
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalParses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successfulParses: 0,
      failedParses: 0,
      signatureVerifications: 0,
      validSignatures: 0,
      lastReset: new Date().toISOString(),
      parseTypeFrequency: new Map(),
      documentSizeStats: {
        min: Infinity,
        max: 0,
        average: 0,
        total: 0
      }
    };
  }

  /**
   * Analyze content types in items
   * @private
   */
  _analyzeContentTypes(items) {
    const types = {
      text: 0,
      html: 0,
      markdown: 0,
      mixed: 0
    };
    
    items.forEach(item => {
      const hasText = !!item.content_text;
      const hasHtml = !!item.content_html;
      const hasMarkdown = !!item.content_markdown;
      
      const contentCount = [hasText, hasHtml, hasMarkdown].filter(Boolean).length;
      
      if (contentCount > 1) {
        types.mixed++;
      } else if (hasText) {
        types.text++;
      } else if (hasHtml) {
        types.html++;
      } else if (hasMarkdown) {
        types.markdown++;
      }
    });
    
    return types;
  }

  /**
   * Update parse type metrics
   * @private
   */
  _updateParseMetrics(parseType) {
    const count = this.performanceMetrics.parseTypeFrequency.get(parseType) || 0;
    this.performanceMetrics.parseTypeFrequency.set(parseType, count + 1);
  }

  /**
   * Update performance metrics
   * @private
   */
  _updatePerformanceMetrics(processingTime, document, success) {
    this.performanceMetrics.totalParses++;
    this.performanceMetrics.totalProcessingTime += processingTime;
    
    if (success) {
      this.performanceMetrics.successfulParses++;
    } else {
      this.performanceMetrics.failedParses++;
    }
    
    // Update document size statistics
    const documentSize = JSON.stringify(document).length;
    const sizeStats = this.performanceMetrics.documentSizeStats;
    
    sizeStats.min = Math.min(sizeStats.min, documentSize);
    sizeStats.max = Math.max(sizeStats.max, documentSize);
    sizeStats.total += documentSize;
    sizeStats.average = sizeStats.total / this.performanceMetrics.totalParses;
  }

  /**
   * Check signature requirements
   * @private
   */
  _checkSignatureRequirements(document, level) {
    const errors = [];
    
    if (level === 'all' || level === 'feed-only') {
      if (!document.signature) {
        errors.push({
          code: 'MISSING_FEED_SIGNATURE',
          message: 'Feed signature is required',
          field: 'signature',
          details: 'Feed-level signature is missing',
          suggestions: ['Add a cryptographic signature to the feed']
        });
      }
    }
    
    if (level === 'all' || level === 'items-only') {
      if (document.items && Array.isArray(document.items)) {
        document.items.forEach((item, index) => {
          if (!item.signature) {
            errors.push({
              code: 'MISSING_ITEM_SIGNATURE',
              message: `Item ${index + 1} signature is required`,
              field: `items[${index}].signature`,
              details: `Item signature is missing for item: ${item.id || 'unknown'}`,
              suggestions: ['Add a cryptographic signature to each item']
            });
          }
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify signatures in the document with enhanced error reporting
   * @private
   */
  async _verifySignatures(document, level = 'all') {
    const results = {
      allValid: true,
      feedSignatureValid: null,
      itemSignatures: [],
      verificationLevel: level,
      errors: [],
      summary: {
        totalItems: document.items ? document.items.length : 0,
        validItems: 0,
        invalidItems: 0,
        missingSignatures: 0
      }
    };

    // Verify feed signature if present and required
    if (level === 'all' || level === 'feed-only') {
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
            results.errors.push({
              code: 'INVALID_FEED_SIGNATURE',
              message: 'Feed signature verification failed',
              field: 'signature',
              details: 'The feed signature does not match the content',
              suggestions: ['Verify the signature was created with the correct private key', 'Check that the content has not been modified']
            });
          }
        } catch (error) {
          results.feedSignatureValid = false;
          results.allValid = false;
          results.errors.push({
            code: 'FEED_SIGNATURE_ERROR',
            message: 'Error verifying feed signature',
            field: 'signature',
            details: error.message,
            suggestions: ['Check signature format and public key validity']
          });
        }
      } else if (level === 'feed-only' || level === 'all') {
        results.feedSignatureValid = false;
        results.allValid = false;
      }
    }

    // Verify item signatures if required
    if (level === 'all' || level === 'items-only') {
      if (document.items && Array.isArray(document.items)) {
        for (let i = 0; i < document.items.length; i++) {
          const item = document.items[i];
          const itemResult = {
            index: i,
            id: item.id,
            uuid: item.uuid,
            valid: false,
            error: null,
            publicKeyUsed: null,
            signaturePresent: !!item.signature
          };

          if (item.signature) {
            try {
              const itemData = CanonicalJSONSerializer.createSignatureData(item, 'item');
              const signableContent = JSON.parse(itemData);
              
              // Use item author's public key if available, otherwise use feed author's
              const publicKey = item.author ? item.author.public_key : document.author.public_key;
              itemResult.publicKeyUsed = publicKey;
              
              itemResult.valid = await verifySignature(
                signableContent,
                item.signature,
                publicKey
              );
              
              if (itemResult.valid) {
                results.summary.validItems++;
              } else {
                results.summary.invalidItems++;
                results.allValid = false;
                itemResult.error = 'Signature verification failed';
                
                results.errors.push({
                  code: 'INVALID_ITEM_SIGNATURE',
                  message: `Item ${i + 1} signature verification failed`,
                  field: `items[${i}].signature`,
                  details: `Signature does not match content for item: ${item.id || 'unknown'}`,
                  suggestions: ['Verify the signature was created with the correct private key', 'Check that the item content has not been modified']
                });
              }
            } catch (error) {
              itemResult.valid = false;
              itemResult.error = error.message;
              results.summary.invalidItems++;
              results.allValid = false;
              
              results.errors.push({
                code: 'ITEM_SIGNATURE_ERROR',
                message: `Error verifying signature for item ${i + 1}`,
                field: `items[${i}].signature`,
                details: error.message,
                suggestions: ['Check signature format and public key validity']
              });
            }
          } else {
            itemResult.error = 'No signature present';
            results.summary.missingSignatures++;
            results.allValid = false;
            
            if (level === 'all' || level === 'items-only') {
              results.errors.push({
                code: 'MISSING_ITEM_SIGNATURE',
                message: `Item ${i + 1} is missing a signature`,
                field: `items[${i}].signature`,
                details: `No signature found for item: ${item.id || 'unknown'}`,
                suggestions: ['Add a cryptographic signature to the item']
              });
            }
          }

          results.itemSignatures.push(itemResult);
        }
      }
    }

    return results;
  }

  /**
   * Extract comprehensive metadata from the document
   * @private
   */
  _extractMetadata(document) {
    const metadata = {
      version: document.version,
      title: document.title,
      description: document.description,
      language: document.language,
      author: { ...document.author },
      itemCount: document.items ? document.items.length : 0,
      hasSignature: !!document.signature,
      extensionFields: [],
      contentTypes: new Set(),
      dateRange: {
        earliest: null,
        latest: null
      }
    };

    // Extract extension fields
    for (const [key, value] of Object.entries(document)) {
      if (key.startsWith('_')) {
        metadata.extensionFields.push({ key, value });
      }
    }

    // Analyze items
    if (document.items && Array.isArray(document.items)) {
      document.items.forEach(item => {
        // Track content types
        if (item.content_text) metadata.contentTypes.add('text');
        if (item.content_html) metadata.contentTypes.add('html');
        if (item.content_markdown) metadata.contentTypes.add('markdown');
        
        // Track date range
        if (item.date_published) {
          const date = new Date(item.date_published);
          if (!metadata.dateRange.earliest || date < metadata.dateRange.earliest) {
            metadata.dateRange.earliest = date;
          }
          if (!metadata.dateRange.latest || date > metadata.dateRange.latest) {
            metadata.dateRange.latest = date;
          }
        }
      });
    }

    metadata.contentTypes = Array.from(metadata.contentTypes);
    
    return metadata;
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