/**
 * Test fixtures and sample data for unit tests
 */

export const testFeeds = {
  minimal: {
    version: 'https://ansybl.org/version/1.0',
    title: 'Minimal Test Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    author: {
      name: 'Test Author',
      public_key: 'ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=='
    },
    items: []
  },

  comprehensive: {
    version: 'https://ansybl.org/version/1.0',
    title: 'Comprehensive Test Feed',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    description: 'A comprehensive test feed with all features',
    icon: 'https://example.com/icon.png',
    language: 'en-US',
    author: {
      name: 'Test Author',
      url: 'https://example.com/author',
      avatar: 'https://example.com/avatar.jpg',
      public_key: 'ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=='
    },
    items: [
      {
        id: 'https://example.com/post/1',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://example.com/post/1',
        title: 'Test Post',
        content_text: 'Hello world',
        content_html: '<p>Hello <strong>world</strong></p>',
        summary: 'A test post',
        date_published: '2025-11-04T10:00:00Z',
        date_modified: '2025-11-04T11:00:00Z',
        tags: ['test', 'example'],
        attachments: [
          {
            url: 'https://example.com/image.jpg',
            mime_type: 'image/jpeg',
            title: 'Test Image',
            size_in_bytes: 12345,
            width: 800,
            height: 600,
            alt_text: 'A test image'
          }
        ],
        interactions: {
          replies_count: 5,
          likes_count: 10,
          shares_count: 2
        },
        signature: 'ed25519:dGVzdHNpZ25hdHVyZQ=='
      }
    ],
    signature: 'ed25519:ZmVlZHNpZ25hdHVyZQ=='
  }
};

export const testPosts = {
  textOnly: {
    id: 'https://example.com/post/text',
    url: 'https://example.com/post/text',
    content_text: 'This is a text-only post',
    date_published: '2025-11-04T10:00:00Z'
  },

  withHtml: {
    id: 'https://example.com/post/html',
    url: 'https://example.com/post/html',
    content_text: 'This is a post with HTML',
    content_html: '<p>This is a post with <strong>HTML</strong></p>',
    date_published: '2025-11-04T10:00:00Z'
  },

  withMarkdown: {
    id: 'https://example.com/post/markdown',
    url: 'https://example.com/post/markdown',
    content_markdown: '# This is a post with Markdown\n\nWith **bold** text.',
    date_published: '2025-11-04T10:00:00Z'
  },

  withMedia: {
    id: 'https://example.com/post/media',
    url: 'https://example.com/post/media',
    content_text: 'Post with media attachment',
    attachments: [
      {
        url: 'https://example.com/photo.jpg',
        mime_type: 'image/jpeg',
        width: 1920,
        height: 1080,
        alt_text: 'A beautiful photo'
      }
    ],
    date_published: '2025-11-04T10:00:00Z'
  },

  withInteractions: {
    id: 'https://example.com/post/interactions',
    url: 'https://example.com/post/interactions',
    content_text: 'Post with interactions',
    interactions: {
      replies_count: 10,
      likes_count: 25,
      shares_count: 5,
      replies_url: 'https://example.com/post/interactions/replies'
    },
    date_published: '2025-11-04T10:00:00Z'
  }
};

export const testAttachments = {
  image: {
    url: 'https://example.com/image.jpg',
    mime_type: 'image/jpeg',
    width: 800,
    height: 600,
    size_in_bytes: 102400,
    alt_text: 'Test image'
  },

  video: {
    url: 'https://example.com/video.mp4',
    mime_type: 'video/mp4',
    width: 1920,
    height: 1080,
    duration_in_seconds: 120,
    size_in_bytes: 5242880
  },

  audio: {
    url: 'https://example.com/audio.mp3',
    mime_type: 'audio/mpeg',
    duration_in_seconds: 180,
    size_in_bytes: 3145728,
    title: 'Test Audio Track'
  }
};

export const testUsers = {
  author1: {
    name: 'Test Author 1',
    url: 'https://example.com/author1',
    avatar: 'https://example.com/avatar1.jpg',
    public_key: 'ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=='
  },

  author2: {
    name: 'Test Author 2',
    url: 'https://example.com/author2',
    avatar: 'https://example.com/avatar2.jpg',
    public_key: 'ed25519:BBBC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag=='
  }
};

export const invalidData = {
  missingVersion: {
    title: 'Feed without version',
    home_page_url: 'https://example.com',
    feed_url: 'https://example.com/feed.ansybl',
    author: { name: 'Test', public_key: 'ed25519:test' },
    items: []
  },

  httpUrl: {
    version: 'https://ansybl.org/version/1.0',
    title: 'Feed with HTTP URL',
    home_page_url: 'http://example.com', // Should be HTTPS
    feed_url: 'https://example.com/feed.ansybl',
    author: { name: 'Test', public_key: 'ed25519:test' },
    items: []
  },

  invalidDate: {
    id: 'https://example.com/post/1',
    url: 'https://example.com/post/1',
    content_text: 'Post with invalid date',
    date_published: 'not-a-date'
  }
};
