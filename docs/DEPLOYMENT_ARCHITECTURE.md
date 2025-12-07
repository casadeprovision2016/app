# Deployment Architecture

This document provides a visual overview of the Bible Image Generator deployment architecture on Cloudflare.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             │
                ┌────────────┴────────────┐
                │                         │
                │                         │
┌───────────────▼──────────────┐  ┌──────▼────────────────────────┐
│   Cloudflare Pages (SPA)     │  │   Cloudflare Workers (API)    │
│                              │  │                               │
│  - React Frontend            │  │  - Image Generation           │
│  - Static Assets             │  │  - Rate Limiting              │
│  - Edge Caching              │  │  - Storage Management         │
│  - Security Headers          │  │  - Scheduled Tasks            │
└──────────────┬───────────────┘  └───────────┬───────────────────┘
               │                              │
               │ Optional                     │
               │ API Proxy                    │
               │                              │
               └──────────────┬───────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        │                     │                     │
┌───────▼────────┐  ┌─────────▼────────┐  ┌────────▼────────┐
│  Workers AI    │  │   R2 Storage     │  │  D1 Database    │
│                │  │                  │  │                 │
│  - flux-2-dev  │  │  - Images        │  │  - Metadata     │
│  - Generation  │  │  - Backups       │  │  - Verses       │
└────────────────┘  └──────────────────┘  └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼────────┐  ┌───────▼────────┐
            │  Workers KV    │  │ Durable Objects│
            │                │  │                │
            │  - Cache       │  │  - Rate Limiter│
            │  - Config      │  │  - Coordination│
            └────────────────┘  └────────────────┘
```

## Request Flow

### 1. Page Load (Static Assets)

```
User Browser
    │
    │ GET /
    ▼
Cloudflare Pages
    │
    │ Serve index.html (no cache)
    ▼
User Browser
    │
    │ GET /assets/index-[hash].js
    │ GET /assets/index-[hash].css
    │ GET /assets/react-vendor-[hash].js
    ▼
Cloudflare Pages
    │
    │ Serve from Edge Cache (1 year TTL)
    ▼
User Browser (App Loaded)
```

### 2. Image Generation Request

```
User Browser
    │
    │ POST /api/generate
    │ { verseReference: "John 3:16" }
    ▼
Cloudflare Pages (Optional Proxy)
    │
    │ Forward to Worker
    ▼
Cloudflare Workers
    │
    ├─► Check Rate Limit (Durable Object)
    │   └─► Allow/Deny
    │
    ├─► Validate Input
    │   └─► Sanitize prompt
    │
    ├─► Get Verse (D1 or Cache)
    │   └─► Return verse text
    │
    ├─► Generate Image (Workers AI)
    │   └─► flux-2-dev model
    │
    ├─► Store Image (R2)
    │   └─► Save with unique key
    │
    ├─► Save Metadata (D1)
    │   └─► Insert record
    │
    └─► Return Response
        │
        ▼
User Browser
    │
    │ Display image
    │ Show share buttons
    ▼
```

### 3. Image Retrieval

```
User Browser
    │
    │ GET /api/images/[id]
    ▼
Cloudflare Workers
    │
    ├─► Check KV Cache
    │   │
    │   ├─► Cache Hit
    │   │   └─► Return cached metadata
    │   │
    │   └─► Cache Miss
    │       │
    │       ├─► Query D1
    │       │   └─► Get metadata
    │       │
    │       └─► Update KV Cache
    │
    └─► Generate R2 URL
        │
        ▼
User Browser
    │
    │ GET [R2 URL]
    ▼
R2 Storage (via CDN)
    │
    │ Serve image (cached at edge)
    ▼
User Browser (Image Displayed)
```

## Deployment Flow

### Worker Deployment

```
Developer
    │
    │ npm run deploy
    ▼
Wrangler CLI
    │
    ├─► Build TypeScript
    │   └─► Compile to JavaScript
    │
    ├─► Bundle Dependencies
    │   └─► Create single file
    │
    ├─► Upload to Cloudflare
    │   └─► Deploy to edge
    │
    └─► Bind Resources
        ├─► R2 Bucket
        ├─► D1 Database
        ├─► KV Namespace
        ├─► Durable Objects
        └─► Workers AI
