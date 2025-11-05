/**
 * Ansybl Discovery Service
 * 
 * Integrates webring registry, webmention endpoints, and WebFinger
 * to provide comprehensive discovery and networking features.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */

import { WebringRegistry } from './webring-registry.js';
import { WebmentionEndpoint } from './webmention-endpoint.js';
import { WebFingerService } from './webfinger.js';

class DiscoveryService {
    constructor(options = {}) {
        this.webring = new WebringRegistry();
        this.webmention = new WebmentionEndpoint();
        this.webfinger = new WebFingerService();
        
        this.options = {
            enableWebring: options.enableWebring !== false,
            enableWebmention: options.enableWebmention !== false,
            enableWebFinger: options.enableWebFinger !== false,
            ...options
        };

        // Set up webmention callback
        this.webmention.onMentionVerified = (mention) => {
            this.handleVerifiedMention(mention);
        };
    }

    /**
     * Register an Ansybl feed for discovery
     * @param {Object} feedData - Ansybl feed data
     * @param {Object} options - Registration options
     * @returns {Promise<Object>} Registration result
     */
    async registerFeed(feedData, options = {}) {
        const results = {
            webring: null,
            webfinger: null,
            webmention_targets: []
        };

        try {
            // Register with webring if enabled
            if (this.options.enableWebring && feedData.feed_url) {
                const webringInfo = {
                    url: feedData.feed_url,
                    title: feedData.title,
                    description: feedData.description || '',
                    tags: this.extractTagsFromFeed(feedData)
                };
                
                results.webring = await this.webring.addFeed(webringInfo);
            }

            // Register WebFinger resource if enabled
            if (this.options.enableWebFinger && feedData.author) {
                const webfingerResource = this.webfinger.createResourceFromAnsyblAuthor(
                    feedData.author,
                    feedData.feed_url,
                    options
                );
                
                results.webfinger = this.webfinger.registerResource(webfingerResource);
            }

            // Find and send webmentions if enabled
            if (this.options.enableWebmention) {
                const mentions = this.webmention.findMentionsInFeed(feedData);
                
                for (const mention of mentions) {
                    try {
                        const result = await this.webmention.sendWebmention(
                            mention.source,
                            mention.target
                        );
                        results.webmention_targets.push(result);
                    } catch (error) {
                        results.webmention_targets.push({
                            success: false,
                            source: mention.source,
                            target: mention.target,
                            error: error.message
                        });
                    }
                }
            }

            return {
                success: true,
                results,
                message: 'Feed registered for discovery services'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                results
            };
        }
    }

    /**
     * Discover feeds related to a query or tags
     * @param {Object} query - Discovery query
     * @param {string[]} query.tags - Tags to search for
     * @param {string} query.text - Text to search for
     * @param {string} query.resource - WebFinger resource to look up
     * @returns {Promise<Object>} Discovery results
     */
    async discoverFeeds(query = {}) {
        const results = {
            webring_feeds: [],
            webfinger_resource: null,
            related_mentions: []
        };

        try {
            // Search webring if enabled
            if (this.options.enableWebring) {
                if (query.tags && query.tags.length > 0) {
                    results.webring_feeds = this.webring.searchByTags(query.tags);
                } else if (query.text) {
                    results.webring_feeds = this.webring.searchByText(query.text);
                } else {
                    results.webring_feeds = this.webring.getAllFeeds().slice(0, 20);
                }
            }

            // Look up WebFinger resource if enabled
            if (this.options.enableWebFinger && query.resource) {
                results.webfinger_resource = this.webfinger.lookupResource(query.resource);
                
                // If not found locally, try external lookup
                if (!results.webfinger_resource) {
                    results.webfinger_resource = await this.webfinger.queryWebFinger(query.resource);
                }
            }

            // Find related mentions if enabled
            if (this.options.enableWebmention && query.url) {
                results.related_mentions = this.webmention.getMentionsForTarget(query.url);
            }

            return {
                success: true,
                results,
                query
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                results
            };
        }
    }

    /**
     * Handle incoming webmention
     * @param {string} source - Source URL
     * @param {string} target - Target URL
     * @returns {Promise<Object>} Processing result
     */
    async handleWebmention(source, target) {
        if (!this.options.enableWebmention) {
            return {
                success: false,
                error: 'Webmention endpoint is disabled'
            };
        }

        return await this.webmention.receiveWebmention(source, target);
    }

    /**
     * Handle WebFinger request
     * @param {string} resource - Resource to look up
     * @param {string[]} rel - Relations to filter
     * @returns {Object} WebFinger response
     */
    handleWebFingerRequest(resource, rel = []) {
        if (!this.options.enableWebFinger) {
            return {
                status: 404,
                body: {
                    error: 'webfinger_disabled',
                    error_description: 'WebFinger service is disabled'
                }
            };
        }

        return this.webfinger.handleWebFingerRequest(resource, rel);
    }

