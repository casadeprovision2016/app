/**
 * API Client Tests
 * 
 * Tests for the API client service including:
 * - Request/response handling
 * - Error handling
 * - Retry logic
 * - Timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiClient,
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationError,
  type GenerateImageRequest,
} from './apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({
      baseUrl: '/api',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
    });
    mockFetch.mockClear();
  });

  afterEach(() => {
    client.cancelAllRequests();
  });

  describe('generateImage', () => {
    it('should successfully generate an image', async () => {
      const mockResponse = {
        imageId: 'test-id',
        imageUrl: 'https://example.com/image.webp',
        whatsappShareUrl: 'https://wa.me/?text=test',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      const result = await client.generateImage(params);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params),
        })
      );
    });

    it('should throw ValidationError for empty verse reference', async () => {
      const params: GenerateImageRequest = {
        verseReference: '',
        stylePreset: 'modern',
      };

      await expect(client.generateImage(params)).rejects.toThrow(ValidationError);
    });

    it('should handle API errors correctly', async () => {
      const errorResponse = {
        error: {
          code: 'INVALID_VERSE',
          message: 'Invalid verse reference',
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => errorResponse,
      });

      const params: GenerateImageRequest = {
        verseReference: 'Invalid',
        stylePreset: 'modern',
      };

      await expect(client.generateImage(params)).rejects.toThrow(ApiError);
      
      try {
        await client.generateImage(params);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.code).toBe('INVALID_VERSE');
          expect(error.statusCode).toBe(400);
          expect(error.requestId).toBe('req-123');
        }
      }
    });
  });

  describe('getDailyVerse', () => {
    it('should successfully fetch daily verse', async () => {
      const mockResponse = {
        imageId: 'daily-id',
        imageUrl: 'https://example.com/daily.webp',
        verseReference: 'Psalms 23:1',
        verseText: 'The Lord is my shepherd...',
        generatedAt: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getDailyVerse();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/daily-verse',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('getImage', () => {
    it('should successfully fetch an image by ID', async () => {
      const mockResponse = {
        imageId: 'test-id',
        imageUrl: 'https://example.com/image.webp',
        metadata: {
          imageId: 'test-id',
          verseReference: 'John 3:16',
          verseText: 'For God so loved the world...',
          prompt: 'test prompt',
          stylePreset: 'modern',
          generatedAt: '2025-01-01T00:00:00Z',
          tags: ['daily-verse'],
          moderationStatus: 'approved' as const,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getImage('test-id');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/images/test-id',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw ValidationError for empty image ID', async () => {
      await expect(client.getImage('')).rejects.toThrow(ValidationError);
    });
  });

  describe('getShareUrl', () => {
    it('should generate correct share URL', () => {
      const imageId = 'test-id';
      const url = client.getShareUrl(imageId);

      expect(url).toBe('/api/images/test-id/share');
    });

    it('should throw ValidationError for empty image ID', () => {
      expect(() => client.getShareUrl('')).toThrow(ValidationError);
    });

    it('should encode special characters in image ID', () => {
      const imageId = 'test id/with spaces';
      const url = client.getShareUrl(imageId);

      expect(url).toBe('/api/images/test%20id%2Fwith%20spaces/share');
    });
  });

  describe('retry logic', () => {
    it('should retry on 500 error', async () => {
      const mockResponse = {
        imageId: 'test-id',
        imageUrl: 'https://example.com/image.webp',
        whatsappShareUrl: 'https://wa.me/?text=test',
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
      };

      // First call fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: { code: 'SERVER_ERROR', message: 'Server error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      const result = await client.generateImage(params);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect Retry-After header', async () => {
      const errorResponse = {
        error: {
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
          retryAfter: 1, // 1 second
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => errorResponse,
      });

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      const startTime = Date.now();
      
      try {
        await client.generateImage(params);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        // Should have waited at least 1 second for retry
        expect(elapsed).toBeGreaterThanOrEqual(900); // Allow some margin
      }
    });

    it('should not retry on 400 errors', async () => {
      const errorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => errorResponse,
      });

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      await expect(client.generateImage(params)).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should stop retrying after max retries', async () => {
      const errorResponse = {
        error: {
          code: 'SERVER_ERROR',
          message: 'Server error',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => errorResponse,
      });

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      await expect(client.generateImage(params)).rejects.toThrow(ApiError);
      // Initial call + 2 retries = 3 total calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('timeout handling', () => {
    it('should timeout after configured duration', async () => {
      // Create client with very short timeout
      const shortTimeoutClient = new ApiClient({
        baseUrl: '/api',
        timeout: 100, // 100ms
        maxRetries: 0,
      });

      // Mock a slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ data: 'test' }),
              });
            }, 200); // Takes 200ms, longer than timeout
          })
      );

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      await expect(shortTimeoutClient.generateImage(params)).rejects.toThrow(
        TimeoutError
      );
    });
  });

  describe('request cancellation', () => {
    it('should cancel all pending requests', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ data: 'test' }),
              });
            }, 1000);
          })
      );

      const params: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'modern',
      };

      const promise = client.generateImage(params);
      
      // Cancel immediately
      client.cancelAllRequests();

      await expect(promise).rejects.toThrow();
    });
  });
});
