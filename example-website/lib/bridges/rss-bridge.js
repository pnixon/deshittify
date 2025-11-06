/**
 * RSS Bridge for Ansybl Protocol
 * Converts between Ansybl feeds and RSS 2.0 format
 */

import { DOMParser, XMLSerializer } from 'xmldom';

export class RSSBridge {
    constructor() {
        this.parser = new DOMParser();
        this.serializer = new XMLSerializer();
    }

    /**
     * Convert Ansybl feed to RSS 2.0 format
     * @param {Object} ansyblFeed - Complete Ansybl feed document
     * @returns {string} RSS 2.0 XML string
     */
    ansyblToRss(ansyblFeed) {
        try {
            // Create RSS document structure
            const doc = this.parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"></rss>', 'text/xml');
            const rss = doc.documentElement;
            
            // Add RSS namespaces for extended functionality
            rss.setAttribute('xmlns:content', 'http://purl.org/rss/1.0/modules/content/');
            rss.setAttribute('xmlns:dc', 'http://purl.org/dc/elements/1.1/');
            rss.setAttribute('xmlns:atom', 'http://www.w3.org/2005/Atom');
            
            // Create channel element
            const channel = doc.createElement('channel');
            rss.appendChild(channel);
            
            // Add feed metadata
            this._addElement(doc, channel, 'title', ansyblFeed.title);
            this._addElement(doc, channel, 'description', ansyblFeed.description || '');
            this._addElement(doc, channel, 'link', ansyblFeed.home_page_url);
            this._addElement(doc, channel, 'language', ansyblFeed.language || 'en');
            
            // Add self-referencing atom:link
            const atomLink = doc.createElement('atom:link');
            atomLink.setAttribute('href', ansyblFeed.feed_url.replace('.ansybl', '.rss'));
            atomLink.setAttribute('rel', 'self');
            atomLink.setAttribute('type', 'application/rss+xml');
            channel.appendChild(atomLink);
            
            // Add generator
            this._addElement(doc, channel, 'generator', 'Ansybl RSS Bridge');
            
            // Add last build date
            this._addElement(doc, channel, 'lastBuildDate', new Date().toUTCString());
            
            // Add feed icon if available
            if (ansyblFeed.icon) {
                const image = doc.createElement('image');
                this._addElement(doc, image, 'url', ansyblFeed.icon);
                this._addElement(doc, image, 'title', ansyblFeed.title);
                this._addElement(doc, image, 'link', ansyblFeed.home_page_url);
                channel.appendChild(image);
            }
            
            // Add managing editor if author is available
            if (ansyblFeed.author && ansyblFeed.author.name) {
                const email = ansyblFeed.author.url ? `noreply@${new URL(ansyblFeed.author.url).hostname}` : 'noreply@example.com';
                this._addElement(doc, channel, 'managingEditor', `${email} (${ansyblFeed.author.name})`);
            }
            
            // Convert items
            if (ansyblFeed.items && ansyblFeed.items.length > 0) {
                ansyblFeed.items.forEach(item => {
                    const rssItem = this._convertAnsyblItemToRss(doc, item);
                    if (rssItem) {
                        channel.appendChild(rssItem);
                    }
                });
            }
            
            return this.serializer.serializeToString(doc);
            
        } catch (error) {
            throw new Error(`Failed to convert Ansybl to RSS: ${error.message}`);
        }
    }

