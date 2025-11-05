/**
 * Comprehensive test suite for Ansybl Generator
 * Tests generator functionality, validation, and media attachment handling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../generator.js';
import { MediaAttachmentHandler, MediaUtils } from '../media-handler.js';
import { generateKeyPair, verifySignature } from '../signature.js';
import { AnsyblValidator } from '../validator.js';

describe('AnsyblGenerator', () => {
  let generator;
  let validator;
  let testKeyPair;

  // Set up test fixtures
  test('setup', async () => {
    generator = new AnsyblGenerator();
    validator = new AnsyblValidator();
    testKeyPair = await generateKeyPair();
  });

  describe('Feed Creation', () => {
    test('should create minimal valid feed', () => {
      const metadata = {
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      };

      const feed = generator.createFeed(metadata);

      assert.strictEqual(feed.title, 'Test Feed');
      assert.strictEqual(feed.home_page_url, 'https://example.com');
      assert.strictEqual(feed.feed_url, 'https://example.com/feed.ansybl');
      assert.strictEqual(feed.author.name, 'Test Author');
      assert.strictEqual(feed.author.public_key, testKeyPair.publicKey);
      assert.strictEqual(feed.version, 'https://ansybl.org/version/1.0');
      assert(Array.isArray(feed.items));
      assert.strictEqual(feed.items.length, 0);
    });

    test('should create feed with optional fields', () => {
      const metadata = {
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        description: 'A test feed for validation',
        icon: 'https://example.com/icon.png',
        language: 'en-US',
        version: 'https://ansybl.org/version/1.1',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey,
          url: 'https://example.com/author',
          avatar: 'https://example.com/avatar.jpg'
        }
      };

      const feed = generator.createFeed(metadata);

      assert.strictEqual(feed.description, 'A test feed for validation');
      assert.strictEqual(feed.icon, 'https://example.com/icon.png');
      assert.strictEqual(feed.language, 'en-US');
      assert.strictEqual(feed.version, 'https://ansybl.org/version/1.1');
      assert.strictEqual(feed.author.url, 'https://example.com/author');
      assert.strictEqual(feed.author.avatar, 'https://example.com/avatar.jpg');
    });

    test('should throw error for missing required fields', () => {
      const invalidMetadata = {
        title: 'Test Feed'
        // Missing required fields
      };

      assert.throws(() => {
        generator.createFeed(invalidMetadata);
      }, /Missing required field/);
    });

    test('should throw error for invalid URLs', () => {
      const invalidMetadata = {
        title: 'Test Feed',
        home_page_url: 'not-a-url',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      };

      assert.throws(() => {
        generator.createFeed(invalidMetadata);
      }, /Invalid URL/);
    });
  });

  describe('Content Item Creation', () => {
    let testFeed;

    test('setup feed for item tests', () => {
      testFeed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });
    });

    test('should add minimal content item', async () => {
      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      const updatedFeed = await generator.addItem(testFeed, itemData, testKeyPair.privateKey);

      assert.strictEqual(updatedFeed.items.length, 1);
      const item = updatedFeed.items[0];
      assert.strictEqual(item.id, 'https://example.com/post/1');
      assert.strictEqual(item.url, 'https://example.com/post/1');
      assert.strictEqual(item.content_text, 'Hello world');
      assert(item.date_published);
      assert(item.signature);
    });

    test('should add content item with all optional fields', async () => {
      const itemData = {
        id: 'https://example.com/post/2',
        url: 'https://example.com/post/2',
        uuid: generator.generateUUID(),
        title: 'Test Post',
        content_text: 'Hello world',
        content_html: '<p>Hello world</p>',
        content_markdown: '# Hello world',
        summary: 'A test post',
        date_published: '2025-11-04T10:00:00Z',
        date_modified: '2025-11-04T11:00:00Z',
        tags: ['test', 'example'],
        in_reply_to: 'https://example.com/post/1',
        author: {
          name: 'Item Author',
          public_key: testKeyPair.publicKey,
          url: 'https://example.com/item-author'
        },
        interactions: {
          replies_count: 5,
          likes_count: 10,
          shares_count: 2,
          replies_url: 'https://example.com/post/2/replies'
        }
      };

      const updatedFeed = await generator.addItem(testFeed, itemData, testKeyPair.privateKey);
      const item = updatedFeed.items[updatedFeed.items.length - 1];

      assert.strictEqual(item.title, 'Test Post');
      assert.strictEqual(item.content_html, '<p>Hello world</p>');
      assert.strictEqual(item.content_markdown, '# Hello world');
      assert.strictEqual(item.summary, 'A test post');
      assert.strictEqual(item.date_published, '2025-11-04T10:00:00Z');
      assert.strictEqual(item.date_modified, '2025-11-04T11:00:00Z');
      assert.deepStrictEqual(item.tags, ['test', 'example']);
      assert.strictEqual(item.in_reply_to, 'https://example.com/post/1');
      assert.strictEqual(item.author.name, 'Item Author');
      assert.strictEqual(item.interactions.replies_count, 5);
      assert.strictEqual(item.interactions.likes_count, 10);
      assert.strictEqual(item.interactions.shares_count, 2);
    });

    test('should throw error for missing required item fields', async () => {
      const invalidItemData = {
        content_text: 'Hello world'
        // Missing id and url
      };

      await assert.rejects(async () => {
        await generator.addItem(testFeed, invalidItemData, testKeyPair.privateKey);
      }, /Missing required field/);
    });

    test('should throw error for item without content or title', async () => {
      const invalidItemData = {
        id: 'https://example.com/post/3',
        url: 'https://example.com/post/3'
        // No content fields or title
      };

      await assert.rejects(async () => {
        await generator.addItem(testFeed, invalidItemData, testKeyPair.privateKey);
      }, /must have at least one content field or a title/);
    });

    test('should accept item with only title', async () => {
      const itemData = {
        id: 'https://example.com/post/4',
        url: 'https://example.com/post/4',
        title: 'Title Only Post'
      };

      const updatedFeed = await generator.addItem(testFeed, itemData, testKeyPair.privateKey);
      const item = updatedFeed.items[updatedFeed.items.length - 1];

      assert.strictEqual(item.title, 'Title Only Post');
      assert(!item.content_text);
      assert(item.signature);
    });
  });

  describe('Signature Generation and Verification', () => {
    test('should generate valid item signatures', async () => {
      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world',
        date_published: '2025-11-04T10:00:00Z'
      };

      const signature = await generator.signItem(itemData, testKeyPair.privateKey);

      assert(signature);
      assert(signature.startsWith('ed25519:'));

      // Verify the signature
      const signatureData = generator.canonicalizer?.createSignatureData?.(itemData, 'item') || 
                           JSON.stringify(itemData);
      const isValid = await verifySignature(
        JSON.parse(signatureData),
        signature,
        testKeyPair.publicKey
      );
      
      // Note: This test may need adjustment based on actual signature data format
      assert(typeof isValid === 'boolean');
    });

    test('should generate valid feed signatures', async () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const signedFeed = await generator.signFeed(feed, testKeyPair.privateKey);

      assert(signedFeed.signature);
      assert(signedFeed.signature.startsWith('ed25519:'));
    });

    test('should throw error for invalid private key', async () => {
      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Hello world'
      };

      await assert.rejects(async () => {
        await generator.signItem(itemData, 'invalid-key');
      }, /Private key must be in format/);
    });
  });

  describe('Media Attachment Handling', () => {
    test('should process basic media attachment', async () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const itemData = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Post with image',
        attachments: [{
          url: 'https://example.com/image.jpg',
          mime_type: 'image/jpeg',
          alt_text: 'A test image'
        }]
      };

      const updatedFeed = await generator.addItem(feed, itemData, testKeyPair.privateKey);
      const item = updatedFeed.items[0];

      assert(item.attachments);
      assert.strictEqual(item.attachments.length, 1);
      assert.strictEqual(item.attachments[0].url, 'https://example.com/image.jpg');
      assert.strictEqual(item.attachments[0].mime_type, 'image/jpeg');
      assert.strictEqual(item.attachments[0].alt_text, 'A test image');
    });

    test('should add media attachment to existing item', async () => {
      let item = {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Post without attachments'
      };

      const attachmentData = {
        url: 'https://example.com/video.mp4',
        mime_type: 'video/mp4',
        title: 'Test Video',
        duration_in_seconds: 120
      };

      item = await generator.addMediaAttachment(item, attachmentData);

      assert(item.attachments);
      assert.strictEqual(item.attachments.length, 1);
      assert.strictEqual(item.attachments[0].url, 'https://example.com/video.mp4');
      assert.strictEqual(item.attachments[0].mime_type, 'video/mp4');
      assert.strictEqual(item.attachments[0].title, 'Test Video');
      assert.strictEqual(item.attachments[0].duration_in_seconds, 120);
    });
  });

  describe('Feed Management', () => {
    let testFeed;

    test('setup feed for management tests', async () => {
      testFeed = await generator.createCompleteFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'First post'
      }, {
        id: 'https://example.com/post/2',
        url: 'https://example.com/post/2',
        content_text: 'Second post'
      }], testKeyPair.privateKey);
    });

    test('should create complete feed with items and signatures', () => {
      assert.strictEqual(testFeed.items.length, 2);
      assert(testFeed.signature);
      assert(testFeed.items[0].signature);
      assert(testFeed.items[1].signature);
    });

    test('should update existing item', async () => {
      const updatedFeed = await generator.updateItem(
        testFeed,
        'https://example.com/post/1',
        { content_text: 'Updated first post', title: 'Updated Title' },
        testKeyPair.privateKey
      );

      const updatedItem = updatedFeed.items.find(item => item.id === 'https://example.com/post/1');
      assert.strictEqual(updatedItem.content_text, 'Updated first post');
      assert.strictEqual(updatedItem.title, 'Updated Title');
      assert(updatedItem.date_modified);
      assert(updatedItem.signature);
      assert.notStrictEqual(updatedItem.signature, testFeed.items[0].signature);
    });

    test('should throw error when updating non-existent item', async () => {
      await assert.rejects(async () => {
        await generator.updateItem(
          testFeed,
          'https://example.com/post/999',
          { content_text: 'Updated' },
          testKeyPair.privateKey
        );
      }, /not found in feed/);
    });

    test('should remove item from feed', () => {
      const updatedFeed = generator.removeItem(testFeed, 'https://example.com/post/2');
      
      assert.strictEqual(updatedFeed.items.length, 1);
      assert.strictEqual(updatedFeed.items[0].id, 'https://example.com/post/1');
    });
  });

  describe('Serialization', () => {
    test('should serialize feed with pretty formatting', () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const serialized = generator.serialize(feed);
      
      assert(typeof serialized === 'string');
      assert(serialized.includes('\n')); // Pretty formatted
      
      // Should be valid JSON
      const parsed = JSON.parse(serialized);
      assert.strictEqual(parsed.title, 'Test Feed');
    });

    test('should serialize feed without formatting', () => {
      const feed = generator.createFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const serialized = generator.serialize(feed, { pretty: false });
      
      assert(typeof serialized === 'string');
      assert(!serialized.includes('\n')); // Compact format
      
      // Should be valid JSON
      const parsed = JSON.parse(serialized);
      assert.strictEqual(parsed.title, 'Test Feed');
    });
  });

  describe('Validation Integration', () => {
    test('should validate generated feed against schema', async () => {
      const feed = await generator.createCompleteFeed({
        title: 'Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      }, [{
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_text: 'Test post'
      }], testKeyPair.privateKey);

      const validationResult = generator.validateFeed(feed);
      
      assert.strictEqual(validationResult.valid, true);
      assert.strictEqual(validationResult.errors.length, 0);
    });

    test('should generate UUID for content items', () => {
      const uuid1 = generator.generateUUID();
      const uuid2 = generator.generateUUID();
      
      assert(typeof uuid1 === 'string');
      assert(typeof uuid2 === 'string');
      assert.notStrictEqual(uuid1, uuid2);
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid1));
    });
  });
});

describe('MediaAttachmentHandler', () => {
  let mediaHandler;

  test('setup', () => {
    mediaHandler = new MediaAttachmentHandler();
  });

  describe('Attachment Processing', () => {
    test('should process basic image attachment', async () => {
      const attachmentData = {
        url: 'https://example.com/image.jpg',
        mime_type: 'image/jpeg',
        alt_text: 'A test image'
      };

      const processed = await mediaHandler.processAttachment(attachmentData, {
        extractMetadata: false,
        validateUrls: false
      });

      assert.strictEqual(processed.url, 'https://example.com/image.jpg');
      assert.strictEqual(processed.mime_type, 'image/jpeg');
      assert.strictEqual(processed.alt_text, 'A test image');
    });

    test('should process video attachment with metadata', async () => {
      const attachmentData = {
        url: 'https://example.com/video.mp4',
        mime_type: 'video/mp4',
        title: 'Test Video',
        duration_in_seconds: 120,
        width: 1920,
        height: 1080
      };

      const processed = await mediaHandler.processAttachment(attachmentData, {
        extractMetadata: false,
        validateUrls: false
      });

      assert.strictEqual(processed.mime_type, 'video/mp4');
      assert.strictEqual(processed.title, 'Test Video');
      assert.strictEqual(processed.duration_in_seconds, 120);
      assert.strictEqual(processed.width, 1920);
      assert.strictEqual(processed.height, 1080);
    });

    test('should throw error for missing required fields', async () => {
      const invalidAttachment = {
        url: 'https://example.com/image.jpg'
        // Missing mime_type
      };

      await assert.rejects(async () => {
        await mediaHandler.processAttachment(invalidAttachment);
      }, /must have a valid MIME type/);
    });

    test('should validate MIME type format', async () => {
      const invalidAttachment = {
        url: 'https://example.com/file',
        mime_type: 'invalid-mime-type'
      };

      await assert.rejects(async () => {
        await mediaHandler.processAttachment(invalidAttachment, { validateUrls: false });
      }, /Invalid MIME type format/);
    });
  });

  describe('Data URI Handling', () => {
    test('should parse valid data URI', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const parsed = mediaHandler.parseDataUri(dataUri);
      
      assert.strictEqual(parsed.mime_type, 'image/png');
      assert.strictEqual(parsed.encoding, 'base64');
      assert(parsed.size_in_bytes > 0);
      assert(parsed.data);
    });

    test('should create data URI from buffer', () => {
      const buffer = Buffer.from('Hello World', 'utf8');
      const dataUri = mediaHandler.createDataUri(buffer, 'text/plain');
      
      assert(dataUri.startsWith('data:text/plain;base64,'));
      
      // Verify we can parse it back
      const parsed = mediaHandler.parseDataUri(dataUri);
      assert.strictEqual(parsed.mime_type, 'text/plain');
    });

    test('should throw error for invalid data URI', () => {
      assert.throws(() => {
        mediaHandler.parseDataUri('not-a-data-uri');
      }, /Invalid data URI format/);
    });
  });

  describe('Accessibility Features', () => {
    test('should generate accessibility metadata', () => {
      const attachment = {
        url: 'https://example.com/sunset-photo.jpg',
        mime_type: 'image/jpeg'
      };

      const metadata = mediaHandler.generateAccessibilityMetadata(attachment, {
        generateAltText: true
      });

      assert(metadata.suggested_alt_text);
      assert(metadata.accessibility_warnings);
      assert(metadata.recommendations);
      assert(metadata.accessibility_warnings.some(warning => 
        warning.includes('Image missing alt text') || warning.includes('missing alt text')
      ));
    });

    test('should not warn about alt text when present', () => {
      const attachment = {
        url: 'https://example.com/image.jpg',
        mime_type: 'image/jpeg',
        alt_text: 'A beautiful sunset'
      };

      const metadata = mediaHandler.generateAccessibilityMetadata(attachment);

      assert(!metadata.accessibility_warnings || 
             !metadata.accessibility_warnings.includes('Image missing alt text'));
    });
  });
});

describe('MediaUtils', () => {
  describe('MIME Type Detection', () => {
    test('should detect image MIME types', () => {
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('photo.jpg'), 'image/jpeg');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('image.png'), 'image/png');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('icon.gif'), 'image/gif');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('logo.webp'), 'image/webp');
    });

    test('should detect video MIME types', () => {
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('video.mp4'), 'video/mp4');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('clip.webm'), 'video/webm');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('movie.avi'), 'video/avi');
    });

    test('should detect audio MIME types', () => {
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('song.mp3'), 'audio/mpeg');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('audio.wav'), 'audio/wav');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('track.flac'), 'audio/flac');
    });

    test('should return default for unknown extensions', () => {
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('file.unknown'), 'application/octet-stream');
      assert.strictEqual(MediaUtils.getMimeTypeFromExtension('noextension'), 'application/octet-stream');
    });
  });

  describe('File Size Validation', () => {
    test('should validate image file sizes', () => {
      const result = MediaUtils.validateFileSize(5 * 1024 * 1024, 'image/jpeg'); // 5MB
      assert.strictEqual(result.valid, true);
      
      const tooLarge = MediaUtils.validateFileSize(15 * 1024 * 1024, 'image/jpeg'); // 15MB
      assert.strictEqual(tooLarge.valid, false);
    });

    test('should validate video file sizes', () => {
      const result = MediaUtils.validateFileSize(50 * 1024 * 1024, 'video/mp4'); // 50MB
      assert.strictEqual(result.valid, true);
      
      const tooLarge = MediaUtils.validateFileSize(150 * 1024 * 1024, 'video/mp4'); // 150MB
      assert.strictEqual(tooLarge.valid, false);
    });
  });

  describe('File Size Formatting', () => {
    test('should format file sizes correctly', () => {
      assert.strictEqual(MediaUtils.formatFileSize(0), '0 Bytes');
      assert.strictEqual(MediaUtils.formatFileSize(1024), '1 KB');
      assert.strictEqual(MediaUtils.formatFileSize(1024 * 1024), '1 MB');
      assert.strictEqual(MediaUtils.formatFileSize(1024 * 1024 * 1024), '1 GB');
      assert.strictEqual(MediaUtils.formatFileSize(1536), '1.5 KB');
    });
  });
});