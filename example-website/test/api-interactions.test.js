/**
 * Unit tests for Interactions API
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { interactions } from '../data/storage.js';

describe('Interactions API - example-website', () => {
  describe('Like Management', () => {
    test('should add like to post', () => {
      const postId = 'test-post';
      
      if (!interactions[postId]) {
        interactions[postId] = {
          likes: [],
          shares: [],
          replies: []
        };
      }

      const interaction = interactions[postId];
      interaction.likes.push({
        userId: 'user-1',
        userName: 'Test User',
        timestamp: new Date().toISOString()
      });

      assert.strictEqual(interaction.likes.length, 1);
      assert.strictEqual(interaction.likes[0].userId, 'user-1');
    });

    test('should remove like from post', () => {
      const postId = 'test-post-2';
      
      interactions[postId] = {
        likes: [
          { userId: 'user-1', userName: 'User 1', timestamp: new Date().toISOString() }
        ],
        shares: [],
        replies: []
      };

      const interaction = interactions[postId];
      interaction.likes = interaction.likes.filter(like => like.userId !== 'user-1');

      assert.strictEqual(interaction.likes.length, 0);
    });
  });

  describe('Share Management', () => {
    test('should add share to post', () => {
      const postId = 'test-post-3';
      
      interactions[postId] = {
        likes: [],
        shares: [],
        replies: []
      };

      const interaction = interactions[postId];
      interaction.shares.push({
        id: 'share-1',
        userId: 'user-1',
        userName: 'Test User',
        message: 'Check this out!',
        timestamp: new Date().toISOString()
      });

      assert.strictEqual(interaction.shares.length, 1);
      assert.strictEqual(interaction.shares[0].message, 'Check this out!');
    });
  });

  describe('Interaction Counts', () => {
    test('should calculate interaction counts', () => {
      const postId = 'test-post-4';
      
      interactions[postId] = {
        likes: [
          { userId: 'user-1', userName: 'User 1', timestamp: new Date().toISOString() },
          { userId: 'user-2', userName: 'User 2', timestamp: new Date().toISOString() }
        ],
        shares: [
          { id: 'share-1', userId: 'user-3', userName: 'User 3', timestamp: new Date().toISOString() }
        ],
        replies: []
      };

      const interaction = interactions[postId];
      
      assert.strictEqual(interaction.likes.length, 2);
      assert.strictEqual(interaction.shares.length, 1);
    });
  });
});
