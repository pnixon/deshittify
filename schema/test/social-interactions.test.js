/**
 * Test Suite for Social Interaction Features
 * Tests reply threading, interaction tracking, and social metadata management
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ReplyThreadingSystem, InteractionTrackingSystem } from '../social-interactions.js';
import { SocialMetadataManager } from '../social-metadata.js';

describe('Social Interaction Features', () => {
  let threadingSystem;
  let interactionSystem;
  let metadataManager;

  beforeEach(() => {
    threadingSystem = new ReplyThreadingSystem();
    interactionSystem = new InteractionTrackingSystem();
    metadataManager = new SocialMetadataManager();
  });

  describe('Reply Threading System', () => {
    const createTestItem = (id, inReplyTo = null, publishedDate = '2025-11-04T10:00:00Z') => ({
      id: `https://example.com/posts/${id}`,
      url: `https://example.com/posts/${id}`,
      content_text: `Test post ${id}`,
      date_published: publishedDate,
      author: { name: `Author${id}`, public_key: 'ed25519:test' },
      signature: 'ed25519:testsig',
      ...(inReplyTo && { in_reply_to: inReplyTo })
    });

    it('should reconstruct simple thread structure', () => {
      const items = [
        createTestItem('1'),
        createTestItem('2', 'https://example.com/posts/1', '2025-11-04T11:00:00Z'),
        createTestItem('3', 'https://example.com/posts/1', '2025-11-04T12:00:00Z')
      ];

      const threads = threadingSystem.reconstructThreads(items);
      
      assert.strictEqual(threads.size, 1);
      const rootThread = threads.get('https://example.com/posts/1');
      assert.ok(rootThread);
      assert.strictEqual(rootThread.replies.length, 2);
      assert.strictEqual(rootThread.metadata.reply_count, 2);
    });

    it('should handle complex conversation structures', () => {
      const items = [
        createTestItem('1'),
        createTestItem('2', 'https://example.com/posts/1'),
        createTestItem('3', 'https://example.com/posts/2'),
        createTestItem('4', 'https://example.com/posts/2'),
        createTestItem('5', 'https://example.com/posts/3')
      ];

      const threads = threadingSystem.reconstructThreads(items);
      const rootThread = threads.get('https://example.com/posts/1');
      
      assert.strictEqual(rootThread.replies.length, 1);
      assert.strictEqual(rootThread.replies[0].replies.length, 2);
      assert.strictEqual(rootThread.replies[0].replies[0].replies.length, 1);
    });

    it('should validate reply relationship integrity', () => {
      const parentItem = createTestItem('1');
      const replyItem = createTestItem('2', 'https://example.com/posts/1', '2025-11-04T11:00:00Z');

      const result = threadingSystem.validateReplyRelationship(replyItem, parentItem);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect invalid reply relationships', () => {
      const parentItem = createTestItem('1');
      const invalidReply = createTestItem('2', 'https://example.com/posts/999');

      const result = threadingSystem.validateReplyRelationship(invalidReply, parentItem);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(error => error.code === 'REPLY_URL_MISMATCH'));
    });

    it('should create reply with proper threading metadata', () => {
      const parentItem = createTestItem('1');
      const replyData = {
        id: 'https://example.com/posts/2',
        url: 'https://example.com/posts/2',
        content_text: 'This is a reply'
      };

      const reply = threadingSystem.createReply(parentItem, replyData);
      
      assert.strictEqual(reply.in_reply_to, parentItem.id);
      assert.ok(reply._thread_metadata);
      assert.strictEqual(reply._thread_metadata.parent_id, parentItem.id);
    });
  });

  describe('Interaction Tracking System', () => {
    it('should update interaction counts correctly', () => {
      const itemId = 'https://example.com/posts/1';
      const interactions = {
        replies_count: 5,
        likes_count: 10,
        shares_count: 3
      };

      const result = interactionSystem.updateInteractionCounts(itemId, interactions);
      
      assert.strictEqual(result.replies_count, 5);
      assert.strictEqual(result.likes_count, 10);
      assert.strictEqual(result.shares_count, 3);
      assert.ok(result.last_updated);
    });

    it('should increment specific interaction types', () => {
      const itemId = 'https://example.com/posts/1';
      
      interactionSystem.incrementInteraction(itemId, 'likes', 1);
      interactionSystem.incrementInteraction(itemId, 'likes', 2);
      
      const stats = interactionSystem.getInteractionStats(itemId);
      assert.strictEqual(stats.breakdown.likes, 3);
    });

    it('should create proper interaction endpoints', () => {
      const itemId = 'https://example.com/posts/1';
      const baseUrl = 'https://api.example.com';

      const endpoints = interactionSystem.createInteractionEndpoints(itemId, baseUrl);
      
      assert.ok(endpoints.replies_url.includes('/interactions/'));
      assert.ok(endpoints.likes_url.includes('/interactions/'));
      assert.ok(endpoints.shares_url.includes('/interactions/'));
    });

    it('should validate interaction counts', () => {
      const itemId = 'https://example.com/posts/1';
      const invalidInteractions = {
        replies_count: -1,
        likes_count: 'invalid',
        shares_count: 5
      };

      assert.throws(() => {
        interactionSystem.updateInteractionCounts(itemId, invalidInteractions);
      });
    });
  });

  describe('Social Metadata Manager', () => {
    it('should create social metadata for items', () => {
      const item = {
        id: 'https://example.com/posts/1',
        content_text: 'Test post',
        tags: ['test', 'social'],
        attachments: [{
          url: 'https://example.com/image.jpg',
          mime_type: 'image/jpeg',
          alt_text: 'Test image'
        }],
        interactions: {
          replies_count: 2,
          likes_count: 5,
          shares_count: 1
        }
      };

      const metadata = metadataManager.createSocialMetadata(item);
      
      assert.strictEqual(metadata.item_id, item.id);
      assert.strictEqual(metadata.social_features.has_media, true);
      assert.strictEqual(metadata.social_features.has_tags, true);
      assert.strictEqual(metadata.social_features.has_interactions, true);
      assert.strictEqual(metadata.accessibility_metadata.has_alt_text, true);
    });

    it('should update social metadata', () => {
      const itemId = 'https://example.com/posts/1';
      const item = { id: itemId, content_text: 'Test' };
      
      metadataManager.createSocialMetadata(item);
      
      const updates = {
        engagement_metadata: {
          reply_enabled: false
        }
      };
      
      const updated = metadataManager.updateSocialMetadata(itemId, updates);
      
      assert.strictEqual(updated.engagement_metadata.reply_enabled, false);
      assert.ok(updated.updated_at);
    });

    it('should register and use platform mappings', () => {
      const mockHandler = (item) => ({
        platform_id: `activitypub:${item.id}`,
        actor_url: 'https://mastodon.example.com/users/test'
      });

      metadataManager.registerPlatformMapping('activitypub', mockHandler);
      
      const item = { id: 'https://example.com/posts/1', content_text: 'Test' };
      const metadata = metadataManager.createSocialMetadata(item);
      
      assert.ok(metadata.platform_mappings.activitypub);
      assert.ok(metadata.platform_mappings.activitypub.platform_id.includes('activitypub:'));
    });
  });

  describe('Cross-Platform Interaction Handling', () => {
    it('should handle cross-platform interaction synchronization', async () => {
      const itemId = 'https://example.com/posts/1';
      
      // Mock sync handler
      const mockSyncHandler = async (id, options) => ({
        replies_count: 3,
        likes_count: 7,
        shares_count: 2,
        platform: options.platform
      });

      interactionSystem.registerSyncHandler('activitypub', mockSyncHandler);
      interactionSystem.registerSyncHandler('atproto', mockSyncHandler);

      const syncResult = await interactionSystem.syncInteractions(
        itemId, 
        ['activitypub', 'atproto']
      );

      assert.ok(syncResult.platforms.activitypub);
      assert.ok(syncResult.platforms.atproto);
      assert.strictEqual(syncResult.aggregated.replies_count, 6); // 3 + 3
      assert.strictEqual(syncResult.aggregated.likes_count, 14); // 7 + 7
    });

    it('should handle sync errors gracefully', async () => {
      const itemId = 'https://example.com/posts/1';
      
      const failingSyncHandler = async () => {
        throw new Error('Platform unavailable');
      };

      interactionSystem.registerSyncHandler('failing_platform', failingSyncHandler);

      const syncResult = await interactionSystem.syncInteractions(
        itemId, 
        ['failing_platform']
      );

      assert.strictEqual(syncResult.errors.length, 1);
      assert.strictEqual(syncResult.errors[0].platform, 'failing_platform');
    });

    it('should batch update interactions efficiently', () => {
      const updates = [
        {
          itemId: 'https://example.com/posts/1',
          interactions: { replies_count: 1, likes_count: 2, shares_count: 0 }
        },
        {
          itemId: 'https://example.com/posts/2',
          interactions: { replies_count: 0, likes_count: 5, shares_count: 1 }
        }
      ];

      const results = interactionSystem.batchUpdateInteractions(updates);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].success, true);
      assert.strictEqual(results[1].success, true);
      assert.strictEqual(results[0].interactions.likes_count, 2);
      assert.strictEqual(results[1].interactions.likes_count, 5);
    });
  });
});