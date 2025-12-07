# Bible Image Generator - Documentation

This directory contains comprehensive documentation for the Bible Image Generator project.

## Documentation Index

### Getting Started
- [Quick Start Guide](QUICK_START.md) - Get up and running quickly
- [Setup Guide](SETUP.md) - Detailed setup instructions
- [Local Development](LOCAL_DEVELOPMENT.md) - Local development environment setup
- [New Developer Checklist](NEW_DEVELOPER_CHECKLIST.md) - Onboarding guide for new team members

### Configuration
- [Configuration Guide](CONFIG_README.md) - Environment and configuration details
- [Environment Setup](ENVIRONMENT_SETUP.md) - Complete environment configuration guide
- [Secrets Configuration](SECRETS_CONFIGURATION.md) - Managing secrets and sensitive data
- [Wrangler Setup](WRANGLER_SETUP.md) - Cloudflare Wrangler CLI configuration

### Deployment
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - **START HERE** - Complete step-by-step deployment guide
- [Deployment Quick Reference](DEPLOYMENT_QUICK_REFERENCE.md) - Quick commands and common tasks
- [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification checklist
- [Deployment Architecture](DEPLOYMENT_ARCHITECTURE.md) - System architecture overview
- [Rollback Procedures](ROLLBACK_PROCEDURES.md) - Emergency rollback procedures
- [Pages Configuration](PAGES_CONFIGURATION_SUMMARY.md) - Cloudflare Pages setup

### Database
- [Migration Guide](MIGRATION_GUIDE.md) - Creating and managing database migrations
- [Database Development](../migrations/DEVELOPMENT.md) - Working with D1 database
- [Database README](../migrations/README.md) - Migration files overview

### Operations
- [Wrangler Commands](WRANGLER_COMMANDS.md) - Common CLI commands
- [Quick Dev Reference](QUICK_DEV_REFERENCE.md) - Quick reference for developers
- [Metrics Aggregation](METRICS_AGGREGATION.md) - Monitoring and metrics

### Features
- [Turnstile Integration](TURNSTILE_INTEGRATION.md) - CAPTCHA implementation

## Quick Start Paths

### For New Developers
1. [New Developer Checklist](NEW_DEVELOPER_CHECKLIST.md)
2. [Local Development](LOCAL_DEVELOPMENT.md)
3. [Quick Dev Reference](QUICK_DEV_REFERENCE.md)

### For Deployment
1. [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete guide
2. [Environment Setup](ENVIRONMENT_SETUP.md) - Configure environments
3. [Secrets Configuration](SECRETS_CONFIGURATION.md) - Set up secrets
4. [Migration Guide](MIGRATION_GUIDE.md) - Apply database migrations
5. [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md) - Verify before deploying

### For Operations
1. [Deployment Quick Reference](DEPLOYMENT_QUICK_REFERENCE.md) - Common commands
2. [Rollback Procedures](ROLLBACK_PROCEDURES.md) - Emergency procedures
3. [Wrangler Commands](WRANGLER_COMMANDS.md) - CLI reference

## Common Tasks

### Deploy to Production
```bash
./scripts/deploy.sh production
```

### Apply Database Migration
```bash
./scripts/migrate-database.sh apply production
```

### Create Database Backup
```bash
./scripts/migrate-database.sh backup production
```

### Monitor Logs
```bash
wrangler tail --env production
```

### Rollback Deployment
See [Rollback Procedures](ROLLBACK_PROCEDURES.md)

## Quick Links

- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## Getting Help

If you need help:

1. **Check documentation**: Start with the relevant guide in this directory
2. **Quick reference**: See [Deployment Quick Reference](DEPLOYMENT_QUICK_REFERENCE.md)
3. **Troubleshooting**: Check the troubleshooting sections in each guide
4. **Logs**: Monitor Worker logs with `wrangler tail --env production`
5. **Dashboard**: Check Cloudflare dashboard for metrics and errors
6. **Community**: Join [Cloudflare Discord](https://discord.gg/cloudflaredev)

## Emergency Procedures

For critical issues, see:
- [Rollback Procedures](ROLLBACK_PROCEDURES.md) - Rollback deployments
- [Deployment Quick Reference](DEPLOYMENT_QUICK_REFERENCE.md) - Emergency commands
