/**
 * Mock R2 Storage for Local Development
 * 
 * This module provides a simple file-system based mock for R2 storage
 * to use during local development when you don't want to use real R2.
 * 
 * Usage in tests:
 * ```typescript
 * import { MockR2Bucket } from './scripts/mock-r2-local';
 * const bucket = new MockR2Bucket('./test-storage');
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class MockR2Bucket {
  private basePath: string;

  constructor(basePath: string = './.wrangler/state/v3/r2/mock-storage') {
    this.basePath = basePath;
    this.ensureDirectory(this.basePath);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.basePath, sanitizedKey);
  }

  async put(key: string, value: ArrayBuffer | ReadableStream): Promise<void> {
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);
    this.ensureDirectory(dir);

    if (value instanceof ArrayBuffer) {
      const buffer = Buffer.from(value);
      fs.writeFileSync(filePath, buffer);
    } else {
      // Handle ReadableStream
      const chunks: Buffer[] = [];
      const reader = value.getReader();
      
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(chunk));
      }
      
      fs.writeFileSync(filePath, Buffer.concat(chunks));
    }
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const filePath = this.getFilePath(key);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<string[]> {
    const prefix = options?.prefix || '';
    const limit = options?.limit || 1000;
    
    const files: string[] = [];
    
    const walk = (dir: string, baseDir: string = this.basePath): void => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          walk(fullPath, baseDir);
        } else {
          const relativePath = path.relative(baseDir, fullPath);
          const normalizedPath = relativePath.replace(/\\/g, '/');
          
          if (normalizedPath.startsWith(prefix)) {
            files.push(normalizedPath);
            if (files.length >= limit) return;
          }
        }
      }
    };
    
    walk(this.basePath);
    return files.slice(0, limit);
  }

  async head(key: string): Promise<{ size: number; etag: string } | null> {
    const filePath = this.getFilePath(key);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    
    return {
      size: stats.size,
      etag: hash,
    };
  }

  async clear(): Promise<void> {
    if (fs.existsSync(this.basePath)) {
      fs.rmSync(this.basePath, { recursive: true, force: true });
    }
    this.ensureDirectory(this.basePath);
  }
}

/**
 * Create a mock R2 bucket for testing
 */
export function createMockR2Bucket(basePath?: string): MockR2Bucket {
  return new MockR2Bucket(basePath);
}
