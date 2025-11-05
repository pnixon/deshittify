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
  }

  /**
   * Validate an Ansybl feed document
   * @param {string|object} document - JSON string or parsed object
   * @returns {ValidationResult}
   */
  validateDocument(document) {
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
          suggestions: ['Check for syntax errors, missing quotes, or trailing commas']
        }],
        warnings: []
      };
    }

    // Validate against schema
    const isValid = this.validate(parsedDoc);
    
    if (isValid) {
      const warnings = this._generateWarnings(parsedDoc);
      return {
        valid: true,
        errors: [],
        warnings
      };
    }

    // Process validation errors
    const errors = this.validate.errors.map(error => this._formatError(error, parsedDoc));
    
    return {
      valid: false,
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