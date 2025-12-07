/**
 * API Client Usage Examples
 * 
 * This file demonstrates various ways to use the API client service.
 * These examples are for documentation purposes and are not executed.
 */

import {
  apiClient,
  createApiClient,
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from './apiClient';
import type { GenerateImageRequest } from './apiClient';

// ============================================================================
// Example 1: Basic Image Generation
// ============================================================================

async function example1_basicGeneration() {
  try {
    const image = await apiClient.generateImage({
      verseReference: 'John 3:16',
      stylePreset: 'modern',
    });

    console.log('Generated image:', image);
    console.log('Image URL:', image.imageUrl);
    console.log('WhatsApp share URL:', image.whatsappShareUrl);
  } catch (error) {
    console.error('Failed to generate image:', error);
  }
}

// ============================================================================
// Example 2: Image Generation with Custom Prompt
// ============================================================================

async function example2_customPrompt() {
  const params: GenerateImageRequest = {
    verseReference: 'Psalms 23:1',
    stylePreset: 'artistic',
    customPrompt: 'Beautiful mountain landscape with a shepherd and sheep',
  };

  try {
    const image = await apiClient.generateImage(params);
    console.log('Generated custom image:', image);
  } catch (error) {
    console.error('Generation failed:', error);
  }
}

// ============================================================================
// Example 3: Comprehensive Error Handling
// ============================================================================

async function example3_errorHandling() {
  try {
    const image = await apiClient.generateImage({
      verseReference: 'John 3:16',
      stylePreset: 'modern',
    });

    console.log('Success:', image);
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle API errors (4xx, 5xx responses)
      console.error('API Error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        requestId: error.requestId,
      });

      // Handle specific error codes
      switch (error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
          break;
        case 'INVALID_VERSE':
          console.log('Invalid verse reference provided');
          break;
        case 'CONTENT_BLOCKED':
          console.log('Content was blocked by moderation');
          break;
        default:
          console.log('Unknown API error');
      }
    } else if (error instanceof TimeoutError) {
      // Handle timeout errors
      console.error('Request timed out. Please try again.');
    } else if (error instanceof NetworkError) {
      // Handle network errors
      console.error('Network error. Check your internet connection.');
    } else if (error instanceof ValidationError) {
      // Handle validation errors
      console.error('Validation error:', error.message);
      if (error.field) {
        console.error('Invalid field:', error.field);
      }
    } else {
      // Handle unknown errors
      console.error('Unknown error:', error);
    }
  }
}

// ============================================================================
// Example 4: Fetching Daily Verse
// ============================================================================

async function example4_dailyVerse() {
  try {
    const dailyVerse = await apiClient.getDailyVerse();

    console.log('Daily verse:', dailyVerse);
    console.log('Reference:', dailyVerse.verseReference);
    console.log('Text:', dailyVerse.verseText);
    console.log('Generated at:', new Date(dailyVerse.generatedAt));
  } catch (error) {
    console.error('Failed to fetch daily verse:', error);
  }
}

// ============================================================================
// Example 5: Getting Image by ID
// ============================================================================

async function example5_getImage() {
  const imageId = 'abc123-def456-ghi789';

  try {
    const result = await apiClient.getImage(imageId);

    console.log('Image:', result);
    console.log('Metadata:', result.metadata);
    console.log('Moderation status:', result.metadata.moderationStatus);
    console.log('Tags:', result.metadata.tags);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      console.error('Image not found');
    } else {
      console.error('Failed to fetch image:', error);
    }
  }
}

// ============================================================================
// Example 6: Getting Share URL
// ============================================================================

function example6_shareUrl() {
  const imageId = 'abc123-def456-ghi789';

  try {
    const shareUrl = apiClient.getShareUrl(imageId);
    console.log('Share URL:', shareUrl);

    // Open in new window
    window.open(shareUrl, '_blank');
  } catch (error) {
    console.error('Failed to generate share URL:', error);
  }
}

// ============================================================================
// Example 7: Custom Configuration
// ============================================================================

function example7_customConfig() {
  // Create a custom client with different settings
  const customClient = createApiClient({
    baseUrl: 'https://api.example.com',
    timeout: 60000, // 60 seconds
    maxRetries: 5,
    retryDelay: 2000, // 2 seconds
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  });

  // Use the custom client
  return customClient.generateImage({
    verseReference: 'Romans 8:28',
    stylePreset: 'classic',
  });
}

