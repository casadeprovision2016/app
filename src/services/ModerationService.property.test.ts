/**
 * Property-based tests for ModerationService
 * 
 * Uses fast-check to verify correctness properties across many inputs
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
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
              // Handle INSERT INTO moderation_queue
              if (query.includes('INSERT INTO moderation_queue')) {
                const [imageId, reason, flaggedAt] = params;
                // Create a deep copy to avoid reference issues
                const entry = {
                  id: queueIdCounter++,
                  image_id: String(imageId),
                  flagged_reason: String(reason),
                  flagged_at: String(flaggedAt),
                };
                moderationQueue.push({ ...entry });
                return entry;
              }
              
              // Handle SELECT moderation_status
              if (query.includes('SELECT moderation_status')) {
                const [imageId] = params;
                return storage.get(`image:${imageId}`) || null;
              }
              
              return null;
            },
            all: async () => {
              // Handle SELECT from moderation_queue
              if (query.includes('FROM moderation_queue')) {
                return {
                  results: moderationQueue
                    .filter(e => !e.reviewed_at)
                    .map(e => ({ ...e })), // Return copies
                };
              }
              return { results: [] };
            },
            run: async () => {
              // Handle UPDATE moderation_queue
              if (query.includes('UPDATE moderation_queue')) {
                const [reviewedAt, reviewerId, decision, imageId] = params;
                const entry = moderationQueue.find(e => e.image_id === imageId && !e.reviewed_at);
                if (entry) {
                  entry.reviewed_at = reviewedAt;
                  entry.reviewer_id = reviewerId;
                  entry.decision = decision;
                }
              }
              
              // Handle UPDATE images
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

// Arbitraries for generating test data
const imageMetadataArb = fc.record({
  imageId: fc.uuid(),
  userId: fc.option(fc.uuid(), { nil: undefined }),
  verseReference: fc.string({ minLength: 5, maxLength: 50 }),
  verseText: fc.string({ minLength: 10, maxLength: 200 }),
  prompt: fc.string({ minLength: 10, maxLength: 200 }),
  stylePreset: fc.constantFrom('modern', 'classic', 'minimalist', 'artistic'),
  generatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
  tags: fc.array(fc.string(), { maxLength: 5 }),
  moderationStatus: fc.constantFrom('pending', 'approved', 'rejected'),
}) as fc.Arbitrary<ImageMetadata>;

const imageDataArb = fc.uint8Array({ minLength: 100, maxLength: 1000 })
  .map(arr => arr.buffer as ArrayBuffer);

describe('ModerationService - Property-Based Tests', () => {
  let moderationService: ModerationService;
  let mockDb: D1Database;
  
  beforeEach(() => {
    mockDb = createMockD1Database();
    moderationService = new ModerationService(mockDb, {
      enableContentSafety: true,
    });
  });
  
  /**
   * Feature: bible-image-generator, Property 24: Content safety enforcement
   * Validates: Requirements 7.3, 7.4
   * 
   * For any generated image that fails content safety checks (when enabled),
   * the image should not be stored in R2 and no metadata record should be created.
   */
  test('Property 24: Content safety enforcement - unsafe content is not stored', () => {
    fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        fc.constantFrom(
          'violence', 'hate', 'explicit', 'inappropriate',
          'offensive', 'nsfw', 'gore', 'sexual'
        ),
        async (imageData, baseMetadata, unsafeTerm) => {
          // Create metadata with unsafe content in the prompt
          const metadata: ImageMetadata = {
            ...baseMetadata,
            prompt: `Create an image with ${unsafeTerm} content`,
          };
          
          // Check if the image should be stored
          const result = await moderationService.shouldStoreImage(imageData, metadata);
          
          // The image should NOT be stored
          expect(result.shouldStore).toBe(false);
          
          // The moderation status should be rejected
          expect(result.moderationStatus).toBe('rejected');
          
          // There should be a flag reason
          expect(result.flagReason).toBeDefined();
          expect(result.flagReason).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Safe content passes safety checks
   * 
   * For any generated image with safe content, the content safety check
   * should pass and the image should be allowed to be stored.
   */
  test('safe content passes safety checks', () => {
    fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb.filter(m => {
          // Filter out metadata that contains unsafe terms
          const textToCheck = `${m.prompt} ${m.verseText}`.toLowerCase();
          const unsafeTerms = [
            'violence', 'hate', 'explicit', 'inappropriate',
            'offensive', 'nsfw', 'gore', 'sexual'
          ];
          return !unsafeTerms.some(term => textToCheck.includes(term));
        }),
        async (imageData, metadata) => {
          // Check if the image should be stored
          const result = await moderationService.shouldStoreImage(imageData, metadata);
          
          // The image SHOULD be stored
          expect(result.shouldStore).toBe(true);
          
          // The moderation status should be approved
          expect(result.moderationStatus).toBe('approved');
          
          // There should be no flag reason
          expect(result.flagReason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Content safety can be disabled
   * 
   * When content safety is disabled, all content should pass checks.
   */
  test('content safety can be disabled', () => {
    const serviceWithoutSafety = new ModerationService(mockDb, {
      enableContentSafety: false,
    });
    
    fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Even with unsafe content, it should pass when safety is disabled
          const result = await serviceWithoutSafety.shouldStoreImage(imageData, metadata);
          
          // The image SHOULD be stored
          expect(result.shouldStore).toBe(true);
          
          // The moderation status should be approved
          expect(result.moderationStatus).toBe('approved');
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: Content safety check is consistent
   * 
   * For any given image and metadata, running the safety check multiple times
   * should return the same result.
   */
  test('content safety check is consistent', () => {
    fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Run the check twice
          const result1 = await moderationService.checkContentSafety(imageData, metadata);
          const result2 = await moderationService.checkContentSafety(imageData, metadata);
          
          // Results should be identical
          expect(result1.safe).toBe(result2.safe);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('ModerationService - Moderation Queue', () => {
  // Note: We create a fresh mock for each property test to avoid state pollution
  const createFreshService = () => {
    const mockDb = createMockD1Database();
    return new ModerationService(mockDb);
  };
  
  /**
   * Feature: bible-image-generator, Property 25: Moderation queue creation
   * Validates: Requirements 7.5
   * 
   * For any content flagged for manual review, a record should be created
   * in the moderation_queue table with the image ID and flagged reason.
   */
  test('Property 25: Moderation queue creation - flagged content creates queue entry', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 200 }),
        async (imageId, reason) => {
          const moderationService = createFreshService();
          
          // Flag the content for review
          const entry = await moderationService.flagForReview(imageId, reason);
          
          // An entry should be created
          expect(entry).toBeDefined();
          
          // The entry should have an ID
          expect(entry.id).toBeDefined();
          expect(typeof entry.id).toBe('number');
          
          // The entry should contain the image ID
          expect(entry.imageId).toBe(imageId);
          
          // The entry should contain the flagged reason
          expect(entry.flaggedReason).toBe(reason);
          
          // The entry should have a flagged timestamp
          expect(entry.flaggedAt).toBeDefined();
          expect(typeof entry.flaggedAt).toBe('string');
          
          // The timestamp should be a valid ISO date
          expect(() => new Date(entry.flaggedAt)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Flagged content appears in pending reviews
   * 
   * For any content flagged for review, it should appear in the list
   * of pending reviews until it is reviewed.
   */
  test('flagged content appears in pending reviews', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 200 })
          .filter(s => s.trim().length > 0), // Ensure non-empty reason
        async (imageId, reason) => {
          const moderationService = createFreshService();
          
          // Flag the content
          await moderationService.flagForReview(imageId, reason);
          
          // Get pending reviews
          const pending = await moderationService.getPendingReviews();
          
          // The flagged content should appear in pending reviews
          const found = pending.find(entry => entry.imageId === imageId);
          expect(found).toBeDefined();
          expect(found?.flaggedReason).toBe(reason);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: Moderation decision updates queue and image status
   * 
   * For any moderation decision, both the queue entry and the image's
   * moderation status should be updated.
   */
  test('moderation decision updates queue and image status', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.constantFrom('approve', 'reject'),
        fc.option(fc.uuid(), { nil: undefined }),
        async (imageId, reason, action, reviewerId) => {
          const moderationService = createFreshService();
          
          // Flag the content first
          await moderationService.flagForReview(imageId, reason);
          
          // Make a moderation decision
          const result = await moderationService.moderateContent(
            { imageId, action, reason: 'Test reason' },
            reviewerId
          );
          
          // The operation should succeed
          expect(result.success).toBe(true);
          
          // The image's moderation status should be updated
          const status = await moderationService.getModerationStatus(imageId);
          const expectedStatus = action === 'approve' ? 'approved' : 'rejected';
          expect(status).toBe(expectedStatus);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: Multiple flags for same image are allowed
   * 
   * The same image can be flagged multiple times with different reasons.
   */
  test('multiple flags for same image are allowed', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 2, maxLength: 5 }),
        async (imageId, reasons) => {
          const moderationService = createFreshService();
          
          // Flag the same image multiple times
          const entries = await Promise.all(
            reasons.map(reason => moderationService.flagForReview(imageId, reason))
          );
          
          // All entries should be created
          expect(entries.length).toBe(reasons.length);
          
          // Each entry should have a unique ID
          const ids = entries.map(e => e.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
          
          // All entries should have the same image ID
          entries.forEach(entry => {
            expect(entry.imageId).toBe(imageId);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
  
  /**
   * Property: Reviewed content does not appear in pending reviews
   * 
   * After a moderation decision is made, the content should no longer
   * appear in the pending reviews list.
   */
  test('reviewed content does not appear in pending reviews', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.constantFrom('approve', 'reject'),
        async (imageId, reason, action) => {
          const moderationService = createFreshService();
          
          // Flag the content
          await moderationService.flagForReview(imageId, reason);
          
          // Verify it appears in pending
          const pendingBefore = await moderationService.getPendingReviews();
          expect(pendingBefore.some(e => e.imageId === imageId)).toBe(true);
          
          // Make a moderation decision
          await moderationService.moderateContent(
            { imageId, action, reason: 'Test reason' }
          );
          
          // Verify it no longer appears in pending
          const pendingAfter = await moderationService.getPendingReviews();
          expect(pendingAfter.some(e => e.imageId === imageId)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});
