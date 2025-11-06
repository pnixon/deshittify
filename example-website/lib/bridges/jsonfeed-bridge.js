/**
 * JSON Feed Bridge for Ansybl Protocol
 * Converts between Ansybl feeds and JSON Feed 1.1 format
 */

export class JSONFeedBridge {
    constructor() {
        this.jsonFeedVersion = 'https://jsonfeed.org/version/1.1';
    }

    /**
     * Convert Ansybl feed to JSON Feed format
     * @param {Object} ansyblFeed - Complete Ansybl feed document
     * @returns {Object} JSON Feed document
     */
    ansyblToJsonFeed(ansyblFeed) {
        try {
            const jsonFeed = {
                version: this.jsonFeedVersion,
                title: ansyblFeed.title,
                home_page_url: ansyblFeed.home_page_url,
                feed_url: ansyblFeed.feed_url.replace('.ansybl', '.json'),
                description: ansyblFeed.description || '',
                items: []
            };

            // Add optional feed metadata
            if (ansyblFeed.icon) {
                jsonFeed.icon = ansyblFeed.icon;
            }

            if (ansyblFeed.favicon) {
                jsonFeed.favicon = ansyblFeed.favicon;
            }

            if (ansyblFeed.language) {
                jsonFeed.language = ansyblFeed.language;
            }

            // Add author information
            if (ansyblFeed.author) {
                jsonFeed.author = this._convertAnsyblAuthor(ansyblFeed.author);
            }

            // Add Ansybl-specific extensions
            jsonFeed._ansybl = {
                version: ansyblFeed.version,
                signature: ansyblFeed.signature,
                public_key: ansyblFeed.author?.public_key
            };

            // Convert items
            if (ansyblFeed.items && ansyblFeed.items.length > 0) {
                jsonFeed.items = ansyblFeed.items.map(item => this._convertAnsyblItemToJsonFeed(item));
            }

            return jsonFeed;

        } catch (error) {
            throw new Error(`Failed to convert Ansybl to JSON Feed: ${error.message}`);
        }
    }

    /**
     * Convert JSON Feed to Ansybl format
     * @param {Object} jsonFeed - JSON Feed document
     * @param {Object} options - Conversion options
     * @returns {Object} Ansybl feed document
     */
    jsonFeedToAnsybl(jsonFeed, options = {}) {
        try {
            const ansyblFeed = {
                version: 'https://ansybl.org/version/1.0',
                title: jsonFeed.title,
                description: jsonFeed.description || '',
                home_page_url: jsonFeed.home_page_url,
                feed_url: options.feedUrl || jsonFeed.feed_url?.replace('.json', '.ansybl') || 'https://example.com/feed.ansybl',
                items: []
            };

            // Add optional metadata
            if (jsonFeed.icon) {
                ansyblFeed.icon = jsonFeed.icon;
            }

            if (jsonFeed.language) {
                ansyblFeed.language = jsonFeed.language;
            }

            // Add author information
            if (jsonFeed.author) {
                ansyblFeed.author = this._convertJsonFeedAuthor(jsonFeed.author);
            } else {
                ansyblFeed.author = {
                    name: options.authorName || 'JSON Feed Import',
                    url: ansyblFeed.home_page_url
                };
            }

            // Restore Ansybl-specific data if available
            if (jsonFeed._ansybl) {
                if (jsonFeed._ansybl.public_key) {
                    ansyblFeed.author.public_key = jsonFeed._ansybl.public_key;
                }
                if (jsonFeed._ansybl.signature) {
                    ansyblFeed.signature = jsonFeed._ansybl.signature;
                }
            }

            // Convert items
            if (jsonFeed.items && jsonFeed.items.length > 0) {
                ansyblFeed.items = jsonFeed.items.map(item => this._convertJsonFeedItemToAnsybl(item, ansyblFeed));
            }

            return ansyblFeed;

        } catch (error) {
            throw new Error(`Failed to convert JSON Feed to Ansybl: ${error.message}`);
        }
    }

