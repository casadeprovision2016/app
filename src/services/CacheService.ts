/**
 * CacheService: Manages Workers KV caching operations
 * 
 * Responsibilities:
 * - Cache-first metadata retrieval with D1 fallback
 * - Cache invalidation logic
 * - Daily verse caching
 * - Configuration data storage (rate limits, style presets, blocklist)
 */

import { ImageMetadata, Verse, StylePreset } from '../types';

/**
 * Configuration for cache TTLs (in seconds)
 */
export interface CacheConfig {
  metadataTTL?: number;        // Default: 1 hour
  dailyVerseTTL?: number;      // Default: 24 hours
  configTTL?: number;          // Default: 1 week
  verseTTL?: number;           // Default: 1 hour
}

/**
 * Default cache TTL values (in seconds)
 */
const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  metadataTTL: 3600,           // 1 hour
  dailyVerseTTL: 86400,        // 24 hours
  configTTL: 604800,           // 1 week
  verseTTL: 3600,              // 1 hour
};

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  anonymous: number;
  authenticated: number;
}

/**
 * Style preset configuration
 */
export interface StylePresetConfig {
  [key: string]: {
    name: StylePreset;
    description: string;
    promptModifiers: string;
  };
}

/**
 * Service for managing Workers KV cache operations
 */
export class CacheService {
  private kv: KVNamespace;
  private db?: D1Database;
  private config: Required<CacheConfig>;
  
  /**
   * Creates a new CacheService instance
   * 
   * @param kv Workers KV namespace binding
   * @param db Optional D1 database binding for fallback queries
   * @param config Optional cache configuration overrides
   */
  constructor(kv: KVNamespace, db?: D1Database, config?: CacheConfig) {
    this.kv = kv;
    this.db = db;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }
  
  // ============================================================================
  // Metadata Caching
  // ============================================================================
  
  /**
   * Retrieves image metadata with cache-first strategy
   * 
   * Attempts to retrieve from KV cache first. If not found or expired,
   * falls back to D1 database and updates the cache.
   * 
   * @param imageId The image identifier
   * @returns Promise resolving to ImageMetadata or undefined if not found
   */
  async getMetadata(imageId: string): Promise<ImageMetadata | undefined> {
    // Try cache first
    const cacheKey = this.getMetadataKey(imageId);
    const cached = await this.kv.get(cacheKey, 'json');
    
    if (cached) {
      return cached as ImageMetadata;
    }
    
    // Cache miss - fallback to D1
    if (!this.db) {
      return undefined;
    }
    
    try {
      const result = await this.db
        .prepare(`
          SELECT 
            id as imageId,
            user_id as userId,
            verse_reference as verseReference,
            verse_text as verseText,
            prompt,
            style_preset as stylePreset,
            generated_at as generatedAt,
            tags,
            moderation_status as moderationStatus,
            r2_key as r2Key,
            file_size as fileSize,
            format,
            width,
            height
          FROM images
          WHERE id = ?
          LIMIT 1
        `)
        .bind(imageId)
        .first<{
          imageId: string;
          userId?: string;
          verseReference: string;
          verseText: string;
          prompt: string;
          stylePreset: string;
          generatedAt: string;
          tags: string;
          moderationStatus: string;
          r2Key?: string;
          fileSize?: number;
          format?: string;
          width?: number;
          height?: number;
        }>();
      
      if (!result) {
        return undefined;
      }
      
      // Parse tags from JSON string
      const tags = result.tags ? JSON.parse(result.tags) : [];
      
      const metadata: ImageMetadata = {
        imageId: result.imageId,
        userId: result.userId,
        verseReference: result.verseReference,
        verseText: result.verseText,
        prompt: result.prompt,
        stylePreset: result.stylePreset,
        generatedAt: result.generatedAt,
        tags,
        moderationStatus: result.moderationStatus as "pending" | "approved" | "rejected",
        r2Key: result.r2Key,
        fileSize: result.fileSize,
        format: result.format,
        width: result.width,
        height: result.height,
      };
      
      // Update cache for future requests
      await this.setMetadata(imageId, metadata);
      
      return metadata;
    } catch (error) {
      console.error('Error fetching metadata from D1:', error);
      return undefined;
    }
  }
  
  /**
   * Stores image metadata in cache
   * 
   * @param imageId The image identifier
   * @param metadata The metadata to cache
   * @returns Promise that resolves when the cache is updated
   */
  async setMetadata(imageId: string, metadata: ImageMetadata): Promise<void> {
    const cacheKey = this.getMetadataKey(imageId);
    await this.kv.put(
      cacheKey,
      JSON.stringify(metadata),
      { expirationTtl: this.config.metadataTTL }
    );
  }
  
  /**
   * Invalidates cached metadata for an image
   * 
   * @param imageId The image identifier
   * @returns Promise that resolves when the cache is invalidated
   */
  async invalidateMetadata(imageId: string): Promise<void> {
    const cacheKey = this.getMetadataKey(imageId);
    await this.kv.delete(cacheKey);
  }
  
  /**
   * Generates the cache key for image metadata
   * 
   * @param imageId The image identifier
   * @returns Cache key string
   */
  private getMetadataKey(imageId: string): string {
    return `metadata:${imageId}`;
  }
  
  // ============================================================================
  // Daily Verse Caching
  // ============================================================================
  
  /**
   * Retrieves the current daily verse from cache
   * 
   * @returns Promise resolving to the daily verse image ID or undefined
   */
  async getDailyVerse(): Promise<string | undefined> {
    const cacheKey = 'daily-verse:current';
    const result = await this.kv.get(cacheKey);
    return result ?? undefined;
  }
  
