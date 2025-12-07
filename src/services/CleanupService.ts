/**
 * CleanupService: Manages image cleanup and backup operations
 * 
 * Responsibilities:
 * - Identify images eligible for cleanup based on age
 * - Exempt protected images (favorites, daily verses) from cleanup
 * - Create D1 database backups before cleanup
 * - Delete images from R2 and metadata from D1
 * - Manage backup retention
 */

import { ImageMetadata, ErrorCode } from '../types';

/**
 * Error thrown when cleanup operations fail
 */
export class CleanupError extends Error {
  code: ErrorCode;
  
  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = 'CleanupError';
    this.code = code;
  }
}

/**
 * Configuration for cleanup operations
 */
export interface CleanupConfig {
  retentionDays: number;
  backupRetentionDays: number;
  protectedTags: string[];
  dryRun?: boolean;
}

/**
 * Result of cleanup identification
 */
export interface CleanupIdentificationResult {
  eligibleImages: ImageMetadata[];
  protectedImages: ImageMetadata[];
  totalImages: number;
  totalEligible: number;
  totalProtected: number;
}

/**
 * Result of cleanup execution
 */
export interface CleanupExecutionResult {
  deletedCount: number;
  failedCount: number;
  deletedImageIds: string[];
  failedImageIds: string[];
  totalBytesFreed: number;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  backupId: string;
  timestamp: string;
  r2Key: string;
  sizeBytes: number;
  recordCount: number;
}

/**
 * Service for managing cleanup and backup operations
 */
export class CleanupService {
  private r2: R2Bucket;
  private db: D1Database;
  private config: CleanupConfig;
  
  /**
   * Creates a new CleanupService instance
   * @param r2 R2 bucket binding for image storage
   * @param db D1 database binding for metadata storage
   * @param config Cleanup configuration
   */
  constructor(r2: R2Bucket, db: D1Database, config: CleanupConfig) {
    this.r2 = r2;
    this.db = db;
    this.config = config;
  }
  
