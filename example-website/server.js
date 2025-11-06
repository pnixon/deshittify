/**
 * Ansybl Example Website Server
 * Demonstrates implementation of the Ansybl protocol
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import WebSocket service
import webSocketService from './lib/websocket.js';


// Import Ansybl utilities (assuming they're copied from schema folder)
import { AnsyblGenerator } from './lib/generator.js';
import { AnsyblValidator } from './lib/validator.js';
import { AnsyblParser } from './lib/parser.js';
import { generateKeyPair } from './lib/signature.js';

// Import markdown and sanitization
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Import media handling
import multer from 'multer';
import sharp from 'sharp';
import mime from 'mime-types';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';

// Import secure file serving
import { secureFileServing, fileDownloadRateLimit } from './middleware/fileServing.js';

// Setup DOMPurify for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (excluding uploads - handled by secure middleware)
app.use(express.static(join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, path) => {
    // Security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }
}));

// Secure file serving for uploads with rate limiting
app.use('/uploads/*', fileDownloadRateLimit(), secureFileServing({
  allowedDir: 'public/uploads',
  requireAuth: false, // Set to true for private files
  maxAge: 86400, // 24 hours cache
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.pdf']
}));

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, 'public', 'uploads');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Max 5 files per request
    },
    fileFilter: (req, file, cb) => {
        // Allow images, videos, audio, and PDF documents
        const allowedTypes = /^(image|video|audio|application\/pdf)\//;
        if (allowedTypes.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image, video, audio, and PDF files are allowed'), false);
        }
    }
});

// Initialize Ansybl components
const generator = new AnsyblGenerator();
const validator = new AnsyblValidator();
const parser = new AnsyblParser();

// Sample data and configuration
let siteConfig = {
    title: 'Ansybl Example Site',
    description: 'A demonstration of the Ansybl social syndication protocol with live commenting',
    baseUrl: 'https://example.com',
    author: {
        name: 'Demo Author',
        url: 'https://example.com/author',
        avatar: 'https://example.com/avatar.jpg'
    }
};

// Comments storage - in production, use a database
let comments = [];
let commentIdCounter = 1;

// Interactions storage
let interactions = {};
let interactionIdCounter = 1;

// Sample posts data with enhanced features
let posts = [
    {
        id: 'post-1',
        uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: 'Welcome to Ansybl',
        content_text: 'This is an example post demonstrating the Ansybl protocol. Ansybl enables decentralized social syndication with cryptographic signatures.',
        content_markdown: `# Welcome to Ansybl

This is an example post demonstrating the **Ansybl protocol**. Ansybl enables:

- Decentralized social syndication
- Cryptographic signatures using Ed25519
- Cross-platform content sharing
- User data ownership

> "The future of social media is decentralized, secure, and user-controlled."

Learn more about the protocol at [ansybl.org](https://ansybl.org).`,
        content_html: null, // Will be generated from markdown
        summary: 'An introduction to the Ansybl protocol and its benefits for decentralized social media.',
        datePublished: '2025-11-04T10:00:00Z',
        dateModified: null,
        tags: ['ansybl', 'demo', 'welcome'],
        author: siteConfig.author,
        attachments: [],
        interactions: {
            replies_count: 0,
            likes_count: 0,
            shares_count: 0
        }
    },
    {
        id: 'post-2',
        uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        title: 'Understanding Cryptographic Signatures',
        content_text: 'Every item in an Ansybl feed is cryptographically signed using Ed25519, ensuring authenticity and preventing tampering.',
        content_markdown: `## Cryptographic Signatures in Ansybl

Every item in an Ansybl feed is **cryptographically signed** using \`Ed25519\`, ensuring:

### Security Benefits
1. **Authenticity** - Verify content comes from claimed author
2. **Integrity** - Detect any tampering or modification
3. **Non-repudiation** - Authors cannot deny creating content

### Technical Details
- Uses Ed25519 elliptic curve cryptography
- Signatures are base64-encoded
- Each item and the feed itself are signed separately

\`\`\`javascript
// Example signature verification
const isValid = await verifySignature(content, signature, publicKey);
\`\`\`

This ensures trust in a decentralized environment without central authorities.`,
        content_html: null,
        summary: 'How Ed25519 cryptographic signatures ensure security and trust in Ansybl feeds.',
        datePublished: '2025-11-04T11:30:00Z',
        dateModified: null,
        tags: ['cryptography', 'security', 'ed25519'],
        author: siteConfig.author,
        attachments: [],
        interactions: {
            replies_count: 0,
            likes_count: 0,
            shares_count: 0
        }
    },
    {
        id: 'post-3',
        uuid: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        title: 'Decentralized Social Media',
        content_text: 'Ansybl promotes a decentralized approach to social media, where users control their own data and can syndicate content across platforms.',
        content_markdown: `## The Future is Decentralized

Ansybl promotes a **decentralized approach** to social media, where:

### User Benefits
- 🔐 **Data Ownership** - You control your content and identity
- 🌐 **Platform Independence** - Content works across different services
- 🚫 **No Censorship** - No single point of control or failure
- 📡 **Open Standards** - Built on open protocols anyone can implement

### How It Works
Instead of storing everything on one platform, Ansybl feeds can be:
- Hosted on your own website
- Syndicated across multiple platforms
- Verified cryptographically
- Consumed by any compatible client

This creates a truly open social web where users, not platforms, are in control.

*Join the decentralized social media revolution!*`,
        content_html: null,
        summary: 'Exploring how Ansybl enables user-controlled, decentralized social media.',
        datePublished: '2025-11-04T14:15:00Z',
        dateModified: null,
        tags: ['decentralization', 'social-media', 'data-ownership'],
        author: siteConfig.author,
        attachments: [],
        interactions: {
            replies_count: 0,
            likes_count: 0,
            shares_count: 0
        }
    }
];

// Initialize interactions for existing posts
posts.forEach(post => {
    interactions[post.id] = {
        likes: [],
        shares: [],
        replies: []
    };
});

// Generate key pair for signing (in production, this should be persistent)
let keyPair = null;

// Utility functions
function processMarkdownContent(post) {
    if (post.content_markdown && !post.content_html) {
        // Configure marked for security
        marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false // We'll use DOMPurify instead
        });

        // Convert markdown to HTML and sanitize
        const rawHtml = marked(post.content_markdown);
        post.content_html = purify.sanitize(rawHtml);
    }
    return post;
}

function updateInteractionCounts(postId) {
    const post = posts.find(p => p.id === postId);
    if (post && interactions[postId]) {
        post.interactions.likes_count = interactions[postId].likes.length;
        post.interactions.shares_count = interactions[postId].shares.length;
        post.interactions.replies_count = interactions[postId].replies.length;
    }
}

function generateContentSummary(content, maxLength = 200) {
    if (!content) return '';
    const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*_`]/g, '');
    return plainText.length > maxLength
        ? plainText.substring(0, maxLength).trim() + '...'
        : plainText;
}

// Media processing utilities
async function processMediaFile(file, options = {}) {
    const fileHash = createHash('sha256').update(file.buffer).digest('hex').substring(0, 16);
    const extension = mime.extension(file.mimetype) || 'bin';
    const filename = `${fileHash}.${extension}`;
    const filepath = join(uploadsDir, filename);

    let processedFile = {
        url: `${siteConfig.baseUrl}/uploads/${filename}`,
        mime_type: file.mimetype,
        title: file.originalname,
        size_in_bytes: file.buffer.length
    };

    // Process images with sharp
    if (file.mimetype.startsWith('image/')) {
        try {
            const image = sharp(file.buffer);
            const metadata = await image.metadata();

            processedFile.width = metadata.width;
            processedFile.height = metadata.height;

            // Generate thumbnail for large images
            if (metadata.width > 800 || metadata.height > 600) {
                const thumbnailFilename = `thumb_${filename}`;
                const thumbnailPath = join(uploadsDir, thumbnailFilename);

                await image
                    .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailPath);

                processedFile.thumbnail_url = `${siteConfig.baseUrl}/uploads/${thumbnailFilename}`;
            }

            // Generate blurhash placeholder (simplified version)
            processedFile.blurhash = generateSimpleBlurhash(metadata);

        } catch (error) {
            console.warn('Image processing failed:', error.message);
        }
    }

    // Save original file
    await fs.writeFile(filepath, file.buffer);

    return processedFile;
}

function generateSimpleBlurhash(metadata) {
    // Simplified blurhash - in production, use actual blurhash library
    const colors = ['L9AB8S', 'L6PZfQ', 'L4Rme7', 'L8Q]%M'];
    return colors[Math.floor(Math.random() * colors.length)] + 'j[ayj[';
}

async function generateVideoMetadata(file) {
    // In production, use ffprobe or similar
    return {
        duration_in_seconds: 0, // Would be extracted from video
        width: 1920, // Default values
        height: 1080
    };
}

async function generateAudioMetadata(file) {
    // In production, use audio metadata extraction
    return {
        duration_in_seconds: 0 // Would be extracted from audio
    };
}

async function initializeKeys() {
    try {
        // In production, load from secure storage
        keyPair = await generateKeyPair();
        siteConfig.author.public_key = keyPair.publicKey;
        console.log('✅ Key pair generated for signing');
    } catch (error) {
        console.error('❌ Failed to generate key pair:', error);
        process.exit(1);
    }
}

// Routes

// Home page
app.get('/', (_, res) => {
    res.send(generateHomePage());
});

// Individual post pages
app.get('/post/:id', (req, res) => {
    const post = posts.find(p => p.id === req.params.id);
    if (!post) {
        return res.status(404).send(generate404Page());
    }
    res.send(generatePostPage(post));
});

// Ansybl feed endpoint
app.get('/feed.ansybl', async (_, res) => {
    try {
        const feed = await generateAnsyblFeed();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(feed);
    } catch (error) {
        console.error('Error generating feed:', error);
        res.status(500).json({ error: 'Failed to generate feed' });
    }
});

// Convenience bridge endpoints
app.get('/feed.rss', (req, res) => {
    res.redirect('/api/bridges/rss/feed.rss');
});

app.get('/feed.json', (req, res) => {
    res.redirect('/api/bridges/jsonfeed/feed.json');
});

app.get('/actor', (req, res) => {
    res.redirect('/api/bridges/activitypub/actor');
});

app.get('/outbox', (req, res) => {
    res.redirect('/api/bridges/activitypub/outbox');
});

// API endpoints

// Validate Ansybl document
app.post('/api/validate', (req, res) => {
    try {
        console.log('📝 Validation request received');
        const result = validator.validateDocument(req.body);
        console.log('✅ Validation completed:', result.valid ? 'VALID' : 'INVALID');
        res.json(result);
    } catch (error) {
        console.error('❌ Validation error:', error.message);
        res.status(400).json({
            valid: false,
            errors: [{
                code: 'VALIDATION_ERROR',
                message: error.message
            }]
        });
    }
});

// Parse Ansybl document
app.post('/api/parse', async (req, res) => {
    try {
        console.log('🔍 Parse request received, verify signatures:', req.query.verify === 'true');
        const options = {
            verifySignatures: req.query.verify === 'true',
            preserveExtensions: req.query.extensions === 'true'
        };

        const result = await parser.parse(req.body, options);
        console.log('✅ Parse completed:', result.success ? 'SUCCESS' : 'FAILED');
        res.json(result);
    } catch (error) {
        console.error('❌ Parse error:', error.message);
        res.status(400).json({
            success: false,
            errors: [{
                code: 'PARSE_ERROR',
                message: error.message
            }]
        });
    }
});

// Get feed metadata
app.get('/api/feed/info', (_, res) => {
    res.json({
        title: siteConfig.title,
        description: siteConfig.description,
        author: siteConfig.author,
        feedUrl: `${siteConfig.baseUrl}/feed.ansybl`,
        itemCount: posts.length + comments.length,
        lastUpdated: posts.length > 0 ? posts[0].datePublished : new Date().toISOString()
    });
});

// Comments API endpoints

// Get comments for a post
app.get('/api/posts/:postId/comments', (req, res) => {
    const postComments = comments.filter(c => c.postId === req.params.postId);
    res.json(postComments);
});

// Add a comment to a post
app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { author, content } = req.body;
        const postId = req.params.postId;

        // Validate input
        if (!author || !content || !author.name || !content.trim()) {
            return res.status(400).json({
                error: 'Missing required fields: author.name and content are required'
            });
        }

        // Check if post exists
        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Create comment
        const comment = {
            id: `comment-${commentIdCounter++}`,
            postId: postId,
            author: {
                name: author.name,
                url: author.url || null,
                avatar: author.avatar || null
            },
            content: content.trim(),
            contentHtml: `<p>${content.trim().replace(/\n/g, '<br>')}</p>`,
            datePublished: new Date().toISOString(),
            inReplyTo: `${siteConfig.baseUrl}/post/${postId}`
        };

        comments.unshift(comment); // Add to beginning for chronological order

        // Broadcast real-time update
        webSocketService.broadcastComment(postId, {
            comment: comment,
            action: 'new_comment'
        });

        console.log(`💬 New comment added to ${postId} by ${author.name}`);

        res.status(201).json({
            success: true,
            comment: comment,
            message: 'Comment added successfully and will appear in the Ansybl feed'
        });

    } catch (error) {
        console.error('❌ Comment creation error:', error.message);
        res.status(500).json({
            error: 'Failed to create comment',
            message: error.message
        });
    }
});

// Get all comments (for feed generation)
app.get('/api/comments', (_, res) => {
    res.json(comments);
});

// Media upload endpoint
app.post('/api/media/upload', upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`📎 Processing ${req.files.length} media file(s)`);

        const processedFiles = [];

        for (const file of req.files) {
            try {
                const processedFile = await processMediaFile(file);

                // Add additional metadata based on file type
                if (file.mimetype.startsWith('video/')) {
                    const videoMeta = await generateVideoMetadata(file);
                    Object.assign(processedFile, videoMeta);
                } else if (file.mimetype.startsWith('audio/')) {
                    const audioMeta = await generateAudioMetadata(file);
                    Object.assign(processedFile, audioMeta);
                }

                processedFiles.push(processedFile);
                console.log(`✅ Processed: ${file.originalname} -> ${processedFile.url}`);

            } catch (error) {
                console.error(`❌ Failed to process ${file.originalname}:`, error.message);
                if (!req.body.skipErrors) {
                    throw error;
                }
            }
        }

        res.json({
            success: true,
            files: processedFiles,
            count: processedFiles.length
        });

    } catch (error) {
        console.error('❌ Media upload error:', error.message);
        res.status(500).json({
            error: 'Failed to process media files',
            message: error.message
        });
    }
});

// Interaction API endpoints

// Like/unlike a post
app.post('/api/posts/:postId/like', (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, userName } = req.body;

        if (!userId || !userName) {
            return res.status(400).json({ error: 'userId and userName are required' });
        }

        // Check if post exists
        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Initialize interactions if not exists
        if (!interactions[postId]) {
            interactions[postId] = { likes: [], shares: [], replies: [] };
        }

        const userLike = interactions[postId].likes.find(like => like.userId === userId);

        if (userLike) {
            // Unlike - remove existing like
            interactions[postId].likes = interactions[postId].likes.filter(like => like.userId !== userId);
            updateInteractionCounts(postId);

            // Broadcast real-time update
            webSocketService.broadcastInteraction('unlike', postId, {
                userId,
                userName,
                action: 'unliked',
                likesCount: interactions[postId].likes.length,
                timestamp: new Date().toISOString()
            });

            console.log(`👎 ${userName} unliked ${postId}`);
            res.json({
                success: true,
                action: 'unliked',
                likesCount: interactions[postId].likes.length
            });
        } else {
            // Like - add new like
            interactions[postId].likes.push({
                userId,
                userName,
                timestamp: new Date().toISOString()
            });
            updateInteractionCounts(postId);

            // Broadcast real-time update
            webSocketService.broadcastInteraction('like', postId, {
                userId,
                userName,
                action: 'liked',
                likesCount: interactions[postId].likes.length,
                timestamp: new Date().toISOString()
            });

            console.log(`👍 ${userName} liked ${postId}`);
            res.json({
                success: true,
                action: 'liked',
                likesCount: interactions[postId].likes.length
            });
        }

    } catch (error) {
        console.error('❌ Like error:', error.message);
        res.status(500).json({ error: 'Failed to process like' });
    }
});

// Share a post
app.post('/api/posts/:postId/share', (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, userName, message } = req.body;

        if (!userId || !userName) {
            return res.status(400).json({ error: 'userId and userName are required' });
        }

        // Check if post exists
        const post = posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Initialize interactions if not exists
        if (!interactions[postId]) {
            interactions[postId] = { likes: [], shares: [], replies: [] };
        }

        // Add share
        const shareId = `share-${interactionIdCounter++}`;
        interactions[postId].shares.push({
            id: shareId,
            userId,
            userName,
            message: message || null,
            timestamp: new Date().toISOString()
        });
        updateInteractionCounts(postId);

        // Broadcast real-time update
        webSocketService.broadcastInteraction('share', postId, {
            userId,
            userName,
            shareId: shareId,
            message: message || null,
            sharesCount: interactions[postId].shares.length,
            timestamp: new Date().toISOString()
        });

        console.log(`🔄 ${userName} shared ${postId}`);
        res.json({
            success: true,
            shareId: shareId,
            sharesCount: interactions[postId].shares.length
        });

    } catch (error) {
        console.error('❌ Share error:', error.message);
        res.status(500).json({ error: 'Failed to process share' });
    }
});

// Get interactions for a post
app.get('/api/posts/:postId/interactions', (req, res) => {
    const { postId } = req.params;
    const postInteractions = interactions[postId] || { likes: [], shares: [], replies: [] };

    res.json({
        postId,
        likes: postInteractions.likes,
        shares: postInteractions.shares,
        replies: postInteractions.replies,
        counts: {
            likes: postInteractions.likes.length,
            shares: postInteractions.shares.length,
            replies: postInteractions.replies.length
        }
    });
});

// Create new post with media attachments
app.post('/api/posts', upload.array('attachments', 5), async (req, res) => {
    try {
        const { title, content_text, content_markdown, summary, tags, author } = req.body;

        if (!title || (!content_text && !content_markdown)) {
            return res.status(400).json({
                error: 'Title and content (text or markdown) are required'
            });
        }

        // Process attachments if any
        let attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const processedFile = await processMediaFile(file);

                // Add alt text if provided
                if (req.body[`alt_${file.fieldname}`]) {
                    processedFile.alt_text = req.body[`alt_${file.fieldname}`];
                }

                attachments.push(processedFile);
            }
        }

        // Create new post
        const postId = `post-${Date.now()}`;
        const newPost = {
            id: postId,
            uuid: randomUUID(),
            title: title,
            content_text: content_text || null,
            content_markdown: content_markdown || null,
            content_html: null, // Will be generated from markdown
            summary: summary || null,
            datePublished: new Date().toISOString(),
            dateModified: null,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            author: author ? JSON.parse(author) : siteConfig.author,
            attachments: attachments,
            interactions: {
                replies_count: 0,
                likes_count: 0,
                shares_count: 0
            }
        };

        // Process markdown content
        processMarkdownContent(newPost);

        // Add to posts array
        posts.unshift(newPost); // Add to beginning

        // Initialize interactions
        interactions[postId] = {
            likes: [],
            shares: [],
            replies: []
        };

        console.log(`📝 New post created: ${title} (${attachments.length} attachments)`);

        res.status(201).json({
            success: true,
            post: newPost,
            message: 'Post created successfully'
        });

    } catch (error) {
        console.error('❌ Post creation error:', error.message);
        res.status(500).json({
            error: 'Failed to create post',
            message: error.message
        });
    }
});

// Import and use the new API routes
import commentsRouter from './api/comments.js';
import postsRouter from './api/posts.js';
import interactionsRouter from './api/interactions.js';
import bridgesRouter from './api/bridges.js';

// Mount the API routes
app.use('/api/comments', commentsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/bridges', bridgesRouter);

// WebSocket connection stats endpoint
app.get('/api/websocket/stats', (req, res) => {
  try {
    const stats = webSocketService.getConnectionStats();
    const users = webSocketService.getConnectedUsers();
    
    res.json({
      success: true,
      stats,
      connectedUsers: users,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get WebSocket stats',
      message: error.message
    });
  }
});

// Generate Ansybl feed
async function generateAnsyblFeed() {
    const feedMetadata = {
        title: siteConfig.title,
        description: siteConfig.description,
        home_page_url: siteConfig.baseUrl,
        feed_url: `${siteConfig.baseUrl}/feed.ansybl`,
        icon: `${siteConfig.baseUrl}/favicon.ico`,
        language: 'en',
        author: siteConfig.author
    };

    // Process markdown content for all posts
    posts.forEach(processMarkdownContent);

    // Combine posts and comments into feed items
    const postItems = posts.map(post => {
        const item = {
            id: `${siteConfig.baseUrl}/post/${post.id}`,
            url: `${siteConfig.baseUrl}/post/${post.id}`,
            title: post.title,
            date_published: post.datePublished,
            author: post.author
        };

        // Add optional UUID
        if (post.uuid) item.uuid = post.uuid;

        // Add content in available formats
        if (post.content_text) item.content_text = post.content_text;
        if (post.content_html) item.content_html = post.content_html;
        if (post.content_markdown) item.content_markdown = post.content_markdown;

        // Add summary
        if (post.summary) {
            item.summary = post.summary;
        } else if (post.content_text) {
            item.summary = generateContentSummary(post.content_text);
        }

        // Add modification date if exists
        if (post.dateModified) item.date_modified = post.dateModified;

        // Add tags
        if (post.tags && post.tags.length > 0) item.tags = post.tags;

        // Add attachments if any
        if (post.attachments && post.attachments.length > 0) item.attachments = post.attachments;

        // Add interactions
        if (post.interactions) {
            item.interactions = {
                replies_count: post.interactions.replies_count,
                likes_count: post.interactions.likes_count,
                shares_count: post.interactions.shares_count
            };

            // Add interaction URLs
            item.interactions.replies_url = `${siteConfig.baseUrl}/api/posts/${post.id}/comments`;
            item.interactions.likes_url = `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`;
            item.interactions.shares_url = `${siteConfig.baseUrl}/api/posts/${post.id}/interactions`;
        }

        return item;
    });

    const commentItems = comments.map(comment => ({
        id: `${siteConfig.baseUrl}/comment/${comment.id}`,
        url: `${siteConfig.baseUrl}/post/${comment.postId}#${comment.id}`,
        title: `Comment on "${posts.find(p => p.id === comment.postId)?.title || 'Unknown Post'}"`,
        content_text: comment.content,
        content_html: comment.contentHtml,
        date_published: comment.datePublished,
        tags: ['comment'],
        author: comment.author,
        in_reply_to: comment.inReplyTo
    }));

    // Combine and sort by date (newest first)
    const allItems = [...postItems, ...commentItems].sort((a, b) =>
        new Date(b.date_published) - new Date(a.date_published)
    );

    return await generator.createCompleteFeed(feedMetadata, allItems, keyPair.privateKey);
}

// HTML page generators
function generateHomePage() {
    const postsHtml = posts.map(post => {
        // Process markdown for preview
        const processedPost = processMarkdownContent({ ...post });
        const previewText = post.summary || generateContentSummary(post.content_text || '', 200);

        return `
    <article class="post-preview">
      <h2><a href="/post/${post.id}">${post.title}</a></h2>
      <div class="post-meta">
        <time datetime="${post.datePublished}">${new Date(post.datePublished).toLocaleDateString()}</time>
        ${post.dateModified ? `<span class="modified">(Updated)</span>` : ''}
        <span class="tags">
          ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
        </span>
      </div>
      <div class="post-summary-preview">${previewText}</div>
      <div class="post-interactions-preview">
        <span class="interaction-count">👍 ${post.interactions?.likes_count || 0}</span>
        <span class="interaction-count">🔄 ${post.interactions?.shares_count || 0}</span>
        <span class="interaction-count">💬 ${post.interactions?.replies_count || 0}</span>
      </div>
      <a href="/post/${post.id}" class="read-more">Read more →</a>
    </article>
  `;
    }).join('');

    return generatePageTemplate('Home', `
    <header class="site-header" role="banner">
      <div class="site-info">
        <h1>${siteConfig.title}</h1>
        <p class="site-description">${siteConfig.description}</p>
      </div>
      <nav class="feed-links" role="navigation" aria-label="Feed and API links">
        <a href="/feed.ansybl" class="feed-link" aria-label="View Ansybl feed">📡 Ansybl Feed</a>
        <a href="#api-demo" class="api-link" aria-label="View API demo">🔧 API Demo</a>
      </nav>
    </header>

    <section class="create-post-section" role="region" aria-labelledby="create-post-heading">
      <h2 id="create-post-heading">✍️ Create New Post</h2>
      <button onclick="toggleCreateForm()" class="create-post-btn" aria-expanded="false" aria-controls="create-post-form">Create Post</button>
      
      <div id="create-post-form" class="create-post-form" style="display: none;" role="region" aria-labelledby="create-post-heading">
        <form id="post-form" onsubmit="submitPost(event)" enctype="multipart/form-data" role="form" aria-label="Create new post form">
          <div class="form-group">
            <label for="post-title">Title *</label>
            <input type="text" id="post-title" name="title" required placeholder="Enter post title">
          </div>
          
          <div class="form-group">
            <label for="post-summary">Summary (optional)</label>
            <input type="text" id="post-summary" name="summary" placeholder="Brief description of the post">
          </div>
          
          <div class="form-group">
            <label>Content *</label>
            <div id="content-editor-container"></div>
          </div>
          
          <div class="form-group">
            <label for="post-tags">Tags (comma-separated)</label>
            <input type="text" id="post-tags" name="tags" placeholder="tag1, tag2, tag3">
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-button">Create Post</button>
            <button type="button" onclick="toggleCreateForm()" class="cancel-button">Cancel</button>
          </div>
        </form>
        
        <div id="post-creation-status" class="post-creation-status"></div>
      </div>
    </section>

    <main class="posts" role="main" aria-label="Blog posts" id="main-content">
      ${postsHtml}
    </main>

    <section id="api-demo" class="api-demo">
      <h2>🔧 Interactive Ansybl Demo</h2>
      <p>This site demonstrates a complete Ansybl implementation with live commenting. All content is cryptographically signed and syndicated through the feed.</p>
      
      <div class="api-endpoints">
        <div class="endpoint">
          <h3>Feed Endpoint</h3>
          <code>GET /feed.ansybl</code>
          <p>Returns the complete Ansybl feed with cryptographic signatures</p>
          <a href="/feed.ansybl" target="_blank" class="try-button">Try it →</a>
        </div>
        
        <div class="endpoint">
          <h3>Validation API</h3>
          <code>POST /api/validate</code>
          <p>Validate any Ansybl document against the schema</p>
          <button onclick="showValidationDemo()" class="try-button">Demo →</button>
        </div>
        
        <div class="endpoint">
          <h3>Parser API</h3>
          <code>POST /api/parse</code>
          <p>Parse and verify Ansybl documents with signature checking</p>
          <button onclick="showParserDemo()" class="try-button">Demo →</button>
        </div>
        
        <div class="endpoint">
          <h3>Comments API</h3>
          <code>POST /api/posts/:id/comments</code>
          <p>Add comments that automatically update the Ansybl feed</p>
          <button onclick="showCommentsDemo()" class="try-button">Demo →</button>
        </div>
        
        <div class="endpoint">
          <h3>Interactions API</h3>
          <code>POST /api/posts/:id/like</code>
          <p>Like posts and track social interactions in the feed</p>
          <button onclick="showInteractionsDemo()" class="try-button">Demo →</button>
        </div>
        
        <div class="endpoint">
          <h3>Media Upload API</h3>
          <code>POST /api/media/upload</code>
          <p>Upload images, videos, and audio with automatic processing</p>
          <button onclick="showMediaDemo()" class="try-button">Demo →</button>
        </div>
      </div>
    </section>

    <section class="protocol-bridges">
      <h2>🌉 Protocol Bridges</h2>
      <p>Convert Ansybl feeds to other popular syndication formats for maximum compatibility.</p>
      
      <div class="bridge-endpoints">
        <div class="endpoint">
          <h3>RSS 2.0 Bridge</h3>
          <code>GET /feed.rss</code>
          <p>Convert Ansybl feed to RSS 2.0 format for traditional feed readers</p>
          <a href="/feed.rss" target="_blank" class="try-button">View RSS →</a>
        </div>
        
        <div class="endpoint">
          <h3>JSON Feed Bridge</h3>
          <code>GET /feed.json</code>
          <p>Convert to JSON Feed 1.1 format with full metadata preservation</p>
          <a href="/feed.json" target="_blank" class="try-button">View JSON →</a>
        </div>
        
        <div class="endpoint">
          <h3>ActivityPub Bridge</h3>
          <code>GET /actor</code>
          <p>ActivityPub actor profile for federation with Mastodon and other platforms</p>
          <a href="/actor" target="_blank" class="try-button">View Actor →</a>
        </div>
        
        <div class="endpoint">
          <h3>Bridge API</h3>
          <code>POST /api/bridges/convert</code>
          <p>Convert between any supported formats programmatically</p>
          <button onclick="showBridgeDemo()" class="try-button">Demo →</button>
        </div>
      </div>
    </section>

    <div id="demo-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <span class="close" onclick="closeModal()">&times;</span>
        <div id="demo-content"></div>
      </div>
    </div>
  `);
}

function generatePostPage(post) {
    // Process markdown content
    const processedPost = processMarkdownContent({ ...post });

    return generatePageTemplate(post.title, `
    <nav class="breadcrumb">
      <a href="/">← Back to Home</a>
    </nav>

    <article class="post">
      <header class="post-header">
        <h1>${processedPost.title}</h1>
        <div class="post-meta">
          <time datetime="${processedPost.datePublished}">${new Date(processedPost.datePublished).toLocaleDateString()}</time>
          ${processedPost.dateModified ? `<span class="modified">(Updated: ${new Date(processedPost.dateModified).toLocaleDateString()})</span>` : ''}
          <span class="author">by ${processedPost.author.name}</span>
          <span class="tags">
            ${processedPost.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
          </span>
        </div>
        ${processedPost.summary ? `<div class="post-summary">${processedPost.summary}</div>` : ''}
      </header>
      
      <div class="post-content">
        ${processedPost.content_html || processedPost.content_text || ''}
      </div>
      
      ${processedPost.attachments && processedPost.attachments.length > 0 ? `
        <div class="post-attachments">
          <h3>📎 Attachments</h3>
          <div class="attachments-grid">
            ${processedPost.attachments.map(attachment => `
              <div class="attachment" data-type="${attachment.mime_type.split('/')[0]}">
                ${attachment.mime_type.startsWith('image/') ? `
                  <div class="image-attachment">
                    <img src="${attachment.thumbnail_url || attachment.url}" 
                         alt="${attachment.alt_text || attachment.title}"
                         onclick="openMediaModal('${attachment.url}', '${attachment.title}')"
                         loading="lazy"
                         ${attachment.width ? `width="${attachment.width > 400 ? 400 : attachment.width}"` : ''}
                         ${attachment.height ? `height="${attachment.height > 300 ? 300 : attachment.height}"` : ''}>
                    <div class="attachment-info">
                      <span class="attachment-title">${attachment.title}</span>
                      <span class="attachment-size">${Math.round(attachment.size_in_bytes / 1024)}KB</span>
                      ${attachment.width && attachment.height ? `<span class="attachment-dimensions">${attachment.width}×${attachment.height}</span>` : ''}
                    </div>
                  </div>
                ` : attachment.mime_type.startsWith('video/') ? `
                  <div class="video-attachment">
                    <video controls preload="metadata" ${attachment.width ? `width="${attachment.width > 400 ? 400 : attachment.width}"` : 'width="400"'}>
                      <source src="${attachment.url}" type="${attachment.mime_type}">
                      Your browser does not support the video tag.
                    </video>
                    <div class="attachment-info">
                      <span class="attachment-title">${attachment.title}</span>
                      <span class="attachment-size">${Math.round(attachment.size_in_bytes / 1024)}KB</span>
                      ${attachment.duration_in_seconds ? `<span class="attachment-duration">${Math.round(attachment.duration_in_seconds)}s</span>` : ''}
                    </div>
                  </div>
                ` : attachment.mime_type.startsWith('audio/') ? `
                  <div class="audio-attachment">
                    <audio controls preload="metadata">
                      <source src="${attachment.url}" type="${attachment.mime_type}">
                      Your browser does not support the audio tag.
                    </audio>
                    <div class="attachment-info">
                      <span class="attachment-title">${attachment.title}</span>
                      <span class="attachment-size">${Math.round(attachment.size_in_bytes / 1024)}KB</span>
                      ${attachment.duration_in_seconds ? `<span class="attachment-duration">${Math.round(attachment.duration_in_seconds)}s</span>` : ''}
                    </div>
                  </div>
                ` : `
                  <div class="file-attachment">
                    <a href="${attachment.url}" target="_blank" class="file-link">
                      <span class="file-icon">📄</span>
                      <div class="attachment-info">
                        <span class="attachment-title">${attachment.title}</span>
                        <span class="attachment-size">${Math.round(attachment.size_in_bytes / 1024)}KB</span>
                        <span class="attachment-type">${attachment.mime_type}</span>
                      </div>
                    </a>
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="post-interactions">
        <div class="interaction-buttons">
          <button id="like-btn" class="interaction-btn like-btn" onclick="toggleLike()">
            <span class="icon">👍</span>
            <span id="like-count">${processedPost.interactions?.likes_count || 0}</span>
            <span class="label">Like</span>
          </button>
          
          <button id="share-btn" class="interaction-btn share-btn" onclick="sharePost()">
            <span class="icon">🔄</span>
            <span id="share-count">${processedPost.interactions?.shares_count || 0}</span>
            <span class="label">Share</span>
          </button>
          
          <button class="interaction-btn reply-btn" onclick="scrollToComments()">
            <span class="icon">💬</span>
            <span id="reply-count">${processedPost.interactions?.replies_count || 0}</span>
            <span class="label">Reply</span>
          </button>
        </div>
        
        <div id="interaction-status" class="interaction-status"></div>
      </div>
      
      <footer class="post-footer">
        <div class="post-metadata">
          <p><strong>Ansybl ID:</strong> <code>${siteConfig.baseUrl}/post/${processedPost.id}</code></p>
          ${processedPost.uuid ? `<p><strong>UUID:</strong> <code>${processedPost.uuid}</code></p>` : ''}
          <p>This post is part of our <a href="/feed.ansybl">Ansybl feed</a> and is cryptographically signed.</p>
        </div>
      </footer>
    </article>

    <section class="comments-section">
      <h2>💬 Comments</h2>
      <p class="comments-info">Comments are automatically added to the <a href="/feed.ansybl">Ansybl feed</a> and cryptographically signed.</p>
      
      <div class="comment-form">
        <h3>Add a Comment</h3>
        <form id="comment-form" onsubmit="submitComment(event)">
          <div class="form-group">
            <label for="author-name">Name *</label>
            <input type="text" id="author-name" name="authorName" required placeholder="Your name">
          </div>
          
          <div class="form-group">
            <label for="author-url">Website (optional)</label>
            <input type="url" id="author-url" name="authorUrl" placeholder="https://your-website.com">
          </div>
          
          <div class="form-group">
            <label for="comment-content">Comment *</label>
            <textarea id="comment-content" name="content" required rows="4" placeholder="Share your thoughts..."></textarea>
          </div>
          
          <button type="submit" class="submit-button">Post Comment</button>
        </form>
        
        <div id="comment-status" class="comment-status"></div>
      </div>
      
      <div id="comments-list" class="comments-list">
        <div class="loading">Loading comments...</div>
      </div>
    </section>

    <script>
      const postId = '${post.id}';
      let currentUser = null;
      
      // Load comments and user state when page loads
      document.addEventListener('DOMContentLoaded', function() {
        initializeUser();
        loadComments();
        loadInteractionState();
      });
      
      function initializeUser() {
        // In a real app, this would be from authentication
        // For demo, we'll use localStorage or generate a demo user
        currentUser = localStorage.getItem('demoUser');
        if (!currentUser) {
          currentUser = JSON.stringify({
            id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
            name: 'Demo User'
          });
          localStorage.setItem('demoUser', currentUser);
        }
        currentUser = JSON.parse(currentUser);
      }
      
      async function toggleLike() {
        if (!currentUser) {
          showInteractionStatus('Please set up a user profile first', 'error');
          return;
        }
        
        const likeBtn = document.getElementById('like-btn');
        const likeCount = document.getElementById('like-count');
        
        likeBtn.disabled = true;
        
        try {
          const response = await fetch(\`/api/posts/\${postId}/like\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              userName: currentUser.name
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            likeCount.textContent = result.likesCount;
            
            if (result.action === 'liked') {
              likeBtn.classList.add('active');
              showInteractionStatus('👍 Liked! This interaction is recorded in the Ansybl feed.', 'success');
            } else {
              likeBtn.classList.remove('active');
              showInteractionStatus('Like removed', 'success');
            }
          } else {
            throw new Error(result.error);
          }
          
        } catch (error) {
          showInteractionStatus('Failed to process like: ' + error.message, 'error');
        } finally {
          likeBtn.disabled = false;
        }
      }
      
      async function sharePost() {
        if (!currentUser) {
          showInteractionStatus('Please set up a user profile first', 'error');
          return;
        }
        
        const shareBtn = document.getElementById('share-btn');
        const shareCount = document.getElementById('share-count');
        
        shareBtn.disabled = true;
        
        try {
          const response = await fetch(\`/api/posts/\${postId}/share\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              userName: currentUser.name,
              message: 'Shared via Ansybl demo'
            })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            shareCount.textContent = result.sharesCount;
            shareBtn.classList.add('active');
            showInteractionStatus('🔄 Shared! This share is recorded in the Ansybl feed.', 'success');
            
            // Remove active state after a moment
            setTimeout(() => shareBtn.classList.remove('active'), 2000);
          } else {
            throw new Error(result.error);
          }
          
        } catch (error) {
          showInteractionStatus('Failed to share: ' + error.message, 'error');
        } finally {
          shareBtn.disabled = false;
        }
      }
      
      function scrollToComments() {
        document.querySelector('.comments-section').scrollIntoView({ 
          behavior: 'smooth' 
        });
      }
      
      async function loadInteractionState() {
        try {
          const response = await fetch(\`/api/posts/\${postId}/interactions\`);
          const data = await response.json();
          
          // Check if current user has liked this post
          if (currentUser && data.likes.some(like => like.userId === currentUser.id)) {
            document.getElementById('like-btn').classList.add('active');
          }
          
        } catch (error) {
          console.error('Failed to load interaction state:', error);
        }
      }
      
      function showInteractionStatus(message, type) {
        const statusDiv = document.getElementById('interaction-status');
        statusDiv.textContent = message;
        statusDiv.className = \`interaction-status \${type}\`;
        
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 5000);
      }
      
      // Media modal functions
      function openMediaModal(url, title) {
        const modal = document.createElement('div');
        modal.className = 'media-modal';
        modal.innerHTML = \`
          <img src="\${url}" alt="\${title}">
          <div class="media-modal-close" onclick="closeMediaModal(this)">&times;</div>
        \`;
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Close on click outside
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            closeMediaModal(modal.querySelector('.media-modal-close'));
          }
        });
      }
      
      function closeMediaModal(closeBtn) {
        const modal = closeBtn.closest('.media-modal');
        modal.remove();
      }
      
      async function loadComments() {
        try {
          const response = await fetch(\`/api/posts/\${postId}/comments\`);
          const comments = await response.json();
          
          const commentsList = document.getElementById('comments-list');
          
          if (comments.length === 0) {
            commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
            return;
          }
          
          const commentsHtml = comments.map(comment => \`
            <div class="comment" id="\${comment.id}">
              <div class="comment-header">
                <strong class="comment-author">
                  \${comment.author.url ? 
                    \`<a href="\${comment.author.url}" target="_blank">\${comment.author.name}</a>\` : 
                    comment.author.name
                  }
                </strong>
                <time class="comment-date" datetime="\${comment.datePublished}">
                  \${new Date(comment.datePublished).toLocaleString()}
                </time>
              </div>
              <div class="comment-content">
                \${comment.contentHtml}
              </div>
              <div class="comment-meta">
                <small>Ansybl ID: <code>${siteConfig.baseUrl}/comment/\${comment.id}</code></small>
              </div>
            </div>
          \`).join('');
          
          commentsList.innerHTML = commentsHtml;
          
        } catch (error) {
          console.error('Error loading comments:', error);
          document.getElementById('comments-list').innerHTML = 
            '<div class="error">Failed to load comments. Please refresh the page.</div>';
        }
      }
      
      async function submitComment(event) {
        event.preventDefault();
        
        const form = event.target;
        const statusDiv = document.getElementById('comment-status');
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Get form data
        const formData = new FormData(form);
        const commentData = {
          author: {
            name: formData.get('authorName'),
            url: formData.get('authorUrl') || null
          },
          content: formData.get('content')
        };
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Posting...';
        statusDiv.innerHTML = '<div class="status-loading">⏳ Adding comment to Ansybl feed...</div>';
        
        try {
          const response = await fetch(\`/api/posts/\${postId}/comments\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentData)
          });
          
          const result = await response.json();
          
          if (response.ok) {
            statusDiv.innerHTML = '<div class="status-success">✅ Comment posted successfully!</div>';
            form.reset();
            
            // Reload comments to show the new one
            setTimeout(() => {
              loadComments();
              statusDiv.innerHTML = '';
            }, 2000);
            
          } else {
            throw new Error(result.error || 'Failed to post comment');
          }
          
        } catch (error) {
          console.error('Error posting comment:', error);
          statusDiv.innerHTML = \`<div class="status-error">❌ Error: \${error.message}</div>\`;
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Post Comment';
        }
      }
    </script>
  `);
}

function generate404Page() {
    return generatePageTemplate('Page Not Found', `
    <div class="error-page">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">← Return to Home</a>
    </div>
  `);
}

function generatePageTemplate(title, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteConfig.title}</title>
    <link rel="alternate" type="application/json" title="Ansybl Feed" href="/feed.ansybl">
    <link rel="stylesheet" href="/css/realtime.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .site-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .site-header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .site-description {
            color: #6c757d;
            font-size: 1.1em;
            margin-bottom: 20px;
        }
        
        .feed-links {
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        
        .feed-link, .api-link {
            padding: 8px 16px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
        }
        
        .feed-link:hover, .api-link:hover {
            background: #0056b3;
        }
        
        .post-preview {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .post-preview h2 {
            margin-bottom: 10px;
        }
        
        .post-preview h2 a {
            color: #2c3e50;
            text-decoration: none;
        }
        
        .post-preview h2 a:hover {
            color: #007bff;
        }
        
        .post-summary-preview {
            color: #6c757d;
            line-height: 1.6;
            margin: 15px 0;
        }
        
        .post-interactions-preview {
            display: flex;
            gap: 15px;
            margin: 15px 0;
            font-size: 0.9em;
        }
        
        .interaction-count {
            color: #6c757d;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        /* Post creation form styles */
        .create-post-section {
            margin-bottom: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .create-post-btn {
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .create-post-btn:hover {
            background: #218838;
        }
        
        .create-post-form {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        
        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .cancel-button {
            background: #6c757d;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .cancel-button:hover {
            background: #5a6268;
        }
        
        .post-creation-status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        
        .post-creation-status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        
        .post-creation-status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        
        .post-creation-status.loading {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            display: block;
        }
        
        .post-meta {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 15px;
        }
        
        .tags {
            margin-left: 15px;
        }
        
        .tag {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            margin-right: 5px;
        }
        
        .read-more {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
        }
        
        .api-demo {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
        }
        
        .protocol-bridges {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
        }
        
        .api-endpoints, .bridge-endpoints {
            display: grid;
            gap: 20px;
            margin-top: 20px;
        }
        
        .endpoint {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        
        .endpoint h3 {
            margin-bottom: 5px;
            color: #2c3e50;
        }
        
        .endpoint code {
            background: #e9ecef;
            padding: 4px 8px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
            color: #d63384;
        }
        
        .try-button {
            background: #28a745;
            color: white;
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            display: inline-block;
            margin-top: 10px;
            cursor: pointer;
        }
        
        .try-button:hover {
            background: #218838;
        }
        
        .breadcrumb {
            margin-bottom: 20px;
        }
        
        .breadcrumb a {
            color: #007bff;
            text-decoration: none;
        }
        
        .post {
            margin-bottom: 30px;
        }
        
        .post-header {
            margin-bottom: 30px;
        }
        
        .post-content {
            font-size: 1.1em;
            line-height: 1.7;
            margin-bottom: 30px;
        }
        
        .post-footer {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #17a2b8;
        }
        
        .error-page {
            text-align: center;
            padding: 60px 20px;
        }
        
        .modal {
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            color: black;
        }
        
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
        }
        
        .comments-section {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
        }
        
        .comments-info {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 30px;
        }
        
        .comment-form {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .comment-form h3 {
            margin-bottom: 20px;
            color: #2c3e50;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #495057;
        }
        
        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .submit-button {
            background: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .submit-button:hover:not(:disabled) {
            background: #0056b3;
        }
        
        .submit-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        
        .comment-status {
            margin-top: 15px;
        }
        
        .status-loading {
            color: #007bff;
            font-weight: 500;
        }
        
        .status-success {
            color: #28a745;
            font-weight: 500;
        }
        
        .status-error {
            color: #dc3545;
            font-weight: 500;
        }
        
        .comments-list {
            margin-top: 20px;
        }
        
        .comment {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 15px;
        }
        
        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f3f4;
        }
        
        .comment-author {
            color: #2c3e50;
        }
        
        .comment-author a {
            color: #007bff;
            text-decoration: none;
        }
        
        .comment-author a:hover {
            text-decoration: underline;
        }
        
        .comment-date {
            color: #6c757d;
            font-size: 0.85em;
        }
        
        .comment-content {
            margin-bottom: 10px;
            line-height: 1.6;
        }
        
        .comment-meta {
            color: #6c757d;
            font-size: 0.8em;
        }
        
        .comment-meta code {
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 0.75em;
        }
        
        .no-comments {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px 20px;
        }
        
        .loading {
            text-align: center;
            color: #6c757d;
            padding: 20px;
        }
        
        .error {
            color: #dc3545;
            text-align: center;
            padding: 20px;
        }
        
        .post-summary {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin: 15px 0;
            font-style: italic;
            color: #6c757d;
        }
        
        .modified {
            color: #28a745;
            font-size: 0.85em;
            margin-left: 10px;
        }
        
        .post-interactions {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .interaction-buttons {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .interaction-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
        }
        
        .interaction-btn:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .interaction-btn.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        
        .interaction-btn .icon {
            font-size: 16px;
        }
        
        .interaction-btn .label {
            font-weight: 500;
        }
        
        .like-btn.active {
            background: #28a745;
            border-color: #28a745;
        }
        
        .share-btn.active {
            background: #17a2b8;
            border-color: #17a2b8;
        }
        
        .interaction-status {
            font-size: 0.9em;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        
        .interaction-status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        
        .interaction-status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        
        .post-metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            font-size: 0.9em;
        }
        
        .post-metadata code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        
        /* Enhanced markdown content styles */
        .post-content h1, .post-content h2, .post-content h3 {
            margin-top: 25px;
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .post-content h1 {
            font-size: 1.8em;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        }
        
        .post-content h2 {
            font-size: 1.5em;
        }
        
        .post-content h3 {
            font-size: 1.3em;
        }
        
        .post-content blockquote {
            border-left: 4px solid #007bff;
            margin: 20px 0;
            padding: 15px 20px;
            background: #f8f9fa;
            font-style: italic;
        }
        
        .post-content pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            overflow-x: auto;
            margin: 15px 0;
        }
        
        .post-content code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
            color: #e83e8c;
        }
        
        .post-content pre code {
            background: none;
            padding: 0;
            color: inherit;
        }
        
        .post-content ul, .post-content ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .post-content li {
            margin: 8px 0;
        }
        
        /* Media attachments styles */
        .post-attachments {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .post-attachments h3 {
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .attachments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .attachment {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .image-attachment img {
            width: 100%;
            height: auto;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .image-attachment img:hover {
            transform: scale(1.02);
        }
        
        .video-attachment video,
        .audio-attachment audio {
            width: 100%;
        }
        
        .attachment-info {
            padding: 10px;
            background: white;
        }
        
        .attachment-title {
            display: block;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .attachment-size,
        .attachment-dimensions,
        .attachment-duration,
        .attachment-type {
            display: inline-block;
            font-size: 0.8em;
            color: #6c757d;
            margin-right: 10px;
        }
        
        .file-attachment {
            padding: 15px;
        }
        
        .file-link {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: inherit;
        }
        
        .file-link:hover {
            color: #007bff;
        }
        
        .file-icon {
            font-size: 24px;
        }
        
        /* Media modal */
        .media-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
        }
        
        .media-modal img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        }
        
        .media-modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            color: white;
            font-size: 30px;
            cursor: pointer;
            background: rgba(0,0,0,0.5);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        @media (max-width: 600px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            .feed-links {
                flex-direction: column;
                align-items: center;
            }
            
            .comment-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
    
    <script>
        function showValidationDemo() {
            const demoContent = \`
                <h2>Validation API Demo</h2>
                <p>Try validating an Ansybl document:</p>
                <textarea id="validation-input" rows="10" cols="50" style="width: 100%; font-family: monospace;">
{
  "version": "https://ansybl.org/version/1.0",
  "title": "Test Feed",
  "home_page_url": "https://example.com",
  "feed_url": "https://example.com/feed.ansybl",
  "author": {
    "name": "Test Author",
    "public_key": "ed25519:test_key_here"
  },
  "items": []
}
                </textarea>
                <br><br>
                <button onclick="validateDocument()" class="try-button">Validate</button>
                <div id="validation-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        function showParserDemo() {
            const demoContent = \`
                <h2>Parser API Demo</h2>
                <p>Parse our live feed:</p>
                <button onclick="parseCurrentFeed()" class="try-button">Parse Current Feed</button>
                <div id="parser-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        function showCommentsDemo() {
            const demoContent = \`
                <h2>Comments API Demo</h2>
                <p>Add a test comment to the first post:</p>
                <div style="margin: 15px 0;">
                    <label>Name:</label><br>
                    <input type="text" id="demo-author-name" value="API Demo User" style="width: 100%; padding: 5px; margin: 5px 0;">
                </div>
                <div style="margin: 15px 0;">
                    <label>Comment:</label><br>
                    <textarea id="demo-comment-content" rows="3" style="width: 100%; padding: 5px; margin: 5px 0;">This is a test comment added via the API! Comments are automatically included in the Ansybl feed with cryptographic signatures.</textarea>
                </div>
                <button onclick="submitDemoComment()" class="try-button">Add Comment</button>
                <div id="comment-demo-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        function showModal(content) {
            document.getElementById('demo-content').innerHTML = content;
            document.getElementById('demo-modal').style.display = 'block';
        }
        
        function closeModal() {
            document.getElementById('demo-modal').style.display = 'none';
        }
        
        async function validateDocument() {
            const input = document.getElementById('validation-input').value;
            const resultDiv = document.getElementById('validation-result');
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Validating...</div>';
            
            try {
                console.log('Sending validation request with:', input);
                
                const response = await fetch('/api/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: input
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const result = await response.json();
                console.log('Validation result:', result);
                
                if (result.valid) {
                    resultDiv.innerHTML = '<div style="color: green;"><strong>✅ Valid!</strong><br>The document passes all validation checks.</div>';
                } else {
                    const errors = result.errors.map(e => \`<li><strong>\${e.code}:</strong> \${e.message}</li>\`).join('');
                    resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Validation Errors:</strong><ul>\${errors}</ul></div>\`;
                }
            } catch (error) {
                console.error('Validation error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}<br><small>Check the browser console for more details.</small></div>\`;
            }
        }
        
        async function parseCurrentFeed() {
            const resultDiv = document.getElementById('parser-result');
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Fetching and parsing feed...</div>';
            
            try {
                console.log('Fetching feed...');
                const feedResponse = await fetch('/feed.ansybl');
                
                if (!feedResponse.ok) {
                    throw new Error(\`Failed to fetch feed: \${feedResponse.status}\`);
                }
                
                const feedData = await feedResponse.json();
                console.log('Feed data:', feedData);
                
                console.log('Parsing feed...');
                const parseResponse = await fetch('/api/parse?verify=true', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(feedData)
                });
                
                if (!parseResponse.ok) {
                    throw new Error(\`Parse request failed: \${parseResponse.status}\`);
                }
                
                const result = await parseResponse.json();
                console.log('Parse result:', result);
                
                if (result.success) {
                    const sigStatus = result.signatures ? (result.signatures.allValid ? 'Yes ✅' : 'No ❌') : 'Not checked';
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Parse Successful!</strong><br>
                            <strong>Feed:</strong> \${result.feed.title}<br>
                            <strong>Items:</strong> \${result.feed.items.length}<br>
                            <strong>Author:</strong> \${result.feed.author.name}<br>
                            <strong>Signatures Valid:</strong> \${sigStatus}
                        </div>
                    \`;
                } else {
                    const errors = result.errors.map(e => \`<li><strong>\${e.code}:</strong> \${e.message}</li>\`).join('');
                    resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Parse Errors:</strong><ul>\${errors}</ul></div>\`;
                }
            } catch (error) {
                console.error('Parse error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}<br><small>Check the browser console for more details.</small></div>\`;
            }
        }
        
        function showInteractionsDemo() {
            const demoContent = \`
                <h2>Interactions API Demo</h2>
                <p>Test the like and share functionality:</p>
                <div style="margin: 15px 0;">
                    <label>User Name:</label><br>
                    <input type="text" id="demo-user-name" value="API Demo User" style="width: 100%; padding: 5px; margin: 5px 0;">
                </div>
                <div style="display: flex; gap: 10px; margin: 20px 0;">
                    <button onclick="demoLikePost()" class="try-button">👍 Like Post 1</button>
                    <button onclick="demoSharePost()" class="try-button">🔄 Share Post 1</button>
                    <button onclick="demoGetInteractions()" class="try-button">📊 Get Interactions</button>
                </div>
                <div id="interactions-demo-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        async function demoLikePost() {
            const resultDiv = document.getElementById('interactions-demo-result');
            const userName = document.getElementById('demo-user-name').value;
            
            if (!userName) {
                resultDiv.innerHTML = '<div style="color: red;">❌ Please enter a user name</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Processing like...</div>';
            
            try {
                const response = await fetch('/api/posts/post-1/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: 'demo-' + Math.random().toString(36).substr(2, 9),
                        userName: userName
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ \${result.action === 'liked' ? 'Liked' : 'Unliked'}!</strong><br>
                            <strong>New like count:</strong> \${result.likesCount}<br>
                            <p style="margin-top: 10px;">
                                <a href="/post/post-1" target="_blank">View post with interactions →</a><br>
                                <a href="/feed.ansybl" target="_blank">Check updated feed →</a>
                            </p>
                        </div>
                    \`;
                } else {
                    throw new Error(result.error || 'Failed to like post');
                }
                
            } catch (error) {
                console.error('Like demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        async function demoSharePost() {
            const resultDiv = document.getElementById('interactions-demo-result');
            const userName = document.getElementById('demo-user-name').value;
            
            if (!userName) {
                resultDiv.innerHTML = '<div style="color: red;">❌ Please enter a user name</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Processing share...</div>';
            
            try {
                const response = await fetch('/api/posts/post-1/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: 'demo-' + Math.random().toString(36).substr(2, 9),
                        userName: userName,
                        message: 'Shared via API demo'
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Shared!</strong><br>
                            <strong>Share ID:</strong> \${result.shareId}<br>
                            <strong>New share count:</strong> \${result.sharesCount}<br>
                            <p style="margin-top: 10px;">
                                <a href="/post/post-1" target="_blank">View post with interactions →</a><br>
                                <a href="/feed.ansybl" target="_blank">Check updated feed →</a>
                            </p>
                        </div>
                    \`;
                } else {
                    throw new Error(result.error || 'Failed to share post');
                }
                
            } catch (error) {
                console.error('Share demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        async function demoGetInteractions() {
            const resultDiv = document.getElementById('interactions-demo-result');
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Loading interactions...</div>';
            
            try {
                const response = await fetch('/api/posts/post-1/interactions');
                const result = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Interactions Loaded!</strong><br>
                            <strong>Likes:</strong> \${result.counts.likes}<br>
                            <strong>Shares:</strong> \${result.counts.shares}<br>
                            <strong>Replies:</strong> \${result.counts.replies}<br>
                            <details style="margin-top: 10px;">
                                <summary>View Details</summary>
                                <pre style="font-size: 0.8em; max-height: 200px; overflow-y: auto;">\${JSON.stringify(result, null, 2)}</pre>
                            </details>
                        </div>
                    \`;
                } else {
                    throw new Error('Failed to load interactions');
                }
                
            } catch (error) {
                console.error('Interactions demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        function showMediaDemo() {
            const demoContent = \`
                <h2>Media Upload API Demo</h2>
                <p>Test media file upload and processing:</p>
                <div style="margin: 15px 0;">
                    <input type="file" id="demo-media-files" multiple accept="image/*,video/*,audio/*" style="width: 100%; padding: 5px;">
                    <small>Select images, videos, or audio files (max 5 files, 10MB each)</small>
                </div>
                <button onclick="demoUploadMedia()" class="try-button">📎 Upload Files</button>
                <div id="media-demo-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        function showBridgeDemo() {
            const demoContent = \`
                <h2>Protocol Bridge Demo</h2>
                <p>Convert between Ansybl and other syndication formats:</p>
                
                <div style="margin: 15px 0;">
                    <label>Source Format:</label><br>
                    <select id="bridge-from" style="width: 100%; padding: 5px; margin: 5px 0;">
                        <option value="ansybl">Ansybl</option>
                        <option value="rss">RSS 2.0</option>
                        <option value="jsonfeed">JSON Feed</option>
                        <option value="activitypub">ActivityPub</option>
                    </select>
                </div>
                
                <div style="margin: 15px 0;">
                    <label>Target Format:</label><br>
                    <select id="bridge-to" style="width: 100%; padding: 5px; margin: 5px 0;">
                        <option value="rss">RSS 2.0</option>
                        <option value="jsonfeed">JSON Feed</option>
                        <option value="activitypub">ActivityPub</option>
                        <option value="ansybl">Ansybl</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; margin: 20px 0;">
                    <button onclick="demoBridgeConversion()" class="try-button">🔄 Convert Current Feed</button>
                    <button onclick="showBridgeInfo()" class="try-button">📋 Bridge Info</button>
                </div>
                
                <div id="bridge-demo-result" style="margin-top: 20px;"></div>
            \`;
            showModal(demoContent);
        }
        
        async function demoUploadMedia() {
            const resultDiv = document.getElementById('media-demo-result');
            const fileInput = document.getElementById('demo-media-files');
            
            if (!fileInput.files || fileInput.files.length === 0) {
                resultDiv.innerHTML = '<div style="color: red;">❌ Please select at least one file</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Uploading and processing files...</div>';
            
            try {
                const formData = new FormData();
                for (let i = 0; i < fileInput.files.length; i++) {
                    formData.append('files', fileInput.files[i]);
                }
                
                const response = await fetch('/api/media/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    const filesHtml = result.files.map(file => \`
                        <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <strong>File:</strong> \${file.title}<br>
                            <strong>Type:</strong> \${file.mime_type}<br>
                            <strong>Size:</strong> \${Math.round(file.size_in_bytes / 1024)}KB<br>
                            \${file.width && file.height ? \`<strong>Dimensions:</strong> \${file.width}×\${file.height}<br>\` : ''}
                            <strong>URL:</strong> <a href="\${file.url}" target="_blank">View File</a><br>
                            \${file.thumbnail_url ? \`<strong>Thumbnail:</strong> <a href="\${file.thumbnail_url}" target="_blank">View Thumbnail</a><br>\` : ''}
                            \${file.blurhash ? \`<strong>BlurHash:</strong> \${file.blurhash}<br>\` : ''}
                        </div>
                    \`).join('');
                    
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Upload Successful!</strong><br>
                            <strong>Files processed:</strong> \${result.count}<br>
                            <div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">
                                \${filesHtml}
                            </div>
                        </div>
                    \`;
                } else {
                    throw new Error(result.error || 'Failed to upload files');
                }
                
            } catch (error) {
                console.error('Media upload demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        async function submitDemoComment() {
            const resultDiv = document.getElementById('comment-demo-result');
            const authorName = document.getElementById('demo-author-name').value;
            const content = document.getElementById('demo-comment-content').value;
            
            if (!authorName || !content) {
                resultDiv.innerHTML = '<div style="color: red;">❌ Please fill in both name and comment</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Adding comment to feed...</div>';
            
            try {
                const response = await fetch('/api/posts/post-1/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        author: { name: authorName },
                        content: content
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Comment Added!</strong><br>
                            <strong>Comment ID:</strong> \${result.comment.id}<br>
                            <strong>Added to feed:</strong> Yes<br>
                            <strong>Signed:</strong> Yes<br>
                            <p style="margin-top: 10px;">
                                <a href="/post/post-1" target="_blank">View on post page →</a><br>
                                <a href="/feed.ansybl" target="_blank">Check updated feed →</a>
                            </p>
                        </div>
                    \`;
                } else {
                    throw new Error(result.error || 'Failed to add comment');
                }
                
            } catch (error) {
                console.error('Comment demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        async function demoBridgeConversion() {
            const resultDiv = document.getElementById('bridge-demo-result');
            const fromFormat = document.getElementById('bridge-from').value;
            const toFormat = document.getElementById('bridge-to').value;
            
            if (fromFormat === toFormat) {
                resultDiv.innerHTML = '<div style="color: red;">❌ Source and target formats must be different</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Converting feed...</div>';
            
            try {
                let sourceData;
                
                // Fetch source data
                if (fromFormat === 'ansybl') {
                    const response = await fetch('/feed.ansybl');
                    sourceData = await response.json();
                } else if (fromFormat === 'rss') {
                    const response = await fetch('/feed.rss');
                    sourceData = await response.text();
                } else if (fromFormat === 'jsonfeed') {
                    const response = await fetch('/feed.json');
                    sourceData = await response.json();
                } else {
                    throw new Error('Unsupported source format for demo');
                }
                
                // Convert using bridge API
                const convertResponse = await fetch('/api/bridges/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: fromFormat,
                        to: toFormat,
                        data: sourceData,
                        options: {
                            baseUrl: window.location.origin,
                            feedUrl: window.location.origin + '/feed.ansybl'
                        }
                    })
                });
                
                const result = await convertResponse.json();
                
                if (convertResponse.ok) {
                    const resultPreview = typeof result.result === 'string' 
                        ? result.result.substring(0, 500) + (result.result.length > 500 ? '...' : '')
                        : JSON.stringify(result.result, null, 2).substring(0, 500) + '...';
                    
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Conversion Successful!</strong><br>
                            <strong>From:</strong> \${fromFormat}<br>
                            <strong>To:</strong> \${toFormat}<br>
                            <strong>Timestamp:</strong> \${result.timestamp}<br>
                            <details style="margin-top: 10px;">
                                <summary>Preview Result</summary>
                                <pre style="font-size: 0.8em; max-height: 200px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;">\${resultPreview}</pre>
                            </details>
                            <p style="margin-top: 10px;">
                                <a href="/feed.\${toFormat === 'jsonfeed' ? 'json' : toFormat}" target="_blank">View \${toFormat.toUpperCase()} feed →</a>
                            </p>
                        </div>
                    \`;
                } else {
                    throw new Error(result.error || 'Conversion failed');
                }
                
            } catch (error) {
                console.error('Bridge conversion demo error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        async function showBridgeInfo() {
            const resultDiv = document.getElementById('bridge-demo-result');
            
            resultDiv.innerHTML = '<div style="color: blue;">⏳ Loading bridge information...</div>';
            
            try {
                const response = await fetch('/api/bridges');
                const result = await response.json();
                
                if (response.ok) {
                    const bridgesHtml = Object.entries(result.bridges).map(([key, bridge]) => \`
                        <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <strong>\${bridge.name}</strong><br>
                            <em>\${bridge.description}</em><br>
                            <small>
                                Bidirectional: \${bridge.bidirectional ? 'Yes' : 'No'} | 
                                Signatures: \${bridge.preserves_signatures} | 
                                Interactions: \${bridge.preserves_interactions} | 
                                Format: \${bridge.output_format}
                            </small>
                        </div>
                    \`).join('');
                    
                    resultDiv.innerHTML = \`
                        <div style="color: green;">
                            <strong>✅ Bridge Information</strong><br>
                            <strong>Supported Bridges:</strong> \${result.supported.join(', ')}<br>
                            <div style="margin-top: 15px;">
                                \${bridgesHtml}
                            </div>
                            <p style="margin-top: 10px;">
                                <a href="/api/bridges" target="_blank">View full API response →</a>
                            </p>
                        </div>
                    \`;
                } else {
                    throw new Error('Failed to load bridge information');
                }
                
            } catch (error) {
                console.error('Bridge info error:', error);
                resultDiv.innerHTML = \`<div style="color: red;"><strong>❌ Error:</strong> \${error.message}</div>\`;
            }
        }
        
        // Post creation functions
        function toggleCreateForm() {
            const form = document.getElementById('create-post-form');
            const btn = document.querySelector('.create-post-btn');
            
            if (form.style.display === 'none') {
                form.style.display = 'block';
                btn.textContent = 'Hide Form';
                btn.setAttribute('aria-expanded', 'true');
                
                // Focus the first form field for accessibility
                setTimeout(() => {
                    const firstInput = form.querySelector('input, textarea');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }, 100);
                
                // Initialize content editor if not already done
                if (!window.contentEditor) {
                    setTimeout(() => {
                        window.contentEditor = new AnsyblContentEditor('content-editor-container');
                    }, 200);
                }
                
                // Announce to screen readers
                if (window.ansyblAccessibility) {
                    window.ansyblAccessibility.announceToScreenReader('Post creation form opened', 'polite');
                }
            } else {
                form.style.display = 'none';
                btn.textContent = 'Create Post';
                btn.setAttribute('aria-expanded', 'false');
                document.getElementById('post-form').reset();
                document.getElementById('post-creation-status').style.display = 'none';
                
                // Reset content editor
                if (window.contentEditor) {
                    window.contentEditor.reset();
                }
                
                // Return focus to the button
                btn.focus();
                
                // Announce to screen readers
                if (window.ansyblAccessibility) {
                    window.ansyblAccessibility.announceToScreenReader('Post creation form closed', 'polite');
                }
            }
        }
        
        async function submitPost(event) {
            event.preventDefault();
            
            const form = event.target;
            const statusDiv = document.getElementById('post-creation-status');
            const submitButton = form.querySelector('button[type="submit"]');
            
            // Get content from editor
            if (!window.contentEditor) {
                throw new Error('Content editor not initialized');
            }
            
            const editorContent = window.contentEditor.getContent();
            if (!editorContent.content || editorContent.content.trim().length === 0) {
                statusDiv.innerHTML = '❌ Please enter some content for your post';
                statusDiv.className = 'post-creation-status error';
                return;
            }
            
            // Show loading state
            submitButton.disabled = true;
            submitButton.textContent = 'Creating...';
            statusDiv.innerHTML = '⏳ Creating post and processing attachments...';
            statusDiv.className = 'post-creation-status loading';
            
            try {
                const formData = new FormData();
                
                // Add form fields
                formData.append('title', form.title.value);
                formData.append('summary', form.summary.value);
                formData.append('tags', form.tags.value);
                
                // Add content based on editor mode
                if (editorContent.mode === 'markdown') {
                    formData.append('content_markdown', editorContent.content);
                } else if (editorContent.mode === 'richtext') {
                    formData.append('content_html', editorContent.content);
                    // Convert HTML to text for content_text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = editorContent.content;
                    formData.append('content_text', tempDiv.textContent || tempDiv.innerText || '');
                } else {
                    formData.append('content_text', editorContent.content);
                }
                
                // Add attachments from editor
                editorContent.attachments.forEach((attachment, index) => {
                    if (attachment.file) {
                        formData.append('attachments', attachment.file);
                    }
                });
                
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    statusDiv.innerHTML = \`
                        ✅ Post created successfully!<br>
                        <strong>Title:</strong> \${result.post.title}<br>
                        <strong>Attachments:</strong> \${result.post.attachments.length}<br>
                        <a href="/post/\${result.post.id}" target="_blank">View Post →</a>
                    \`;
                    statusDiv.className = 'post-creation-status success';
                    
                    // Reset form and editor after success
                    form.reset();
                    window.contentEditor.reset();
                    
                    // Refresh page after a moment to show new post
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                } else {
                    throw new Error(result.error || 'Failed to create post');
                }
                
            } catch (error) {
                console.error('Post creation error:', error);
                statusDiv.innerHTML = \`❌ Error: \${error.message}\`;
                statusDiv.className = 'post-creation-status error';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Create Post';
            }
        }
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('demo-modal');
            if (event.target === modal) {
                closeModal();
            }
        }
    </script>
    
    <!-- Real-time WebSocket client -->
    <script src="/js/realtime.js"></script>
    
    <!-- Connection status indicator -->
    <div class="connection-status" id="connection-status">
        <div class="connection-indicator"></div>
        <span>Connecting...</span>
    </div>
    
    <script>
        // Initialize connection status indicator
        const connectionStatus = document.getElementById('connection-status');
        const indicator = connectionStatus.querySelector('.connection-indicator');
        const statusText = connectionStatus.querySelector('span');
        
        // Update connection status
        window.ansyblRealtime.onConnectionChange = (connected) => {
            if (connected) {
                connectionStatus.className = 'connection-status connected';
                statusText.textContent = 'Connected';
                indicator.classList.remove('pulse');
            } else {
                connectionStatus.className = 'connection-status disconnected';
                statusText.textContent = 'Disconnected';
                indicator.classList.add('pulse');
            }
        };
        
        // Handle typing indicators for comment forms
        document.addEventListener('input', (e) => {
            if (e.target.matches('#comment-content, textarea[name="content"]')) {
                const postId = window.location.pathname.match(/\\/post\\/(.+)/)?.[1];
                if (postId) {
                    window.ansyblRealtime.startTyping(postId);
                }
            }
        });
        
        document.addEventListener('blur', (e) => {
            if (e.target.matches('#comment-content, textarea[name="content"]')) {
                const postId = window.location.pathname.match(/\\/post\\/(.+)/)?.[1];
                if (postId) {
                    window.ansyblRealtime.stopTyping(postId);
                }
            }
        });
        
        // Add typing indicators container to comment sections
        document.addEventListener('DOMContentLoaded', () => {
            const commentsSections = document.querySelectorAll('.comments-section');
            commentsSections.forEach(section => {
                const typingContainer = document.createElement('div');
                typingContainer.className = 'typing-indicators';
                typingContainer.id = 'typing-indicators';
                section.appendChild(typingContainer);
            });
        });
        
        // Handle typing indicator updates
        window.ansyblRealtime.onTypingUpdate = (data, action) => {
            const typingContainer = document.getElementById('typing-indicators');
            if (!typingContainer) return;
            
            const indicatorId = \`typing-\${data.userId}\`;
            let indicator = document.getElementById(indicatorId);
            
            if (action === 'start') {
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.id = indicatorId;
                    indicator.className = 'typing-indicator';
                    indicator.innerHTML = \`
                        <span>\${data.userName} is typing</span>
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    \`;
                    typingContainer.appendChild(indicator);
                }
            } else if (action === 'stop' && indicator) {
                indicator.remove();
            }
        };
    </script>
</body>
</html>`;
}

// Start server
async function startServer() {
    // Create uploads directory if it doesn't exist
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log('� CrIeated uploads directory');
    }

    await initializeKeys();

    // Initialize WebSocket service
    webSocketService.initialize(server);

    server.listen(PORT, () => {
        console.log(`🚀 Ansybl Example Website running on http://localhost:${PORT}`);
        console.log(`📡 Feed available at: http://localhost:${PORT}/feed.ansybl`);
        console.log(`🔌 WebSocket server ready for real-time updates`);
        console.log(`🔧 API endpoints:`);
        console.log(`   POST /api/validate - Validate Ansybl documents`);
        console.log(`   POST /api/parse - Parse Ansybl documents`);
        console.log(`   GET /api/feed/info - Get feed metadata`);
        console.log(`   POST /api/media/upload - Upload media files`);
        console.log(`   POST /api/posts - Create new posts`);
        console.log(`   GET /api/interactions/analytics - Interaction analytics`);
        console.log(`🌉 Protocol bridges:`);
        console.log(`   GET /api/bridges - List available bridges`);
        console.log(`   POST /api/bridges/convert - Convert between formats`);
        console.log(`   GET /feed.rss - RSS 2.0 feed`);
        console.log(`   GET /feed.json - JSON Feed`);
        console.log(`   GET /actor - ActivityPub actor`);
    });
}

startServer().catch(console.error);