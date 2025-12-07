# Configuration Files Overview

This document provides an overview of all configuration files in the Bible Image Generator project.

## Configuration Files

### 1. `wrangler.toml` - Workers Configuration

**Purpose**: Main configuration file for Cloudflare Workers deployment

**Key Sections**:
- **Base Configuration**: Default (development) environment settings
- **Bindings**: AI, R2, D1, KV, Durable Objects
- **Environment Variables**: CORS, rate limits, retention policies
- **Scheduled Workers**: Cron triggers for automated tasks
- **Environment-Specific**: Staging and production overrides

**Environments**:
- `development` (default): Local development with preview resources
- `staging`: Pre-production testing environment  
- `production`: Live production environment

**Usage**:
```bash
# Deploy to development
wrangler deploy

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

### 2. `wrangler.pages.toml` - Pages Configuration

**Purpose**: Configuration for Cloudflare Pages (frontend) deployment

**Key Sections**:
- **Build Configuration**: Build command and output directory
- **Environment Variables**: API URLs for different environments
- **Headers**: Security and caching headers
- **Functions**: Pages Functions configuration

**Usage**:
```bash
# Deploy frontend
npm run build:frontend
wrangler pages deploy dist/frontend --project-name=bible-image-generator-frontend
```

### 3. `.env.example` - Environment Variables Template

**Purpose**: Documents all environment variables and secrets

**Contents**:
- Environment configuration
- CORS settings
- Rate limiting configuration
- Data retention policies
- Content moderation settings
- Secrets placeholders

**Usage**:
```bash
# Copy for local development
cp .env.example .env

# Edit with your values
nano .env
```

### 4. `package.json` - NPM Scripts

**Purpose**: Defines project dependencies and scripts

**Key Scripts**:
- `dev`: Start local development server
- `deploy:*`: Deploy to different environments
- `setup:*`: Setup resources for environments
- `migrations:*`: Apply database migrations
- `tail:*`: View logs for environments
- `test`: Run test suite

**Usage**:
```bash
# See all available scripts
npm run

# Run a specific script
npm run deploy:staging
```

### 5. `tsconfig.json` - TypeScript Configuration

**Purpose**: TypeScript compiler configuration

**Key Settings**:
- Target: ES2022
- Module: ESNext
- Strict mode enabled
- Path mappings for imports

### 6. `vitest.config.ts` - Test Configuration

**Purpose**: Configuration for Vitest test runner

**Key Settings**:
- Test environment: node
- Coverage configuration
- Test file patterns
- Global test utilities

## Helper Scripts

### `scripts/deploy.sh`

**Purpose**: Automated deployment script with pre-deployment checks

**Features**:
- Runs tests before deployment
- Type checking
- Confirmation prompt for production
- Deploys both worker and frontend

**Usage**:
```bash
./scripts/deploy.sh staging
./scripts/deploy.sh production
```

### `scripts/setup-resources.sh`

**Purpose**: Interactive script to create Cloudflare resources

**Features**:
- Creates D1 database
- Creates R2 bucket
- Creates KV namespace
- Applies migrations
- Guides secret setup

**Usage**:
```bash
./scripts/setup-resources.sh dev
./scripts/setup-resources.sh staging
./scripts/setup-resources.sh production
```

## Documentation Files

### `WRANGLER_SETUP.md`

Comprehensive guide for:
- Initial setup and resource creation
- Database migrations
- Secret configuration
- Deployment procedures
- Scheduled workers
- Troubleshooting

### `WRANGLER_COMMANDS.md`

Quick reference for:
- Common Wrangler commands
- D1 database operations
- R2 storage management
- KV cache operations
- Monitoring and logging
- Scheduled worker testing

## Configuration Workflow

### Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Authenticate with Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create Resources**
   ```bash
   npm run setup:dev
   ```

4. **Update Configuration**
   - Edit `wrangler.toml` with resource IDs
   - Update ALLOWED_ORIGINS with your domains

5. **Set Secrets**
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put ADMIN_API_KEY
   ```

6. **Apply Migrations**
   ```bash
   npm run migrations:apply
   ```

### Development Workflow

1. **Start Local Server**
   ```bash
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   npm run dev:frontend
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Deploy to Staging**
   ```bash
   npm run deploy:all:staging
   ```

5. **Deploy to Production**
   ```bash
   npm run deploy:all:production
   ```

## Environment Variables

### Required for All Environments

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | development, staging, production |
| `ALLOWED_ORIGINS` | CORS allowed origins | https://yourdomain.com |
| `RATE_LIMIT_ANONYMOUS` | Anonymous user rate limit | 5 |
| `RATE_LIMIT_AUTHENTICATED` | Authenticated user rate limit | 20 |
| `IMAGE_RETENTION_DAYS` | Image retention period | 90 |
| `BACKUP_RETENTION_DAYS` | Backup retention period | 30 |
| `ENABLE_CONTENT_MODERATION` | Enable content checks | true/false |

### Secrets (Set via Wrangler)

| Secret | Required | Description |
|--------|----------|-------------|
| `JWT_SECRET` | Optional* | JWT token signing key |
| `ADMIN_API_KEY` | Yes | Admin endpoint authentication |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile CAPTCHA |

*Required if authentication is enabled

## Scheduled Workers

The application uses three scheduled workers:

| Worker | Schedule | Cron | Description |
|--------|----------|------|-------------|
| Daily Verse | 6 AM UTC | `0 6 * * *` | Generates daily verse image |
| Metrics | Midnight UTC | `0 0 * * *` | Aggregates usage metrics |
| Cleanup | Sunday 2 AM UTC | `0 2 * * 0` | Removes old images |

## Resource Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `AI` | Workers AI | Image generation (flux-2-dev) |
| `R2_BUCKET` | R2 Bucket | Image storage |
| `DB` | D1 Database | Metadata storage |
| `KV_CACHE` | KV Namespace | Caching layer |
| `RATE_LIMITER` | Durable Object | Rate limiting |

## Configuration Best Practices

1. **Never commit secrets**: Use `wrangler secret put` for sensitive values
2. **Use environment-specific resources**: Separate dev/staging/production resources
3. **Test before production**: Always deploy to staging first
4. **Monitor deployments**: Use `wrangler tail` to watch logs
5. **Keep backups**: D1 backups are automated but verify they're working
6. **Update dependencies**: Regularly update Wrangler and other dependencies
7. **Document changes**: Update this file when adding new configuration

## Troubleshooting

### Configuration Issues

**Problem**: "Database not found" error
**Solution**: Create D1 database and update `database_id` in wrangler.toml

**Problem**: "KV namespace not found" error
**Solution**: Create KV namespace and update `id` in wrangler.toml

**Problem**: CORS errors
**Solution**: Update `ALLOWED_ORIGINS` in wrangler.toml and redeploy

**Problem**: Scheduled workers not running
**Solution**: Verify cron syntax and check Cloudflare dashboard logs

### Getting Help

1. Check the documentation files in this directory
2. Review Cloudflare Workers documentation
3. Check Wrangler CLI help: `wrangler --help`
4. View logs: `wrangler tail --env production`

## Additional Resources

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
