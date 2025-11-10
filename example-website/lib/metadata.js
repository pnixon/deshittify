/**
 * Metadata Management System
 * Provides Dublin Core and Schema.org metadata support
 */

/**
 * Dublin Core metadata fields mapping
 * Based on Dublin Core Metadata Element Set (DCMES)
 */
export const DUBLIN_CORE_FIELDS = {
  // Core elements
  'dc:title': 'title',
  'dc:creator': 'author.name',
  'dc:subject': 'tags',
  'dc:description': 'summary',
  'dc:publisher': 'author.name',
  'dc:contributor': 'author.name',
  'dc:date': 'datePublished',
  'dc:type': 'type',
  'dc:format': 'content_html',
  'dc:identifier': 'id',
  'dc:source': 'url',
  'dc:language': 'language',
  'dc:relation': 'in_reply_to',
  'dc:coverage': 'coverage',
  'dc:rights': 'rights'
};

/**
 * Schema.org types and properties
 */
export const SCHEMA_ORG_TYPES = {
  'Article': {
    '@type': 'Article',
    properties: ['headline', 'author', 'datePublished', 'dateModified', 'description', 'image', 'url']
  },
  'BlogPosting': {
    '@type': 'BlogPosting',
    properties: ['headline', 'author', 'datePublished', 'dateModified', 'description', 'image', 'url', 'keywords']
  },
  'SocialMediaPosting': {
    '@type': 'SocialMediaPosting',
    properties: ['headline', 'author', 'datePublished', 'sharedContent', 'url']
  },
  'Comment': {
    '@type': 'Comment',
    properties: ['author', 'datePublished', 'text', 'url']
  },
  'Person': {
    '@type': 'Person',
    properties: ['name', 'url', 'image']
  },
  'ImageObject': {
    '@type': 'ImageObject',
    properties: ['url', 'width', 'height', 'caption']
  },
  'VideoObject': {
    '@type': 'VideoObject',
    properties: ['url', 'width', 'height', 'duration', 'thumbnailUrl']
  },
  'AudioObject': {
    '@type': 'AudioObject',
    properties: ['url', 'duration']
  }
};

/**
 * Metadata Manager class
 */
export class MetadataManager {
  /**
   * Convert Ansybl content to Dublin Core metadata
   * @param {Object} content - Ansybl content item
   * @returns {Object} Dublin Core metadata
   */
  toDublinCore(content) {
    const dc = {
      '@context': 'http://purl.org/dc/elements/1.1/',
      'dc:title': content.title || '',
      'dc:creator': content.author?.name || '',
      'dc:subject': (content.tags || []).join(', '),
      'dc:description': content.summary || content.content_text?.substring(0, 200) || '',
      'dc:date': content.datePublished || new Date().toISOString(),
      'dc:type': content.type || 'Text',
      'dc:format': 'text/html',
      'dc:identifier': content.id || content.uuid || '',
      'dc:language': content.language || 'en'
    };

    // Add optional fields
    if (content.url) {
      dc['dc:source'] = content.url;
    }

    if (content.in_reply_to) {
      dc['dc:relation'] = content.in_reply_to;
    }

    if (content.rights) {
      dc['dc:rights'] = content.rights;
    }

    if (content.author?.url) {
      dc['dc:publisher'] = content.author.url;
    }

    return dc;
  }

