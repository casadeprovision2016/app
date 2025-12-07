/**
 * Main API Worker for Bible Image Generator
 * 
 * Handles all API endpoints:
 * - POST /api/generate - Generate images from verses
 * - GET /api/images/:imageId - Retrieve image metadata
 * - GET /api/daily-verse - Get daily verse image
 * - GET /api/images/:imageId/share - Generate WhatsApp share link
 * - POST /api/admin/moderate - Moderate content (admin only)
 */

// Export Durable Objects
export { RateLimiter } from './durableObjects/RateLimiter';

import {
  ErrorCode,
  ErrorResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  GetImageResponse,
  DailyVerseResponse,
  ModerateContentRequest,
  ModerateContentResponse,
  LogEntry,
  UsageMetrics,
  StylePreset,
} from './types';

import {
  VerseService,
  ValidationService,
  ImageGenerationService,
  CacheService,
  StorageService,
  ModerationService,
} from './services';

/**
 * Router for handling different API endpoints
 */
class Router {
  private routes: Map<string, Map<string, (request: Request, env: Env, ctx: ExecutionContext, params: Record<string, string>) => Promise<Response>>> = new Map();

  add(method: string, pattern: RegExp, handler: (request: Request, env: Env, ctx: ExecutionContext, params: Record<string, string>) => Promise<Response>) {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(pattern.source, handler);
  }

  async route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) {
      return null;
    }

    for (const [patternSource, handler] of methodRoutes) {
      const pattern = new RegExp(patternSource);
      const match = path.match(pattern);
      if (match) {
        const params: Record<string, string> = {};
        if (match.groups) {
          Object.assign(params, match.groups);
        }
        return await handler(request, env, ctx, params);
      }
    }

    return null;
  }
}

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a standardized error response
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  status: number,
  details?: any,
  retryAfter?: number
): Response {
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      requestId,
      details: details,
      retryAfter,
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers,
  });
}

/**
 * Log an entry (in production, this would send to a logging service)
 */
function logEntry(entry: LogEntry, env: Env): void {
  // In development, log to console
  if (env.ENVIRONMENT === 'development') {
    console.log(JSON.stringify(entry));
  }
  // In production, this would send to a logging service like Logpush or external service
}

/**
 * Record usage metrics
 */
async function recordMetrics(
  env: Env,
  operation: string,
  success: boolean,
  duration: number,
  userId?: string
): Promise<void> {
  try {
    const date = new Date().toISOString().split('T')[0];
    
    // Update daily metrics in D1
    await env.DB.prepare(`
      INSERT INTO usage_metrics (date, total_generations, successful_generations, failed_generations)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_generations = total_generations + 1,
        successful_generations = successful_generations + ?,
        failed_generations = failed_generations + ?
    `)
      .bind(
        date,
        success ? 1 : 0,
        success ? 0 : 1,
        success ? 1 : 0,
        success ? 0 : 1
      )
      .run();
  } catch (error) {
    console.error('Error recording metrics:', error);
  }
}

/**
 * Apply CORS headers to response
 */
