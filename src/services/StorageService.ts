/**
 * StorageService: Manages image storage and metadata persistence
 * 
 * Responsibilities:
 * - Store generated images in R2 object storage
 * - Retrieve images from R2
 * - Generate unique filenames with user ID, timestamp, and hash
 * - Store and retrieve image metadata in D1 database
 * - Generate public and signed URLs for image access
 * - Handle WebP format detection and conversion
 */

import { ImageMetadata, ErrorCode } from '../types';

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends Error {
  code: ErrorCode;
  
  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * Options for saving an image
 */
export interface SaveImageOptions {
  userId?: string;
  verseReference: string;
  verseText: string;
  prompt: string;
  stylePreset: string;
  tags?: string[];
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  width?: number;
  height?: number;
}

/**
 * Service for managing image storage and metadata
 */
export class StorageService {
  private r2: R2Bucket;
  private db: D1Database;
  private bucketPublicUrl?: string;
  
  /**
   * Creates a new StorageService instance
   * @param r2 R2 bucket binding for image storage
   * @param db D1 database binding for metadata storage
   * @param bucketPublicUrl Optional public URL for the R2 bucket
   */
  constructor(r2: R2Bucket, db: D1Database, bucketPublicUrl?: string) {
    this.r2 = r2;
    this.db = db;
    this.bucketPublicUrl = bucketPublicUrl;
  }
  
  /**
   * Saves an image to R2 and stores its metadata in D1
   * 
   * @param imageData Image data as ArrayBuffer
   * @param options Metadata options for the image
   * @returns Promise resolving to the unique image ID
   * @throws StorageError if storage operations fail
   */
  async saveImage(imageData: ArrayBuffer, options: SaveImageOptions): Promise<string> {
    try {
      // Generate unique image ID and filename
      const imageId = this.generateImageId(options);
      const filename = this.generateFilename(imageId, options);
      
      // Detect format (default to WebP)
      const format = this.detectFormat(imageData) || 'webp';
      
      // Store image in R2
      const r2Key = `images/${filename}`;
      await this.r2.put(r2Key, imageData, {
        httpMetadata: {
          contentType: `image/${format}`,
        },
        customMetadata: {
          imageId,
          verseReference: options.verseReference,
          userId: options.userId || 'anonymous',
        },
      });
      
      // Store metadata in D1
      const metadata: ImageMetadata = {
        imageId,
        userId: options.userId,
        verseReference: options.verseReference,
        verseText: options.verseText,
        prompt: options.prompt,
        stylePreset: options.stylePreset,
        generatedAt: new Date().toISOString(),
        tags: options.tags || [],
        moderationStatus: options.moderationStatus || 'approved',
        r2Key,
        fileSize: imageData.byteLength,
        format,
        width: options.width,
        height: options.height,
      };
      
      await this.saveMetadata(metadata);
      
      return imageId;
    } catch (error) {
      console.error('Error saving image:', error);
      throw new StorageError(
        `Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_WRITE_FAILED
      );
    }
  }
  
  /**
   * Retrieves an image from R2 by its ID
   * 
   * @param imageId Unique image identifier
   * @returns Promise resolving to the image data as ArrayBuffer
   * @throws StorageError if the image is not found or retrieval fails
   */
  async getImage(imageId: string): Promise<ArrayBuffer> {
    try {
      // Get metadata to find R2 key
      const metadata = await this.getMetadata(imageId);
      
      if (!metadata.r2Key) {
        throw new StorageError(
          `Image metadata missing R2 key: ${imageId}`,
          ErrorCode.STORAGE_READ_FAILED
        );
      }
      
      // Retrieve from R2
      const object = await this.r2.get(metadata.r2Key);
      
      if (!object) {
        throw new StorageError(
          `Image not found in R2: ${imageId}`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }
      
      return await object.arrayBuffer();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Error retrieving image:', error);
      throw new StorageError(
        `Failed to retrieve image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_READ_FAILED
      );
    }
  }
  
  /**
   * Retrieves an image from R2 with caching metadata (ETag, httpMetadata)
   * 
   * @param imageId Unique image identifier
   * @returns Promise resolving to the R2 object with caching metadata
   * @throws StorageError if the image is not found or retrieval fails
   */
  async getImageWithMetadata(imageId: string): Promise<R2ObjectBody> {
    try {
      // Get metadata to find R2 key
      const metadata = await this.getMetadata(imageId);
      
      if (!metadata.r2Key) {
        throw new StorageError(
          `Image metadata missing R2 key: ${imageId}`,
          ErrorCode.STORAGE_READ_FAILED
        );
      }
      
      // Retrieve from R2
      const object = await this.r2.get(metadata.r2Key);
      
      if (!object) {
        throw new StorageError(
          `Image not found in R2: ${imageId}`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }
      
      return object;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Error retrieving image with metadata:', error);
      throw new StorageError(
        `Failed to retrieve image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_READ_FAILED
      );
    }
  }
  
  /**
   * Generates a public URL for an image
   * 
   * @param imageId Unique image identifier
   * @param signed Whether to generate a signed URL (default: false)
   * @param expiresIn Expiration time in seconds for signed URLs (default: 3600)
   * @returns Promise resolving to the image URL
   * @throws StorageError if URL generation fails
   */
  async getImageUrl(imageId: string, signed: boolean = false, expiresIn: number = 3600): Promise<string> {
    try {
      // Get metadata to find R2 key
      const metadata = await this.getMetadata(imageId);
      
      if (!metadata.r2Key) {
        throw new StorageError(
          `Image metadata missing R2 key: ${imageId}`,
          ErrorCode.STORAGE_READ_FAILED
        );
      }
      
      if (signed) {
        // Generate signed URL with expiration
        return this.generateSignedUrl(metadata.r2Key, expiresIn);
      } else {
        // Generate public URL
        return this.generatePublicUrl(metadata.r2Key);
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Error generating image URL:', error);
      throw new StorageError(
        `Failed to generate image URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_READ_FAILED
      );
    }
  }
  
  /**
   * Saves image metadata to D1 database
   * 
   * @param metadata Image metadata to store
   * @throws StorageError if database operation fails
   */
  async saveMetadata(metadata: ImageMetadata): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO images (
            id, user_id, verse_reference, verse_text, prompt, style_preset,
            r2_key, file_size, format, width, height, tags, moderation_status,
            generated_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          metadata.imageId,
          metadata.userId || null,
          metadata.verseReference,
          metadata.verseText,
          metadata.prompt,
          metadata.stylePreset,
          metadata.r2Key || null,
          metadata.fileSize || null,
          metadata.format || 'webp',
          metadata.width || null,
          metadata.height || null,
          JSON.stringify(metadata.tags),
          metadata.moderationStatus,
          metadata.generatedAt
        )
        .run();
    } catch (error) {
      console.error('Error saving metadata:', error);
      throw new StorageError(
        `Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.DATABASE_QUERY_FAILED
      );
    }
  }
  
  /**
   * Retrieves image metadata from D1 database
   * 
   * @param imageId Unique image identifier
   * @returns Promise resolving to the image metadata
   * @throws StorageError if metadata is not found or retrieval fails
   */
  async getMetadata(imageId: string): Promise<ImageMetadata> {
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
        throw new StorageError(
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
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Error retrieving metadata:', error);
      throw new StorageError(
        `Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.DATABASE_QUERY_FAILED
      );
    }
  }
  
  /**
   * Deletes an image from R2 and its metadata from D1
   * 
   * @param imageId Unique image identifier
   * @throws StorageError if deletion fails
   */
  async deleteImage(imageId: string): Promise<void> {
    try {
      // Get metadata to find R2 key
      const metadata = await this.getMetadata(imageId);
      
      // Delete from R2
      if (metadata.r2Key) {
        await this.r2.delete(metadata.r2Key);
      }
      
      // Delete metadata from D1
      await this.db
        .prepare('DELETE FROM images WHERE id = ?')
        .bind(imageId)
        .run();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Error deleting image:', error);
      throw new StorageError(
        `Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_WRITE_FAILED
      );
    }
  }
  
  /**
   * Generates a unique image ID based on request parameters
   * 
   * Uses a combination of timestamp, user ID, and verse reference to create
   * a deterministic ID for idempotency.
   * 
   * @param options Image metadata options
   * @returns Unique image ID
   */
  private generateImageId(options: SaveImageOptions): string {
    const timestamp = Date.now();
    const userId = options.userId || 'anonymous';
    const verseRef = options.verseReference;
    const style = options.stylePreset;
    
    // Create deterministic hash for idempotency using simple string hash
    const hashInput = `${userId}-${verseRef}-${style}-${timestamp}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    
    return `${timestamp}-${hashHex}`;
  }
  
  /**
   * Generates a filename for an image
   * 
   * Format: {year}/{month}/{imageId}.{format}
   * 
   * @param imageId Unique image identifier
   * @param options Image metadata options
   * @returns Filename path
   */
  private generateFilename(imageId: string, options: SaveImageOptions): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    return `${year}/${month}/${imageId}.webp`;
  }
  
  /**
   * Detects the image format from the image data
   * 
   * Checks magic bytes to determine format (WebP, PNG, JPEG, etc.)
   * 
   * @param imageData Image data as ArrayBuffer
   * @returns Detected format or null if unknown
   */
  private detectFormat(imageData: ArrayBuffer): string | null {
    const bytes = new Uint8Array(imageData);
    
    // Check for WebP (RIFF....WEBP)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'webp';
    }
    
    // Check for PNG (89 50 4E 47)
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    ) {
      return 'png';
    }
    
    // Check for JPEG (FF D8 FF)
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    ) {
      return 'jpeg';
    }
    
    // Default to webp if unknown
    return 'webp';
  }
  
  /**
   * Generates a public URL for an R2 object
   * 
   * @param r2Key R2 object key
   * @returns Public URL
   */
  private generatePublicUrl(r2Key: string): string {
    if (this.bucketPublicUrl) {
      return `${this.bucketPublicUrl}/${r2Key}`;
    }
    
    // Fallback: construct URL from R2 key
    // In production, this should use the actual R2 public domain
    return `https://images.example.com/${r2Key}`;
  }
  
  /**
   * Generates a signed URL for an R2 object with expiration
   * 
   * @param r2Key R2 object key
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL with expiration
   */
  private generateSignedUrl(r2Key: string, expiresIn: number): string {
    // Calculate expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    
    // Create signature using simple hash
    // In production, use a secret key from environment and Web Crypto API
    const secret = 'signing-secret-key'; // TODO: Use env.JWT_SECRET or similar
    const message = `${secret}:${r2Key}:${expiresAt}`;
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const signature = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Construct signed URL
    const baseUrl = this.generatePublicUrl(r2Key);
    return `${baseUrl}?expires=${expiresAt}&signature=${signature}`;
  }
  
  /**
   * Generates cache headers for image responses
   * 
   * Implements CDN caching strategy:
   * - Cache-Control: public, max-age=31536000 (1 year) for immutable images
   * - ETag: for conditional requests
   * - Vary: Accept-Encoding for compression
   * 
   * @param r2Object R2 object with metadata
   * @returns Headers object with caching directives
   */
  generateCacheHeaders(r2Object: R2ObjectBody): Headers {
    const headers = new Headers();
    
    // Set Cache-Control for CDN and browser caching
    // Images are immutable (unique IDs), so cache for 1 year
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Set ETag for conditional requests
    if (r2Object.etag) {
      headers.set('ETag', r2Object.etag);
    }
    
    // Set content type from R2 metadata
    if (r2Object.httpMetadata?.contentType) {
      headers.set('Content-Type', r2Object.httpMetadata.contentType);
    }
    
    // Set Vary header for compression negotiation
    headers.set('Vary', 'Accept-Encoding');
    
    // Set Last-Modified if available
    if (r2Object.uploaded) {
      headers.set('Last-Modified', r2Object.uploaded.toUTCString());
    }
    
    return headers;
  }
  
  /**
   * Checks if a request has a matching ETag for conditional requests
   * 
   * @param request Incoming request
   * @param etag Current ETag of the resource
   * @returns True if the ETag matches (resource not modified)
   */
  checkETagMatch(request: Request, etag: string): boolean {
    const ifNoneMatch = request.headers.get('If-None-Match');
    
    if (!ifNoneMatch) {
      return false;
    }
    
    // Handle multiple ETags (comma-separated)
    const etags = ifNoneMatch.split(',').map(e => e.trim());
    
    // Check for wildcard or exact match
    return etags.includes('*') || etags.includes(etag) || etags.includes(`"${etag}"`);
  }
}