    /**
     * Validate JSON Feed document
     * @param {Object} jsonFeed - JSON Feed document to validate
     * @returns {Object} Validation result
     */
    validateJsonFeed(jsonFeed) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!jsonFeed.version) {
            errors.push('Missing required field: version');
        } else if (jsonFeed.version !== this.jsonFeedVersion && !jsonFeed.version.startsWith('https://jsonfeed.org/version/1')) {
            warnings.push(`Unsupported JSON Feed version: ${jsonFeed.version}`);
        }

        if (!jsonFeed.title) {
            errors.push('Missing required field: title');
        }

        if (!jsonFeed.items) {
            errors.push('Missing required field: items');
        } else if (!Array.isArray(jsonFeed.items)) {
            errors.push('Field "items" must be an array');
        }

        // Validate items
        if (jsonFeed.items && Array.isArray(jsonFeed.items)) {
            jsonFeed.items.forEach((item, index) => {
                if (!item.id) {
                    errors.push(`Item ${index}: Missing required field "id"`);
                }
                if (!item.content_html && !item.content_text) {
                    errors.push(`Item ${index}: Must have either "content_html" or "content_text"`);
                }
            });
        }

        // Validate URLs
        const urlFields = ['home_page_url', 'feed_url', 'icon', 'favicon'];
        urlFields.forEach(field => {
            if (jsonFeed[field] && !this._isValidUrl(jsonFeed[field])) {
                warnings.push(`Invalid URL in field "${field}": ${jsonFeed[field]}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get feature mapping documentation
     * @returns {Object} Feature mapping information
     */
    getFeatureMapping() {
        return {
            ansyblToJsonFeed: {
                supported: [
                    'title', 'description', 'home_page_url', 'feed_url', 'icon', 'language',
                    'author information', 'items.title', 'items.content_text', 'items.content_html',
                    'items.date_published', 'items.date_modified', 'items.url', 'items.id',
                    'items.tags', 'items.attachments', 'items.summary', 'items.author'
                ],
                limitations: [
                    'Cryptographic signatures stored in extension field',
                    'Social interactions not natively supported in JSON Feed',
                    'Ansybl-specific metadata stored in _ansybl extension',
                    'Some Ansybl features may not have JSON Feed equivalents'
                ],
                mappings: {
                    'title': 'title',
                    'description': 'description',
                    'home_page_url': 'home_page_url',
                    'feed_url': 'feed_url',
                    'icon': 'icon',
                    'language': 'language',
                    'author': 'author',
                    'items.title': 'items.title',
                    'items.content_text': 'items.content_text',
                    'items.content_html': 'items.content_html',
                    'items.date_published': 'items.date_published',
                    'items.date_modified': 'items.date_modified',
                    'items.url': 'items.url',
                    'items.id': 'items.id',
                    'items.tags': 'items.tags',
                    'items.attachments': 'items.attachments',
                    'items.summary': 'items.summary',
                    'signature': '_ansybl.signature',
                    'public_key': '_ansybl.public_key'
                }
            },
            jsonFeedToAnsybl: {
                supported: [
                    'title', 'description', 'home_page_url', 'feed_url', 'icon', 'language',
                    'author information', 'items.title', 'items.content_text', 'items.content_html',
                    'items.date_published', 'items.date_modified', 'items.url', 'items.id',
                    'items.tags', 'items.attachments', 'items.summary', 'items.author'
                ],
                limitations: [
                    'Cannot generate Ansybl signatures without private keys',
                    'JSON Feed extensions may be lost if not Ansybl-specific',
                    'Some JSON Feed features may not map to Ansybl',
                    'UUIDs generated if not present in original'
                ],
                mappings: {
                    'title': 'title',
                    'description': 'description',
                    'home_page_url': 'home_page_url',
                    'feed_url': 'feed_url',
                    'icon': 'icon',
                    'language': 'language',
                    'author': 'author',
                    'items.title': 'items.title',
                    'items.content_text': 'items.content_text',
                    'items.content_html': 'items.content_html',
                    'items.date_published': 'items.date_published',
                    'items.date_modified': 'items.date_modified',
                    'items.url': 'items.url',
                    'items.id': 'items.id',
                    'items.tags': 'items.tags',
                    'items.attachments': 'items.attachments',
                    'items.summary': 'items.summary',
                    '_ansybl.signature': 'signature',
                    '_ansybl.public_key': 'author.public_key'
                }
            }
        };
    }

    /**
     * Private helper methods
     */
    _convertAnsyblItemToJsonFeed(ansyblItem) {
        const jsonItem = {
            id: ansyblItem.id,
            url: ansyblItem.url || ansyblItem.id,
            title: ansyblItem.title,
            date_published: ansyblItem.date_published
        };

        // Add content
        if (ansyblItem.content_html) {
            jsonItem.content_html = ansyblItem.content_html;
        }
        if (ansyblItem.content_text) {
            jsonItem.content_text = ansyblItem.content_text;
        }

        // Add optional fields
        if (ansyblItem.summary) {
            jsonItem.summary = ansyblItem.summary;
        }

        if (ansyblItem.date_modified) {
            jsonItem.date_modified = ansyblItem.date_modified;
        }

        if (ansyblItem.author) {
            jsonItem.author = this._convertAnsyblAuthor(ansyblItem.author);
        }

        if (ansyblItem.tags && ansyblItem.tags.length > 0) {
            jsonItem.tags = [...ansyblItem.tags];
        }

        // Convert attachments
        if (ansyblItem.attachments && ansyblItem.attachments.length > 0) {
            jsonItem.attachments = ansyblItem.attachments.map(attachment => ({
                url: attachment.url,
                mime_type: attachment.mime_type,
                title: attachment.title,
                size_in_bytes: attachment.size_in_bytes,
                duration_in_seconds: attachment.duration_in_seconds
            }));
        }

        // Add Ansybl-specific extensions
        jsonItem._ansybl = {};
        
        if (ansyblItem.uuid) {
            jsonItem._ansybl.uuid = ansyblItem.uuid;
        }

        if (ansyblItem.signature) {
            jsonItem._ansybl.signature = ansyblItem.signature;
        }

        if (ansyblItem.in_reply_to) {
            jsonItem._ansybl.in_reply_to = ansyblItem.in_reply_to;
        }

        if (ansyblItem.interactions) {
            jsonItem._ansybl.interactions = ansyblItem.interactions;
        }

        // Clean up empty _ansybl object
        if (Object.keys(jsonItem._ansybl).length === 0) {
            delete jsonItem._ansybl;
        }

        return jsonItem;
    }

    _convertJsonFeedItemToAnsybl(jsonItem, feedMetadata) {
        const ansyblItem = {
            id: jsonItem.id,
            title: jsonItem.title,
            date_published: jsonItem.date_published || new Date().toISOString()
        };

        // Add URL
        if (jsonItem.url) {
            ansyblItem.url = jsonItem.url;
        }

        // Add content
        if (jsonItem.content_html) {
            ansyblItem.content_html = jsonItem.content_html;
        }
        if (jsonItem.content_text) {
            ansyblItem.content_text = jsonItem.content_text;
        }

        // Convert HTML to text if only HTML is available
        if (ansyblItem.content_html && !ansyblItem.content_text) {
            ansyblItem.content_text = this._htmlToText(ansyblItem.content_html);
        }

        // Add optional fields
        if (jsonItem.summary) {
            ansyblItem.summary = jsonItem.summary;
        }

        if (jsonItem.date_modified) {
            ansyblItem.date_modified = jsonItem.date_modified;
        }

        // Add author
        if (jsonItem.author) {
            ansyblItem.author = this._convertJsonFeedAuthor(jsonItem.author);
        } else {
            ansyblItem.author = feedMetadata.author;
        }

        // Add tags
        if (jsonItem.tags && jsonItem.tags.length > 0) {
            ansyblItem.tags = [...jsonItem.tags];
        }

        // Convert attachments
        if (jsonItem.attachments && jsonItem.attachments.length > 0) {
            ansyblItem.attachments = jsonItem.attachments.map(attachment => ({
                url: attachment.url,
                mime_type: attachment.mime_type,
                title: attachment.title,
                size_in_bytes: attachment.size_in_bytes,
                duration_in_seconds: attachment.duration_in_seconds
            }));
        }

        // Restore Ansybl-specific data
        if (jsonItem._ansybl) {
            if (jsonItem._ansybl.uuid) {
                ansyblItem.uuid = jsonItem._ansybl.uuid;
            }

            if (jsonItem._ansybl.signature) {
                ansyblItem.signature = jsonItem._ansybl.signature;
            }

            if (jsonItem._ansybl.in_reply_to) {
                ansyblItem.in_reply_to = jsonItem._ansybl.in_reply_to;
            }

            if (jsonItem._ansybl.interactions) {
                ansyblItem.interactions = jsonItem._ansybl.interactions;
            }
        }

        return ansyblItem;
    }

    _convertAnsyblAuthor(ansyblAuthor) {
        const jsonAuthor = {
            name: ansyblAuthor.name
        };

        if (ansyblAuthor.url) {
            jsonAuthor.url = ansyblAuthor.url;
        }

        if (ansyblAuthor.avatar) {
            jsonAuthor.avatar = ansyblAuthor.avatar;
        }

        return jsonAuthor;
    }

    _convertJsonFeedAuthor(jsonAuthor) {
        const ansyblAuthor = {
            name: jsonAuthor.name
        };

        if (jsonAuthor.url) {
            ansyblAuthor.url = jsonAuthor.url;
        }

        if (jsonAuthor.avatar) {
            ansyblAuthor.avatar = jsonAuthor.avatar;
        }

        return ansyblAuthor;
    }

    _isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }

    _htmlToText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }
}

export default JSONFeedBridge;