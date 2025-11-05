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
}

export default AnsyblGenerator;