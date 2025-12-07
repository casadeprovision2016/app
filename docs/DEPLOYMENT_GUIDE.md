# Bible Image Generator - Deployment Guide

This comprehensive guide walks you through deploying the Bible Image Generator application to Cloudflare's infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Resource Creation](#resource-creation)
4. [Database Setup](#database-setup)
5. [Worker Deployment](#worker-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Wrangler CLI**: v3.0 or higher
- **Git**: For version control
- **Cloudflare Account**: With Workers, Pages, R2, D1, and KV enabled

### Install Wrangler

```bash
npm install -g wrangler

# Verify installation
wrangler --version
```

### Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication. Once complete, verify:

```bash
wrangler whoami
```

## Environment Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd bible-image-generator
npm install
```

### 2. Choose Your Environment

This application supports three environments:
- **dev**: Local development and testing
- **staging**: Pre-production testing
- **production**: Live production environment

For this guide, we'll use `production` as an example. Adjust commands accordingly for other environments.

## Resource Creation

### Step 1: Create D1 Database

```bash
# Create the database
wrangler d1 create bible-image-db-production

# Output will show:
# ✅ Successfully created DB 'bible-image-db-production'
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "bible-image-db-production"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Action Required**: Copy the `database_id` and update `wrangler.toml`:

```toml
[env.production.d1_databases]
binding = "DB"
database_name = "bible-image-db-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with your ID
```

### Step 2: Create R2 Bucket

```bash
# Create the bucket
wrangler r2 bucket create bible-images-production

# Verify creation
wrangler r2 bucket list
```

The bucket name in `wrangler.toml` should already match:

```toml
[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "bible-images-production"
```

### Step 3: Create KV Namespace

```bash
# Create the namespace
wrangler kv:namespace create KV_CACHE --env production

# Output will show:
# ✅ Successfully created KV namespace
# 
# [[kv_namespaces]]
# binding = "KV_CACHE"
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Action Required**: Copy the `id` and update `wrangler.toml`:

```toml
[[env.production.kv_namespaces]]
binding = "KV_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Replace with your ID
```

### Step 4: Configure Secrets

Generate secure secrets:

```bash
# Generate random secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ADMIN_API_KEY
```

Set the secrets:

```bash
# Set JWT secret
wrangler secret put JWT_SECRET --env production
# Paste the generated secret when prompted

# Set admin API key
wrangler secret put ADMIN_API_KEY --env production
# Paste the generated secret when prompted

# Optional: Set Turnstile secret (if using CAPTCHA)
wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Verify secrets are set:

```bash
wrangler secret list --env production
```

### Step 5: Update Environment Variables

Edit `wrangler.toml` and update the production environment variables:

```toml
[env.production]
vars = {
  ENVIRONMENT = "production",
  ALLOWED_ORIGINS = "https://yourdomain.com,https://www.yourdomain.com",  # Update with your domain
  RATE_LIMIT_ANONYMOUS = "5",
  RATE_LIMIT_AUTHENTICATED = "20",
  IMAGE_RETENTION_DAYS = "90",
  BACKUP_RETENTION_DAYS = "30",
  ENABLE_CONTENT_MODERATION = "true"
}
```

## Database Setup

### Step 1: Apply Migrations

Apply migrations to create the database schema:

```bash
# Apply to production database
wrangler d1 migrations apply bible-image-db-production --env production
```

You'll see output like:

```
Migrations to be applied:
┌────────────────────────────────────┐
│ Name                               │
├────────────────────────────────────┤
│ 0001_create_initial_schema.sql     │
│ 0002_seed_verses.sql               │
└────────────────────────────────────┘

? Ok to apply 2 migration(s)? › (y/N)
```

Type `y` and press Enter.

### Step 2: Verify Database Setup

```bash
# Check that verses were seeded
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT COUNT(*) as count FROM verses;"

# Should return: count = 30
```

### Step 3: Verify Tables

```bash
# List all tables
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table';"

# Should show: images, verses, users, moderation_queue, usage_metrics
```

## Worker Deployment

### Step 1: Run Pre-Deployment Checks

```bash
# Run tests
npm test

# Type check
npm run check

# Build
npm run build
```

All checks should pass before proceeding.

### Step 2: Deploy Worker

```bash
# Deploy to production
wrangler deploy --env production
```

You'll see output like:

```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded bible-image-generator-production (X.XX sec)
Published bible-image-generator-production (X.XX sec)
  https://bible-image-generator-production.your-account.workers.dev
```

**Important**: Save the Worker URL for later use.

### Step 3: Verify Worker Deployment

```bash
# Test the daily verse endpoint
curl https://bible-image-generator-production.your-account.workers.dev/api/daily-verse

# Should return JSON with verse data
```

### Step 4: Monitor Worker Logs

In a separate terminal, monitor logs:

```bash
wrangler tail --env production
```

## Frontend Deployment

### Option A: Deploy via Wrangler (Recommended)

#### Step 1: Build Frontend

```bash
npm run build:frontend
```

Verify the build output exists:

```bash
ls -la dist/frontend/
```

#### Step 2: Create Pages Project (First Time Only)

```bash
# Create the project
wrangler pages project create bible-image-generator-frontend
```

#### Step 3: Deploy to Pages

```bash
# Deploy to production
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=main
```

You'll see output like:

```
✨ Success! Uploaded X files (X.XX sec)
✨ Deployment complete! Take a peek over at https://xxxxxxxx.bible-image-generator-frontend.pages.dev
```

#### Step 4: Configure Environment Variables

Set environment variables in the Cloudflare dashboard:

1. Go to **Pages** → **bible-image-generator-frontend** → **Settings** → **Environment variables**

2. Add production variables:
   - `VITE_API_URL`: `https://bible-image-generator-production.your-account.workers.dev`
   - `VITE_ENVIRONMENT`: `production`

3. Add preview variables (for preview deployments):
   - `VITE_API_URL`: `https://bible-image-generator-staging.your-account.workers.dev`
   - `VITE_ENVIRONMENT`: `preview`

4. Click **Save**

#### Step 5: Redeploy with Environment Variables

```bash
# Redeploy to pick up environment variables
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=main
```

### Option B: Deploy via Git Integration

#### Step 1: Connect Repository

1. Go to **Cloudflare Dashboard** → **Pages**
2. Click **Create a project**
3. Connect your Git provider (GitHub/GitLab)
4. Select your repository
5. Configure build settings:
   - **Build command**: `npm run build:frontend`
   - **Build output directory**: `dist/frontend`
   - **Root directory**: `/` (leave empty)

#### Step 2: Configure Environment Variables

Same as Option A, Step 4.

#### Step 3: Deploy

Push to your main branch, and Pages will automatically build and deploy.

### Step 6: Configure Custom Domain (Optional)

1. Go to **Pages** → **bible-image-generator-frontend** → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `bible.yourdomain.com`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (usually < 5 minutes)

## Post-Deployment Verification

### 1. Test Worker Endpoints

```bash
# Test daily verse
curl https://bible-image-generator-production.your-account.workers.dev/api/daily-verse

# Test image generation (requires valid request)
curl -X POST https://bible-image-generator-production.your-account.workers.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'
```

### 2. Test Frontend

1. Open your Pages URL in a browser
2. Verify the homepage loads
3. Check that the daily verse displays
4. Test image generation:
   - Enter a verse reference (e.g., "John 3:16")
   - Select a style preset
   - Click generate
   - Verify image displays
5. Test WhatsApp share button
6. Test on mobile device

### 3. Verify Scheduled Workers

Scheduled workers run automatically. To verify:

```bash
# Check logs at scheduled times
wrangler tail --env production

# Or manually trigger (for testing)
# Note: This requires using the Cloudflare dashboard
```

### 4. Check Resource Usage

Monitor usage in the Cloudflare dashboard:

1. **Workers** → **bible-image-generator-production** → **Metrics**
   - Request count
   - Error rate
   - CPU time

2. **R2** → **bible-images-production** → **Metrics**
   - Storage usage
   - Request count

3. **D1** → **bible-image-db-production** → **Metrics**
   - Query count
   - Storage usage

### 5. Test Rate Limiting

```bash
# Make multiple rapid requests to test rate limiting
for i in {1..10}; do
  curl -X POST https://bible-image-generator-production.your-account.workers.dev/api/generate \
    -H "Content-Type: application/json" \
    -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'
  echo ""
done

# Should see 429 responses after hitting the limit
```

## Troubleshooting

### Worker Not Responding

**Symptoms**: 502/503 errors or timeouts

**Solutions**:
1. Check deployment status in dashboard
2. Verify all resource bindings are correct in `wrangler.toml`
3. Check error logs: `wrangler tail --env production`
4. Verify secrets are set: `wrangler secret list --env production`

### Frontend Not Loading

**Symptoms**: Blank page or 404 errors

**Solutions**:
1. Verify build output exists: `ls dist/frontend/`
2. Check environment variables in Pages dashboard
3. Verify API URL is correct
4. Check browser console for errors
5. Verify Pages deployment succeeded in dashboard

### CORS Errors

**Symptoms**: "Access-Control-Allow-Origin" errors in browser console

**Solutions**:
1. Verify `ALLOWED_ORIGINS` in `wrangler.toml` includes your Pages URL
2. Redeploy Worker after updating origins
3. Check that Worker is returning CORS headers
4. Consider using Pages Functions as a proxy (see Advanced Configuration)

### Database Errors

**Symptoms**: "D1_ERROR" or "database not found" errors

**Solutions**:
1. Verify database ID in `wrangler.toml` is correct
2. Check migrations were applied: `wrangler d1 migrations list bible-image-db-production --env production`
3. Verify database exists: `wrangler d1 list`
4. Check database permissions

### Rate Limiting Too Strict

**Symptoms**: Users getting 429 errors too frequently

**Solutions**:
1. Adjust rate limits in `wrangler.toml`
2. Redeploy Worker
3. If needed, reset Durable Object state (see Rollback Procedures)

### Images Not Loading

**Symptoms**: Broken image links or 404 errors

**Solutions**:
1. Verify R2 bucket name in `wrangler.toml`
2. Check R2 bucket exists: `wrangler r2 bucket list`
3. Verify images are being stored: Check R2 dashboard
4. Check image URLs are correctly formatted
5. Verify R2 bucket is accessible (public or signed URLs working)

### Scheduled Workers Not Running

**Symptoms**: Daily verse not updating, cleanup not running

**Solutions**:
1. Verify cron triggers in `wrangler.toml`
2. Check Worker logs at scheduled times
3. Verify scheduled workers are enabled in dashboard
4. Test scheduled worker logic manually (see Testing Guide)

## Next Steps

After successful deployment:

1. **Set up monitoring**: Configure alerts for errors and usage
2. **Test thoroughly**: Run through all user flows
3. **Document URLs**: Save Worker and Pages URLs
4. **Set up backups**: Verify automated backups are running
5. **Monitor costs**: Track usage to stay within budget
6. **Plan scaling**: Review rate limits and quotas

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [R2 Storage Documentation](https://developers.cloudflare.com/r2/)

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Cloudflare documentation
3. Check Worker logs: `wrangler tail --env production`
4. Join [Cloudflare Discord](https://discord.gg/cloudflaredev)
5. Open an issue in the project repository
