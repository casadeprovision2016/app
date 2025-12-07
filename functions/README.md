# Cloudflare Pages Functions

This directory contains serverless functions that run on Cloudflare Pages.

## Overview

Pages Functions provide server-side logic at the edge, similar to Workers but integrated with your Pages deployment. They're useful for:

- API proxying (avoiding CORS issues)
- Authentication and authorization
- Server-side rendering
- Request/response transformation
- Edge middleware

## Structure

```
functions/
├── _middleware.ts       # Global middleware (runs on all requests)
├── api/
│   └── [[path]].ts     # API proxy (catches /api/*)
└── README.md           # This file
```

## Files

### `_middleware.ts`
Global middleware that runs before all Pages Functions. Currently adds:
- Security headers (X-Frame-Options, CSP, etc.)
- Request logging in development
- Response header modifications

### `api/[[path]].ts`
API proxy function that forwards requests from `/api/*` to the Worker API. This is useful for:
- **Avoiding CORS issues**: Requests appear to come from the same origin
- **Simplifying frontend code**: No need to configure CORS in the Worker
- **Adding authentication**: Can inject auth headers before proxying

## Usage

### Enabling Pages Functions

Pages Functions are automatically deployed when you deploy to Pages. No additional configuration needed.

### API Proxy Example

Frontend code can call the API through Pages:

```typescript
// Instead of calling the Worker directly:
// fetch('https://worker.example.com/api/generate', ...)

// Call through Pages (same origin):
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ verseReference: 'John 3:16' })
})
```

The Pages Function will proxy this to your Worker API automatically.

### Environment Variables

Pages Functions have access to environment variables configured in the Pages dashboard:

- `VITE_API_URL`: Worker API endpoint
- `VITE_ENVIRONMENT`: Current environment (development, preview, production)

## Development

### Local Testing

Test Pages Functions locally with Wrangler:

```bash
# Start local Pages dev server
wrangler pages dev dist/frontend --compatibility-date=2025-01-07

# Or use the npm script
npm run dev:frontend
```

### Adding New Functions

Create a new file in the `functions/` directory:

```typescript
// functions/hello.ts
export async function onRequest(context) {
  return new Response('Hello from Pages Function!');
}
```

This creates a route at `/hello`.

### Dynamic Routes

Use brackets for dynamic segments:

- `[id].ts` → `/123` (single segment)
- `[[path]].ts` → `/any/nested/path` (catch-all)

## Best Practices

1. **Keep functions lightweight**: They run on every request
2. **Use caching**: Cache responses when possible
3. **Handle errors gracefully**: Always return proper error responses
4. **Add logging**: Use console.log for debugging (visible in dashboard)
5. **Security first**: Validate inputs, sanitize outputs
6. **Environment-aware**: Use env variables for configuration

## Limitations

- **Execution time**: 30 seconds max (same as Workers)
- **Memory**: 128 MB per request
- **Request size**: 100 MB max
- **Response size**: 100 MB max

## Alternatives

If you don't need Pages Functions, you can:

1. **Configure CORS in the Worker**: Allow frontend origin
2. **Use direct Worker calls**: Call Worker API directly from frontend
3. **Remove functions directory**: Pages will serve static files only

## Resources

- [Pages Functions Documentation](https://developers.cloudflare.com/pages/functions/)
- [Routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Middleware](https://developers.cloudflare.com/pages/functions/middleware/)
- [Environment Variables](https://developers.cloudflare.com/pages/functions/bindings/)
