# Wrangler Commands Quick Reference

This document provides a quick reference for common Wrangler commands used in the Bible Image Generator project.

## Table of Contents

- [Development](#development)
- [Deployment](#deployment)
- [Database (D1)](#database-d1)
- [Storage (R2)](#storage-r2)
- [Cache (KV)](#cache-kv)
- [Secrets](#secrets)
- [Monitoring](#monitoring)
- [Scheduled Workers](#scheduled-workers)

## Development

### Start Local Development Server

```bash
# Start with default (dev) environment
npm run dev

# Or with Wrangler directly
wrangler dev

# Start with local persistence
wrangler dev --local --persist

# Start with remote resources (staging)
wrangler dev --env staging --remote
```

### Type Generation

```bash
# Generate TypeScript types from wrangler.toml
npm run cf-typegen
```

### Type Check and Dry Run

```bash
# Run TypeScript check and dry-run deployment
npm run check
```

## Deployment

### Deploy Workers

```bash
# Deploy to development
npm run deploy

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

### Deploy Frontend (Pages)

```bash
# Build and deploy frontend
npm run deploy:pages

# Deploy to specific branch
wrangler pages deploy dist/frontend --project-name=bible-image-generator-frontend --branch=staging
```

### Deploy Everything

```bash
# Deploy worker + frontend to staging
npm run deploy:all:staging

# Deploy worker + frontend to production
npm run deploy:all:production
```

### Rollback

```bash
# Rollback to previous version
wrangler rollback

# Rollback specific environment
wrangler rollback --env production
```

## Database (D1)

### Create Database

```bash
# Create new D1 database
wrangler d1 create bible-image-db-dev
wrangler d1 create bible-image-db-staging
wrangler d1 create bible-image-db-production
```

### Migrations

```bash
# List migrations
wrangler d1 migrations list bible-image-db-dev

# Apply migrations locally
wrangler d1 migrations apply bible-image-db-dev --local

# Apply migrations to remote (dev)
npm run migrations:apply

# Apply migrations to staging
npm run migrations:apply:staging

# Apply migrations to production
npm run migrations:apply:production

# Create new migration
wrangler d1 migrations create bible-image-db-dev "migration_name"
```

### Query Database

```bash
# Execute SQL query (local)
wrangler d1 execute bible-image-db-dev --local --command="SELECT * FROM verses LIMIT 5"

# Execute SQL query (remote)
wrangler d1 execute bible-image-db-dev --command="SELECT COUNT(*) FROM images"

# Execute SQL file
wrangler d1 execute bible-image-db-dev --file=./query.sql

# Query with environment
wrangler d1 execute bible-image-db-production --env production --command="SELECT * FROM usage_metrics ORDER BY date DESC LIMIT 7"
```

### Database Info

```bash
# Get database information
wrangler d1 info bible-image-db-dev

# List all databases
wrangler d1 list
```

### Backup and Restore

```bash
# Export database
wrangler d1 export bible-image-db-production --env production --output=backup.sql

# Import database (be careful!)
wrangler d1 execute bible-image-db-staging --env staging --file=backup.sql
```

## Storage (R2)

### Create Bucket

```bash
# Create R2 bucket
wrangler r2 bucket create bible-images-dev
wrangler r2 bucket create bible-images-staging
wrangler r2 bucket create bible-images-production
```

### List Buckets

```bash
# List all R2 buckets
wrangler r2 bucket list
```

### Manage Objects

```bash
# List objects in bucket
wrangler r2 object list bible-images-dev

# Upload object
wrangler r2 object put bible-images-dev/test.txt --file=./test.txt

# Download object
wrangler r2 object get bible-images-dev/test.txt --file=./downloaded.txt

# Delete object
wrangler r2 object delete bible-images-dev/test.txt
```

### Bucket Info

```bash
# Get bucket information
wrangler r2 bucket info bible-images-production
```

## Cache (KV)

### Create Namespace

```bash
# Create KV namespace
wrangler kv:namespace create KV_CACHE

# Create for specific environment
wrangler kv:namespace create KV_CACHE --env staging
wrangler kv:namespace create KV_CACHE --env production
```

### List Namespaces

```bash
# List all KV namespaces
wrangler kv:namespace list
```

### Manage Keys

```bash
# List keys in namespace
wrangler kv:key list --namespace-id=<namespace-id>

# Get value
wrangler kv:key get "daily-verse:current" --namespace-id=<namespace-id>

# Put value
wrangler kv:key put "test-key" "test-value" --namespace-id=<namespace-id>

# Delete key
wrangler kv:key delete "test-key" --namespace-id=<namespace-id>
```

### Bulk Operations

```bash
# Bulk upload from JSON file
wrangler kv:bulk put --namespace-id=<namespace-id> ./data.json

# Bulk delete
wrangler kv:bulk delete --namespace-id=<namespace-id> ./keys.json
```

## Secrets

### Set Secrets

```bash
# Set secret (will prompt for value)
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_API_KEY

# Set secret for specific environment
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
```

### List Secrets

```bash
# List all secrets (names only, not values)
wrangler secret list

# List for specific environment
wrangler secret list --env production
```

### Delete Secrets

```bash
# Delete secret
wrangler secret delete JWT_SECRET

# Delete for specific environment
wrangler secret delete JWT_SECRET --env production
```

## Monitoring

### Tail Logs

```bash
# Tail logs (development)
npm run tail

# Tail logs (staging)
npm run tail:staging

# Tail logs (production)
npm run tail:production

# Filter by status
wrangler tail --env production --status error
wrangler tail --env production --status ok

# Filter by HTTP method
wrangler tail --env production --method POST

# Filter by sampling rate (0.0 to 1.0)
wrangler tail --env production --sampling-rate 0.5
```

### View Metrics

```bash
# View worker analytics (use Cloudflare Dashboard)
# https://dash.cloudflare.com/
```

## Scheduled Workers

### Test Scheduled Workers Locally

```bash
# Start dev server with scheduled worker support
wrangler dev --test-scheduled

# In another terminal, trigger scheduled event
curl "http://localhost:8787/__scheduled?cron=0+6+*+*+*"

# Trigger specific cron
curl "http://localhost:8787/__scheduled?cron=0+0+*+*+*"  # Metrics aggregation
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+0"  # Weekly cleanup
```

### View Scheduled Worker Logs

```bash
# Tail logs and watch for scheduled executions
wrangler tail --env production

# Check logs at scheduled times:
# - 6:00 AM UTC (daily verse)
# - 12:00 AM UTC (metrics)
# - 2:00 AM UTC Sunday (cleanup)
```

## Durable Objects

### List Durable Objects

```bash
# List all Durable Object instances
wrangler durable-objects list RATE_LIMITER

# List for specific environment
wrangler durable-objects list RATE_LIMITER --env production
```

### Get Durable Object Info

```bash
# Get information about a specific instance
wrangler durable-objects get RATE_LIMITER <object-id>
```

## Troubleshooting Commands

### Check Configuration

```bash
# Validate wrangler.toml
wrangler deploy --dry-run

# Show current configuration
wrangler whoami
```

### Clear Local Cache

```bash
# Clear local Wrangler cache
rm -rf ~/.wrangler

# Clear local D1 database
rm -rf .wrangler/state
```

### Debug Mode

```bash
# Run with verbose logging
wrangler dev --log-level debug

# Deploy with verbose output
wrangler deploy --env production --verbose
```

## Useful Aliases

Add these to your `.bashrc` or `.zshrc` for quick access:

```bash
# Wrangler aliases
alias wd='wrangler dev'
alias wdp='wrangler deploy'
alias wt='wrangler tail'
alias wtp='wrangler tail --env production'

# D1 aliases
alias d1q='wrangler d1 execute bible-image-db-dev --local --command'
alias d1qp='wrangler d1 execute bible-image-db-production --env production --command'

# Deployment aliases
alias deploy-staging='npm run deploy:all:staging'
alias deploy-prod='npm run deploy:all:production'
```

## Environment Variables Reference

| Command Flag | Environment | Worker Name |
|--------------|-------------|-------------|
| (none) | development | bible-image-generator |
| `--env staging` | staging | bible-image-generator-staging |
| `--env production` | production | bible-image-generator-production |

## Additional Resources

- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [KV Documentation](https://developers.cloudflare.com/kv/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
