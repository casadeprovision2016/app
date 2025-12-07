/**
 * Test Setup and Helpers for Local Development
 * 
 * This module provides utilities for setting up test environments,
 * creating mock data, and common test helpers.
 */

import { vi } from 'vitest';

/**
 * Mock environment for testing
 */
export function createMockEnv(): any {
  return {
    ENVIRONMENT: 'test',
    ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
    RATE_LIMIT_ANONYMOUS: '5',
    RATE_LIMIT_AUTHENTICATED: '20',
    IMAGE_RETENTION_DAYS: '90',
    BACKUP_RETENTION_DAYS: '30',
    ENABLE_CONTENT_MODERATION: 'false',
    JWT_SECRET: 'test-jwt-secret',
    ADMIN_API_KEY: 'test-admin-key',
    
    // Mock bindings
    AI: createMockAI(),
    R2_BUCKET: createMockR2(),
    DB: createMockD1(),
    KV_CACHE: createMockKV(),
    RATE_LIMITER: createMockDurableObject(),
  };
}

/**
 * Mock Workers AI binding
 */
export function createMockAI() {
  return {
    run: vi.fn().mockResolvedValue({
      image: new Uint8Array(100), // Mock image data
    }),
  };
}

/**
 * Mock R2 bucket binding
 */
export function createMockR2() {
  const storage = new Map<string, ArrayBuffer>();
  
  return {
    put: vi.fn(async (key: string, value: ArrayBuffer) => {
      storage.set(key, value);
      return { key };
    }),
    get: vi.fn(async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;
      return {
        arrayBuffer: async () => data,
        body: null,
        bodyUsed: false,
      };
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async (options?: any) => {
      const keys = Array.from(storage.keys());
      const prefix = options?.prefix || '';
      const filtered = keys.filter(k => k.startsWith(prefix));
      return {
        objects: filtered.map(key => ({ key })),
        truncated: false,
      };
    }),
    head: vi.fn(async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;
      return {
        size: data.byteLength,
        etag: 'mock-etag',
      };
    }),
  };
}

/**
 * Mock D1 database binding
 */
export function createMockD1() {
  const tables = new Map<string, any[]>();
  
  return {
    prepare: vi.fn((query: string) => {
      return {
        bind: vi.fn(function(...params: any[]) {
          return this;
        }),
        first: vi.fn(async () => {
          // Return mock data based on query
          if (query.includes('verses')) {
            return {
              id: 1,
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              book: 'John',
              chapter: 3,
              verse: 16,
              translation: 'NIV',
            };
          }
          return null;
        }),
        all: vi.fn(async () => {
          // Return mock results
          if (query.includes('verses')) {
            return {
              results: [
                {
                  id: 1,
                  reference: 'John 3:16',
                  text: 'For God so loved the world...',
                  book: 'John',
                  chapter: 3,
                  verse: 16,
                },
              ],
              success: true,
            };
          }
          return { results: [], success: true };
        }),
        run: vi.fn(async () => {
          return {
            success: true,
            meta: {
              changes: 1,
              last_row_id: 1,
            },
          };
        }),
      };
    }),
    batch: vi.fn(async (statements: any[]) => {
      return statements.map(() => ({
        success: true,
        results: [],
      }));
    }),
    exec: vi.fn(async (query: string) => {
      return {
        count: 1,
        duration: 10,
      };
    }),
  };
}

/**
 * Mock KV namespace binding
 */
export function createMockKV() {
  const storage = new Map<string, string>();
  
  return {
    get: vi.fn(async (key: string) => {
      return storage.get(key) || null;
    }),
    put: vi.fn(async (key: string, value: string, options?: any) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async (options?: any) => {
      const keys = Array.from(storage.keys());
      const prefix = options?.prefix || '';
      const filtered = keys.filter(k => k.startsWith(prefix));
      return {
        keys: filtered.map(name => ({ name })),
        list_complete: true,
      };
    }),
  };
}

/**
 * Mock Durable Object namespace
 */
export function createMockDurableObject() {
  return {
    idFromName: vi.fn((name: string) => ({
      toString: () => name,
    })),
    get: vi.fn((id: any) => ({
      fetch: vi.fn(async (request: Request) => {
        return new Response(JSON.stringify({ allowed: true, remaining: 5 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    })),
  };
}

/**
 * Mock verse data for testing
 */
export const mockVerses = [
  {
    id: 1,
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    book: 'John',
    chapter: 3,
    verse: 16,
    translation: 'NIV',
    theme: '["love", "salvation", "faith"]',
  },
  {
    id: 2,
    reference: 'Philippians 4:13',
    text: 'I can do all this through him who gives me strength.',
    book: 'Philippians',
    chapter: 4,
    verse: 13,
    translation: 'NIV',
    theme: '["strength", "perseverance", "faith"]',
  },
  {
    id: 3,
    reference: 'Psalm 23:1',
    text: 'The LORD is my shepherd, I lack nothing.',
    book: 'Psalms',
    chapter: 23,
    verse: 1,
    translation: 'NIV',
    theme: '["provision", "trust", "peace"]',
  },
];

/**
 * Mock image metadata for testing
 */
export const mockImageMetadata = {
  imageId: 'test-image-123',
  userId: 'test-user-1',
  verseReference: 'John 3:16',
  verseText: 'For God so loved the world...',
  prompt: 'Inspirational biblical scene with love theme',
  stylePreset: 'modern',
  generatedAt: new Date().toISOString(),
  tags: ['test'],
  moderationStatus: 'approved' as const,
};

/**
 * Create a mock Request object
 */
export function createMockRequest(
  url: string,
  options: RequestInit = {}
): Request {
  return new Request(url, {
    method: 'GET',
    ...options,
  });
}

/**
 * Wait for a promise with timeout
 */
export async function waitFor(
  fn: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await fn()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random UUID (simple version for testing)
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
