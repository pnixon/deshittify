// cli/lib/validator.js
// Ansybl feed validation utilities

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs-extra');
const path = require('path');

class AnsyblValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    
    // Load schema
    this.loadSchema();
  }

  loadSchema() {
    try {
      const schemaPath = path.join(__dirname, '../../schema/ansybl-feed.schema.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validate = this.ajv.compile(this.schema);
    } catch (error) {
      throw new Error(`Failed to load Ansybl schema: ${error.message}`);
    }
  }

  // Validate feed document
  validateFeed(feedData) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // JSON Schema validation
    const isValid = this.validate(feedData);
    if (!isValid) {
      result.valid = false;
      result.errors = this.validate.errors.map(error => ({
        path: error.instancePath || 'root',
        message: error.message,
        value: error.data,
        schema: error.schemaPath
      }));
    }

    // Additional semantic validation
    const semanticValidation = this.validateSemantics(feedData);
    result.warnings.push(...semanticValidation.warnings);
    
    if (!semanticValidation.valid) {
      result.valid = false;
      result.errors.push(...semanticValidation.errors);
    }

    return result;
  }

  // Semantic validation beyond JSON Schema
  validateSemantics(feedData) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check version compatibility
    if (feedData.version) {
      const versionMatch = feedData.version.match(/\/version\/(\d+)\.(\d+)$/);
      if (versionMatch) {
        const [, major, minor] = versionMatch;
        if (major !== '1') {
          result.warnings.push(`Unsupported major version: ${major} (expected 1)`);
        }
      }
    }

    // Validate URLs are reachable (optional check)
    if (feedData.feed_url && feedData.home_page_url) {
      if (feedData.feed_url === feedData.home_page_url) {
        result.warnings.push('feed_url and home_page_url are identical - consider using different URLs');
      }
    }

    // Check for missing signatures
    if (!feedData.signature) {
      result.warnings.push('Feed signature missing - content cannot be cryptographically verified');
    }

    // Validate items
    if (feedData.items && Array.isArray(feedData.items)) {
      feedData.items.forEach((item, index) => {
        const itemValidation = this.validateItem(item, index);
        result.warnings.push(...itemValidation.warnings);
        
        if (!itemValidation.valid) {
          result.valid = false;
          result.errors.push(...itemValidation.errors);
        }
      });
    }

    // Check for duplicate item IDs
    if (feedData.items) {
      const ids = feedData.items.map(item => item.id).filter(Boolean);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length > 0) {
        result.errors.push({
          path: 'items',
          message: `Duplicate item IDs found: ${duplicates.join(', ')}`,
          value: duplicates
        });
        result.valid = false;
      }
    }

    return result;
  }

  // Validate individual item
  validateItem(item, index) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check for signature
    if (!item.signature) {
      result.warnings.push(`Item ${index}: signature missing - content cannot be verified`);
    }

    // Check content fields
    const contentFields = ['content_text', 'content_html', 'content_markdown'];
    const hasContent = contentFields.some(field => item[field]);
    
    if (!hasContent) {
      result.errors.push({
        path: `items[${index}]`,
        message: 'Item must have at least one content field (content_text, content_html, or content_markdown)',
        value: item
      });
      result.valid = false;
    }

    // Validate dates
    if (item.date_published) {
      const publishDate = new Date(item.date_published);
      if (isNaN(publishDate.getTime())) {
        result.errors.push({
          path: `items[${index}].date_published`,
          message: 'Invalid date format',
          value: item.date_published
        });
        result.valid = false;
      } else if (publishDate > new Date()) {
        result.warnings.push(`Item ${index}: publication date is in the future`);
      }
    }

    if (item.date_modified && item.date_published) {
      const modDate = new Date(item.date_modified);
      const pubDate = new Date(item.date_published);
      
      if (!isNaN(modDate.getTime()) && !isNaN(pubDate.getTime())) {
        if (modDate < pubDate) {
          result.warnings.push(`Item ${index}: modification date is before publication date`);
        }
      }
    }

    // Validate attachments
    if (item.attachments && Array.isArray(item.attachments)) {
      item.attachments.forEach((attachment, attIndex) => {
        if (!attachment.url || !attachment.mime_type) {
          result.errors.push({
            path: `items[${index}].attachments[${attIndex}]`,
            message: 'Attachment must have url and mime_type',
            value: attachment
          });
          result.valid = false;
        }

        // Check MIME type format
        if (attachment.mime_type && !attachment.mime_type.match(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/)) {
          result.warnings.push(`Item ${index}, attachment ${attIndex}: invalid MIME type format`);
        }
      });
    }

    return result;
  }

  // Validate feed from file
  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const feedData = JSON.parse(content);
      return this.validateFeed(feedData);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          path: 'file',
          message: `Failed to read or parse file: ${error.message}`,
          value: filePath
        }],
        warnings: []
      };
    }
  }

  // Validate feed from URL
  async validateUrl(url) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      const feedData = JSON.parse(content);
      return this.validateFeed(feedData);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          path: 'url',
          message: `Failed to fetch or parse URL: ${error.message}`,
          value: url
        }],
        warnings: []
      };
    }
  }
}

module.exports = AnsyblValidator;