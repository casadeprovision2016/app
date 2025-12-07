/**
 * Property-based tests for CleanupService
 * 
 * Tests correctness properties for cleanup operations:
 * - Property 33: Age-based cleanup identification
 * - Property 34: Cleanup consistency
 * - Property 35: Protected image exemption
 * - Property 36: Backup before cleanup
 * - Property 37: Backup retention
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { CleanupService, CleanupConfig } from './CleanupService';
import { ImageMetadata } from '../types';

// ============================================================================
// Mock D1 Database
// ============================================================================

class MockD1Database {
  private images: Map<string, any> = new Map();
  
  prepare(query: string) {
    const preparedStatement = {
      bind: (...params: any[]) => ({
        all: async () => {
          // Handle SELECT queries for cleanup identification
          if (query.includes('WHERE generated_at < ?')) {
            const cutoffDate = params[0];
            const results = Array.from(this.images.values())
              .filter(img => img.generated_at < cutoffDate);
            return { results };
          }
          
          // Handle SELECT all for backup
          if (query.includes('ORDER BY created_at ASC')) {
            return { results: Array.from(this.images.values()) };
          }
          
          return { results: [] };
        },
        first: async () => {
          // Handle SELECT by ID
          if (query.includes('WHERE id = ?')) {
            const imageId = params[0];
            return this.images.get(imageId) || null;
          }
          return null;
        },
        run: async () => {
          // Handle DELETE
          if (query.includes('DELETE FROM images WHERE id = ?')) {
            const imageId = params[0];
            this.images.delete(imageId);
          }
          // Handle INSERT for backup test
          if (query.includes('INSERT INTO images')) {
            const [id, user_id, verse_reference, verse_text, prompt, style_preset,
                   r2_key, file_size, format, width, height, tags, moderation_status,
                   generated_at] = params;
            this.images.set(id, {
              id, user_id, verse_reference, verse_text, prompt, style_preset,
              r2_key, file_size, format, width, height, tags, moderation_status,
              generated_at, created_at: generated_at
            });
          }
          return { success: true };
        },
      }),
      // Support .all() without .bind() for backup queries
      all: async () => {
        if (query.includes('ORDER BY created_at ASC')) {
          return { results: Array.from(this.images.values()) };
        }
        return { results: [] };
      },
    };
    
    return preparedStatement;
  }
  
  addImage(image: any) {
    this.images.set(image.id, image);
  }
  
  hasImage(imageId: string): boolean {
    return this.images.has(imageId);
  }
  
  getImageCount(): number {
    return this.images.size;
  }
  
  clear() {
    this.images.clear();
  }
}

// ============================================================================
// Mock R2 Bucket
// ============================================================================

class MockR2Bucket {
  private objects: Map<string, { data: ArrayBuffer; metadata: any; uploaded: Date }> = new Map();
  
  async put(key: string, data: ArrayBuffer | string, options?: any) {
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.objects.set(key, {
      data: buffer,
      metadata: options,
      uploaded: new Date(),
    });
  }
  
  async get(key: string) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      arrayBuffer: async () => obj.data,
      ...obj.metadata,
    };
  }
  
  async delete(key: string) {
    this.objects.delete(key);
  }
  
  async list(options?: { prefix?: string }) {
    const prefix = options?.prefix || '';
    const objects = Array.from(this.objects.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, obj]) => ({
        key,
        size: obj.data.byteLength,
        uploaded: obj.uploaded,
      }));
    return { objects };
  }
  
  hasObject(key: string): boolean {
    return this.objects.has(key);
  }
  
  getObjectCount(): number {
    return this.objects.size;
  }
  
  clear() {
    this.objects.clear();
  }
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const imageMetadataArb = fc.record({
  imageId: fc.uuid(),
  userId: fc.option(fc.uuid(), { nil: undefined }),
  verseReference: fc.string({ minLength: 5, maxLength: 20 }),
  verseText: fc.string({ minLength: 10, maxLength: 200 }),
  prompt: fc.string({ minLength: 10, maxLength: 100 }),
  stylePreset: fc.constantFrom('modern', 'classic', 'minimalist', 'artistic'),
  generatedAt: fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date(Date.now()) }).map(d => d.toISOString()),
  tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 }),
  moderationStatus: fc.constantFrom('pending', 'approved', 'rejected'),
  r2Key: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: undefined }),
  fileSize: fc.option(fc.integer({ min: 1000, max: 5000000 }), { nil: undefined }),
  format: fc.option(fc.constantFrom('webp', 'png', 'jpeg'), { nil: undefined }),
  width: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('CleanupService Property Tests', () => {
  let mockDb: MockD1Database;
  let mockR2: MockR2Bucket;
  let cleanupService: CleanupService;
  
  beforeEach(() => {
    mockDb = new MockD1Database();
    mockR2 = new MockR2Bucket();
  });
  
  /**
   * Feature: bible-image-generator, Property 33: Age-based cleanup identification
   * Validates: Requirements 10.1
   * 
   * For any image older than the retention threshold (excluding protected images),
   * the cleanup process should identify it for deletion.
   */
  test('Property 33: Age-based cleanup identification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }), // retention days
        fc.array(imageMetadataArb, { minLength: 1, maxLength: 20 }),
        async (retentionDays, images) => {
          // Setup
          mockDb.clear();
          mockR2.clear();
          
          const config: CleanupConfig = {
            retentionDays,
            backupRetentionDays: 30,
            protectedTags: ['daily-verse', 'favorite'],
          };
          
          cleanupService = new CleanupService(mockR2 as any, mockDb as any, config);
          
          // Calculate cutoff date
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
          
          // Add images to mock database
          for (const img of images) {
            const dbImage = {
              id: img.imageId,
              user_id: img.userId || null,
              verse_reference: img.verseReference,
              verse_text: img.verseText,
              prompt: img.prompt,
              style_preset: img.stylePreset,
              r2_key: img.r2Key || null,
              file_size: img.fileSize || null,
              format: img.format || null,
              width: img.width || null,
              height: img.height || null,
              tags: JSON.stringify(img.tags),
              moderation_status: img.moderationStatus,
              generated_at: img.generatedAt,
              created_at: img.generatedAt,
            };
            mockDb.addImage(dbImage);
          }
          
          // Execute
          const result = await cleanupService.identifyCleanupCandidates();
          
          // Verify: All images older than cutoff should be identified
          const expectedOldImages = images.filter(img => {
            const imgDate = new Date(img.generatedAt);
            return imgDate < cutoffDate;
          });
          
          // Separate protected from eligible
          const expectedProtected = expectedOldImages.filter(img =>
            img.tags.some(tag => config.protectedTags.includes(tag))
          );
          const expectedEligible = expectedOldImages.filter(img =>
            !img.tags.some(tag => config.protectedTags.includes(tag))
          );
          
          // Assertions
          expect(result.totalImages).toBe(expectedOldImages.length);
          expect(result.totalProtected).toBe(expectedProtected.length);
          expect(result.totalEligible).toBe(expectedEligible.length);
          
          // All eligible images should be older than retention threshold
          for (const eligible of result.eligibleImages) {
            const imgDate = new Date(eligible.generatedAt);
            expect(imgDate.getTime()).toBeLessThan(cutoffDate.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 34: Cleanup consistency
   * Validates: Requirements 10.2
   * 
   * For any image deleted during cleanup, both the R2 object and the D1
   * metadata record should be removed.
   */
  test('Property 34: Cleanup consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(imageMetadataArb, { minLength: 1, maxLength: 10 }),
        async (images) => {
          // Setup
          mockDb.clear();
          mockR2.clear();
          
          const config: CleanupConfig = {
            retentionDays: 90,
            backupRetentionDays: 30,
            protectedTags: ['daily-verse', 'favorite'],
            dryRun: false,
          };
          
          cleanupService = new CleanupService(mockR2 as any, mockDb as any, config);
          
          // Add images to both R2 and D1
          for (const img of images) {
            // Add to R2
            const imageData = new Uint8Array(img.fileSize || 1000);
            await mockR2.put(img.r2Key || `images/${img.imageId}.png`, imageData.buffer);
            
            // Add to D1
            const dbImage = {
              id: img.imageId,
              user_id: img.userId || null,
              verse_reference: img.verseReference,
              verse_text: img.verseText,
              prompt: img.prompt,
              style_preset: img.stylePreset,
              r2_key: img.r2Key || `images/${img.imageId}.png`,
              file_size: img.fileSize || null,
              format: img.format || null,
              width: img.width || null,
              height: img.height || null,
              tags: JSON.stringify(img.tags),
              moderation_status: img.moderationStatus,
              generated_at: img.generatedAt,
              created_at: img.generatedAt,
            };
            mockDb.addImage(dbImage);
          }
          
          const imageIds = images.map(img => img.imageId);
          
          // Execute cleanup
          const result = await cleanupService.executeCleanup(imageIds);
          
          // Verify: For each successfully deleted image, both R2 and D1 should be cleaned
          for (const deletedId of result.deletedImageIds) {
            const img = images.find(i => i.imageId === deletedId)!;
            const r2Key = img.r2Key || `images/${img.imageId}.png`;
            
            // Check R2 object is deleted
            expect(mockR2.hasObject(r2Key)).toBe(false);
            
            // Check D1 record is deleted
            expect(mockDb.hasImage(deletedId)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 35: Protected image exemption
   * Validates: Requirements 10.3
   * 
   * For any image tagged as "favorite" or "daily-verse", it should not be
   * deleted during cleanup regardless of age.
   */
  test('Property 35: Protected image exemption', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }), // retention days
        fc.array(imageMetadataArb, { minLength: 1, maxLength: 20 }),
        async (retentionDays, images) => {
          // Setup
          mockDb.clear();
          mockR2.clear();
          
          const config: CleanupConfig = {
            retentionDays,
            backupRetentionDays: 30,
            protectedTags: ['daily-verse', 'favorite'],
          };
          
          cleanupService = new CleanupService(mockR2 as any, mockDb as any, config);
          
          // Ensure at least some images have protected tags
          const modifiedImages = images.map((img, idx) => {
            if (idx % 3 === 0) {
              // Add protected tag to every 3rd image
              return { ...img, tags: [...img.tags, 'daily-verse'] };
            } else if (idx % 3 === 1) {
              return { ...img, tags: [...img.tags, 'favorite'] };
            }
            return img;
          });
          
          // Add images to mock database
          for (const img of modifiedImages) {
            const dbImage = {
              id: img.imageId,
              user_id: img.userId || null,
              verse_reference: img.verseReference,
              verse_text: img.verseText,
              prompt: img.prompt,
              style_preset: img.stylePreset,
              r2_key: img.r2Key || null,
              file_size: img.fileSize || null,
              format: img.format || null,
              width: img.width || null,
              height: img.height || null,
              tags: JSON.stringify(img.tags),
              moderation_status: img.moderationStatus,
              generated_at: img.generatedAt,
              created_at: img.generatedAt,
            };
            mockDb.addImage(dbImage);
          }
          
          // Execute
          const result = await cleanupService.identifyCleanupCandidates();
          
          // Verify: No protected images should be in eligible list
          for (const eligible of result.eligibleImages) {
            const hasProtectedTag = eligible.tags.some(tag =>
              config.protectedTags.includes(tag)
            );
            expect(hasProtectedTag).toBe(false);
          }
          
          // Verify: All protected images should be in protected list
          for (const protectedImg of result.protectedImages) {
            const hasProtectedTag = protectedImg.tags.some(tag =>
              config.protectedTags.includes(tag)
            );
            expect(hasProtectedTag).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 36: Backup before cleanup
   * Validates: Requirements 10.4
   * 
   * For any cleanup operation, a D1 backup should be created and stored in R2
   * before any deletions occur.
   */
  test('Property 36: Backup before cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(imageMetadataArb, { minLength: 1, maxLength: 10 }),
        async (images) => {
          // Setup
          mockDb.clear();
          mockR2.clear();
          
          const config: CleanupConfig = {
            retentionDays: 90,
            backupRetentionDays: 30,
            protectedTags: ['daily-verse', 'favorite'],
          };
          
          cleanupService = new CleanupService(mockR2 as any, mockDb as any, config);
          
          // Add images to D1
          for (const img of images) {
            const dbImage = {
              id: img.imageId,
              user_id: img.userId || null,
              verse_reference: img.verseReference,
              verse_text: img.verseText,
              prompt: img.prompt,
              style_preset: img.stylePreset,
              r2_key: img.r2Key || null,
              file_size: img.fileSize || null,
              format: img.format || null,
              width: img.width || null,
              height: img.height || null,
              tags: JSON.stringify(img.tags),
              moderation_status: img.moderationStatus,
              generated_at: img.generatedAt,
              created_at: img.generatedAt,
            };
            mockDb.addImage(dbImage);
          }
          
          const initialR2Count = mockR2.getObjectCount();
          
          // Execute backup
          const backup = await cleanupService.createBackup();
          
          // Verify: Backup should be created in R2
          expect(mockR2.hasObject(backup.r2Key)).toBe(true);
          expect(mockR2.getObjectCount()).toBe(initialR2Count + 1);
          
          // Verify: Backup should contain all records
          expect(backup.recordCount).toBe(images.length);
          
          // Verify: Backup should have valid metadata
          expect(backup.backupId).toBeTruthy();
          expect(backup.timestamp).toBeTruthy();
          expect(backup.sizeBytes).toBeGreaterThan(0);
          
          // Verify: Backup key should be in backups/ prefix
          expect(backup.r2Key).toMatch(/^backups\//);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 37: Backup retention
   * Validates: Requirements 10.5
   * 
   * For any backup created, it should remain in R2 for the defined retention
   * period before being eligible for deletion.
   */
  test('Property 37: Backup retention', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 90 }), // backup retention days
        fc.array(fc.integer({ min: 0, max: 180 }), { minLength: 1, maxLength: 10 }), // backup ages in days
        async (retentionDays, backupAges) => {
          // Setup
          mockDb.clear();
          mockR2.clear();
          
          const config: CleanupConfig = {
            retentionDays: 90,
            backupRetentionDays: retentionDays,
            protectedTags: ['daily-verse', 'favorite'],
          };
          
          cleanupService = new CleanupService(mockR2 as any, mockDb as any, config);
          
          // Create backups with different ages
          // Use a counter to ensure unique keys even with duplicate ages
          for (let i = 0; i < backupAges.length; i++) {
            const age = backupAges[i];
            const backupDate = new Date();
            backupDate.setDate(backupDate.getDate() - age);
            
            // Add index to ensure unique keys
            const backupKey = `backups/d1-backup-${backupDate.toISOString()}-${i}.json`;
            const backupData = JSON.stringify({ records: [] });
            
            await mockR2.put(backupKey, backupData);
            
            // Manually set the uploaded date (in real R2, this is automatic)
            const obj = await mockR2.get(backupKey);
            if (obj) {
              (mockR2 as any).objects.get(backupKey).uploaded = backupDate;
            }
          }
          
          const initialCount = mockR2.getObjectCount();
          
          // Execute backup retention management
          const deletedCount = await cleanupService.manageBackupRetention();
          
          // Verify: Only backups older than retention period should be deleted
          const expectedDeleted = backupAges.filter(age => age > retentionDays).length;
          expect(deletedCount).toBe(expectedDeleted);
          
          // Verify: Remaining backups should be within retention period
          const remainingCount = initialCount - deletedCount;
          expect(mockR2.getObjectCount()).toBe(remainingCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
