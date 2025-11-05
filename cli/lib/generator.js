// cli/lib/generator.js
// Ansybl feed generation utilities

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class AnsyblGenerator {
  constructor() {
    this.version = 'https://ansybl.org/version/1.0';
  }

  // Create a new feed document
  createFeed(options) {
    const {
      title,
      homePageUrl,
      feedUrl,
      description,
      icon,
      language = 'en-US',
      author
    } = options;

    // Validate required fields
    if (!title || !homePageUrl || !feedUrl || !author) {
      throw new Error('Missing required fields: title, homePageUrl, feedUrl, and author are required');
    }

    if (!author.name || !author.public_key) {
      throw new Error('Author must have name and public_key');
    }

    const feed = {
      version: this.version,
      title,
      home_page_url: homePageUrl,
      feed_url: feedUrl,
      author,
      items: []
    };

    // Add optional fields
    if (description) feed.description = description;
    if (icon) feed.icon = icon;
    if (language) feed.language = language;

    return feed;
  }

  // Add item to feed
  addItem(feed, itemOptions) {
    const {
      id,
      url,
      title,
      contentText,
      contentHtml,
      contentMarkdown,
      summary,
      datePublished,
      dateModified,
      author,
      tags,
      attachments,
      inReplyTo
    } = itemOptions;

    // Validate required fields
    if (!id || !url || !datePublished) {
      throw new Error('Missing required item fields: id, url, and datePublished are required');
    }

    if (!contentText && !contentHtml && !contentMarkdown) {
      throw new Error('Item must have at least one content field (contentText, contentHtml, or contentMarkdown)');
    }

    const item = {
      id,
      url,
      date_published: datePublished
    };

    // Add optional fields
    if (title) item.title = title;
    if (contentText) item.content_text = contentText;
    if (contentHtml) item.content_html = contentHtml;
    if (contentMarkdown) item.content_markdown = contentMarkdown;
    if (summary) item.summary = summary;
    if (dateModified) item.date_modified = dateModified;
    if (author) item.author = author;
    if (tags && Array.isArray(tags)) item.tags = tags;
    if (attachments && Array.isArray(attachments)) item.attachments = attachments;
    if (inReplyTo) item.in_reply_to = inReplyTo;

    // Add interaction counts (default to 0)
    item.interactions = {
      replies_count: 0,
      likes_count: 0,
      shares_count: 0
    };

    // Generate UUID if not provided
    if (!item.uuid) {
      item.uuid = this.generateUUID();
    }

    // Add placeholder signature (in real implementation, this would be cryptographically signed)
    item.signature = this.generatePlaceholderSignature(item);

    feed.items.push(item);
    return feed;
  }

  // Generate feed template
  generateTemplate(outputPath) {
    const template = {
      version: this.version,
      title: "My Ansybl Feed",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.ansybl",
      description: "My personal feed using the Ansybl protocol",
      icon: "https://example.com/icon.png",
      language: "en-US",
      author: {
        name: "Your Name",
        url: "https://example.com",
        avatar: "https://example.com/avatar.jpg",
        public_key: "ed25519:REPLACE_WITH_YOUR_PUBLIC_KEY"
      },
      items: [
        {
          id: "https://example.com/posts/2025-11-04-first-post",
          uuid: this.generateUUID(),
          url: "https://example.com/posts/2025-11-04-first-post",
          title: "My First Ansybl Post",
          content_text: "This is my first post using the Ansybl protocol! Edit this template to create your own feed.",
          content_html: "<p>This is my first post using the <strong>Ansybl protocol</strong>! Edit this template to create your own feed.</p>",
          summary: "Introduction to my Ansybl feed",
          date_published: new Date().toISOString(),
          tags: ["ansybl", "first-post"],
          attachments: [],
          interactions: {
            replies_count: 0,
            likes_count: 0,
            shares_count: 0
          },
          signature: "ed25519:REPLACE_WITH_ITEM_SIGNATURE"
        }
      ],
      signature: "ed25519:REPLACE_WITH_FEED_SIGNATURE"
    };

    return template;
  }

  // Save feed to file
  async saveFeed(feed, outputPath, options = {}) {
    const { pretty = true, backup = false } = options;

    // Create backup if requested and file exists
    if (backup && await fs.pathExists(outputPath)) {
      const backupPath = `${outputPath}.backup.${Date.now()}`;
      await fs.copy(outputPath, backupPath);
    }

    // Add feed signature placeholder if not present
    if (!feed.signature) {
      feed.signature = this.generatePlaceholderSignature(feed);
    }

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    // Write file
    const content = pretty 
      ? JSON.stringify(feed, null, 2)
      : JSON.stringify(feed);
    
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }

  // Generate UUID v4
  generateUUID() {
    return crypto.randomUUID();
  }

  // Generate placeholder signature (for template/testing purposes)
  generatePlaceholderSignature(data) {
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('base64');
    return `ed25519:${hash.substring(0, 32)}`;
  }

  // Create attachment object
  createAttachment(options) {
    const {
      url,
      mimeType,
      title,
      sizeInBytes,
      durationInSeconds,
      width,
      height,
      altText,
      blurhash,
      dataUri
    } = options;

    if (!url || !mimeType) {
      throw new Error('Attachment must have url and mimeType');
    }

    const attachment = {
      url,
      mime_type: mimeType
    };

    // Add optional fields
    if (title) attachment.title = title;
    if (sizeInBytes) attachment.size_in_bytes = sizeInBytes;
    if (durationInSeconds) attachment.duration_in_seconds = durationInSeconds;
    if (width) attachment.width = width;
    if (height) attachment.height = height;
    if (altText) attachment.alt_text = altText;
    if (blurhash) attachment.blurhash = blurhash;
    if (dataUri) attachment.data_uri = dataUri;

    return attachment;
  }

  // Batch operations
  async batchAddItems(feed, itemsData) {
    const results = [];
    
    for (const itemData of itemsData) {
      try {
        this.addItem(feed, itemData);
        results.push({ success: true, item: itemData });
      } catch (error) {
        results.push({ success: false, item: itemData, error: error.message });
      }
    }
    
    return results;
  }

  // Update existing item
  updateItem(feed, itemId, updates) {
    const itemIndex = feed.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    // Update fields
    Object.assign(feed.items[itemIndex], updates);
    
    // Update modification date
    feed.items[itemIndex].date_modified = new Date().toISOString();
    
    // Regenerate signature
    feed.items[itemIndex].signature = this.generatePlaceholderSignature(feed.items[itemIndex]);
    
    return feed.items[itemIndex];
  }

  // Remove item
  removeItem(feed, itemId) {
    const itemIndex = feed.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    const removedItem = feed.items.splice(itemIndex, 1)[0];
    return removedItem;
  }
}

module.exports = AnsyblGenerator;