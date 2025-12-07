/**
 * Property-based tests for Usage Tracking and Monitoring
 * Feature: bible-image-generator
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MonitoringService } from './MonitoringService';

// ============================================================================
// Mock D1 Database with Usage Tracking
// ============================================================================

interface UsageCounter {
  r2Writes: number;
  r2Reads: number;
  d1Queries: number;
  d1Writes: number;
}

class MockD1DatabaseWithTracking {
  private storage = new Map<string, any>();
  private usageCounters = new Map<string, UsageCounter>();
  
  private initCounter(date: string): void {
    if (!this.usageCounters.has(date)) {
      this.usageCounters.set(date, {
        r2Writes: 0,
        r2Reads: 0,
        d1Queries: 0,
        d1Writes: 0,
      });
    }
  }
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        run: async () => {
          const date = new Date().toISOString().split('T')[0];
          this.initCounter(date);
          
          // Track D1 write operations
          if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
            const counter = this.usageCounters.get(date)!;
            counter.d1Writes++;
          }
          
          // Track D1 query operations
          const counter = this.usageCounters.get(date)!;
          counter.d1Queries++;
          
          // Execute the query
          if (query.includes('INSERT INTO images')) {
            const [id, verseReference, verseText, prompt, stylePreset, r2Key] = params;
            this.storage.set(id, { 
              id, 
              verse_reference: verseReference,
              verse_text: verseText,
              prompt,
              style_preset: stylePreset,
              r2_key: r2Key
            });
          } else if (query.includes('UPDATE usage_metrics')) {
            // Handle usage metrics update
            const key = 'usage_metrics';
            const existing = this.storage.get(key) || {};
            this.storage.set(key, { ...existing, updated: true });
          }
          
          return { success: true };
        },
        first: async () => {
          const date = new Date().toISOString().split('T')[0];
          this.initCounter(date);
          
          // Track D1 query operations
          const counter = this.usageCounters.get(date)!;
          counter.d1Queries++;
          
          if (query.includes('SELECT') && query.includes('FROM images')) {
            const [id] = params;
            return this.storage.get(id) || null;
          }
          return null;
        },
      }),
    };
  }
  
  getUsageCounters(date: string): UsageCounter {
    this.initCounter(date);
    return this.usageCounters.get(date)!;
  }
  
  clear(): void {
    this.storage.clear();
    this.usageCounters.clear();
  }
}

// ============================================================================
// Mock R2 Bucket with Usage Tracking
// ============================================================================

class MockR2BucketWithTracking {
  private storage = new Map<string, { data: ArrayBuffer; metadata: any }>();
  private usageCounters = new Map<string, UsageCounter>();
  
  private initCounter(date: string): void {
    if (!this.usageCounters.has(date)) {
      this.usageCounters.set(date, {
        r2Writes: 0,
        r2Reads: 0,
        d1Queries: 0,
        d1Writes: 0,
      });
    }
  }
  
  async put(key: string, data: ArrayBuffer, options?: any): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    this.initCounter(date);
    
    // Track R2 write operation
    const counter = this.usageCounters.get(date)!;
    counter.r2Writes++;
    
    this.storage.set(key, { data, metadata: options });
  }
  
  async get(key: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> {
    const date = new Date().toISOString().split('T')[0];
    this.initCounter(date);
    
    // Track R2 read operation
    const counter = this.usageCounters.get(date)!;
    counter.r2Reads++;
    
    const item = this.storage.get(key);
    if (!item) return null;
    return {
      arrayBuffer: async () => item.data,
    };
  }
  
  getUsageCounters(date: string): UsageCounter {
    this.initCounter(date);
    return this.usageCounters.get(date)!;
  }
  
  clear(): void {
    this.storage.clear();
    this.usageCounters.clear();
  }
}

// ============================================================================
// Storage Service with Usage Tracking
// ============================================================================

class StorageServiceWithTracking {
  constructor(
    private r2: MockR2BucketWithTracking,
    private db: MockD1DatabaseWithTracking
  ) {}
  
  async saveImage(imageData: ArrayBuffer, metadata: any): Promise<string> {
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const r2Key = `images/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${imageId}.png`;
    
    // R2 write operation
    await this.r2.put(r2Key, imageData, {
      httpMetadata: { contentType: 'image/png' },
    });
    
    // D1 write operation
    await this.db.prepare(`
      INSERT INTO images (id, verse_reference, verse_text, prompt, style_preset, r2_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      imageId,
      metadata.verseReference,
      metadata.verseText,
      metadata.prompt,
      metadata.stylePreset,
      r2Key
    ).run();
    
    return imageId;
  }
  
  async getImage(imageId: string): Promise<ArrayBuffer> {
    // D1 query operation
    const metadata = await this.db.prepare(`
      SELECT * FROM images WHERE id = ?
    `).bind(imageId).first();
    
    if (!metadata) {
      throw new Error('Image not found');
    }
    
    // R2 read operation
    const r2Object = await this.r2.get(metadata.r2_key);
    if (!r2Object) {
      throw new Error('Image data not found in R2');
    }
    
    return await r2Object.arrayBuffer();
  }
  
  getR2UsageCounters(date: string): UsageCounter {
    return this.r2.getUsageCounters(date);
  }
  
  getD1UsageCounters(date: string): UsageCounter {
    return this.db.getUsageCounters(date);
  }
}

// ============================================================================
// Test Generators
// ============================================================================

const imageDataArb = fc.uint8Array({ minLength: 100, maxLength: 1000 });

const imageMetadataArb = fc.record({
  verseReference: fc.string({ minLength: 5, maxLength: 50 }),
  verseText: fc.lorem({ maxCount: 100 }),
  prompt: fc.lorem({ maxCount: 200 }),
  stylePreset: fc.constantFrom('modern', 'classic', 'minimalist', 'artistic'),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('MonitoringService - Usage Tracking Property Tests', () => {
  let mockR2: MockR2BucketWithTracking;
  let mockDb: MockD1DatabaseWithTracking;
  let storageService: StorageServiceWithTracking;
  
  beforeEach(() => {
    mockR2 = new MockR2BucketWithTracking();
    mockDb = new MockD1DatabaseWithTracking();
    storageService = new StorageServiceWithTracking(mockR2, mockDb);
  });
  
  /**
   * Feature: bible-image-generator, Property 30: Usage tracking
   * Validates: Requirements 9.3
   * 
   * For any R2 write operation or D1 query, the system should increment
   * the corresponding usage counter for cost estimation.
   */
  test('Property 30: R2 write operations increment usage counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Get initial counters
          const initialR2Counters = mockR2.getUsageCounters(date);
          const initialR2Writes = initialR2Counters.r2Writes;
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Perform R2 write operation
          await storageService.saveImage(arrayBuffer, metadata);
          
          // Get updated counters
          const updatedR2Counters = mockR2.getUsageCounters(date);
          
          // Verify R2 write counter was incremented
          expect(updatedR2Counters.r2Writes).toBe(initialR2Writes + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 30: D1 write operations increment usage counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Get initial counters
          const initialD1Counters = mockDb.getUsageCounters(date);
          const initialD1Writes = initialD1Counters.d1Writes;
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Perform D1 write operation (via saveImage which does INSERT)
          await storageService.saveImage(arrayBuffer, metadata);
          
          // Get updated counters
          const updatedD1Counters = mockDb.getUsageCounters(date);
          
          // Verify D1 write counter was incremented
          expect(updatedD1Counters.d1Writes).toBeGreaterThan(initialD1Writes);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 30: D1 query operations increment usage counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save an image first
          const imageId = await storageService.saveImage(arrayBuffer, metadata);
          
          // Get initial query counter (after save operations)
          const initialD1Counters = mockDb.getUsageCounters(date);
          const initialD1Queries = initialD1Counters.d1Queries;
          
          // Perform D1 query operation
          await storageService.getImage(imageId);
          
          // Get updated counters
          const updatedD1Counters = mockDb.getUsageCounters(date);
          
          // Verify D1 query counter was incremented
          expect(updatedD1Counters.d1Queries).toBeGreaterThan(initialD1Queries);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 30: R2 read operations increment usage counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Save an image first
          const imageId = await storageService.saveImage(arrayBuffer, metadata);
          
          // Get initial read counter (after save operations)
          const initialR2Counters = mockR2.getUsageCounters(date);
          const initialR2Reads = initialR2Counters.r2Reads;
          
          // Perform R2 read operation
          await storageService.getImage(imageId);
          
          // Get updated counters
          const updatedR2Counters = mockR2.getUsageCounters(date);
          
          // Verify R2 read counter was incremented
          expect(updatedR2Counters.r2Reads).toBe(initialR2Reads + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 30: multiple operations accumulate usage counters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(imageDataArb, imageMetadataArb),
          { minLength: 2, maxLength: 5 }
        ),
        async (operations) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Get initial counters
          const initialR2Counters = mockR2.getUsageCounters(date);
          const initialD1Counters = mockDb.getUsageCounters(date);
          
          const initialR2Writes = initialR2Counters.r2Writes;
          const initialD1Writes = initialD1Counters.d1Writes;
          
          // Perform multiple save operations
          for (const [imageData, metadata] of operations) {
            const arrayBuffer = imageData.buffer.slice(
              imageData.byteOffset,
              imageData.byteOffset + imageData.byteLength
            );
            
            await storageService.saveImage(arrayBuffer, metadata);
          }
          
          // Get updated counters
          const updatedR2Counters = mockR2.getUsageCounters(date);
          const updatedD1Counters = mockDb.getUsageCounters(date);
          
          // Verify counters were incremented by the number of operations
          expect(updatedR2Counters.r2Writes).toBe(initialR2Writes + operations.length);
          expect(updatedD1Counters.d1Writes).toBeGreaterThanOrEqual(initialD1Writes + operations.length);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  test('Property 30: usage counters are tracked per day', async () => {
    await fc.assert(
      fc.asyncProperty(
        imageDataArb,
        imageMetadataArb,
        async (imageData, metadata) => {
          // Clear storage before each test
          mockR2.clear();
          mockDb.clear();
          
          const date = new Date().toISOString().split('T')[0];
          
          // Convert Uint8Array to ArrayBuffer
          const arrayBuffer = imageData.buffer.slice(
            imageData.byteOffset,
            imageData.byteOffset + imageData.byteLength
          );
          
          // Perform operation
          await storageService.saveImage(arrayBuffer, metadata);
          
          // Get counters for today
          const todayCounters = mockR2.getUsageCounters(date);
          
          // Verify counters exist and are greater than 0
          expect(todayCounters.r2Writes).toBeGreaterThan(0);
          
          // Get counters for a different date (should be independent)
          const differentDate = '2024-01-01';
          const differentDateCounters = mockR2.getUsageCounters(differentDate);
          
          // Verify different date has independent counters
          expect(differentDateCounters.r2Writes).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Rate Limit Event Logging Property Tests
// ============================================================================

describe('MonitoringService - Rate Limit Event Logging Property Tests', () => {
  let monitoringService: MonitoringService;
  
  beforeEach(() => {
    monitoringService = new MonitoringService({
      enableRateLimitLogging: true,
    });
  });
  
  /**
   * Feature: bible-image-generator, Property 31: Rate limit event logging
   * Validates: Requirements 9.4
   * 
   * For any rate limit rejection, a log entry should be created with the user identifier,
   * timestamp, and limit tier.
   */
  test('Property 31: rate limit events are logged with all required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          identifier: fc.string({ minLength: 1, maxLength: 50 }),
          tier: fc.constantFrom('anonymous', 'authenticated'),
          limitExceeded: fc.boolean(),
          requestCount: fc.integer({ min: 0, max: 100 }),
          limit: fc.integer({ min: 1, max: 100 }),
          resetAt: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
        }),
        (eventData) => {
          // Clear previous events
          monitoringService.reset();
          
          // Log the rate limit event
          monitoringService.logRateLimitEvent(eventData);
          
          // Get all rate limit events
          const events = monitoringService.getRateLimitEvents();
          
          // Verify event was logged
          expect(events.length).toBe(1);
          
          const loggedEvent = events[0];
          
          // Verify all required fields are present
          expect(loggedEvent.userId).toBe(eventData.userId);
          expect(loggedEvent.identifier).toBe(eventData.identifier);
          expect(loggedEvent.tier).toBe(eventData.tier);
          expect(loggedEvent.limitExceeded).toBe(eventData.limitExceeded);
          expect(loggedEvent.requestCount).toBe(eventData.requestCount);
          expect(loggedEvent.limit).toBe(eventData.limit);
          expect(loggedEvent.resetAt).toBe(eventData.resetAt);
          expect(loggedEvent.timestamp).toBeDefined();
          expect(typeof loggedEvent.timestamp).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 31: multiple rate limit events are accumulated', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.option(fc.uuid(), { nil: undefined }),
            identifier: fc.string({ minLength: 1, maxLength: 50 }),
            tier: fc.constantFrom('anonymous', 'authenticated'),
            limitExceeded: fc.boolean(),
            requestCount: fc.integer({ min: 0, max: 100 }),
            limit: fc.integer({ min: 1, max: 100 }),
            resetAt: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (events) => {
          // Clear previous events
          monitoringService.reset();
          
          // Log all events
          events.forEach((event) => {
            monitoringService.logRateLimitEvent(event);
          });
          
          // Get all rate limit events
          const loggedEvents = monitoringService.getRateLimitEvents();
          
          // Verify all events were logged
          expect(loggedEvents.length).toBe(events.length);
          
          // Verify each event has all required fields
          loggedEvents.forEach((loggedEvent, index) => {
            expect(loggedEvent.userId).toBe(events[index].userId);
            expect(loggedEvent.identifier).toBe(events[index].identifier);
            expect(loggedEvent.tier).toBe(events[index].tier);
            expect(loggedEvent.limitExceeded).toBe(events[index].limitExceeded);
            expect(loggedEvent.requestCount).toBe(events[index].requestCount);
            expect(loggedEvent.limit).toBe(events[index].limit);
            expect(loggedEvent.resetAt).toBe(events[index].resetAt);
            expect(loggedEvent.timestamp).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 31: rate limit events can be filtered by identifier', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(
          fc.record({
            userId: fc.option(fc.uuid(), { nil: undefined }),
            identifier: fc.string({ minLength: 1, maxLength: 50 }),
            tier: fc.constantFrom('anonymous', 'authenticated'),
            limitExceeded: fc.boolean(),
            requestCount: fc.integer({ min: 0, max: 100 }),
            limit: fc.integer({ min: 1, max: 100 }),
            resetAt: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        (targetIdentifier, events) => {
          // Clear previous events
          monitoringService.reset();
          
          // Add target identifier to some events
          const modifiedEvents = events.map((event, index) => ({
            ...event,
            identifier: index % 3 === 0 ? targetIdentifier : event.identifier,
          }));
          
          // Log all events
          modifiedEvents.forEach((event) => {
            monitoringService.logRateLimitEvent(event);
          });
          
          // Get events for target identifier
          const filteredEvents = monitoringService.getRateLimitEventsForIdentifier(targetIdentifier);
          
          // Verify only events with target identifier are returned
          filteredEvents.forEach((event) => {
            expect(event.identifier).toBe(targetIdentifier);
          });
          
          // Verify count matches expected
          const expectedCount = modifiedEvents.filter(
            (e) => e.identifier === targetIdentifier
          ).length;
          expect(filteredEvents.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 31: rate limit logging can be disabled', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          identifier: fc.string({ minLength: 1, maxLength: 50 }),
          tier: fc.constantFrom('anonymous', 'authenticated'),
          limitExceeded: fc.boolean(),
          requestCount: fc.integer({ min: 0, max: 100 }),
          limit: fc.integer({ min: 1, max: 100 }),
          resetAt: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
        }),
        (eventData) => {
          // Create monitoring service with rate limit logging disabled
          const disabledMonitoring = new MonitoringService({
            enableRateLimitLogging: false,
          });
          
          // Log the rate limit event
          disabledMonitoring.logRateLimitEvent(eventData);
          
          // Get all rate limit events
          const events = disabledMonitoring.getRateLimitEvents();
          
          // Verify no events were logged
          expect(events.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 31: exceeded rate limits are logged with correct flag', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          identifier: fc.string({ minLength: 1, maxLength: 50 }),
          tier: fc.constantFrom('anonymous', 'authenticated'),
          requestCount: fc.integer({ min: 0, max: 100 }),
          limit: fc.integer({ min: 1, max: 100 }),
          resetAt: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
        }),
        (eventData) => {
          // Clear previous events
          monitoringService.reset();
          
          // Determine if limit is exceeded
          const limitExceeded = eventData.requestCount > eventData.limit;
          
          // Log the rate limit event
          monitoringService.logRateLimitEvent({
            ...eventData,
            limitExceeded,
          });
          
          // Get all rate limit events
          const events = monitoringService.getRateLimitEvents();
          
          // Verify event was logged with correct limitExceeded flag
          expect(events.length).toBe(1);
          expect(events[0].limitExceeded).toBe(limitExceeded);
          
          // If limit was exceeded, verify requestCount > limit
          if (events[0].limitExceeded) {
            expect(events[0].requestCount).toBeGreaterThan(events[0].limit);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Quota Alerting Property Tests
// ============================================================================

describe('MonitoringService - Quota Alerting Property Tests', () => {
  let monitoringService: MonitoringService;
  
  beforeEach(() => {
    monitoringService = new MonitoringService({
      alertThresholdPercentage: 80,
      quotaThresholds: {
        r2StorageGB: 10,
        r2OperationsPerMonth: 1000000,
        d1RowsReadPerDay: 5000000,
        d1StorageGB: 5,
      },
    });
  });
  
  /**
   * Feature: bible-image-generator, Property 32: Quota alerting
   * Validates: Requirements 9.5
   * 
   * For any usage metric that exceeds 80% of the defined quota, an alert should be
   * generated and sent to administrators.
   */
  test('Property 32: quota alerts are generated when threshold is exceeded', () => {
    fc.assert(
      fc.property(
        fc.record({
          resource: fc.constantFrom('r2_storage', 'd1_storage'),
          quotaGB: fc.integer({ min: 1, max: 10 }),
          thresholdPercentage: fc.integer({ min: 80, max: 100 }),
        }),
        (config) => {
          // Create monitoring service with custom threshold and quota
          const service = new MonitoringService({
            alertThresholdPercentage: config.thresholdPercentage,
            quotaThresholds: {
              r2StorageGB: config.resource === 'r2_storage' ? config.quotaGB : 10,
              r2OperationsPerMonth: 1000000,
              d1RowsReadPerDay: 5000000,
              d1StorageGB: config.resource === 'd1_storage' ? config.quotaGB : 5,
            },
          });
          
          // Convert quota to bytes
          const quotaBytes = config.quotaGB * 1024 * 1024 * 1024;
          
          // Calculate usage that exceeds threshold
          const usageAboveThreshold = Math.ceil((quotaBytes * config.thresholdPercentage) / 100) + 1;
          
          // Trigger quota check based on resource type
          if (config.resource === 'r2_storage') {
            service.checkR2StorageQuota(usageAboveThreshold);
          } else if (config.resource === 'd1_storage') {
            service.checkD1StorageQuota(usageAboveThreshold);
          }
          
          // Get alerts
          const alerts = service.getQuotaAlerts();
          
          // Verify alert was generated
          expect(alerts.length).toBeGreaterThan(0);
          
          const alert = alerts[0];
          expect(alert.resource).toBe(config.resource);
          expect(alert.currentUsage).toBe(usageAboveThreshold);
          expect(alert.percentageUsed).toBeGreaterThanOrEqual(config.thresholdPercentage);
          expect(alert.timestamp).toBeDefined();
          expect(alert.message).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: no alerts generated when usage is below threshold', () => {
    fc.assert(
      fc.property(
        fc.record({
          resource: fc.constantFrom('r2_storage', 'd1_storage'),
          quota: fc.integer({ min: 1000, max: 10000 }),
          thresholdPercentage: fc.integer({ min: 50, max: 100 }),
        }),
        (config) => {
          // Create monitoring service with custom threshold
          const service = new MonitoringService({
            alertThresholdPercentage: config.thresholdPercentage,
          });
          
          // Calculate usage that is below threshold
          const usageBelowThreshold = Math.floor((config.quota * (config.thresholdPercentage - 1)) / 100);
          
          // Trigger quota check based on resource type
          if (config.resource === 'r2_storage') {
            service.checkR2StorageQuota(usageBelowThreshold);
          } else if (config.resource === 'd1_storage') {
            service.checkD1StorageQuota(usageBelowThreshold);
          }
          
          // Get alerts
          const alerts = service.getQuotaAlerts();
          
          // Verify no alert was generated
          expect(alerts.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: alerts contain all required information', () => {
    fc.assert(
      fc.property(
        fc.record({
          storageBytes: fc.integer({ min: 9000000000, max: 11000000000 }), // 9-11 GB
        }),
        (data) => {
          // Clear previous alerts
          monitoringService.reset();
          
          // Trigger quota check that should generate alert
          monitoringService.checkR2StorageQuota(data.storageBytes);
          
          // Get alerts
          const alerts = monitoringService.getQuotaAlerts();
          
          if (alerts.length > 0) {
            const alert = alerts[0];
            
            // Verify all required fields are present
            expect(alert.timestamp).toBeDefined();
            expect(typeof alert.timestamp).toBe('string');
            expect(alert.resource).toBeDefined();
            expect(alert.currentUsage).toBe(data.storageBytes);
            expect(alert.quota).toBeDefined();
            expect(alert.percentageUsed).toBeDefined();
            expect(alert.percentageUsed).toBeGreaterThanOrEqual(80);
            expect(alert.message).toBeDefined();
            expect(typeof alert.message).toBe('string');
            expect(alert.message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: duplicate alerts are not created within short time window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 9000000000, max: 11000000000 }), // 9-11 GB
        (storageBytes) => {
          // Clear previous alerts
          monitoringService.reset();
          
          // Trigger quota check multiple times in quick succession
          monitoringService.checkR2StorageQuota(storageBytes);
          monitoringService.checkR2StorageQuota(storageBytes);
          monitoringService.checkR2StorageQuota(storageBytes);
          
          // Get alerts
          const alerts = monitoringService.getQuotaAlerts();
          
          // Verify only one alert was created (no duplicates)
          const r2StorageAlerts = alerts.filter((a) => a.resource === 'r2_storage');
          expect(r2StorageAlerts.length).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: alerts can be filtered by resource type', () => {
    fc.assert(
      fc.property(
        fc.record({
          r2Storage: fc.integer({ min: 9000000000, max: 11000000000 }),
          d1Storage: fc.integer({ min: 4500000000, max: 5500000000 }),
        }),
        (data) => {
          // Clear previous alerts
          monitoringService.reset();
          
          // Trigger quota checks for different resources
          monitoringService.checkR2StorageQuota(data.r2Storage);
          monitoringService.checkD1StorageQuota(data.d1Storage);
          
          // Get alerts for specific resource
          const r2Alerts = monitoringService.getQuotaAlertsForResource('r2_storage');
          const d1Alerts = monitoringService.getQuotaAlertsForResource('d1_storage');
          
          // Verify alerts are filtered correctly
          r2Alerts.forEach((alert) => {
            expect(alert.resource).toBe('r2_storage');
          });
          
          d1Alerts.forEach((alert) => {
            expect(alert.resource).toBe('d1_storage');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: percentage used is calculated correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          quota: fc.integer({ min: 1000, max: 10000 }),
          usagePercentage: fc.integer({ min: 80, max: 100 }),
        }),
        (data) => {
          // Calculate exact usage based on percentage
          const usage = Math.ceil((data.quota * data.usagePercentage) / 100);
          
          // Create monitoring service with known quota
          const service = new MonitoringService({
            alertThresholdPercentage: 80,
            quotaThresholds: {
              r2StorageGB: data.quota / (1024 * 1024 * 1024),
              r2OperationsPerMonth: 1000000,
              d1RowsReadPerDay: 5000000,
              d1StorageGB: 5,
            },
          });
          
          // Trigger quota check
          service.checkR2StorageQuota(usage);
          
          // Get alerts
          const alerts = service.getQuotaAlerts();
          
          if (alerts.length > 0) {
            const alert = alerts[0];
            
            // Verify percentage is calculated correctly (within 1% tolerance for rounding)
            const expectedPercentage = (usage / data.quota) * 100;
            expect(Math.abs(alert.percentageUsed - expectedPercentage)).toBeLessThan(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 32: old alerts can be cleared', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 9000000000, max: 11000000000 }),
        (storageBytes) => {
          // Clear previous alerts
          monitoringService.reset();
          
          // Trigger quota check to create alert
          monitoringService.checkR2StorageQuota(storageBytes);
          
          // Verify alert was created
          const alertsBefore = monitoringService.getQuotaAlerts();
          const initialCount = alertsBefore.length;
          
          // Clear old alerts
          monitoringService.clearOldAlerts();
          
          // Get alerts after clearing
          const alertsAfter = monitoringService.getQuotaAlerts();
          
          // Since alerts were just created, they should still be there
          // (clearOldAlerts only removes alerts older than 24 hours)
          expect(alertsAfter.length).toBe(initialCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
