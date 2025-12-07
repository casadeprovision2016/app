# Secrets Configuration Guide

This guide covers managing secrets and sensitive configuration for the Bible Image Generator application.

## Table of Contents

1. [Overview](#overview)
2. [Required Secrets](#required-secrets)
3. [Generating Secrets](#generating-secrets)
4. [Setting Secrets](#setting-secrets)
5. [Local Development](#local-development)
6. [Secret Rotation](#secret-rotation)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

Secrets are sensitive values that should never be committed to version control or exposed in client-side code. The Bible Image Generator uses Cloudflare Workers Secrets for secure storage and access.

### What Gets Stored as Secrets

- **API Keys**: Third-party service credentials
- **Signing Keys**: JWT token signing keys
- **Admin Credentials**: Admin API keys
- **CAPTCHA Keys**: Turnstile secret keys

### What Doesn't Need to be Secret

- **Public URLs**: API endpoints, domain names
- **Rate Limits**: Numeric configuration values
- **Feature Flags**: Boolean settings
- **Cache TTLs**: Timing configuration

These can be stored as environment variables in `wrangler.toml`.

## Required Secrets

### 1. JWT_SECRET

**Purpose**: Signs and verifies JWT tokens for authentication

**Required**: Optional (only if implementing authentication)

**Format**: Base64-encoded random string (32+ bytes)

**Usage**:
```typescript
// In Worker code
const token = await sign(payload, env.JWT_SECRET);
const verified = await verify(token, env.JWT_SECRET);
```

### 2. ADMIN_API_KEY

**Purpose**: Authenticates requests to admin endpoints

**Required**: Yes (for moderation endpoints)

**Format**: Base64-encoded random string (32+ bytes)

**Usage**:
```typescript
// In Worker code
if (request.headers.get('X-Admin-Key') !== env.ADMIN_API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 3. TURNSTILE_SECRET_KEY

**Purpose**: Verifies Cloudflare Turnstile CAPTCHA responses

**Required**: Optional (only if using CAPTCHA)

**Format**: Provided by Cloudflare Turnstile dashboard

**Usage**:
```typescript
// In Worker code
const verification = await fetch(
  'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  }
);
```

## Generating Secrets

### Method 1: OpenSSL (Recommended)

```bash
# Generate a 32-byte random secret
openssl rand -base64 32

# Example output:
# 7xK9mP2nQ5vR8wT1yU4zX6cV0bN3aM5jH7gF9dS2eL4k
```

### Method 2: Node.js

```bash
# Generate using Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 3: Python

```bash
# Generate using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Method 4: Online Generator

**⚠️ Not Recommended for Production**

For development only, you can use online generators, but always generate production secrets locally.

## Setting Secrets

### For Production

```bash
# Generate the secret
SECRET_VALUE=$(openssl rand -base64 32)

# Set the secret
echo $SECRET_VALUE | wrangler secret put JWT_SECRET --env production

# Verify it was set (shows name only, not value)
wrangler secret list --env production
```

### For Staging

```bash
# Generate a different secret for staging
SECRET_VALUE=$(openssl rand -base64 32)

# Set the secret
echo $SECRET_VALUE | wrangler secret put JWT_SECRET --env staging

# Verify
wrangler secret list --env staging
```

### For Development

```bash
# Dev environment uses remote secrets too
SECRET_VALUE=$(openssl rand -base64 32)

# Set the secret (no --env flag for default environment)
echo $SECRET_VALUE | wrangler secret put JWT_SECRET
```

### Interactive Mode

If you prefer to paste the secret manually:

```bash
# Wrangler will prompt for the value
wrangler secret put JWT_SECRET --env production

# Paste your secret when prompted
# Press Enter
```

### Bulk Secret Setup

Create a script to set all secrets at once:

```bash
#!/bin/bash
# setup-secrets.sh

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./setup-secrets.sh [dev|staging|production]"
    exit 1
fi

echo "Setting up secrets for $ENVIRONMENT environment..."

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_API_KEY=$(openssl rand -base64 32)

# Set secrets
echo $JWT_SECRET | wrangler secret put JWT_SECRET --env $ENVIRONMENT
echo $ADMIN_API_KEY | wrangler secret put ADMIN_API_KEY --env $ENVIRONMENT

# Optional: Turnstile (you'll need to provide this)
read -p "Enter Turnstile Secret Key (or press Enter to skip): " TURNSTILE_KEY
if [ ! -z "$TURNSTILE_KEY" ]; then
    echo $TURNSTILE_KEY | wrangler secret put TURNSTILE_SECRET_KEY --env $ENVIRONMENT
fi

echo "Secrets set successfully!"
echo ""
echo "⚠️  IMPORTANT: Save these secrets securely!"
echo "JWT_SECRET: $JWT_SECRET"
echo "ADMIN_API_KEY: $ADMIN_API_KEY"
```

Make it executable:
```bash
chmod +x setup-secrets.sh
./setup-secrets.sh production
```

## Local Development

### Using .dev.vars

For local development, use `.dev.vars` file:

```bash
# Create .dev.vars
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
# Local development secrets
# DO NOT COMMIT THIS FILE

# JWT Secret (for authentication)
JWT_SECRET=local-dev-jwt-secret-change-me-in-production

# Admin API Key (for admin endpoints)
ADMIN_API_KEY=local-dev-admin-key-change-me-in-production

# Turnstile Secret (for CAPTCHA - use test key)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Test Keys for Local Development

Cloudflare provides test keys for Turnstile:

**Site Key** (public, goes in frontend):
```
1x00000000000000000000AA
```

**Secret Key** (private, goes in .dev.vars):
```
1x0000000000000000000000000000000AA
```

These always pass verification in development.

### Gitignore Configuration

Ensure `.dev.vars` is in `.gitignore`:

```gitignore
# Secrets
.dev.vars
*.env.local
*.env.production
```

## Secret Rotation

### When to Rotate

Rotate secrets when:
- **Scheduled**: Every 90 days (recommended)
- **Compromised**: Immediately if exposed
- **Team Changes**: When team members leave
- **Security Audit**: As part of security review
- **Breach**: If any system breach occurs

### Rotation Process

#### Step 1: Generate New Secret

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Save it securely (password manager, etc.)
echo "New secret: $NEW_SECRET"
```

#### Step 2: Update in Wrangler

```bash
# Set new secret
echo $NEW_SECRET | wrangler secret put JWT_SECRET --env production
```

#### Step 3: Deploy

The new secret takes effect immediately for new deployments. No redeployment needed.

#### Step 4: Verify

```bash
# Test that the application still works
curl https://your-worker-url.workers.dev/api/daily-verse

# Check logs for any auth errors
wrangler tail --env production
```

#### Step 5: Document

Record the rotation:
- Date rotated
- Reason for rotation
- Who performed it
- Any issues encountered

### Zero-Downtime Rotation

For critical secrets, use a dual-secret approach:

1. Add new secret with different name: `JWT_SECRET_NEW`
2. Update code to accept both secrets
3. Deploy updated code
4. Wait for all requests to use new secret
5. Remove old secret
6. Update code to use only new secret
7. Deploy final version

## Security Best Practices

### 1. Never Commit Secrets

```bash
# Bad ❌
const JWT_SECRET = "my-secret-key";

# Good ✅
const JWT_SECRET = env.JWT_SECRET;
```

### 2. Use Strong Secrets

```bash
# Bad ❌ - Too short, predictable
JWT_SECRET=password123

# Good ✅ - Long, random, base64-encoded
JWT_SECRET=7xK9mP2nQ5vR8wT1yU4zX6cV0bN3aM5jH7gF9dS2eL4k
```

### 3. Different Secrets Per Environment

```bash
# Bad ❌ - Same secret everywhere
production: JWT_SECRET=abc123
staging: JWT_SECRET=abc123

# Good ✅ - Different secrets
production: JWT_SECRET=7xK9mP2nQ5vR8wT1yU4zX6cV0bN3aM5j
staging: JWT_SECRET=2nQ5vR8wT1yU4zX6cV0bN3aM5jH7gF9d
```

### 4. Store Secrets Securely

Use a password manager or secrets vault:
- 1Password
- LastPass
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

### 5. Limit Access

Only give secret access to:
- Deployment systems (CI/CD)
- Senior engineers
- On-call personnel

### 6. Audit Secret Usage

```bash
# Regularly check who has access
wrangler secret list --env production

# Review access logs in Cloudflare dashboard
```

### 7. Rotate Regularly

Set up a calendar reminder:
- Every 90 days: Rotate all secrets
- Every 30 days: Review secret access
- Every 7 days: Check for exposed secrets

### 8. Monitor for Exposure

Use tools to scan for exposed secrets:
- GitHub Secret Scanning
- GitGuardian
- TruffleHog
- git-secrets

### 9. Have a Breach Response Plan

If a secret is exposed:
1. **Immediately** rotate the secret
2. Review logs for unauthorized access
3. Notify affected users (if applicable)
4. Document the incident
5. Review how it was exposed
6. Implement preventive measures

## Troubleshooting

### Secret Not Found

**Error**: `JWT_SECRET is undefined`

**Solution**:
```bash
# Check if secret exists
wrangler secret list --env production

# If missing, set it
wrangler secret put JWT_SECRET --env production
```

### Wrong Environment

**Error**: Secret works locally but not in production

**Solution**:
```bash
# Verify you set the secret for the right environment
wrangler secret list --env production

# Set it if missing
wrangler secret put JWT_SECRET --env production
```

### Secret Not Updating

**Error**: Old secret still being used after rotation

**Solution**:
```bash
# Secrets update immediately, but check deployment
wrangler deployments list --env production

# If needed, redeploy
wrangler deploy --env production
```

### Can't Delete Secret

**Error**: Secret deletion fails

**Solution**:
```bash
# Use force flag
wrangler secret delete JWT_SECRET --env production --force

# Or delete via dashboard
```

### Local Development Not Working

**Error**: Secrets not loading from .dev.vars

**Solution**:
```bash
# Verify .dev.vars exists
cat .dev.vars

# Verify format (no quotes around values)
JWT_SECRET=value-without-quotes

# Restart dev server
npm run dev
```

## Secret Management Checklist

Use this checklist for secret management:

### Initial Setup
- [ ] Generate strong secrets (32+ bytes)
- [ ] Set secrets for all environments
- [ ] Store secrets in password manager
- [ ] Document secret purposes
- [ ] Add .dev.vars to .gitignore
- [ ] Test application with secrets

### Regular Maintenance
- [ ] Rotate secrets every 90 days
- [ ] Review secret access monthly
- [ ] Audit secret usage quarterly
- [ ] Update documentation
- [ ] Test rotation process

### Security Review
- [ ] Scan codebase for hardcoded secrets
- [ ] Review access logs
- [ ] Check for exposed secrets online
- [ ] Verify .gitignore is working
- [ ] Test breach response plan

## Additional Resources

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler Secret Commands](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## Emergency Contacts

In case of secret exposure:

1. **Rotate immediately**: Use the rotation process above
2. **Notify team**: Alert all team members
3. **Review logs**: Check for unauthorized access
4. **Document**: Record the incident
5. **Prevent**: Implement additional safeguards
