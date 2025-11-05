/**
 * RSS/JSON Feed Compatibility Layer
 * Bidirectional converter between Ansybl and RSS/JSON Feed formats
 * Preserves social features where possible and provides maximum compatibility
 */

import { AnsyblParser } from '../parser.js';
import { AnsyblGenerator } from '../generator.js';

/**
 * RSS and JSON Feed Bridge Service
 */
export class RssJsonBridge {
  constructor(options = {}) {
    this.parser = new AnsyblParser();
    this.generator = new AnsyblGenerator();
    
    this.config = {
      preserveExtensions: options.preserveExtensions !== false,
      includeAnsyblMetadata: options.includeAnsyblMetadata !== false,
      maxDescriptionLength: options.maxDescriptionLength || 500,
      defaultLanguage: options.defaultLanguage || 'en',
      ...options
    };
  }

  /**
   * Convert Ansybl feed to RSS 2.0 format
   * @param {object} ansyblFeed - Parsed Ansybl feed
   * @param {object} options - Conversion options
   * @returns {string} RSS XML string
   */
  convertToRss(ansyblFeed, options = {}) {
    const {
      includeContent = true,
      includeEnclosures = true,
      includeCategories = true,
      includeAnsyblExtensions = this.config.includeAnsyblMetadata
    } = options;

    // Build RSS channel
    const channel = {
      title: this._escapeXml(ansyblFeed.title),
      link: ansyblFeed.home_page_url,
      description: this._escapeXml(ansyblFeed.description || `Feed from ${ansyblFeed.author.name}`),
      language: ansyblFeed.language || this.config.defaultLanguage,
      lastBuildDate: this._formatRssDate(new Date()),
      generator: 'Ansybl RSS Bridge',
      webMaster: `${ansyblFeed.author.name} (${ansyblFeed.author.url || ansyblFeed.home_page_url})`,
      managingEditor: `${ansyblFeed.author.name} (${ansyblFeed.author.url || ansyblFeed.home_page_url})`,
      ttl: 60, // 1 hour cache
      image: ansyblFeed.icon ? {
        url: ansyblFeed.icon,
        title: ansyblFeed.title,
        link: ansyblFeed.home_page_url,
        width: 144,
        height: 144
      } : null
    };

    // Add Ansybl-specific namespaces and metadata if enabled
    const namespaces = [
      'xmlns:content="http://purl.org/rss/1.0/modules/content/"',
      'xmlns:dc="http://purl.org/dc/elements/1.1/"',
      'xmlns:atom="http://www.w3.org/2005/Atom"'
    ];

    if (includeAnsyblExtensions) {
      namespaces.push('xmlns:ansybl="https://ansybl.org/ns#"');
    }

    // Build RSS items
    const items = ansyblFeed.items.map(item => this._convertItemToRss(item, {
      includeContent,
      includeEnclosures,
      includeCategories,
      includeAnsyblExtensions,
      feedAuthor: ansyblFeed.author
    }));

    // Generate RSS XML
    return this._generateRssXml(channel, items, namespaces);
  }

  /**
   * Convert Ansybl feed to JSON Feed format
   * @param {object} ansyblFeed - Parsed Ansybl feed
   * @param {object} options - Conversion options
   * @returns {object} JSON Feed object
   */
  convertToJsonFeed(ansyblFeed, options = {}) {
    const {
      includeAnsyblExtensions = this.config.includeAnsyblMetadata,
      version = 'https://jsonfeed.org/version/1.1'
    } = options;

    const jsonFeed = {
      version: version,
      title: ansyblFeed.title,
      home_page_url: ansyblFeed.home_page_url,
      feed_url: ansyblFeed.feed_url,
      description: ansyblFeed.description,
      icon: ansyblFeed.icon,
      language: ansyblFeed.language,
      
      // Author information
      authors: [{
        name: ansyblFeed.author.name,
        url: ansyblFeed.author.url,
        avatar: ansyblFeed.author.avatar
      }],

      // Convert items
      items: ansyblFeed.items.map(item => this._convertItemToJsonFeed(item, {
        includeAnsyblExtensions,
        feedAuthor: ansyblFeed.author
      }))
    };

    // Add Ansybl-specific extensions if enabled
    if (includeAnsyblExtensions) {
      jsonFeed._ansybl = {
        version: ansyblFeed.version,
        author_public_key: ansyblFeed.author.public_key,
        feed_signature: ansyblFeed.signature,
        bridge_version: '1.0.0',
        converted_at: new Date().toISOString()
      };
    }

    return jsonFeed;
  }

