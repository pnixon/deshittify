// webpage/utils/ansyblParser.js
// Enhanced Ansybl feed parser with validation and signature verification

window.AnsyblParser = {
  // Parse and validate Ansybl feed document
  parseAnsyblFeed: function(feedContent) {
    try {
      const data = JSON.parse(feedContent);
      
      if (typeof data !== "object" || data === null) {
        throw new Error("Feed does not contain a valid JSON object");
      }

      // Basic structure validation
      const validation = this.validateFeedStructure(data);
      if (!validation.valid) {
        return { 
          data: null, 
          error: validation.error,
          warnings: validation.warnings || []
        };
      }

      // Parse items with content processing
      const processedData = this.processFeedContent(data);
      
      return { 
        data: processedData, 
        error: null,
        warnings: validation.warnings || []
      };
    } catch (error) {
      return { 
        data: null, 
        error: `Parse error: ${error.message}`,
        warnings: []
      };
    }
  },

  // Validate basic Ansybl feed structure
  validateFeedStructure: function(data) {
    const warnings = [];
    
    // Check required fields
    const requiredFields = ['version', 'title', 'home_page_url', 'feed_url', 'author', 'items'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate version format
    if (!data.version.match(/^https:\/\/ansybl\.org\/version\/\d+\.\d+$/)) {
      return { valid: false, error: `Invalid version format: ${data.version}` };
    }

    // Validate URLs
    if (!this.isValidHttpsUrl(data.home_page_url)) {
      return { valid: false, error: `Invalid home_page_url: must be HTTPS` };
    }
    
    if (!this.isValidHttpsUrl(data.feed_url)) {
      return { valid: false, error: `Invalid feed_url: must be HTTPS` };
    }

    // Validate author
    if (!data.author.name || !data.author.public_key) {
      return { valid: false, error: `Author must have name and public_key` };
    }

    if (!data.author.public_key.match(/^ed25519:[A-Za-z0-9+/]+=*$/)) {
      return { valid: false, error: `Invalid public key format` };
    }

    // Validate items array
    if (!Array.isArray(data.items)) {
      return { valid: false, error: `Items must be an array` };
    }

    // Validate each item
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const itemValidation = this.validateItem(item, i);
      if (!itemValidation.valid) {
        return { valid: false, error: `Item ${i}: ${itemValidation.error}` };
      }
      if (itemValidation.warnings) {
        warnings.push(...itemValidation.warnings.map(w => `Item ${i}: ${w}`));
      }
    }

    // Check for signature (optional but recommended)
    if (!data.signature) {
      warnings.push('Feed signature missing - content cannot be verified');
    }

    return { valid: true, warnings };
  },

  // Validate individual feed item
  validateItem: function(item, index) {
    const warnings = [];
    
    // Required fields
    const requiredFields = ['id', 'url', 'date_published'];
    for (const field of requiredFields) {
      if (!item[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Must have at least one content field
    if (!item.content_text && !item.content_html && !item.content_markdown) {
      return { valid: false, error: `Must have at least one content field (content_text, content_html, or content_markdown)` };
    }

    // Validate URLs
    if (!this.isValidHttpsUrl(item.id)) {
      return { valid: false, error: `Invalid id: must be HTTPS URL` };
    }
    
    if (!this.isValidHttpsUrl(item.url)) {
      return { valid: false, error: `Invalid url: must be HTTPS URL` };
    }

    // Validate date format
    if (!this.isValidISODate(item.date_published)) {
      return { valid: false, error: `Invalid date_published format` };
    }

    if (item.date_modified && !this.isValidISODate(item.date_modified)) {
      return { valid: false, error: `Invalid date_modified format` };
    }

    // Check for signature
    if (!item.signature) {
      warnings.push('Item signature missing - content cannot be verified');
    } else if (!item.signature.match(/^ed25519:[A-Za-z0-9+/]+=*$/)) {
      return { valid: false, error: `Invalid signature format` };
    }

    // Validate attachments if present
    if (item.attachments) {
      if (!Array.isArray(item.attachments)) {
        return { valid: false, error: `Attachments must be an array` };
      }
      
      for (let j = 0; j < item.attachments.length; j++) {
        const attachment = item.attachments[j];
        if (!attachment.url || !attachment.mime_type) {
          return { valid: false, error: `Attachment ${j}: missing url or mime_type` };
        }
        if (!this.isValidHttpsUrl(attachment.url)) {
          return { valid: false, error: `Attachment ${j}: invalid URL` };
        }
      }
    }

    return { valid: true, warnings };
  },

  // Process feed content (markdown to HTML, etc.)
  processFeedContent: function(data) {
    const processedData = { ...data };
    
    // Process each item
    processedData.items = data.items.map(item => {
      const processedItem = { ...item };
      
      // Convert markdown to HTML if present
      if (item.content_markdown && window.marked) {
        try {
          processedItem.content_html = window.marked.parse(item.content_markdown);
        } catch (error) {
          console.warn('Failed to parse markdown:', error);
        }
      }
      
      // Ensure we have a display title
      if (!processedItem.title && processedItem.content_text) {
        // Use first line or first 50 chars as title
        const firstLine = processedItem.content_text.split('\n')[0];
        processedItem.title = firstLine.length > 50 
          ? firstLine.substring(0, 47) + '...'
          : firstLine;
      }
      
      return processedItem;
    });
    
    return processedData;
  },

  // Utility functions
  isValidHttpsUrl: function(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  },

  isValidISODate: function(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && dateString.includes('T');
  },

  // Format timestamp for display
  formatTimestamp: function(timestamp) {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return 'Unknown date';
    }
  },

  // Extract clean URL from various formats
  extractUrl: function(urlOrObject) {
    if (typeof urlOrObject === 'string') {
      return urlOrObject;
    }
    if (urlOrObject && urlOrObject.url) {
      return urlOrObject.url;
    }
    return null;
  }
};

// Backward compatibility
window.parseAnsyblFile = window.AnsyblParser.parseAnsyblFeed;
window.formatTimestamp = window.AnsyblParser.formatTimestamp;
window.extractUrl = window.AnsyblParser.extractUrl;