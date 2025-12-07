# Rollback Procedures

This document provides step-by-step procedures for rolling back deployments when issues occur in production.

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Worker Rollback](#worker-rollback)
3. [Pages Rollback](#pages-rollback)
4. [Database Rollback](#database-rollback)
5. [Complete System Rollback](#complete-system-rollback)
6. [Post-Rollback Verification](#post-rollback-verification)
7. [Incident Response Checklist](#incident-response-checklist)

## When to Rollback

Consider rolling back when:

- **Critical bugs** affecting core functionality
- **High error rates** (>10% of requests failing)
- **Performance degradation** (response times >30s)
- **Data corruption** or integrity issues
- **Security vulnerabilities** discovered
- **Unintended behavior** affecting users

**Important**: Always assess the situation before rolling back. Sometimes a hotfix forward is better than a rollback.

## Worker Rollback

### Method 1: Dashboard Rollback (Recommended)

This is the fastest method for emergency rollbacks.

#### Step 1: Access Deployments

1. Go to **Cloudflare Dashboard**
2. Navigate to **Workers & Pages**
3. Click on your worker (e.g., `bible-image-generator-production`)
4. Click on **Deployments** tab

#### Step 2: Identify Previous Version

You'll see a list of deployments with:
- Deployment ID
- Timestamp
- Status
- Git commit (if applicable)

Identify the last known good deployment.

#### Step 3: Rollback

1. Click the **three dots** (⋮) next to the previous deployment
2. Select **Rollback to this deployment**
3. Confirm the rollback

#### Step 4: Verify

```bash
# Check the deployment
curl https://bible-image-generator-production.your-account.workers.dev/api/daily-verse

# Monitor logs
wrangler tail --env production
```

**Time to complete**: ~30 seconds

### Method 2: Redeploy Previous Version

If you have the previous code version:

```bash
# Checkout previous version
git checkout <previous-commit-hash>

# Deploy
wrangler deploy --env production

# Return to current branch
git checkout main
```

**Time to complete**: ~2-3 minutes

### Method 3: Emergency Disable

If you need to immediately stop the worker:

```bash
# This will return 503 for all requests
# Use only in extreme emergencies
wrangler delete --env production
```

**Warning**: This completely removes the worker. Only use as a last resort.

## Pages Rollback

### Method 1: Dashboard Rollback (Recommended)

#### Step 1: Access Deployments

1. Go to **Cloudflare Dashboard**
2. Navigate to **Pages**
3. Click on your project (e.g., `bible-image-generator-frontend`)
4. Click on **Deployments** tab

#### Step 2: Identify Previous Version

You'll see:
- Production deployments (from main branch)
- Preview deployments (from other branches)
- Deployment status and timestamp

#### Step 3: Rollback

1. Find the last known good deployment
2. Click **Rollback to this deployment**
3. Confirm the rollback

#### Step 4: Verify

1. Visit your Pages URL
2. Test critical functionality
3. Check browser console for errors

**Time to complete**: ~1 minute

### Method 2: Redeploy Previous Version

```bash
# Checkout previous version
git checkout <previous-commit-hash>

# Build
npm run build:frontend

# Deploy
wrangler pages deploy dist/frontend \
  --project-name=bible-image-generator-frontend \
  --branch=main

# Return to current branch
git checkout main
```

**Time to complete**: ~3-5 minutes

### Method 3: Git Revert (for Git-integrated deployments)

```bash
# Revert the problematic commit
git revert <bad-commit-hash>

# Push to trigger automatic deployment
git push origin main
```

**Time to complete**: ~5-10 minutes (includes build time)

## Database Rollback

Database rollbacks are more complex and should be done carefully.

### Scenario 1: Bad Migration Applied

If a migration caused issues:

#### Step 1: Assess the Damage

```bash
# Check current schema
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check migration history
wrangler d1 migrations list bible-image-db-production --env production
```

#### Step 2: Create Backup

**Always backup before attempting rollback!**

```bash
# Export current database
wrangler d1 export bible-image-db-production --env production \
  --output backup-before-rollback-$(date +%Y%m%d-%H%M%S).sql
```

#### Step 3: Restore from Automated Backup

The system creates daily backups in R2. To restore:

```bash
# List available backups
wrangler r2 object list bible-images-production --prefix backups/

# Download the backup
wrangler r2 object get bible-images-production/backups/d1-backup-YYYY-MM-DD.sql \
  --file restore.sql

# Restore the database
wrangler d1 execute bible-image-db-production --env production \
  --file restore.sql
```

#### Step 4: Verify Restoration

```bash
# Check tables
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check data integrity
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT COUNT(*) FROM verses;"
```

**Time to complete**: ~5-15 minutes

### Scenario 2: Data Corruption

If data was corrupted but schema is fine:

#### Step 1: Identify Affected Records

```bash
# Query to find problematic records
wrangler d1 execute bible-image-db-production --env production \
  --command "SELECT * FROM images WHERE created_at > 'YYYY-MM-DD HH:MM:SS';"
```

#### Step 2: Delete Corrupted Data

```bash
# Delete specific records
wrangler d1 execute bible-image-db-production --env production \
  --command "DELETE FROM images WHERE created_at > 'YYYY-MM-DD HH:MM:SS';"
```

#### Step 3: Restore from Backup (if needed)

Use the same process as Scenario 1, Step 3.

### Scenario 3: Complete Database Restore

For catastrophic failures:

```bash
# 1. Create emergency backup
wrangler d1 export bible-image-db-production --env production \
  --output emergency-backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Drop all tables (use with extreme caution!)
wrangler d1 execute bible-image-db-production --env production \
  --command "DROP TABLE IF EXISTS images; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS moderation_queue; DROP TABLE IF EXISTS usage_metrics;"

# 3. Reapply migrations
wrangler d1 migrations apply bible-image-db-production --env production

# 4. Restore data from backup (if available)
wrangler d1 execute bible-image-db-production --env production \
  --file restore.sql
```

**Time to complete**: ~10-30 minutes

## Complete System Rollback

For major incidents affecting multiple components:

### Step 1: Assess Impact

```bash
# Check Worker status
curl https://bible-image-generator-production.your-account.workers.dev/api/daily-verse

# Check Pages status
curl https://your-pages-url.pages.dev

# Check error rates in dashboard
```

### Step 2: Rollback in Order

Rollback components in this order to minimize downtime:

1. **Worker** (fastest, most critical)
2. **Pages** (frontend, less critical)
3. **Database** (slowest, most risky)

### Step 3: Execute Rollbacks

```bash
# 1. Worker rollback (via dashboard - see above)
# Takes ~30 seconds

# 2. Pages rollback (via dashboard - see above)
# Takes ~1 minute

# 3. Database rollback (if needed - see above)
# Takes ~5-15 minutes
```

### Step 4: Verify System Health

```bash
# Test Worker
curl https://bible-image-generator-production.your-account.workers.dev/api/daily-verse

# Test image generation
curl -X POST https://bible-image-generator-production.your-account.workers.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{"verseReference": "John 3:16", "stylePreset": "modern"}'

# Monitor logs
wrangler tail --env production
```

**Total time**: ~5-20 minutes depending on components affected

## Post-Rollback Verification

After any rollback, complete this checklist:

### 1. Functional Testing

- [ ] Homepage loads correctly
- [ ] Daily verse displays
- [ ] Image generation works
- [ ] Share functionality works
- [ ] Rate limiting works
- [ ] Error handling works

### 2. Performance Testing

- [ ] Response times < 30s
- [ ] Error rate < 1%
- [ ] No memory leaks
- [ ] Cache hit rates normal

### 3. Data Integrity

- [ ] Database queries return expected results
- [ ] No orphaned records
- [ ] Relationships intact
- [ ] Indexes working

### 4. Monitoring

- [ ] Logs show normal activity
- [ ] Metrics returning to baseline
- [ ] No new errors appearing
- [ ] Scheduled workers running

### 5. User Communication

- [ ] Notify users of resolution (if outage was public)
- [ ] Update status page
- [ ] Document incident

## Incident Response Checklist

Use this checklist during an incident:

### Phase 1: Detection (0-5 minutes)

- [ ] Incident detected (monitoring alert, user report, etc.)
- [ ] Severity assessed (P0-Critical, P1-High, P2-Medium, P3-Low)
- [ ] Incident channel created (Slack, Discord, etc.)
- [ ] On-call engineer notified

### Phase 2: Assessment (5-15 minutes)

- [ ] Impact scope determined (users affected, features broken)
- [ ] Root cause identified (if possible)
- [ ] Rollback vs. hotfix decision made
- [ ] Stakeholders notified

### Phase 3: Mitigation (15-30 minutes)

- [ ] Rollback executed (if chosen)
- [ ] OR Hotfix deployed (if chosen)
- [ ] Verification completed
- [ ] Monitoring confirmed recovery

### Phase 4: Recovery (30-60 minutes)

- [ ] All systems operational
- [ ] Data integrity verified
- [ ] Performance metrics normal
- [ ] Users notified of resolution

### Phase 5: Post-Incident (1-24 hours)

- [ ] Incident timeline documented
- [ ] Root cause analysis completed
- [ ] Action items identified
- [ ] Post-mortem scheduled
- [ ] Preventive measures planned

## Rollback Decision Matrix

Use this matrix to decide whether to rollback:

| Severity | Impact | Action |
|----------|--------|--------|
| P0 - Critical | >50% users affected | **Immediate rollback** |
| P0 - Critical | <50% users affected | Rollback or hotfix (assess quickly) |
| P1 - High | Core features broken | Rollback recommended |
| P1 - High | Non-core features broken | Hotfix preferred |
| P2 - Medium | Minor issues | Hotfix forward |
| P3 - Low | Cosmetic issues | Fix in next release |

## Emergency Contacts

Maintain a list of emergency contacts:

- **Primary On-Call**: [Name, Phone, Email]
- **Secondary On-Call**: [Name, Phone, Email]
- **Database Admin**: [Name, Phone, Email]
- **Cloudflare Support**: [Support Portal URL]

## Rollback Testing

Regularly test rollback procedures:

### Monthly Drill

1. Deploy a test change to staging
2. Practice rolling back via dashboard
3. Time the rollback process
4. Document any issues

### Quarterly Drill

1. Practice complete system rollback in staging
2. Test database restoration
3. Verify all procedures are up-to-date
4. Update documentation as needed

## Prevention

Prevent the need for rollbacks:

1. **Comprehensive testing** before deployment
2. **Gradual rollouts** (canary deployments)
3. **Feature flags** for risky changes
4. **Automated backups** (already implemented)
5. **Monitoring and alerts** (already implemented)
6. **Code reviews** for all changes
7. **Staging environment** testing

## Additional Resources

- [Cloudflare Workers Rollback](https://developers.cloudflare.com/workers/platform/deployments/)
- [Cloudflare Pages Rollback](https://developers.cloudflare.com/pages/platform/rollbacks/)
- [D1 Backup and Restore](https://developers.cloudflare.com/d1/learning/backups/)
- [Incident Response Best Practices](https://www.atlassian.com/incident-management/incident-response)

## Notes

- Always backup before rollback
- Document all actions taken
- Communicate with stakeholders
- Learn from incidents
- Update procedures based on learnings
