/**
 * Content Discovery and Recommendation System
 * Provides search, recommendations, and content analytics
 */

/**
 * Content Search Engine
 */
export class ContentSearch {
  /**
   * Search content with advanced filtering
   * @param {Array} posts - Posts to search
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  search(posts, options = {}) {
    const {
      query = '',
      tags = [],
      author = '',
      dateFrom = null,
      dateTo = null,
      hasMedia = null,
      sortBy = 'relevance',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let results = [...posts];

    // Text search with relevance scoring
    if (query && query.trim()) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      
      results = results.map(post => {
        let score = 0;
        const searchableText = [
          post.title || '',
          post.content_text || '',
          post.summary || '',
          ...(post.tags || [])
        ].join(' ').toLowerCase();

        // Calculate relevance score
        for (const term of searchTerms) {
          // Title matches are worth more
          if ((post.title || '').toLowerCase().includes(term)) {
            score += 10;
          }
          // Tag matches are worth more
          if ((post.tags || []).some(tag => tag.toLowerCase().includes(term))) {
            score += 5;
          }
          // Content matches
          if (searchableText.includes(term)) {
            score += 1;
          }
        }

        return { ...post, _searchScore: score };
      }).filter(post => post._searchScore > 0);
    }

    // Tag filter
    if (tags && tags.length > 0) {
      results = results.filter(post => {
        if (!post.tags || post.tags.length === 0) return false;
        const postTags = post.tags.map(t => t.toLowerCase());
        return tags.some(tag => postTags.includes(tag.toLowerCase()));
      });
    }

    // Author filter
    if (author) {
      results = results.filter(post => {
        const postAuthor = post.author?.name || '';
        return postAuthor.toLowerCase().includes(author.toLowerCase());
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      results = results.filter(post => {
        const postDate = new Date(post.datePublished);
        if (dateFrom && postDate < new Date(dateFrom)) return false;
        if (dateTo && postDate > new Date(dateTo)) return false;
        return true;
      });
    }

    // Media filter
    if (hasMedia !== null) {
      results = results.filter(post => {
        const hasAttachments = post.attachments && post.attachments.length > 0;
        return hasMedia ? hasAttachments : !hasAttachments;
      });
    }

    // Sort results
    results = this.sortResults(results, sortBy, sortOrder);

    // Pagination
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults.map(post => {
        const { _searchScore, ...cleanPost } = post;
        return cleanPost;
      }),
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  /**
   * Sort search results
   * @param {Array} results - Results to sort
   * @param {string} sortBy - Sort field
   * @param {string} sortOrder - Sort order (asc/desc)
   * @returns {Array} Sorted results
   */
  sortResults(results, sortBy, sortOrder) {
    const sorted = [...results].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = (a._searchScore || 0) - (b._searchScore || 0);
          break;
        case 'date':
          comparison = new Date(a.datePublished) - new Date(b.datePublished);
          break;
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'author':
          comparison = (a.author?.name || '').localeCompare(b.author?.name || '');
          break;
        case 'interactions':
          const aScore = (a.interactions?.likes_count || 0) + 
                        (a.interactions?.shares_count || 0) + 
                        (a.interactions?.replies_count || 0);
          const bScore = (b.interactions?.likes_count || 0) + 
                        (b.interactions?.shares_count || 0) + 
                        (b.interactions?.replies_count || 0);
          comparison = aScore - bScore;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Get search suggestions based on query
   * @param {Array} posts - Posts to analyze
   * @param {string} query - Search query
   * @param {number} limit - Maximum suggestions
   * @returns {Array} Search suggestions
   */
  getSuggestions(posts, query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const suggestions = new Set();
    const queryLower = query.toLowerCase();

    // Tag suggestions
    posts.forEach(post => {
      if (post.tags) {
        post.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) {
            suggestions.add(`tag:${tag}`);
          }
        });
      }
    });

    // Title suggestions
    posts.forEach(post => {
      if (post.title && post.title.toLowerCase().includes(queryLower)) {
        suggestions.add(post.title);
      }
    });

    // Author suggestions
    const authors = new Set();
    posts.forEach(post => {
      if (post.author?.name) {
        authors.add(post.author.name);
      }
    });
    
    authors.forEach(author => {
      if (author.toLowerCase().includes(queryLower)) {
        suggestions.add(`author:${author}`);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }
}

/**
 * Content Recommendation Engine
 */
export class RecommendationEngine {
  /**
   * Get related posts based on content similarity
   * @param {Object} post - Reference post
   * @param {Array} allPosts - All available posts
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended posts
   */
  getRelatedPosts(post, allPosts, limit = 5) {
    if (!post || !allPosts || allPosts.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const scored = allPosts
      .filter(p => p.id !== post.id) // Exclude the reference post
      .map(p => ({
        post: p,
        score: this.calculateSimilarity(post, p)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(item => ({
      ...item.post,
      similarityScore: item.score
    }));
  }

  /**
   * Calculate similarity between two posts
   * @param {Object} post1 - First post
   * @param {Object} post2 - Second post
   * @returns {number} Similarity score
   */
  calculateSimilarity(post1, post2) {
    let score = 0;

    // Tag similarity (highest weight)
    if (post1.tags && post2.tags) {
      const tags1 = new Set(post1.tags.map(t => t.toLowerCase()));
      const tags2 = new Set(post2.tags.map(t => t.toLowerCase()));
      const intersection = new Set([...tags1].filter(t => tags2.has(t)));
      const union = new Set([...tags1, ...tags2]);
      
      if (union.size > 0) {
        score += (intersection.size / union.size) * 50; // Jaccard similarity
      }
    }

    // Author similarity
    if (post1.author?.name === post2.author?.name) {
      score += 20;
    }

    // Content type similarity (both have media)
    const post1HasMedia = post1.attachments && post1.attachments.length > 0;
    const post2HasMedia = post2.attachments && post2.attachments.length > 0;
    if (post1HasMedia && post2HasMedia) {
      score += 10;
    }

    // Temporal proximity (posts published close together)
    if (post1.datePublished && post2.datePublished) {
      const date1 = new Date(post1.datePublished);
      const date2 = new Date(post2.datePublished);
      const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 7) {
        score += 10;
      } else if (daysDiff < 30) {
        score += 5;
      }
    }

    // Title/content similarity (simple word overlap)
    const words1 = this.extractWords(post1.title + ' ' + (post1.summary || ''));
    const words2 = this.extractWords(post2.title + ' ' + (post2.summary || ''));
    const wordIntersection = words1.filter(w => words2.includes(w));
    
    if (words1.length > 0 && words2.length > 0) {
      score += (wordIntersection.length / Math.max(words1.length, words2.length)) * 20;
    }

    return score;
  }

  /**
   * Extract meaningful words from text
   * @param {string} text - Text to process
   * @returns {Array} Array of words
   */
  extractWords(text) {
    if (!text) return [];
    
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Get trending posts based on recent interactions
   * @param {Array} posts - Posts to analyze
   * @param {number} timeWindowHours - Time window in hours
   * @param {number} limit - Maximum results
   * @returns {Array} Trending posts
   */
  getTrendingPosts(posts, timeWindowHours = 24, limit = 10) {
    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const scored = posts.map(post => {
      const postDate = new Date(post.datePublished);
      let score = 0;

      // Recent posts get bonus
      if (postDate >= cutoffTime) {
        score += 50;
      }

      // Interaction score
      score += (post.interactions?.likes_count || 0) * 3;
      score += (post.interactions?.shares_count || 0) * 5;
      score += (post.interactions?.replies_count || 0) * 2;

      // Decay score based on age
      const ageHours = (Date.now() - postDate.getTime()) / (1000 * 60 * 60);
      const decayFactor = Math.exp(-ageHours / (timeWindowHours * 2));
      score *= decayFactor;

      return { post, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.post,
        trendingScore: item.score
      }));
  }

  /**
   * Get popular posts based on total interactions
   * @param {Array} posts - Posts to analyze
   * @param {number} limit - Maximum results
   * @returns {Array} Popular posts
   */
  getPopularPosts(posts, limit = 10) {
    return posts
      .map(post => {
        const score = (post.interactions?.likes_count || 0) * 1 +
                     (post.interactions?.shares_count || 0) * 2 +
                     (post.interactions?.replies_count || 0) * 1.5;
        return { post, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.post,
        popularityScore: item.score
      }));
  }
}

/**
 * Content Analytics
 */
export class ContentAnalytics {
  /**
   * Get content statistics
   * @param {Array} posts - Posts to analyze
   * @returns {Object} Content statistics
   */
  getStatistics(posts) {
    const stats = {
      totalPosts: posts.length,
      totalInteractions: 0,
      totalLikes: 0,
      totalShares: 0,
      totalReplies: 0,
      postsWithMedia: 0,
      postsWithImages: 0,
      postsWithVideo: 0,
      postsWithAudio: 0,
      averageInteractionsPerPost: 0,
      mostUsedTags: [],
      mostActiveAuthors: [],
      contentByMonth: {}
    };

    // Tag frequency
    const tagCounts = new Map();
    // Author frequency
    const authorCounts = new Map();

    for (const post of posts) {
      // Interaction counts
      stats.totalLikes += post.interactions?.likes_count || 0;
      stats.totalShares += post.interactions?.shares_count || 0;
      stats.totalReplies += post.interactions?.replies_count || 0;
      stats.totalInteractions += (post.interactions?.likes_count || 0) +
                                 (post.interactions?.shares_count || 0) +
                                 (post.interactions?.replies_count || 0);

      // Media counts
      if (post.attachments && post.attachments.length > 0) {
        stats.postsWithMedia++;
        
        for (const attachment of post.attachments) {
          if (attachment.mime_type?.startsWith('image/')) stats.postsWithImages++;
          if (attachment.mime_type?.startsWith('video/')) stats.postsWithVideo++;
          if (attachment.mime_type?.startsWith('audio/')) stats.postsWithAudio++;
        }
      }

      // Tag frequency
      if (post.tags) {
        for (const tag of post.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Author frequency
      if (post.author?.name) {
        authorCounts.set(post.author.name, (authorCounts.get(post.author.name) || 0) + 1);
      }

      // Content by month
      if (post.datePublished) {
        const date = new Date(post.datePublished);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        stats.contentByMonth[monthKey] = (stats.contentByMonth[monthKey] || 0) + 1;
      }
    }

    // Calculate averages
    if (posts.length > 0) {
      stats.averageInteractionsPerPost = stats.totalInteractions / posts.length;
    }

    // Most used tags
    stats.mostUsedTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Most active authors
    stats.mostActiveAuthors = Array.from(authorCounts.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Get insights about content
   * @param {Array} posts - Posts to analyze
   * @returns {Object} Content insights
   */
  getInsights(posts) {
    const stats = this.getStatistics(posts);
    const insights = [];

    // Engagement insights
    if (stats.averageInteractionsPerPost > 10) {
      insights.push({
        type: 'engagement',
        level: 'high',
        message: `High engagement with an average of ${stats.averageInteractionsPerPost.toFixed(1)} interactions per post`
      });
    } else if (stats.averageInteractionsPerPost < 2) {
      insights.push({
        type: 'engagement',
        level: 'low',
        message: 'Low engagement - consider posting more interactive content'
      });
    }

    // Media usage insights
    const mediaPercentage = (stats.postsWithMedia / stats.totalPosts) * 100;
    if (mediaPercentage < 30) {
      insights.push({
        type: 'media',
        level: 'suggestion',
        message: `Only ${mediaPercentage.toFixed(0)}% of posts include media - posts with images tend to get more engagement`
      });
    }

    // Tag usage insights
    if (stats.mostUsedTags.length > 0) {
      const topTag = stats.mostUsedTags[0];
      insights.push({
        type: 'tags',
        level: 'info',
        message: `Most used tag is "${topTag.tag}" with ${topTag.count} posts`
      });
    }

    // Content frequency insights
    const monthCount = Object.keys(stats.contentByMonth).length;
    if (monthCount > 0) {
      const avgPostsPerMonth = stats.totalPosts / monthCount;
      insights.push({
        type: 'frequency',
        level: 'info',
        message: `Average of ${avgPostsPerMonth.toFixed(1)} posts per month`
      });
    }

    return {
      insights,
      statistics: stats
    };
  }
}

// Create singleton instances
export const contentSearch = new ContentSearch();
export const recommendationEngine = new RecommendationEngine();
export const contentAnalytics = new ContentAnalytics();