  /**
   * Convert RSS feed to Ansybl format
   * @param {string} rssXml - RSS XML string
   * @param {object} conversionOptions - Conversion options
   * @returns {Promise<object>} Ansybl feed object
   */
  async convertFromRss(rssXml, conversionOptions = {}) {
    const {
      generateSignatures = false,
      privateKey = null,
      preserveOriginalIds = true,
      defaultAuthor = null
    } = conversionOptions;

    // Parse RSS XML (simplified parser - in production use a proper XML parser)
    const rssData = this._parseRssXml(rssXml);
    
    // Extract feed metadata
    const feedMetadata = {
      title: rssData.channel.title,
      home_page_url: rssData.channel.link,
      feed_url: rssData.channel.link + '/feed.rss', // Estimate feed URL
      description: rssData.channel.description,
      language: rssData.channel.language,
      author: defaultAuthor || {
        name: rssData.channel.managingEditor || rssData.channel.webMaster || 'RSS Author',
        public_key: 'ed25519:' + Buffer.from('placeholder-key').toString('base64'),
        url: rssData.channel.link
      }
    };

    // Create base feed
    let ansyblFeed = this.generator.createFeed(feedMetadata);

    // Convert RSS items to Ansybl items
    for (const rssItem of rssData.items) {
      const itemData = {
        id: preserveOriginalIds ? (rssItem.guid || rssItem.link) : rssItem.link,
        url: rssItem.link,
        title: rssItem.title,
        content_html: rssItem.description || rssItem['content:encoded'],
        summary: rssItem.description && rssItem['content:encoded'] ? 
          this._truncateText(rssItem.description, this.config.maxDescriptionLength) : undefined,
        date_published: rssItem.pubDate ? new Date(rssItem.pubDate).toISOString() : new Date().toISOString(),
        tags: rssItem.category ? (Array.isArray(rssItem.category) ? rssItem.category : [rssItem.category]) : undefined,
        
        // Convert enclosures to attachments
        attachments: rssItem.enclosure ? [{
          url: rssItem.enclosure.url,
          mime_type: rssItem.enclosure.type,
          size_in_bytes: parseInt(rssItem.enclosure.length) || undefined
        }] : undefined
      };

      if (generateSignatures && privateKey) {
        ansyblFeed = await this.generator.addItem(ansyblFeed, itemData, privateKey);
      } else {
        // Add item without signature
        const item = { ...itemData, signature: 'rss-converted:no-signature' };
        ansyblFeed.items.push(item);
      }
    }

    return ansyblFeed;
  }

  /**
   * Convert JSON Feed to Ansybl format
   * @param {object} jsonFeed - JSON Feed object
   * @param {object} conversionOptions - Conversion options
   * @returns {Promise<object>} Ansybl feed object
   */
  async convertFromJsonFeed(jsonFeed, conversionOptions = {}) {
    const {
      generateSignatures = false,
      privateKey = null,
      preserveOriginalIds = true
    } = conversionOptions;

    // Extract author information
    const author = jsonFeed.authors && jsonFeed.authors[0] ? {
      name: jsonFeed.authors[0].name,
      url: jsonFeed.authors[0].url,
      avatar: jsonFeed.authors[0].avatar,
      public_key: jsonFeed._ansybl?.author_public_key || 
        'ed25519:' + Buffer.from('json-feed-converted').toString('base64')
    } : {
      name: 'JSON Feed Author',
      public_key: 'ed25519:' + Buffer.from('json-feed-converted').toString('base64')
    };

    // Create feed metadata
    const feedMetadata = {
      title: jsonFeed.title,
      home_page_url: jsonFeed.home_page_url,
      feed_url: jsonFeed.feed_url,
      description: jsonFeed.description,
      language: jsonFeed.language,
      icon: jsonFeed.icon,
      author: author,
      version: jsonFeed._ansybl?.version || 'https://ansybl.org/version/1.0'
    };

    // Create base feed
    let ansyblFeed = this.generator.createFeed(feedMetadata);

    // Convert JSON Feed items to Ansybl items
    for (const jsonItem of jsonFeed.items) {
      const itemData = {
        id: preserveOriginalIds ? jsonItem.id : jsonItem.url,
        url: jsonItem.url,
        uuid: jsonItem.id !== jsonItem.url ? jsonItem.id : undefined,
        title: jsonItem.title,
        content_html: jsonItem.content_html,
        content_text: jsonItem.content_text,
        summary: jsonItem.summary,
        date_published: jsonItem.date_published,
        date_modified: jsonItem.date_modified,
        tags: jsonItem.tags,
        
        // Convert JSON Feed attachments
        attachments: jsonItem.attachments ? jsonItem.attachments.map(att => ({
          url: att.url,
          mime_type: att.mime_type,
          title: att.title,
          size_in_bytes: att.size_in_bytes,
          duration_in_seconds: att.duration_in_seconds
        })) : undefined,

        // Handle author override
        author: jsonItem.authors && jsonItem.authors[0] ? {
          name: jsonItem.authors[0].name,
          url: jsonItem.authors[0].url,
          avatar: jsonItem.authors[0].avatar,
          public_key: author.public_key // Use feed author's key
        } : undefined
      };

      if (generateSignatures && privateKey) {
        ansyblFeed = await this.generator.addItem(ansyblFeed, itemData, privateKey);
      } else {
        // Add item without signature
        const item = { ...itemData, signature: 'json-feed-converted:no-signature' };
        ansyblFeed.items.push(item);
      }
    }

    return ansyblFeed;
  }