  /**
   * Identifies images eligible for cleanup based on age
   * 
   * Property 33: Age-based cleanup identification
   * For any image older than the retention threshold (excluding protected images),
   * the cleanup process should identify it for deletion.
   * 
   * @returns Promise resolving to cleanup identification result
   */
  async identifyCleanupCandidates(): Promise<CleanupIdentificationResult> {
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      const cutoffISO = cutoffDate.toISOString();
      
      // Query all images older than retention period
      const result = await this.db
        .prepare(`
          SELECT 
            id, user_id, verse_reference, verse_text, prompt, style_preset,
            r2_key, file_size, format, width, height, tags, moderation_status,
            generated_at
          FROM images
          WHERE generated_at < ?
          ORDER BY generated_at ASC
        `)
        .bind(cutoffISO)
        .all<{
          id: string;
          user_id: string | null;
          verse_reference: string;
          verse_text: string;
          prompt: string;
          style_preset: string;
          r2_key: string | null;
          file_size: number | null;
          format: string | null;
          width: number | null;
          height: number | null;
          tags: string;
          moderation_status: 'pending' | 'approved' | 'rejected';
          generated_at: string;
        }>();
      
      if (!result.results) {
        return {
          eligibleImages: [],
          protectedImages: [],
          totalImages: 0,
          totalEligible: 0,
          totalProtected: 0,
        };
      }
      
      // Convert to ImageMetadata and separate protected vs eligible
      const eligibleImages: ImageMetadata[] = [];
      const protectedImages: ImageMetadata[] = [];
      
      for (const row of result.results) {
        const metadata: ImageMetadata = {
          imageId: row.id,
          userId: row.user_id || undefined,
          verseReference: row.verse_reference,
          verseText: row.verse_text,
          prompt: row.prompt,
          stylePreset: row.style_preset,
          generatedAt: row.generated_at,
          tags: JSON.parse(row.tags),
          moderationStatus: row.moderation_status,
          r2Key: row.r2_key || undefined,
          fileSize: row.file_size || undefined,
          format: row.format || undefined,
          width: row.width || undefined,
          height: row.height || undefined,
        };
        
        // Check if image is protected
        if (this.isProtected(metadata)) {
          protectedImages.push(metadata);
        } else {
          eligibleImages.push(metadata);
        }
      }
      
      return {
        eligibleImages,
        protectedImages,
        totalImages: result.results.length,
        totalEligible: eligibleImages.length,
        totalProtected: protectedImages.length,
      };
    } catch (error) {
      console.error('Error identifying cleanup candidates:', error);
      throw new CleanupError(
        `Failed to identify cleanup candidates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.DATABASE_QUERY_FAILED
      );
    }
  }
  
  /**
   * Checks if an image is protected from cleanup
   * 
   * Property 35: Protected image exemption
   * For any image tagged as "favorite" or "daily-verse", it should not be
   * deleted during cleanup regardless of age.
   * 
   * @param metadata Image metadata
   * @returns True if image is protected
   */
  private isProtected(metadata: ImageMetadata): boolean {
    // Check if any of the image's tags match protected tags
    return metadata.tags.some(tag => this.config.protectedTags.includes(tag));
  }
  
  /**
   * Creates a backup of the D1 database to R2
   * 
   * Property 36: Backup before cleanup
   * For any cleanup operation, a D1 backup should be created and stored in R2
   * before any deletions occur.
   * 
   * @returns Promise resolving to backup metadata
   */
  async createBackup(): Promise<BackupMetadata> {
    try {
      // Generate backup ID and filename
      const timestamp = new Date().toISOString();
      const backupId = `backup-${timestamp.split('T')[0]}-${Date.now()}`;
      const r2Key = `backups/d1-${backupId}.json`;
      
      // Export all images metadata from D1
      const result = await this.db
        .prepare(`
          SELECT 
            id, user_id, verse_reference, verse_text, prompt, style_preset,
            r2_key, file_size, format, width, height, tags, moderation_status,
            generated_at, created_at
          FROM images
          ORDER BY created_at ASC
        `)
        .all();
      
      // Create backup data structure
      const backupData = {
        backupId,
        timestamp,
        version: '1.0',
        recordCount: result.results?.length || 0,
        records: result.results || [],
      };
      
      // Serialize to JSON
      const backupJson = JSON.stringify(backupData, null, 2);
      const backupBytes = new TextEncoder().encode(backupJson);
      
      // Store backup in R2
      await this.r2.put(r2Key, backupBytes, {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          backupId,
          timestamp,
          recordCount: backupData.recordCount.toString(),
        },
      });
      
      return {
        backupId,
        timestamp,
        r2Key,
        sizeBytes: backupBytes.byteLength,
        recordCount: backupData.recordCount,
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new CleanupError(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_WRITE_FAILED
      );
    }
  }
  
  /**
   * Executes cleanup by deleting images from R2 and metadata from D1
   * 
   * Property 34: Cleanup consistency
   * For any image deleted during cleanup, both the R2 object and the D1
   * metadata record should be removed.
   * 
   * @param imageIds Array of image IDs to delete
   * @returns Promise resolving to cleanup execution result
   */
  async executeCleanup(imageIds: string[]): Promise<CleanupExecutionResult> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] Would delete ${imageIds.length} images`);
      return {
        deletedCount: 0,
        failedCount: 0,
        deletedImageIds: [],
        failedImageIds: [],
        totalBytesFreed: 0,
      };
    }
    
    const deletedImageIds: string[] = [];
    const failedImageIds: string[] = [];
    let totalBytesFreed = 0;
    
    for (const imageId of imageIds) {
      try {
        // Get metadata to find R2 key and file size
        const metadata = await this.getMetadata(imageId);
        
        // Delete from R2
        if (metadata.r2Key) {
          await this.r2.delete(metadata.r2Key);
          if (metadata.fileSize) {
            totalBytesFreed += metadata.fileSize;
          }
        }
        
        // Delete metadata from D1
        await this.db
          .prepare('DELETE FROM images WHERE id = ?')
          .bind(imageId)
          .run();
        
        deletedImageIds.push(imageId);
      } catch (error) {
        console.error(`Error deleting image ${imageId}:`, error);
        failedImageIds.push(imageId);
      }
    }
    
