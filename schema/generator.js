/**
 * Ansybl Feed Document Generator
 * Creates valid, signed feed documents with proper metadata and content items
 */

import { signContent } from './signature.js';
import { CanonicalJSONSerializer } from './canonicalizer.js';
import { AnsyblValidator } from './validator.js';
import { MediaAttachmentHandler } from './media-handler.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main generator class for creating Ansybl feed documents
 */
export class AnsyblGenerator {
  constructor() {
    this.validator = new AnsyblValidator();
    this.mediaHandler = new MediaAttachmentHandler();
  }

  /**
   * Create a new Ansybl feed document
   * @param {object} metadata - Feed metadata
   * @param {string} metadata.title - Feed title
   * @param {string} metadata.home_page_url - Home page URL
   * @param {string} metadata.feed_url - Feed URL
   * @param {object} metadata.author - Author information
   * @param {string} metadata.author.name - Author name
   * @param {string} metadata.author.public_key - Author's public key
   * @param {string} [metadata.author.url] - Author's URL
   * @param {string} [metadata.author.avatar] - Author's avatar URL
   * @param {string} [metadata.description] - Feed description
   * @param {string} [metadata.icon] - Feed icon URL
   * @param {string} [metadata.language] - Feed language (ISO 639-1)
   * @param {string} [metadata.version] - Protocol version
   * @returns {object} New Ansybl feed document
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

    return feed;
  }

  /**
   * Add a content item to an existing feed
   * @param {object} feed - Existing feed document
   * @param {object} itemData - Content item data
   * @param {string} itemData.id - Unique item identifier (URL)
   * @param {string} itemData.url - Item URL
   * @param {string} [itemData.uuid] - UUID for the item
   * @param {string} [itemData.title] - Item title
   * @param {string} [itemData.content_text] - Plain text content
   * @param {string} [itemData.content_html] - HTML content
   * @param {string} [itemData.content_markdown] - Markdown content
   * @param {string} [itemData.summary] - Item summary
   * @param {string} [itemData.date_published] - Publication date (ISO 8601)
   * @param {string} [itemData.date_modified] - Modification date (ISO 8601)
   * @param {object} [itemData.author] - Item-specific author (overrides feed author)
   * @param {string[]} [itemData.tags] - Content tags
   * @param {object[]} [itemData.attachments] - Media attachments
   * @param {string} [itemData.in_reply_to] - URL of item being replied to
   * @param {object} [itemData.interactions] - Interaction counts
   * @param {string} privateKey - Private key for signing the item
   * @returns {Promise<object>} Updated feed with new item
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

    // Add optional fields
    if (itemData.uuid) item.uuid = itemData.uuid;
    if (itemData.title) item.title = itemData.title;
    if (itemData.content_text) item.content_text = itemData.content_text;
    if (itemData.content_html) item.content_html = itemData.content_html;
    if (itemData.content_markdown) item.content_markdown = itemData.content_markdown;
    if (itemData.summary) item.summary = itemData.summary;
    if (itemData.date_modified) item.date_modified = itemData.date_modified;
    if (itemData.tags && Array.isArray(itemData.tags)) item.tags = [...itemData.tags];
    if (itemData.in_reply_to) item.in_reply_to = itemData.in_reply_to;

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

    // Sign the item
    item.signature = await this.signItem(item, privateKey);

    // Add item to feed
    const updatedFeed = { ...feed };
    updatedFeed.items = [...feed.items, item];

    return updatedFeed;
  }

  /**
   * Sign a content item
   * @param {object} item - Content item to sign
   * @param {string} privateKey - Private key for signing
   * @returns {Promise<string>} Signature string
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
   * @param {object} feed - Feed document to sign
   * @param {string} privateKey - Private key for signing
   * @returns {Promise<object>} Feed with signature
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
   * Serialize feed to valid JSON with proper formatting
   * @param {object} feed - Feed document to serialize
   * @param {object} options - Serialization options
   * @param {boolean} [options.pretty=true] - Whether to format with indentation
   * @param {number} [options.indent=2] - Number of spaces for indentation
   * @returns {string} Serialized JSON string
   */
  serialize(feed, options = {}) {
    const { pretty = true, indent = 2 } = options;
    
    if (pretty) {
      return JSON.stringify(feed, null, indent);
    } else {
      return JSON.stringify(feed);
    }
  }

  /**
   * Create a complete feed document with items and signatures
   * @param {object} metadata - Feed metadata
   * @param {object[]} items - Array of content items
   * @param {string} privateKey - Private key for signing
   * @returns {Promise<object>} Complete signed feed document
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
   * Update an existing item in the feed
   * @param {object} feed - Feed document
   * @param {string} itemId - ID of item to update
   * @param {object} updates - Fields to update
   * @param {string} privateKey - Private key for re-signing
   * @returns {Promise<object>} Updated feed
   */
  async updateItem(feed, itemId, updates, privateKey) {
    const itemIndex = feed.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item with ID '${itemId}' not found in feed`);
    }

    // Create updated item
    const currentItem = feed.items[itemIndex];
    const updatedItem = {
      ...currentItem,
      ...updates,
      date_modified: new Date().toISOString()
    };

    // Re-sign the updated item
    updatedItem.signature = await this.signItem(updatedItem, privateKey);

    // Update feed
    const updatedFeed = { ...feed };
    updatedFeed.items = [...feed.items];
    updatedFeed.items[itemIndex] = updatedItem;

    return updatedFeed;
  }

  /**
   * Remove an item from the feed
   * @param {object} feed - Feed document
   * @param {string} itemId - ID of item to remove
   * @returns {object} Updated feed
   */
  removeItem(feed, itemId) {
    const updatedFeed = { ...feed };
    updatedFeed.items = feed.items.filter(item => item.id !== itemId);
    return updatedFeed;
  }

  /**
   * Validate the generated feed against the schema
   * @param {object} feed - Feed document to validate
   * @returns {object} Validation result
   */
  validateFeed(feed) {
    return this.validator.validateDocument(feed);
  }

  /**
   * Generate a UUID for content items
   * @returns {string} UUID v4 string
   */
  generateUUID() {
    return uuidv4();
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
    
    // Check if it's a valid ISO 8601 format by comparing with the parsed date's ISO string
    // Allow for slight variations in formatting but ensure it's a valid ISO date
    const isoString = date.toISOString();
    const parsedBack = new Date(isoString);
    if (Math.abs(date.getTime() - parsedBack.getTime()) > 1000) { // Allow 1 second tolerance
      throw new Error(`Date ${fieldName} must be in ISO 8601 format: ${dateString}`);
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
   * Add media attachment to an item with full processing
   * @param {object} item - Content item
   * @param {object} attachmentData - Raw attachment data
   * @param {object} options - Processing options
   * @returns {Promise<object>} Updated item with processed attachment
   */
  async addMediaAttachment(item, attachmentData, options = {}) {
    if (!item.attachments) {
      item.attachments = [];
    }

    const processedAttachment = await this.mediaHandler.processAttachment(attachmentData, options);
    item.attachments.push(processedAttachment);

    return item;
  }
}

export default AnsyblGenerator;