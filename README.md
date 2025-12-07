# Bible Image Generator

AI-generated images based on biblical verses using Cloudflare Workers AI (flux-2-dev model).

## Features

- Generate inspirational images from biblical verses
- Share images via WhatsApp
- Daily verse automation
- Rate limiting and content moderation
- Serverless architecture on Cloudflare's edge

## Tech Stack

- **Cloudflare Workers**: Serverless compute
- **Workers AI**: flux-2-dev model for image generation
- **R2**: Object storage for images
- **D1**: SQLite database for metadata
- **Workers KV**: Caching layer
- **Durable Objects**: Rate limiting coordination
- **Cloudflare Pages**: Frontend hosting

## Development

### Quick Start

```bash
# Automated setup (recommended)
./scripts/setup-local-dev.sh

# Start development
npm run dev              # Terminal 1: Worker API
npm run dev:frontend     # Terminal 2: Frontend
```

See [LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) for complete setup guide and [QUICK_DEV_REFERENCE.md](./docs/QUICK_DEV_REFERENCE.md) for command reference.

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

### Manual Setup

If you prefer manual setup or the script fails:

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your secrets
```

3. Set up database:
```bash
npm run migrations:apply
npm run db:seed
```

4. Start development:
```bash
npm run dev              # Worker API
npm run dev:frontend     # Frontend (in new terminal)
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Deployment

#### Deploy Worker API
```bash
# Deploy Worker to production
npm run deploy
```

#### Deploy Frontend to Pages
```bash
# Build and deploy frontend
npm run deploy:pages

# Or deploy both Worker and Pages
npm run deploy:all
```

See [PAGES_DEPLOYMENT.md](./PAGES_DEPLOYMENT.md) for detailed Pages deployment instructions.

## Project Structure

```
.
├── src/
│   ├── services/          # Business logic services
│   ├── durableObjects/    # Durable Object implementations
│   ├── utils/             # Utility functions
│   └── index.ts           # Main Worker entry point
├── frontend/              # React frontend application
├── .kiro/
│   └── specs/             # Feature specifications
└── wrangler.json          # Cloudflare Workers configuration
```

## License

MIT
# app
