/**
 * Content processing utilities
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Setup DOMPurify for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

export function processMarkdownContent(post) {
  if (post.content_markdown && !post.content_html) {
    // Configure marked for security
    marked.setOptions({
      breaks: true,
      gfm: true,
      sanitize: false // We'll use DOMPurify instead
    });
    
    // Convert markdown to HTML and sanitize
    const rawHtml = marked(post.content_markdown);
    post.content_html = purify.sanitize(rawHtml);
  }
  return post;
}

export function generateContentSummary(content, maxLength = 200) {
  if (!content) return '';
  const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*_`]/g, '');
  return plainText.length > maxLength
    ? plainText.substring(0, maxLength).trim() + '...'
    : plainText;
}

export function updateInteractionCounts(postId, posts, interactions) {
  const post = posts.find(p => p.id === postId);
  if (post && interactions[postId]) {
    post.interactions.likes_count = interactions[postId].likes.length;
    post.interactions.shares_count = interactions[postId].shares.length;
    post.interactions.replies_count = interactions[postId].replies.length;
  }
}