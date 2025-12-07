# Wrangler Configuration Setup Guide

This guide explains how to configure and deploy the Bible Image Generator using Wrangler.

## Overview

The project uses `wrangler.toml` for Workers configuration and `wrangler.pages.toml` for Pages (frontend) configuration. Three environments are supported:

- **Development** (default): Local development with preview resources
- **Staging**: Pre-production testing environment
- **Production**: Live production environment

## Prerequisites

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   # or use the local version
   npx wrangler --version
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

## Initial Setup

### 1. Create Required Resources

#### Development Environment

```bash
# Create D1 database
wrangler d1 create bible-image-db-dev
# Copy the database_id from output and update wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV_CACHE
# Copy the id from output and update wrangler.toml

# Create R2 bucket
wrangler r2 bucket create bible-images-dev
```

#### Staging Environment

```bash
# Create D1 database
wrangler d1 create bible-image-db-staging
# Update env.staging.d1_databases.database_id in wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV_CACHE --env staging
# Update env.staging.kv_namespaces.id in wrangler.toml

# Create R2 bucket
wrangler r2 bucket create bible-images-staging
```

#### Production Environment

```bash
# Create D1 database
wrangler d1 create bible-image-db-production
# Update env.production.d1_databases.database_id in wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV_CACHE --env production
# Update env.production.kv_namespaces.id in wrangler.toml

# Create R2 bucket
wrangler r2 bucket create bible-images-production
```

### 2. Run Database Migrations

After creating D1 databases, apply the schema:

```bash
# Development
wrangler d1 migrations apply bible-image-db-dev --local

# Staging
wrangler d1 migrations apply bible-image-db-staging --env staging

# Production
wrangler d1 migrations apply bible-image-db-production --env production
```

### 3. Configure Secrets

Secrets are sensitive values that should never be committed to version control. Set them using Wrangler:

```bash
# Development (optional for local dev)
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_API_KEY

# Staging
wrangler secret put JWT_SECRET --env staging
wrangler secret put ADMIN_API_KEY --env staging
wrangler secret put TURNSTILE_SECRET_KEY --env staging  # Optional

# Production
wrangler secret put JWT_SECRET --env production
wrangler secret put ADMIN_API_KEY --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production  # Optional
```

**Secret Generation Tips:**
```bash
# Generate a secure JWT secret (32 bytes)
openssl rand -base64 32

# Generate a secure API key
openssl rand -hex 32
```

### 4. Update Environment Variables

Edit `wrangler.toml` and update the following placeholders:

1. **ALLOWED_ORIGINS**: Replace with your actual domain(s)
   - Staging: `https://staging.yourdomain.com`
   - Production: `https://yourdomain.com,https://www.yourdomain.com`

2. **Resource IDs**: Replace all `placeholder-*` values with actual IDs from step 1

## Deployment

### Development (Local)

```bash
# Start local development server
npm run dev

# Or with Wrangler directly
wrangler dev

# Test with local D1 database
wrangler dev --local --persist
```

### Staging

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy frontend to Pages (staging)
npm run build:frontend
wrangler pages deploy dist/frontend --project-name=bible-image-generator-frontend --branch=staging
```

### Production

```bash
# Deploy to production
wrangler deploy --env production

# Deploy frontend to Pages (production)
npm run build:frontend
wrangler pages deploy dist/frontend --project-name=bible-image-generator-frontend --branch=main
```

## Scheduled Workers

The application uses three scheduled workers (cron jobs):

1. **Daily Verse Generation** - `0 6 * * *` (6 AM UTC daily)
   - Generates a new daily verse image
   - Updates KV cache with latest daily verse

2. **Metrics Aggregation** - `0 0 * * *` (Midnight UTC daily)
   - Aggregates usage statistics
   - Updates usage_metrics table

3. **Cleanup Operations** - `0 2 * * 0` (2 AM UTC on Sundays)
   - Removes old images based on retention policy
   - Creates D1 backups before cleanup
   - Manages backup retention

### Testing Scheduled Workers Locally

```bash
# Trigger a specific cron manually
wrangler dev --test-scheduled

# In another terminal, trigger the scheduled event
curl "http://localhost:8787/__scheduled?cron=0+6+*+*+*"
```

## Configuration Reference

### Environment Variables

| Variable | Description | Default (Dev) | Staging | Production |
|----------|-------------|---------------|---------|------------|
| `ENVIRONMENT` | Environment name | development | staging | production |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost:* | staging domain | production domain |
| `RATE_LIMIT_ANONYMOUS` | Requests/hour for anonymous users | 5 | 10 | 5 |
| `RATE_LIMIT_AUTHENTICATED` | Requests/hour for authenticated users | 20 | 30 | 20 |
| `IMAGE_RETENTION_DAYS` | Days to keep images | 90 | 60 | 90 |
| `BACKUP_RETENTION_DAYS` | Days to keep backups | 30 | 30 | 30 |
| `ENABLE_CONTENT_MODERATION` | Enable content safety checks | false | true | true |

### Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `AI` | Workers AI | Access to flux-2-dev model |
| `R2_BUCKET` | R2 Bucket | Image storage |
| `DB` | D1 Database | Metadata storage |
| `KV_CACHE` | KV Namespace | Caching layer |
| `RATE_LIMITER` | Durable Object | Rate limiting coordination |

### Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `JWT_SECRET` | Optional* | JWT token signing (if auth enabled) |
| `ADMIN_API_KEY` | Yes | Admin endpoint authentication |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile CAPTCHA |

*Required if authentication features are enabled

## Troubleshooting

### Common Issues

1. **"Database not found" error**
   - Ensure D1 database is created and ID is updated in wrangler.toml
   - Run migrations: `wrangler d1 migrations apply <database-name> --env <env>`

2. **"KV namespace not found" error**
   - Create KV namespace and update ID in wrangler.toml
   - Verify binding name matches code (KV_CACHE)

3. **"R2 bucket not found" error**
   - Create R2 bucket with exact name from wrangler.toml
   - Check bucket name matches environment configuration

4. **CORS errors in frontend**
   - Update ALLOWED_ORIGINS in wrangler.toml
   - Redeploy worker after changes

5. **Scheduled workers not running**
   - Verify cron syntax in triggers section
   - Check Cloudflare dashboard for scheduled worker logs
   - Note: Scheduled workers don't run in local dev by default

### Viewing Logs

```bash
# Tail production logs
wrangler tail --env production

# Tail staging logs
wrangler tail --env staging

# Filter for errors only
wrangler tail --env production --status error
```

### Checking Resource Usage

```bash
# View D1 database info
wrangler d1 info bible-image-db-production

# List R2 buckets
wrangler r2 bucket list

# List KV namespaces
wrangler kv:namespace list
```

## Rollback Procedure

If a deployment causes issues:

```bash
# Rollback to previous version (Workers)
wrangler rollback --env production

# Rollback Pages deployment
# Go to Cloudflare Dashboard > Pages > Deployments
# Click "Rollback" on a previous successful deployment
```

## Monitoring

After deployment, monitor:

1. **Cloudflare Dashboard**
   - Workers Analytics
   - R2 usage metrics
   - D1 query statistics

2. **Logs**
   - Use `wrangler tail` for real-time logs
   - Check for errors in scheduled workers

3. **Scheduled Workers**
   - Verify cron jobs are running (check logs at scheduled times)
   - Monitor daily verse generation success

## Next Steps

After completing this setup:

1. Test all endpoints in each environment
2. Verify scheduled workers are running
3. Monitor resource usage and costs
4. Set up alerting for errors and quota limits
5. Document any environment-specific configurations

## Additional Resources

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
