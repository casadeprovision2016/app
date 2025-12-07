# Deployment Checklist

Use this comprehensive checklist to ensure all components are properly configured before deployment.

## Quick Reference

- **Deployment Guide**: See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- **Rollback Procedures**: See [docs/ROLLBACK_PROCEDURES.md](docs/ROLLBACK_PROCEDURES.md)
- **Environment Setup**: See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md)
- **Secrets Configuration**: See [docs/SECRETS_CONFIGURATION.md](docs/SECRETS_CONFIGURATION.md)

## Pre-Deployment

### 1. Cloudflare Resources Created
- [ ] D1 Database created for environment
  ```bash
  wrangler d1 create bible-image-db-production
  ```
- [ ] R2 Bucket created for environment
  ```bash
  wrangler r2 bucket create bible-images-production
  ```
- [ ] KV Namespace created for environment
  ```bash
  wrangler kv:namespace create KV_CACHE --env production
  ```
- [ ] Resource IDs updated in `wrangler.toml`
- [ ] Durable Objects configured in `wrangler.toml`

### 2. Database Setup
- [ ] Migrations applied to local database
  ```bash
  ./scripts/migrate-database.sh apply local
  ```
- [ ] Migrations tested locally
- [ ] Migrations applied to staging (if applicable)
  ```bash
  ./scripts/migrate-database.sh apply staging
  ```
- [ ] Migrations applied to production database
  ```bash
  ./scripts/migrate-database.sh apply production
  ```
- [ ] Verses seeded in database (30 verses expected)
- [ ] Database schema verified
  ```bash
  ./scripts/migrate-database.sh verify production
  ```

### 3. Secrets Configuration
- [ ] JWT_SECRET generated and set
  ```bash
  openssl rand -base64 32 | wrangler secret put JWT_SECRET --env production
  ```
- [ ] ADMIN_API_KEY generated and set
  ```bash
  openssl rand -base64 32 | wrangler secret put ADMIN_API_KEY --env production
  ```
- [ ] TURNSTILE_SECRET_KEY set (if using CAPTCHA)
  ```bash
  wrangler secret put TURNSTILE_SECRET_KEY --env production
  ```
- [ ] Secrets verified
  ```bash
  wrangler secret list --env production
  ```
- [ ] Secrets stored in password manager

### 4. Environment Variables
- [ ] `wrangler.toml` configured with correct values
- [ ] ALLOWED_ORIGINS updated with production domains
- [ ] Rate limits configured appropriately
- [ ] Retention policies set
- [ ] Content moderation enabled (for production)
- [ ] Scheduled workers configured (cron triggers)

### 5. Frontend Configuration
- [ ] `frontend/.env.local` created for local development
- [ ] Environment variables configured in Pages dashboard:
  - [ ] `VITE_API_URL` (production) - Worker URL
  - [ ] `VITE_API_URL` (preview) - Staging Worker URL
  - [ ] `VITE_ENVIRONMENT` (production) - "production"
  - [ ] `VITE_ENVIRONMENT` (preview) - "preview"
  - [ ] `VITE_TURNSTILE_SITE_KEY` (if using CAPTCHA)

### 6. Build Verification
- [ ] Worker builds successfully
  ```bash
  npm run build
  ```
- [ ] Frontend builds successfully
  ```bash
  npm run build:frontend
  ```
- [ ] All tests pass
  ```bash
  npm test
  ```
- [ ] Type checking passes
  ```bash
  npm run check
  ```
- [ ] No TypeScript errors
- [ ] No linting errors

## Worker Deployment

### 1. Pre-Deployment Backup
- [ ] Create database backup
  ```bash
  ./scripts/migrate-database.sh backup production
  ```
- [ ] Backup stored securely
- [ ] Backup uploaded to R2 (automatic)

### 2. Deploy Worker
- [ ] Deploy to production
  ```bash
  wrangler deploy --env production
  ```
- [ ] Deployment successful
- [ ] Worker URL noted: `_______________________________`
- [ ] Deployment ID recorded for potential rollback

### 3. Verify Worker Deployment
- [ ] Daily verse endpoint responds
  ```bash
  curl https://your-worker-url.workers.dev/api/daily-verse
  ```
- [ ] Image generation works
  ```bash
  curl -X POST https://your-worker-url.workers.dev/api/generate \
    -H "Content-Type: application/json" \
    -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'
  ```
- [ ] Rate limiting enforced (test with multiple rapid requests)
- [ ] Error handling works (test with invalid input)
- [ ] CORS headers present

### 4. Verify Scheduled Workers
- [ ] Cron triggers configured in `wrangler.toml`
  - [ ] Daily verse generation (0 6 * * *)
  - [ ] Metrics aggregation (0 0 * * *)
  - [ ] Weekly cleanup (0 2 * * 0)
- [ ] Scheduled workers visible in dashboard
- [ ] Monitor logs at scheduled times
  ```bash
  wrangler tail --env production
  ```

