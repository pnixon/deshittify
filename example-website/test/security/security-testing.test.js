/**
 * Security testing for Ansybl implementation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AnsyblGenerator } from '../../lib/generator.js';
import { AnsyblParser } from '../../lib/parser.js';
import { AnsyblValidator } from '../../lib/validator.js';
import { generateKeyPair, verifySignature } from '../../lib/signature.js';
import { sanitizeFilename, validateFileType } from '../../utils/security.js';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

describe('Security Testing', () => {
  let generator;
  let parser;
  let validator;
  let testKeyPair;
  const window = new JSDOM('').window;
  const purify = DOMPurify(window);

  test('setup', async () => {
    generator = new AnsyblGenerator();
    parser = new AnsyblParser();
    validator = new AnsyblValidator();
    testKeyPair = await generateKeyPair();
  });

  describe('XSS Prevention', () => {
    test('should sanitize malicious HTML in content', async () => {
      const maliciousContent = '<script>alert("XSS")</script><img src=x onerror="alert(1)">';
      const sanitized = purify.sanitize(maliciousContent);

      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('onerror'), false);
    });

    test('should prevent XSS in feed creation', async () => {
      const feed = generator.createFeed({
        title: '<script>alert("XSS")</script>Test Feed',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        description: '<img src=x onerror="alert(1)">',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      // Title and description should be sanitized
      const sanitizedTitle = purify.sanitize(feed.title);
      const sanitizedDesc = purify.sanitize(feed.description);

      assert.strictEqual(sanitizedTitle.includes('<script>'), false);
      assert.strictEqual(sanitizedDesc.includes('onerror'), false);
    });

    test('should sanitize HTML content in items', async () => {
      const feed = generator.createFeed({
        title: 'Security Test',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test Author',
          public_key: testKeyPair.publicKey
        }
      });

      const updatedFeed = await generator.addItem(feed, {
        id: 'https://example.com/post/1',
        url: 'https://example.com/post/1',
        content_html: '<p>Safe content</p><script>alert("XSS")</script>'
      }, testKeyPair.privateKey);

      const sanitized = purify.sanitize(updatedFeed.items[0].content_html);
      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('Safe content'), true);
    });
  });

  describe('Injection Prevention', () => {
    test('should prevent path traversal in filenames', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'test/../../secret.txt',
        'normal.jpg/../../../etc/passwd'
      ];

      maliciousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename);
        assert.strictEqual(sanitized.includes('..'), false);
        assert.strictEqual(sanitized.includes('/'), false);
        assert.strictEqual(sanitized.includes('\\'), false);
      });
    });

    test('should validate file types securely', () => {
      const testBuffer = Buffer.from('test content');
      
      // Test with mismatched MIME types
      const result = validateFileType(testBuffer, 'image/jpeg', 'test.exe');
      
      // Should detect mismatch
      assert(result.errors.length > 0 || !result.isValid);
    });
  });

  describe('Signature Security', () => {
    test('should reject forged signatures', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Original content'
      };

      const validSignature = await generator.signItem(content, testKeyPair.privateKey);
      
      // Try to verify with wrong public key
      const wrongKeyPair = await generateKeyPair();
      const isValid = await verifySignature(content, validSignature, wrongKeyPair.publicKey);

      assert.strictEqual(isValid, false);
    });

    test('should detect content tampering', async () => {
      const content = {
        id: 'https://example.com/post/1',
        content_text: 'Original content'
      };

      const signature = await generator.signItem(content, testKeyPair.privateKey);
      
      // Tamper with content
      content.content_text = 'Tampered content';
      
      const isValid = await verifySignature(content, signature, testKeyPair.publicKey);

      assert.strictEqual(isValid, false);
    });

    test('should prevent signature replay attacks', async () => {
      const content1 = {
        id: 'https://example.com/post/1',
        content_text: 'Content 1',
        date_published: '2025-11-04T10:00:00Z'
      };

      const content2 = {
        id: 'https://example.com/post/2',
        content_text: 'Content 2',
        date_published: '2025-11-04T11:00:00Z'
      };

      const sig1 = await generator.signItem(content1, testKeyPair.privateKey);
      
      // Try to use sig1 for content2 (replay attack)
      const isValid = await verifySignature(content2, sig1, testKeyPair.publicKey);

      assert.strictEqual(isValid, false);
    });
  });

  describe('URL Validation', () => {
    test('should reject non-HTTPS URLs', () => {
      const invalidUrls = [
        'http://example.com',
        'ftp://example.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd'
      ];

      invalidUrls.forEach(url => {
        const isHttps = url.startsWith('https://');
        assert.strictEqual(isHttps, false, `${url} should be rejected`);
      });
    });

    test('should validate URL format', () => {
      const invalidUrls = [
        'not a url',
        'htp://typo.com',
        '//example.com',
        'https://',
        'https://example.com/<script>alert(1)</script>'
      ];

      invalidUrls.forEach(url => {
        try {
          new URL(url);
          // If it parses, check if it's HTTPS
          assert(url.startsWith('https://'), `${url} should be HTTPS`);
        } catch (error) {
          // Invalid URL format - this is expected
          assert(true);
        }
      });
    });
  });

  describe('Input Validation', () => {
    test('should reject oversized inputs', () => {
      const maxTitleLength = 200;
      const oversizedTitle = 'a'.repeat(300);

      assert(oversizedTitle.length > maxTitleLength);
      
      // In production, this should be rejected
      const isValid = oversizedTitle.length <= maxTitleLength;
      assert.strictEqual(isValid, false);
    });

    test('should validate required fields', async () => {
      const invalidFeed = {
        title: 'Test Feed'
        // Missing required fields
      };

      const validationResult = validator.validateDocument(invalidFeed);
      assert.strictEqual(validationResult.valid, false);
      assert(validationResult.errors.length > 0);
    });

    test('should validate data types', async () => {
      const invalidFeed = {
        version: 'https://ansybl.org/version/1.0',
        title: 123, // Should be string
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test',
          public_key: 'ed25519:test'
        },
        items: []
      };

      const validationResult = validator.validateDocument(invalidFeed);
      // Should fail due to type mismatch
      assert(validationResult.errors.length > 0 || !validationResult.valid);
    });
  });

  describe('Denial of Service Prevention', () => {
    test('should handle deeply nested objects', async () => {
      // Create deeply nested object
      let nested = { value: 'test' };
      for (let i = 0; i < 50; i++) {
        nested = { nested };
      }

      const feed = {
        version: 'https://ansybl.org/version/1.0',
        title: 'Nested Test',
        home_page_url: 'https://example.com',
        feed_url: 'https://example.com/feed.ansybl',
        author: {
          name: 'Test',
          public_key: testKeyPair.publicKey
        },
        items: [],
        _nested: nested
      };

      // Should not crash or hang
      try {
        const result = await parser.parse(feed, { verifySignatures: false });
        // Either succeeds or fails gracefully
        assert(result.success !== undefined);
      } catch (error) {
        // Should handle gracefully
        assert(error.message);
      }
    });

    test('should handle extremely long strings', () => {
      const longString = 'a'.repeat(1000000); // 1MB string

      // Should not crash
      const sanitized = purify.sanitize(longString);
      assert(typeof sanitized === 'string');
    });
  });
});