  /**
   * Convert Ansybl content to Schema.org JSON-LD
   * @param {Object} content - Ansybl content item
   * @param {string} type - Schema.org type (Article, BlogPosting, etc.)
   * @returns {Object} Schema.org JSON-LD
   */
  toSchemaOrg(content, type = 'Article') {
    const baseUrl = content.url || content.id || '';
    
    const schema = {
      '@context': 'https://schema.org',
      '@type': type,
      '@id': baseUrl,
      'headline': content.title || '',
      'datePublished': content.datePublished || new Date().toISOString(),
      'description': content.summary || content.content_text?.substring(0, 200) || '',
      'url': baseUrl
    };

    // Add author
    if (content.author) {
      schema.author = {
        '@type': 'Person',
        'name': content.author.name,
        'url': content.author.url || undefined,
        'image': content.author.avatar || undefined
      };
    }

    // Add date modified
    if (content.dateModified) {
      schema.dateModified = content.dateModified;
    }

    // Add keywords/tags
    if (content.tags && content.tags.length > 0) {
      schema.keywords = content.tags.join(', ');
    }

    // Add images
    if (content.attachments && content.attachments.length > 0) {
      const images = content.attachments.filter(a => a.mime_type?.startsWith('image/'));
      if (images.length > 0) {
        schema.image = images.map(img => ({
          '@type': 'ImageObject',
          'url': img.url,
          'width': img.width,
          'height': img.height,
          'caption': img.alt_text || img.title
        }));
        
        // Use first image as primary
        if (schema.image.length === 1) {
          schema.image = schema.image[0];
        }
      }
    }

    // Add article body
    if (content.content_html) {
      schema.articleBody = content.content_html;
    } else if (content.content_text) {
      schema.text = content.content_text;
    }

    // Add interaction statistics
    if (content.interactions) {
      schema.interactionStatistic = [];
      
      if (content.interactions.likes_count > 0) {
        schema.interactionStatistic.push({
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/LikeAction',
          'userInteractionCount': content.interactions.likes_count
        });
      }
      
      if (content.interactions.shares_count > 0) {
        schema.interactionStatistic.push({
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/ShareAction',
          'userInteractionCount': content.interactions.shares_count
        });
      }
      
      if (content.interactions.replies_count > 0) {
        schema.interactionStatistic.push({
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/CommentAction',
          'userInteractionCount': content.interactions.replies_count
        });
      }
    }

    // Add comment context if this is a reply
    if (content.in_reply_to) {
      schema.commentCount = content.interactions?.replies_count || 0;
    }

    return schema;
  }