    /**
     * Convert RSS 2.0 feed to Ansybl format
     * @param {string} rssXml - RSS 2.0 XML string
     * @param {Object} options - Conversion options
     * @returns {Object} Ansybl feed document
     */
    rssToAnsybl(rssXml, options = {}) {
        try {
            const doc = this.parser.parseFromString(rssXml, 'text/xml');
            const channel = doc.getElementsByTagName('channel')[0];
            
            if (!channel) {
                throw new Error('Invalid RSS feed: no channel element found');
            }
            
            // Extract feed metadata
            const ansyblFeed = {
                version: 'https://ansybl.org/version/1.0',
                title: this._getElementText(channel, 'title') || 'Imported RSS Feed',
                description: this._getElementText(channel, 'description') || '',
                home_page_url: this._getElementText(channel, 'link') || options.baseUrl || 'https://example.com',
                feed_url: options.feedUrl || 'https://example.com/feed.ansybl',
                language: this._getElementText(channel, 'language') || 'en',
                items: []
            };
            
            // Add feed icon if available
            const imageUrl = this._getElementText(channel, 'image/url');
            if (imageUrl) {
                ansyblFeed.icon = imageUrl;
            }
            
            // Extract author information
            const managingEditor = this._getElementText(channel, 'managingEditor');
            if (managingEditor) {
                const authorMatch = managingEditor.match(/\(([^)]+)\)/);
                ansyblFeed.author = {
                    name: authorMatch ? authorMatch[1] : 'RSS Author',
                    url: ansyblFeed.home_page_url
                };
            } else {
                ansyblFeed.author = {
                    name: options.authorName || 'RSS Import',
                    url: ansyblFeed.home_page_url
                };
            }
            
            // Convert RSS items to Ansybl items
            const items = channel.getElementsByTagName('item');
            for (let i = 0; i < items.length; i++) {
                const ansyblItem = this._convertRssItemToAnsybl(items[i], ansyblFeed);
                if (ansyblItem) {
                    ansyblFeed.items.push(ansyblItem);
                }
            }
            
            return ansyblFeed;
            
        } catch (error) {
            throw new Error(`Failed to convert RSS to Ansybl: ${error.message}`);
        }
    }

    /**
     * Get feature mapping documentation
     * @returns {Object} Feature mapping information
     */
    getFeatureMapping() {
        return {
            ansyblToRss: {
                supported: [
                    'title', 'description', 'home_page_url', 'feed_url', 'language',
                    'author.name', 'icon', 'items.title', 'items.content_text',
                    'items.content_html', 'items.date_published', 'items.url',
                    'items.tags', 'items.attachments', 'items.summary'
                ],
                limitations: [
                    'Cryptographic signatures are not preserved',
                    'Social interactions (likes, shares) are lost',
                    'Extension fields with underscore prefix are dropped',
                    'Complex content formats may be simplified',
                    'Ansybl-specific metadata is not retained'
                ],
                mappings: {
                    'title': 'channel/title',
                    'description': 'channel/description',
                    'home_page_url': 'channel/link',
                    'feed_url': 'atom:link[@rel="self"]/@href',
                    'language': 'channel/language',
                    'author.name': 'channel/managingEditor',
                    'icon': 'channel/image/url',
                    'items.title': 'item/title',
                    'items.content_html': 'item/description',
                    'items.content_text': 'item/content:encoded',
                    'items.date_published': 'item/pubDate',
                    'items.url': 'item/link',
                    'items.tags': 'item/category',
                    'items.summary': 'item/description (truncated)'
                }
            },
            rssToAnsybl: {
                supported: [
                    'channel/title', 'channel/description', 'channel/link',
                    'channel/language', 'channel/managingEditor', 'channel/image',
                    'item/title', 'item/description', 'item/content:encoded',
                    'item/pubDate', 'item/link', 'item/category', 'item/guid'
                ],
                limitations: [
                    'No cryptographic signatures can be generated without private keys',
                    'Social interaction data is not available in RSS',
                    'UUIDs are generated if not present in RSS',
                    'Author information may be incomplete',
                    'Media attachments require additional processing'
                ],
                mappings: {
                    'channel/title': 'title',
                    'channel/description': 'description',
                    'channel/link': 'home_page_url',
                    'channel/language': 'language',
                    'channel/managingEditor': 'author.name',
                    'channel/image/url': 'icon',
                    'item/title': 'items.title',
                    'item/description': 'items.content_html',
                    'item/content:encoded': 'items.content_text',
                    'item/pubDate': 'items.date_published',
                    'item/link': 'items.url',
                    'item/category': 'items.tags',
                    'item/guid': 'items.id'
                }
            }
        };
    }

    /**
     * Convert Ansybl item to RSS item element
     * @private
     */
    _convertAnsyblItemToRss(doc, item) {
        const rssItem = doc.createElement('item');
        
        // Required elements
        this._addElement(doc, rssItem, 'title', item.title || 'Untitled');
        this._addElement(doc, rssItem, 'link', item.url || item.id);
        this._addElement(doc, rssItem, 'guid', item.id);
        
        // Description (use summary if available, otherwise truncated content)
        let description = item.summary;
        if (!description && item.content_html) {
            description = this._truncateHtml(item.content_html, 200);
        } else if (!description && item.content_text) {
            description = this._truncateText(item.content_text, 200);
        }
        this._addElement(doc, rssItem, 'description', description || '');
        
        // Full content if available
        if (item.content_html) {
            this._addElement(doc, rssItem, 'content:encoded', item.content_html);
        } else if (item.content_text) {
            this._addElement(doc, rssItem, 'content:encoded', this._textToHtml(item.content_text));
        }
        
        // Publication date
        if (item.date_published) {
            const pubDate = new Date(item.date_published).toUTCString();
            this._addElement(doc, rssItem, 'pubDate', pubDate);
        }
        
        // Author
        if (item.author && item.author.name) {
            const email = item.author.url ? `noreply@${new URL(item.author.url).hostname}` : 'noreply@example.com';
            this._addElement(doc, rssItem, 'dc:creator', item.author.name);
            this._addElement(doc, rssItem, 'author', `${email} (${item.author.name})`);
        }
        
        // Categories (tags)
        if (item.tags && item.tags.length > 0) {
            item.tags.forEach(tag => {
                this._addElement(doc, rssItem, 'category', tag);
            });
        }
        
        // Enclosures for media attachments
        if (item.attachments && item.attachments.length > 0) {
            item.attachments.forEach(attachment => {
                if (attachment.mime_type && attachment.size_in_bytes) {
                    const enclosure = doc.createElement('enclosure');
                    enclosure.setAttribute('url', attachment.url);
                    enclosure.setAttribute('type', attachment.mime_type);
                    enclosure.setAttribute('length', attachment.size_in_bytes.toString());
                    rssItem.appendChild(enclosure);
                }
            });
        }
        
        return rssItem;
    }

    /**
     * Convert RSS item to Ansybl item
     * @private
     */
    _convertRssItemToAnsybl(rssItem, feedMetadata) {
        const item = {
            id: this._getElementText(rssItem, 'guid') || this._getElementText(rssItem, 'link') || `item-${Date.now()}`,
            title: this._getElementText(rssItem, 'title') || 'Untitled',
            url: this._getElementText(rssItem, 'link') || this._getElementText(rssItem, 'guid')
        };
        
        // Content
        const contentEncoded = this._getElementText(rssItem, 'content:encoded');
        const description = this._getElementText(rssItem, 'description');
        
        if (contentEncoded) {
            item.content_html = contentEncoded;
            if (description && description !== contentEncoded) {
                item.summary = description;
            }
        } else if (description) {
            item.content_html = description;
        }
        
        // Convert HTML to text if needed
        if (item.content_html && !item.content_text) {
            item.content_text = this._htmlToText(item.content_html);
        }
        
        // Publication date
        const pubDate = this._getElementText(rssItem, 'pubDate');
        if (pubDate) {
            try {
                item.date_published = new Date(pubDate).toISOString();
            } catch (e) {
                // Invalid date, use current time
                item.date_published = new Date().toISOString();
            }
        } else {
            item.date_published = new Date().toISOString();
        }
        
        // Author
        const creator = this._getElementText(rssItem, 'dc:creator') || this._getElementText(rssItem, 'author');
        if (creator) {
            const authorMatch = creator.match(/\(([^)]+)\)/);
            item.author = {
                name: authorMatch ? authorMatch[1] : creator,
                url: feedMetadata.home_page_url
            };
        } else {
            item.author = feedMetadata.author;
        }
        
        // Tags from categories
        const categories = rssItem.getElementsByTagName('category');
        if (categories.length > 0) {
            item.tags = [];
            for (let i = 0; i < categories.length; i++) {
                const category = categories[i].textContent || categories[i].nodeValue;
                if (category) {
                    item.tags.push(category.trim());
                }
            }
        }
        
        // Attachments from enclosures
        const enclosures = rssItem.getElementsByTagName('enclosure');
        if (enclosures.length > 0) {
            item.attachments = [];
            for (let i = 0; i < enclosures.length; i++) {
                const enclosure = enclosures[i];
                const attachment = {
                    url: enclosure.getAttribute('url'),
                    mime_type: enclosure.getAttribute('type'),
                    size_in_bytes: parseInt(enclosure.getAttribute('length')) || 0
                };
                
                // Extract filename from URL
                try {
                    const url = new URL(attachment.url);
                    attachment.title = url.pathname.split('/').pop() || 'attachment';
                } catch (e) {
                    attachment.title = 'attachment';
                }
                
                item.attachments.push(attachment);
            }
        }
        
        return item;
    }

    /**
     * Helper methods
     * @private
     */
    _addElement(doc, parent, tagName, textContent) {
        if (textContent !== undefined && textContent !== null && textContent !== '') {
            const element = doc.createElement(tagName);
            element.appendChild(doc.createTextNode(textContent.toString()));
            parent.appendChild(element);
        }
    }

    _getElementText(parent, tagName) {
        const elements = parent.getElementsByTagName(tagName);
        if (elements.length > 0) {
            return elements[0].textContent || elements[0].nodeValue || '';
        }
        return null;
    }

    _truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    _truncateHtml(html, maxLength) {
        // Simple HTML truncation - remove tags and truncate
        const text = html.replace(/<[^>]*>/g, '');
        return this._truncateText(text, maxLength);
    }

    _textToHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    _htmlToText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
}

export default RSSBridge;