function applyCORS(response: Response, env: Env, origin: string | null): Response {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  // Check if origin is allowed
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  const headers = new Headers(response.headers);
  
  if (isAllowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Check rate limit using Durable Object
 */
async function checkRateLimit(
  env: Env,
  identifier: string,
  tier: 'anonymous' | 'authenticated'
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const id = env.RATE_LIMITER.idFromName(identifier);
  const stub = env.RATE_LIMITER.get(id);
  
  const response = await stub.fetch('http://internal/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }),
  });
  
  return await response.json();
}

/**
 * Generate WhatsApp share link
 */
function generateWhatsAppLink(imageUrl: string, verseReference: string, verseText: string): string {
  const message = `"${verseText}" - ${verseReference}\n${imageUrl}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Main fetch handler
 */
/**
 * Scheduled handler for daily verse generation
 * Triggered by cron schedule (e.g., "0 6 * * *" for 6 AM UTC daily)
 */
async function handleDailyVerse(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(`Daily verse task triggered at ${new Date(controller.scheduledTime).toISOString()}`);

  try {
    // Initialize services
    const verseService = new VerseService(env.DB);
    const imageGenService = new ImageGenerationService(env.AI);
    const storageService = new StorageService(env.R2_BUCKET, env.DB);
    const cacheService = new CacheService(env.KV_CACHE, env.DB);

    // Step 1: Select daily verse from D1 rotation
    console.log('Selecting daily verse...');
    const verse = await verseService.getDailyVerse();
    console.log(`Selected verse: ${verse.reference}`);

    // Step 2: Generate image with predefined daily style
    console.log('Generating daily verse image...');
    const dailyStyle: StylePreset = 'classic'; // Predefined style for daily verses
    const prompt = imageGenService.constructPrompt(verse, dailyStyle);
    
    const generatedImage = await imageGenService.generate({ prompt });
    console.log('Image generated successfully');

    // Step 3: Store image in R2 and metadata in D1
    console.log('Storing image...');
    const imageId = `daily-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    const r2Key = `images/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${imageId}.png`;

    await env.R2_BUCKET.put(r2Key, generatedImage.imageData, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });

    // Step 4: Store metadata with "daily-verse" tag
    const metadata = {
      imageId,
      verseReference: verse.reference,
      verseText: verse.text,
      prompt,
      stylePreset: dailyStyle,
      generatedAt: new Date().toISOString(),
      tags: ['daily-verse'], // Tag as daily verse
      moderationStatus: 'approved' as const,
      r2Key,
      fileSize: generatedImage.imageData.byteLength,
      format: 'png',
      width: generatedImage.metadata.dimensions.width,
      height: generatedImage.metadata.dimensions.height,
    };

    await env.DB.prepare(`
      INSERT INTO images (
        id, verse_reference, verse_text, prompt, style_preset,
        r2_key, file_size, format, width, height, tags,
        moderation_status, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        imageId,
        verse.reference,
        verse.text,
        prompt,
        dailyStyle,
        r2Key,
        metadata.fileSize,
        metadata.format,
        metadata.width,
        metadata.height,
        JSON.stringify(metadata.tags),
        metadata.moderationStatus,
        metadata.generatedAt,
        metadata.generatedAt
      )
      .run();

    // Step 5: Update KV cache with latest daily verse
    console.log('Updating cache...');
    await cacheService.setDailyVerse(imageId);
    await cacheService.setMetadata(imageId, metadata);

    console.log(`Daily verse generation completed successfully. Image ID: ${imageId}`);
  } catch (error) {
    console.error('Error generating daily verse:', error);
    
    // Log error for monitoring
    logEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: `scheduled-${controller.scheduledTime}`,
      operation: 'daily_verse_generation',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        stack: error instanceof Error ? error.stack || '' : '',
      },
    }, env);

    // Don't retry on failure (can be configured with controller.noRetry())
    // Let it try again on the next scheduled run
  }
}

/**
 * Scheduled handler for cleanup operations
 * Triggered by cron schedule (e.g., "0 2 * * 0" for 2 AM UTC every Sunday)
 */
async function handleCleanup(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(`Cleanup task triggered at ${new Date(controller.scheduledTime).toISOString()}`);
  console.log(`Cron pattern: ${controller.cron}`);

  try {
    // Import CleanupService
    const { CleanupService } = await import('./services');
    
    // Initialize cleanup service with configuration from environment
    const cleanupService = new CleanupService(env.R2_BUCKET, env.DB, {
      retentionDays: parseInt(env.IMAGE_RETENTION_DAYS || '90', 10),
      backupRetentionDays: parseInt(env.BACKUP_RETENTION_DAYS || '30', 10),
      protectedTags: ['daily-verse', 'favorite'],
      dryRun: false,
    });

    // Perform complete cleanup cycle
    const results = await cleanupService.performCleanupCycle();

    // Log results
    console.log('Cleanup cycle completed successfully');
    console.log(`- Images identified: ${results.identification.totalImages}`);
    console.log(`- Eligible for deletion: ${results.identification.totalEligible}`);
    console.log(`- Protected: ${results.identification.totalProtected}`);
    console.log(`- Backup created: ${results.backup.backupId} (${results.backup.recordCount} records)`);
    console.log(`- Images deleted: ${results.execution.deletedCount}`);
    console.log(`- Failed deletions: ${results.execution.failedCount}`);
    console.log(`- Bytes freed: ${results.execution.totalBytesFreed}`);
    console.log(`- Old backups deleted: ${results.backupsDeleted}`);

    // Log success for monitoring
    logEntry({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId: `scheduled-${controller.scheduledTime}`,
      operation: 'cleanup_cycle',
      metadata: {
        imagesDeleted: results.execution.deletedCount,
        imagesFailed: results.execution.failedCount,
        bytesFreed: results.execution.totalBytesFreed,
        backupId: results.backup.backupId,
        backupsDeleted: results.backupsDeleted,
      },
    }, env);
  } catch (error) {
    console.error('Error during cleanup cycle:', error);
    
    // Log error for monitoring
    logEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: `scheduled-${controller.scheduledTime}`,
      operation: 'cleanup_cycle',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        stack: error instanceof Error ? error.stack || '' : '',
      },
    }, env);

    // Don't retry on failure (can be configured with controller.noRetry())
    // Let it try again on the next scheduled run
  }
}

/**
 * Scheduled handler for metrics aggregation
 * Triggered by cron schedule (e.g., "0 0 * * *" for midnight UTC daily)
 */
async function handleMetricsAggregation(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(`Metrics aggregation task triggered at ${new Date(controller.scheduledTime).toISOString()}`);

  try {
    const date = new Date().toISOString().split('T')[0];
    
    // Step 1: Query current day's generation statistics from D1
    console.log('Aggregating generation statistics...');
    const generationStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_generations,
        SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as successful_generations,
        SUM(CASE WHEN moderation_status = 'rejected' THEN 1 ELSE 0 END) as failed_generations,
        SUM(file_size) as total_storage_bytes,
        COUNT(DISTINCT user_id) as unique_users
      FROM images
      WHERE DATE(created_at) = ?
    `).bind(date).first() as any;

    // Step 2: Calculate success rate
    const totalGenerations = Number(generationStats?.total_generations || 0);
    const successfulGenerations = Number(generationStats?.successful_generations || 0);
    const failedGenerations = Number(generationStats?.failed_generations || 0);
    const totalStorageBytes = Number(generationStats?.total_storage_bytes || 0);
    const uniqueUsers = Number(generationStats?.unique_users || 0);

    const successRate = totalGenerations > 0 
      ? ((successfulGenerations / totalGenerations) * 100).toFixed(2)
      : '0.00';

    console.log(`Statistics for ${date}:`);
    console.log(`- Total generations: ${totalGenerations}`);
    console.log(`- Successful: ${successfulGenerations}`);
    console.log(`- Failed: ${failedGenerations}`);
    console.log(`- Success rate: ${successRate}%`);
    console.log(`- Total storage: ${(totalStorageBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Unique users: ${uniqueUsers}`);

    // Step 3: Update usage_metrics table
    console.log('Updating usage_metrics table...');
    await env.DB.prepare(`
      INSERT INTO usage_metrics (
        date, 
        total_generations, 
        successful_generations, 
        failed_generations,
        total_storage_bytes,
        unique_users
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_generations = excluded.total_generations,
        successful_generations = excluded.successful_generations,
        failed_generations = excluded.failed_generations,
        total_storage_bytes = excluded.total_storage_bytes,
        unique_users = excluded.unique_users
    `)
      .bind(
        date,
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        totalStorageBytes,
        uniqueUsers
      )
      .run();

    console.log('Metrics aggregation completed successfully');

    // Log success for monitoring
    logEntry({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId: `scheduled-${controller.scheduledTime}`,
      operation: 'metrics_aggregation',
      metadata: {
        date,
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        successRate: parseFloat(successRate),
        totalStorageBytes,
        uniqueUsers,
      },
    }, env);
  } catch (error) {
    console.error('Error during metrics aggregation:', error);
    
    // Log error for monitoring
    logEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: `scheduled-${controller.scheduledTime}`,
      operation: 'metrics_aggregation',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        stack: error instanceof Error ? error.stack || '' : '',
      },
    }, env);
  }
}

