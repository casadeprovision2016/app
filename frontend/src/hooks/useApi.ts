/**
 * React Hook for API Client with Loading State Management
 * 
 * Provides a convenient way to use the API client with automatic
 * loading state management and error handling.
 * 
 * Requirements: 11.2, 11.3, 11.4
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  apiClient,
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationError,
  type GenerateImageRequest,
} from '../services/apiClient';
import type { GeneratedImage, DailyVerse } from '../context/AppContext';

// ============================================================================
// Types
// ============================================================================

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorDetails: {
    code?: string;
    statusCode?: number;
    retryAfter?: number;
  } | null;
}

export interface UseApiActions<T, P extends unknown[]> {
  execute: (...params: P) => Promise<T | null>;
  reset: () => void;
  clearError: () => void;
}

export type UseApiResult<T, P extends unknown[]> = UseApiState<T> & UseApiActions<T, P>;

// ============================================================================
// Generic useApi Hook
// ============================================================================

/**
 * Generic hook for making API calls with loading state management
 */
export function useApi<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>
): UseApiResult<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<UseApiState<T>['errorDetails']>(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...params: P): Promise<T | null> => {
      if (!isMountedRef.current) return null;

      setLoading(true);
      setError(null);
      setErrorDetails(null);

      try {
        const result = await apiFunction(...params);
        
        if (isMountedRef.current) {
          setData(result);
          setLoading(false);
        }
        
        return result;
      } catch (err) {
        if (!isMountedRef.current) return null;

        // Handle different error types
        let errorMessage = 'An unexpected error occurred';
        let details: UseApiState<T>['errorDetails'] = null;

        if (err instanceof ApiError) {
          errorMessage = err.message;
          details = {
            code: err.code,
            statusCode: err.statusCode,
            retryAfter: err.retryAfter,
          };
        } else if (err instanceof TimeoutError) {
          errorMessage = 'Request timed out. Please try again.';
          details = { code: 'TIMEOUT_ERROR' };
        } else if (err instanceof NetworkError) {
          errorMessage = 'Network error. Please check your connection.';
          details = { code: 'NETWORK_ERROR' };
        } else if (err instanceof ValidationError) {
          errorMessage = err.message;
          details = { code: 'VALIDATION_ERROR' };
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        setErrorDetails(details);
        setLoading(false);
        
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    setErrorDetails(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetails(null);
  }, []);

  return {
    data,
    loading,
    error,
    errorDetails,
    execute,
    reset,
    clearError,
  };
}

// ============================================================================
// Specialized Hooks for Each Endpoint
// ============================================================================

/**
 * Hook for generating images
 */
export function useGenerateImage() {
  return useApi<GeneratedImage, [GenerateImageRequest]>(
    (params) => apiClient.generateImage(params)
  );
}

/**
 * Hook for fetching daily verse
 */
export function useDailyVerse() {
  return useApi<DailyVerse, []>(
    () => apiClient.getDailyVerse()
  );
}

/**
 * Hook for getting an image by ID
 */
export function useGetImage() {
  return useApi<Awaited<ReturnType<typeof apiClient.getImage>>, [string]>(
    (imageId) => apiClient.getImage(imageId)
  );
}

// ============================================================================
// Utility Hook for Multiple Concurrent Requests
// ============================================================================

export interface UseBatchApiState {
  loading: boolean;
  errors: Map<string, string>;
  completedCount: number;
  totalCount: number;
}

/**
 * Hook for managing multiple concurrent API requests
 */
export function useBatchApi() {
  const [state, setState] = useState<UseBatchApiState>({
    loading: false,
    errors: new Map(),
    completedCount: 0,
    totalCount: 0,
  });

  const executeBatch = useCallback(
    async <T>(
      requests: Array<{ id: string; promise: Promise<T> }>
    ): Promise<Map<string, T | null>> => {
      setState({
        loading: true,
        errors: new Map(),
        completedCount: 0,
        totalCount: requests.length,
      });

      const results = new Map<string, T | null>();
      const errors = new Map<string, string>();

      await Promise.allSettled(
        requests.map(async ({ id, promise }) => {
          try {
            const result = await promise;
            results.set(id, result);
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : 'Unknown error';
            errors.set(id, errorMessage);
            results.set(id, null);
          } finally {
            setState((prev) => ({
              ...prev,
              completedCount: prev.completedCount + 1,
            }));
          }
        })
      );

      setState((prev) => ({
        ...prev,
        loading: false,
        errors,
      }));

      return results;
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      loading: false,
      errors: new Map(),
      completedCount: 0,
      totalCount: 0,
    });
  }, []);

  return {
    ...state,
    executeBatch,
    reset,
  };
}
