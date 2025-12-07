# Requirements Document

## Introduction

This document specifies the requirements for a Bible Image Generator application that creates AI-generated images based on biblical verses using Cloudflare Workers AI (flux-2-dev model). The system enables users to generate inspirational images with scripture text and share them via WhatsApp. The application leverages Cloudflare's serverless infrastructure (Workers, R2, D1, Pages) to provide a scalable, cost-effective solution with a generous free tier.

## Glossary

- **Image Generator**: The system component responsible for creating images using AI models
- **Workers AI**: Cloudflare's AI inference service that runs the flux-2-dev model
- **flux-2-dev**: The AI model used for text-to-image generation
- **R2**: Cloudflare's S3-compatible object storage service for storing generated images
- **D1**: Cloudflare's serverless SQLite database for storing metadata
- **Workers KV**: Cloudflare's key-value storage for caching and configuration
- **Durable Objects**: Cloudflare's stateful coordination service for rate limiting and job management
- **Pages**: Cloudflare's static site hosting with integrated serverless functions
- **Scheduled Worker**: A Cloudflare Worker triggered on a schedule (cron-like)
- **User**: An individual who generates and shares biblical images
- **Prompt**: The text input that describes the desired image characteristics
- **Verse**: A biblical scripture reference and its text content
- **Share Link**: A URL formatted for WhatsApp sharing

## Requirements

### Requirement 1

**User Story:** As a user, I want to generate AI images based on biblical verses, so that I can create inspirational visual content for sharing.

#### Acceptance Criteria

1. WHEN a user submits a verse reference and optional style preferences THEN the Image Generator SHALL create a prompt combining the verse text with style parameters
2. WHEN the Image Generator receives a valid prompt THEN the system SHALL invoke Workers AI with the flux-2-dev model to generate an image
3. WHEN the image generation completes successfully THEN the system SHALL return the generated image within 30 seconds
4. WHEN the image generation fails THEN the system SHALL return a descriptive error message and log the failure details
5. WHERE a user provides custom prompt text THEN the Image Generator SHALL sanitize the input to remove potentially harmful content before processing

### Requirement 2

**User Story:** As a user, I want generated images to be stored reliably, so that I can access and share them later.

#### Acceptance Criteria

1. WHEN an image is successfully generated THEN the system SHALL store the image in R2 with a unique identifier
2. WHEN storing an image THEN the system SHALL generate a filename using a combination of user identifier, timestamp, and cryptographic hash to ensure uniqueness
3. WHEN an image is stored THEN the system SHALL save associated metadata in D1 including verse reference, generation timestamp, user identifier, and prompt parameters
4. WHEN a user requests a previously generated image THEN the system SHALL retrieve it from R2 using the stored identifier
5. WHEN retrieving image metadata THEN the system SHALL query D1 and cache frequently accessed records in Workers KV

### Requirement 3

**User Story:** As a user, I want to share generated images via WhatsApp, so that I can easily distribute inspirational content to my contacts.

#### Acceptance Criteria

1. WHEN an image generation completes THEN the system SHALL generate a public URL for the image
2. WHEN a user requests a WhatsApp share link THEN the system SHALL create a formatted wa.me URL with the image URL and verse text
3. WHEN the share link is accessed on a mobile device THEN the system SHALL enable the Web Share API to open the native sharing dialog
4. WHEN a user clicks the WhatsApp share button THEN the system SHALL open WhatsApp with pre-populated message text and image link
5. WHERE a user requires private image sharing THEN the system SHALL generate signed URLs with expiration timestamps

### Requirement 4

**User Story:** As a system administrator, I want automated daily verse image generation, so that users receive fresh inspirational content regularly.

#### Acceptance Criteria

1. WHEN the scheduled time arrives THEN the Scheduled Worker SHALL trigger the daily verse generation process
2. WHEN the daily generation process runs THEN the system SHALL select a verse from a curated list or database
3. WHEN the verse is selected THEN the system SHALL generate an image using predefined style parameters
4. WHEN the daily image is generated THEN the system SHALL store it with a "daily-verse" tag in the metadata
5. WHEN users access the application THEN the system SHALL display the most recent daily verse image prominently

### Requirement 5

**User Story:** As a system administrator, I want to prevent abuse and manage costs, so that the service remains available and within budget.

#### Acceptance Criteria

1. WHEN a user makes generation requests THEN the system SHALL enforce rate limits using Durable Objects to track request counts per user
2. WHEN a rate limit is exceeded THEN the system SHALL reject the request with a 429 status code and indicate the retry-after time
3. WHEN anonymous users access the service THEN the system SHALL apply stricter rate limits than authenticated users
4. WHEN the system detects suspicious patterns THEN the system SHALL implement progressive rate limiting or temporary blocks
5. WHERE Turnstile CAPTCHA is enabled THEN the system SHALL require CAPTCHA verification for high-frequency requesters

