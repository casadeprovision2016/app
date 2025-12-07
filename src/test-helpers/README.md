# Test Helpers

Utilities for testing the Bible Image Generator application.

## Overview

This directory contains helper functions and mock implementations for testing:

- **setup.ts**: Mock environment, bindings, and test utilities
- Mock implementations for Cloudflare services (AI, R2, D1, KV, Durable Objects)
- Sample data for testing
- Utility functions for common test operations

## Usage

### Basic Test Setup

```typescript
import { createMockEnv, mockVerses } from './test-helpers/setup';
import { describe, test, expect } from 'vitest';

describe('MyService', () => {
  test('should work with mock environment', async () => {
    const env = createMockEnv();
    
    // Use env in your tests
    const result = await myFunction(env);
    expect(result).toBeDefined();
  });
});
```

### Using Mock Bindings

```typescript
import { createMockD1, createMockR2, createMockKV } from './test-helpers/setup';

test('database operations', async () => {
  const db = createMockD1();
  
  const result = await db.prepare('SELECT * FROM verses').first();
  expect(result).toHaveProperty('reference');
});

test('storage operations', async () => {
  const r2 = createMockR2();
  
  await r2.put('test-key', new ArrayBuffer(100));
  const obj = await r2.get('test-key');
  expect(obj).not.toBeNull();
});

test('cache operations', async () => {
  const kv = createMockKV();
  
  await kv.put('key', 'value');
  const value = await kv.get('key');
  expect(value).toBe('value');
});
```

### Using Mock Data

```typescript
import { mockVerses, mockImageMetadata } from './test-helpers/setup';

test('verse processing', () => {
  const verse = mockVerses[0];
  expect(verse.reference).toBe('John 3:16');
});

test('image metadata', () => {
  const metadata = mockImageMetadata;
  expect(metadata.stylePreset).toBe('modern');
});
```

### Utility Functions

```typescript
import { 
  waitFor, 
  sleep, 
  randomString, 
  randomUUID,
  createMockRequest 
} from './test-helpers/setup';

test('async operations', async () => {
  let ready = false;
  setTimeout(() => ready = true, 100);
  
  await waitFor(() => ready, 1000);
  expect(ready).toBe(true);
});

test('request handling', async () => {
  const request = createMockRequest('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify({ data: 'test' }),
  });
  
  expect(request.method).toBe('POST');
});

test('random data', () => {
  const str = randomString(20);
  expect(str).toHaveLength(20);
  
  const uuid = randomUUID();
  expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
```

## Mock Implementations

### Mock AI

Simulates Workers AI responses:

```typescript
const ai = createMockAI();
const result = await ai.run('@cf/black-forest-labs/flux-2-dev', {
  prompt: 'test prompt',
});
expect(result.image).toBeDefined();
```

### Mock R2

In-memory object storage:

```typescript
const r2 = createMockR2();

// Put object
await r2.put('images/test.webp', imageBuffer);

// Get object
const obj = await r2.get('images/test.webp');
const data = await obj.arrayBuffer();

// List objects
const list = await r2.list({ prefix: 'images/' });

// Delete object
await r2.delete('images/test.webp');
```

### Mock D1

Simulates SQLite database:

```typescript
const db = createMockD1();

// Query
const verse = await db.prepare('SELECT * FROM verses WHERE id = ?')
  .bind(1)
  .first();

// Insert
await db.prepare('INSERT INTO images (...) VALUES (...)')
  .bind(...)
  .run();

// Batch operations
await db.batch([
  db.prepare('INSERT ...'),
  db.prepare('UPDATE ...'),
]);
```

### Mock KV

In-memory key-value store:

```typescript
const kv = createMockKV();

// Set value
await kv.put('config:key', JSON.stringify({ setting: 'value' }));

// Get value
const value = await kv.get('config:key');
const config = JSON.parse(value);

// List keys
const keys = await kv.list({ prefix: 'config:' });

// Delete
await kv.delete('config:key');
```

### Mock Durable Objects

Simulates Durable Object coordination:

```typescript
const rateLimiter = createMockDurableObject();

// Get stub
const id = rateLimiter.idFromName('user-123');
const stub = rateLimiter.get(id);

// Call method
const response = await stub.fetch(new Request('http://internal/check'));
const result = await response.json();
```

## Best Practices

1. **Use mocks for unit tests**: Fast and isolated
2. **Use real bindings for integration tests**: Test actual behavior
3. **Reset mocks between tests**: Avoid test pollution
4. **Use mock data consistently**: Easier to maintain
5. **Add custom mocks as needed**: Extend for your use cases

## Adding New Helpers

To add new test helpers:

1. Add function to `setup.ts`
2. Export from the module
3. Document usage in this README
4. Add tests for the helper itself

Example:

```typescript
// In setup.ts
export function createMockImageData(size: number = 100): ArrayBuffer {
  return new ArrayBuffer(size);
}

// In your test
import { createMockImageData } from './test-helpers/setup';

test('image processing', () => {
  const imageData = createMockImageData(1000);
  expect(imageData.byteLength).toBe(1000);
});
```

## Troubleshooting

### Mocks not working

- Ensure you're importing from the correct path
- Check that vitest is configured properly
- Verify mock functions are being called

### Type errors

- Make sure TypeScript types match Cloudflare bindings
- Use `any` type for complex mocks if needed
- Update `worker-configuration.d.ts` if types are missing

### Test failures

- Check if mocks need to be reset between tests
- Verify mock data matches expected format
- Use `vi.clearAllMocks()` in `beforeEach`

## Related Files

- `vitest.config.ts`: Test configuration
- `src/**/*.test.ts`: Unit tests
- `src/**/*.property.test.ts`: Property-based tests
- `src/**/*.integration.test.ts`: Integration tests
