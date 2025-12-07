/**
 * Core data models and types for Bible Image Generator
 */

// ============================================================================
// Domain Models
// ============================================================================

/**
 * Represents a biblical verse with its reference and text
 */
export interface Verse {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  translation: string;
}

/**
 * Metadata associated with a generated image
 */
export interface ImageMetadata {
  imageId: string;
  userId?: string;
  verseReference: string;
  verseText: string;
  prompt: string;
  stylePreset: string;
  generatedAt: string;
  tags: string[];
  moderationStatus: "pending" | "approved" | "rejected";
  r2Key?: string;
  fileSize?: number;
  format?: string;
  width?: number;
  height?: number;
}

/**
 * Parameters for AI image generation
 */
export interface GenerationParams {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
}

/**
 * Result of an AI image generation operation
 */
export interface GeneratedImage {
  imageData: ArrayBuffer;
  format: string;
  metadata: {
    model: string;
    seed: number;
    dimensions: { width: number; height: number };
    duration?: number;
  };
}

/**
 * Style preset options for image generation
 */
export type StylePreset = "modern" | "classic" | "minimalist" | "artistic";

/**
 * User tier for rate limiting
 */
export type UserTier = "anonymous" | "authenticated";

/**
 * Moderation status for content
 */
export type ModerationStatus = "pending" | "approved" | "rejected";

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request body for POST /api/generate
 */
export interface GenerateImageRequest {
  verseReference: string;
  verseText?: string;
  stylePreset?: StylePreset;
  customPrompt?: string;
  requestId?: string;
}

/**
 * Request body for POST /api/admin/moderate
 */
export interface ModerateContentRequest {
  imageId: string;
  action: "approve" | "reject";
  reason?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for POST /api/generate
 */
export interface GenerateImageResponse {
  imageId: string;
  imageUrl: string;
  whatsappShareUrl: string;
  verseReference: string;
  verseText: string;
}

/**
 * Response for GET /api/images/:imageId
 */
export interface GetImageResponse {
  imageId: string;
  imageUrl: string;
  metadata: ImageMetadata;
}

/**
 * Response for GET /api/daily-verse
 */
export interface DailyVerseResponse {
  imageId: string;
  imageUrl: string;
  verseReference: string;
  verseText: string;
  generatedAt: string;
}

/**
 * Response for POST /api/admin/moderate
 */
export interface ModerateContentResponse {
  success: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for the application
 */
export enum ErrorCode {
  // Validation errors (400)
  INVALID_VERSE_REFERENCE = "INVALID_VERSE_REFERENCE",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  BLOCKED_CONTENT = "BLOCKED_CONTENT",
  INVALID_STYLE_PRESET = "INVALID_STYLE_PRESET",
  INVALID_REQUEST_FORMAT = "INVALID_REQUEST_FORMAT",

  // Authentication errors (401/403)
  MISSING_AUTH_TOKEN = "MISSING_AUTH_TOKEN",
  INVALID_AUTH_TOKEN = "INVALID_AUTH_TOKEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // AI service errors (502/503)
  AI_SERVICE_TIMEOUT = "AI_SERVICE_TIMEOUT",
  AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE",
  MODEL_INFERENCE_FAILED = "MODEL_INFERENCE_FAILED",

  // Storage errors (500)
  STORAGE_WRITE_FAILED = "STORAGE_WRITE_FAILED",
  STORAGE_READ_FAILED = "STORAGE_READ_FAILED",
  DATABASE_QUERY_FAILED = "DATABASE_QUERY_FAILED",
  CACHE_OPERATION_FAILED = "CACHE_OPERATION_FAILED",

  // Content moderation errors (451)
  CONTENT_FLAGGED = "CONTENT_FLAGGED",
  MODERATION_REJECTED = "MODERATION_REJECTED",

  // General errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    requestId: string;
    retryAfter?: number;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  captchaRequired?: boolean;
}

/**
 * Result of input validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Data for Web Share API
 */
export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  requestId: string;
  userId?: string;
  operation: string;
  duration?: number;
  error?: {
    message: string;
    stack: string;
    code: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Usage metrics data
 */
export interface UsageMetrics {
  date: string;
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  totalStorageBytes: number;
  uniqueUsers: number;
}
