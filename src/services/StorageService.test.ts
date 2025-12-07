/**
 * Unit tests for StorageService
 * 
 * Tests specific examples and edge cases for storage operations
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { StorageService, StorageError } from './StorageService';
import { ErrorCode } from '../types';

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
// Unit Tests
// ============================================================================

describe('StorageService Unit Tests', () => {
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
    mockR2.clear();
    mockDb.clear();
  });
  
  describe('saveImage', () => {
    test('should save image with minimal options', async () => {
      const imageData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
        prompt: 'Beautiful sunset scene',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      
      expect(imageId).toBeDefined();
      expect(typeof imageId).toBe('string');
      expect(imageId.length).toBeGreaterThan(0);
    });
    
    test('should save image with all options', async () => {
      const imageData = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const options = {
        userId: 'user-123',
        verseReference: 'Psalm 23:1',
        verseText: 'The Lord is my shepherd...',
        prompt: 'Peaceful meadow scene',
        stylePreset: 'classic' as const,
        tags: ['daily-verse', 'favorite'],
        moderationStatus: 'approved' as const,
        width: 1024,
        height: 768,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      
      expect(imageId).toBeDefined();
      
      // Verify metadata was saved correctly
      const metadata = await storageService.getMetadata(imageId);
      expect(metadata.userId).toBe('user-123');
      expect(metadata.verseReference).toBe('Psalm 23:1');
      expect(metadata.tags).toEqual(['daily-verse', 'favorite']);
      expect(metadata.width).toBe(1024);
      expect(metadata.height).toBe(768);
    });
  });
  
  describe('getImage', () => {
    test('should retrieve saved image', async () => {
      const imageData = new Uint8Array([10, 20, 30, 40, 50]).buffer;
      const options = {
        verseReference: 'Romans 8:28',
        verseText: 'And we know that in all things...',
        prompt: 'Hopeful sunrise',
        stylePreset: 'minimalist' as const,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      const retrieved = await storageService.getImage(imageId);
      
      expect(new Uint8Array(retrieved)).toEqual(new Uint8Array(imageData));
    });
    
    test('should throw error for non-existent image', async () => {
      await expect(
        storageService.getImage('non-existent-id')
      ).rejects.toThrow(StorageError);
    });
  });
  
  describe('getImageUrl', () => {
    test('should generate public URL', async () => {
      const imageData = new Uint8Array([1, 2, 3]).buffer;
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      const url = await storageService.getImageUrl(imageId, false);
      
      expect(url).toContain('https://');
      expect(url).toContain('images/');
      expect(url).not.toContain('expires=');
      expect(url).not.toContain('signature=');
    });
    
    test('should generate signed URL with expiration', async () => {
      const imageData = new Uint8Array([1, 2, 3]).buffer;
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      const url = await storageService.getImageUrl(imageId, true, 3600);
      
      expect(url).toContain('https://');
      expect(url).toContain('expires=');
      expect(url).toContain('signature=');
    });
  });
  
  describe('deleteImage', () => {
    test('should delete image and metadata', async () => {
      const imageData = new Uint8Array([1, 2, 3]).buffer;
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(imageData, options);
      
      // Verify image exists
      await expect(storageService.getImage(imageId)).resolves.toBeDefined();
      
      // Delete image
      await storageService.deleteImage(imageId);
      
      // Verify image no longer exists
      await expect(storageService.getImage(imageId)).rejects.toThrow(StorageError);
    });
  });
  
  describe('format detection', () => {
    test('should detect WebP format', async () => {
      // Create WebP header
      const webpData = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x00, 0x00, 0x00, 0x00, // File size
        0x57, 0x45, 0x42, 0x50, // "WEBP"
        ...new Array(100).fill(0),
      ]).buffer;
      
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(webpData, options);
      const metadata = await storageService.getMetadata(imageId);
      
      expect(metadata.format).toBe('webp');
    });
    
    test('should detect PNG format', async () => {
      // Create PNG header
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, // PNG signature
        0x0D, 0x0A, 0x1A, 0x0A,
        ...new Array(100).fill(0),
      ]).buffer;
      
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(pngData, options);
      const metadata = await storageService.getMetadata(imageId);
      
      expect(metadata.format).toBe('png');
    });
    
    test('should detect JPEG format', async () => {
      // Create JPEG header
      const jpegData = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, // JPEG signature
        ...new Array(100).fill(0),
      ]).buffer;
      
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(jpegData, options);
      const metadata = await storageService.getMetadata(imageId);
      
      expect(metadata.format).toBe('jpeg');
    });
    
    test('should default to webp for unknown format', async () => {
      // Create unknown format
      const unknownData = new Uint8Array([
        0x00, 0x00, 0x00, 0x00,
        ...new Array(100).fill(0),
      ]).buffer;
      
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      const imageId = await storageService.saveImage(unknownData, options);
      const metadata = await storageService.getMetadata(imageId);
      
      expect(metadata.format).toBe('webp');
    });
  });
  
  describe('error handling', () => {
    test('should throw StorageError with correct error code on save failure', async () => {
      // Create a mock that throws an error
      const failingR2 = {
        put: async () => {
          throw new Error('R2 write failed');
        },
        get: async () => null,
        delete: async () => {},
      };
      
      const failingService = new StorageService(
        failingR2 as any,
        mockDb as any,
        'https://images.example.com'
      );
      
      const imageData = new Uint8Array([1, 2, 3]).buffer;
      const options = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved...',
        prompt: 'Test image',
        stylePreset: 'modern' as const,
      };
      
      await expect(
        failingService.saveImage(imageData, options)
      ).rejects.toThrow(StorageError);
      
      try {
        await failingService.saveImage(imageData, options);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
      }
    });
  });
});
