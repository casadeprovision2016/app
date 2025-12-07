# Quick Development Reference

Fast reference for common local development tasks.

## 🚀 Getting Started

```bash
# First time setup
./scripts/setup-local-dev.sh

# Start development
npm run dev              # Terminal 1: Worker API
npm run dev:frontend     # Terminal 2: Frontend
```

## 📝 Common Commands

### Development
```bash
npm run dev                    # Start Worker locally
npm run dev:frontend           # Start frontend dev server
npm run dev:remote             # Use remote Cloudflare resources
```

### Testing
```bash
npm test                       # Run all tests once
npm run test:watch            # Run tests in watch mode
npm run test:ui               # Run tests with UI
npm run test:coverage         # Generate coverage report
```

### Database
```bash
npm run migrations:apply       # Apply migrations locally
npm run migrations:list        # List applied migrations
npm run db:seed               # Seed test data
npm run db:reset              # Reset database and reseed
npm run db:query "SELECT * FROM verses LIMIT 5"  # Run SQL query
```

### Building
```bash
npm run build                 # Build Worker
npm run build:frontend        # Build frontend
npm run check                 # Type check + dry run
```

### Deployment
```bash
npm run deploy                # Deploy Worker
npm run deploy:pages          # Deploy frontend
npm run deploy:all            # Deploy both
```

### Utilities
```bash
npm run tail                  # Stream Worker logs
npm run clean                 # Clean build artifacts
npm run clean:all             # Clean everything including node_modules
```

## 🔍 Quick Debugging

### View Logs
```bash
# Worker logs (in dev terminal)
# Or use:
wrangler tail

# Frontend logs
# Check browser console (F12)
```

### Query Database
```bash
# List all verses
npm run db:query "SELECT * FROM verses LIMIT 10"

# Check images
npm run db:query "SELECT id, verse_reference, style_preset FROM images"

# View metrics
npm run db:query "SELECT * FROM usage_metrics ORDER BY date DESC"
```

### Check Storage
```bash
# Local R2 files
ls -la .wrangler/state/v3/r2/miniflare-R2BucketObject/

# Local D1 database
ls -la .wrangler/state/v3/d1/miniflare-D1DatabaseObject/
```

## 🧪 Testing Endpoints

### Daily Verse
```bash
curl http://localhost:8787/api/daily-verse
```

### Generate Image
```bash
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "verseReference": "John 3:16",
    "stylePreset": "modern"
  }'
```

### Get Image
```bash
curl http://localhost:8787/api/images/IMAGE_ID
```

### Share Link
```bash
curl http://localhost:8787/api/images/IMAGE_ID/share
```

## 🐛 Common Issues

### Port in use
```bash
# Find process
lsof -i :8787
# Kill it
kill -9 <PID>
```

### Database not found
```bash
npm run db:reset
```

### Frontend can't connect
```bash
# Check .env.local
cat frontend/.env.local
# Should have: VITE_API_URL=http://localhost:8787
```

### Tests failing
```bash
npm test -- --clearCache
npm install
```

## 📂 Important Files

```
.dev.vars                    # Local secrets (create from .dev.vars.example)
frontend/.env.local          # Frontend config (create manually)
wrangler.toml               # Worker configuration
vitest.config.ts            # Test configuration
src/test-helpers/setup.ts   # Test utilities
```

## 🔗 URLs

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8787
- **Test UI**: http://localhost:51204 (when running `npm run test:ui`)

## 📚 Documentation

- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - Complete guide
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [README.md](./README.md) - Project overview

## 💡 Tips

1. **Use two terminals**: One for Worker, one for frontend
2. **Watch mode for tests**: `npm run test:watch` during development
3. **Check logs first**: Most issues show up in terminal logs
4. **Reset database**: `npm run db:reset` fixes most DB issues
5. **Clear cache**: `rm -rf .wrangler` for fresh start

## 🎯 Workflow

1. Make changes to code
2. Worker/frontend auto-reloads
3. Run tests: `npm test`
4. Check in browser
5. Commit changes

## 🆘 Need Help?

1. Check [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) troubleshooting
2. Review error messages in terminal
3. Check browser console (F12)
4. Ask the team

---

**Pro tip**: Bookmark this file for quick reference! 🔖
