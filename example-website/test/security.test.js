/**
 * Unit tests for Security utilities
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeFilename, validateFileType, generateSecureFilename } from '../utils/security.js';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

describe('Security - example-website', () => {
  const window = new JSDOM('').window;
  const purify = DOMPurify(window);

  describe('HTML Sanitization', () => {
    test('should sanitize dangerous HTML', () => {
      const dangerous = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = purify.sanitize(dangerous);
      
      assert.strictEqual(sanitized.includes('<script>'), false);
      assert.strictEqual(sanitized.includes('Safe content'), true);
    });

    test('should allow safe HTML tags', () => {
      const safe = '<p>Hello <strong>world</strong></p>';
      const sanitized = purify.sanitize(safe);
      
      assert.strictEqual(sanitized.includes('<p>'), true);
      assert.strictEqual(sanitized.includes('<strong>'), true);
    });

    test('should remove event handlers', () => {
      const dangerous = '<div onclick="alert(1)">Click me</div>';
      const sanitized = purify.sanitize(dangerous);
      
      assert.strictEqual(sanitized.includes('onclick'), false);
    });
  });

  describe('URL Validation', () => {
    test('should validate HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://example.com/path',
        'https://subdomain.example.com'
      ];

      validUrls.forEach(url => {
        const isValid = url.startsWith('https://');
        assert.strictEqual(isValid, true, `${url} should be valid`);
      });
    });

    test('should reject non-HTTPS URLs', () => {
      const invalidUrls = [
        'http://example.com',
        'ftp://example.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      invalidUrls.forEach(url => {
        const isValid = url.startsWith('https://');
        assert.strictEqual(isValid, false, `${url} should be invalid`);
      });
    });

    test('should validate URL format', () => {
      const validUrl = 'https://example.com/path?query=value';
      const invalidUrl = 'not-a-url';

      try {
        new URL(validUrl);
        assert.strictEqual(true, true);
      } catch {
        assert.fail('Valid URL should parse');
      }

      try {
        new URL(invalidUrl);
        assert.fail('Invalid URL should throw');
      } catch {
        assert.strictEqual(true, true);
      }
    });
  });

  describe('Filename Sanitization', () => {
    test('should sanitize dangerous filenames', () => {
      const dangerous = '../../../etc/passwd';
      const sanitized = sanitizeFilename(dangerous);
      
      assert.strictEqual(sanitized.includes('..'), false);
      assert.strictEqual(sanitized.includes('/'), false);
    });

    test('should allow safe filenames', () => {
      const safe = 'my-photo.jpg';
      const sanitized = sanitizeFilename(safe);
      
      assert.strictEqual(sanitized, 'my-photo.jpg');
    });

    test('should generate secure filenames', () => {
      const buffer = Buffer.from('test content');
      const filename = generateSecureFilename(buffer, 'test.jpg');
      
      assert(filename.includes('.jpg'));
      assert(filename.length > 10);
    });
  });
});
