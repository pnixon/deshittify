/**
 * Protocol Bridges Index
 * Exports all available protocol bridges for Ansybl
 */

import { RSSBridge } from './rss-bridge.js';
import { ActivityPubBridge } from './activitypub-bridge.js';
import { JSONFeedBridge } from './jsonfeed-bridge.js';

export { RSSBridge, ActivityPubBridge, JSONFeedBridge };

// Convenience function to get all bridges
export function getAllBridges(options = {}) {
    return {
        rss: new RSSBridge(),
        activitypub: new ActivityPubBridge(options.activitypub || {}),
        jsonfeed: new JSONFeedBridge()
    };
}

// Bridge registry for dynamic access
export const BRIDGE_REGISTRY = {
    'rss': RSSBridge,
    'activitypub': ActivityPubBridge,
    'jsonfeed': JSONFeedBridge
};

// Supported bridge types
export const SUPPORTED_BRIDGES = Object.keys(BRIDGE_REGISTRY);

// Feature comparison matrix
export const BRIDGE_FEATURES = {
    rss: {
        name: 'RSS 2.0',
        description: 'Convert to/from RSS 2.0 syndication format',
        bidirectional: true,
        preserves_signatures: false,
        preserves_interactions: false,
        preserves_metadata: 'partial',
        output_format: 'xml',
        mime_type: 'application/rss+xml'
    },
    activitypub: {
        name: 'ActivityPub',
        description: 'Convert to ActivityPub/ActivityStreams for federation',
        bidirectional: true,
        preserves_signatures: 'converted',
        preserves_interactions: true,
        preserves_metadata: 'partial',
        output_format: 'json-ld',
        mime_type: 'application/activity+json'
    },
    jsonfeed: {
        name: 'JSON Feed',
        description: 'Convert to/from JSON Feed 1.1 format',
        bidirectional: true,
        preserves_signatures: 'extension',
        preserves_interactions: 'extension',
        preserves_metadata: 'full',
        output_format: 'json',
        mime_type: 'application/json'
    }
};

export default {
    RSSBridge,
    ActivityPubBridge,
    JSONFeedBridge,
    getAllBridges,
    BRIDGE_REGISTRY,
    SUPPORTED_BRIDGES,
    BRIDGE_FEATURES
};