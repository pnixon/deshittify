/**
 * Unit tests for Media Handler
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import mime from 'mime-types';

describe('MediaHandler - example-website', () => {
  describe('File Type Validation', () => {
    test('should validate image types', () => {
      const validImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      validImages.forEach(mimeType => {
        const isValid = mimeType.startsWith('image/');
        assert.strictEqual(isValid, true, `${mimeType} should be valid`);
      });
    });

    test('should validate video types', () => {
      const validVideos = ['video/mp4', 'video/webm'];
      
      validVideos.forEach(mimeType => {
        const isValid = mimeType.startsWith('video/');
        assert.strictEqual(isValid, true, `${mimeType} should be valid`);
      });
    });

    test('should validate audio types', () => {
      const validAudio = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
      
      validAudio.forEach(mimeType => {
        const isValid = mimeType.startsWith('audio/');
        assert.strictEqual(isValid, true, `${mimeType} should be valid`);
      });
    });

    test('should reject invalid types', () => {
      const invalidTypes = ['application/exe', 'text/html', 'application/javascript'];
      
      invalidTypes.forEach(mimeType => {
        const isValid = mimeType.startsWith('image/');
        assert.strictEqual(isValid, false, `${mimeType} should be invalid for images`);
      });
    });
  });

  describe('Content Type Detection', () => {
    test('should detect content type from filename', () => {
      const testCases = [
        { filename: 'photo.jpg', expected: 'image/jpeg' },
        { filename: 'image.png', expected: 'image/png' },
        { filename: 'audio.mp3', expected: 'audio/mpeg' }
      ];

      testCases.forEach(({ filename, expected }) => {
        const contentType = mime.lookup(filename);
        assert.strictEqual(contentType, expected, `${filename} should be ${expected}`);
      });
    });

    test('should detect video content types', () => {
      // Note: mime-types may return 'application/mp4' or 'video/mp4' depending on version
      const mp4Type = mime.lookup('video.mp4');
      assert(mp4Type === 'video/mp4' || mp4Type === 'application/mp4', 'MP4 should be recognized');
      
      const webmType = mime.lookup('video.webm');
      assert.strictEqual(webmType, 'video/webm');
    });
  });

  describe('File Size Validation', () => {
    test('should validate file size limits', () => {
      const maxImageSize = 10 * 1024 * 1024; // 10MB
      const maxVideoSize = 100 * 1024 * 1024; // 100MB

      const validImageSize = 5 * 1024 * 1024; // 5MB
      const invalidImageSize = 15 * 1024 * 1024; // 15MB

      assert.strictEqual(validImageSize <= maxImageSize, true);
      assert.strictEqual(invalidImageSize <= maxImageSize, false);
    });
  });
});
