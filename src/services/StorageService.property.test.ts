/**
 * Property-based tests for StorageService
 * 
 * Tests universal properties that should hold across all valid inputs
 * using fast-check for property-based testing.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { StorageService, SaveImageOptions } from './StorageService';
import { ImageMetadata } from '../types';

// ============================================================================
// Mock R2 Bucket
// ============================================================================

class MockR2Bucket {
  private storage = new Map<string, { data: ArrayBuffer; metadata: any }>();
  
  async put(key: string, data: ArrayBuffer, options?: any): Promise<void> {
    this.storage.set(key, { data, metadata: options });
  }
  
  async get(key: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> {
    const item = this.storage.get(key);
    if (!item) return null;
    return {
      arrayBuffer: async () => item.data,
    };
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  clear(): void {
    this.storage.clear();
  }
}

// ============================================================================
// Mock D1 Database
// ============================================================================

class MockD1Database {
  private images = new Map<string, any>();
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          if (query.includes('INSERT INTO images')) {
            const [id] = params;
            this.images.set(id, {
              id: params[0],
              user_id: params[1],
              verse_reference: params[2],
              verse_text: params[3],
              prompt: params[4],
              style_preset: params[5],
              r2_key: params[6],
              file_size: params[7],
              format: params[8],
              width: params[9],
              height: params[10],
              tags: params[11],
              moderation_status: params[12],
              generated_at: params[13],
            });
          } else if (query.includes('DELETE FROM images')) {
            const [id] = params;
            this.images.delete(id);
          }
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM images')) {
            const [id] = params;
            return this.images.get(id) || null;
          }
          return null;
        },
      }),
    };
  }
  
  clear(): void {
    this.images.clear();
  }
}

// ============================================================================
// Test Generators
// ============================================================================

const imageDataArb = fc.uint8Array({ minLength: 100, maxLength: 10000 });

const saveImageOptionsArb = fc.record({
  userId: fc.option(fc.uuid(), { nil: undefined }),
  verseReference: fc.string({ minLength: 5, maxLength: 50 }),
  verseText: fc.lorem({ maxCount: 100 }),
  prompt: fc.lorem({ maxCount: 200 }),
  stylePreset: fc.constantFrom('modern', 'classic', 'minimalist', 'artistic'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), { nil: undefined }),
  moderationStatus: fc.option(fc.constantFrom('pending', 'approved', 'rejected'), { nil: undefined }),
  width: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('StorageService Property Tests', () => {
  let mockR2: MockR2Bucket;
  let mockDb: MockD1Database;
  let storageService: StorageService;
  
  beforeEach(() => {
    mockR2 = new MockR2Bucket();
    mockDb = new MockD1Database();
    storageService = new StorageService(
      mockR2 as any,
      mockDb as any,
      'https://images.example.com'
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 6: Storage persistence
   * Validates: Requirements 2.1, 2.4
   */
  test('Property 6: stored images can be retrieved with same data', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        async (imageData, options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Retrieve the image
          const retrieved = await storageService.getImage(imageId);
          
          // Convert both to Uint8Array for comparison
          const originalBytes = new Uint8Array(arrayBuffer);
          const retrievedBytes = new Uint8Array(retrieved);
          
          // Verify the data matches
          expect(retrievedBytes.length).toBe(originalBytes.length);
          expect(Array.from(retrievedBytes)).toEqual(Array.from(originalBytes));
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 7: Filename uniqueness
   * Validates: Requirements 2.2
   */
  test('Property 7: different requests generate unique image IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          imageDataArb,
          saveImageOptionsArb,
          imageDataArb,
          saveImageOptionsArb
        ),
        async ([imageData1, options1, imageData2, options2]) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Ensure options are different
          fc.pre(
            options1.userId !== options2.userId ||
            options1.verseReference !== options2.verseReference ||
            options1.stylePreset !== options2.stylePreset
          );
          
          // Convert to ArrayBuffers
          const arrayBuffer1 = imageData1.buffer.slice(
            imageData1.byteOffset,
            imageData1.byteOffset + imageData1.byteLength
          );
          const arrayBuffer2 = imageData2.buffer.slice(
            imageData2.byteOffset,
            imageData2.byteOffset + imageData2.byteLength
          );
          
          // Add small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1));
          
          // Save both images
          const imageId1 = await storageService.saveImage(arrayBuffer1, options1);
          const imageId2 = await storageService.saveImage(arrayBuffer2, options2);
          
          // Verify IDs are different
          expect(imageId1).not.toBe(imageId2);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 8: Metadata completeness
   * Validates: Requirements 2.3
   */
  test('Property 8: stored metadata contains all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        async (imageData, options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Retrieve metadata
          const metadata = await storageService.getMetadata(imageId);
          
          // Verify all required fields are present
          expect(metadata.imageId).toBe(imageId);
          expect(metadata.verseReference).toBe(options.verseReference);
          expect(metadata.verseText).toBe(options.verseText);
          expect(metadata.prompt).toBe(options.prompt);
          expect(metadata.stylePreset).toBe(options.stylePreset);
          expect(metadata.generatedAt).toBeDefined();
          expect(typeof metadata.generatedAt).toBe('string');
          
          // Verify optional fields match if provided
          if (options.userId) {
            expect(metadata.userId).toBe(options.userId);
          }
          
          // Verify tags
          expect(Array.isArray(metadata.tags)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 10: URL generation
   * Validates: Requirements 3.1
   */
  test('Property 10: generated URLs are valid and accessible', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        async (imageData, options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Generate public URL
          const url = await storageService.getImageUrl(imageId, false);
          
          // Verify URL is valid
          expect(url).toBeDefined();
          expect(typeof url).toBe('string');
          expect(url.length).toBeGreaterThan(0);
          
          // Verify URL contains the image ID or path
          expect(url).toContain('images/');
          
          // Verify URL is a valid URL format
          expect(() => new URL(url)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 12: Signed URL validity
   * Validates: Requirements 3.5
   */
  test('Property 12: signed URLs include expiration and signature', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        fc.integer({ min: 60, max: 7200 }), // expiresIn seconds
        async (imageData, options, expiresIn) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Generate signed URL
          const signedUrl = await storageService.getImageUrl(imageId, true, expiresIn);
          
          // Verify signed URL is valid
          expect(signedUrl).toBeDefined();
          expect(typeof signedUrl).toBe('string');
          
          // Verify URL contains expiration parameter
          expect(signedUrl).toContain('expires=');
          
          // Verify URL contains signature parameter
          expect(signedUrl).toContain('signature=');
          
          // Parse URL and verify expiration is in the future
          const url = new URL(signedUrl);
          const expiresParam = url.searchParams.get('expires');
          expect(expiresParam).toBeDefined();
          
          const expiresTimestamp = parseInt(expiresParam!, 10);
          const now = Math.floor(Date.now() / 1000);
          
          // Expiration should be in the future
          expect(expiresTimestamp).toBeGreaterThan(now);
          
          // Expiration should be approximately expiresIn seconds from now
          // Allow 5 second tolerance for test execution time
          expect(expiresTimestamp).toBeLessThanOrEqual(now + expiresIn + 5);
          expect(expiresTimestamp).toBeGreaterThanOrEqual(now + expiresIn - 5);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 22: WebP format selection
   * Validates: Requirements 6.4
   */
  test('Property 22: WebP format is detected and stored', async () => {
    await fc.assert(
      fc.asyncProperty(
        saveImageOptionsArb,
        async (options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Create a WebP image header (RIFF....WEBP)
          const webpHeader = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, // "RIFF"
            0x00, 0x00, 0x00, 0x00, // File size (placeholder)
            0x57, 0x45, 0x42, 0x50, // "WEBP"
            // Add some dummy data
            ...new Array(100).fill(0),
          ]);
          
          const arrayBuffer = webpHeader.buffer;
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Retrieve metadata
          const metadata = await storageService.getMetadata(imageId);
          
          // Verify format is detected as WebP
          expect(metadata.format).toBe('webp');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 39: Deterministic naming
   * Validates: Requirements 12.3
   */
  test('Property 39: identical parameters produce consistent IDs within same millisecond', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        async (imageData, options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Mock Date.now to return consistent timestamp
          const originalDateNow = Date.now;
          const fixedTimestamp = 1234567890000;
          Date.now = () => fixedTimestamp;
          
          try {
            // Save the same image twice with same options
            const imageId1 = await storageService.saveImage(arrayBuffer, options);
            
            // Clear storage but keep same timestamp
            mockR2.clear();
            mockDb.clear();
            
            const imageId2 = await storageService.saveImage(arrayBuffer, options);
            
            // IDs should be identical since timestamp and params are the same
            expect(imageId1).toBe(imageId2);
          } finally {
            // Restore Date.now
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 20: Cache headers presence
   * Validates: Requirements 6.1
   */
  test('Property 20: image responses include appropriate cache headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        saveImageOptionsArb,
        async (imageData, options) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          // Convert to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save the image
          const imageId = await storageService.saveImage(arrayBuffer, options);
          
          // Get image with metadata (simulating R2 object)
          const metadata = await storageService.getMetadata(imageId);
          
          // Create mock R2 object with required properties
          const mockR2Object = {
            body: new ReadableStream(),
            etag: `"${imageId}-etag"`,
            httpMetadata: {
              contentType: `image/${metadata.format || 'webp'}`,
            },
            uploaded: new Date(),
          } as R2ObjectBody;
          
          // Generate cache headers
          const headers = storageService.generateCacheHeaders(mockR2Object);
          
          // Verify Cache-Control header is present
          const cacheControl = headers.get('Cache-Control');
          expect(cacheControl).toBeDefined();
          expect(cacheControl).toContain('public');
          expect(cacheControl).toContain('max-age=');
          
          // Verify max-age is set to a reasonable value (at least 1 hour)
          const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);
          expect(maxAgeMatch).toBeDefined();
          const maxAge = parseInt(maxAgeMatch![1], 10);
          expect(maxAge).toBeGreaterThanOrEqual(3600); // At least 1 hour
          
          // Verify ETag header is present
          const etag = headers.get('ETag');
          expect(etag).toBeDefined();
          expect(etag).toBe(mockR2Object.etag);
          
          // Verify Content-Type header is present
          const contentType = headers.get('Content-Type');
          expect(contentType).toBeDefined();
          expect(contentType).toContain('image/');
          
          // Verify Vary header for compression negotiation
          const vary = headers.get('Vary');
          expect(vary).toBeDefined();
          expect(vary).toContain('Accept-Encoding');
          
          // Verify Last-Modified header is present
          const lastModified = headers.get('Last-Modified');
          expect(lastModified).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
