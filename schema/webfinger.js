/**
 * Ansybl WebFinger Implementation
 * 
 * Implements optional WebFinger support for ActivityPub-style user discovery
 * following RFC 7033 WebFinger specification.
 * 
 * Requirements: 5.5
 */

class WebFingerService {
    constructor() {
        this.resources = new Map();
        this.aliases = new Map();
    }

    /**
     * Register a resource for WebFinger discovery
     * @param {Object} resourceInfo - Resource information
     * @param {string} resourceInfo.subject - Resource identifier (acct: or https:)
     * @param {string[]} resourceInfo.aliases - Alternative identifiers
     * @param {Object[]} resourceInfo.links - Resource links
     * @returns {Object} Registration result
     */
    registerResource(resourceInfo) {
        const { subject, aliases = [], links = [] } = resourceInfo;
        
        if (!subject) {
            throw new Error('Resource subject is required');
        }

        // Validate subject format
        if (!this.isValidSubject(subject)) {
            throw new Error('Invalid subject format. Must be acct: or https: URI');
        }

        const resource = {
            subject,
            aliases: aliases.filter(alias => this.isValidSubject(alias)),
            links: links.map(link => this.validateLink(link)),
            created_at: new Date().toISOString()
        };

        // Store main resource
        this.resources.set(subject, resource);
        
        // Store aliases
        aliases.forEach(alias => {
            if (this.isValidSubject(alias)) {
                this.aliases.set(alias, subject);
            }
        });

        return {
            success: true,
            resource,
            message: 'Resource registered for WebFinger discovery'
        };
    }

    /**
     * Look up a resource by identifier
     * @param {string} resource - Resource identifier to look up
     * @param {string[]} rel - Optional relation types to filter links
     * @returns {Object|null} WebFinger response or null if not found
     */
    lookupResource(resource, rel = []) {
        // Check if it's an alias first
        const actualSubject = this.aliases.get(resource) || resource;
        const resourceData = this.resources.get(actualSubject);
        
        if (!resourceData) {
            return null;
        }

        // Filter links by relation if specified
        let links = resourceData.links;
        if (rel.length > 0) {
            links = links.filter(link => rel.includes(link.rel));
        }

        return {
            subject: resourceData.subject,
            aliases: resourceData.aliases,
            links: links
        };
    }

    /**
     * Create WebFinger resource from Ansybl feed author
     * @param {Object} author - Ansybl author object
     * @param {string} feedUrl - Feed URL
     * @param {Object} options - Additional options
     * @returns {Object} WebFinger resource
     */
    createResourceFromAnsyblAuthor(author, feedUrl, options = {}) {
        if (!author.name || !author.url) {
            throw new Error('Author must have name and url');
        }

        // Create acct: identifier from author info
        const domain = new URL(author.url).hostname;
        const username = this.extractUsername(author.name, author.url);
        const acctSubject = `acct:${username}@${domain}`;

        const links = [
            {
                rel: 'self',
                type: 'application/json',
                href: feedUrl,
                titles: {
                    'en': `${author.name}'s Ansybl Feed`
                }
            },
            {
                rel: 'http://webfinger.net/rel/profile-page',
                type: 'text/html',
                href: author.url,
                titles: {
                    'en': `${author.name}'s Profile`
                }
            }
        ];

        // Add avatar if available
        if (author.avatar) {
            links.push({
                rel: 'http://webfinger.net/rel/avatar',
                type: 'image/jpeg',
                href: author.avatar
            });
        }

        // Add ActivityPub actor if bridge is enabled
        if (options.activitypub_actor_url) {
            links.push({
                rel: 'self',
                type: 'application/activity+json',
                href: options.activitypub_actor_url
            });
        }

        // Add AT Protocol DID if available
        if (options.at_protocol_did) {
            links.push({
                rel: 'self',
                type: 'application/json',
                href: `at://${options.at_protocol_did}`
            });
        }

        return {
            subject: acctSubject,
            aliases: [author.url],
            links: links
        };
    }

