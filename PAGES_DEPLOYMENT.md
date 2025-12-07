# Cloudflare Pages Deployment Guide

This guide explains how to deploy the Bible Image Generator frontend to Cloudflare Pages.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Git repository (for automatic deployments)

## Configuration Files

### 1. `wrangler.pages.toml`
Main Pages configuration file that defines:
- Build command and output directory
- Environment variables for different environments
- Edge caching headers for static assets
- Security headers

### 2. `frontend/public/_headers`
HTTP headers configuration for static assets:
- Security headers (X-Frame-Options, CSP, etc.)
- Cache-Control headers for optimal edge caching
- Immutable caching for versioned assets (JS, CSS, fonts)
- Short-lived caching for HTML files

### 3. `frontend/public/_redirects`
URL redirect configuration:
- SPA fallback routing (all routes → index.html)
- Enables client-side routing to work properly

## Environment Variables

The following environment variables need to be configured in Cloudflare Pages dashboard:

### Production Environment
```
VITE_API_URL=https://bible-image-generator.your-domain.workers.dev
VITE_ENVIRONMENT=production
```

### Preview Environment
```
VITE_API_URL=https://bible-image-generator-preview.your-domain.workers.dev
VITE_ENVIRONMENT=preview
```

## Deployment Methods

### Method 1: Direct Deployment via Wrangler

1. **Build the frontend:**
   ```bash
   npm run build:frontend
   ```

2. **Deploy to Pages:**
   ```bash
   wrangler pages deploy dist/frontend --project-name=bible-image-generator-frontend
   ```

3. **Set environment variables:**
   ```bash
   # Production
   wrangler pages secret put VITE_API_URL --project-name=bible-image-generator-frontend
   
   # Preview
   wrangler pages secret put VITE_API_URL --project-name=bible-image-generator-frontend --env=preview
   ```

### Method 2: Git Integration (Recommended)

1. **Connect your Git repository:**
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project"
   - Connect your Git provider (GitHub, GitLab, etc.)
   - Select your repository

2. **Configure build settings:**
   - **Build command:** `npm run build:frontend`
   - **Build output directory:** `dist/frontend`
   - **Root directory:** `/` (leave empty or use root)
   - **Environment variables:** Add the variables listed above

3. **Deploy:**
   - Pages will automatically deploy on every push to your main branch
   - Preview deployments are created for pull requests

### Method 3: Using wrangler.pages.toml

1. **Deploy with configuration file:**
   ```bash
   wrangler pages deploy --config=wrangler.pages.toml
   ```

## Build Configuration

The build process:
1. Runs `npm run build:frontend`
2. Vite builds the React application
3. Output is generated in `dist/frontend/`
4. Includes:
   - Optimized and minified JavaScript bundles
   - CSS files with Tailwind utilities
   - Static assets (images, fonts, etc.)
   - `_headers` and `_redirects` files

## Edge Caching Strategy

### Static Assets (Immutable)
- **JavaScript bundles:** `Cache-Control: public, max-age=31536000, immutable`
- **CSS files:** `Cache-Control: public, max-age=31536000, immutable`
- **Fonts:** `Cache-Control: public, max-age=31536000, immutable`
- **Rationale:** These files have content hashes in their names, so they never change

### HTML Files
- **index.html:** `Cache-Control: public, max-age=0, must-revalidate`
- **Rationale:** Always serve the latest version to get updated asset references

### Images
- **Cache duration:** 1 day (`max-age=86400`)
- **Rationale:** Balance between caching and freshness

## Security Headers

All responses include:
- `X-Content-Type-Options: nosniff` - Prevent MIME type sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Enable XSS filtering
- `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer information
- `Permissions-Policy` - Restrict browser features

## Pages Functions (Optional)

If you need server-side logic on Pages, create a `functions/` directory:

```
functions/
├── api/
│   └── [[path]].ts  # Catch-all API proxy to Workers
└── _middleware.ts   # Global middleware
```

Example API proxy function:
```typescript
// functions/api/[[path]].ts
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Proxy to Worker API
  const workerUrl = `${env.VITE_API_URL}${url.pathname}${url.search}`;
  return fetch(workerUrl, request);
}
```

## Custom Domain Setup

1. **Add custom domain in Cloudflare Dashboard:**
   - Pages → Your Project → Custom domains
   - Add your domain (e.g., `bible.example.com`)

2. **DNS Configuration:**
   - Cloudflare automatically configures DNS if domain is on Cloudflare
   - For external DNS, add CNAME record pointing to your Pages URL

3. **SSL/TLS:**
   - Automatic SSL certificate provisioning
   - Always use HTTPS

## Monitoring and Analytics

### Pages Analytics
- Available in Cloudflare Dashboard
- Tracks page views, unique visitors, bandwidth
- Real-time traffic monitoring

### Web Analytics (Optional)
Enable Cloudflare Web Analytics for detailed insights:
```html
<!-- Add to index.html -->
<script defer src='https://static.cloudflare.com/beacon.min.js' 
        data-cf-beacon='{"token": "your-token"}'></script>
```

## Rollback and Versioning

### Rollback to Previous Deployment
1. Go to Pages → Deployments
2. Find the deployment you want to rollback to
3. Click "Rollback to this deployment"

### Deployment History
- Pages keeps history of all deployments
- Each deployment has a unique URL for testing
- Preview deployments for branches/PRs

## Performance Optimization

### Implemented Optimizations
1. **Code splitting:** React vendor bundle separated
2. **Asset hashing:** Enables long-term caching
3. **Compression:** Automatic Brotli/Gzip compression
4. **Edge caching:** Static assets cached at 200+ locations
5. **HTTP/2 & HTTP/3:** Automatic protocol upgrades

### Recommended Optimizations
1. **Image optimization:** Use WebP format, lazy loading
2. **Font optimization:** Preload critical fonts
3. **Critical CSS:** Inline above-the-fold CSS
4. **Service Worker:** Add for offline support (future)

## Troubleshooting

### Build Failures
- Check build logs in Pages dashboard
- Verify `package.json` scripts are correct
- Ensure all dependencies are in `dependencies` (not `devDependencies`)

### 404 Errors on Routes
- Verify `_redirects` file is in the build output
- Check SPA fallback rule: `/* /index.html 200`

### Environment Variables Not Working
- Ensure variables are prefixed with `VITE_`
- Rebuild after changing environment variables
- Check variable names match exactly

### Caching Issues
- Clear Cloudflare cache: Dashboard → Caching → Purge Everything
- Check `_headers` file is in build output
- Verify Cache-Control headers in browser DevTools

## Cost Estimation

### Cloudflare Pages Free Tier
- **Builds:** 500 builds per month
- **Bandwidth:** Unlimited
- **Requests:** Unlimited
- **Custom domains:** Unlimited

### Beyond Free Tier
- **Additional builds:** $5 per 500 builds
- **Pages Functions:** Included in Workers pricing

## Next Steps

1. Deploy the Worker API first (see main README)
2. Update `VITE_API_URL` with your Worker URL
3. Deploy the frontend to Pages
4. Configure custom domain (optional)
5. Enable Web Analytics (optional)
6. Set up monitoring and alerts

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler Pages Commands](https://developers.cloudflare.com/workers/wrangler/commands/#pages)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Build Configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
