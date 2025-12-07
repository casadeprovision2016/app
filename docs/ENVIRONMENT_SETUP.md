# Environment Setup Guide

This guide covers setting up and configuring different environments for the Bible Image Generator application.

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Local Development Setup](#local-development-setup)
3. [Development Environment](#development-environment)
4. [Staging Environment](#staging-environment)
5. [Production Environment](#production-environment)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Secrets Management](#secrets-management)

## Environment Overview

The application supports four environments:

| Environment | Purpose | URL Pattern | Auto-Deploy |
|-------------|---------|-------------|-------------|
| **Local** | Development on your machine | localhost:8787 | No |
| **Dev** | Shared development testing | *.workers.dev | Manual |
| **Staging** | Pre-production testing | staging.yourdomain.com | Optional |
| **Production** | Live user-facing | yourdomain.com | Manual |

## Local Development Setup

### Prerequisites

```bash
# Install Node.js (v18+)
node --version

# Install Wrangler
npm install -g wrangler

# Verify installation
wrangler --version
```

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd bible-image-generator
npm install
```

### Step 2: Configure Local Environment

Create a `.dev.vars` file for local secrets:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
# Local development secrets
JWT_SECRET=local-dev-secret-change-me
ADMIN_API_KEY=local-admin-key-change-me
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Step 3: Set Up Local Database

```bash
# Apply migrations
wrangler d1 migrations apply bible-image-db --local

# Verify setup
wrangler d1 execute bible-image-db --local \
  --command "SELECT COUNT(*) FROM verses;"
```

### Step 4: Start Development Server

```bash
# Start Worker
npm run dev

# In another terminal, start frontend
npm run dev:frontend
```

Access:
- Worker: http://localhost:8787
- Frontend: http://localhost:5173

### Step 5: Test Local Setup

```bash
# Test daily verse endpoint
curl http://localhost:8787/api/daily-verse

# Test image generation (will use Workers AI)
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'
```

## Development Environment

The dev environment is for shared development testing.

### Step 1: Create Resources

```bash
# Run setup script
./scripts/setup-resources.sh dev
```

This will guide you through:
1. Creating D1 database
2. Creating R2 bucket
3. Creating KV namespace
4. Setting up secrets

### Step 2: Update wrangler.toml

The default configuration uses `dev` environment. Verify settings:

```toml
name = "bible-image-generator"
# ... other settings ...

[vars]
ENVIRONMENT = "development"
ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:5173"
RATE_LIMIT_ANONYMOUS = "5"
RATE_LIMIT_AUTHENTICATED = "20"
```

### Step 3: Apply Migrations

```bash
./scripts/migrate-database.sh apply dev
```

### Step 4: Deploy

```bash
# Deploy Worker
wrangler deploy

# Deploy Frontend
npm run build:frontend
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=dev
```

### Step 5: Configure Frontend Environment

In Cloudflare Pages dashboard:
1. Go to Settings → Environment variables
2. Add for Preview environment:
   - `VITE_API_URL`: Your Worker URL
   - `VITE_ENVIRONMENT`: `development`

## Staging Environment

Staging mirrors production for final testing.

### Step 1: Create Resources

```bash
./scripts/setup-resources.sh staging
```

### Step 2: Update wrangler.toml

Update the staging environment section:

```toml
[env.staging]
name = "bible-image-generator-staging"
vars = {
  ENVIRONMENT = "staging",
  ALLOWED_ORIGINS = "https://staging.yourdomain.com",
  RATE_LIMIT_ANONYMOUS = "10",
  RATE_LIMIT_AUTHENTICATED = "30",
  IMAGE_RETENTION_DAYS = "60",
  BACKUP_RETENTION_DAYS = "30",
  ENABLE_CONTENT_MODERATION = "true"
}

[[env.staging.d1_databases]]
binding = "DB"
database_name = "bible-image-db-staging"
database_id = "your-staging-db-id"  # Update this

[[env.staging.kv_namespaces]]
binding = "KV_CACHE"
id = "your-staging-kv-id"  # Update this
```

### Step 3: Set Secrets

```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ADMIN_API_KEY

# Set secrets
wrangler secret put JWT_SECRET --env staging
wrangler secret put ADMIN_API_KEY --env staging
wrangler secret put TURNSTILE_SECRET_KEY --env staging
```

### Step 4: Apply Migrations

```bash
./scripts/migrate-database.sh apply staging
```

### Step 5: Deploy

```bash
# Deploy Worker
wrangler deploy --env staging

# Deploy Frontend
npm run build:frontend
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=staging
```

### Step 6: Configure Custom Domain (Optional)

1. Go to Pages → Custom domains
2. Add `staging.yourdomain.com`
3. Update DNS:
   ```
   CNAME staging bible-image-generator-frontend.pages.dev
   ```

## Production Environment

Production is the live environment serving real users.

### Step 1: Create Resources

```bash
./scripts/setup-resources.sh production
```

### Step 2: Update wrangler.toml

Update the production environment section:

```toml
[env.production]
name = "bible-image-generator-production"
vars = {
  ENVIRONMENT = "production",
  ALLOWED_ORIGINS = "https://yourdomain.com,https://www.yourdomain.com",
  RATE_LIMIT_ANONYMOUS = "5",
  RATE_LIMIT_AUTHENTICATED = "20",
  IMAGE_RETENTION_DAYS = "90",
  BACKUP_RETENTION_DAYS = "30",
  ENABLE_CONTENT_MODERATION = "true"
}

[[env.production.d1_databases]]
binding = "DB"
database_name = "bible-image-db-production"
database_id = "your-production-db-id"  # Update this

[[env.production.kv_namespaces]]
binding = "KV_CACHE"
id = "your-production-kv-id"  # Update this
```

### Step 3: Set Secrets

```bash
# Generate STRONG secrets for production
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ADMIN_API_KEY

# Set secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put ADMIN_API_KEY --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
```

**Important**: Store these secrets securely (password manager, secrets vault, etc.)

### Step 4: Apply Migrations

```bash
./scripts/migrate-database.sh apply production
```

### Step 5: Deploy

```bash
# Run full test suite first
npm test
npm run check

# Deploy Worker
wrangler deploy --env production

# Deploy Frontend
npm run build:frontend
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=main
```

### Step 6: Configure Custom Domain

1. Go to Pages → Custom domains
2. Add `yourdomain.com` and `www.yourdomain.com`
3. Update DNS:
   ```
   CNAME @ bible-image-generator-frontend.pages.dev
   CNAME www bible-image-generator-frontend.pages.dev
   ```

### Step 7: Enable Monitoring

1. Go to Workers → Analytics
2. Enable detailed metrics
3. Set up alerts for:
   - Error rate > 5%
   - Latency > 30s
   - Rate limit rejections > 100/hour

## Environment Variables Reference

### Worker Environment Variables

| Variable | Type | Description | Default |
|----------|------|-------------|---------|
| `ENVIRONMENT` | string | Environment name | `development` |
| `ALLOWED_ORIGINS` | string | Comma-separated CORS origins | `http://localhost:3000` |
| `RATE_LIMIT_ANONYMOUS` | number | Requests per hour for anonymous users | `5` |
| `RATE_LIMIT_AUTHENTICATED` | number | Requests per hour for authenticated users | `20` |
| `IMAGE_RETENTION_DAYS` | number | Days to keep images before cleanup | `90` |
| `BACKUP_RETENTION_DAYS` | number | Days to keep backups | `30` |
| `ENABLE_CONTENT_MODERATION` | boolean | Enable content moderation | `false` |

### Frontend Environment Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `VITE_API_URL` | string | Worker API URL | `https://api.yourdomain.com` |
| `VITE_ENVIRONMENT` | string | Environment name | `production` |
| `VITE_TURNSTILE_SITE_KEY` | string | Turnstile site key (optional) | `0x4AAA...` |

### Setting Frontend Variables

**Local Development** (`.env.local`):
```env
VITE_API_URL=http://localhost:8787
VITE_ENVIRONMENT=development
```

**Pages Dashboard**:
1. Go to Pages → Settings → Environment variables
2. Add variables for Production and Preview separately
3. Redeploy to apply changes

## Secrets Management

### What are Secrets?

Secrets are sensitive values that should never be committed to version control:
- API keys
- JWT signing keys
- Admin passwords
- Third-party service credentials

### Setting Secrets

```bash
# Set a secret
wrangler secret put SECRET_NAME --env production

# List secrets (shows names only, not values)
wrangler secret list --env production

# Delete a secret
wrangler secret delete SECRET_NAME --env production
```

### Required Secrets

| Secret | Purpose | How to Generate |
|--------|---------|-----------------|
| `JWT_SECRET` | Sign JWT tokens | `openssl rand -base64 32` |
| `ADMIN_API_KEY` | Authenticate admin endpoints | `openssl rand -base64 32` |
| `TURNSTILE_SECRET_KEY` | Verify CAPTCHA (optional) | From Cloudflare dashboard |

### Secret Rotation

Rotate secrets periodically (every 90 days recommended):

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update in Wrangler
echo $NEW_SECRET | wrangler secret put JWT_SECRET --env production

# 3. Update in your password manager

# 4. Test the application

# 5. Document the rotation date
```

### Local Development Secrets

For local development, use `.dev.vars`:

```env
# .dev.vars (DO NOT COMMIT)
JWT_SECRET=local-dev-secret
ADMIN_API_KEY=local-admin-key
```

Add to `.gitignore`:
```
.dev.vars
```

## Environment Comparison

### Resource Naming Convention

| Resource | Local | Dev | Staging | Production |
|----------|-------|-----|---------|------------|
| Worker | bible-image-generator | bible-image-generator | bible-image-generator-staging | bible-image-generator-production |
| D1 Database | bible-image-db | bible-image-db-dev | bible-image-db-staging | bible-image-db-production |
| R2 Bucket | bible-images-dev | bible-images-dev | bible-images-staging | bible-images-production |
| KV Namespace | KV_CACHE | KV_CACHE | KV_CACHE | KV_CACHE |

### Configuration Differences

| Setting | Local | Dev | Staging | Production |
|---------|-------|-----|---------|------------|
| Rate Limits | Disabled | Low | Medium | Strict |
| Content Moderation | Disabled | Disabled | Enabled | Enabled |
| Logging Level | Debug | Info | Info | Warn |
| Cache TTL | Short | Short | Medium | Long |
| Backup Frequency | Manual | Daily | Daily | Daily |

## Troubleshooting

### Environment Not Found

```bash
# Error: Environment "staging" not found
# Solution: Check wrangler.toml has [env.staging] section
```

### Wrong Database

```bash
# Error: Database not found
# Solution: Verify database_id in wrangler.toml matches created database
wrangler d1 list
```

### Secrets Not Working

```bash
# Error: JWT_SECRET is undefined
# Solution: Verify secret is set
wrangler secret list --env production

# If missing, set it
wrangler secret put JWT_SECRET --env production
```

### CORS Errors

```bash
# Error: CORS policy blocked
# Solution: Update ALLOWED_ORIGINS in wrangler.toml
# Include your Pages URL
```

## Best Practices

1. **Never commit secrets** to version control
2. **Use strong secrets** in production (32+ characters)
3. **Rotate secrets** regularly (every 90 days)
4. **Test in staging** before deploying to production
5. **Document changes** to environment configuration
6. **Monitor all environments** for errors and performance
7. **Keep environments in sync** (same code, different config)
8. **Use environment-specific domains** for clarity
9. **Backup before changes** to production
10. **Have a rollback plan** ready

## Checklist

Use this checklist when setting up a new environment:

- [ ] Resources created (D1, R2, KV)
- [ ] Resource IDs updated in wrangler.toml
- [ ] Secrets generated and set
- [ ] Environment variables configured
- [ ] Migrations applied
- [ ] Worker deployed
- [ ] Frontend deployed
- [ ] Custom domain configured (if applicable)
- [ ] CORS origins updated
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Documentation updated
- [ ] Team notified

## Additional Resources

- [Cloudflare Workers Environments](https://developers.cloudflare.com/workers/platform/environments/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Secrets Management](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
