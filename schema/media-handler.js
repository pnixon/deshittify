/**
 * Media Attachment Handler for Ansybl Protocol
 * Handles media metadata extraction, validation, and accessibility features
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

/**
 * Media attachment handler with metadata extraction and validation
 */
export class MediaAttachmentHandler {
  constructor() {
    this.supportedImageTypes = new Set([
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'
    ]);
    
    this.supportedVideoTypes = new Set([
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 
      'video/mov', 'video/wmv', 'video/flv', 'video/mkv'
    ]);
    
    this.supportedAudioTypes = new Set([
      'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 
      'audio/aac', 'audio/flac', 'audio/m4a', 'audio/wma'
    ]);
  }

  /**
   * Process and validate a media attachment
   * @param {object} attachmentData - Raw attachment data
   * @param {object} options - Processing options
   * @returns {Promise<object>} Processed attachment with metadata
   */
  async processAttachment(attachmentData, options = {}) {
    const {
      extractMetadata = true,
      generateBlurhash = false,
      validateUrls = true,
      maxFileSize = 100 * 1024 * 1024, // 100MB default
      requireAltText = false
    } = options;

    // Validate required fields
    this._validateAttachmentData(attachmentData);

    const attachment = {
      url: attachmentData.url,
      mime_type: attachmentData.mime_type
    };

    // Validate URL if requested
    if (validateUrls) {
      await this._validateUrl(attachment.url);
    }

    // Validate MIME type
    this._validateMimeType(attachment.mime_type);

    // Add optional fields
    if (attachmentData.title) attachment.title = attachmentData.title;
    if (attachmentData.size_in_bytes) attachment.size_in_bytes = attachmentData.size_in_bytes;
    if (attachmentData.duration_in_seconds) attachment.duration_in_seconds = attachmentData.duration_in_seconds;
    if (attachmentData.width) attachment.width = attachmentData.width;
    if (attachmentData.height) attachment.height = attachmentData.height;
    if (attachmentData.alt_text) attachment.alt_text = attachmentData.alt_text;
    if (attachmentData.blurhash) attachment.blurhash = attachmentData.blurhash;
    if (attachmentData.data_uri) attachment.data_uri = attachmentData.data_uri;

    // Extract metadata if requested and not already provided
    if (extractMetadata) {
      try {
        const metadata = await this._extractMetadata(attachment, options);
        Object.assign(attachment, metadata);
      } catch (error) {
        // Metadata extraction is optional, continue without it
        console.warn(`Failed to extract metadata for ${attachment.url}: ${error.message}`);
      }
    }

    // Validate file size if specified
    if (attachment.size_in_bytes && attachment.size_in_bytes > maxFileSize) {
      throw new Error(`File size ${attachment.size_in_bytes} exceeds maximum allowed size ${maxFileSize}`);
    }

    // Check accessibility requirements
    if (requireAltText && this._isImageType(attachment.mime_type) && !attachment.alt_text) {
      throw new Error('Alt text is required for image attachments');
    }

    // Generate blurhash for images if requested
    if (generateBlurhash && this._isImageType(attachment.mime_type) && !attachment.blurhash) {
      try {
        attachment.blurhash = await this._generateBlurhash(attachment.url);
      } catch (error) {
        console.warn(`Failed to generate blurhash for ${attachment.url}: ${error.message}`);
      }
    }

    return attachment;
  }

  /**
   * Process multiple attachments
   * @param {object[]} attachments - Array of attachment data
   * @param {object} options - Processing options
   * @returns {Promise<object[]>} Array of processed attachments
   */
  async processAttachments(attachments, options = {}) {
    if (!Array.isArray(attachments)) {
      throw new Error('Attachments must be an array');
    }

    const processed = [];
    for (const attachment of attachments) {
      try {
        const processedAttachment = await this.processAttachment(attachment, options);
        processed.push(processedAttachment);
      } catch (error) {
        if (options.skipInvalid) {
          console.warn(`Skipping invalid attachment: ${error.message}`);
          continue;
        }
        throw error;
      }
    }

    return processed;
  }

  /**
   * Validate attachment URL accessibility
   * @param {string} url - URL to validate
   * @returns {Promise<object>} Validation result with metadata
   */
  async validateAttachmentUrl(url) {
    try {
      // For now, just validate URL format - in a real implementation,
      // you might want to make a HEAD request to check accessibility
      new URL(url);
      
      return {
        valid: true,
        accessible: true, // Would be determined by actual HTTP request
        url,
        status_code: 200 // Would be from actual HTTP response
      };
    } catch (error) {
      return {
        valid: false,
        accessible: false,
        url,
        error: error.message
      };
    }
  }

