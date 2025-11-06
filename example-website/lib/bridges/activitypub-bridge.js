/**
 * ActivityPub Bridge for Ansybl Protocol
 * Converts between Ansybl feeds and ActivityPub/ActivityStreams format
 */

export class ActivityPubBridge {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://example.com';
        this.actorId = options.actorId || `${this.baseUrl}/actor`;
        this.context = [
            'https://www.w3.org/ns/activitystreams',
            'https://w3id.org/security/v1',
            {
                'ansybl': 'https://ansybl.org/ns#',
                'signature': 'ansybl:signature',
                'publicKey': 'ansybl:publicKey'
            }
        ];
    }

    /**
     * Convert Ansybl feed to ActivityPub Actor object
     * @param {Object} ansyblFeed - Complete Ansybl feed document
     * @returns {Object} ActivityPub Actor object
     */
    ansyblFeedToActor(ansyblFeed) {
        try {
            const actor = {
                '@context': this.context,
                'type': 'Person',
                'id': this.actorId,
                'preferredUsername': this._extractUsername(ansyblFeed.author?.name || ansyblFeed.title),
                'name': ansyblFeed.author?.name || ansyblFeed.title,
                'summary': ansyblFeed.description || '',
                'url': ansyblFeed.home_page_url,
                'inbox': `${this.actorId}/inbox`,
                'outbox': `${this.actorId}/outbox`,
                'followers': `${this.actorId}/followers`,
                'following': `${this.actorId}/following`,
                'liked': `${this.actorId}/liked`,
                'publicKey': {
                    'id': `${this.actorId}#main-key`,
                    'owner': this.actorId,
                    'publicKeyPem': this._convertEd25519ToRSA(ansyblFeed.author?.public_key)
                },
                'endpoints': {
                    'sharedInbox': `${this.baseUrl}/inbox`
                }
            };

            // Add icon if available
            if (ansyblFeed.icon) {
                actor.icon = {
                    'type': 'Image',
                    'mediaType': 'image/png',
                    'url': ansyblFeed.icon
                };
            }

            // Add avatar if available
            if (ansyblFeed.author?.avatar) {
                actor.image = {
                    'type': 'Image',
                    'mediaType': 'image/png',
                    'url': ansyblFeed.author.avatar
                };
            }

            return actor;

        } catch (error) {
            throw new Error(`Failed to convert Ansybl feed to ActivityPub Actor: ${error.message}`);
        }
    }

    /**
     * Convert Ansybl item to ActivityPub Create activity
     * @param {Object} ansyblItem - Ansybl content item
     * @param {Object} feedMetadata - Feed metadata for context
     * @returns {Object} ActivityPub Create activity
     */
    ansyblItemToActivity(ansyblItem, feedMetadata) {
        try {
            const object = this._ansyblItemToObject(ansyblItem, feedMetadata);
            
            const activity = {
                '@context': this.context,
                'type': 'Create',
                'id': `${ansyblItem.id}/activity`,
                'actor': this.actorId,
                'published': ansyblItem.date_published,
                'object': object
            };

            // Add to/cc for public posts
            activity.to = ['https://www.w3.org/ns/activitystreams#Public'];
            activity.cc = [`${this.actorId}/followers`];

            return activity;

        } catch (error) {
            throw new Error(`Failed to convert Ansybl item to ActivityPub activity: ${error.message}`);
        }
    }

    /**
     * Convert Ansybl item to ActivityPub Object
     * @param {Object} ansyblItem - Ansybl content item
     * @param {Object} feedMetadata - Feed metadata for context
     * @returns {Object} ActivityPub Object
     */
    ansyblItemToObject(ansyblItem, feedMetadata) {
        return this._ansyblItemToObject(ansyblItem, feedMetadata);
    }

    /**
     * Convert ActivityPub activity to Ansybl item
     * @param {Object} activity - ActivityPub activity
     * @returns {Object} Ansybl content item
     */
    activityToAnsyblItem(activity) {
        try {
            let object = activity.object;
            
            // Handle different activity types
            if (activity.type === 'Create' && object) {
                return this._objectToAnsyblItem(object, activity);
            } else if (activity.type === 'Note' || activity.type === 'Article') {
                // Direct object
                return this._objectToAnsyblItem(activity, null);
            } else {
                throw new Error(`Unsupported activity type: ${activity.type}`);
            }

        } catch (error) {
            throw new Error(`Failed to convert ActivityPub activity to Ansybl item: ${error.message}`);
        }
    }

    /**
     * Convert Ansybl interactions to ActivityPub activities
     * @param {Object} interactions - Ansybl interaction data
     * @param {string} objectId - ID of the object being interacted with
     * @returns {Array} Array of ActivityPub activities
     */
    interactionsToActivities(interactions, objectId) {
        const activities = [];

        // Convert likes to Like activities
        if (interactions.likes) {
            interactions.likes.forEach(like => {
                activities.push({
                    '@context': this.context,
                    'type': 'Like',
                    'id': `${this.baseUrl}/activities/like/${like.userId}/${Date.now()}`,
                    'actor': `${this.baseUrl}/users/${like.userId}`,
                    'object': objectId,
                    'published': like.timestamp
                });
            });
        }

        // Convert shares to Announce activities
        if (interactions.shares) {
            interactions.shares.forEach(share => {
                const activity = {
                    '@context': this.context,
                    'type': 'Announce',
                    'id': `${this.baseUrl}/activities/announce/${share.id}`,
                    'actor': `${this.baseUrl}/users/${share.userId}`,
                    'object': objectId,
                    'published': share.timestamp
                };

                // Add message as content if provided
                if (share.message) {
                    activity.content = share.message;
                }

                activities.push(activity);
            });
        }

        return activities;
    }

    /**
     * Create ActivityPub OrderedCollection for outbox
     * @param {Array} activities - Array of ActivityPub activities
     * @param {Object} options - Collection options
     * @returns {Object} ActivityPub OrderedCollection
     */
    createOutboxCollection(activities, options = {}) {
        const collection = {
            '@context': this.context,
            'type': 'OrderedCollection',
            'id': `${this.actorId}/outbox`,
            'totalItems': activities.length,
            'orderedItems': activities.slice(0, options.limit || 20)
        };

        // Add pagination if needed
        if (activities.length > (options.limit || 20)) {
            collection.first = `${this.actorId}/outbox?page=1`;
            collection.last = `${this.actorId}/outbox?page=${Math.ceil(activities.length / (options.limit || 20))}`;
        }

        return collection;
    }

    /**
     * Get feature mapping documentation
     * @returns {Object} Feature mapping information
     */
    getFeatureMapping() {
        return {
            ansyblToActivityPub: {
                supported: [
                    'Feed metadata to Actor profile',
                    'Content items to Create activities',
                    'Text and HTML content',
                    'Media attachments',
                    'Publication dates',
                    'Author information',
                    'Tags as hashtags',
                    'Social interactions (likes, shares)'
                ],
                limitations: [
                    'Ed25519 signatures need conversion to RSA for ActivityPub compatibility',
                    'Ansybl-specific metadata may be lost',
                    'Complex content formats may be simplified',
                    'Federation requires additional server infrastructure',
                    'Real-time updates need WebSub or similar mechanism'
                ],
                mappings: {
                    'Feed': 'Actor (Person)',
                    'Content Item': 'Create Activity with Note/Article object',
                    'title': 'object.name',
                    'content_text': 'object.content (plain text)',
                    'content_html': 'object.content (HTML)',
                    'date_published': 'published',
                    'author': 'actor',
                    'tags': 'object.tag (Hashtag)',
                    'attachments': 'object.attachment',
                    'interactions.likes': 'Like activities',
                    'interactions.shares': 'Announce activities'
                }
            },
            activityPubToAnsybl: {
                supported: [
                    'Actor profiles to feed metadata',
                    'Create activities to content items',
                    'Note and Article objects',
                    'Media attachments',
                    'Like and Announce activities',
                    'Publication dates',
                    'Author information'
                ],
                limitations: [
                    'Cannot generate Ansybl signatures without private keys',
                    'ActivityPub-specific fields may be lost',
                    'Complex activity types not supported',
                    'Federation context may be incomplete',
                    'Requires mapping of actor IDs to Ansybl authors'
                ],
                mappings: {
                    'Actor (Person)': 'Feed metadata',
                    'Create Activity': 'Content Item',
                    'object.name': 'title',
                    'object.content': 'content_html or content_text',
                    'published': 'date_published',
                    'actor': 'author',
                    'object.tag (Hashtag)': 'tags',
                    'object.attachment': 'attachments',
                    'Like activities': 'interactions.likes',
                    'Announce activities': 'interactions.shares'
                }
            }
        };
    }

    /**
     * Private helper methods
     */
    _ansyblItemToObject(ansyblItem, feedMetadata) {
        const object = {
            'type': ansyblItem.title ? 'Article' : 'Note',
            'id': ansyblItem.id,
            'url': ansyblItem.url || ansyblItem.id,
            'published': ansyblItem.date_published,
            'attributedTo': this.actorId
        };

        // Add title for articles
        if (ansyblItem.title) {
            object.name = ansyblItem.title;
        }

        // Add content
        if (ansyblItem.content_html) {
            object.content = ansyblItem.content_html;
            object.mediaType = 'text/html';
        } else if (ansyblItem.content_text) {
            object.content = ansyblItem.content_text;
            object.mediaType = 'text/plain';
        }

        // Add summary
        if (ansyblItem.summary) {
            object.summary = ansyblItem.summary;
        }

        // Add modification date
        if (ansyblItem.date_modified) {
            object.updated = ansyblItem.date_modified;
        }

        // Add tags as hashtags
        if (ansyblItem.tags && ansyblItem.tags.length > 0) {
            object.tag = ansyblItem.tags.map(tag => ({
                'type': 'Hashtag',
                'href': `${this.baseUrl}/tags/${encodeURIComponent(tag)}`,
                'name': `#${tag}`
            }));
        }

        // Add attachments
        if (ansyblItem.attachments && ansyblItem.attachments.length > 0) {
            object.attachment = ansyblItem.attachments.map(attachment => ({
                'type': 'Document',
                'mediaType': attachment.mime_type,
                'url': attachment.url,
                'name': attachment.title || attachment.alt_text,
                'width': attachment.width,
                'height': attachment.height
            }));
        }

        // Add reply information
        if (ansyblItem.in_reply_to) {
            object.inReplyTo = ansyblItem.in_reply_to;
        }

        // Add public addressing
        object.to = ['https://www.w3.org/ns/activitystreams#Public'];
        object.cc = [`${this.actorId}/followers`];

        // Add Ansybl-specific metadata
        if (ansyblItem.uuid) {
            object['ansybl:uuid'] = ansyblItem.uuid;
        }

        if (ansyblItem.signature) {
            object['ansybl:signature'] = ansyblItem.signature;
        }

        return object;
    }

    _objectToAnsyblItem(object, activity) {
        const item = {
            id: object.id || object.url,
            title: object.name,
            date_published: object.published || (activity && activity.published) || new Date().toISOString()
        };

        // Add URL
        if (object.url) {
            item.url = object.url;
        }

        // Add content
        if (object.content) {
            if (object.mediaType === 'text/html') {
                item.content_html = object.content;
                // Convert HTML to text
                item.content_text = this._htmlToText(object.content);
            } else {
                item.content_text = object.content;
            }
        }

        // Add summary
        if (object.summary) {
            item.summary = object.summary;
        }

        // Add modification date
        if (object.updated) {
            item.date_modified = object.updated;
        }

        // Add author information
        if (object.attributedTo) {
            item.author = {
                name: this._extractActorName(object.attributedTo),
                url: object.attributedTo
            };
        }

        // Add tags from hashtags
        if (object.tag && Array.isArray(object.tag)) {
            item.tags = object.tag
                .filter(tag => tag.type === 'Hashtag')
                .map(tag => tag.name.replace('#', ''));
        }

        // Add attachments
        if (object.attachment && Array.isArray(object.attachment)) {
            item.attachments = object.attachment.map(attachment => ({
                url: attachment.url,
                mime_type: attachment.mediaType,
                title: attachment.name,
                width: attachment.width,
                height: attachment.height
            }));
        }

        // Add reply information
        if (object.inReplyTo) {
            item.in_reply_to = object.inReplyTo;
        }

        // Add Ansybl-specific metadata if present
        if (object['ansybl:uuid']) {
            item.uuid = object['ansybl:uuid'];
        }

        return item;
    }

    _extractUsername(name) {
        if (!name) return 'user';
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20) || 'user';
    }

    _extractActorName(actorId) {
        // Try to extract name from actor ID or return a default
        try {
            const url = new URL(actorId);
            const pathParts = url.pathname.split('/');
            return pathParts[pathParts.length - 1] || 'Unknown User';
        } catch (e) {
            return 'Unknown User';
        }
    }

    _convertEd25519ToRSA(ed25519Key) {
        // Note: This is a placeholder. In a real implementation, you would need
        // to either convert the key format or use a different signing mechanism
        // ActivityPub typically uses RSA keys, while Ansybl uses Ed25519
        if (!ed25519Key) {
            return '-----BEGIN PUBLIC KEY-----\nPlaceholder RSA key - conversion needed\n-----END PUBLIC KEY-----';
        }
        
        return `-----BEGIN PUBLIC KEY-----
${ed25519Key.replace('ed25519:', '')}
-----END PUBLIC KEY-----`;
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

export default ActivityPubBridge;