```

### Pages Deployment

```
Developer
    │
    │ npm run deploy:pages
    ▼
Build Process
    │
    ├─► Install Dependencies
    │   └─► npm install
    │
    ├─► Build Frontend
    │   ├─► Vite build
    │   ├─► Bundle React
    │   ├─► Optimize assets
    │   ├─► Generate hashes
    │   └─► Copy _headers, _redirects
    │
    └─► Output to dist/frontend/
        │
        ▼
Wrangler CLI
    │
    ├─► Upload Assets
    │   └─► dist/frontend/**
    │
    ├─► Deploy to Edge
    │   └─► 200+ locations
    │
    └─► Configure
        ├─► Headers
        ├─► Redirects
        └─► Environment Variables
```

### Git Integration (Alternative)

```
Developer
    │
    │ git push origin main
    ▼
GitHub/GitLab
    │
    │ Webhook
    ▼
Cloudflare Pages
    │
    ├─► Clone Repository
    │
    ├─► Run Build Command
    │   └─► npm run build:frontend
    │
    ├─► Deploy Assets
    │   └─► From dist/frontend/
    │
    └─► Activate Deployment
        │
        ▼
Live Site Updated
```

## Caching Strategy

### Edge Caching Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Browser Cache                                     │
│  - Respects Cache-Control headers                           │
│  - Stores assets locally                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ Cache Miss
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Cloudflare Edge Cache (200+ locations)            │
│  - Immutable assets: 1 year                                 │
│  - Images: 1 day                                            │
│  - HTML: No cache                                           │
└────────────────────────┬────────────────────────────────────┘
                         │ Cache Miss
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Workers KV (Metadata Cache)                       │
│  - Frequently accessed metadata                             │
│  - TTL: Configurable                                        │
└────────────────────────┬────────────────────────────────────┘
                         │ Cache Miss
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Origin (R2 Storage / D1 Database)                 │
│  - Source of truth                                          │
│  - Populates upper cache layers                             │
└─────────────────────────────────────────────────────────────┘
```

### Cache Invalidation

```
Content Update
    │
    ├─► Static Assets (JS/CSS)
    │   └─► New hash → New URL → No invalidation needed
    │
    ├─► HTML Files
    │   └─► No cache → Always fresh
    │
    ├─► Images
    │   └─► Purge via API or wait for TTL
    │
    └─► Metadata
        └─► Clear KV cache → Next request fetches from D1
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
└─────────────────────────────────────────────────────────────┘

1. Network Layer (Cloudflare)
   ├─► DDoS Protection
   ├─► WAF (Web Application Firewall)
   ├─► Bot Management
   └─► SSL/TLS Encryption

2. Application Layer (Pages)
   ├─► Security Headers
   │   ├─► X-Frame-Options: DENY
   │   ├─► X-Content-Type-Options: nosniff
   │   ├─► X-XSS-Protection: 1; mode=block
   │   └─► Referrer-Policy: strict-origin-when-cross-origin
   │
   └─► CORS Policy
       └─► Restrict allowed origins

3. API Layer (Workers)
   ├─► Rate Limiting (Durable Objects)
   │   ├─► Anonymous: 5 req/hour
   │   └─► Authenticated: 20 req/hour
   │
   ├─► Input Validation
   │   ├─► Sanitize prompts
   │   └─► Validate verse references
   │
   ├─► Content Moderation
   │   ├─► Blocklist checking
   │   └─► Safety filters
   │
   └─► Authentication (Optional)
       └─► JWT validation

4. Data Layer
   ├─► R2: Private bucket with signed URLs
   ├─► D1: Parameterized queries (SQL injection prevention)
   └─► KV: Encrypted at rest
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                         │
└─────────────────────────────────────────────────────────────┘

Application Metrics
    │
    ├─► Workers Analytics
    │   ├─► Request count
    │   ├─► Error rate
    │   ├─► Latency (p50, p95, p99)
    │   └─► CPU time
    │
    ├─► Pages Analytics
    │   ├─► Page views
    │   ├─► Unique visitors
    │   ├─► Bandwidth
    │   └─► Geographic distribution
    │
    └─► Custom Metrics (D1)
        ├─► Generation count
        ├─► Success rate
        ├─► Storage usage
        └─► Rate limit events

Logging
    │
    ├─► Worker Logs (wrangler tail)
    │   ├─► Error logs
    │   ├─► Request logs
    │   └─► Performance logs
    │
    └─► Structured Logging
        ├─► Request ID
        ├─► User ID
        ├─► Operation
        └─► Duration

Alerting
    │
    ├─► Error Rate > 5%
    ├─► Latency > 30s
    ├─► Storage > 80% quota
    └─► Rate limit rejections > 100/hour
```

## Scaling Considerations

```
┌─────────────────────────────────────────────────────────────┐
│                    Scaling Strategy                         │
└─────────────────────────────────────────────────────────────┘

Horizontal Scaling (Automatic)
    │
    ├─► Workers: Auto-scale to millions of requests
    ├─► Pages: Served from 200+ edge locations
    ├─► R2: Unlimited storage capacity
    └─► D1: Scales with usage

Vertical Scaling (Configuration)
    │
    ├─► Rate Limits
    │   ├─► Adjust per-user limits
    │   └─► Add tier-based limits
    │
    ├─► Cache TTLs
    │   ├─► Increase for popular content
    │   └─► Decrease for dynamic content
    │
    └─► Resource Allocation
        ├─► Workers CPU time
        └─► D1 query limits

Cost Optimization
    │
    ├─► Aggressive caching (reduce origin requests)
    ├─► Image cleanup (reduce storage costs)
    ├─► Efficient queries (reduce D1 costs)
    └─► Rate limiting (prevent abuse)
```

## Disaster Recovery

```
┌─────────────────────────────────────────────────────────────┐
│                    Recovery Procedures                      │
└─────────────────────────────────────────────────────────────┘

Backup Strategy
    │
    ├─► D1 Database
    │   ├─► Daily automated backups to R2
    │   ├─► Retention: 30 days
    │   └─► Restore: wrangler d1 restore
    │
    ├─► R2 Images
    │   ├─► No backup needed (can regenerate)
    │   └─► Metadata in D1 for regeneration
    │
    └─► Configuration
        ├─► Version controlled (Git)
        └─► Infrastructure as Code

Rollback Procedures
    │
    ├─► Worker Rollback
    │   └─► Dashboard → Deployments → Rollback
    │
    ├─► Pages Rollback
    │   └─► Dashboard → Deployments → Rollback
    │
    └─► Database Rollback
        └─► Restore from R2 backup

Incident Response
    │
    ├─► Detect: Monitoring alerts
    ├─► Assess: Check logs and metrics
    ├─► Mitigate: Rollback or hotfix
    ├─► Resolve: Deploy fix
    └─► Review: Post-mortem analysis
```

## Cost Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│                    Monthly Cost Estimate                    │
│                    (1000 images generated)                  │
└─────────────────────────────────────────────────────────────┘

Workers
    ├─► Requests: Free (within 100k/day limit)
    └─► CPU Time: Free (within limits)

Workers AI
    └─► Image Generation: ~$10 (1000 × $0.01)

R2 Storage
    ├─► Storage: ~$0.01 (1000 × 500KB)
    └─► Operations: ~$0.01 (Class A operations)

D1 Database
    ├─► Storage: Free (within 5GB limit)
    └─► Queries: Free (within 5M/day limit)

Pages
    ├─► Hosting: Free (unlimited)
    └─► Bandwidth: Free (unlimited)

Total: ~$10-15/month
```

## Resources

- [Cloudflare Architecture](https://developers.cloudflare.com/fundamentals/concepts/)
- [Workers Architecture](https://developers.cloudflare.com/workers/learning/how-workers-works/)
- [Pages Architecture](https://developers.cloudflare.com/pages/how-to/)
- [Edge Caching](https://developers.cloudflare.com/cache/)