  /**
   * Convert Ansybl item to RSS item format
   * @private
   */
  _convertItemToRss(item, options) {
    const {
      includeContent,
      includeEnclosures,
      includeCategories,
      includeAnsyblExtensions,
      feedAuthor
    } = options;

    const rssItem = {
      title: this._escapeXml(item.title || 'Untitled'),
      link: item.url,
      guid: { _text: item.id, isPermaLink: false },
      pubDate: this._formatRssDate(new Date(item.date_published)),
      description: this._escapeXml(this._createRssDescription(item))
    };

    // Add content if available and requested
    if (includeContent && item.content_html) {
      rssItem['content:encoded'] = `<![CDATA[${item.content_html}]]>`;
    }

    // Add author information
    const itemAuthor = item.author || feedAuthor;
    if (itemAuthor.name) {
      rssItem['dc:creator'] = this._escapeXml(itemAuthor.name);
    }

    // Add categories/tags
    if (includeCategories && item.tags && item.tags.length > 0) {
      rssItem.category = item.tags.map(tag => this._escapeXml(tag));
    }

    // Add enclosures for media attachments
    if (includeEnclosures && item.attachments && item.attachments.length > 0) {
      const mediaAttachment = item.attachments.find(att => 
        att.mime_type.startsWith('audio/') || 
        att.mime_type.startsWith('video/') ||
        att.mime_type.startsWith('image/')
      );
      
      if (mediaAttachment) {
        rssItem.enclosure = {
          url: mediaAttachment.url,
          type: mediaAttachment.mime_type,
          length: mediaAttachment.size_in_bytes || 0
        };
      }
    }

    // Add Ansybl-specific extensions
    if (includeAnsyblExtensions) {
      rssItem['ansybl:signature'] = item.signature;
      rssItem['ansybl:id'] = item.id;
      
      if (item.interactions) {
        rssItem['ansybl:replies'] = item.interactions.replies_count || 0;
        rssItem['ansybl:likes'] = item.interactions.likes_count || 0;
        rssItem['ansybl:shares'] = item.interactions.shares_count || 0;
      }
      
      if (item.in_reply_to) {
        rssItem['ansybl:inReplyTo'] = item.in_reply_to;
      }
    }

    return rssItem;
  }

  /**
   * Convert Ansybl item to JSON Feed item format
   * @private
   */
  _convertItemToJsonFeed(item, options) {
    const { includeAnsyblExtensions, feedAuthor } = options;

    const jsonItem = {
      id: item.id,
      url: item.url,
      title: item.title,
      content_html: item.content_html,
      content_text: item.content_text,
      summary: item.summary,
      date_published: item.date_published,
      date_modified: item.date_modified,
      tags: item.tags
    };

    // Add author if different from feed author
    const itemAuthor = item.author || feedAuthor;
    if (itemAuthor && (itemAuthor.name !== feedAuthor.name || itemAuthor.url !== feedAuthor.url)) {
      jsonItem.authors = [{
        name: itemAuthor.name,
        url: itemAuthor.url,
        avatar: itemAuthor.avatar
      }];
    }

    // Add attachments
    if (item.attachments && item.attachments.length > 0) {
      jsonItem.attachments = item.attachments.map(att => ({
        url: att.url,
        mime_type: att.mime_type,
        title: att.title,
        size_in_bytes: att.size_in_bytes,
        duration_in_seconds: att.duration_in_seconds
      }));
    }

    // Add Ansybl-specific extensions
    if (includeAnsyblExtensions) {
      jsonItem._ansybl = {
        signature: item.signature,
        uuid: item.uuid,
        in_reply_to: item.in_reply_to,
        interactions: item.interactions
      };
    }

    return jsonItem;
  }

