/**
 * Ansybl Feed Document Validator
 * Provides comprehensive validation with clear error messages
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AnsyblValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false,
      validateFormats: true
    });
    
    // Add format validators
    addFormats(this.ajv);
    
    // Load and compile schema
    const schemaPath = join(__dirname, 'ansybl-feed.schema.json');
    const schemaContent = readFileSync(schemaPath, 'utf8');
    this.schema = JSON.parse(schemaContent);
    this.validate = this.ajv.compile(this.schema);
    
    // Performance tracking
    this.performanceMetrics = {
      totalValidations: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      validDocuments: 0,
      invalidDocuments: 0,
      lastReset: new Date().toISOString(),
      errorFrequency: new Map(),
      documentSizeStats: {
        min: Infinity,
        max: 0,
        average: 0,
        total: 0
      }
    };
    
    // Custom validators cache
    this.customValidators = new Map();
  }

  /**
   * Validate an Ansybl feed document
   * @param {string|object} document - JSON string or parsed object
   * @param {object} options - Validation options
   * @returns {ValidationResult}
   */
  validateDocument(document, options = {}) {
    const startTime = Date.now();
    let parsedDoc;
    
    // Parse JSON if string provided
    try {
      parsedDoc = typeof document === 'string' ? JSON.parse(document) : document;
    } catch (parseError) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_JSON',
          message: 'Document is not valid JSON',
          details: parseError.message,
          field: 'document',
          suggestions: ['Check for syntax errors, missing quotes, or trailing commas']
        }],
        warnings: []
      };
    }

    // Validate against schema
    const isValid = this.validate(parsedDoc);
    
    // Perform business rule validation
    const businessRuleErrors = this._validateBusinessRules(parsedDoc);
    
    // Combine schema and business rule errors
    const allErrors = [];
    
    if (!isValid) {
      const schemaErrors = this.validate.errors.map(error => this._formatError(error, parsedDoc));
      allErrors.push(...schemaErrors);
    }
    
    allErrors.push(...businessRuleErrors);
    
    // Update performance metrics
    const processingTime = Date.now() - startTime;
    this._updatePerformanceMetrics(processingTime, parsedDoc, allErrors.length === 0);
    
    if (allErrors.length === 0) {
      const warnings = options.includeWarnings !== false ? this._generateWarnings(parsedDoc) : [];
      return {
        valid: true,
        errors: [],
        warnings,
        metadata: {
          itemCount: parsedDoc.items ? parsedDoc.items.length : 0,
          hasExtensions: this._hasExtensionFields(parsedDoc),
          processingTimeMs: processingTime
        }
      };
    }
    
    // Track error frequency for metrics
    allErrors.forEach(error => {
      const count = this.performanceMetrics.errorFrequency.get(error.code) || 0;
      this.performanceMetrics.errorFrequency.set(error.code, count + 1);
    });
    
    return {
      valid: false,
      errors: allErrors,
      warnings: [],
      metadata: {
        itemCount: parsedDoc.items ? parsedDoc.items.length : 0,
        hasExtensions: this._hasExtensionFields(parsedDoc),
        processingTimeMs: processingTime
      }
    };
  }

  /**
   * Validate a single content item
   * @param {object} item - Content item to validate
   * @returns {ValidationResult}
   */
  validateContentItem(item) {
    // Create a minimal feed structure for validation
    const testFeed = {
      version: 'https://ansybl.org/version/1.0',
      title: 'Test Feed',
      home_page_url: 'https://example.com',
      feed_url: 'https://example.com/feed.ansybl',
      author: {
        name: 'Test Author',
        public_key: 'ed25519:test'
      },
      items: [item]
    };
    
    const result = this.validateDocument(testFeed);
    
    // Filter errors to only those related to the item
    if (!result.valid) {
      result.errors = result.errors.filter(error => 
        error.field.startsWith('items[0]') || error.field === 'items'
      );
      
      // Update field paths to remove the test structure
      result.errors.forEach(error => {
        if (error.field.startsWith('items[0].')) {
          error.field = error.field.replace('items[0].', '');
        } else if (error.field === 'items[0]') {
          error.field = 'item';
        }
      });
    }
    
    return result;
  }

  /**
   * Validate extension fields
   * @param {object} document - Document to validate
   * @returns {ValidationResult}
   */
  validateExtensions(document) {
    const errors = [];
    
    this._validateExtensionFieldsRecursive(document, '', errors);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Format AJV validation errors into user-friendly messages
   * @private
   */
  _formatError(error, document) {
    const { instancePath, keyword, message, params, data } = error;
    const fieldPath = instancePath || 'root';
    
    const baseError = {
      code: this._getErrorCode(keyword, params),
      field: fieldPath,
      message: this._getHumanMessage(error, document),
      details: message,
      suggestions: this._getSuggestions(error, document)
    };

    return baseError;
  }

  /**
   * Generate error codes based on validation failure type
   * @private
   */
  _getErrorCode(keyword, params) {
    const codeMap = {
      'required': 'MISSING_REQUIRED_FIELD',
      'type': 'INVALID_TYPE',
      'format': 'INVALID_FORMAT',
      'pattern': 'INVALID_PATTERN',
      'minLength': 'TOO_SHORT',
      'maxLength': 'TOO_LONG',
      'minimum': 'TOO_SMALL',
      'maximum': 'TOO_LARGE',
      'additionalProperties': 'UNKNOWN_FIELD',
      'anyOf': 'MISSING_CONTENT',
      'enum': 'INVALID_VALUE'
    };
    
    return codeMap[keyword] || 'VALIDATION_ERROR';
  }

  /**
   * Generate human-readable error messages
   * @private
   */
  _getHumanMessage(error, document) {
    const { instancePath, keyword, params, data } = error;
    const field = instancePath.replace(/^\//, '').replace(/\//g, '.') || 'document';
    
    switch (keyword) {
      case 'required':
        return `Missing required field: ${params.missingProperty}`;
      
      case 'type':
        return `Field '${field}' must be ${params.type}, got ${typeof data}`;
      
      case 'format':
        if (params.format === 'uri') {
          return `Field '${field}' must be a valid URL`;
        }
        if (params.format === 'date-time') {
          return `Field '${field}' must be a valid ISO 8601 date-time`;
        }
        if (params.format === 'uuid') {
          return `Field '${field}' must be a valid UUID`;
        }
        return `Field '${field}' has invalid format: ${params.format}`;
      
      case 'pattern':
        if (field.includes('url') || field.includes('URL')) {
          return `Field '${field}' must be an HTTPS URL`;
        }
        if (field.includes('public_key') || field.includes('signature')) {
          return `Field '${field}' must be a valid ed25519 key/signature (format: ed25519:base64data)`;
        }
        if (field.includes('language')) {
          return `Field '${field}' must be a valid language code (e.g., 'en', 'en-US')`;
        }
        return `Field '${field}' doesn't match required pattern`;
      
      case 'minLength':
        return `Field '${field}' is too short (minimum ${params.limit} characters)`;
      
      case 'maxLength':
        return `Field '${field}' is too long (maximum ${params.limit} characters)`;
      
      case 'minimum':
        return `Field '${field}' must be at least ${params.limit}`;
      
      case 'maximum':
        return `Field '${field}' must be at most ${params.limit}`;
      
      case 'additionalProperties':
        const unknownField = params.additionalProperty;
        if (!unknownField.startsWith('_')) {
          return `Unknown field '${unknownField}'. Extension fields must start with underscore (_)`;
        }
        return `Unknown field '${unknownField}'`;
      
      case 'anyOf':
        if (field.includes('items')) {
          return `Content item must have at least one of: content_text, content_html, or content_markdown`;
        }
        return `Field '${field}' doesn't match any allowed format`;
      
      default:
        return error.message;
    }
  }

  /**
   * Generate helpful suggestions for fixing validation errors
   * @private
   */
  _getSuggestions(error, document) {
    const { keyword, instancePath, params } = error;
    const field = instancePath.replace(/^\//, '').replace(/\//g, '.');
    
    switch (keyword) {
      case 'required':
        const missing = params.missingProperty;
        if (missing === 'signature') {
          return ['Add a cryptographic signature using ed25519', 'Use format: "ed25519:base64encodeddata"'];
        }
        if (missing === 'public_key') {
          return ['Add the author\'s ed25519 public key', 'Generate key pair if needed'];
        }
        return [`Add the required field: ${missing}`];
      
      case 'format':
        if (params.format === 'uri') {
          return ['Ensure URL starts with https://', 'Check for typos in the URL'];
        }
        if (params.format === 'date-time') {
          return ['Use ISO 8601 format: 2025-11-04T10:00:00Z', 'Include timezone information'];
        }
        return ['Check the format requirements in the documentation'];
      
      case 'pattern':
        if (field.includes('url')) {
          return ['Use HTTPS URLs only', 'Example: https://example.com/path'];
        }
        if (field.includes('signature') || field.includes('public_key')) {
          return ['Use ed25519 format: ed25519:base64data', 'Ensure proper base64 encoding'];
        }
        return ['Check the pattern requirements'];
      
      case 'additionalProperties':
        return ['Remove unknown fields or prefix with underscore for extensions', 'Check field name spelling'];
      
      case 'anyOf':
        if (field.includes('items')) {
          return ['Add content_text, content_html, or content_markdown field', 'At least one content field is required'];
        }
        return ['Check that the field matches one of the allowed formats'];
      
      default:
        return ['Check the field value against schema requirements'];
    }
  }

  /**
   * Validate business rules beyond schema constraints
   * @private
   */
  _validateBusinessRules(document) {
    const errors = [];
    
    // Validate feed-level business rules
    this._validateFeedBusinessRules(document, errors);
    
    // Validate item-level business rules
    if (document.items && Array.isArray(document.items)) {
      document.items.forEach((item, index) => {
        this._validateItemBusinessRules(item, index, errors);
      });
    }
    
    return errors;
  }

  /**
   * Validate feed-level business rules
   * @private
   */
  _validateFeedBusinessRules(document, errors) {
    // Check for duplicate item IDs
    if (document.items && Array.isArray(document.items)) {
      const itemIds = new Set();
      document.items.forEach((item, index) => {
        if (item.id) {
          if (itemIds.has(item.id)) {
            errors.push({
              code: 'DUPLICATE_ITEM_ID',
              message: `Duplicate item ID found: ${item.id}`,
              field: `items[${index}].id`,
              details: 'Each item must have a unique ID',
              suggestions: ['Ensure all item IDs are unique within the feed']
            });
          }
          itemIds.add(item.id);
        }
      });
    }

    // Validate feed URL consistency
    if (document.feed_url && document.items) {
      document.items.forEach((item, index) => {
        if (item.id && !item.id.startsWith(document.feed_url.replace('/feed.ansybl', ''))) {
          errors.push({
            code: 'INCONSISTENT_ITEM_URL',
            message: `Item ID should be under the same domain as feed URL`,
            field: `items[${index}].id`,
            details: `Item ID: ${item.id}, Feed URL: ${document.feed_url}`,
            suggestions: ['Ensure item IDs use the same domain as the feed']
          });
        }
      });
    }
  }

  /**
   * Validate item-level business rules
   * @private
   */
  _validateItemBusinessRules(item, index, errors) {
    const fieldPrefix = `items[${index}]`;
    
    // Validate date consistency
    if (item.date_published && item.date_modified) {
      const published = new Date(item.date_published);
      const modified = new Date(item.date_modified);
      
      if (modified < published) {
        errors.push({
          code: 'INVALID_DATE_ORDER',
          message: 'Modified date cannot be before published date',
          field: `${fieldPrefix}.date_modified`,
          details: `Published: ${item.date_published}, Modified: ${item.date_modified}`,
          suggestions: ['Ensure date_modified is after or equal to date_published']
        });
      }
    }

    // Validate content consistency
    const hasText = !!item.content_text;
    const hasHtml = !!item.content_html;
    const hasMarkdown = !!item.content_markdown;
    
    if (!hasText && !hasHtml && !hasMarkdown && !item.title) {
      errors.push({
        code: 'NO_CONTENT',
        message: 'Item must have at least one content field or a title',
        field: fieldPrefix,
        details: 'Missing content_text, content_html, content_markdown, and title',
        suggestions: ['Add at least one content field or a title']
      });
    }

    // Validate attachment consistency
    if (item.attachments && Array.isArray(item.attachments)) {
      item.attachments.forEach((attachment, attIndex) => {
        this._validateAttachmentBusinessRules(attachment, `${fieldPrefix}.attachments[${attIndex}]`, errors);
      });
    }

    // Validate reply consistency
    if (item.in_reply_to && item.id && item.in_reply_to === item.id) {
      errors.push({
        code: 'SELF_REPLY',
        message: 'Item cannot reply to itself',
        field: `${fieldPrefix}.in_reply_to`,
        details: `Item ID and in_reply_to are both: ${item.id}`,
        suggestions: ['Remove in_reply_to or change it to a different item']
      });
    }
  }

  /**
   * Validate attachment business rules
   * @private
   */
  _validateAttachmentBusinessRules(attachment, fieldPrefix, errors) {
    // Validate image dimensions
    if (attachment.mime_type && attachment.mime_type.startsWith('image/')) {
      if (attachment.width && attachment.height) {
        if (attachment.width <= 0 || attachment.height <= 0) {
          errors.push({
            code: 'INVALID_IMAGE_DIMENSIONS',
            message: 'Image dimensions must be positive numbers',
            field: `${fieldPrefix}`,
            details: `Width: ${attachment.width}, Height: ${attachment.height}`,
            suggestions: ['Ensure width and height are positive integers']
          });
        }
      }
    }

    // Validate video/audio duration
    if (attachment.mime_type && (attachment.mime_type.startsWith('video/') || attachment.mime_type.startsWith('audio/'))) {
      if (attachment.duration_in_seconds !== undefined && attachment.duration_in_seconds < 0) {
        errors.push({
          code: 'INVALID_DURATION',
          message: 'Duration cannot be negative',
          field: `${fieldPrefix}.duration_in_seconds`,
          details: `Duration: ${attachment.duration_in_seconds}`,
          suggestions: ['Ensure duration_in_seconds is a positive number']
        });
      }
    }

    // Validate file size
    if (attachment.size_in_bytes !== undefined && attachment.size_in_bytes < 0) {
      errors.push({
        code: 'INVALID_FILE_SIZE',
        message: 'File size cannot be negative',
        field: `${fieldPrefix}.size_in_bytes`,
        details: `Size: ${attachment.size_in_bytes}`,
        suggestions: ['Ensure size_in_bytes is a positive integer']
      });
    }
  }

  /**
   * Validate extension fields recursively
   * @private
   */
  _validateExtensionFieldsRecursive(obj, path, errors) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      
      if (key.startsWith('_')) {
        // Validate extension field name format
        if (!/^_[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
          errors.push({
            code: 'INVALID_EXTENSION_FIELD_NAME',
            message: `Invalid extension field name: ${key}`,
            field: fieldPath,
            details: 'Extension fields must start with underscore followed by letter, then alphanumeric/underscore characters',
            suggestions: ['Use format: _fieldName, _my_field, _customData']
          });
        }
        
        // Validate extension field value (should be JSON serializable)
        try {
          JSON.stringify(value);
        } catch (error) {
          errors.push({
            code: 'INVALID_EXTENSION_FIELD_VALUE',
            message: `Extension field value is not JSON serializable: ${key}`,
            field: fieldPath,
            details: error.message,
            suggestions: ['Ensure extension field values are JSON serializable']
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively validate nested objects
        this._validateExtensionFieldsRecursive(value, fieldPath, errors);
      }
    }
  }

  /**
   * Create a custom validator with extended schema
   * @param {object} customSchema - Additional schema definitions
   * @returns {AnsyblValidator}
   */
  createCustomValidator(customSchema) {
    const cacheKey = JSON.stringify(customSchema);
    
    if (this.customValidators.has(cacheKey)) {
      return this.customValidators.get(cacheKey);
    }
    
    // Create new validator instance with merged schema
    const customValidator = new AnsyblValidator();
    
    // Merge custom schema with base schema
    const mergedSchema = this._mergeSchemas(this.schema, customSchema);
    customValidator.validate = customValidator.ajv.compile(mergedSchema);
    
    // Cache the custom validator
    this.customValidators.set(cacheKey, customValidator);
    
    return customValidator;
  }

  /**
   * Get performance metrics
   * @returns {object}
   */
  getPerformanceMetrics() {
    const metrics = { ...this.performanceMetrics };
    
    // Convert Map to object for JSON serialization
    metrics.errorFrequency = Object.fromEntries(this.performanceMetrics.errorFrequency);
    
    // Calculate additional stats
    if (metrics.totalValidations > 0) {
      metrics.averageProcessingTime = metrics.totalProcessingTime / metrics.totalValidations;
      metrics.validationSuccessRate = (metrics.validDocuments / metrics.totalValidations) * 100;
    }
    
    return metrics;
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalValidations: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      validDocuments: 0,
      invalidDocuments: 0,
      lastReset: new Date().toISOString(),
      errorFrequency: new Map(),
      documentSizeStats: {
        min: Infinity,
        max: 0,
        average: 0,
        total: 0
      }
    };
  }

  /**
   * Validate multiple documents efficiently
   * @param {Array} documents - Array of documents to validate
   * @param {object} options - Validation options
   * @returns {Array} Array of validation results
   */
  validateBatch(documents, options = {}) {
    const results = [];
    const startTime = Date.now();
    
    documents.forEach((document, index) => {
      try {
        const result = this.validateDocument(document, options);
        result.batchIndex = index;
        results.push(result);
      } catch (error) {
        results.push({
          batchIndex: index,
          valid: false,
          errors: [{
            code: 'BATCH_VALIDATION_ERROR',
            message: error.message
          }],
          warnings: []
        });
      }
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`📊 Batch validation completed: ${documents.length} documents in ${totalTime}ms`);
    
    return results;
  }

  /**
   * Update performance metrics
   * @private
   */
  _updatePerformanceMetrics(processingTime, document, isValid) {
    this.performanceMetrics.totalValidations++;
    this.performanceMetrics.totalProcessingTime += processingTime;
    
    if (isValid) {
      this.performanceMetrics.validDocuments++;
    } else {
      this.performanceMetrics.invalidDocuments++;
    }
    
    // Update document size statistics
    const documentSize = JSON.stringify(document).length;
    const sizeStats = this.performanceMetrics.documentSizeStats;
    
    sizeStats.min = Math.min(sizeStats.min, documentSize);
    sizeStats.max = Math.max(sizeStats.max, documentSize);
    sizeStats.total += documentSize;
    sizeStats.average = sizeStats.total / this.performanceMetrics.totalValidations;
  }

  /**
   * Check if document has extension fields
   * @private
   */
  _hasExtensionFields(document) {
    return this._hasExtensionFieldsRecursive(document);
  }

  /**
   * Recursively check for extension fields
   * @private
   */
  _hasExtensionFieldsRecursive(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) {
        return true;
      }
      
      if (typeof value === 'object' && value !== null) {
        if (this._hasExtensionFieldsRecursive(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Merge base schema with custom schema
   * @private
   */
  _mergeSchemas(baseSchema, customSchema) {
    const merged = JSON.parse(JSON.stringify(baseSchema));
    
    // Merge properties
    if (customSchema.properties) {
      merged.properties = { ...merged.properties, ...customSchema.properties };
    }
    
    // Merge definitions
    if (customSchema.definitions) {
      merged.definitions = { ...merged.definitions, ...customSchema.definitions };
    }
    
    // Merge required fields
    if (customSchema.required) {
      merged.required = [...(merged.required || []), ...customSchema.required];
    }
    
    // Add custom validation rules
    if (customSchema.additionalValidation) {
      merged._customValidation = customSchema.additionalValidation;
    }
    
    return merged;
  }

  /**
   * Generate warnings for valid but potentially problematic documents
   * @private
   */
  _generateWarnings(document) {
    const warnings = [];
    
    // Check for missing optional but recommended fields
    if (!document.description) {
      warnings.push({
        code: 'MISSING_DESCRIPTION',
        message: 'Feed description is recommended for better discoverability',
        field: 'description'
      });
    }
    
    if (!document.icon) {
      warnings.push({
        code: 'MISSING_ICON',
        message: 'Feed icon is recommended for better user experience',
        field: 'icon'
      });
    }
    
    if (!document.language) {
      warnings.push({
        code: 'MISSING_LANGUAGE',
        message: 'Language specification helps with content discovery',
        field: 'language'
      });
    }
    
    // Check items for common issues
    if (document.items) {
      document.items.forEach((item, index) => {
        if (!item.title && !item.summary) {
          warnings.push({
            code: 'MISSING_TITLE_SUMMARY',
            message: `Item ${index + 1}: Title or summary recommended for better readability`,
            field: `items[${index}]`
          });
        }
        
        if (item.attachments) {
          item.attachments.forEach((attachment, attIndex) => {
            if (attachment.mime_type.startsWith('image/') && !attachment.alt_text) {
              warnings.push({
                code: 'MISSING_ALT_TEXT',
                message: `Item ${index + 1}, attachment ${attIndex + 1}: Alt text recommended for accessibility`,
                field: `items[${index}].attachments[${attIndex}].alt_text`
              });
            }
          });
        }
      });
    }
    
    return warnings;
  }
}

export default AnsyblValidator;