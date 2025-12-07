# New Developer Checklist

Welcome to the Bible Image Generator project! Follow this checklist to get up and running.

## Prerequisites ✓

- [ ] Node.js 18+ installed ([Download](https://nodejs.org/))
- [ ] Git installed ([Download](https://git-scm.com/))
- [ ] Code editor (VS Code recommended)
- [ ] Terminal/Command line access

## Setup Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd bible-image-generator
```

### 2. Run Automated Setup
```bash
./scripts/setup-local-dev.sh
```

This will:
- Install dependencies
- Create environment files
- Set up database
- Seed test data
- Validate setup

### 3. Start Development Servers

**Terminal 1 - Worker API:**
```bash
npm run dev
```
Wait for: "Ready on http://localhost:8787"

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```
Wait for: "Local: http://localhost:5173"

### 4. Verify Setup

**Open browser:**
- Frontend: http://localhost:5173
- API: http://localhost:8787/api/daily-verse

**Run tests:**
```bash
npm test
```

## Quick Reference

### Common Commands
```bash
npm run dev              # Start Worker
npm run dev:frontend     # Start frontend
npm test                 # Run tests
npm run test:watch      # Tests in watch mode
npm run db:reset        # Reset database
```

### Important Files
- `src/` - Worker code
- `frontend/src/` - Frontend code
- `wrangler.toml` - Worker config
- `.dev.vars` - Local secrets
- `LOCAL_DEVELOPMENT.md` - Full guide

### Useful URLs
- Frontend: http://localhost:5173
- API: http://localhost:8787
- Test UI: `npm run test:ui`

## VS Code Setup (Recommended)

### Install Extensions
Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux), then:
```
Extensions: Show Recommended Extensions
```

Install all recommended extensions.

### Use Tasks
Press `Cmd+Shift+P` → "Tasks: Run Task" to see available tasks:
- Start Worker Dev Server
- Start Frontend Dev Server
- Run Tests
- Apply Database Migrations
- And more...

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -i :8787
kill -9 <PID>
```

### Database Issues
```bash
npm run db:reset
```

### Frontend Can't Connect
Check `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8787
```

### Tests Failing
```bash
npm test -- --clearCache
npm install
```

### Still Having Issues?
1. Run validation: `./scripts/validate-setup.sh`
2. Check `LOCAL_DEVELOPMENT.md` troubleshooting section
3. Ask the team

## Learning Resources

### Project Documentation
- [ ] Read `README.md` - Project overview
- [ ] Read `LOCAL_DEVELOPMENT.md` - Development guide
- [ ] Read `QUICK_DEV_REFERENCE.md` - Command reference
- [ ] Review `.kiro/specs/bible-image-generator/` - Feature specs

### Code Structure
- [ ] Explore `src/services/` - Business logic
- [ ] Explore `src/durableObjects/` - Rate limiting
- [ ] Explore `frontend/src/components/` - UI components
- [ ] Review `src/types/index.ts` - Type definitions

### Testing
- [ ] Read `src/test-helpers/README.md` - Test utilities
- [ ] Run `npm run test:ui` - Interactive test UI
- [ ] Review existing tests in `src/**/*.test.ts`

## Development Workflow

### Making Changes

1. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes:**
   - Edit files in `src/` or `frontend/src/`
   - Worker and frontend auto-reload

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Check types:**
   ```bash
   npm run check
   ```

5. **Commit changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

6. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Testing Your Changes

```bash
# Unit tests
npm test

# Watch mode (re-runs on changes)
npm run test:watch

# With UI
npm run test:ui

# With coverage
npm run test:coverage
```

### Debugging

**VS Code:**
1. Set breakpoints in code
2. Press F5 or use Debug panel
3. Select "Debug Worker" or "Debug Tests"

**Browser:**
1. Open DevTools (F12)
2. Check Console for errors
3. Network tab for API calls

## First Tasks

Good first tasks to get familiar with the codebase:

- [ ] Generate an image via the UI
- [ ] Test the daily verse endpoint
- [ ] Run the test suite
- [ ] Add a console.log and see it in terminal
- [ ] Make a small UI change and see it reload
- [ ] Query the database: `npm run db:query "SELECT * FROM verses LIMIT 5"`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
│                 (localhost:5173)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Worker API                      │
│                 (localhost:8787)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Services │  │  Durable │  │ Scheduled│            │
│  │          │  │  Objects │  │  Workers │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└────────┬────────────┬────────────┬─────────────────────┘
         │            │            │
         ▼            ▼            ▼
┌─────────────┐ ┌─────────┐ ┌──────────┐
│ Workers AI  │ │   R2    │ │    D1    │
│ (flux-2-dev)│ │ Storage │ │ Database │
└─────────────┘ └─────────┘ └──────────┘
```

## Key Concepts

### Services (`src/services/`)
- **ImageGenerationService**: AI image generation
- **StorageService**: R2 and D1 operations
- **ValidationService**: Input validation
- **CacheService**: KV caching
- **VerseService**: Bible verse management

### Durable Objects (`src/durableObjects/`)
- **RateLimiter**: Rate limiting coordination

### Frontend (`frontend/src/`)
- **React + TypeScript**: UI framework
- **Tailwind CSS**: Styling
- **Vite**: Build tool

## Getting Help

### Documentation
- `LOCAL_DEVELOPMENT.md` - Comprehensive guide
- `QUICK_DEV_REFERENCE.md` - Quick commands
- `src/test-helpers/README.md` - Testing guide

### Team
- Ask in team chat/Slack
- Create GitHub issue
- Pair programming session

### External Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [React Docs](https://react.dev/)
- [Vitest Docs](https://vitest.dev/)

## Checklist Complete! 🎉

Once you've completed this checklist:
- [ ] You can start the development servers
- [ ] You can run tests
- [ ] You understand the project structure
- [ ] You know where to find documentation
- [ ] You've made your first change

**Welcome to the team! Happy coding! 🚀**

---

*Need help? Check `LOCAL_DEVELOPMENT.md` or ask the team!*
