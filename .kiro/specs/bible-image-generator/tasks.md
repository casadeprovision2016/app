# Implementation Plan

- [x] 1. Set up project structure and development environment (npm create cloudflare@latest -- --template=cloudflare/templates/text-to-image-template)
  - Initialize Cloudflare Workers project with TypeScript
  - Configure Wrangler for Workers, R2, D1, KV, and Durable Objects
  - Set up Vite build configuration
  - Install dependencies: Vitest, fast-check, TypeScript
  - Create directory structure: src/services, src/durableObjects, src/utils, frontend/
  - _Requirements: All (foundational)_

- [x] 2. Initialize D1 database schema and migrations
  - Create D1 migration files for images, verses, users, moderation_queue, and usage_metrics tables
  - Add indexes for performance optimization
  - Seed verses table with initial biblical verses for daily rotation
  - _Requirements: 2.3, 4.2, 7.5, 9.2, 10.1_

- [x] 3. Implement core data models and types
  - Define TypeScript interfaces for Verse, ImageMetadata, GenerationParams, GeneratedImage
  - Create type definitions for API request/response shapes
  - Define error response types and error codes
  - _Requirements: 1.1, 2.3, 11.2_

- [x] 4. Implement Verse Service
  - Create VerseService class with getVerse, getDailyVerse, and searchVerses methods
  - Implement verse reference parsing (e.g., "John 3:16")
  - Add embedded JSON file with popular verses for MVP
  - Implement D1 queries for verse retrieval
  - _Requirements: 1.1, 4.2_

- [x] 4.1 Write property test for verse retrieval
  - **Property 13: Daily verse selection**
  - **Validates: Requirements 4.2**

- [x] 5. Implement input validation and sanitization
  - Create prompt sanitization function to remove blocked terms
  - Implement blocklist loading from KV or configuration
  - Add verse reference format validation
  - Create request validation middleware
  - _Requirements: 1.5, 7.1, 7.2_

- [ ] 5.1 Write property test for input sanitization
  - **Property 5: Input sanitization**
  - **Validates: Requirements 1.5**

- [x] 5.2 Write property test for blocklist validation
  - **Property 23: Blocklist validation**
  - **Validates: Requirements 7.1, 7.2**

