/**
 * Ansybl Example Website Server
 * Demonstrates implementation of the Ansybl protocol
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


// Import Ansybl utilities (assuming they're copied from schema folder)
import { AnsyblGenerator } from './lib/generator.js';
import { AnsyblValidator } from './lib/validator.js';
import { AnsyblParser } from './lib/parser.js';
import { generateKeyPair } from './lib/signature.js';

// Import markdown and sanitization
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Setup DOMPurify for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
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

// Static files
app.use(express.static(join(__dirname, 'public')));

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
    const processedPost = processMarkdownContent({...post});
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
    <header class="site-header">
      <h1>${siteConfig.title}</h1>
      <p class="site-description">${siteConfig.description}</p>
      <div class="feed-links">
        <a href="/feed.ansybl" class="feed-link">📡 Ansybl Feed</a>
        <a href="#api-demo" class="api-link">🔧 API Demo</a>
      </div>
    </header>

    <main class="posts">
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
  const processedPost = processMarkdownContent({...post});
  
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
                <small>Ansybl ID: <code>\${siteConfig.baseUrl}/comment/\${comment.id}</code></small>
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
        
        .api-endpoints {
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
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('demo-modal');
            if (event.target === modal) {
                closeModal();
            }
        }
    </script>
</body>
</html>`;
}

// Start server
async function startServer() {
  await initializeKeys();
  
  app.listen(PORT, () => {
    console.log(`🚀 Ansybl Example Website running on http://localhost:${PORT}`);
    console.log(`📡 Feed available at: http://localhost:${PORT}/feed.ansybl`);
    console.log(`🔧 API endpoints:`);
    console.log(`   POST /api/validate - Validate Ansybl documents`);
    console.log(`   POST /api/parse - Parse Ansybl documents`);
    console.log(`   GET /api/feed/info - Get feed metadata`);
  });
}

startServer().catch(console.error);