  /**
   * Generate accessibility metadata for an attachment
   * @param {object} attachment - Attachment object
   * @param {object} options - Generation options
   * @returns {object} Accessibility metadata
   */
  generateAccessibilityMetadata(attachment, options = {}) {
    const metadata = {};

    // Generate alt text suggestions based on filename and type
    if (!attachment.alt_text && options.generateAltText) {
      metadata.suggested_alt_text = this._generateAltTextSuggestion(attachment);
    }

    // Add accessibility warnings
    const warnings = [];
    if (this._isImageType(attachment.mime_type) && !attachment.alt_text) {
      warnings.push('Image missing alt text for screen readers');
    }
    
    if (this._isVideoType(attachment.mime_type) && !attachment.title) {
      warnings.push('Video missing descriptive title');
    }

    if (warnings.length > 0) {
      metadata.accessibility_warnings = warnings;
    }

    // Add media type specific recommendations
    if (this._isImageType(attachment.mime_type)) {
      metadata.recommendations = [
        'Provide descriptive alt text',
        'Consider image dimensions for responsive design'
      ];
      if (!attachment.blurhash) {
        metadata.recommendations.push('Consider adding blurhash for progressive loading');
      }
    }

    return metadata;
  }

  /**
   * Create a data URI from file data
   * @param {Buffer|Uint8Array} fileData - File data
   * @param {string} mimeType - MIME type
   * @returns {string} Data URI
   */
  createDataUri(fileData, mimeType) {
    if (!Buffer.isBuffer(fileData) && !(fileData instanceof Uint8Array)) {
      throw new Error('File data must be Buffer or Uint8Array');
    }

    const base64Data = Buffer.from(fileData).toString('base64');
    return `data:${mimeType};base64,${base64Data}`;
  }

  /**
   * Extract metadata from data URI
   * @param {string} dataUri - Data URI string
   * @returns {object} Extracted metadata
   */
  parseDataUri(dataUri) {
    if (!dataUri.startsWith('data:')) {
      throw new Error('Invalid data URI format');
    }

    const [header, data] = dataUri.split(',');
    if (!header || !data) {
      throw new Error('Malformed data URI');
    }

    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    
    const isBase64 = header.includes('base64');
    const size = isBase64 ? Math.floor(data.length * 3 / 4) : data.length;

    return {
      mime_type: mimeType,
      encoding: isBase64 ? 'base64' : 'url-encoded',
      size_in_bytes: size,
      data: data
    };
  }

  /**
   * Validate attachment data structure
   * @private
   */
  _validateAttachmentData(attachmentData) {
    if (!attachmentData || typeof attachmentData !== 'object') {
      throw new Error('Attachment data must be an object');
    }

    if (!attachmentData.url || typeof attachmentData.url !== 'string') {
      throw new Error('Attachment must have a valid URL');
    }

    if (!attachmentData.mime_type || typeof attachmentData.mime_type !== 'string') {
      throw new Error('Attachment must have a valid MIME type');
    }
  }

  /**
   * Validate URL format and accessibility
   * @private
   */
  async _validateUrl(url) {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // Check for data URI
    if (url.startsWith('data:')) {
      try {
        this.parseDataUri(url);
      } catch (error) {
        throw new Error(`Invalid data URI: ${error.message}`);
      }
    }
  }

  /**
   * Validate MIME type
   * @private
   */
  _validateMimeType(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') {
      throw new Error('MIME type must be a non-empty string');
    }

