/**
 * Ansybl Feed Document Parser
 * Processes JSON into structured Ansybl feed objects with validation and signature verification
 */

import { AnsyblValidator } from './validator.js';
import { verifySignature } from './signature.js';
import { CanonicalJSONSerializer } from './canonicalizer.js';
import { 
  AnsyblErrorReporter, 
  GracefulDegradationHandler, 
  ErrorTemplates, 
  createErrorFromTemplate,
  ErrorCategory 
} from './error-handler.js';

/**
 * Main parser class for Ansybl feed documents
 */
export class AnsyblParser {
  constructor() {
    this.validator = new AnsyblValidator();
    this.errorReporter = new AnsyblErrorReporter();
    this.degradationHandler = new GracefulDegradationHandler();
  }

  /**
   * Parse and validate an Ansybl feed document
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Parsing options
   * @returns {Promise<ParseResult>} Parse result with feed data or errors
   */
  async parse(document, options = {}) {
    const {
      verifySignatures = true,
      preserveExtensions = true,
      strictMode = false,
      documentUrl = null
    } = options;

    // Clear previous errors and set context
    this.errorReporter.clear();
    this.degradationHandler.clear();
    this.errorReporter.setContext({ document_url: documentUrl });

    try {
      // Step 1: Parse JSON if needed
      let parsedDoc;
      try {
        if (typeof document === 'string') {
          if (!document.trim()) {
            this.errorReporter.addCriticalError(
              'EMPTY_DOCUMENT',
              'Document is empty or contains only whitespace',
              { category: ErrorCategory.PARSE }
            );
            return this.errorReporter.getReport();
          }
          parsedDoc = JSON.parse(document);
        } else {
          parsedDoc = document;
        }
      } catch (parseError) {
        const error = createErrorFromTemplate('INVALID_JSON', {
          details: parseError.message,
          context: { line_number: this._extractLineNumber(parseError.message) }
        });
        this.errorReporter.addCriticalError(error.code, error.message, error);
        return this.errorReporter.getReport();
      }

      // Step 2: Validate document structure
      const validationResult = this.validator.validateDocument(parsedDoc);
      if (!validationResult.valid) {
        // Add validation errors to error reporter
        validationResult.errors.forEach(validationError => {
          this.errorReporter.addError(
            validationError.code,
            validationError.message,
            {
              category: ErrorCategory.VALIDATION,
              field: validationError.field,
              details: validationError.details,
              suggestions: validationError.suggestions
            }
          );
        });

        if (strictMode) {
          return this.errorReporter.getReport();
        }
      }

      // Add validation warnings
      if (validationResult.warnings) {
        validationResult.warnings.forEach(warning => {
          this.errorReporter.addWarning(
            warning.code,
            warning.message,
            {
              field: warning.field,
              category: ErrorCategory.VALIDATION
            }
          );
        });
      }

      // Step 3: Create structured feed object with graceful degradation
      let feed;
      try {
        feed = this._createFeedObject(parsedDoc, preserveExtensions);
      } catch (error) {
        if (strictMode) {
          this.errorReporter.addCriticalError(
            'FEED_CREATION_FAILED',
            'Failed to create feed object',
            { details: error.message, category: ErrorCategory.PARSE }
          );
          return this.errorReporter.getReport();
        } else {
          // Graceful degradation - create minimal feed object
          feed = this.degradationHandler.degrade(
            'feed_creation',
            error,
            this._createMinimalFeedObject(parsedDoc)
          );
          this.errorReporter.addWarning(
            'FEED_CREATION_DEGRADED',
            'Feed creation partially failed, using minimal representation',
            { details: error.message }
          );
        }
      }

      // Step 4: Verify signatures if requested
      let signatureResults = null;
      if (verifySignatures && feed) {
        try {
          signatureResults = await this._verifyAllSignatures(feed);
          
          // Add signature errors to error reporter
          if (!signatureResults.allValid) {
            signatureResults.errors.forEach(sigError => {
              this.errorReporter.addError(
                'SIGNATURE_VERIFICATION_FAILED',
                sigError,
                { category: ErrorCategory.SIGNATURE }
              );
            });

            if (strictMode) {
              return this.errorReporter.getReport();
            }
          }
        } catch (sigError) {
          if (strictMode) {
            this.errorReporter.addCriticalError(
              'SIGNATURE_SYSTEM_ERROR',
              'Signature verification system failed',
              { details: sigError.message, category: ErrorCategory.SIGNATURE }
            );
            return this.errorReporter.getReport();
          } else {
            signatureResults = this.degradationHandler.degrade(
              'signature_verification',
              sigError,
              { allValid: false, errors: [sigError.message] }
            );
          }
        }
      }

      // Step 5: Return successful parse result
      const report = this.errorReporter.getReport();
      return {
        ...report,
        feed,
        signatures: signatureResults,
        degradations: this.degradationHandler.getDegradations()
      };

    } catch (error) {
      this.errorReporter.addCriticalError(
        'INTERNAL_ERROR',
        'Parser internal error',
        { 
          details: error.message,
          category: ErrorCategory.PARSE,
          recoverable: false
        }
      );
      return this.errorReporter.getReport();
    }
  }

