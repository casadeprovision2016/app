/**
 * Unit tests for CacheService
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CacheService } from './CacheService';
import { ImageMetadata, Verse } from '../types';

/**
 * Mock KV namespace for testing
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
 * Mock D1 database for testing
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
        // Return mock data for metadata query
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
}

describe('CacheService', () => {
  let kv: MockKVNamespace;
  let db: MockD1Database;
  let cacheService: CacheService;
  
  beforeEach(() => {
    kv = new MockKVNamespace();
    db = new MockD1Database();
    cacheService = new CacheService(kv as any, db as any);
  });
  
  describe('Metadata Caching', () => {
    test('should cache and retrieve metadata', async () => {
      const metadata: ImageMetadata = {
        imageId: 'test-123',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
        prompt: 'Test prompt',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: ['daily-verse'],
        moderationStatus: 'approved',
      };
      
      await cacheService.setMetadata('test-123', metadata);
      const retrieved = await cacheService.getMetadata('test-123');
      
      expect(retrieved).toEqual(metadata);
    });
    
    test('should return undefined for non-existent metadata', async () => {
      const retrieved = await cacheService.getMetadata('non-existent');
      expect(retrieved).toBeUndefined();
    });
    
    test('should invalidate metadata cache', async () => {
      const metadata: ImageMetadata = {
        imageId: 'test-123',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
        prompt: 'Test prompt',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'approved',
      };
      
      await cacheService.setMetadata('test-123', metadata);
      await cacheService.invalidateMetadata('test-123');
      
      const retrieved = await cacheService.getMetadata('test-123');
      expect(retrieved).toBeUndefined();
    });
    
    test('should fallback to D1 when cache misses', async () => {
      const mockMetadata = {
        imageId: 'test-456',
        userId: 'user-1',
        verseReference: 'Psalm 23:1',
        verseText: 'The Lord is my shepherd...',
        prompt: 'Test prompt',
        stylePreset: 'classic',
        generatedAt: new Date().toISOString(),
        tags: '[]',
        moderationStatus: 'approved',
      };
      
      db.setMockMetadata(mockMetadata);
      
      const retrieved = await cacheService.getMetadata('test-456');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.imageId).toBe('test-456');
      expect(retrieved?.verseReference).toBe('Psalm 23:1');
    });
  });
  
  describe('Daily Verse Caching', () => {
    test('should cache and retrieve daily verse', async () => {
      await cacheService.setDailyVerse('daily-123');
      const retrieved = await cacheService.getDailyVerse();
      
      expect(retrieved).toBe('daily-123');
    });
    
    test('should return undefined for non-existent daily verse', async () => {
      const retrieved = await cacheService.getDailyVerse();
      expect(retrieved).toBeUndefined();
    });
    
    test('should invalidate daily verse cache', async () => {
      await cacheService.setDailyVerse('daily-123');
      await cacheService.invalidateDailyVerse();
      
      const retrieved = await cacheService.getDailyVerse();
      expect(retrieved).toBeUndefined();
    });
  });
  
  describe('Verse Caching', () => {
    test('should cache and retrieve verse', async () => {
      const verse: Verse = {
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        book: 'John',
        chapter: 3,
        verse: 16,
        translation: 'NIV',
      };
      
      await cacheService.setVerse('John 3:16', verse);
      const retrieved = await cacheService.getVerse('John 3:16');
      
      expect(retrieved).toEqual(verse);
    });
    
    test('should normalize verse references for caching', async () => {
      const verse: Verse = {
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        book: 'John',
        chapter: 3,
        verse: 16,
        translation: 'NIV',
      };
      
      await cacheService.setVerse('John 3:16', verse);
      
      // Should retrieve with different casing/spacing
      const retrieved1 = await cacheService.getVerse('john 3:16');
      const retrieved2 = await cacheService.getVerse('  John 3:16  ');
      
      expect(retrieved1).toEqual(verse);
      expect(retrieved2).toEqual(verse);
    });
  });
  
  describe('Configuration Caching', () => {
    test('should cache and retrieve rate limit config', async () => {
      const config = { anonymous: 5, authenticated: 20 };
      
      await cacheService.setRateLimitConfig(config);
      const retrieved = await cacheService.getRateLimitConfig();
      
      expect(retrieved).toEqual(config);
    });
    
    test('should cache and retrieve style preset config', async () => {
      const config = {
        modern: {
          name: 'modern' as const,
          description: 'Modern style',
          promptModifiers: 'contemporary, clean',
        },
      };
      
      await cacheService.setStylePresetConfig(config);
      const retrieved = await cacheService.getStylePresetConfig();
      
      expect(retrieved).toEqual(config);
    });
    
    test('should cache and retrieve blocklist', async () => {
      const blocklist = ['violence', 'hate', 'explicit'];
      
      await cacheService.setBlocklist(blocklist);
      const retrieved = await cacheService.getBlocklist();
      
      expect(retrieved).toEqual(blocklist);
    });
    
    test('should clear all config caches', async () => {
      await cacheService.setRateLimitConfig({ anonymous: 5, authenticated: 20 });
      await cacheService.setBlocklist(['test']);
      
      await cacheService.clearConfigCache();
      
      const rateLimits = await cacheService.getRateLimitConfig();
      const blocklist = await cacheService.getBlocklist();
      
      expect(rateLimits).toBeUndefined();
      expect(blocklist).toBeUndefined();
    });
  });
  
  describe('Bulk Operations', () => {
    test('should invalidate all image-related caches', async () => {
      const metadata: ImageMetadata = {
        imageId: 'test-123',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
        prompt: 'Test prompt',
        stylePreset: 'modern',
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: 'approved',
      };
      
      await cacheService.setMetadata('test-123', metadata);
      await cacheService.invalidateImage('test-123');
      
      const retrieved = await cacheService.getMetadata('test-123');
      expect(retrieved).toBeUndefined();
    });
  });
});