- [x] 6. Implement Image Generation Service
  - Create ImageGenerationService class with generate method
  - Implement prompt construction logic combining verse text and style presets
  - Add style preset definitions (modern, classic, minimalist, artistic)
  - Integrate Workers AI binding for flux-2-dev model (https://developers.cloudflare.com/workers-ai/models/flux-2-dev/)
  - Add timeout handling (30 second limit)
  - Implement error handling for AI service failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.3_

- [x] 6.1 Write property test for prompt construction
  - **Property 1: Prompt construction completeness**
  - **Validates: Requirements 1.1**

- [x] 6.2 Write property test for AI service invocation
  - **Property 2: AI service invocation**
  - **Validates: Requirements 1.2**

- [x] 6.3 Write property test for generation timeout
  - **Property 3: Generation timeout compliance**
  - **Validates: Requirements 1.3**

- [x] 6.4 Write property test for error handling
  - **Property 4: Error handling completeness**
  - **Validates: Requirements 1.4**

- [x] 6.5 Write property test for daily verse styling
  - **Property 14: Daily verse styling**
  - **Validates: Requirements 4.3**

- [x] 7. Implement Storage Service
  - Create StorageService class with saveImage, getImage, getImageUrl methods
  - Implement filename generation with user ID, timestamp, and hash
  - Add R2 integration for image storage and retrieval
  - Implement D1 operations for metadata storage
  - Add WebP format detection and conversion
  - Create public URL generation logic
  - Implement signed URL generation for private images
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.5, 6.4_

- [x] 7.1 Write property test for storage persistence
  - **Property 6: Storage persistence**
  - **Validates: Requirements 2.1, 2.4**

- [x] 7.2 Write property test for filename uniqueness
  - **Property 7: Filename uniqueness**
  - **Validates: Requirements 2.2**

- [x] 7.3 Write property test for metadata completeness
  - **Property 8: Metadata completeness**
  - **Validates: Requirements 2.3**

- [x] 7.4 Write property test for URL generation
  - **Property 10: URL generation**
  - **Validates: Requirements 3.1**

- [x] 7.5 Write property test for signed URL validity
  - **Property 12: Signed URL validity**
  - **Validates: Requirements 3.5**

- [x] 7.6 Write property test for WebP format selection
  - **Property 22: WebP format selection**
  - **Validates: Requirements 6.4**

- [x] 7.7 Write property test for deterministic naming
  - **Property 39: Deterministic naming**
  - **Validates: Requirements 12.3**

- [x] 8. Implement caching layer with Workers KV
  - Create cache utility functions for KV operations
  - Implement cache-first metadata retrieval with D1 fallback
  - Add cache invalidation logic
  - Implement daily verse caching
  - Store configuration data in KV (rate limits, style presets, blocklist)
  - _Requirements: 2.5, 4.5, 6.2_

- [x] 8.1 Write property test for cache consistency
  - **Property 9: Cache consistency**
  - **Validates: Requirements 2.5**

- [x] 8.2 Write property test for cache-first retrieval
  - **Property 21: Cache-first metadata retrieval**
  - **Validates: Requirements 6.2**

- [x] 9. Implement Rate Limiter Durable Object
  - Create RateLimiter Durable Object class
  - Implement checkLimit and recordRequest methods
  - Add tier-based rate limiting (anonymous vs authenticated)
  - Implement progressive rate limiting for suspicious patterns
  - Add reset logic and Retry-After calculation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 12.5_

- [x] 9.1 Write property test for rate limit enforcement
  - **Property 16: Rate limit enforcement**
  - **Validates: Requirements 5.1, 5.2**

- [x] 9.2 Write property test for tier-based limits
  - **Property 17: Tier-based rate limits**
  - **Validates: Requirements 5.3**

- [x] 9.3 Write property test for progressive rate limiting
  - **Property 18: Progressive rate limiting**
  - **Validates: Requirements 5.4**

- [x] 9.4 Write property test for concurrency safety
  - **Property 41: Concurrency safety**
  - **Validates: Requirements 12.5**

- [x] 10. Implement Share Service
  - Create ShareService class with generateWhatsAppLink method
  - Implement WhatsApp link formatting with encoded message
  - Add Web Share API data generation
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 10.1 Write property test for WhatsApp link format
  - **Property 11: WhatsApp link format**
  - **Validates: Requirements 3.2**

- [x] 11. Implement main API Worker with endpoints
  - Create main worker entry point with request routing
  - Implement POST /api/generate endpoint with request validation
  - Add idempotency checking using request IDs
  - Implement GET /api/images/:imageId endpoint
  - Implement GET /api/daily-verse endpoint
  - Implement GET /api/images/:imageId/share endpoint
  - Add CORS middleware with origin validation
  - Implement error response formatting
  - Add request logging and metrics recording
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 3.1, 3.2, 4.5, 8.2, 9.1, 9.2, 12.1, 12.2_

- [x] 11.1 Write property test for idempotency
  - **Property 38: Idempotency with request ID**
  - **Validates: Requirements 12.1, 12.2**

- [x] 11.2 Write property test for retry safety
  - **Property 40: Retry safety**
  - **Validates: Requirements 12.4**

- [x] 11.3 Write property test for CORS enforcement
  - **Property 26: CORS policy enforcement**
  - **Validates: Requirements 8.2**

- [x] 11.4 Write property test for error logging
  - **Property 28: Error logging completeness**
  - **Validates: Requirements 9.1**

- [x] 11.5 Write property test for metrics recording
  - **Property 29: Metrics recording**
  - **Validates: Requirements 9.2**

- [x] 11.6 Write property test for daily verse tagging
  - **Property 15: Daily verse tagging**
  - **Validates: Requirements 4.4**

- [x] 12. Implement CDN caching and optimization
  - Add Cache-Control headers to image responses
  - Implement edge caching configuration for R2 public URLs
  - Add ETag support for conditional requests
  - _Requirements: 6.1, 6.5_

- [x] 12.1 Write property test for cache headers
  - **Property 20: Cache headers presence**
  - **Validates: Requirements 6.1**

- [x] 13. Implement content moderation features
  - Create moderation queue operations in D1
  - Implement content safety check integration (optional)
  - Add flagging logic for manual review
  - Implement POST /api/admin/moderate endpoint
  - _Requirements: 7.3, 7.4, 7.5_

- [x] 13.1 Write property test for content safety enforcement
  - **Property 24: Content safety enforcement**
  - **Validates: Requirements 7.3, 7.4**

- [x] 13.2 Write property test for moderation queue creation
  - **Property 25: Moderation queue creation**
  - **Validates: Requirements 7.5**

- [ ] 14. Implement authentication and authorization (optional for MVP)
  - Add JWT token validation middleware
  - Implement protected route checks
  - Add user tier detection for rate limiting
  - _Requirements: 5.3, 8.3_

- [x] 14.1 Write property test for authentication validation
  - **Property 27: Authentication validation**
  - **Validates: Requirements 8.3**

- [x] 15. Implement Turnstile CAPTCHA integration (optional)
  - Add Turnstile verification for high-frequency requesters
  - Integrate CAPTCHA check into rate limiter
  - _Requirements: 5.5_

- [x] 15.1 Write property test for CAPTCHA enforcement
  - **Property 19: CAPTCHA enforcement**
  - **Validates: Requirements 5.5**

- [-] 16. Implement monitoring and logging infrastructure
  - Create structured logging utility with log levels
  - Implement usage tracking for R2 and D1 operations
  - Add rate limit event logging
  - Implement quota alerting logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 16.1 Write property test for usage tracking
  - **Property 30: Usage tracking**
  - **Validates: Requirements 9.3**

- [x] 16.2 Write property test for rate limit logging
  - **Property 31: Rate limit event logging**
  - **Validates: Requirements 9.4**

- [ ] 16.3 Write property test for quota alerting
  - **Property 32: Quota alerting**
  - **Validates: Requirements 9.5**

- [x] 17. Implement Scheduled Worker for daily verse generation
  - Create scheduled worker entry point
  - Implement daily verse generation task (6 AM UTC trigger)
  - Add verse selection logic from D1 rotation
  - Implement daily verse image generation with predefined style
  - Update KV cache with latest daily verse
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 18. Implement Scheduled Worker for cleanup operations
  - Add image cleanup task (weekly trigger)
  - Implement age-based cleanup identification
  - Add protected image exemption logic (favorites, daily verses)
  - Implement D1 backup to R2 before cleanup
  - Add cleanup execution with R2 and D1 deletion
  - Implement backup retention management
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 18.1 Write property test for cleanup identification
  - **Property 33: Age-based cleanup identification**
  - **Validates: Requirements 10.1**

- [x] 18.2 Write property test for cleanup consistency
  - **Property 34: Cleanup consistency**
  - **Validates: Requirements 10.2**

- [x] 18.3 Write property test for protected image exemption
  - **Property 35: Protected image exemption**
  - **Validates: Requirements 10.3**

- [x] 18.4 Write property test for backup before cleanup
  - **Property 36: Backup before cleanup**
  - **Validates: Requirements 10.4**

- [x] 18.5 Write property test for backup retention
  - **Property 37: Backup retention**
  - **Validates: Requirements 10.5**

- [x] 19. Implement Scheduled Worker for metrics aggregation
  - Add daily metrics aggregation task (midnight UTC trigger)
  - Implement usage_metrics table updates
  - Calculate daily statistics (generations, success rate, storage)
  - _Requirements: 9.2, 9.3_

- [x] 20. Create frontend React application structure
  - Initialize React + TypeScript project with Vite
  - Set up Tailwind CSS configuration
  - Create component structure: GeneratorForm, ImageDisplay, DailyVerse, Gallery, ShareModal
  - Set up React Context for state management
  - Configure routing (if needed)
  - _Requirements: 11.1, 11.2_

- [x] 21. Implement GeneratorForm component
  - Create form with verse reference input
  - Add style preset selector
  - Add optional custom prompt textarea
  - Implement form validation
  - Add loading state during generation
  - Handle API errors and display messages
  - _Requirements: 11.2, 11.3_

- [x] 22. Implement ImageDisplay component
  - Display generated image with responsive sizing
  - Add download button
  - Add WhatsApp share button
  - Implement Web Share API integration for mobile
  - Show verse reference and text
  - _Requirements: 11.4, 3.3, 3.4_

- [x] 23. Implement DailyVerse component
  - Fetch and display daily verse image on homepage
  - Add auto-refresh logic
  - Implement loading and error states
  - _Requirements: 4.5, 11.1_

- [x] 24. Implement Gallery component (optional for MVP)
  - Display user's generation history
  - Add pagination or infinite scroll
  - Implement image grid layout
  - Add filtering by verse or date
  - _Requirements: 11.1_

- [x] 25. Implement ShareModal component
  - Create modal with share options
  - Add WhatsApp share button with link generation
  - Implement copy-to-clipboard functionality
  - Add social media share buttons (future)
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 26. Implement responsive mobile layout
  - Add mobile-specific styles and breakpoints
  - Optimize touch interactions
  - Test on various screen sizes
  - Implement mobile-first design patterns
  - _Requirements: 11.5_

- [x] 27. Implement API client service in frontend
  - Create API client with typed request/response methods
  - Add error handling and retry logic
  - Implement request timeout handling
  - Add loading state management
  - _Requirements: 11.2, 11.3, 11.4_

- [x] 28. Configure Cloudflare Pages deployment
  - Create Pages project configuration
  - Set up build command and output directory
  - Configure environment variables
  - Add Pages Functions for API integration (if needed)
  - Enable edge caching for static assets
  - _Requirements: 6.5, 11.1_

- [x] 29. Create Wrangler configuration files
  - Configure wrangler.toml for Workers, R2, D1, KV, Durable Objects
  - Set up environment-specific configurations (dev, staging, production)
  - Add secrets configuration placeholders
  - Configure scheduled worker triggers
  - _Requirements: All (deployment)_

- [x] 30. Write integration tests for end-to-end flows
  - Test complete generation flow from API to storage
  - Test rate limiting with concurrent requests
  - Test cache behavior and fallback logic
  - Test scheduled worker execution
  - Test idempotency with duplicate requests
  - _Requirements: All (integration)_

- [x] 31. Set up local development environment
  - Configure Miniflare for local Workers testing
  - Set up local D1 database
  - Create mock R2 storage for development
  - Add development seed data
  - Document local setup instructions
  - _Requirements: All (development)_

- [x] 32. Create deployment scripts and documentation
  - Write deployment guide with step-by-step instructions
  - Create migration scripts for D1 schema updates
  - Add environment setup checklist
  - Document secret configuration
  - Create rollback procedures
  - _Requirements: All (operations)_

- [-] 33. Final checkpoint - Ensure all tests pass
  - Run complete test suite (unit + property + integration)
  - Verify all property-based tests run 100+ iterations
  - Check test coverage for critical paths
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: All_
