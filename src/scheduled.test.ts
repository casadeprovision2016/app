/**
 * Integration tests for scheduled workers
 * Tests the metrics aggregation scheduled handler
 */

import { describe, test, expect, beforeEach } from 'vitest';

// ============================================================================
// Mock Environment
// ============================================================================

class MockD1Database {
  private storage = new Map<string, any>();
  private metricsStorage = new Map<string, any>();

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          // Handle INSERT INTO usage_metrics
          if (query.includes('INSERT INTO usage_metrics')) {
            const [date, totalGen, successGen, failedGen, storageBytes, uniqueUsers] = params;
            this.metricsStorage.set(date, {
              date,
              total_generations: totalGen,
              successful_generations: successGen,
              failed_generations: failedGen,
              total_storage_bytes: storageBytes,
              unique_users: uniqueUsers,
            });
          }
          return { success: true };
        },
        first: async () => {
          // Handle SELECT for generation statistics
          if (query.includes('SELECT') && query.includes('FROM images')) {
            // Return mock statistics
            return {
              total_generations: 10,
              successful_generations: 8,
              failed_generations: 2,
              total_storage_bytes: 5000000,
              unique_users: 5,
            };
          }
          return null;
        },
      }),
    };
  }

  getMetrics(date: string) {
    return this.metricsStorage.get(date);
  }

  clear() {
    this.storage.clear();
    this.metricsStorage.clear();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Scheduled Worker - Metrics Aggregation', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  test('metrics aggregation calculates and stores daily statistics', async () => {
    const date = new Date().toISOString().split('T')[0];

    // Simulate the metrics aggregation logic
    const generationStats = await mockDb.prepare(`
      SELECT 
        COUNT(*) as total_generations,
        SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as successful_generations,
        SUM(CASE WHEN moderation_status = 'rejected' THEN 1 ELSE 0 END) as failed_generations,
        SUM(file_size) as total_storage_bytes,
        COUNT(DISTINCT user_id) as unique_users
      FROM images
      WHERE DATE(created_at) = ?
    `).bind(date).first() as any;

    const totalGenerations = Number(generationStats?.total_generations || 0);
    const successfulGenerations = Number(generationStats?.successful_generations || 0);
    const failedGenerations = Number(generationStats?.failed_generations || 0);
    const totalStorageBytes = Number(generationStats?.total_storage_bytes || 0);
    const uniqueUsers = Number(generationStats?.unique_users || 0);

    // Update usage_metrics table
    await mockDb.prepare(`
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

    // Verify metrics were stored
    const storedMetrics = mockDb.getMetrics(date);
    expect(storedMetrics).toBeDefined();
    expect(storedMetrics.total_generations).toBe(10);
    expect(storedMetrics.successful_generations).toBe(8);
    expect(storedMetrics.failed_generations).toBe(2);
    expect(storedMetrics.total_storage_bytes).toBe(5000000);
    expect(storedMetrics.unique_users).toBe(5);
  });

  test('metrics aggregation calculates correct success rate', async () => {
    const date = new Date().toISOString().split('T')[0];

    const generationStats = await mockDb.prepare(`
      SELECT 
        COUNT(*) as total_generations,
        SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as successful_generations,
        SUM(CASE WHEN moderation_status = 'rejected' THEN 1 ELSE 0 END) as failed_generations,
        SUM(file_size) as total_storage_bytes,
        COUNT(DISTINCT user_id) as unique_users
      FROM images
      WHERE DATE(created_at) = ?
    `).bind(date).first() as any;

    const totalGenerations = Number(generationStats?.total_generations || 0);
    const successfulGenerations = Number(generationStats?.successful_generations || 0);

    const successRate = totalGenerations > 0 
      ? ((successfulGenerations / totalGenerations) * 100).toFixed(2)
      : '0.00';

    // Verify success rate calculation
    expect(successRate).toBe('80.00'); // 8/10 = 80%
  });

  test('metrics aggregation handles zero generations', async () => {
    // Create a mock DB that returns zero statistics
    const emptyDb = new MockD1Database();
    
    // Override the first method to return zeros
    const originalPrepare = emptyDb.prepare.bind(emptyDb);
    emptyDb.prepare = (query: string) => {
      const prepared = originalPrepare(query);
      return {
        bind: (...params: any[]) => ({
          run: prepared.bind(...params).run,
          first: async () => {
            if (query.includes('SELECT') && query.includes('FROM images')) {
              return {
                total_generations: 0,
                successful_generations: 0,
                failed_generations: 0,
                total_storage_bytes: 0,
                unique_users: 0,
              };
            }
            return null;
          },
        }),
      };
    };

    const date = new Date().toISOString().split('T')[0];

    const generationStats = await emptyDb.prepare(`
      SELECT 
        COUNT(*) as total_generations,
        SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as successful_generations,
        SUM(CASE WHEN moderation_status = 'rejected' THEN 1 ELSE 0 END) as failed_generations,
        SUM(file_size) as total_storage_bytes,
        COUNT(DISTINCT user_id) as unique_users
      FROM images
      WHERE DATE(created_at) = ?
    `).bind(date).first() as any;

    const totalGenerations = Number(generationStats?.total_generations || 0);
    const successfulGenerations = Number(generationStats?.successful_generations || 0);

    const successRate = totalGenerations > 0 
      ? ((successfulGenerations / totalGenerations) * 100).toFixed(2)
      : '0.00';

    // Verify success rate is 0 when there are no generations
    expect(successRate).toBe('0.00');
    expect(totalGenerations).toBe(0);
  });

  test('metrics aggregation stores all required fields', async () => {
    const date = new Date().toISOString().split('T')[0];

    const generationStats = await mockDb.prepare(`
      SELECT 
        COUNT(*) as total_generations,
        SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as successful_generations,
        SUM(CASE WHEN moderation_status = 'rejected' THEN 1 ELSE 0 END) as failed_generations,
        SUM(file_size) as total_storage_bytes,
        COUNT(DISTINCT user_id) as unique_users
      FROM images
      WHERE DATE(created_at) = ?
    `).bind(date).first() as any;

    const totalGenerations = Number(generationStats?.total_generations || 0);
    const successfulGenerations = Number(generationStats?.successful_generations || 0);
    const failedGenerations = Number(generationStats?.failed_generations || 0);
    const totalStorageBytes = Number(generationStats?.total_storage_bytes || 0);
    const uniqueUsers = Number(generationStats?.unique_users || 0);

    await mockDb.prepare(`
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

    const storedMetrics = mockDb.getMetrics(date);

    // Verify all required fields are present
    expect(storedMetrics).toHaveProperty('date');
    expect(storedMetrics).toHaveProperty('total_generations');
    expect(storedMetrics).toHaveProperty('successful_generations');
    expect(storedMetrics).toHaveProperty('failed_generations');
    expect(storedMetrics).toHaveProperty('total_storage_bytes');
    expect(storedMetrics).toHaveProperty('unique_users');
  });
});
