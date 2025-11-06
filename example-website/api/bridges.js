/**
 * Protocol Bridge API Endpoints
 * Provides conversion between Ansybl and other protocols
 */

import express from 'express';
import { getAllBridges, BRIDGE_FEATURES, SUPPORTED_BRIDGES } from '../lib/bridges/index.js';

const router = express.Router();

// Initialize bridges
const bridges = getAllBridges({
    activitypub: {
        baseUrl: process.env.BASE_URL || 'https://example.com',
        actorId: process.env.ACTOR_ID || 'https://example.com/actor'
    }
});

/**
 * Get available bridges and their features
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        bridges: BRIDGE_FEATURES,
        supported: SUPPORTED_BRIDGES,
        endpoints: {
            convert: '/api/bridges/convert',
            rss: '/api/bridges/rss',
            activitypub: '/api/bridges/activitypub',
            jsonfeed: '/api/bridges/jsonfeed'
        }
    });
});

/**
 * Generic conversion endpoint
 */
router.post('/convert', async (req, res) => {
    try {
        const { from, to, data, options = {} } = req.body;

        if (!from || !to || !data) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: from, to, data'
            });
        }

        if (!SUPPORTED_BRIDGES.includes(from) && from !== 'ansybl') {
            return res.status(400).json({
                success: false,
                error: `Unsupported source format: ${from}`
            });
        }

        if (!SUPPORTED_BRIDGES.includes(to) && to !== 'ansybl') {
            return res.status(400).json({
                success: false,
                error: `Unsupported target format: ${to}`
            });
        }

        let result;

        // Convert from Ansybl to other formats
        if (from === 'ansybl') {
            const bridge = bridges[to];
            if (!bridge) {
                throw new Error(`Bridge not found for format: ${to}`);
            }

            switch (to) {
                case 'rss':
                    result = bridge.ansyblToRss(data);
                    break;
                case 'activitypub':
                    if (options.type === 'actor') {
                        result = bridge.ansyblFeedToActor(data);
                    } else {
                        result = bridge.ansyblItemToActivity(data, options.feedMetadata);
                    }
                    break;
                case 'jsonfeed':
                    result = bridge.ansyblToJsonFeed(data);
                    break;
                default:
                    throw new Error(`Conversion not implemented: ansybl -> ${to}`);
            }
        }
        // Convert from other formats to Ansybl
        else if (to === 'ansybl') {
            const bridge = bridges[from];
            if (!bridge) {
                throw new Error(`Bridge not found for format: ${from}`);
            }

            switch (from) {
                case 'rss':
                    result = bridge.rssToAnsybl(data, options);
                    break;
                case 'activitypub':
                    result = bridge.activityToAnsyblItem(data);
                    break;
                case 'jsonfeed':
                    result = bridge.jsonFeedToAnsybl(data, options);
                    break;
                default:
                    throw new Error(`Conversion not implemented: ${from} -> ansybl`);
            }
        }
        // Direct format-to-format conversion (via Ansybl)
        else {
            // Two-step conversion: source -> ansybl -> target
            const sourceBridge = bridges[from];
            const targetBridge = bridges[to];

            if (!sourceBridge || !targetBridge) {
                throw new Error(`Bridge not found for conversion: ${from} -> ${to}`);
            }

            // First convert to Ansybl
            let ansyblData;
            switch (from) {
                case 'rss':
                    ansyblData = sourceBridge.rssToAnsybl(data, options);
                    break;
                case 'activitypub':
                    ansyblData = sourceBridge.activityToAnsyblItem(data);
                    break;
                case 'jsonfeed':
                    ansyblData = sourceBridge.jsonFeedToAnsybl(data, options);
                    break;
                default:
                    throw new Error(`Source conversion not implemented: ${from}`);
            }

            // Then convert to target format
            switch (to) {
                case 'rss':
                    result = targetBridge.ansyblToRss(ansyblData);
                    break;
                case 'activitypub':
                    if (options.type === 'actor') {
                        result = targetBridge.ansyblFeedToActor(ansyblData);
                    } else {
                        result = targetBridge.ansyblItemToActivity(ansyblData, options.feedMetadata);
                    }
                    break;
                case 'jsonfeed':
                    result = targetBridge.ansyblToJsonFeed(ansyblData);
                    break;
                default:
                    throw new Error(`Target conversion not implemented: ${to}`);
            }
        }

        res.json({
            success: true,
            result,
            conversion: `${from} -> ${to}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Bridge conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            conversion: `${req.body.from || 'unknown'} -> ${req.body.to || 'unknown'}`
        });
    }
});

/**
 * RSS-specific endpoints
 */
router.get('/rss/feed.rss', async (req, res) => {
    try {
        // Fetch current Ansybl feed
        const feedResponse = await fetch(`${req.protocol}://${req.get('host')}/feed.ansybl`);
        if (!feedResponse.ok) {
            throw new Error('Failed to fetch Ansybl feed');
        }

        const ansyblFeed = await feedResponse.json();
        const rssXml = bridges.rss.ansyblToRss(ansyblFeed);

        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rssXml);

    } catch (error) {
        console.error('RSS feed generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/rss/import', async (req, res) => {
    try {
        const { rssXml, options = {} } = req.body;

        if (!rssXml) {
            return res.status(400).json({
                success: false,
                error: 'Missing RSS XML data'
            });
        }

        const ansyblFeed = bridges.rss.rssToAnsybl(rssXml, options);

        res.json({
            success: true,
            feed: ansyblFeed,
            itemCount: ansyblFeed.items.length
        });

    } catch (error) {
        console.error('RSS import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/rss/mapping', (req, res) => {
    res.json({
        success: true,
        mapping: bridges.rss.getFeatureMapping()
    });
});

/**
 * ActivityPub-specific endpoints
 */
router.get('/activitypub/actor', async (req, res) => {
    try {
        // Fetch current Ansybl feed
        const feedResponse = await fetch(`${req.protocol}://${req.get('host')}/feed.ansybl`);
        if (!feedResponse.ok) {
            throw new Error('Failed to fetch Ansybl feed');
        }

        const ansyblFeed = await feedResponse.json();
        const actor = bridges.activitypub.ansyblFeedToActor(ansyblFeed);

        res.setHeader('Content-Type', 'application/activity+json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(actor);

    } catch (error) {
        console.error('ActivityPub actor generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/activitypub/outbox', async (req, res) => {
    try {
        // Fetch current Ansybl feed
        const feedResponse = await fetch(`${req.protocol}://${req.get('host')}/feed.ansybl`);
        if (!feedResponse.ok) {
            throw new Error('Failed to fetch Ansybl feed');
        }

        const ansyblFeed = await feedResponse.json();
        
        // Convert items to activities
        const activities = ansyblFeed.items.map(item => 
            bridges.activitypub.ansyblItemToActivity(item, ansyblFeed)
        );

        const outbox = bridges.activitypub.createOutboxCollection(activities, {
            limit: parseInt(req.query.limit) || 20
        });

        res.setHeader('Content-Type', 'application/activity+json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(outbox);

    } catch (error) {
        console.error('ActivityPub outbox generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/activitypub/mapping', (req, res) => {
    res.json({
        success: true,
        mapping: bridges.activitypub.getFeatureMapping()
    });
});

/**
 * JSON Feed-specific endpoints
 */
router.get('/jsonfeed/feed.json', async (req, res) => {
    try {
        // Fetch current Ansybl feed
        const feedResponse = await fetch(`${req.protocol}://${req.get('host')}/feed.ansybl`);
        if (!feedResponse.ok) {
            throw new Error('Failed to fetch Ansybl feed');
        }

        const ansyblFeed = await feedResponse.json();
        const jsonFeed = bridges.jsonfeed.ansyblToJsonFeed(ansyblFeed);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(jsonFeed);

    } catch (error) {
        console.error('JSON Feed generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/jsonfeed/import', async (req, res) => {
    try {
        const { jsonFeed, options = {} } = req.body;

        if (!jsonFeed) {
            return res.status(400).json({
                success: false,
                error: 'Missing JSON Feed data'
            });
        }

        // Validate JSON Feed first
        const validation = bridges.jsonfeed.validateJsonFeed(jsonFeed);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid JSON Feed',
                validation
            });
        }

        const ansyblFeed = bridges.jsonfeed.jsonFeedToAnsybl(jsonFeed, options);

        res.json({
            success: true,
            feed: ansyblFeed,
            itemCount: ansyblFeed.items.length,
            validation
        });

    } catch (error) {
        console.error('JSON Feed import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/jsonfeed/validate', (req, res) => {
    try {
        const { jsonFeed } = req.body;

        if (!jsonFeed) {
            return res.status(400).json({
                success: false,
                error: 'Missing JSON Feed data'
            });
        }

        const validation = bridges.jsonfeed.validateJsonFeed(jsonFeed);

        res.json({
            success: true,
            validation
        });

    } catch (error) {
        console.error('JSON Feed validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/jsonfeed/mapping', (req, res) => {
    res.json({
        success: true,
        mapping: bridges.jsonfeed.getFeatureMapping()
    });
});

/**
 * Batch conversion endpoint
 */
router.post('/batch', async (req, res) => {
    try {
        const { conversions } = req.body;

        if (!conversions || !Array.isArray(conversions)) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid conversions array'
            });
        }

        const results = [];

        for (const conversion of conversions) {
            try {
                const { from, to, data, options = {} } = conversion;
                
                // Use the same conversion logic as the single endpoint
                // This is a simplified version - in production, you might want to optimize
                const conversionResult = await processConversion(from, to, data, options);
                
                results.push({
                    success: true,
                    result: conversionResult,
                    conversion: `${from} -> ${to}`
                });

            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    conversion: `${conversion.from || 'unknown'} -> ${conversion.to || 'unknown'}`
                });
            }
        }

        res.json({
            success: true,
            results,
            total: conversions.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });

    } catch (error) {
        console.error('Batch conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function for batch processing
async function processConversion(from, to, data, options) {
    // This would contain the same logic as the main conversion endpoint
    // Extracted for reuse in batch processing
    // Implementation details omitted for brevity
    throw new Error('Batch conversion not fully implemented');
}

export default router;