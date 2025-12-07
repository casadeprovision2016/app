/**
 * ModerationService: Handles content moderation and safety checks
 * 
 * Responsibilities:
 * - Run content safety checks on generated images
 * - Flag content for manual review
 * - Manage moderation queue in D1
 * - Process moderation decisions
 */

import { 
  ErrorCode, 
  ModerationStatus,
  ImageMetadata,
  ModerateContentRequest,
  ModerateContentResponse
} from '../types';

/**
 * Represents a moderation queue entry
 */
export interface ModerationQueueEntry {
  id?: number;
  imageId: string;
  flaggedReason: string;
  flaggedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  decision?: 'approve' | 'reject';
}

/**
 * Result of a content safety check
 */
export interface ContentSafetyResult {
  safe: boolean;
  reason?: string;
  confidence?: number;
}

/**
 * Configuration for content moderation
 */
export interface ModerationConfig {
  enableContentSafety?: boolean;
  autoApproveThreshold?: number;
  autoRejectThreshold?: number;
}

/**
 * Service for content moderation and safety checks
 */
export class ModerationService {
  private db: D1Database;
  private config: ModerationConfig;
  
  /**
   * Creates a new ModerationService instance
   * 
   * @param db D1 database instance
   * @param config Optional configuration overrides
   */
  constructor(db: D1Database, config?: ModerationConfig) {
    this.db = db;
    this.config = {
      enableContentSafety: config?.enableContentSafety ?? false,
      autoApproveThreshold: config?.autoApproveThreshold ?? 0.9,
      autoRejectThreshold: config?.autoRejectThreshold ?? 0.3,
    };
  }
  
  /**
   * Performs content safety check on generated image
   * 
   * This is a placeholder implementation. In production, this would integrate
   * with a content safety API (e.g., Cloudflare AI content moderation model).
   * 
   * @param imageData The image data to check
   * @param metadata The image metadata
   * @returns ContentSafetyResult indicating if the content is safe
   */
  async checkContentSafety(
    imageData: ArrayBuffer,
    metadata: ImageMetadata
  ): Promise<ContentSafetyResult> {
    if (!this.config.enableContentSafety) {
      // If content safety is disabled, always return safe
      return { safe: true };
    }
    
    // Placeholder implementation
    // In production, this would call a content safety API
    // For now, we'll do basic checks based on metadata
    
    // Check if the prompt or verse text contains concerning patterns
    const textToCheck = `${metadata.prompt} ${metadata.verseText}`.toLowerCase();
    
    // Simple keyword-based check (in production, use ML model)
    const concerningPatterns = [
      'violence', 'hate', 'explicit', 'inappropriate',
      'offensive', 'nsfw', 'gore', 'sexual'
    ];
    
    for (const pattern of concerningPatterns) {
      if (textToCheck.includes(pattern)) {
        return {
          safe: false,
          reason: `Content contains concerning pattern: ${pattern}`,
          confidence: 0.8,
        };
      }
    }
    
    return { safe: true, confidence: 0.95 };
  }
  
  /**
   * Flags content for manual review
   * 
   * Creates an entry in the moderation_queue table.
   * 
   * @param imageId The ID of the image to flag
   * @param reason The reason for flagging
   * @returns The created moderation queue entry
   */
  async flagForReview(imageId: string, reason: string): Promise<ModerationQueueEntry> {
    const flaggedAt = new Date().toISOString();
    
    const result = await this.db
      .prepare(
        `INSERT INTO moderation_queue (image_id, flagged_reason, flagged_at)
         VALUES (?, ?, ?)
         RETURNING id, image_id, flagged_reason, flagged_at`
      )
      .bind(imageId, reason, flaggedAt)
      .first<{
        id: number;
        image_id: string;
        flagged_reason: string;
        flagged_at: string;
      }>();
    
    if (!result) {
      throw new Error('Failed to create moderation queue entry');
    }
    
    return {
      id: result.id,
      imageId: result.image_id,
      flaggedReason: result.flagged_reason,
      flaggedAt: result.flagged_at,
    };
  }
  
  /**
   * Gets pending moderation queue entries
   * 
   * @param limit Maximum number of entries to return
   * @returns Array of pending moderation queue entries
   */
  async getPendingReviews(limit: number = 50): Promise<ModerationQueueEntry[]> {
    const results = await this.db
      .prepare(
        `SELECT id, image_id, flagged_reason, flagged_at, reviewed_at, reviewer_id, decision
         FROM moderation_queue
         WHERE reviewed_at IS NULL
         ORDER BY flagged_at ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<{
        id: number;
        image_id: string;
        flagged_reason: string;
        flagged_at: string;
        reviewed_at: string | null;
        reviewer_id: string | null;
        decision: string | null;
      }>();
    
    return results.results.map(row => ({
      id: row.id,
      imageId: row.image_id,
      flaggedReason: row.flagged_reason,
      flaggedAt: row.flagged_at,
      reviewedAt: row.reviewed_at || undefined,
      reviewerId: row.reviewer_id || undefined,
      decision: row.decision as 'approve' | 'reject' | undefined,
    }));
  }
  
  /**
   * Processes a moderation decision
   * 
   * Updates the moderation queue entry and the image's moderation status.
   * 
   * @param request The moderation request
   * @param reviewerId The ID of the reviewer making the decision
   * @returns ModerateContentResponse indicating success
   */
  async moderateContent(
    request: ModerateContentRequest,
    reviewerId?: string
  ): Promise<ModerateContentResponse> {
    const reviewedAt = new Date().toISOString();
    const newStatus: ModerationStatus = request.action === 'approve' ? 'approved' : 'rejected';
    
    // Start a transaction-like operation (D1 doesn't support transactions yet)
    // Update the moderation queue
    await this.db
      .prepare(
        `UPDATE moderation_queue
         SET reviewed_at = ?, reviewer_id = ?, decision = ?
         WHERE image_id = ? AND reviewed_at IS NULL`
      )
      .bind(reviewedAt, reviewerId || null, request.action, request.imageId)
      .run();
    
    // Update the image's moderation status
    await this.db
      .prepare(
        `UPDATE images
         SET moderation_status = ?
         WHERE id = ?`
      )
      .bind(newStatus, request.imageId)
      .run();
    
    return { success: true };
  }
  
  /**
   * Gets the moderation status of an image
   * 
   * @param imageId The ID of the image
   * @returns The moderation status
   */
  async getModerationStatus(imageId: string): Promise<ModerationStatus> {
    const result = await this.db
      .prepare(
        `SELECT moderation_status FROM images WHERE id = ?`
      )
      .bind(imageId)
      .first<{ moderation_status: string }>();
    
    if (!result) {
      throw new Error(`Image not found: ${imageId}`);
    }
    
    return result.moderation_status as ModerationStatus;
  }
  
  /**
   * Checks if an image should be stored based on content safety
   * 
   * Combines content safety check with moderation logic.
   * 
   * @param imageData The image data
   * @param metadata The image metadata
   * @returns Object indicating if storage should proceed and any actions needed
   */
  async shouldStoreImage(
    imageData: ArrayBuffer,
    metadata: ImageMetadata
  ): Promise<{
    shouldStore: boolean;
    moderationStatus: ModerationStatus;
    flagReason?: string;
  }> {
    const safetyResult = await this.checkContentSafety(imageData, metadata);
    
    if (!safetyResult.safe) {
      // Content failed safety check - do not store
      return {
        shouldStore: false,
        moderationStatus: 'rejected',
        flagReason: safetyResult.reason,
      };
    }
    
    // Content passed safety check
    return {
      shouldStore: true,
      moderationStatus: 'approved',
    };
  }
}
