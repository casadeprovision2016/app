/**
 * API Client Service for Bible Image Generator
 * 
 * Provides typed request/response methods for all API endpoints with:
 * - Error handling and retry logic
 * - Request timeout handling
 * - Loading state management
 * - Exponential backoff for transient failures
 * 
 * Requirements: 11.2, 11.3, 11.4
 */

import type { GeneratedImage, DailyVerse } from '../context/AppContext';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface GenerateImageRequest {
  verseReference: string;
  verseText?: string;
  stylePreset?: string;
  customPrompt?: string;
  requestId?: string;
}

export interface GenerateImageResponse {
  imageId: string;
  imageUrl: string;
  whatsappShareUrl: string;
  verseReference: string;
  verseText: string;
}

export interface GetImageResponse {
  imageId: string;
  imageUrl: string;
  metadata: ImageMetadata;
}

export interface ImageMetadata {
  imageId: string;
  userId?: string;
  verseReference: string;
  verseText: string;
  prompt: string;
  stylePreset: string;
  generatedAt: string;
  tags: string[];
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

export interface DailyVerseResponse {
  imageId: string;
  imageUrl: string;
  verseReference: string;
  verseText: string;
  generatedAt: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    retryAfter?: number;
  };
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public requestId?: string,
    public retryAfter?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Configuration
// ============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  timeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // initial delay in milliseconds
  retryableStatusCodes: number[];
}

const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: '/api',
  timeout: 35000, // 35 seconds (slightly more than backend 30s timeout)
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private config: ApiClientConfig;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make a fetch request with timeout, retry logic, and error handling
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        
        // Check if we should retry
        if (
          retryCount < this.config.maxRetries &&
          this.shouldRetry(response.status, errorData)
        ) {
          const delay = this.calculateRetryDelay(retryCount, errorData?.retryAfter);
          await this.sleep(delay);
          return this.fetchWithRetry<T>(url, options, retryCount + 1);
        }

        throw new ApiError(
          errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData?.code || 'UNKNOWN_ERROR',
          errorData?.requestId,
          errorData?.retryAfter,
          errorData?.details
        );
      }

      // Parse successful response
      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          `Request timed out after ${this.config.timeout}ms`
        );
      }

      // Handle network errors with retry
      if (
        error instanceof TypeError &&
        retryCount < this.config.maxRetries
      ) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }

      // Re-throw ApiError and custom errors
      if (
        error instanceof ApiError ||
        error instanceof TimeoutError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NetworkError(
        'Network request failed',
        error
      );
    }
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(
    response: Response
  ): Promise<ApiErrorResponse['error'] | null> {
    try {
      const data: ApiErrorResponse = await response.json();
      return data.error;
    } catch {
      return null;
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(
    statusCode: number,
    errorData: ApiErrorResponse['error'] | null
  ): boolean {
    // Don't retry client errors (except 408 and 429)
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 408 || statusCode === 429;
    }

    // Retry server errors
    return this.config.retryableStatusCodes.includes(statusCode);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    retryCount: number,
    retryAfter?: number
  ): number {
    // Use Retry-After header if provided
    if (retryAfter) {
      return retryAfter * 1000;
    }

    // Exponential backoff: delay * (2 ^ retryCount)
    return this.config.retryDelay * Math.pow(2, retryCount);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * Cancel specific request by ID
   */
  public cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  // ==========================================================================
  // API Endpoint Methods
  // ==========================================================================

  /**
   * Generate a new image from a verse reference
   * POST /api/generate
   */
  public async generateImage(
    params: GenerateImageRequest
  ): Promise<GeneratedImage> {
    // Client-side validation
    if (!params.verseReference || !params.verseReference.trim()) {
      throw new ValidationError('Verse reference is required', 'verseReference');
    }

    const url = `${this.config.baseUrl}/generate`;
    const response = await this.fetchWithRetry<GenerateImageResponse>(url, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    return {
      imageId: response.imageId,
      imageUrl: response.imageUrl,
      whatsappShareUrl: response.whatsappShareUrl,
      verseReference: response.verseReference,
      verseText: response.verseText,
    };
  }

  /**
   * Get an existing image by ID
   * GET /api/images/:imageId
   */
  public async getImage(imageId: string): Promise<GetImageResponse> {
    if (!imageId || !imageId.trim()) {
      throw new ValidationError('Image ID is required', 'imageId');
    }

    const url = `${this.config.baseUrl}/images/${encodeURIComponent(imageId)}`;
    return this.fetchWithRetry<GetImageResponse>(url, {
      method: 'GET',
    });
  }

  /**
   * Get the daily verse image
   * GET /api/daily-verse
   */
  public async getDailyVerse(): Promise<DailyVerse> {
    const url = `${this.config.baseUrl}/daily-verse`;
    const response = await this.fetchWithRetry<DailyVerseResponse>(url, {
      method: 'GET',
    });

    return {
      imageId: response.imageId,
      imageUrl: response.imageUrl,
      verseReference: response.verseReference,
      verseText: response.verseText,
      generatedAt: response.generatedAt,
    };
  }

  /**
   * Get share URL for an image (redirects to WhatsApp)
   * GET /api/images/:imageId/share
   */
  public getShareUrl(imageId: string): string {
    if (!imageId || !imageId.trim()) {
      throw new ValidationError('Image ID is required', 'imageId');
    }

    return `${this.config.baseUrl}/images/${encodeURIComponent(imageId)}/share`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

// Create default instance
export const apiClient = new ApiClient();

// Export factory function for custom configurations
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  return new ApiClient(config);
}