  /**
   * Sets the current daily verse in cache
   * 
   * @param imageId The image identifier for the daily verse
   * @returns Promise that resolves when the cache is updated
   */
  async setDailyVerse(imageId: string): Promise<void> {
    const cacheKey = 'daily-verse:current';
    await this.kv.put(
      cacheKey,
      imageId,
      { expirationTtl: this.config.dailyVerseTTL }
    );
  }
  
  /**
   * Invalidates the daily verse cache
   * 
   * @returns Promise that resolves when the cache is invalidated
   */
  async invalidateDailyVerse(): Promise<void> {
    const cacheKey = 'daily-verse:current';
    await this.kv.delete(cacheKey);
  }
  
  // ============================================================================
  // Verse Caching
  // ============================================================================
  
  /**
   * Retrieves a cached verse by reference
   * 
   * @param reference The verse reference (e.g., "John 3:16")
   * @returns Promise resolving to the Verse or undefined if not cached
   */
  async getVerse(reference: string): Promise<Verse | undefined> {
    const cacheKey = this.getVerseKey(reference);
    const cached = await this.kv.get(cacheKey, 'json');
    
    if (cached) {
      return cached as Verse;
    }
    
    return undefined;
  }
  
  /**
   * Caches a verse by reference
   * 
   * @param reference The verse reference
   * @param verse The verse data to cache
   * @returns Promise that resolves when the cache is updated
   */
  async setVerse(reference: string, verse: Verse): Promise<void> {
    const cacheKey = this.getVerseKey(reference);
    await this.kv.put(
      cacheKey,
      JSON.stringify(verse),
      { expirationTtl: this.config.verseTTL }
    );
  }
  
  /**
   * Generates the cache key for a verse
   * 
   * @param reference The verse reference
   * @returns Cache key string
   */
  private getVerseKey(reference: string): string {
    // Normalize the reference for consistent caching
    const normalized = reference.trim().toLowerCase();
    return `verse:${normalized}`;
  }
  
  // ============================================================================
  // Configuration Caching
  // ============================================================================
  
  /**
   * Retrieves rate limit configuration from cache
   * 
   * @returns Promise resolving to RateLimitConfig or undefined
   */
  async getRateLimitConfig(): Promise<RateLimitConfig | undefined> {
    const cacheKey = 'config:rate-limits';
    const cached = await this.kv.get(cacheKey, 'json');
    
    if (cached) {
      return cached as RateLimitConfig;
    }
    
    return undefined;
  }
  
  /**
   * Stores rate limit configuration in cache
   * 
   * @param config The rate limit configuration
   * @returns Promise that resolves when the cache is updated
   */
  async setRateLimitConfig(config: RateLimitConfig): Promise<void> {
    const cacheKey = 'config:rate-limits';
    await this.kv.put(
      cacheKey,
      JSON.stringify(config),
      { expirationTtl: this.config.configTTL }
    );
  }
  
  /**
   * Retrieves style preset configuration from cache
   * 
   * @returns Promise resolving to StylePresetConfig or undefined
   */
  async getStylePresetConfig(): Promise<StylePresetConfig | undefined> {
    const cacheKey = 'config:style-presets';
    const cached = await this.kv.get(cacheKey, 'json');
    
    if (cached) {
      return cached as StylePresetConfig;
    }
    
    return undefined;
  }
  
  /**
   * Stores style preset configuration in cache
   * 
   * @param config The style preset configuration
   * @returns Promise that resolves when the cache is updated
   */
  async setStylePresetConfig(config: StylePresetConfig): Promise<void> {
    const cacheKey = 'config:style-presets';
    await this.kv.put(
      cacheKey,
      JSON.stringify(config),
      { expirationTtl: this.config.configTTL }
    );
  }
  
  /**
   * Retrieves moderation blocklist from cache
   * 
   * @returns Promise resolving to array of blocked terms or undefined
   */
  async getBlocklist(): Promise<string[] | undefined> {
    const cacheKey = 'config:moderation-blocklist';
    const cached = await this.kv.get(cacheKey, 'json');
    
    if (cached) {
      return cached as string[];
    }
    
    return undefined;
  }
  
  /**
   * Stores moderation blocklist in cache
   * 
   * @param blocklist Array of blocked terms
   * @returns Promise that resolves when the cache is updated
   */
  async setBlocklist(blocklist: string[]): Promise<void> {
    const cacheKey = 'config:moderation-blocklist';
    await this.kv.put(
      cacheKey,
      JSON.stringify(blocklist),
      { expirationTtl: this.config.configTTL }
    );
  }
  
  // ============================================================================
  // Bulk Operations
  // ============================================================================
  
  /**
   * Invalidates all cached data for a specific image
   * 
   * Removes metadata and any related cached entries.
   * 
   * @param imageId The image identifier
   * @returns Promise that resolves when all caches are invalidated
   */
  async invalidateImage(imageId: string): Promise<void> {
    await this.invalidateMetadata(imageId);
  }
  
  /**
   * Clears all configuration caches
   * 
   * Forces reload of rate limits, style presets, and blocklist.
   * 
   * @returns Promise that resolves when all config caches are cleared
   */
  async clearConfigCache(): Promise<void> {
    await Promise.all([
      this.kv.delete('config:rate-limits'),
      this.kv.delete('config:style-presets'),
      this.kv.delete('config:moderation-blocklist'),
    ]);
  }
}