  /**
   * Convert comment to Schema.org Comment
   * @param {Object} comment - Comment object
   * @returns {Object} Schema.org Comment JSON-LD
   */
  commentToSchemaOrg(comment) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Comment',
      '@id': comment.id,
      'author': {
        '@type': 'Person',
        'name': comment.author.name,
        'url': comment.author.url || undefined,
        'image': comment.author.avatar || undefined
      },
      'datePublished': comment.datePublished,
      'text': comment.content,
      'url': comment.id
    };
  }

  /**
   * Validate Dublin Core metadata
   * @param {Object} metadata - Dublin Core metadata to validate
   * @returns {Object} Validation result
   */
  validateDublinCore(metadata) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!metadata['dc:title']) {
      errors.push('dc:title is required');
    }

    if (!metadata['dc:creator']) {
      warnings.push('dc:creator is recommended');
    }

    if (!metadata['dc:date']) {
      warnings.push('dc:date is recommended');
    }

    // Validate date format
    if (metadata['dc:date']) {
      try {
        new Date(metadata['dc:date']);
      } catch (e) {
        errors.push('dc:date must be a valid ISO 8601 date');
      }
    }

    // Validate identifier
    if (metadata['dc:identifier'] && !metadata['dc:identifier'].startsWith('http')) {
      warnings.push('dc:identifier should be a URL');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      warnings: warnings.length > 0 ? warnings : null
    };
  }

  /**
   * Validate Schema.org metadata
   * @param {Object} schema - Schema.org JSON-LD to validate
   * @returns {Object} Validation result
   */
  validateSchemaOrg(schema) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!schema['@context']) {
      errors.push('@context is required');
    }

    if (!schema['@type']) {
      errors.push('@type is required');
    }

    // Type-specific validation
    if (schema['@type'] === 'Article' || schema['@type'] === 'BlogPosting') {
      if (!schema.headline) {
        errors.push('headline is required for Article/BlogPosting');
      }

      if (!schema.author) {
        warnings.push('author is recommended for Article/BlogPosting');
      }

      if (!schema.datePublished) {
        warnings.push('datePublished is recommended for Article/BlogPosting');
      }

      if (!schema.image) {
        warnings.push('image is recommended for Article/BlogPosting');
      }
    }

    // Validate dates
    if (schema.datePublished) {
      try {
        new Date(schema.datePublished);
      } catch (e) {
        errors.push('datePublished must be a valid ISO 8601 date');
      }
    }

    if (schema.dateModified) {
      try {
        new Date(schema.dateModified);
      } catch (e) {
        errors.push('dateModified must be a valid ISO 8601 date');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      warnings: warnings.length > 0 ? warnings : null
    };
  }

  /**
   * Extract metadata from Ansybl content
   * @param {Object} content - Ansybl content item
   * @returns {Object} Extracted metadata
   */
  extractMetadata(content) {
    return {
      title: content.title || '',
      author: content.author?.name || '',
      datePublished: content.datePublished || '',
      dateModified: content.dateModified || null,
      tags: content.tags || [],
      summary: content.summary || '',
      language: content.language || 'en',
      type: content.type || 'Article',
      url: content.url || content.id || '',
      hasImages: content.attachments?.some(a => a.mime_type?.startsWith('image/')) || false,
      hasVideo: content.attachments?.some(a => a.mime_type?.startsWith('video/')) || false,
      hasAudio: content.attachments?.some(a => a.mime_type?.startsWith('audio/')) || false,
      interactionCount: (content.interactions?.likes_count || 0) + 
                       (content.interactions?.shares_count || 0) + 
                       (content.interactions?.replies_count || 0)
    };
  }

  /**
   * Generate HTML meta tags for content
   * @param {Object} content - Ansybl content item
   * @returns {string} HTML meta tags
   */
  generateMetaTags(content) {
    const tags = [];

    // Basic meta tags
    if (content.title) {
      tags.push(`<meta property="og:title" content="${this.escapeHtml(content.title)}">`);
      tags.push(`<meta name="twitter:title" content="${this.escapeHtml(content.title)}">`);
    }

    if (content.summary) {
      tags.push(`<meta name="description" content="${this.escapeHtml(content.summary)}">`);
      tags.push(`<meta property="og:description" content="${this.escapeHtml(content.summary)}">`);
      tags.push(`<meta name="twitter:description" content="${this.escapeHtml(content.summary)}">`);
    }

    if (content.url || content.id) {
      const url = content.url || content.id;
      tags.push(`<meta property="og:url" content="${this.escapeHtml(url)}">`);
    }

    // Image tags
    const images = content.attachments?.filter(a => a.mime_type?.startsWith('image/')) || [];
    if (images.length > 0) {
      const primaryImage = images[0];
      tags.push(`<meta property="og:image" content="${this.escapeHtml(primaryImage.url)}">`);
      tags.push(`<meta name="twitter:image" content="${this.escapeHtml(primaryImage.url)}">`);
      
      if (primaryImage.width) {
        tags.push(`<meta property="og:image:width" content="${primaryImage.width}">`);
      }
      if (primaryImage.height) {
        tags.push(`<meta property="og:image:height" content="${primaryImage.height}">`);
      }
      if (primaryImage.alt_text) {
        tags.push(`<meta property="og:image:alt" content="${this.escapeHtml(primaryImage.alt_text)}">`);
      }
    }

    // Type
    tags.push(`<meta property="og:type" content="article">`);
    tags.push(`<meta name="twitter:card" content="summary_large_image">`);

    // Author
    if (content.author?.name) {
      tags.push(`<meta name="author" content="${this.escapeHtml(content.author.name)}">`);
    }

    // Keywords
    if (content.tags && content.tags.length > 0) {
      tags.push(`<meta name="keywords" content="${this.escapeHtml(content.tags.join(', '))}">`);
    }

    // Dates
    if (content.datePublished) {
      tags.push(`<meta property="article:published_time" content="${content.datePublished}">`);
    }
    if (content.dateModified) {
      tags.push(`<meta property="article:modified_time" content="${content.dateModified}">`);
    }

    return tags.join('\n');
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Create singleton instance
export const metadataManager = new MetadataManager();