### 5. Monitor Worker
- [ ] Check Worker logs for errors
- [ ] Verify metrics are being recorded
- [ ] Check CPU time usage
- [ ] Monitor request count

## Pages Deployment

### 1. Initial Setup
- [ ] Pages project created in Cloudflare dashboard
- [ ] Project name: `bible-image-generator-frontend`
- [ ] Git repository connected (if using Git integration)

### 2. Build Configuration
- [ ] Build command: `npm run build:frontend`
- [ ] Build output directory: `dist/frontend`
- [ ] Root directory: `/` (or empty)

### 3. Environment Variables
Set in Pages dashboard (Settings → Environment variables):

**Production:**
- [ ] `VITE_API_URL` = `https://bible-image-generator.your-domain.workers.dev`
- [ ] `VITE_ENVIRONMENT` = `production`

**Preview:**
- [ ] `VITE_API_URL` = `https://bible-image-generator-preview.your-domain.workers.dev`
- [ ] `VITE_ENVIRONMENT` = `preview`

### 4. Deploy Pages
```bash
npm run deploy:pages
```

- [ ] Deployment successful
- [ ] Pages URL noted: `_______________________________`

### 5. Verify Pages
- [ ] Homepage loads correctly
- [ ] Daily verse displays
- [ ] Image generation form works
- [ ] WhatsApp share works
- [ ] Mobile responsive layout works
- [ ] Static assets cached properly (check DevTools Network tab)

## Post-Deployment

### 1. Custom Domain (Optional)
- [ ] Custom domain added in Pages dashboard
- [ ] DNS configured (CNAME record)
- [ ] SSL certificate provisioned
- [ ] Domain accessible via HTTPS

### 2. CORS Configuration
- [ ] Worker CORS headers allow Pages origin
- [ ] Or Pages Functions proxy configured
- [ ] Cross-origin requests work from frontend

### 3. Monitoring Setup
- [ ] Cloudflare Analytics enabled
- [ ] Error logging verified
- [ ] Rate limit events logged
- [ ] Usage metrics tracked

### 4. Testing
- [ ] End-to-end generation flow works
- [ ] Rate limiting enforces limits
- [ ] Error handling works correctly
- [ ] Share links work on mobile
- [ ] Images load from R2
- [ ] Metadata retrieved from D1

### 5. Performance
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Static assets cached (check Cache-Control headers)
- [ ] Images optimized (WebP format)

## Rollback Plan

**See [docs/ROLLBACK_PROCEDURES.md](docs/ROLLBACK_PROCEDURES.md) for detailed procedures.**

### Quick Rollback Steps

#### Worker Rollback (30 seconds)
1. Go to Cloudflare Dashboard → Workers → Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"
4. Verify functionality

#### Pages Rollback (1 minute)
1. Go to Cloudflare Dashboard → Pages → Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"
4. Verify frontend loads

#### Database Rollback (5-15 minutes)
```bash
# List available backups
./scripts/migrate-database.sh backup production

# Restore from backup
./scripts/migrate-database.sh restore production backups/backup-file.sql

# Verify restoration
./scripts/migrate-database.sh verify production
```

### Rollback Decision Matrix

| Severity | Impact | Action |
|----------|--------|--------|
| Critical | >50% users affected | Immediate rollback |
| High | Core features broken | Rollback recommended |
| Medium | Minor issues | Hotfix forward |
| Low | Cosmetic issues | Fix in next release |

## Maintenance

### Regular Tasks
- [ ] Monitor error rates (weekly)
- [ ] Review usage metrics (weekly)
- [ ] Check storage usage (monthly)
- [ ] Update dependencies (monthly)
- [ ] Review and update blocklist (as needed)
- [ ] Backup D1 database (automated daily)

### Scaling Considerations
- [ ] Monitor rate limit rejections
- [ ] Adjust rate limits if needed
- [ ] Monitor R2 storage costs
- [ ] Implement cleanup policies
- [ ] Consider authentication for higher limits

## Troubleshooting

### Common Issues

**Worker not responding:**
- Check deployment status in dashboard
- Verify resource bindings (R2, D1, KV, DO)
- Check error logs

**Frontend not loading:**
- Verify build output exists in `dist/frontend`
- Check environment variables in Pages
- Verify API URL is correct

**CORS errors:**
- Check CORS headers in Worker
- Verify allowed origins
- Consider using Pages Functions proxy

**Rate limiting too strict:**
- Adjust limits in `wrangler.json`
- Redeploy Worker
- Clear Durable Object state if needed

**Images not loading:**
- Verify R2 bucket is public (or signed URLs work)
- Check R2 bucket name in Worker
- Verify image URLs are correct

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Community Discord](https://discord.gg/cloudflaredev)

## Notes

Deployment Date: _______________
Deployed By: _______________
Worker URL: _______________
Pages URL: _______________
Custom Domain: _______________
