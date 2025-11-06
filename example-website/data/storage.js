/**
 * In-memory data storage
 * In production, this would be replaced with a proper database
 */

import { siteConfig } from './config.js';

// Sample posts data with enhanced features
export let posts = [
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

// Comments storage with threading support
export let comments = [];
export let commentIdCounter = 1;

// Comment moderation storage
export let moderationActions = [];
export let moderationIdCounter = 1;

// Interactions storage
export let interactions = {};
export let interactionIdCounter = 1;

// Initialize interactions for existing posts
posts.forEach(post => {
  interactions[post.id] = {
    likes: [],
    shares: [],
    replies: []
  };
});

// Key pair storage
export let keyPair = null;

export function setKeyPair(newKeyPair) {
  keyPair = newKeyPair;
}

export function getKeyPair() {
  return keyPair;
}