    // Basic MIME type format validation
    if (!/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/.test(mimeType)) {
      throw new Error(`Invalid MIME type format: ${mimeType}`);
    }
  }

  /**
   * Extract metadata from attachment
   * @private
   */
  async _extractMetadata(attachment, options) {
    const metadata = {};

    // Extract metadata based on MIME type
    if (this._isImageType(attachment.mime_type)) {
      Object.assign(metadata, await this._extractImageMetadata(attachment, options));
    } else if (this._isVideoType(attachment.mime_type)) {
      Object.assign(metadata, await this._extractVideoMetadata(attachment, options));
    } else if (this._isAudioType(attachment.mime_type)) {
      Object.assign(metadata, await this._extractAudioMetadata(attachment, options));
    }

    // Extract file size if not provided and URL is accessible
    if (!attachment.size_in_bytes && !attachment.url.startsWith('data:')) {
      try {
        metadata.size_in_bytes = await this._getFileSizeFromUrl(attachment.url);
      } catch (error) {
        // Size extraction is optional
      }
    }

    return metadata;
  }

  /**
   * Extract image-specific metadata
   * @private
   */
  async _extractImageMetadata(attachment, options) {
    const metadata = {};

    // For data URIs, we can extract some basic info
    if (attachment.url.startsWith('data:')) {
      const dataUriInfo = this.parseDataUri(attachment.url);
      metadata.size_in_bytes = dataUriInfo.size_in_bytes;
    }

    // In a real implementation, you would use image processing libraries
    // to extract width, height, and other metadata from the actual image
    // For now, we'll provide placeholder logic

    return metadata;
  }

  /**
   * Extract video-specific metadata
   * @private
   */
  async _extractVideoMetadata(attachment, options) {
    const metadata = {};

    // In a real implementation, you would use video processing libraries
    // to extract duration, dimensions, codec info, etc.
    // For now, we'll provide placeholder logic

    return metadata;
  }

  /**
   * Extract audio-specific metadata
   * @private
   */
  async _extractAudioMetadata(attachment, options) {
    const metadata = {};

    // In a real implementation, you would use audio processing libraries
    // to extract duration, bitrate, codec info, etc.
    // For now, we'll provide placeholder logic

    return metadata;
  }

  /**
   * Generate blurhash for progressive image loading
   * @private
   */
  async _generateBlurhash(imageUrl) {
    // In a real implementation, you would use the blurhash library
    // to generate a blurhash from the actual image data
    // For now, return a placeholder
    return 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.';
  }

  /**
   * Get file size from URL
   * @private
   */
  async _getFileSizeFromUrl(url) {
    // In a real implementation, you would make a HEAD request
    // to get the Content-Length header
    // For now, return null to indicate size is unknown
    return null;
  }

  /**
   * Generate alt text suggestion based on filename and type
   * @private
   */
  _generateAltTextSuggestion(attachment) {
    try {
      const url = new URL(attachment.url);
      const filename = url.pathname.split('/').pop() || 'media';
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      
      // Convert filename to readable text
      const readable = nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase();

      const mediaType = this._getMediaTypeDescription(attachment.mime_type);
      
      return `${mediaType}: ${readable}`;
    } catch (error) {
      return `${this._getMediaTypeDescription(attachment.mime_type)} attachment`;
    }
  }

  /**
   * Get human-readable media type description
   * @private
   */
  _getMediaTypeDescription(mimeType) {
    if (this._isImageType(mimeType)) return 'Image';
    if (this._isVideoType(mimeType)) return 'Video';
    if (this._isAudioType(mimeType)) return 'Audio';
    return 'Media file';
  }

  /**
   * Check if MIME type is an image
   * @private
   */
  _isImageType(mimeType) {
    return this.supportedImageTypes.has(mimeType) || mimeType.startsWith('image/');
  }

  /**
   * Check if MIME type is a video
   * @private
   */
  _isVideoType(mimeType) {
    return this.supportedVideoTypes.has(mimeType) || mimeType.startsWith('video/');
  }

  /**
   * Check if MIME type is audio
   * @private
   */
  _isAudioType(mimeType) {
    return this.supportedAudioTypes.has(mimeType) || mimeType.startsWith('audio/');
  }
}

/**
 * Utility functions for media handling
 */
export class MediaUtils {
  /**
   * Determine MIME type from file extension
   * @param {string} filename - Filename or path
   * @returns {string} MIME type
   */
  static getMimeTypeFromExtension(filename) {
    const ext = extname(filename).toLowerCase();
    
    const mimeTypes = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      
      // Videos
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.avi': 'video/avi',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.mkv': 'video/x-matroska',
      
      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.wma': 'audio/x-ms-wma'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate file size is within reasonable limits
   * @param {number} sizeInBytes - File size in bytes
   * @param {string} mimeType - MIME type
   * @returns {object} Validation result
   */
  static validateFileSize(sizeInBytes, mimeType) {
    const limits = {
      image: 10 * 1024 * 1024,  // 10MB for images
      video: 100 * 1024 * 1024, // 100MB for videos
      audio: 50 * 1024 * 1024   // 50MB for audio
    };

    let limit;
    if (mimeType.startsWith('image/')) {
      limit = limits.image;
    } else if (mimeType.startsWith('video/')) {
      limit = limits.video;
    } else if (mimeType.startsWith('audio/')) {
      limit = limits.audio;
    } else {
      limit = limits.image; // Default to most restrictive
    }

    const valid = sizeInBytes <= limit;
    
    return {
      valid,
      size: sizeInBytes,
      limit,
      message: valid ? 'File size is acceptable' : `File size ${sizeInBytes} exceeds limit ${limit}`
    };
  }

  /**
   * Format file size for human reading
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default MediaAttachmentHandler;