  /**
   * Generate RSS XML from channel and items data
   * @private
   */
  _generateRssXml(channel, items, namespaces) {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const rssOpen = `<rss version="2.0" ${namespaces.join(' ')}>`;
    
    let xml = `${xmlHeader}\n${rssOpen}\n<channel>\n`;
    
    // Add channel elements
    xml += `  <title>${channel.title}</title>\n`;
    xml += `  <link>${channel.link}</link>\n`;
    xml += `  <description>${channel.description}</description>\n`;
    xml += `  <language>${channel.language}</language>\n`;
    xml += `  <lastBuildDate>${channel.lastBuildDate}</lastBuildDate>\n`;
    xml += `  <generator>${channel.generator}</generator>\n`;
    xml += `  <webMaster>${channel.webMaster}</webMaster>\n`;
    xml += `  <managingEditor>${channel.managingEditor}</managingEditor>\n`;
    xml += `  <ttl>${channel.ttl}</ttl>\n`;
    
    // Add atom:link for self-reference
    xml += `  <atom:link href="${channel.link}" rel="self" type="application/rss+xml" />\n`;
    
    // Add image if present
    if (channel.image) {
      xml += `  <image>\n`;
      xml += `    <url>${channel.image.url}</url>\n`;
      xml += `    <title>${channel.image.title}</title>\n`;
      xml += `    <link>${channel.image.link}</link>\n`;
      xml += `    <width>${channel.image.width}</width>\n`;
      xml += `    <height>${channel.image.height}</height>\n`;
      xml += `  </image>\n`;
    }
    
    // Add items
    for (const item of items) {
      xml += `  <item>\n`;
      xml += `    <title>${item.title}</title>\n`;
      xml += `    <link>${item.link}</link>\n`;
      xml += `    <guid isPermaLink="${item.guid.isPermaLink}">${item.guid._text}</guid>\n`;
      xml += `    <pubDate>${item.pubDate}</pubDate>\n`;
      xml += `    <description>${item.description}</description>\n`;
      
      if (item['content:encoded']) {
        xml += `    <content:encoded>${item['content:encoded']}</content:encoded>\n`;
      }
      
      if (item['dc:creator']) {
        xml += `    <dc:creator>${item['dc:creator']}</dc:creator>\n`;
      }
      
      if (item.category) {
        if (Array.isArray(item.category)) {
          item.category.forEach(cat => {
            xml += `    <category>${cat}</category>\n`;
          });
        } else {
          xml += `    <category>${item.category}</category>\n`;
        }
      }
      
      if (item.enclosure) {
        xml += `    <enclosure url="${item.enclosure.url}" type="${item.enclosure.type}" length="${item.enclosure.length}" />\n`;
      }
      
      // Add Ansybl extensions
      Object.keys(item).forEach(key => {
        if (key.startsWith('ansybl:')) {
          xml += `    <${key}>${item[key]}</${key}>\n`;
        }
      });
      
      xml += `  </item>\n`;
    }
    
    xml += `</channel>\n</rss>`;
    
    return xml;
  }

  /**
   * Create RSS description from Ansybl item
   * @private
   */
  _createRssDescription(item) {
    if (item.summary) {
      return item.summary;
    }
    
    if (item.content_text) {
      return this._truncateText(item.content_text, this.config.maxDescriptionLength);
    }
    
    if (item.content_html) {
      // Strip HTML tags for description
      const textContent = item.content_html.replace(/<[^>]*>/g, '');
      return this._truncateText(textContent, this.config.maxDescriptionLength);
    }
    
    return item.title || 'No description available';
  }

  /**
   * Parse RSS XML (simplified implementation)
   * @private
   */
  _parseRssXml(xmlString) {
    // This is a very simplified RSS parser
    // In production, use a proper XML parsing library like xml2js
    const rssData = {
      channel: {},
      items: []
    };
    
    // Extract channel information (basic regex parsing)
    const titleMatch = xmlString.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    if (titleMatch) rssData.channel.title = titleMatch[1] || titleMatch[2];
    
    const linkMatch = xmlString.match(/<link>(.*?)<\/link>/);
    if (linkMatch) rssData.channel.link = linkMatch[1];
    
    const descMatch = xmlString.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    if (descMatch) rssData.channel.description = descMatch[1] || descMatch[2];
    
    // Extract items (basic implementation)
    const itemMatches = xmlString.match(/<item>(.*?)<\/item>/gs);
    if (itemMatches) {
      rssData.items = itemMatches.map(itemXml => {
        const item = {};
        
        const itemTitleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        if (itemTitleMatch) item.title = itemTitleMatch[1] || itemTitleMatch[2];
        
        const itemLinkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        if (itemLinkMatch) item.link = itemLinkMatch[1];
        
        const itemDescMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        if (itemDescMatch) item.description = itemDescMatch[1] || itemDescMatch[2];
        
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        if (pubDateMatch) item.pubDate = pubDateMatch[1];
        
        const categoryMatches = itemXml.match(/<category>(.*?)<\/category>/g);
        if (categoryMatches) {
          item.category = categoryMatches.map(match => match.replace(/<\/?category>/g, ''));
        }
        
        return item;
      });
    }
    
    return rssData;
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format date for RSS
   * @private
   */
  _formatRssDate(date) {
    return date.toUTCString();
  }

  /**
   * Truncate text to specified length
   * @private
   */
  _truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

export default RssJsonBridge;