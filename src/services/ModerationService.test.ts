/**
 * Unit tests for ModerationService
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ModerationService } from './ModerationService';
import { ImageMetadata } from '../types';

// Mock D1Database for testing
const createMockD1Database = (): D1Database => {
  const storage = new Map<string, any>();
  const moderationQueue: any[] = [];
  let queueIdCounter = 1;
  
  return {
    prepare: (query: string) => {
      return {
        bind: (...params: any[]) => {
          return {
            first: async () => {
              if (query.includes('INSERT INTO moderation_queue')) {
                const [imageId, reason, flaggedAt] = params;
                const entry = {
                  id: queueIdCounter++,
                  image_id: String(imageId),
                  flagged_reason: String(reason),
                  flagged_at: String(flaggedAt),
                };
                moderationQueue.push({ ...entry });
                return entry;
              }
              
              if (query.includes('SELECT moderation_status')) {
                const [imageId] = params;
                return storage.get(`image:${imageId}`) || null;
              }
              
              return null;
            },
            all: async () => {
              if (query.includes('FROM moderation_queue')) {
                const filtered = moderationQueue.filter(e => !e.reviewed_at);
                // Handle LIMIT clause
                const limit = params[0] as number;
                const limited = limit ? filtered.slice(0, limit) : filtered;
                return {
                  results: limited.map(e => ({ ...e })),
                };
              }
              return { results: [] };
            },
            run: async () => {
              if (query.includes('UPDATE moderation_queue')) {
                const [reviewedAt, reviewerId, decision, imageId] = params;
                const entry = moderationQueue.find(e => e.image_id === imageId && !e.reviewed_at);
                if (entry) {
                  entry.reviewed_at = reviewedAt;
                  entry.reviewer_id = reviewerId;
                  entry.decision = decision;
                }
              }
              
              if (query.includes('UPDATE images')) {
                const [moderationStatus, imageId] = params;
                storage.set(`image:${imageId}`, { moderation_status: moderationStatus });
              }
              
              return { success: true };
            },
          };
        },
      };
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as any;
};

describe('ModerationService', () => {
  let moderationService: ModerationService;
  let mockDb: D1Database;
  
  beforeEach(() => {
    mockDb = createMockD1Database();
    moderationService = new ModerationService(mockDb, {
      enableContentSafety: true,
    });
  });
  
  describe('checkContentSafety', () => {
    test('returns safe for clean content', async () => {
      const imageData = new ArrayBuffer(100);
      const metadata: ImageMetadata = {
        imageId: 'test-id',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world',
        prompt: 'Create a beautiful inspirational image',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'pending',
      };
      
      const result = await moderationService.checkContentSafety(imageData, metadata);
      
      expect(result.safe).toBe(true);
    });
    
    test('returns unsafe for content with concerning patterns', async () => {
      const imageData = new ArrayBuffer(100);
      const metadata: ImageMetadata = {
        imageId: 'test-id',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world',
        prompt: 'Create an image with violence',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'pending',
      };
      
      const result = await moderationService.checkContentSafety(imageData, metadata);
      
      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('violence');
    });
    
    test('returns safe when content safety is disabled', async () => {
      const serviceWithoutSafety = new ModerationService(mockDb, {
        enableContentSafety: false,
      });
      
      const imageData = new ArrayBuffer(100);
      const metadata: ImageMetadata = {
        imageId: 'test-id',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world',
        prompt: 'Create an image with violence',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'pending',
      };
      
      const result = await serviceWithoutSafety.checkContentSafety(imageData, metadata);
      
      expect(result.safe).toBe(true);
    });
  });
  
  describe('flagForReview', () => {
    test('creates a moderation queue entry', async () => {
      const imageId = 'test-image-id';
      const reason = 'Suspicious content detected';
      
      const entry = await moderationService.flagForReview(imageId, reason);
      
      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.imageId).toBe(imageId);
      expect(entry.flaggedReason).toBe(reason);
      expect(entry.flaggedAt).toBeDefined();
    });
  });
  
  describe('getPendingReviews', () => {
    test('returns empty array when no pending reviews', async () => {
      const pending = await moderationService.getPendingReviews();
      
      expect(pending).toEqual([]);
    });
    
    test('returns pending reviews', async () => {
      await moderationService.flagForReview('image-1', 'Reason 1');
      await moderationService.flagForReview('image-2', 'Reason 2');
      
      const pending = await moderationService.getPendingReviews();
      
      expect(pending).toHaveLength(2);
      expect(pending[0].imageId).toBe('image-1');
      expect(pending[1].imageId).toBe('image-2');
    });
    
    test('respects limit parameter', async () => {
      await moderationService.flagForReview('image-1', 'Reason 1');
      await moderationService.flagForReview('image-2', 'Reason 2');
      await moderationService.flagForReview('image-3', 'Reason 3');
      
      const pending = await moderationService.getPendingReviews(2);
      
      expect(pending).toHaveLength(2);
    });
  });
  
  describe('moderateContent', () => {
    test('approves content and updates status', async () => {
      const imageId = 'test-image-id';
      await moderationService.flagForReview(imageId, 'Test reason');
      
      const result = await moderationService.moderateContent(
        { imageId, action: 'approve' },
        'reviewer-123'
      );
      
      expect(result.success).toBe(true);
      
      const status = await moderationService.getModerationStatus(imageId);
      expect(status).toBe('approved');
    });
    
    test('rejects content and updates status', async () => {
      const imageId = 'test-image-id';
      await moderationService.flagForReview(imageId, 'Test reason');
      
      const result = await moderationService.moderateContent(
        { imageId, action: 'reject', reason: 'Inappropriate content' },
        'reviewer-123'
      );
      
      expect(result.success).toBe(true);
      
      const status = await moderationService.getModerationStatus(imageId);
      expect(status).toBe('rejected');
    });
  });
  
  describe('shouldStoreImage', () => {
    test('allows storage for safe content', async () => {
      const imageData = new ArrayBuffer(100);
      const metadata: ImageMetadata = {
        imageId: 'test-id',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world',
        prompt: 'Create a beautiful inspirational image',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'pending',
      };
      
      const result = await moderationService.shouldStoreImage(imageData, metadata);
      
      expect(result.shouldStore).toBe(true);
      expect(result.moderationStatus).toBe('approved');
    });
    
    test('prevents storage for unsafe content', async () => {
      const imageData = new ArrayBuffer(100);
      const metadata: ImageMetadata = {
        imageId: 'test-id',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world',
        prompt: 'Create an image with violence',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'pending',
      };
      
      const result = await moderationService.shouldStoreImage(imageData, metadata);
      
      expect(result.shouldStore).toBe(false);
      expect(result.moderationStatus).toBe('rejected');
      expect(result.flagReason).toBeDefined();
    });
  });
});
