# Local Development Guide

Complete guide for setting up and running the Bible Image Generator locally.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Manual Setup](#manual-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+**: [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git**: [Download](https://git-scm.com/)
- **Cloudflare Account**: [Sign up](https://dash.cloudflare.com/sign-up) (free tier available)

### Optional but Recommended

- **Wrangler CLI**: `npm install -g wrangler`
- **VS Code**: With recommended extensions (see `.vscode/extensions.json`)

## Quick Setup

The fastest way to get started:

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd bible-image-generator

# Run the automated setup script
./scripts/setup-local-dev.sh

# Start the development servers
npm run dev              # Terminal 1: Worker API
npm run dev:frontend     # Terminal 2: Frontend
```

That's it! The application should now be running:
- Frontend: http://localhost:5173
- API: http://localhost:8787

## Manual Setup

If you prefer to set up manually or the script fails:

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.dev.vars` for Worker secrets:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and update the secrets (use defaults for local dev):

```bash
JWT_SECRET=local-dev-jwt-secret-change-me
ADMIN_API_KEY=local-dev-admin-key-change-me
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Create `frontend/.env.local` for frontend configuration:

```bash
cat > frontend/.env.local << 'EOF'
VITE_API_URL=http://localhost:8787
VITE_ENVIRONMENT=development
EOF
```

### 3. Set Up Local Database

Wrangler automatically creates a local D1 database when you run `wrangler dev`. To manually apply migrations:

```bash
# Apply migrations to local database
wrangler d1 migrations apply bible-image-db-dev --local

# Verify the database
wrangler d1 execute bible-image-db-dev --local --command "SELECT COUNT(*) FROM verses"
```

### 4. Seed Development Data (Optional)

```bash
# Apply seed data
wrangler d1 execute bible-image-db-dev --local --file scripts/seed-local-data.sql
```

### 5. Verify Setup

```bash
# Run tests
npm test

# Check TypeScript compilation
npm run check
```

## Development Workflow

### Starting the Development Servers

You'll need two terminal windows:

**Terminal 1 - Worker API:**
```bash
npm run dev
```

This starts the Cloudflare Worker locally at `http://localhost:8787` with:
- Hot reload on file changes
- Local D1 database (SQLite)
- Local R2 storage (file system)
- Local KV storage (in-memory)
- Durable Objects (local state)

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

This starts the Vite dev server at `http://localhost:5173` with:
- Hot module replacement (HMR)
- Fast refresh for React components
- Proxy to Worker API

### Making Changes

1. **Backend Changes** (`src/`):
   - Edit files in `src/services/`, `src/durableObjects/`, etc.
   - Worker automatically reloads
   - Check terminal for any errors

2. **Frontend Changes** (`frontend/src/`):
   - Edit React components
   - Browser automatically refreshes
   - Check browser console for errors

3. **Database Changes** (`migrations/`):
   - Create new migration file: `migrations/XXXX_description.sql`
   - Apply locally: `wrangler d1 migrations apply bible-image-db-dev --local`
   - Test the changes

### Testing Your Changes

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test file
npm test src/services/ImageGenerationService.test.ts
```

### Debugging

#### Worker Debugging

1. **View Logs:**
   ```bash
   # Logs are shown in the terminal running `npm run dev`
   # Or use wrangler tail for more details
   wrangler tail
   ```

2. **Inspect Database:**
   ```bash
   # Query the local database
   wrangler d1 execute bible-image-db-dev --local --command "SELECT * FROM images LIMIT 10"
   
   # Open SQLite shell
   sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
   ```

3. **Check R2 Storage:**
   ```bash
   # Local R2 files are stored in:
   ls -la .wrangler/state/v3/r2/miniflare-R2BucketObject/
   ```

4. **Inspect KV Storage:**
   ```bash
   # KV data is in-memory during dev, but you can check it via API
   curl http://localhost:8787/api/debug/kv
   ```

#### Frontend Debugging

1. **Browser DevTools:**
   - Open Chrome/Firefox DevTools (F12)
   - Check Console for errors
   - Network tab for API calls
   - React DevTools for component inspection

2. **Vite Logs:**
   - Check the terminal running `npm run dev:frontend`
   - Look for compilation errors or warnings

### Common Development Tasks

#### Add a New API Endpoint

1. Edit `src/index.ts` to add route
2. Create handler function
3. Add tests in `src/index.test.ts`
4. Test locally: `curl http://localhost:8787/api/your-endpoint`

#### Add a New Service

1. Create file: `src/services/YourService.ts`
2. Implement service class
3. Add tests: `src/services/YourService.test.ts`
4. Export from `src/services/index.ts`
5. Use in Worker: `import { YourService } from './services'`

#### Add a New Frontend Component

1. Create file: `frontend/src/components/YourComponent.tsx`
2. Implement React component
3. Export from `frontend/src/components/index.ts`
4. Use in App: `import { YourComponent } from './components'`

#### Update Database Schema

1. Create migration: `migrations/XXXX_your_change.sql`
2. Apply locally: `wrangler d1 migrations apply bible-image-db-dev --local`
3. Update TypeScript types in `src/types/index.ts`
4. Test the changes

## Testing

### Unit Tests

Test individual functions and classes:

```bash
# Run all unit tests
npm test

# Run specific test file
npm test src/services/ValidationService.test.ts

# Run tests matching pattern
npm test -- --grep "sanitize"
```

### Property-Based Tests

Test properties that should hold for all inputs:

```bash
# Run property tests (included in npm test)
npm test -- --grep "property"

# Run specific property test
npm test src/services/ValidationService.property.test.ts
```

### Integration Tests

Test complete workflows:

```bash
# Run integration tests
npm test src/index.integration.test.ts

# Note: Integration tests may require Worker to be running
```

### Test Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/index.html
```

## Troubleshooting

### Worker Won't Start

**Problem:** `npm run dev` fails or Worker doesn't start

**Solutions:**
1. Check if port 8787 is already in use:
   ```bash
   lsof -i :8787
   # Kill the process if needed
   kill -9 <PID>
   ```

2. Clear Wrangler cache:
   ```bash
   rm -rf .wrangler
   npm run dev
   ```

3. Check wrangler.toml syntax:
   ```bash
   wrangler deploy --dry-run
   ```

4. Verify Node.js version:
   ```bash
   node -v  # Should be 18+
   ```

### Frontend Won't Connect to API

**Problem:** Frontend shows connection errors

**Solutions:**
1. Verify Worker is running:
   ```bash
   curl http://localhost:8787/api/daily-verse
   ```

2. Check CORS settings in `wrangler.toml`:
   ```toml
   ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000"
   ```

3. Verify frontend env vars:
   ```bash
   cat frontend/.env.local
   # Should have: VITE_API_URL=http://localhost:8787
   ```

4. Clear browser cache and reload

### Database Errors

**Problem:** D1 queries fail or return no data

**Solutions:**
1. Check if migrations are applied:
   ```bash
   wrangler d1 migrations list bible-image-db-dev --local
   ```

2. Reapply migrations:
   ```bash
   rm -rf .wrangler/state/v3/d1
   wrangler d1 migrations apply bible-image-db-dev --local
   ```

3. Verify database file exists:
   ```bash
   ls -la .wrangler/state/v3/d1/miniflare-D1DatabaseObject/
   ```

4. Check SQL syntax in migrations

### Tests Failing

**Problem:** `npm test` shows failures

**Solutions:**
1. Clear test cache:
   ```bash
   npm test -- --clearCache
   ```

2. Update snapshots (if using):
   ```bash
   npm test -- -u
   ```

3. Check for missing dependencies:
   ```bash
   npm install
   ```

4. Run tests in verbose mode:
   ```bash
   npm test -- --verbose
   ```

### Build Errors

**Problem:** TypeScript compilation fails

**Solutions:**
1. Check TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

2. Regenerate Wrangler types:
   ```bash
   npm run cf-typegen
   ```

3. Clear build cache:
   ```bash
   rm -rf dist node_modules/.vite
   npm install
   ```

### Port Already in Use

**Problem:** "Port 8787 is already in use"

**Solutions:**
```bash
# Find process using port
lsof -i :8787

# Kill the process
kill -9 <PID>

# Or use a different port
wrangler dev --port 8788
```

### Slow Performance

**Problem:** Local development is slow

**Solutions:**
1. Disable source maps in development:
   ```toml
   # wrangler.toml
   upload_source_maps = false
   ```

2. Reduce test timeout:
   ```typescript
   // vitest.config.ts
   testTimeout: 10000  // Reduce from 30000
   ```

3. Use faster test mode:
   ```bash
   npm test -- --run --reporter=dot
   ```

4. Close unnecessary applications

## Advanced Configuration

### Using Real Cloudflare Resources Locally

By default, Wrangler uses local emulation. To use real Cloudflare resources:

1. **Remote D1 Database:**
   ```bash
   wrangler dev --remote
   ```

2. **Remote R2 Bucket:**
   ```bash
   wrangler dev --remote
   ```

3. **Hybrid Mode** (local Worker, remote resources):
   ```bash
   wrangler dev --remote --local-protocol=https
   ```

### Custom Wrangler Configuration

Create `wrangler.dev.toml` for local overrides:

```toml
name = "bible-image-generator-local"
compatibility_date = "2025-01-07"

[vars]
ENVIRONMENT = "development"
RATE_LIMIT_ANONYMOUS = "100"  # Higher limit for testing
ENABLE_CONTENT_MODERATION = "false"
```

Run with: `wrangler dev --config wrangler.dev.toml`

### Mock External Services

For testing without hitting real APIs:

1. **Mock Workers AI:**
   ```typescript
   // src/services/__mocks__/ImageGenerationService.ts
   export class ImageGenerationService {
     async generate() {
       return { imageData: new ArrayBuffer(100), format: 'webp' };
     }
   }
   ```

2. **Use in tests:**
   ```typescript
   vi.mock('./services/ImageGenerationService');
   ```

### Environment-Specific Configuration

Create multiple environment files:

```bash
# .dev.vars.local (your personal overrides)
RATE_LIMIT_ANONYMOUS=1000
ENABLE_CONTENT_MODERATION=false

# .dev.vars.team (shared team settings)
RATE_LIMIT_ANONYMOUS=50
ENABLE_CONTENT_MODERATION=true
```

### Database Seeding

Create custom seed scripts:

```bash
# scripts/seed-custom.sql
INSERT INTO verses (reference, text, book, chapter, verse) VALUES
  ('Custom 1:1', 'Your custom verse', 'Custom', 1, 1, 'NIV', '["custom"]');

# Apply
wrangler d1 execute bible-image-db-dev --local --file scripts/seed-custom.sql
```

### Performance Profiling

1. **Worker Performance:**
   ```bash
   # Enable detailed logging
   wrangler dev --log-level debug
   ```

2. **Frontend Performance:**
   ```bash
   # Build with profiling
   npm run build:frontend -- --mode development
   
   # Analyze bundle
   npx vite-bundle-visualizer
   ```

3. **Test Performance:**
   ```bash
   # Run with timing
   npm test -- --reporter=verbose
   ```

## Useful Commands Reference

### Wrangler Commands

```bash
# Development
wrangler dev                                    # Start local dev server
wrangler dev --remote                           # Use remote resources
wrangler dev --port 8788                        # Use different port

# Database
wrangler d1 list                                # List databases
wrangler d1 info bible-image-db-dev             # Database info
wrangler d1 execute DB --local --command "..."  # Run SQL
wrangler d1 migrations list DB --local          # List migrations
wrangler d1 migrations apply DB --local         # Apply migrations

# R2
wrangler r2 bucket list                         # List buckets
wrangler r2 object list bible-images-dev        # List objects
wrangler r2 object get bible-images-dev/key     # Get object

# KV
wrangler kv:namespace list                      # List namespaces
wrangler kv:key list --namespace-id=...         # List keys
wrangler kv:key get "key" --namespace-id=...    # Get value

# Logs
wrangler tail                                   # Stream logs
wrangler tail --format pretty                   # Pretty logs

# Deployment
wrangler deploy --dry-run                       # Test deployment
wrangler deploy                                 # Deploy to production
```

### NPM Scripts

```bash
# Development
npm run dev                    # Start Worker
npm run dev:frontend           # Start frontend

# Testing
npm test                       # Run all tests
npm run test:watch            # Watch mode
npm run test:ui               # UI mode

# Building
npm run build                 # Build Worker
npm run build:frontend        # Build frontend

# Deployment
npm run deploy                # Deploy Worker
npm run deploy:pages          # Deploy frontend
npm run deploy:all            # Deploy both

# Database
npm run migrations:apply      # Apply migrations locally

# Type checking
npm run cf-typegen           # Generate Wrangler types
npm run check                # Type check + dry run
```

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Vitest Docs](https://vitest.dev/)
- [React Docs](https://react.dev/)

## Getting Help

If you're stuck:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review error messages carefully
3. Check Cloudflare Workers Discord
4. Open an issue on GitHub
5. Ask the team in Slack/Discord

Happy coding! 🚀
