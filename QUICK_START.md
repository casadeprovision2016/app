# Quick Start Guide

Get the Bible Image Generator up and running in minutes.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`

## 1. Install Dependencies

```bash
npm install
```

## 2. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create bible-image-db

# Create R2 bucket
wrangler r2 bucket create bible-images

# Create KV namespace
wrangler kv:namespace create KV_CACHE
```

**Important:** Copy the IDs from the output and update `wrangler.json`:
- `database_id` for D1
- `bucket_name` for R2 (already set)
- `id` for KV namespace

## 3. Run Database Migrations

```bash
# Local development
wrangler d1 migrations apply DB --local

# Production (after updating wrangler.json)
wrangler d1 migrations apply DB --remote
```

## 4. Local Development

### Start Worker API
```bash
npm run dev
```
Worker will be available at `http://localhost:8787`

### Start Frontend
```bash
# In a new terminal
npm run dev:frontend
```
Frontend will be available at `http://localhost:5173`

## 5. Test Locally

```bash
# Run all tests
npm test

# Test image generation (requires Worker running)
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'
```

## 6. Deploy to Production

### Deploy Worker API
```bash
npm run deploy
```

Note the Worker URL from the output (e.g., `https://bible-image-generator.your-subdomain.workers.dev`)

### Deploy Frontend to Pages

**Option A: Using Wrangler**
```bash
# Update VITE_API_URL in wrangler.pages.toml with your Worker URL
npm run deploy:pages
```

**Option B: Using Git Integration**
1. Push code to GitHub/GitLab
2. Go to Cloudflare Dashboard → Pages
3. Create new project and connect your repository
4. Configure build settings:
   - Build command: `npm run build:frontend`
   - Build output: `dist/frontend`
5. Add environment variables:
   - `VITE_API_URL`: Your Worker URL
   - `VITE_ENVIRONMENT`: `production`
6. Deploy

## 7. Verify Deployment

### Check Worker
```bash
# Health check
curl https://your-worker-url.workers.dev/api/health

# Get daily verse
curl https://your-worker-url.workers.dev/api/daily-verse
```

### Check Frontend
1. Open your Pages URL in browser
2. Verify daily verse displays
3. Try generating an image
4. Test WhatsApp share

## Common Commands

```bash
# Development
npm run dev                  # Start Worker locally
npm run dev:frontend         # Start frontend locally

# Building
npm run build:frontend       # Build frontend for production

# Testing
npm test                     # Run all tests
npm run test:watch          # Run tests in watch mode

# Deployment
npm run deploy              # Deploy Worker
npm run deploy:pages        # Deploy frontend to Pages
npm run deploy:all          # Deploy both Worker and Pages

# Database
wrangler d1 migrations apply DB --local   # Apply migrations locally
wrangler d1 migrations apply DB --remote  # Apply migrations to production
wrangler d1 execute DB --command "SELECT * FROM verses LIMIT 5"  # Query database

# Logs
wrangler tail                # Stream Worker logs
```

## Environment Variables

### Worker (wrangler.json)
- `ENVIRONMENT`: `development` | `production`
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `RATE_LIMIT_ANONYMOUS`: Requests per hour for anonymous users
- `RATE_LIMIT_AUTHENTICATED`: Requests per hour for authenticated users
- `IMAGE_RETENTION_DAYS`: Days to keep images before cleanup
- `BACKUP_RETENTION_DAYS`: Days to keep backups
- `ENABLE_CONTENT_MODERATION`: Enable/disable content moderation

### Frontend (.env.local)
```bash
VITE_API_URL=http://localhost:8787
VITE_ENVIRONMENT=development
```

### Pages (Dashboard)
- `VITE_API_URL`: Your Worker URL
- `VITE_ENVIRONMENT`: `production` | `preview`

## Troubleshooting

### Worker not starting
- Check if port 8787 is available
- Verify wrangler.json is valid
- Run `wrangler dev --local` for more verbose output

### Frontend not connecting to API
- Verify `VITE_API_URL` is set correctly
- Check CORS headers in Worker
- Open browser DevTools → Network tab to see errors

### Database errors
- Ensure migrations are applied
- Check database_id in wrangler.json
- Verify D1 database exists: `wrangler d1 list`

### Build errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`
- Check Node.js version: `node --version` (should be 18+)

## Next Steps

1. ✅ Set up custom domain for Pages
2. ✅ Configure authentication (optional)
3. ✅ Enable Turnstile CAPTCHA (optional)
4. ✅ Set up monitoring and alerts
5. ✅ Review and adjust rate limits
6. ✅ Add more verses to database
7. ✅ Customize style presets

## Resources

- [Full Deployment Guide](./PAGES_DEPLOYMENT.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)

## Support

Need help? Check:
- [Cloudflare Community](https://community.cloudflare.com/)
- [Discord](https://discord.gg/cloudflaredev)
- [GitHub Issues](https://github.com/your-repo/issues)