// ============================================================================
// Example 8: Request Cancellation
// ============================================================================

async function example8_cancellation() {
  // Start a request
  const promise = apiClient.generateImage({
    verseReference: 'John 3:16',
    stylePreset: 'modern',
  });

  // Cancel after 5 seconds if not completed
  setTimeout(() => {
    console.log('Cancelling all requests...');
    apiClient.cancelAllRequests();
  }, 5000);

  try {
    const result = await promise;
    console.log('Request completed:', result);
  } catch (error) {
    console.log('Request was cancelled or failed:', error);
  }
}

// ============================================================================
// Example 9: Idempotent Requests
// ============================================================================

async function example9_idempotency() {
  // Generate a unique request ID
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const params: GenerateImageRequest = {
    verseReference: 'John 3:16',
    stylePreset: 'modern',
    requestId, // Include request ID for idempotency
  };

  // First request
  const result1 = await apiClient.generateImage(params);
  console.log('First request:', result1);

  // Second request with same ID (should return cached result)
  const result2 = await apiClient.generateImage(params);
  console.log('Second request:', result2);

  // Both should have the same imageId
  console.log('Same image?', result1.imageId === result2.imageId);
}

// ============================================================================
// Example 10: Handling Rate Limits
// ============================================================================

async function example10_rateLimits() {
  try {
    const image = await apiClient.generateImage({
      verseReference: 'John 3:16',
      stylePreset: 'modern',
    });

    console.log('Generated:', image);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 429) {
      // Rate limit exceeded
      const retryAfter = error.retryAfter || 60;
      console.log(`Rate limited. Please wait ${retryAfter} seconds before retrying.`);

      // Schedule retry
      setTimeout(async () => {
        console.log('Retrying after rate limit...');
        try {
          const image = await apiClient.generateImage({
            verseReference: 'John 3:16',
            stylePreset: 'modern',
          });
          console.log('Retry successful:', image);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }, retryAfter * 1000);
    } else {
      console.error('Other error:', error);
    }
  }
}

// ============================================================================
// Example 11: Sequential Requests
// ============================================================================

async function example11_sequential() {
  const verses = ['John 3:16', 'Psalms 23:1', 'Romans 8:28'];

  for (const verse of verses) {
    try {
      console.log(`Generating image for ${verse}...`);
      const image = await apiClient.generateImage({
        verseReference: verse,
        stylePreset: 'modern',
      });
      console.log(`Generated: ${image.imageId}`);
    } catch (error) {
      console.error(`Failed to generate ${verse}:`, error);
    }
  }
}

// ============================================================================
// Example 12: Parallel Requests
// ============================================================================

async function example12_parallel() {
  const verses = ['John 3:16', 'Psalms 23:1', 'Romans 8:28'];

  const promises = verses.map((verse) =>
    apiClient.generateImage({
      verseReference: verse,
      stylePreset: 'modern',
    })
  );

  try {
    const results = await Promise.all(promises);
    console.log('All images generated:', results);
  } catch (error) {
    console.error('At least one request failed:', error);
  }
}

// ============================================================================
// Example 13: Parallel Requests with Error Handling
// ============================================================================

async function example13_parallelWithErrorHandling() {
  const verses = ['John 3:16', 'Invalid Verse', 'Romans 8:28'];

  const promises = verses.map((verse) =>
    apiClient
      .generateImage({
        verseReference: verse,
        stylePreset: 'modern',
      })
      .then((result) => ({ success: true, verse, result }))
      .catch((error) => ({ success: false, verse, error }))
  );

  const results = await Promise.all(promises);

  results.forEach((result) => {
    if (result.success) {
      console.log(`✓ ${result.verse}: ${result.result.imageId}`);
    } else {
      console.error(`✗ ${result.verse}: ${result.error.message}`);
    }
  });
}

// Export examples for documentation
export const examples = {
  example1_basicGeneration,
  example2_customPrompt,
  example3_errorHandling,
  example4_dailyVerse,
  example5_getImage,
  example6_shareUrl,
  example7_customConfig,
  example8_cancellation,
  example9_idempotency,
  example10_rateLimits,
  example11_sequential,
  example12_parallel,
  example13_parallelWithErrorHandling,
};