    return {
      deletedCount: deletedImageIds.length,
      failedCount: failedImageIds.length,
      deletedImageIds,
      failedImageIds,
      totalBytesFreed,
    };
  }
  
  /**
   * Manages backup retention by deleting old backups
   * 
   * Property 37: Backup retention
   * For any backup created, it should remain in R2 for the defined retention
   * period before being eligible for deletion.
   * 
   * @returns Promise resolving to number of backups deleted
   */
  async manageBackupRetention(): Promise<number> {
    try {
      // Calculate cutoff date for backup retention
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.backupRetentionDays);
      
      // List all backups in R2
      const backupsList = await this.r2.list({ prefix: 'backups/' });
      
      let deletedCount = 0;
      
      for (const object of backupsList.objects) {
        // Check if backup is older than retention period
        if (object.uploaded && object.uploaded < cutoffDate) {
          if (!this.config.dryRun) {
            await this.r2.delete(object.key);
          }
          deletedCount++;
          console.log(`Deleted old backup: ${object.key}`);
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error managing backup retention:', error);
      throw new CleanupError(
        `Failed to manage backup retention: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_WRITE_FAILED
      );
    }
  }
  
  /**
   * Retrieves image metadata from D1 database
   * 
   * @param imageId Unique image identifier
   * @returns Promise resolving to the image metadata
   * @throws CleanupError if metadata is not found or retrieval fails
   */
  private async getMetadata(imageId: string): Promise<ImageMetadata> {
    try {
      const result = await this.db
        .prepare(`
          SELECT 
            id, user_id, verse_reference, verse_text, prompt, style_preset,
            r2_key, file_size, format, width, height, tags, moderation_status,
            generated_at
          FROM images
          WHERE id = ?
          LIMIT 1
        `)
        .bind(imageId)
        .first<{
          id: string;
          user_id: string | null;
          verse_reference: string;
          verse_text: string;
          prompt: string;
          style_preset: string;
          r2_key: string | null;
          file_size: number | null;
          format: string | null;
          width: number | null;
          height: number | null;
          tags: string;
          moderation_status: 'pending' | 'approved' | 'rejected';
          generated_at: string;
        }>();
      
      if (!result) {
        throw new CleanupError(
          `Image metadata not found: ${imageId}`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }
      
      return {
        imageId: result.id,
        userId: result.user_id || undefined,
        verseReference: result.verse_reference,
        verseText: result.verse_text,
        prompt: result.prompt,
        stylePreset: result.style_preset,
        generatedAt: result.generated_at,
        tags: JSON.parse(result.tags),
        moderationStatus: result.moderation_status,
        r2Key: result.r2_key || undefined,
        fileSize: result.file_size || undefined,
        format: result.format || undefined,
        width: result.width || undefined,
        height: result.height || undefined,
      };
    } catch (error) {
      if (error instanceof CleanupError) {
        throw error;
      }
      console.error('Error retrieving metadata:', error);
      throw new CleanupError(
        `Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.DATABASE_QUERY_FAILED
      );
    }
  }
  
  /**
   * Performs a complete cleanup cycle:
   * 1. Identify cleanup candidates
   * 2. Create backup
   * 3. Execute cleanup
   * 4. Manage backup retention
   * 
   * @returns Promise resolving to cleanup results
   */
  async performCleanupCycle(): Promise<{
    identification: CleanupIdentificationResult;
    backup: BackupMetadata;
    execution: CleanupExecutionResult;
    backupsDeleted: number;
  }> {
    console.log('Starting cleanup cycle...');
    
    // Step 1: Identify cleanup candidates
    console.log('Identifying cleanup candidates...');
    const identification = await this.identifyCleanupCandidates();
    console.log(`Found ${identification.totalEligible} eligible images, ${identification.totalProtected} protected`);
    
    // Step 2: Create backup before cleanup
    console.log('Creating backup...');
    const backup = await this.createBackup();
    console.log(`Backup created: ${backup.backupId} (${backup.recordCount} records)`);
    
    // Step 3: Execute cleanup
    console.log(`Executing cleanup for ${identification.totalEligible} images...`);
    const execution = await this.executeCleanup(
      identification.eligibleImages.map(img => img.imageId)
    );
    console.log(`Cleanup complete: ${execution.deletedCount} deleted, ${execution.failedCount} failed`);
    
    // Step 4: Manage backup retention
    console.log('Managing backup retention...');
    const backupsDeleted = await this.manageBackupRetention();
    console.log(`Deleted ${backupsDeleted} old backups`);
    
    return {
      identification,
      backup,
      execution,
      backupsDeleted,
    };
  }
}
