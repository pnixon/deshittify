/**
 * Ansybl Feed Document Generator
 * Creates valid, signed feed documents with proper metadata and content items
 */

import { signContent } from './signature.js';
import { CanonicalJSONSerializer } from './canonicalizer.js';
import { AnsyblValidator } from './validator.js';
import { MediaAttachmentHandler } from './media-handler.js';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Main generator class for creating Ansybl feed documents
 */
export class AnsyblGenerator {
  constructor() {
    this.validator = new AnsyblValidator();
    this.mediaHandler = new MediaAttachmentHandler();
    
    // Initialize DOMPurify for HTML sanitization
    const window = new JSDOM('').window;
    this.DOMPurify = createDOMPurify(window);
    
    // Configure marked for markdown processing
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false // We'll use DOMPurify instead
    });
  }

  /**
   * Create a new Ansybl feed document
   */
  createFeed(metadata) {
    // Validate required fields
    this._validateFeedMetadata(metadata);

    const feed = {
      version: metadata.version || 'https://ansybl.org/version/1.0',
      title: metadata.title,
      home_page_url: metadata.home_page_url,
      feed_url: metadata.feed_url,
      author: {
        name: metadata.author.name,
        public_key: metadata.author.public_key
      },
      items: []
    };

    // Add optional feed fields
    if (metadata.description) feed.description = metadata.description;
    if (metadata.icon) feed.icon = metadata.icon;
    if (metadata.language) feed.language = metadata.language;

    // Add optional author fields
    if (metadata.author.url) feed.author.url = metadata.author.url;
    if (metadata.author.avatar) feed.author.avatar = metadata.author.avatar;

    // Add extension fields to feed
    this._processExtensionFields(feed, metadata);

    // Add extension fields to author
    if (metadata.author) {
      this._processExtensionFields(feed.author, metadata.author);
    }

    return feed;
  }

  /**
   * Add a content item to an existing feed
   */
  async addItem(feed, itemData, privateKey) {
    // Validate inputs
    this._validateItemData(itemData);
    this._validatePrivateKey(privateKey);

    // Create the item object
    const item = {
      id: itemData.id,
      url: itemData.url,
      date_published: itemData.date_published || new Date().toISOString()
    };

    // Add UUID if not provided
    if (itemData.uuid) {
      item.uuid = itemData.uuid;
    } else {
      item.uuid = uuidv4();
    }

    // Add optional fields
    if (itemData.title) item.title = itemData.title;
    if (itemData.summary) item.summary = itemData.summary;
    if (itemData.date_modified) item.date_modified = itemData.date_modified;
    if (itemData.tags && Array.isArray(itemData.tags)) {
      item.tags = this._processTags(itemData.tags);
    }
    if (itemData.in_reply_to) item.in_reply_to = itemData.in_reply_to;

    // Process content formats with comprehensive support
    await this._processContentFormats(item, itemData);

    // Add item-specific author if provided
    if (itemData.author) {
      item.author = {
        name: itemData.author.name,
        public_key: itemData.author.public_key
      };
      if (itemData.author.url) item.author.url = itemData.author.url;
      if (itemData.author.avatar) item.author.avatar = itemData.author.avatar;
    }

    // Add attachments if provided
    if (itemData.attachments && Array.isArray(itemData.attachments)) {
      item.attachments = await this._processAttachments(itemData.attachments);
    }

    // Add interactions if provided
    if (itemData.interactions) {
      item.interactions = {
        replies_count: itemData.interactions.replies_count || 0,
        likes_count: itemData.interactions.likes_count || 0,
        shares_count: itemData.interactions.shares_count || 0
      };
      if (itemData.interactions.replies_url) item.interactions.replies_url = itemData.interactions.replies_url;
      if (itemData.interactions.likes_url) item.interactions.likes_url = itemData.interactions.likes_url;
      if (itemData.interactions.shares_url) item.interactions.shares_url = itemData.interactions.shares_url;
    }

    // Add extension fields with validation
    this._processExtensionFields(item, itemData);

    // Sign the item
    item.signature = await this.signItem(item, privateKey);

    // Add item to feed
    const updatedFeed = { ...feed };
    updatedFeed.items = [...feed.items, item];

    return updatedFeed;
  }

  /**
   * Sign a content item
   */
  async signItem(item, privateKey) {
    this._validatePrivateKey(privateKey);
    
    // Create canonical signature data for the item
    const signatureData = CanonicalJSONSerializer.createSignatureData(item, 'item');
    const signableContent = JSON.parse(signatureData);
    
    return await signContent(signableContent, privateKey);
  }

  /**
   * Sign the entire feed document
   */
  async signFeed(feed, privateKey) {
    this._validatePrivateKey(privateKey);
    
    // Create canonical signature data for the feed
    const signatureData = CanonicalJSONSerializer.createSignatureData(feed, 'feed');
    const signableContent = JSON.parse(signatureData);
    
    const signature = await signContent(signableContent, privateKey);
    
    return {
      ...feed,
      signature
    };
  }

  /**
   * Create a complete feed document with items and signatures
   */
  async createCompleteFeed(metadata, items = [], privateKey) {
    // Create base feed
    let feed = this.createFeed(metadata);
    
    // Add all items with signatures
    for (const itemData of items) {
      feed = await this.addItem(feed, itemData, privateKey);
    }
    
    // Sign the complete feed
    feed = await this.signFeed(feed, privateKey);
    
    return feed;
  }

  /**
   * Validate feed metadata
   * @private
   */
  _validateFeedMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Feed metadata must be an object');
    }

    const required = ['title', 'home_page_url', 'feed_url', 'author'];
    for (const field of required) {
      if (!metadata[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!metadata.author.name || !metadata.author.public_key) {
      throw new Error('Author must have name and public_key');
    }

    // Validate URLs
    this._validateURL(metadata.home_page_url, 'home_page_url');
    this._validateURL(metadata.feed_url, 'feed_url');
    
    if (metadata.author.url) {
      this._validateURL(metadata.author.url, 'author.url');
    }
    if (metadata.author.avatar) {
      this._validateURL(metadata.author.avatar, 'author.avatar');
    }
    if (metadata.icon) {
      this._validateURL(metadata.icon, 'icon');
    }
  }

  /**
   * Validate item data
   * @private
   */
  _validateItemData(itemData) {
    if (!itemData || typeof itemData !== 'object') {
      throw new Error('Item data must be an object');
    }

    const required = ['id', 'url'];
    for (const field of required) {
      if (!itemData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate that at least one content field is present
    const contentFields = ['content_text', 'content_html', 'content_markdown'];
    const hasContent = contentFields.some(field => itemData[field]);
    if (!hasContent && !itemData.title) {
      throw new Error('Item must have at least one content field or a title');
    }

    // Validate URLs
    this._validateURL(itemData.id, 'id');
    this._validateURL(itemData.url, 'url');
    
    if (itemData.in_reply_to) {
      this._validateURL(itemData.in_reply_to, 'in_reply_to');
    }

    // Validate dates
    if (itemData.date_published) {
      this._validateISO8601Date(itemData.date_published, 'date_published');
    }
    if (itemData.date_modified) {
      this._validateISO8601Date(itemData.date_modified, 'date_modified');
    }
  }

  /**
   * Validate private key format
   * @private
   */
  _validatePrivateKey(privateKey) {
    if (!privateKey || typeof privateKey !== 'string') {
      throw new Error('Private key must be a non-empty string');
    }
    
    if (!privateKey.startsWith('ed25519:')) {
      throw new Error('Private key must be in format "ed25519:base64"');
    }
  }

  /**
   * Validate URL format
   * @private
   */
  _validateURL(url, fieldName) {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL for ${fieldName}: ${url}`);
    }
  }

  /**
   * Validate ISO 8601 date format
   * @private
   */
  _validateISO8601Date(dateString, fieldName) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for ${fieldName}: ${dateString}`);
    }
  }

  /**
   * Process attachments using media handler
   * @private
   */
  async _processAttachments(attachments) {
    return await this.mediaHandler.processAttachments(attachments, {
      extractMetadata: true,
      validateUrls: true,
      skipInvalid: false
    });
  }

  /**
   * Process content formats with comprehensive support
   * @private
   */
  async _processContentFormats(item, itemData) {
    // Handle content_text
    if (itemData.content_text) {
      item.content_text = itemData.content_text;
    }

    // Handle content_markdown and convert to HTML
    if (itemData.content_markdown) {
      item.content_markdown = itemData.content_markdown;
      
      // Convert markdown to HTML if HTML not provided
      if (!itemData.content_html) {
        const rawHtml = marked(itemData.content_markdown);
        item.content_html = this.DOMPurify.sanitize(rawHtml);
      }
      
      // Generate text version if not provided
      if (!itemData.content_text) {
        item.content_text = this._stripHtml(item.content_html || rawHtml);
      }
    }

    // Handle content_html
    if (itemData.content_html) {
      // Sanitize HTML content
      item.content_html = this.DOMPurify.sanitize(itemData.content_html);
      
      // Generate text version if not provided
      if (!itemData.content_text && !itemData.content_markdown) {
        item.content_text = this._stripHtml(item.content_html);
      }
    }

    // Auto-generate summary if not provided
    if (!itemData.summary && item.content_text) {
      item.summary = this._generateSummary(item.content_text);
    }
  }

  /**
   * Process and validate tags
   * @private
   */
  _processTags(tags) {
    return tags
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => /^[a-zA-Z0-9_-]+$/.test(tag))
      .slice(0, 20) // Limit to 20 tags as per schema
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
  }

  /**
   * Process extension fields with underscore prefix validation
   * @private
   */
  _processExtensionFields(item, itemData) {
    for (const [key, value] of Object.entries(itemData)) {
      if (key.startsWith('_')) {
        // Validate extension field name format
        if (!/^_[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
          throw new Error(`Invalid extension field name: ${key}. Must start with underscore followed by letter, then alphanumeric/underscore characters.`);
        }
        
        // Add extension field
        item[key] = value;
      }
    }
  }

  /**
   * Strip HTML tags to create plain text
   * @private
   */
  _stripHtml(html) {
    if (!html) return '';
    
    // Use JSDOM to parse and extract text content
    const dom = new JSDOM(html);
    return dom.window.document.body.textContent || '';
  }

  /**
   * Generate summary from content text
   * @private
   */
  _generateSummary(text, maxLength = 200) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastPunctuation = Math.max(lastSentence, lastExclamation, lastQuestion);
    
    if (lastPunctuation > maxLength * 0.5) {
      return text.substring(0, lastPunctuation + 1);
    }
    
    // If no good sentence break, find last word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      return text.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
}

export default AnsyblGenerator;