### Requirement 6

**User Story:** As a user, I want the application to be fast and responsive, so that I can generate and share images without delays.

#### Acceptance Criteria

1. WHEN serving previously generated images THEN the system SHALL use CDN caching with appropriate Cache-Control headers
2. WHEN frequently accessed metadata is requested THEN the system SHALL serve it from Workers KV cache before querying D1
3. WHEN generating images THEN the system SHALL optimize prompt parameters to balance quality and generation speed
4. WHEN images are stored THEN the system SHALL use WebP format when browser support is detected to reduce file size
5. WHEN the frontend loads THEN Pages SHALL serve static assets with edge caching enabled

### Requirement 7

**User Story:** As a system administrator, I want content moderation capabilities, so that inappropriate content is prevented from being generated or shared.

#### Acceptance Criteria

1. WHEN a user submits a prompt THEN the system SHALL validate it against a blocklist of inappropriate terms
2. WHEN a prompt contains prohibited content THEN the system SHALL reject the request with an appropriate error message
3. WHEN an image is generated THEN the system SHALL optionally run content safety checks before storing
4. WHEN inappropriate content is detected THEN the system SHALL log the incident and prevent storage or sharing
5. WHERE manual review is required THEN the system SHALL flag content for administrator review in D1

### Requirement 8

**User Story:** As a developer, I want secure credential management, so that API keys and secrets are never exposed.

#### Acceptance Criteria

1. WHEN Workers access external services THEN the system SHALL retrieve credentials from Workers Secrets or environment variables
2. WHEN the frontend communicates with the backend THEN the system SHALL enforce CORS policies restricting allowed origins
3. WHERE authentication is required THEN the system SHALL validate JWT tokens or use Cloudflare Access for protected routes
4. WHEN storing sensitive data THEN the system SHALL never include API keys or secrets in client-side code or logs
5. WHEN deploying the application THEN the system SHALL use separate environment configurations for development and production

### Requirement 9

**User Story:** As a system administrator, I want monitoring and observability, so that I can track usage, costs, and system health.

#### Acceptance Criteria

1. WHEN errors occur THEN the system SHALL log detailed error information including stack traces and context
2. WHEN generation requests are processed THEN the system SHALL record metrics including request count, success rate, and latency
3. WHEN storage operations complete THEN the system SHALL track R2 and D1 usage to estimate costs
4. WHEN rate limits are triggered THEN the system SHALL log the events for analysis and adjustment
5. WHERE usage approaches quota limits THEN the system SHALL send alerts to administrators

### Requirement 10

**User Story:** As a system administrator, I want data retention and cleanup policies, so that storage costs remain manageable.

#### Acceptance Criteria

1. WHEN images reach a defined age threshold THEN the Scheduled Worker SHALL identify them for potential deletion
2. WHEN cleanup runs THEN the system SHALL remove images from R2 and corresponding metadata from D1
3. WHERE images are marked as favorites or daily verses THEN the system SHALL exempt them from automatic deletion
4. WHEN performing cleanup THEN the system SHALL create backup snapshots of D1 data to R2 before deletion
5. WHEN backups are created THEN the system SHALL retain them according to the defined retention policy

### Requirement 11

**User Story:** As a user, I want a responsive web interface, so that I can easily generate and manage images from any device.

#### Acceptance Criteria

1. WHEN a user accesses the application THEN Pages SHALL serve a responsive single-page application
2. WHEN the interface loads THEN the system SHALL display input fields for verse reference and style options
3. WHEN a user submits a generation request THEN the interface SHALL show a loading indicator during processing
4. WHEN generation completes THEN the interface SHALL display the generated image with share options
5. WHEN viewing on mobile devices THEN the interface SHALL adapt layout and controls for touch interaction

### Requirement 12

**User Story:** As a developer, I want idempotent operations, so that retries do not create duplicate resources.

#### Acceptance Criteria

1. WHEN a generation request includes a request identifier THEN the system SHALL check for existing results before processing
2. WHEN a duplicate request is detected THEN the system SHALL return the existing result without regenerating
3. WHEN storing images THEN the system SHALL use deterministic naming based on request parameters to prevent duplicates
4. WHEN network failures occur THEN the system SHALL support safe retries without side effects
5. WHERE concurrent requests arrive THEN Durable Objects SHALL coordinate to prevent race conditions
