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
  description: 'A demonstration of the Ansybl social syndication protocol',
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

// Sample posts data
let posts = [
  {
    id: 'post-1',
    title: 'Welcome to Ansybl',
    content: 'This is an example post demonstrating the Ansybl protocol. Ansybl enables decentralized social syndication with cryptographic signatures.',
    contentHtml: '<p>This is an example post demonstrating the <strong>Ansybl protocol</strong>. Ansybl enables decentralized social syndication with cryptographic signatures.</p>',
    datePublished: '2025-11-04T10:00:00Z',
    tags: ['ansybl', 'demo', 'welcome'],
    author: siteConfig.author
  },
  {
    id: 'post-2',
    title: 'Understanding Cryptographic Signatures',
    content: 'Every item in an Ansybl feed is cryptographically signed using Ed25519, ensuring authenticity and preventing tampering.',
    contentHtml: '<p>Every item in an Ansybl feed is cryptographically signed using <code>Ed25519</code>, ensuring authenticity and preventing tampering.</p>',
    datePublished: '2025-11-04T11:30:00Z',
    tags: ['cryptography', 'security', 'ed25519'],
    author: siteConfig.author
  },
  {
    id: 'post-3',
    title: 'Decentralized Social Media',
    content: 'Ansybl promotes a decentralized approach to social media, where users control their own data and can syndicate content across platforms.',
    contentHtml: '<p>Ansybl promotes a <em>decentralized approach</em> to social media, where users control their own data and can syndicate content across platforms.</p>',
    datePublished: '2025-11-04T14:15:00Z',
    tags: ['decentralization', 'social-media', 'data-ownership'],
    author: siteConfig.author
  }
];

// Generate key pair for signing (in production, this should be persistent)
let keyPair = null;

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
app.get('/feed.ansybl', async (req, res) => {
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
    itemCount: posts.length,
    lastUpdated: posts.length > 0 ? posts[0].datePublished : new Date().toISOString()
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

  const feedItems = posts.map(post => ({
    id: `${siteConfig.baseUrl}/post/${post.id}`,
    url: `${siteConfig.baseUrl}/post/${post.id}`,
    title: post.title,
    content_text: post.content,
    content_html: post.contentHtml,
    date_published: post.datePublished,
    tags: post.tags,
    author: post.author
  }));

  return await generator.createCompleteFeed(feedMetadata, feedItems, keyPair.privateKey);
}

// HTML page generators
function generateHomePage() {
  const postsHtml = posts.map(post => `
    <article class="post-preview">
      <h2><a href="/post/${post.id}">${post.title}</a></h2>
      <div class="post-meta">
        <time datetime="${post.datePublished}">${new Date(post.datePublished).toLocaleDateString()}</time>
        <span class="tags">
          ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
        </span>
      </div>
      <p>${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}</p>
      <a href="/post/${post.id}" class="read-more">Read more →</a>
    </article>
  `).join('');

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
      <h2>🔧 API Demonstration</h2>
      <p>This site implements the Ansybl protocol. Try these endpoints:</p>
      
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
  return generatePageTemplate(post.title, `
    <nav class="breadcrumb">
      <a href="/">← Back to Home</a>
    </nav>

    <article class="post">
      <header class="post-header">
        <h1>${post.title}</h1>
        <div class="post-meta">
          <time datetime="${post.datePublished}">${new Date(post.datePublished).toLocaleDateString()}</time>
          <span class="author">by ${post.author.name}</span>
          <span class="tags">
            ${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
          </span>
        </div>
      </header>
      
      <div class="post-content">
        ${post.contentHtml}
      </div>
      
      <footer class="post-footer">
        <p><strong>Ansybl ID:</strong> <code>${siteConfig.baseUrl}/post/${post.id}</code></p>
        <p>This post is part of our <a href="/feed.ansybl">Ansybl feed</a> and is cryptographically signed.</p>
      </footer>
    </article>
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
        
        @media (max-width: 600px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            .feed-links {
                flex-direction: column;
                align-items: center;
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