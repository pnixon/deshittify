/**
 * Example usage of the Ansybl Parser
 * Demonstrates parsing, validation, and error handling
 */

import { AnsyblParser } from './parser.js';
import { generateKeyPair, signContent } from './signature.js';

async function demonstrateParser() {
  console.log('🚀 Ansybl Parser Demo\n');

  // Create parser instance
  const parser = new AnsyblParser();
  
  // Generate test key pair
  console.log('📝 Generating test key pair...');
  const keyPair = await generateKeyPair();
  console.log('✅ Key pair generated\n');

  // Example 1: Parse a valid document
  console.log('📄 Example 1: Parsing valid document');
  const validDoc = {
    version: 'https://ansybl.org/version/1.0',
    title: 'My Ansybl Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    description: 'A sample Ansybl feed for demonstration',
    author: {
      name: 'Demo Author',
      url: 'https://example.com/author',
      public_key: keyPair.publicKey
    },
    items: [{
      id: 'https://example.com/post/1',
      url: 'https://example.com/post/1',
      title: 'Hello Ansybl!',
      content_text: 'This is my first post using the Ansybl protocol.',
      content_html: '<p>This is my first post using the <strong>Ansybl protocol</strong>.</p>',
      date_published: '2025-11-04T10:00:00Z',
      tags: ['ansybl', 'demo', 'first-post'],
      signature: await signContent({
        date_published: '2025-11-04T10:00:00Z',
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        title: 'Hello Ansybl!',
        content_text: 'This is my first post using the Ansybl protocol.',
        content_html: '<p>This is my first post using the <strong>Ansybl protocol</strong>.</p>'
      }, keyPair.privateKey)
    }]
  };

  const result1 = await parser.parse(validDoc, { verifySignatures: true });
  
  if (result1.success) {
    console.log('✅ Document parsed successfully!');
    console.log(`   Feed: ${result1.feed.title}`);
    console.log(`   Items: ${result1.feed.items.length}`);
    console.log(`   Signatures valid: ${result1.signatures.allValid}`);
  } else {
    console.log('❌ Parsing failed:', result1.errors[0].message);
  }
  console.log();

  // Example 2: Parse document with validation errors
  console.log('📄 Example 2: Handling validation errors');
  const invalidDoc = {
    version: 'https://ansybl.org/version/1.0',
    title: 'Invalid Feed',
    home_page_url: 'http://example.com', // Should be HTTPS
    feed_url: 'https://example.com/feed.ansybl',
    author: {
      name: 'Demo Author',
      public_key: keyPair.publicKey
    },
    items: [{
      id: 'https://example.com/post/1',
      url: 'https://example.com/post/1',
      content_text: 'Hello world',
      date_published: 'invalid-date', // Invalid date format
      signature: 'ed25519:fake_signature'
    }]
  };

  const result2 = await parser.parse(invalidDoc, { verifySignatures: false });
  
  if (!result2.success) {
    console.log('❌ Validation errors found:');
    result2.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.message}`);
      if (error.suggestions.length > 0) {
        console.log(`      Suggestion: ${error.suggestions[0]}`);
      }
    });
  }
  console.log();

  // Example 3: Parse with extensions
  console.log('📄 Example 3: Parsing with extension fields');
  const docWithExtensions = {
    version: 'https://ansybl.org/version/1.0',
    title: 'Extended Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    author: {
      name: 'Demo Author',
      public_key: keyPair.publicKey,
      _custom_bio: 'This is a custom bio field'
    },
    _feed_theme: 'dark',
    _analytics_id: 'GA-123456',
    items: [{
      id: 'https://example.com/post/1',
      url: 'https://example.com/post/1',
      content_text: 'Post with extensions',
      date_published: '2025-11-04T10:00:00Z',
      _custom_priority: 'high',
      signature: 'ed25519:fake_signature'
    }]
  };

  const result3 = await parser.parse(docWithExtensions, { 
    verifySignatures: false,
    preserveExtensions: true 
  });
  
  if (result3.success) {
    console.log('✅ Document with extensions parsed successfully!');
    console.log(`   Feed theme: ${result3.feed._feed_theme}`);
    console.log(`   Author bio: ${result3.feed.author._custom_bio}`);
    console.log(`   Item priority: ${result3.feed.items[0]._custom_priority}`);
  }
  console.log();

  // Example 4: Item filtering
  console.log('📄 Example 4: Filtering feed items');
  const feedWithMultipleItems = {
    version: 'https://ansybl.org/version/1.0',
    title: 'Multi-Item Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    author: {
      name: 'Demo Author',
      public_key: keyPair.publicKey
    },
    items: [
      {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Tech post about programming',
        date_published: '2025-11-01T10:00:00Z',
        tags: ['tech', 'programming'],
        signature: 'ed25519:fake1'
      },
      {
        id: 'https://example.com/post/2',
        url: 'https://example.com/post/2',
        content_text: 'Design post about UI',
        date_published: '2025-11-02T10:00:00Z',
        tags: ['design', 'ui'],
        signature: 'ed25519:fake2'
      },
      {
        id: 'https://example.com/post/3',
        url: 'https://example.com/post/3',
        content_text: 'Another tech post',
        date_published: '2025-11-03T10:00:00Z',
        tags: ['tech', 'javascript'],
        signature: 'ed25519:fake3'
      }
    ]
  };

  const result4 = await parser.parse(feedWithMultipleItems, { verifySignatures: false });
  
  if (result4.success) {
    console.log('✅ Multi-item feed parsed successfully!');
    
    // Filter by tags
    const techPosts = parser.getItems(result4.feed, { tags: ['tech'] });
    console.log(`   Tech posts: ${techPosts.length}`);
    
    // Filter by date
    const recentPosts = parser.getItems(result4.feed, { 
      dateFrom: '2025-11-02T00:00:00Z' 
    });
    console.log(`   Recent posts: ${recentPosts.length}`);
    
    // Apply limit
    const limitedPosts = parser.getItems(result4.feed, { limit: 2 });
    console.log(`   Limited posts: ${limitedPosts.length}`);
  }
  console.log();

  console.log('🎉 Parser demonstration complete!');
}

// Run the demonstration
demonstrateParser().catch(console.error);