    /**
     * Get discovery service statistics
     * @returns {Object} Combined statistics
     */
    getStatistics() {
        const stats = {
            services_enabled: {
                webring: this.options.enableWebring,
                webmention: this.options.enableWebmention,
                webfinger: this.options.enableWebFinger
            }
        };

        if (this.options.enableWebring) {
            stats.webring = this.webring.getStatistics();
        }

        if (this.options.enableWebmention) {
            stats.webmention = this.webmention.getStatistics();
        }

        if (this.options.enableWebFinger) {
            stats.webfinger = this.webfinger.getStatistics();
        }

        return stats;
    }

    /**
     * Perform health checks on all discovery services
     * @returns {Promise<Object>} Health check results
     */
    async performHealthCheck() {
        const results = {
            webring: null,
            webmention: null,
            webfinger: null,
            overall_status: 'healthy'
        };

        try {
            // Check webring health
            if (this.options.enableWebring) {
                const webringHealth = await this.webring.performBulkHealthCheck();
                results.webring = {
                    status: 'healthy',
                    feeds_checked: webringHealth.length,
                    errors: webringHealth.filter(r => r.health_status === 'error').length
                };
            }

            // Check webmention service
            if (this.options.enableWebmention) {
                const mentionStats = this.webmention.getStatistics();
                results.webmention = {
                    status: 'healthy',
                    total_mentions: mentionStats.total_mentions,
                    pending_mentions: mentionStats.pending_mentions
                };
            }

            // Check WebFinger service
            if (this.options.enableWebFinger) {
                const webfingerStats = this.webfinger.getStatistics();
                results.webfinger = {
                    status: 'healthy',
                    total_resources: webfingerStats.total_resources,
                    total_aliases: webfingerStats.total_aliases
                };
            }

        } catch (error) {
            results.overall_status = 'error';
            results.error = error.message;
        }

        return results;
    }

    /**
     * Extract tags from feed data for webring categorization
     * @param {Object} feedData - Ansybl feed data
     * @returns {string[]} Extracted tags
     */
    extractTagsFromFeed(feedData) {
        const tags = new Set();

        // Add tags from feed items
        if (feedData.items) {
            feedData.items.forEach(item => {
                if (item.tags) {
                    item.tags.forEach(tag => tags.add(tag.toLowerCase()));
                }
            });
        }

        // Add language as a tag if specified
        if (feedData.language) {
            tags.add(`lang:${feedData.language.toLowerCase()}`);
        }

        // Infer tags from title and description
        const inferredTags = this.inferTagsFromText(
            `${feedData.title} ${feedData.description || ''}`
        );
        inferredTags.forEach(tag => tags.add(tag));

        return Array.from(tags).slice(0, 10); // Limit to 10 tags
    }

    /**
     * Infer tags from text content
     * @param {string} text - Text to analyze
     * @returns {string[]} Inferred tags
     */
    inferTagsFromText(text) {
        const commonTags = [
            'tech', 'technology', 'programming', 'code', 'software',
            'web', 'design', 'art', 'music', 'photography',
            'blog', 'personal', 'news', 'politics', 'science',
            'gaming', 'food', 'travel', 'lifestyle', 'business'
        ];

        const lowerText = text.toLowerCase();
        return commonTags.filter(tag => lowerText.includes(tag));
    }

    /**
     * Handle verified webmention callback
     * @param {Object} mention - Verified mention
     */
    handleVerifiedMention(mention) {
        // This could trigger notifications, update counters, etc.
        console.log(`Discovery service: Webmention verified from ${mention.source}`);
        
        // Could integrate with other services here
        // For example, update interaction counts in webring registry
    }

    /**
     * Export discovery service configuration
     * @returns {Object} Service configuration
     */
    exportConfiguration() {
        return {
            version: '1.0',
            services: this.options,
            webring_registry: this.options.enableWebring ? this.webring.exportRegistry() : null,
            webfinger_resources: this.options.enableWebFinger ? this.webfinger.getAllResources() : null,
            generated: new Date().toISOString()
        };
    }

    /**
     * Import discovery service configuration
     * @param {Object} config - Configuration to import
     * @returns {Object} Import result
     */
    importConfiguration(config) {
        const results = {
            webring: null,
            webfinger: null,
            errors: []
        };

        try {
            // Import webring registry
            if (config.webring_registry && this.options.enableWebring) {
                results.webring = this.webring.importRegistry(config.webring_registry);
            }

            // Import WebFinger resources
            if (config.webfinger_resources && this.options.enableWebFinger) {
                let imported = 0;
                config.webfinger_resources.forEach(resource => {
                    try {
                        this.webfinger.registerResource(resource);
                        imported++;
                    } catch (error) {
                        results.errors.push(`WebFinger import error: ${error.message}`);
                    }
                });
                results.webfinger = { imported };
            }

            return {
                success: true,
                results,
                message: 'Discovery service configuration imported'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                results
            };
        }
    }
}

export { DiscoveryService };