  /**
   * Parse multiple feed documents
   * @param {Array<string|object>} documents - Array of documents to parse
   * @param {object} options - Parsing options
   * @returns {Promise<Array<ParseResult>>} Array of parse results
   */
  async parseMultiple(documents, options = {}) {
    const results = [];
    
    for (let i = 0; i < documents.length; i++) {
      try {
        const result = await this.parse(documents[i], options);
        results.push({
          index: i,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: {
            code: 'PARSE_FAILED',
            message: `Failed to parse document at index ${i}`,
            details: error.message
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Extract specific content items with filtering
   * @param {AnsyblFeed} feed - Parsed feed object
   * @param {object} filters - Filter criteria
   * @returns {Array<AnsyblItem>} Filtered items
   */
  getItems(feed, filters = {}) {
    if (!feed || !feed.items) {
      return [];
    }

    let items = [...feed.items];

    // Apply filters
    if (filters.tags && filters.tags.length > 0) {
      items = items.filter(item => 
        item.tags && item.tags.some(tag => filters.tags.includes(tag))
      );
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      items = items.filter(item => new Date(item.date_published) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      items = items.filter(item => new Date(item.date_published) <= toDate);
    }

    if (filters.hasAttachments !== undefined) {
      items = items.filter(item => 
        Boolean(item.attachments && item.attachments.length > 0) === filters.hasAttachments
      );
    }

    if (filters.contentType) {
      items = items.filter(item => {
        switch (filters.contentType) {
          case 'text': return Boolean(item.content_text);
          case 'html': return Boolean(item.content_html);
          case 'markdown': return Boolean(item.content_markdown);
          default: return true;
        }
      });
    }

    // Sort by date (newest first by default)
    if (filters.sortBy === 'date' || !filters.sortBy) {
      items.sort((a, b) => new Date(b.date_published) - new Date(a.date_published));
    }

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }

  /**
   * Create structured feed object from parsed JSON
   * @private
   */
  _createFeedObject(parsedDoc, preserveExtensions) {
    const feed = {
      version: parsedDoc.version,
      title: parsedDoc.title,
      home_page_url: parsedDoc.home_page_url,
      feed_url: parsedDoc.feed_url,
      author: this._createAuthorObject(parsedDoc.author, preserveExtensions),
      items: parsedDoc.items.map(item => this._createItemObject(item, preserveExtensions))
    };

    // Add optional fields
    if (parsedDoc.description) feed.description = parsedDoc.description;
    if (parsedDoc.icon) feed.icon = parsedDoc.icon;
    if (parsedDoc.language) feed.language = parsedDoc.language;
    if (parsedDoc.signature) feed.signature = parsedDoc.signature;

    // Preserve extensions if requested
    if (preserveExtensions) {
      this._preserveExtensions(parsedDoc, feed);
    }

    return feed;
  }

  /**
   * Create author object
   * @private
   */
  _createAuthorObject(authorData, preserveExtensions) {
    const author = {
      name: authorData.name,
      public_key: authorData.public_key
    };

    if (authorData.url) author.url = authorData.url;
    if (authorData.avatar) author.avatar = authorData.avatar;

    if (preserveExtensions) {
      this._preserveExtensions(authorData, author);
    }

    return author;
  }

  /**
   * Create item object
   * @private
   */
  _createItemObject(itemData, preserveExtensions) {
    const item = {
      id: itemData.id,
      url: itemData.url,
      date_published: itemData.date_published,
      signature: itemData.signature
    };

    // Add optional fields
    if (itemData.uuid) item.uuid = itemData.uuid;
    if (itemData.title) item.title = itemData.title;
    if (itemData.content_text) item.content_text = itemData.content_text;
    if (itemData.content_html) item.content_html = itemData.content_html;
    if (itemData.content_markdown) item.content_markdown = itemData.content_markdown;
    if (itemData.summary) item.summary = itemData.summary;
    if (itemData.date_modified) item.date_modified = itemData.date_modified;
    if (itemData.tags) item.tags = [...itemData.tags];
    if (itemData.in_reply_to) item.in_reply_to = itemData.in_reply_to;

    if (itemData.author) {
      item.author = this._createAuthorObject(itemData.author, preserveExtensions);
    }

    if (itemData.attachments) {
      item.attachments = itemData.attachments.map(att => this._createAttachmentObject(att, preserveExtensions));
    }

    if (itemData.interactions) {
      item.interactions = { ...itemData.interactions };
      if (preserveExtensions) {
        this._preserveExtensions(itemData.interactions, item.interactions);
      }
    }

    if (preserveExtensions) {
      this._preserveExtensions(itemData, item);
    }

    return item;
  }

  /**
   * Create attachment object
   * @private
   */
  _createAttachmentObject(attachmentData, preserveExtensions) {
    const attachment = {
      url: attachmentData.url,
      mime_type: attachmentData.mime_type
    };

    // Add optional fields
    if (attachmentData.title) attachment.title = attachmentData.title;
    if (attachmentData.size_in_bytes) attachment.size_in_bytes = attachmentData.size_in_bytes;
    if (attachmentData.duration_in_seconds) attachment.duration_in_seconds = attachmentData.duration_in_seconds;
    if (attachmentData.width) attachment.width = attachmentData.width;
    if (attachmentData.height) attachment.height = attachmentData.height;
    if (attachmentData.alt_text) attachment.alt_text = attachmentData.alt_text;
    if (attachmentData.blurhash) attachment.blurhash = attachmentData.blurhash;
    if (attachmentData.data_uri) attachment.data_uri = attachmentData.data_uri;

    if (preserveExtensions) {
      this._preserveExtensions(attachmentData, attachment);
    }

    return attachment;
  }

  /**
   * Preserve extension fields (those starting with underscore)
   * @private
   */
  _preserveExtensions(source, target) {
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith('_')) {
        target[key] = value;
      }
    }
  }

  /**
   * Verify all signatures in the feed
   * @private
   */
  async _verifyAllSignatures(feed) {
    const results = {
      feedSignature: null,
      itemSignatures: [],
      allValid: true,
      errors: []
    };

    try {
      // Verify feed-level signature if present
      if (feed.signature) {
        const feedSignatureData = CanonicalJSONSerializer.createSignatureData(feed, 'feed');
        const feedValid = await verifySignature(
          JSON.parse(feedSignatureData),
          feed.signature,
          feed.author.public_key
        );
        
        results.feedSignature = {
          valid: feedValid,
          signature: feed.signature,
          public_key: feed.author.public_key
        };
        
        if (!feedValid) {
          results.allValid = false;
          results.errors.push('Feed signature verification failed');
        }
      }

      // Verify item-level signatures
      for (let i = 0; i < feed.items.length; i++) {
        const item = feed.items[i];
        const itemSignatureData = CanonicalJSONSerializer.createSignatureData(item, 'item');
        
        // Use item author's public key if available, otherwise feed author's key
        const publicKey = item.author ? item.author.public_key : feed.author.public_key;
        
        const itemValid = await verifySignature(
          JSON.parse(itemSignatureData),
          item.signature,
          publicKey
        );
        
        results.itemSignatures.push({
          index: i,
          id: item.id,
          valid: itemValid,
          signature: item.signature,
          public_key: publicKey
        });
        
        if (!itemValid) {
          results.allValid = false;
          results.errors.push(`Item ${i} (${item.id}) signature verification failed`);
        }
      }

    } catch (error) {
      results.allValid = false;
      results.errors.push(`Signature verification error: ${error.message}`);
    }

    return results;
  }

  /**
   * Extract line number from JSON parse error message
   * @private
   */
  _extractLineNumber(errorMessage) {
    const lineMatch = errorMessage.match(/line (\d+)/i);
    return lineMatch ? parseInt(lineMatch[1], 10) : null;
  }

  /**
   * Create minimal feed object for graceful degradation
   * @private
   */
  _createMinimalFeedObject(parsedDoc) {
    try {
      return {
        version: parsedDoc.version || 'unknown',
        title: parsedDoc.title || 'Untitled Feed',
        home_page_url: parsedDoc.home_page_url || '',
        feed_url: parsedDoc.feed_url || '',
        author: {
          name: parsedDoc.author?.name || 'Unknown Author',
          public_key: parsedDoc.author?.public_key || ''
        },
        items: Array.isArray(parsedDoc.items) ? parsedDoc.items.slice(0, 10) : []
      };
    } catch (error) {
      return {
        version: 'unknown',
        title: 'Invalid Feed',
        home_page_url: '',
        feed_url: '',
        author: { name: 'Unknown', public_key: '' },
        items: []
      };
    }
  }
}

export default AnsyblParser;