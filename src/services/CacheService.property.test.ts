/**
 * Property-based tests for CacheService
 * 
 * These tests verify universal properties that should hold across all inputs
 * using the fast-check library for property-based testing.
 */

import { describe, test, beforeEach } from 'vitest';
import fc from 'fast-check';
import { CacheService } from './CacheService';
import { ImageMetadata, Verse } from '../types';

/**
 * Mock KV namespace for property testing
 */
class MockKVNamespace implements KVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();
  
  async get(key: string, type?: 'text'): Promise<string | null>;
  async get(key: string, type: 'json'): Promise<any>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type?: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (type === 'json') {
      return JSON.parse(item.value);
    }
    return item.value;
  }
  
  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : '';
    this.store.set(key, { value: stringValue, expiration: options?.expirationTtl });
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  async list(options?: any): Promise<any> {
    return { keys: [], list_complete: true, cursor: '' };
  }
  
  async getWithMetadata(key: string, type?: any): Promise<any> {
    return { value: null, metadata: null };
  }
  
  clear(): void {
    this.store.clear();
  }
}

/**
 * Mock D1 database for property testing
 */
class MockD1Database implements D1Database {
  private data: Map<string, any> = new Map();
  
  prepare(query: string): D1PreparedStatement {
    const self = this;
    const statement = {
      bind(...values: any[]): D1PreparedStatement {
        return statement;
      },
      async first<T = unknown>(): Promise<T | null> {
        if (query.includes('FROM images')) {
          return self.data.get('metadata') as T || null;
        }
        return null;
      },
      async run(): Promise<D1Result> {
        return { success: true, meta: {} as any };
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        return { results: [], success: true, meta: {} as any };
      },
      async raw<T = unknown>(): Promise<T[]> {
        return [];
      },
    } as D1PreparedStatement;
    
    return statement;
  }
  
  dump(): Promise<ArrayBuffer> {
    throw new Error('Not implemented');
  }
  
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    throw new Error('Not implemented');
  }
  
  exec(query: string): Promise<D1ExecResult> {
    throw new Error('Not implemented');
  }
  
  setMockMetadata(metadata: any): void {
    this.data.set('metadata', metadata);
  }
  
  clear(): void {
    this.data.clear();
  }
}

// ============================================================================
// Custom Arbitraries for Domain Objects
// ============================================================================

/**
 * Arbitrary for generating valid image IDs
 */
const imageIdArb = fc.uuid();

/**
 * Arbitrary for generating verse references
 */
const verseReferenceArb = fc.record({
  book: fc.constantFrom('Genesis', 'John', 'Psalms', 'Romans', 'Matthew', 'Revelation'),
  chapter: fc.integer({ min: 1, max: 150 }),
  verse: fc.integer({ min: 1, max: 50 }),
}).map(({ book, chapter, verse }) => `${book} ${chapter}:${verse}`);

/**
 * Arbitrary for generating style presets
 */
const stylePresetArb = fc.constantFrom('modern', 'classic', 'minimalist', 'artistic');

/**
 * Arbitrary for generating moderation status
 */
const moderationStatusArb = fc.constantFrom('pending', 'approved', 'rejected');

/**
 * Arbitrary for generating valid ISO date strings
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-2031
  .map(timestamp => new Date(timestamp).toISOString());

/**
 * Arbitrary for generating image metadata
 */
const imageMetadataArb = fc.record({
  imageId: imageIdArb,
  userId: fc.option(fc.uuid(), { nil: undefined }),
  verseReference: verseReferenceArb,
  verseText: fc.lorem({ maxCount: 50 }),
  prompt: fc.lorem({ maxCount: 100 }),
  stylePreset: stylePresetArb,
  generatedAt: isoDateArb,
  tags: fc.array(fc.string(), { maxLength: 5 }),
  moderationStatus: moderationStatusArb,
  r2Key: fc.option(fc.string(), { nil: undefined }),
  fileSize: fc.option(fc.integer({ min: 1000, max: 10000000 }), { nil: undefined }),
  format: fc.option(fc.constantFrom('webp', 'png', 'jpeg'), { nil: undefined }),
  width: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 256, max: 2048 }), { nil: undefined }),
}) as fc.Arbitrary<ImageMetadata>;

/**
 * Arbitrary for generating verses
 */
