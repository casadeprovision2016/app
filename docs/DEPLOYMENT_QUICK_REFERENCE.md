# Deployment Quick Reference

Quick commands for common deployment tasks. For detailed guides, see the full documentation.

## Quick Links

- **Full Guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Rollback**: [ROLLBACK_PROCEDURES.md](ROLLBACK_PROCEDURES.md)
- **Environment Setup**: [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
- **Secrets**: [SECRETS_CONFIGURATION.md](SECRETS_CONFIGURATION.md)
- **Migrations**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)

## Common Commands

### Initial Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create resources
./scripts/setup-resources.sh production

# Set secrets
openssl rand -base64 32 | wrangler secret put JWT_SECRET --env production
openssl rand -base64 32 | wrangler secret put ADMIN_API_KEY --env production
```

### Database Operations

```bash
# Apply migrations locally
./scripts/migrate-database.sh apply local

# Apply migrations to production
./scripts/migrate-database.sh apply production

# Create backup
./scripts/migrate-database.sh backup production

# Verify database
./scripts/migrate-database.sh verify production

# Create new migration
./scripts/migrate-database.sh create add_new_feature
```

### Deployment

```bash
# Deploy to development
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (with confirmation)
./scripts/deploy.sh production

# Deploy only Worker
./scripts/deploy.sh production --worker-only

# Deploy only Frontend
./scripts/deploy.sh production --frontend-only

# Deploy without tests (not recommended)
./scripts/deploy.sh staging --skip-tests
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run check

# Build Worker
npm run build

# Build Frontend
npm run build:frontend
```

### Monitoring

```bash
# Tail Worker logs (dev)
wrangler tail

# Tail Worker logs (production)
wrangler tail --env production

# List deployments
wrangler deployments list --env production

# List secrets
wrangler secret list --env production
```

### Verification

```bash
# Test daily verse endpoint
curl https://your-worker-url.workers.dev/api/daily-verse

# Test image generation
curl -X POST https://your-worker-url.workers.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'

# Check database
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT COUNT(*) FROM verses;"
```

### Rollback

```bash
# Rollback Worker (via dashboard)
# Workers → Deployments → Rollback

# Rollback Pages (via dashboard)
# Pages → Deployments → Rollback

# Rollback Database
./scripts/migrate-database.sh restore production backups/backup-file.sql
```

## Environment-Specific Commands

### Local Development

```bash
# Start Worker dev server
npm run dev

# Start Frontend dev server
npm run dev:frontend

# Apply migrations locally
wrangler d1 migrations apply bible-image-db --local

# Query local database
wrangler d1 execute bible-image-db --local \
  --command "SELECT * FROM verses LIMIT 5;"
```

### Development Environment

```bash
# Deploy
wrangler deploy

# Apply migrations
./scripts/migrate-database.sh apply dev

# Monitor logs
wrangler tail
```

### Staging Environment

```bash
# Deploy
wrangler deploy --env staging

# Apply migrations
./scripts/migrate-database.sh apply staging

# Monitor logs
wrangler tail --env staging

# Set secrets
wrangler secret put JWT_SECRET --env staging
```

### Production Environment

```bash
# Deploy (with confirmation)
wrangler deploy --env production

# Apply migrations (with backup)
./scripts/migrate-database.sh apply production

# Monitor logs
wrangler tail --env production

# Set secrets
wrangler secret put JWT_SECRET --env production

# Create backup
./scripts/migrate-database.sh backup production
```

## Resource Management

### D1 Database

```bash
# Create database
wrangler d1 create bible-image-db-production

# List databases
wrangler d1 list

# Execute query
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT COUNT(*) FROM images;"

# Export database
wrangler d1 export bible-image-db-production --env production \
  --output backup.sql
```

### R2 Storage

```bash
# Create bucket
wrangler r2 bucket create bible-images-production

# List buckets
wrangler r2 bucket list

# List objects
wrangler r2 object list bible-images-production

# Upload object
wrangler r2 object put bible-images-production/test.txt \
  --file test.txt

# Download object
wrangler r2 object get bible-images-production/test.txt \
  --file downloaded.txt
```

### KV Namespace

```bash
# Create namespace
wrangler kv:namespace create KV_CACHE --env production

