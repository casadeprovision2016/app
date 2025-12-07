# API Client Service

This directory contains the API client service for the Bible Image Generator frontend application.

## Overview

The API client provides typed request/response methods for all backend API endpoints with:

- **Error Handling**: Comprehensive error handling with custom error types
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Timeout Handling**: Configurable request timeouts
- **Loading State Management**: React hooks for easy integration with components
- **Type Safety**: Full TypeScript support with typed requests and responses

## Files

- `apiClient.ts` - Core API client implementation
- `index.ts` - Public exports
- `README.md` - This file

## Usage

### Basic Usage with API Client

```typescript
import { apiClient } from './services/apiClient';

// Generate an image
try {
  const image = await apiClient.generateImage({
    verseReference: 'John 3:16',
    stylePreset: 'modern',
    customPrompt: 'Beautiful sunset background',
  });
  console.log('Generated image:', image);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message, error.code);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof NetworkError) {
    console.error('Network error');
  }
}

// Get daily verse
const dailyVerse = await apiClient.getDailyVerse();

// Get image by ID
const image = await apiClient.getImage('image-id-123');

// Get share URL
const shareUrl = apiClient.getShareUrl('image-id-123');
```

### Usage with React Hooks

```typescript
import { useGenerateImage, useDailyVerse } from '../hooks/useApi';

function MyComponent() {
  const { data, loading, error, execute } = useGenerateImage();

  const handleGenerate = async () => {
    const result = await execute({
      verseReference: 'John 3:16',
      stylePreset: 'modern',
    });
    
    if (result) {
      console.log('Image generated:', result);
    }
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {data && <img src={data.imageUrl} alt={data.verseReference} />}
      <button onClick={handleGenerate}>Generate</button>
    </div>
  );
}
```

### Custom Configuration

```typescript
import { createApiClient } from './services/apiClient';

const customClient = createApiClient({
  baseUrl: 'https://api.example.com',
  timeout: 60000, // 60 seconds
  maxRetries: 5,
  retryDelay: 2000, // 2 seconds
});

const image = await customClient.generateImage({
  verseReference: 'Psalms 23:1',
  stylePreset: 'classic',
});
```

## API Endpoints

### POST /api/generate

Generate a new image from a verse reference.

**Request:**
```typescript
{
  verseReference: string;      // e.g., "John 3:16"
  verseText?: string;           // Optional override
  stylePreset?: string;         // "modern" | "classic" | "minimalist" | "artistic"
  customPrompt?: string;        // Additional prompt guidance
  requestId?: string;           // For idempotency
}
```

**Response:**
```typescript
{
  imageId: string;
  imageUrl: string;
  whatsappShareUrl: string;
  verseReference: string;
  verseText: string;
}
```

### GET /api/images/:imageId

Get an existing image by ID.

**Response:**
```typescript
{
  imageId: string;
  imageUrl: string;
  metadata: ImageMetadata;
}
```

### GET /api/daily-verse

Get the daily verse image.

**Response:**
```typescript
{
  imageId: string;
  imageUrl: string;
  verseReference: string;
  verseText: string;
  generatedAt: string;
}
```

### GET /api/images/:imageId/share

Get share URL for an image (redirects to WhatsApp).

## Error Handling

The API client provides several custom error types:

### ApiError

Thrown when the API returns an error response.

```typescript
class ApiError extends Error {
  statusCode: number;
  code: string;
  requestId?: string;
  retryAfter?: number;
  details?: unknown;
}
```

### NetworkError

Thrown when a network error occurs (e.g., no internet connection).

```typescript
class NetworkError extends Error {
  originalError?: unknown;
}
```

### TimeoutError

Thrown when a request times out.

```typescript
class TimeoutError extends Error {}
```

### ValidationError

Thrown when client-side validation fails.

```typescript
class ValidationError extends Error {
  field?: string;
}
```

## Retry Logic

The API client automatically retries failed requests with exponential backoff:

- **Retryable Status Codes**: 408, 429, 500, 502, 503, 504
- **Max Retries**: Configurable (default: 3)
- **Backoff Strategy**: Exponential (delay × 2^retryCount)
- **Retry-After Header**: Respected for rate limit errors (429)

Example retry sequence:
1. Initial request fails with 500
2. Wait 1 second
3. Retry fails with 500
4. Wait 2 seconds
5. Retry succeeds

## Timeout Handling

All requests have a configurable timeout (default: 35 seconds). When a request times out:

1. The request is aborted using AbortController
2. A TimeoutError is thrown
3. The error can be caught and handled by the caller

## Request Cancellation

You can cancel pending requests:

```typescript
// Cancel all pending requests
apiClient.cancelAllRequests();

// Cancel specific request (if you have the request ID)
apiClient.cancelRequest('request-id-123');
```

This is useful when:
- Component unmounts before request completes
- User navigates away from the page
- User initiates a new request before the previous one completes

## Configuration Options

```typescript
interface ApiClientConfig {
  baseUrl: string;              // Base URL for API endpoints
  timeout: number;              // Request timeout in milliseconds
  maxRetries: number;           // Maximum number of retry attempts
  retryDelay: number;           // Initial retry delay in milliseconds
  retryableStatusCodes: number[]; // HTTP status codes that trigger retry
}
```

Default configuration:
```typescript
{
  baseUrl: '/api',
  timeout: 35000,               // 35 seconds
  maxRetries: 3,
  retryDelay: 1000,             // 1 second
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}
```

## Requirements

This implementation satisfies the following requirements:

- **11.2**: Typed request/response methods for all API endpoints
- **11.3**: Error handling with custom error types and retry logic
- **11.4**: Request timeout handling and loading state management

## Testing

The API client includes comprehensive unit tests covering:

- Successful requests
- Error handling
- Retry logic
- Timeout handling
- Request cancellation
- Validation

Run tests with:
```bash
npm test -- frontend/src/services/apiClient.test.ts
```

## Future Enhancements

Potential improvements for future versions:

1. **Request Deduplication**: Prevent duplicate concurrent requests
2. **Response Caching**: Cache responses for a configurable duration
3. **Request Queuing**: Queue requests when offline and retry when online
4. **Progress Tracking**: Track upload/download progress for large requests
5. **Request Interceptors**: Add middleware for request/response transformation
6. **Metrics Collection**: Track API performance metrics