/**
 * Main scheduled handler that routes to specific handlers based on cron pattern
 */
async function handleScheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(`Scheduled task triggered at ${new Date(controller.scheduledTime).toISOString()}`);
  console.log(`Cron pattern: ${controller.cron}`);

  // Route to appropriate handler based on cron pattern
  // Daily verse: "0 6 * * *" (6 AM UTC daily)
  // Cleanup: "0 2 * * 0" (2 AM UTC every Sunday)
  // Metrics aggregation: "0 0 * * *" (midnight UTC daily)
  
  if (controller.cron.includes('6 * * *')) {
    // Daily verse generation
    await handleDailyVerse(controller, env, ctx);
  } else if (controller.cron.includes('2 * * 0') || controller.cron.includes('cleanup')) {
    // Cleanup operations
    await handleCleanup(controller, env, ctx);
  } else if (controller.cron.includes('0 * * *') || controller.cron.includes('metrics')) {
    // Metrics aggregation
    await handleMetricsAggregation(controller, env, ctx);
  } else {
    console.warn(`Unknown cron pattern: ${controller.cron}`);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204 });
      return applyCORS(response, env, origin);
    }

    try {
      // Initialize services
      const verseService = new VerseService(env.DB);
      const validationService = new ValidationService(env.KV_CACHE);
      const imageGenService = new ImageGenerationService(env.AI);
      const cacheService = new CacheService(env.KV_CACHE, env.DB);
      const storageService = new StorageService(env.R2_BUCKET, env.DB);
      const moderationService = new ModerationService(env.DB, {
        enableContentSafety: (env.ENABLE_CONTENT_MODERATION as string) === 'true',
      });

      // Load blocklist
      await validationService.loadBlocklist();

      // Setup router
      const router = new Router();

      // GET / - Landing page
      router.add('GET', /^\/$/, async () => {
        const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bible Image Generator</title><style>body{font-family:Arial,Helvetica,sans-serif;line-height:1.5;margin:0;padding:32px;background:#f5f5f5;color:#111}main{max-width:720px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.08)}h1{margin-top:0;font-size:1.8rem}p{margin:0 0 12px}a{color:#0b6bcb;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}ul{padding-left:20px;margin:12px 0 0}</style></head><body><main><h1>Bible Image Generator API</h1><p>You are connected to the Worker. Key endpoints:</p><ul><li><a href="/api/daily-verse">GET /api/daily-verse</a></li><li><a href="/api/images/{imageId}">GET /api/images/{imageId}</a> (metadata)</li><li><a href="/api/images/{imageId}/data">GET /api/images/{imageId}/data</a> (image bytes)</li></ul><p>Use <code>npm run dev:remote</code> or <code>npm run dev</code> for local preview.</p></main></body></html>`;

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
          },
        });
      });

      // POST /internal/set-daily-verse
      // Development-only helper to set the daily verse KV key for preview/testing.
      router.add('POST', /^\/internal\/set-daily-verse$/, async (req, env, ctx, params) => {
        // Only allow in development to avoid exposing an open admin endpoint in production
        if ((env.ENVIRONMENT as string) !== 'development') {
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            'Not allowed',
            requestId,
            403
          );
        }

        let body: { imageId?: string };
        try {
          body = await req.json();
        } catch (err) {
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            'Invalid JSON body',
            requestId,
            400
          );
        }

        if (!body?.imageId) {
          return createErrorResponse(
            ErrorCode.MISSING_REQUIRED_FIELD,
            'Missing imageId',
            requestId,
            400
          );
        }

        try {
          await cacheService.setDailyVerse(body.imageId);
          return new Response(JSON.stringify({ success: true, imageId: body.imageId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error: any) {
          return createErrorResponse(
            ErrorCode.INTERNAL_SERVER_ERROR,
            'Failed to set daily verse',
            requestId,
            500
          );
        }
      });

      // POST /api/generate
      router.add('POST', /^\/api\/generate$/, async (req, env, ctx, params) => {
        const operation = 'generate_image';
        let body: GenerateImageRequest;

        try {
          body = await req.json() as GenerateImageRequest;
        } catch (error) {
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            'Invalid JSON in request body',
            requestId,
            400
          );
        }

        // Validate request
        const validation = validationService.validateGenerationRequest(body);
        if (!validation.valid) {
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'warn',
            requestId,
            operation,
            error: {
              message: 'Validation failed',
              code: ErrorCode.INVALID_REQUEST_FORMAT,
              stack: '',
            },
            metadata: { errors: validation.errors },
          }, env);

          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            validation.errors?.join(', ') || 'Validation failed',
            requestId,
            400,
            { errors: validation.errors }
          );
        }

        // Check rate limit
        const clientIp = req.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitResult = await checkRateLimit(env, clientIp, 'anonymous');

        if (!rateLimitResult.allowed) {
          const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
          
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'warn',
            requestId,
            operation,
            metadata: { clientIp, rateLimitResult },
          }, env);

          return createErrorResponse(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded. Please try again later.',
            requestId,
            429,
            undefined,
            retryAfter
          );
        }

        // Check for idempotency
        if (body.requestId) {
          const cachedResult = await cacheService.getMetadata(body.requestId);
          if (cachedResult) {
            // Return cached result
            const imageUrl = `${url.origin}/api/images/${cachedResult.imageId}`;
            const whatsappShareUrl = generateWhatsAppLink(
              imageUrl,
              cachedResult.verseReference,
              cachedResult.verseText
            );

            return new Response(JSON.stringify({
              imageId: cachedResult.imageId,
              imageUrl,
              whatsappShareUrl,
              verseReference: cachedResult.verseReference,
              verseText: cachedResult.verseText,
            } as GenerateImageResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        // Get verse
        let verse;
        try {
          if (body.verseText) {
            // Use provided verse text
            const parsed = body.verseReference.match(/^((?:\d\s)?[A-Za-z\s]+)\s+(\d+):(\d+)$/);
            if (!parsed) {
              throw new Error('Invalid verse reference format');
            }
            verse = {
              reference: body.verseReference,
              text: body.verseText,
              book: parsed[1].trim(),
              chapter: parseInt(parsed[2], 10),
              verse: parseInt(parsed[3], 10),
              translation: 'NIV',
            };
          } else {
            verse = await verseService.getVerse(body.verseReference);
          }
        } catch (error: any) {
          return createErrorResponse(
            ErrorCode.INVALID_VERSE_REFERENCE,
            error.message || 'Verse not found',
            requestId,
            404
          );
        }

        // Construct prompt
        const stylePreset = body.stylePreset || 'modern';
        let prompt = imageGenService.constructPrompt(verse, stylePreset);

        // Add custom prompt if provided
        if (body.customPrompt) {
          const sanitized = validationService.sanitizePrompt(body.customPrompt);
          prompt = `${prompt}, ${sanitized}`;
        }

        // Generate image
        let generatedImage;
        try {
          generatedImage = await imageGenService.generate({ prompt });
        } catch (error: any) {
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'error',
            requestId,
            operation,
            error: {
              message: error.message,
              code: error.code || ErrorCode.MODEL_INFERENCE_FAILED,
              stack: error.stack || '',
            },
          }, env);

          await recordMetrics(env, operation, false, Date.now() - startTime);

          return createErrorResponse(
            error.code || ErrorCode.MODEL_INFERENCE_FAILED,
            error.message || 'Image generation failed',
            requestId,
            error.code === ErrorCode.AI_SERVICE_TIMEOUT ? 504 : 502,
            { details: error.details }
          );
        }

        // Store image in R2
        const imageId = body.requestId || `img_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const r2Key = `images/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${imageId}.png`;

        try {
          await env.R2_BUCKET.put(r2Key, generatedImage.imageData, {
            httpMetadata: {
              contentType: 'image/png',
            },
          });
        } catch (error: any) {
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'error',
            requestId,
            operation,
            error: {
              message: 'Failed to store image in R2',
              code: ErrorCode.STORAGE_WRITE_FAILED,
              stack: error.stack || '',
            },
          }, env);

          await recordMetrics(env, operation, false, Date.now() - startTime);

          return createErrorResponse(
            ErrorCode.STORAGE_WRITE_FAILED,
            'Failed to store generated image',
            requestId,
            500
          );
        }

        // Store metadata in D1
        const metadata = {
          imageId,
          verseReference: verse.reference,
          verseText: verse.text,
          prompt,
          stylePreset,
          generatedAt: new Date().toISOString(),
          tags: [] as string[],
          moderationStatus: 'approved' as const,
          r2Key,
          fileSize: generatedImage.imageData.byteLength,
          format: 'png',
          width: generatedImage.metadata.dimensions.width,
          height: generatedImage.metadata.dimensions.height,
        };

        try {
          await env.DB.prepare(`
            INSERT INTO images (
              id, verse_reference, verse_text, prompt, style_preset,
              r2_key, file_size, format, width, height, tags,
              moderation_status, generated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              imageId,
              verse.reference,
              verse.text,
              prompt,
              stylePreset,
              r2Key,
              metadata.fileSize,
              metadata.format,
              metadata.width,
              metadata.height,
              JSON.stringify(metadata.tags),
              metadata.moderationStatus,
              metadata.generatedAt,
              metadata.generatedAt
            )
            .run();

          // Cache metadata
          await cacheService.setMetadata(imageId, metadata);
        } catch (error: any) {
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'error',
            requestId,
            operation,
            error: {
              message: 'Failed to store metadata in D1',
              code: ErrorCode.DATABASE_QUERY_FAILED,
              stack: error.stack || '',
            },
          }, env);

          await recordMetrics(env, operation, false, Date.now() - startTime);

          return createErrorResponse(
            ErrorCode.DATABASE_QUERY_FAILED,
            'Failed to store image metadata',
            requestId,
            500
          );
        }

        // Record success metrics
        await recordMetrics(env, operation, true, Date.now() - startTime);

        // Log success
        logEntry({
          timestamp: new Date().toISOString(),
          level: 'info',
          requestId,
          operation,
          duration: Date.now() - startTime,
          metadata: { imageId, verseReference: verse.reference },
        }, env);

        // Return response
        const imageUrl = `${url.origin}/api/images/${imageId}`;
        const whatsappShareUrl = generateWhatsAppLink(imageUrl, verse.reference, verse.text);

        return new Response(JSON.stringify({
          imageId,
          imageUrl,
          whatsappShareUrl,
          verseReference: verse.reference,
          verseText: verse.text,
        } as GenerateImageResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // GET /api/images/:imageId
      router.add('GET', /^\/api\/images\/(?<imageId>[^\/]+)$/, async (req, env, ctx, params) => {
        const imageId = params.imageId;

        // Get metadata
        const metadata = await cacheService.getMetadata(imageId);
        if (!metadata) {
          return createErrorResponse(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Image not found',
            requestId,
            404
          );
        }

        const imageUrl = `${url.origin}/api/images/${imageId}`;

        return new Response(JSON.stringify({
          imageId,
          imageUrl,
          metadata,
        } as GetImageResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      
      // GET /api/images/:imageId/data - Serve actual image with caching headers
      router.add('GET', /^\/api\/images\/(?<imageId>[^\/]+)\/data$/, async (req, env, ctx, params) => {
        const imageId = params.imageId;

        try {
          // Get image with R2 metadata
          const r2Object = await storageService.getImageWithMetadata(imageId);
          
          // Check for conditional request (ETag)
          if (r2Object.etag && storageService.checkETagMatch(req, r2Object.etag)) {
            // Resource not modified, return 304
            const headers = new Headers();
            headers.set('ETag', r2Object.etag);
            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            
            return new Response(null, {
              status: 304,
              headers,
            });
          }
          
          // Generate cache headers
          const cacheHeaders = storageService.generateCacheHeaders(r2Object);
          
          // Return image with caching headers
          return new Response(r2Object.body, {
            status: 200,
            headers: cacheHeaders,
          });
        } catch (error: any) {
          return createErrorResponse(
            error.code || ErrorCode.RESOURCE_NOT_FOUND,
            error.message || 'Image not found',
            requestId,
            404
          );
        }
      });

      // GET /api/daily-verse
      router.add('GET', /^\/api\/daily-verse$/, async (req, env, ctx, params) => {
        // Get daily verse from cache
        const dailyVerseId = await cacheService.getDailyVerse();

        if (dailyVerseId) {
          const metadata = await cacheService.getMetadata(dailyVerseId);
          if (metadata) {
            const imageUrl = `${url.origin}/api/images/${dailyVerseId}`;

            return new Response(JSON.stringify({
              imageId: dailyVerseId,
              imageUrl,
              verseReference: metadata.verseReference,
              verseText: metadata.verseText,
              generatedAt: metadata.generatedAt,
            } as DailyVerseResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        // No daily verse cached, return error
        return createErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Daily verse not yet generated',
          requestId,
          404
        );
      });

      // GET /api/images/:imageId/share
      router.add('GET', /^\/api\/images\/(?<imageId>[^\/]+)\/share$/, async (req, env, ctx, params) => {
        const imageId = params.imageId;

        // Get metadata
        const metadata = await cacheService.getMetadata(imageId);
        if (!metadata) {
          return createErrorResponse(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Image not found',
            requestId,
            404
          );
        }

        const imageUrl = `${url.origin}/api/images/${imageId}`;
        const whatsappShareUrl = generateWhatsAppLink(
          imageUrl,
          metadata.verseReference,
          metadata.verseText
        );

        // Redirect to WhatsApp
        return Response.redirect(whatsappShareUrl, 302);
      });

      // POST /api/admin/moderate
      router.add('POST', /^\/api\/admin\/moderate$/, async (req, env, ctx, params) => {
        // TODO: Add authentication check
        // For now, this is a placeholder
        // In production, verify JWT token or admin API key

        let body: ModerateContentRequest;
        try {
          body = await req.json() as ModerateContentRequest;
        } catch (error) {
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            'Invalid JSON in request body',
            requestId,
            400
          );
        }

        // Validate request
        if (!body.imageId || !body.action) {
          return createErrorResponse(
            ErrorCode.MISSING_REQUIRED_FIELD,
            'Missing required fields: imageId and action',
            requestId,
            400
          );
        }

        if (body.action !== 'approve' && body.action !== 'reject') {
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_FORMAT,
            'Invalid action. Must be "approve" or "reject"',
            requestId,
            400
          );
        }

        // Process moderation decision using ModerationService
        try {
          const result = await moderationService.moderateContent(body);

          // Invalidate cache
          await cacheService.invalidateMetadata(body.imageId);

          // Log moderation action
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'info',
            requestId,
            operation: 'moderate_content',
            metadata: {
              imageId: body.imageId,
              action: body.action,
              reason: body.reason,
            },
          }, env);

          return new Response(JSON.stringify({
            success: result.success,
          } as ModerateContentResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error: any) {
          logEntry({
            timestamp: new Date().toISOString(),
            level: 'error',
            requestId,
            operation: 'moderate_content',
            error: {
              message: error.message || 'Moderation failed',
              code: ErrorCode.DATABASE_QUERY_FAILED,
              stack: error.stack || '',
            },
          }, env);

          return createErrorResponse(
            ErrorCode.DATABASE_QUERY_FAILED,
            'Failed to update moderation status',
            requestId,
            500
          );
        }
      });

      // Route the request
      const response = await router.route(request, env, ctx);

      if (response) {
        return applyCORS(response, env, origin);
      }

      // No route matched
      return applyCORS(
        createErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Endpoint not found',
          requestId,
          404
        ),
        env,
        origin
      );
    } catch (error: any) {
      // Log unexpected error
      logEntry({
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId,
        operation: 'fetch',
        error: {
          message: error.message || 'Unknown error',
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          stack: error.stack || '',
        },
      }, env);

      return applyCORS(
        createErrorResponse(
          ErrorCode.INTERNAL_SERVER_ERROR,
          'Internal server error',
          requestId,
          500
        ),
        env,
        origin
      );
    }
  },

  /**
   * Scheduled handler for cron-triggered tasks
   * Configure in wrangler.json with triggers like:
   * "triggers": { "crons": ["0 6 * * *"] }
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<Env>;