# List namespaces
wrangler kv:namespace list

# Put key
wrangler kv:key put "test-key" "test-value" \
  --namespace-id=your-namespace-id

# Get key
wrangler kv:key get "test-key" \
  --namespace-id=your-namespace-id

# Delete key
wrangler kv:key delete "test-key" \
  --namespace-id=your-namespace-id
```

### Secrets

```bash
# Generate secret
openssl rand -base64 32

# Set secret
wrangler secret put SECRET_NAME --env production

# List secrets (names only)
wrangler secret list --env production

# Delete secret
wrangler secret delete SECRET_NAME --env production
```

## Troubleshooting Commands

### Check Status

```bash
# Check Wrangler version
wrangler --version

# Check login status
wrangler whoami

# Check Node version
node --version

# Check npm version
npm --version
```

### Debug Issues

```bash
# View detailed logs
wrangler tail --env production --format pretty

# Check deployment status
wrangler deployments list --env production

# Verify resource bindings
cat wrangler.toml | grep -A 5 "env.production"

# Check build output
npm run build 2>&1 | tee build.log
```

### Fix Common Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Wrangler cache
rm -rf ~/.wrangler

# Reset local database
rm -rf .wrangler/state/v3/d1
wrangler d1 migrations apply bible-image-db --local

# Rebuild frontend
rm -rf dist/frontend
npm run build:frontend
```

## Emergency Procedures

### Critical Bug in Production

```bash
# 1. Immediately rollback Worker (via dashboard)
# Workers → Deployments → Rollback

# 2. Monitor logs
wrangler tail --env production

# 3. Verify rollback worked
curl https://your-worker-url.workers.dev/api/daily-verse

# 4. Fix bug locally
# 5. Test thoroughly
npm test

# 6. Deploy fix
./scripts/deploy.sh production
```

### Database Corruption

```bash
# 1. Stop accepting writes (if possible)

# 2. Create emergency backup
./scripts/migrate-database.sh backup production

# 3. Restore from last good backup
./scripts/migrate-database.sh restore production backups/backup-file.sql

# 4. Verify restoration
./scripts/migrate-database.sh verify production

# 5. Resume operations
```

### Secret Exposure

```bash
# 1. Immediately rotate the exposed secret
openssl rand -base64 32 | wrangler secret put SECRET_NAME --env production

# 2. Check logs for unauthorized access
wrangler tail --env production

# 3. Review how it was exposed

# 4. Implement preventive measures

# 5. Document the incident
```

## Useful Aliases

Add these to your `.bashrc` or `.zshrc`:

```bash
# Deployment aliases
alias deploy-dev='./scripts/deploy.sh dev'
alias deploy-staging='./scripts/deploy.sh staging'
alias deploy-prod='./scripts/deploy.sh production'

# Migration aliases
alias migrate-local='./scripts/migrate-database.sh apply local'
alias migrate-prod='./scripts/migrate-database.sh apply production'
alias backup-prod='./scripts/migrate-database.sh backup production'

# Monitoring aliases
alias logs-dev='wrangler tail'
alias logs-prod='wrangler tail --env production'

# Testing aliases
alias test-watch='npm run test:watch'
alias test-all='npm test && npm run check'
```

## Checklists

### Pre-Deployment Checklist

```bash
# Run these before deploying to production
npm test                    # All tests pass
npm run check              # Type check passes
npm run build              # Build succeeds
npm run build:frontend     # Frontend builds
./scripts/migrate-database.sh backup production  # Backup created
```

### Post-Deployment Checklist

```bash
# Verify these after deploying to production
curl https://your-worker-url.workers.dev/api/daily-verse  # Worker responds
# Visit frontend URL                                        # Frontend loads
wrangler tail --env production                             # Monitor logs
# Test image generation                                     # Core feature works
# Check dashboard metrics                                   # No error spike
```

## Getting Help

- **Documentation**: Check `docs/` directory
- **Logs**: `wrangler tail --env production`
- **Dashboard**: https://dash.cloudflare.com
- **Community**: https://discord.gg/cloudflaredev
- **Support**: https://support.cloudflare.com

## Notes

- Always test in staging before production
- Always backup before production changes
- Always monitor after deployment
- Keep secrets secure
- Document all changes
