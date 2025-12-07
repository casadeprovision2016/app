# Turnstile CAPTCHA Integration

This document describes how to configure and use Cloudflare Turnstile CAPTCHA integration with the Bible Image Generator rate limiter.

## Overview

The RateLimiter Durable Object now supports optional Turnstile CAPTCHA verification for high-frequency requesters. When enabled, users who exceed a configurable threshold will be required to complete a CAPTCHA challenge before making additional requests.

## Configuration

Add the following environment variables to your `wrangler.toml` or environment configuration:

```toml
[vars]
# Enable or disable Turnstile CAPTCHA
TURNSTILE_ENABLED = "true"

# Number of requests before CAPTCHA is required
TURNSTILE_HIGH_FREQUENCY_THRESHOLD = "10"

# Turnstile site key (visible to clients)
TURNSTILE_SITE_KEY = "0x4AAAAAACFOFXRnLJoCzmQA"

# Turnstile secret key (server-side only)
TURNSTILE_SECRET_KEY = "0x4AAAAAACFOFSugEtfkFL_pdsKkmdzHxGE"
```

### Getting Turnstile Keys

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to "Turnstile" in the sidebar
3. Create a new site
4. Copy the Site Key and Secret Key

## How It Works

### Request Flow

1. **Normal Requests**: Users make requests normally until they reach the high-frequency threshold
2. **CAPTCHA Required**: Once the threshold is exceeded, the rate limiter sets `captchaRequired: true`
3. **Request Blocked**: All subsequent requests are blocked with `allowed: false` until CAPTCHA is verified
4. **CAPTCHA Verification**: Client submits CAPTCHA token to `/verify-captcha` endpoint
5. **Access Restored**: Upon successful verification, `captchaRequired` is cleared and requests are allowed again

### Rate Limit Response

When CAPTCHA is required, the `checkLimit` method returns:

```typescript
{
  allowed: false,
  remaining: 0,
  resetAt: <timestamp>,
  captchaRequired: true
}
```

### API Endpoints

#### Check Rate Limit

```http
POST /check
Content-Type: application/json

{
  "identifier": "user-id-or-ip",
  "tier": "anonymous"
}
```

Response:
```json
{
  "allowed": false,
  "remaining": 0,
  "resetAt": 1234567890,
  "captchaRequired": true
}
```

#### Verify CAPTCHA

```http
POST /verify-captcha
Content-Type: application/json

{
  "identifier": "user-id-or-ip",
  "token": "turnstile-response-token"
}
```

Response:
```json
{
  "success": true
}
```

Or on failure:
```json
{
  "success": false,
  "error": "CAPTCHA verification failed"
}
```

## Frontend Integration

### 1. Add Turnstile Script

Add the Turnstile script to your HTML:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### 2. Render CAPTCHA Widget

When `captchaRequired` is true, render the Turnstile widget:

```html
<div id="turnstile-widget"></div>
```

```javascript
// Render the widget
turnstile.render('#turnstile-widget', {
  sitekey: 'your-site-key',
  callback: function(token) {
    // Send token to verify endpoint
    verifyCaptcha(token);
  },
});
```

### 3. Verify Token

```javascript
async function verifyCaptcha(token) {
  const response = await fetch('/api/rate-limiter/verify-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: getUserIdentifier(),
      token: token
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // CAPTCHA verified, user can make requests again
    console.log('CAPTCHA verified successfully');
  } else {
    // Verification failed
    console.error('CAPTCHA verification failed:', result.error);
  }
}
```

## Testing

Property-based tests are included in `RateLimiter.captcha.property.test.ts` to verify:

- CAPTCHA is required after exceeding threshold
- CAPTCHA is not required when disabled
- CAPTCHA requirement persists until verification
- Successful verification clears the requirement
- Different users have independent CAPTCHA requirements
- Threshold is configurable
- Requests are blocked when CAPTCHA is required

Run tests with:

```bash
npm test -- src/durableObjects/RateLimiter.captcha.property.test.ts
```

## Disabling CAPTCHA

To disable CAPTCHA verification, set:

```toml
[vars]
TURNSTILE_ENABLED = "false"
```

When disabled, the rate limiter will never require CAPTCHA verification, regardless of request frequency.

## Security Considerations

1. **Secret Key Protection**: Never expose the `TURNSTILE_SECRET_KEY` to clients
2. **Token Validation**: Always validate tokens server-side using the Turnstile API
3. **Rate Limiting**: CAPTCHA is a supplement to, not a replacement for, rate limiting
4. **Threshold Tuning**: Adjust `TURNSTILE_HIGH_FREQUENCY_THRESHOLD` based on your traffic patterns

## Troubleshooting

### CAPTCHA Not Triggering

- Verify `TURNSTILE_ENABLED` is set to `"true"`
- Check that request count exceeds `TURNSTILE_HIGH_FREQUENCY_THRESHOLD`
- Ensure the rate limiter is properly configured

### Verification Failing

- Confirm `TURNSTILE_SECRET_KEY` is correct
- Check that the token is being sent correctly from the client
- Verify network connectivity to Turnstile API
- Check Cloudflare Dashboard for Turnstile errors

### CAPTCHA Not Clearing

- Ensure verification endpoint is being called with correct identifier
- Check that the same identifier is used for both rate limiting and verification
- Verify the Turnstile API returns `success: true`

## References

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile Client-Side Integration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Turnstile Server-Side Validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
