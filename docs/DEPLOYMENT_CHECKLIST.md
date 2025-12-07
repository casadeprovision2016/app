# Deployment Checklist

Use this checklist to ensure all components are properly configured before deployment.

## Pre-Deployment

### 1. Cloudflare Resources Created
- [ ] D1 Database created (`wrangler d1 create bible-image-db`)
- [ ] R2 Bucket created (`wrangler r2 bucket create bible-images`)
- [ ] KV Namespace created (`wrangler kv:namespace create KV_CACHE`)
- [ ] Resource IDs updated in `wrangler.json`

### 2. Database Setup
- [ ] Migrations applied to local database (`wrangler d1 migrations apply DB --local`)
- [ ] Migrations applied to production database (`wrangler d1 migrations apply DB --remote`)
- [ ] Verses seeded in database

### 3. Environment Variables
- [ ] `wrangler.json` configured with correct values
- [ ] Secrets configured (if using authentication):
  - [ ] `JWT_SECRET`
  - [ ] `ADMIN_API_KEY`

### 4. Frontend Configuration
- [ ] `frontend/.env.local` created for local development
- [ ] Environment variables configured in Pages dashboard:
  - [ ] `VITE_API_URL` (production)
  - [ ] `VITE_API_URL` (preview)
  - [ ] `VITE_ENVIRONMENT`

### 5. Build Verification
- [ ] Worker builds successfully (`npm run check`)
- [ ] Frontend builds successfully (`npm run build:frontend`)
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors

## Worker Deployment

### 1. Deploy Worker
```bash
npm run deploy
```

- [ ] Deployment successful
- [ ] Worker URL noted: `_______________________________`

### 2. Verify Worker
- [ ] Health check endpoint responds: `GET /api/health`
- [ ] Daily verse endpoint works: `GET /api/daily-verse`
- [ ] Rate limiting works (test with multiple requests)

### 3. Configure Scheduled Workers
- [ ] Cron triggers configured in `wrangler.json`
- [ ] Daily verse generation scheduled (6 AM UTC)
- [ ] Cleanup scheduled (weekly)
- [ ] Metrics aggregation scheduled (daily)

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

If issues occur after deployment:

### Worker Rollback
```bash
# Rollback to previous version in Cloudflare dashboard
# Workers → bible-image-generator → Deployments → Rollback
```

### Pages Rollback
```bash
# Rollback in Cloudflare dashboard
# Pages → bible-image-generator-frontend → Deployments → Rollback
```

### Database Rollback
```bash
# Restore from backup
wrangler d1 restore DB --from-backup backup-YYYY-MM-DD.sql
```

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