    /**
     * Handle WebFinger HTTP request
     * @param {string} resource - Resource parameter from request
     * @param {string[]} rel - Relation parameters from request
     * @returns {Object} HTTP response object
     */
    handleWebFingerRequest(resource, rel = []) {
        if (!resource) {
            return {
                status: 400,
                body: {
                    error: 'missing_resource',
                    error_description: 'Resource parameter is required'
                }
            };
        }

        const result = this.lookupResource(resource, rel);
        
        if (!result) {
            return {
                status: 404,
                body: {
                    error: 'resource_not_found',
                    error_description: 'The requested resource was not found'
                }
            };
        }

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/jrd+json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: result
        };
    }

    /**
     * Validate subject format
     * @param {string} subject - Subject to validate
     * @returns {boolean} Whether subject is valid
     */
    isValidSubject(subject) {
        if (!subject || typeof subject !== 'string') {
            return false;
        }

        // Must be acct: or https: URI
        return subject.startsWith('acct:') || subject.startsWith('https:');
    }

    /**
     * Validate and normalize link object
     * @param {Object} link - Link object to validate
     * @returns {Object} Validated link object
     */
    validateLink(link) {
        if (!link.rel || !link.href) {
            throw new Error('Link must have rel and href properties');
        }

        const validatedLink = {
            rel: link.rel,
            href: link.href
        };

        // Add optional properties if present
        if (link.type) {
            validatedLink.type = link.type;
        }

        if (link.titles && typeof link.titles === 'object') {
            validatedLink.titles = link.titles;
        }

        if (link.properties && typeof link.properties === 'object') {
            validatedLink.properties = link.properties;
        }

        return validatedLink;
    }

    /**
     * Extract username from author name and URL
     * @param {string} name - Author name
     * @param {string} url - Author URL
     * @returns {string} Extracted username
     */
    extractUsername(name, url) {
        // Try to extract from URL path first
        try {
            const parsed = new URL(url);
            const pathParts = parsed.pathname.split('/').filter(part => part);
            
            if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && !lastPart.includes('.')) {
                    return lastPart.toLowerCase();
                }
            }
        } catch (error) {
            // Fall back to name-based username
        }

        // Fall back to creating username from name
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20) || 'user';
    }

    /**
     * Discover WebFinger endpoint for a domain
     * @param {string} domain - Domain to discover endpoint for
     * @returns {Promise<string|null>} WebFinger endpoint URL
     */
    async discoverWebFingerEndpoint(domain) {
        try {
            // WebFinger endpoint is standardized at /.well-known/webfinger
            const endpointUrl = `https://${domain}/.well-known/webfinger`;
            
            // In a real implementation, you might want to verify the endpoint exists
            return endpointUrl;
        } catch (error) {
            return null;
        }
    }

    /**
     * Query external WebFinger endpoint
     * @param {string} resource - Resource to query
     * @param {string[]} rel - Relations to request
     * @returns {Promise<Object|null>} WebFinger response
     */
    async queryWebFinger(resource, rel = []) {
        try {
            // Extract domain from resource
            let domain;
            if (resource.startsWith('acct:')) {
                domain = resource.split('@')[1];
            } else if (resource.startsWith('https:')) {
                domain = new URL(resource).hostname;
            } else {
                throw new Error('Invalid resource format');
            }

            const endpoint = await this.discoverWebFingerEndpoint(domain);
            if (!endpoint) {
                return null;
            }

            // Build query parameters
            const params = new URLSearchParams({ resource });
            rel.forEach(r => params.append('rel', r));

            const queryUrl = `${endpoint}?${params.toString()}`;
            
            // In a real implementation, this would make an HTTP request
            // For now, we'll simulate the response
            return this.simulateWebFingerResponse(resource);
        } catch (error) {
            return null;
        }
    }

    /**
     * Simulate WebFinger response for testing
     * @param {string} resource - Resource being queried
     * @returns {Object} Simulated response
     */
    simulateWebFingerResponse(resource) {
        if (resource.includes('notfound')) {
            return null;
        }

        return {
            subject: resource,
            aliases: [`https://example.com/users/${resource.split('@')[0].replace('acct:', '')}`],
            links: [
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `https://example.com/users/${resource.split('@')[0].replace('acct:', '')}`
                },
                {
                    rel: 'http://webfinger.net/rel/profile-page',
                    type: 'text/html',
                    href: `https://example.com/@${resource.split('@')[0].replace('acct:', '')}`
                }
            ]
        };
    }

    /**
     * Get all registered resources
     * @returns {Object[]} Array of registered resources
     */
    getAllResources() {
        return Array.from(this.resources.values());
    }

    /**
     * Remove a resource
     * @param {string} subject - Resource subject to remove
     * @returns {boolean} Whether resource was removed
     */
    removeResource(subject) {
        const resource = this.resources.get(subject);
        if (!resource) {
            return false;
        }

        // Remove aliases
        resource.aliases.forEach(alias => {
            this.aliases.delete(alias);
        });

        // Remove main resource
        return this.resources.delete(subject);
    }

    /**
     * Get service statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const resources = Array.from(this.resources.values());
        
        const linkStats = {};
        resources.forEach(resource => {
            resource.links.forEach(link => {
                linkStats[link.rel] = (linkStats[link.rel] || 0) + 1;
            });
        });

        return {
            total_resources: resources.length,
            total_aliases: this.aliases.size,
            link_relations: linkStats,
            recent_resources: resources
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5)
                .map(r => ({
                    subject: r.subject,
                    aliases: r.aliases.length,
                    links: r.links.length,
                    created_at: r.created_at
                }))
        };
    }
}

export { WebFingerService };