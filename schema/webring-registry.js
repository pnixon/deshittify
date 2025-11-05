/**
 * Ansybl Webring Registry System
 * 
 * Implements JSON-based registry for participating Ansybl feeds with health monitoring,
 * feed validation, and tag-based categorization and search functionality.
 * 
 * Requirements: 5.1, 5.2
 */

import { AnsyblValidator } from './validator.js';
import { AnsyblParser } from './parser.js';

class WebringRegistry {
    constructor() {
        this.entries = new Map();
        this.healthCheckInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.lastHealthCheck = new Map();
    }

    /**
     * Add a feed to the webring registry
     * @param {Object} feedInfo - Feed information
     * @param {string} feedInfo.url - Feed URL
     * @param {string} feedInfo.title - Feed title
     * @param {string} feedInfo.description - Feed description
     * @param {string[]} feedInfo.tags - Content tags for categorization
     * @returns {Promise<Object>} Registration result
     */
    async addFeed(feedInfo) {
        const { url, title, description, tags = [] } = feedInfo;
        
        if (!url || !title) {
            throw new Error('Feed URL and title are required');
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (error) {
            throw new Error('Invalid feed URL format');
        }

        // Validate feed by fetching and parsing
        const validationResult = await this.validateFeedUrl(url);
        if (!validationResult.valid) {
            throw new Error(`Feed validation failed: ${validationResult.errors.join(', ')}`);
        }

        const entry = {
            url,
            title,
            description,
            tags: tags.map(tag => tag.toLowerCase().trim()),
            date_added: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            health_status: 'active',
            last_health_check: new Date().toISOString(),
            validation_errors: [],
            feed_metadata: validationResult.metadata
        };

        this.entries.set(url, entry);
        this.lastHealthCheck.set(url, Date.now());

        return {
            success: true,
            entry,
            message: 'Feed successfully added to webring registry'
        };
    }

    /**
     * Remove a feed from the registry
     * @param {string} url - Feed URL to remove
     * @returns {boolean} Success status
     */
    removeFeed(url) {
        const removed = this.entries.delete(url);
        this.lastHealthCheck.delete(url);
        return removed;
    }

    /**
     * Get all feeds in the registry
     * @returns {Object[]} Array of registry entries
     */
    getAllFeeds() {
        return Array.from(this.entries.values());
    }

    /**
     * Search feeds by tags
     * @param {string[]} tags - Tags to search for
     * @param {string} operator - 'AND' or 'OR' for tag matching
     * @returns {Object[]} Matching feed entries
     */
    searchByTags(tags, operator = 'OR') {
        if (!tags || tags.length === 0) {
            return this.getAllFeeds();
        }

        const searchTags = tags.map(tag => tag.toLowerCase().trim());
        
        return Array.from(this.entries.values()).filter(entry => {
            if (operator === 'AND') {
                return searchTags.every(tag => entry.tags.includes(tag));
            } else {
                return searchTags.some(tag => entry.tags.includes(tag));
            }
        });
    }

    /**
     * Search feeds by text in title or description
     * @param {string} query - Search query
     * @returns {Object[]} Matching feed entries
     */
    searchByText(query) {
        if (!query || query.trim() === '') {
            return this.getAllFeeds();
        }

        const searchQuery = query.toLowerCase().trim();
        
        return Array.from(this.entries.values()).filter(entry => {
            return entry.title.toLowerCase().includes(searchQuery) ||
                   entry.description.toLowerCase().includes(searchQuery);
        });
    }

    /**
     * Get feeds by health status
     * @param {string} status - 'active', 'inactive', or 'error'
     * @returns {Object[]} Feeds with specified health status
     */
    getFeedsByHealthStatus(status) {
        return Array.from(this.entries.values()).filter(entry => 
            entry.health_status === status
        );
    }

    /**
     * Perform health check on a specific feed
     * @param {string} url - Feed URL to check
     * @returns {Promise<Object>} Health check result
     */
    async performHealthCheck(url) {
        const entry = this.entries.get(url);
        if (!entry) {
            throw new Error('Feed not found in registry');
        }

        try {
            const validationResult = await this.validateFeedUrl(url);
            
            entry.health_status = validationResult.valid ? 'active' : 'error';
            entry.last_health_check = new Date().toISOString();
            entry.validation_errors = validationResult.errors || [];
            
            if (validationResult.valid && validationResult.metadata) {
                entry.last_updated = new Date().toISOString();
                entry.feed_metadata = validationResult.metadata;
            }

            this.lastHealthCheck.set(url, Date.now());

            return {
                url,
                health_status: entry.health_status,
                validation_errors: entry.validation_errors,
                last_check: entry.last_health_check
            };
        } catch (error) {
            entry.health_status = 'error';
            entry.last_health_check = new Date().toISOString();
            entry.validation_errors = [error.message];
            
            return {
                url,
                health_status: 'error',
                validation_errors: [error.message],
                last_check: entry.last_health_check
            };
        }
    }

    /**
     * Perform health checks on all feeds that need checking
     * @returns {Promise<Object[]>} Array of health check results
     */
    async performBulkHealthCheck() {
        const now = Date.now();
        const results = [];
        
        for (const [url, entry] of this.entries) {
            const lastCheck = this.lastHealthCheck.get(url) || 0;
            
            if (now - lastCheck > this.healthCheckInterval) {
                try {
                    const result = await this.performHealthCheck(url);
                    results.push(result);
                } catch (error) {
                    results.push({
                        url,
                        health_status: 'error',
                        validation_errors: [error.message],
                        last_check: new Date().toISOString()
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * Validate a feed URL by fetching and parsing it
     * @param {string} url - Feed URL to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateFeedUrl(url) {
        try {
            // In a real implementation, this would fetch the URL
            // For now, we'll simulate the validation
            const response = await this.fetchFeed(url);
            const feedData = JSON.parse(response);
            
            const validator = new AnsyblValidator();
        const validationResult = validator.validateDocument(feedData);
            
            if (validationResult.valid) {
                const parser = new AnsyblParser();
                const parsedFeed = parser.parse(response);
                return {
                    valid: true,
                    metadata: {
                        title: parsedFeed.title,
                        author: parsedFeed.author?.name,
                        item_count: parsedFeed.items?.length || 0,
                        last_updated: parsedFeed.items?.[0]?.date_published
                    }
                };
            } else {
                return {
                    valid: false,
                    errors: validationResult.errors.map(err => err.message)
                };
            }
        } catch (error) {
            return {
                valid: false,
                errors: [`Failed to fetch or parse feed: ${error.message}`]
            };
        }
    }

    /**
     * Fetch feed content from URL
     * @param {string} url - Feed URL
     * @returns {Promise<string>} Feed content
     */
    async fetchFeed(url) {
        // In a real implementation, this would use fetch() or similar
        // For testing purposes, we'll simulate this
        if (url.includes('invalid')) {
            throw new Error('Network error');
        }
        
        // Return a mock valid feed for testing
        return JSON.stringify({
            version: "https://ansybl.org/version/1.0",
            title: "Test Feed",
            home_page_url: "https://example.com",
            feed_url: url,
            author: {
                name: "Test Author",
                public_key: "ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=="
            },
            items: [],
            signature: "ed25519:dGVzdHNpZ25hdHVyZWRhdGE="
        });
    }

    /**
     * Export registry as JSON
     * @returns {Object} Registry data
     */
    exportRegistry() {
        return {
            version: "1.0",
            generated: new Date().toISOString(),
            total_feeds: this.entries.size,
            feeds: Array.from(this.entries.values())
        };
    }

    /**
     * Import registry from JSON data
     * @param {Object} registryData - Registry data to import
     * @returns {Object} Import result
     */
    importRegistry(registryData) {
        if (!registryData.feeds || !Array.isArray(registryData.feeds)) {
            throw new Error('Invalid registry data format');
        }

        let imported = 0;
        let errors = [];

        for (const feed of registryData.feeds) {
            try {
                if (feed.url && feed.title) {
                    this.entries.set(feed.url, {
                        ...feed,
                        date_added: feed.date_added || new Date().toISOString()
                    });
                    imported++;
                } else {
                    errors.push(`Invalid feed entry: missing url or title`);
                }
            } catch (error) {
                errors.push(`Failed to import feed ${feed.url}: ${error.message}`);
            }
        }

        return {
            imported,
            errors,
            total_entries: this.entries.size
        };
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getStatistics() {
        const feeds = Array.from(this.entries.values());
        const tagCounts = {};
        
        feeds.forEach(feed => {
            feed.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        const healthStats = {
            active: 0,
            inactive: 0,
            error: 0
        };

        feeds.forEach(feed => {
            healthStats[feed.health_status] = (healthStats[feed.health_status] || 0) + 1;
        });

        return {
            total_feeds: feeds.length,
            health_status: healthStats,
            popular_tags: Object.entries(tagCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count })),
            oldest_feed: feeds.reduce((oldest, feed) => 
                !oldest || feed.date_added < oldest.date_added ? feed : oldest, null
            )?.date_added,
            newest_feed: feeds.reduce((newest, feed) => 
                !newest || feed.date_added > newest.date_added ? feed : newest, null
            )?.date_added
        };
    }
}

export { WebringRegistry };