const verseArb = fc.record({
  reference: verseReferenceArb,
  text: fc.lorem({ maxCount: 100 }),
  book: fc.constantFrom('Genesis', 'John', 'Psalms', 'Romans', 'Matthew', 'Revelation'),
  chapter: fc.integer({ min: 1, max: 150 }),
  verse: fc.integer({ min: 1, max: 50 }),
  translation: fc.constantFrom('NIV', 'KJV', 'ESV', 'NKJV'),
}) as fc.Arbitrary<Verse>;

// ============================================================================
// Property Tests
// ============================================================================

describe('CacheService Property Tests', () => {
  let kv: MockKVNamespace;
  let db: MockD1Database;
  let cacheService: CacheService;
  
  beforeEach(() => {
    kv = new MockKVNamespace();
    db = new MockD1Database();
    cacheService = new CacheService(kv as any, db as any);
  });
  
  /**
   * Feature: bible-image-generator, Property 9: Cache consistency
   * 
   * For any metadata record, after the first retrieval from D1, subsequent requests
   * within the cache TTL should return the same data from KV cache.
   * 
   * Validates: Requirements 2.5
   */
  test('Property 9: Cache consistency - subsequent retrievals return same data', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageMetadataArb,
        async (metadata) => {
          // Clear state between iterations
          kv.clear();
          db.clear();
          
          // Store metadata in cache
          await cacheService.setMetadata(metadata.imageId, metadata);
          
          // First retrieval
          const firstRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Second retrieval (should come from cache)
          const secondRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Third retrieval (should also come from cache)
          const thirdRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // All retrievals should return the same data
          return (
            JSON.stringify(firstRetrieval) === JSON.stringify(metadata) &&
            JSON.stringify(secondRetrieval) === JSON.stringify(metadata) &&
            JSON.stringify(thirdRetrieval) === JSON.stringify(metadata) &&
            JSON.stringify(firstRetrieval) === JSON.stringify(secondRetrieval) &&
            JSON.stringify(secondRetrieval) === JSON.stringify(thirdRetrieval)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Cache invalidation removes data
   * 
   * For any cached metadata, invalidating it should result in subsequent
   * retrievals returning undefined (cache miss).
   */
  test('Property: Cache invalidation removes data', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageMetadataArb,
        async (metadata) => {
          // Clear state
          kv.clear();
          db.clear();
          
          // Store and verify it's cached
          await cacheService.setMetadata(metadata.imageId, metadata);
          const beforeInvalidation = await cacheService.getMetadata(metadata.imageId);
          
          // Invalidate
          await cacheService.invalidateMetadata(metadata.imageId);
          
          // Should return undefined after invalidation (no D1 fallback data)
          const afterInvalidation = await cacheService.getMetadata(metadata.imageId);
          
          return beforeInvalidation !== undefined && afterInvalidation === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Daily verse caching is consistent
   * 
   * For any image ID set as daily verse, subsequent retrievals should
   * return the same ID until invalidated.
   */
  test('Property: Daily verse caching is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageIdArb,
        async (imageId) => {
          // Clear state
          kv.clear();
          
          // Set daily verse
          await cacheService.setDailyVerse(imageId);
          
          // Multiple retrievals
          const first = await cacheService.getDailyVerse();
          const second = await cacheService.getDailyVerse();
          const third = await cacheService.getDailyVerse();
          
          return first === imageId && second === imageId && third === imageId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Verse caching with normalization
   * 
   * For any verse, caching it with a reference should allow retrieval
   * with different casing and whitespace variations.
   */
  test('Property: Verse caching handles reference normalization', async () => {
    await fc.assert(
      fc.asyncProperty(
        verseArb,
        async (verse) => {
          // Clear state
          kv.clear();
          
          // Cache the verse
          await cacheService.setVerse(verse.reference, verse);
          
          // Retrieve with different variations
          const original = await cacheService.getVerse(verse.reference);
          const lowercase = await cacheService.getVerse(verse.reference.toLowerCase());
          const uppercase = await cacheService.getVerse(verse.reference.toUpperCase());
          const withSpaces = await cacheService.getVerse(`  ${verse.reference}  `);
          
          // All should return the same verse
          return (
            JSON.stringify(original) === JSON.stringify(verse) &&
            JSON.stringify(lowercase) === JSON.stringify(verse) &&
            JSON.stringify(uppercase) === JSON.stringify(verse) &&
            JSON.stringify(withSpaces) === JSON.stringify(verse)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Configuration caching round-trip
   * 
   * For any configuration data, storing and retrieving it should
   * return the exact same data structure.
   */
  test('Property: Configuration data round-trips correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rateLimits: fc.record({
            anonymous: fc.integer({ min: 1, max: 100 }),
            authenticated: fc.integer({ min: 1, max: 1000 }),
          }),
          blocklist: fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
        }),
        async ({ rateLimits, blocklist }) => {
          // Clear state
          kv.clear();
          
          // Store configurations
          await cacheService.setRateLimitConfig(rateLimits);
          await cacheService.setBlocklist(blocklist);
          
          // Retrieve configurations
          const retrievedRateLimits = await cacheService.getRateLimitConfig();
          const retrievedBlocklist = await cacheService.getBlocklist();
          
          // Should match exactly
          return (
            JSON.stringify(retrievedRateLimits) === JSON.stringify(rateLimits) &&
            JSON.stringify(retrievedBlocklist) === JSON.stringify(blocklist)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Bulk invalidation clears all image data
   * 
   * For any image with cached metadata, calling invalidateImage
   * should remove all cached data for that image.
   */
  test('Property: Bulk invalidation clears all image data', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageMetadataArb,
        async (metadata) => {
          // Clear state
          kv.clear();
          db.clear();
          
          // Cache metadata
          await cacheService.setMetadata(metadata.imageId, metadata);
          
          // Verify it's cached
          const beforeInvalidation = await cacheService.getMetadata(metadata.imageId);
          
          // Invalidate all image data
          await cacheService.invalidateImage(metadata.imageId);
          
          // Should be gone
          const afterInvalidation = await cacheService.getMetadata(metadata.imageId);
          
          return beforeInvalidation !== undefined && afterInvalidation === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: bible-image-generator, Property 21: Cache-first metadata retrieval
   * 
   * For any frequently accessed metadata, the second and subsequent requests
   * should be served from KV cache. This property verifies that cached data
   * is returned without requiring a D1 query.
   * 
   * Validates: Requirements 6.2
   */
  test('Property 21: Cache-first retrieval - cached data returned without D1 query', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageMetadataArb,
        async (metadata) => {
          // Clear state
          kv.clear();
          db.clear();
          
          // First, cache the metadata
          await cacheService.setMetadata(metadata.imageId, metadata);
          
          // Verify first retrieval gets from cache (not D1)
          const firstRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Now clear D1 to ensure subsequent retrievals don't use it
          db.clear();
          
          // Second retrieval should still work (from cache, not D1)
          const secondRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Third retrieval should also work (from cache, not D1)
          const thirdRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // All retrievals should return the same data even though D1 is empty
          return (
            firstRetrieval !== undefined &&
            JSON.stringify(firstRetrieval) === JSON.stringify(metadata) &&
            JSON.stringify(secondRetrieval) === JSON.stringify(metadata) &&
            JSON.stringify(thirdRetrieval) === JSON.stringify(metadata)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Cache miss triggers D1 fallback
   * 
   * For any metadata not in cache, the service should fall back to D1
   * and then populate the cache for future requests.
   */
  test('Property: Cache miss triggers D1 fallback and cache population', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageMetadataArb,
        async (metadata) => {
          // Clear state
          kv.clear();
          db.clear();
          
          // Set up D1 with metadata (but not cache)
          const dbMetadata = {
            imageId: metadata.imageId,
            userId: metadata.userId,
            verseReference: metadata.verseReference,
            verseText: metadata.verseText,
            prompt: metadata.prompt,
            stylePreset: metadata.stylePreset,
            generatedAt: metadata.generatedAt,
            tags: JSON.stringify(metadata.tags),
            moderationStatus: metadata.moderationStatus,
            r2Key: metadata.r2Key,
            fileSize: metadata.fileSize,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
          };
          db.setMockMetadata(dbMetadata);
          
          // First retrieval should get from D1 and populate cache
          const firstRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Clear D1 to verify cache was populated
          db.clear();
          
          // Second retrieval should work from cache (D1 is now empty)
          const secondRetrieval = await cacheService.getMetadata(metadata.imageId);
          
          // Both should return the same data
          return (
            firstRetrieval !== undefined &&
            secondRetrieval !== undefined &&
            firstRetrieval.imageId === metadata.imageId &&
            secondRetrieval.imageId === metadata.imageId
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
