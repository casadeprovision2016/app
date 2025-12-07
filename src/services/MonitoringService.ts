/**
 * Monitoring and Logging Service
 * Provides structured logging, usage tracking, and alerting capabilities
 */

import { LogEntry, ErrorCode } from '../types';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MonitoringConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableUsageTracking: boolean;
  enableRateLimitLogging: boolean;
  quotaThresholds: {
    r2StorageGB: number;
    r2OperationsPerMonth: number;
    d1RowsReadPerDay: number;
    d1StorageGB: number;
  };
  alertThresholdPercentage: number; // e.g., 80 for 80%
}

export interface UsageMetrics {
  date: string;
  r2Writes: number;
  r2Reads: number;
  d1Queries: number;
  d1Writes: number;
  totalStorageBytes: number;
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  uniqueUsers: Set<string>;
}

export interface RateLimitEvent {
  timestamp: string;
  userId?: string;
  identifier: string;
  tier: 'anonymous' | 'authenticated';
  limitExceeded: boolean;
  requestCount: number;
  limit: number;
  resetAt: number;
}

export interface QuotaAlert {
  timestamp: string;
  resource: 'r2_storage' | 'r2_operations' | 'd1_rows_read' | 'd1_storage';
  currentUsage: number;
  quota: number;
  percentageUsed: number;
  message: string;
}

// ============================================================================
// MonitoringService Class
// ============================================================================

export class MonitoringService {
  private config: MonitoringConfig;
  private usageMetrics: Map<string, UsageMetrics>;
  private rateLimitEvents: RateLimitEvent[];
  private quotaAlerts: QuotaAlert[];

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      logLevel: config.logLevel || 'info',
      enableUsageTracking: config.enableUsageTracking ?? true,
      enableRateLimitLogging: config.enableRateLimitLogging ?? true,
      quotaThresholds: config.quotaThresholds || {
        r2StorageGB: 10,
        r2OperationsPerMonth: 1000000,
        d1RowsReadPerDay: 5000000,
        d1StorageGB: 5,
      },
      alertThresholdPercentage: config.alertThresholdPercentage || 80,
    };

    this.usageMetrics = new Map();
    this.rateLimitEvents = [];
    this.quotaAlerts = [];
  }

  // ============================================================================
  // Structured Logging
  // ============================================================================

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    operation: string,
    requestId: string,
    options: {
      userId?: string;
      duration?: number;
      error?: Error;
      metadata?: Record<string, any>;
    } = {}
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      userId: options.userId,
      operation,
      duration: options.duration,
      metadata: options.metadata,
    };

    if (options.error) {
      entry.error = {
        message: options.error.message,
        stack: options.error.stack || '',
        code: (options.error as any).code || ErrorCode.INTERNAL_SERVER_ERROR,
      };
    }

    return entry;
  }

  /**
   * Check if a log level should be logged based on configuration
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Log a debug message
   */
  debug(operation: string, requestId: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      const entry = this.createLogEntry('debug', operation, requestId, { metadata });
      console.debug(JSON.stringify(entry));
    }
  }

  /**
   * Log an info message
   */
  info(operation: string, requestId: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      const entry = this.createLogEntry('info', operation, requestId, { metadata });
      console.info(JSON.stringify(entry));
    }
  }

  /**
   * Log a warning message
   */
  warn(operation: string, requestId: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      const entry = this.createLogEntry('warn', operation, requestId, { metadata });
      console.warn(JSON.stringify(entry));
    }
  }

  /**
   * Log an error with full details
   */
  error(
    operation: string,
    requestId: string,
    error: Error,
    metadata?: Record<string, any>
  ): void {
    if (this.shouldLog('error')) {
      const entry = this.createLogEntry('error', operation, requestId, {
        error,
        metadata,
      });
      console.error(JSON.stringify(entry));
    }
  }

  /**
   * Log an operation with duration
   */
  logOperation(
    operation: string,
    requestId: string,
    duration: number,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (this.shouldLog('info')) {
      const entry = this.createLogEntry('info', operation, requestId, {
        userId,
        duration,
        metadata,
      });
      console.info(JSON.stringify(entry));
    }
  }

  // ============================================================================
  // Usage Tracking
  // ============================================================================

  /**
   * Get or create usage metrics for a specific date
   */
  private getUsageMetrics(date: string): UsageMetrics {
    if (!this.usageMetrics.has(date)) {
      this.usageMetrics.set(date, {
        date,
        r2Writes: 0,
        r2Reads: 0,
        d1Queries: 0,
        d1Writes: 0,
        totalStorageBytes: 0,
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        uniqueUsers: new Set(),
      });
    }
    return this.usageMetrics.get(date)!;
  }

  /**
   * Track an R2 write operation
   */
  trackR2Write(bytes?: number): void {
    if (!this.config.enableUsageTracking) return;

    const date = new Date().toISOString().split('T')[0];
    const metrics = this.getUsageMetrics(date);
    metrics.r2Writes++;
    if (bytes) {
      metrics.totalStorageBytes += bytes;
    }

    // Check quota and alert if needed
    this.checkR2OperationsQuota(date);
  }

  /**
   * Track an R2 read operation
   */
  trackR2Read(): void {
    if (!this.config.enableUsageTracking) return;

    const date = new Date().toISOString().split('T')[0];
    const metrics = this.getUsageMetrics(date);
    metrics.r2Reads++;

    // Check quota and alert if needed
    this.checkR2OperationsQuota(date);
  }

  /**
   * Track a D1 query operation
   */
  trackD1Query(): void {
    if (!this.config.enableUsageTracking) return;

    const date = new Date().toISOString().split('T')[0];
    const metrics = this.getUsageMetrics(date);
    metrics.d1Queries++;

    // Check quota and alert if needed
    this.checkD1RowsReadQuota(date);
  }

  /**
   * Track a D1 write operation
   */
  trackD1Write(): void {
    if (!this.config.enableUsageTracking) return;

    const date = new Date().toISOString().split('T')[0];
    const metrics = this.getUsageMetrics(date);
    metrics.d1Writes++;
  }

  /**
   * Track a generation request
   */
  trackGeneration(success: boolean, userId?: string): void {
    if (!this.config.enableUsageTracking) return;

    const date = new Date().toISOString().split('T')[0];
    const metrics = this.getUsageMetrics(date);
    metrics.totalGenerations++;
    if (success) {
      metrics.successfulGenerations++;
    } else {
      metrics.failedGenerations++;
    }
    if (userId) {
      metrics.uniqueUsers.add(userId);
    }
  }

  /**
   * Get usage metrics for a specific date
   */
  getMetrics(date: string): UsageMetrics | undefined {
    return this.usageMetrics.get(date);
  }

  /**
   * Get all usage metrics
   */
  getAllMetrics(): Map<string, UsageMetrics> {
    return new Map(this.usageMetrics);
  }

  // ============================================================================
  // Rate Limit Event Logging
  // ============================================================================

  /**
   * Log a rate limit event
   */
  logRateLimitEvent(event: Omit<RateLimitEvent, 'timestamp'>): void {
    if (!this.config.enableRateLimitLogging) return;

    const fullEvent: RateLimitEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.rateLimitEvents.push(fullEvent);

    // Also log to console
    if (fullEvent.limitExceeded) {
      this.warn('rate_limit_exceeded', fullEvent.identifier, {
        userId: fullEvent.userId,
        tier: fullEvent.tier,
        requestCount: fullEvent.requestCount,
        limit: fullEvent.limit,
        resetAt: fullEvent.resetAt,
      });
    }
  }

  /**
   * Get all rate limit events
   */
  getRateLimitEvents(): RateLimitEvent[] {
    return [...this.rateLimitEvents];
  }

  /**
   * Get rate limit events for a specific identifier
   */
  getRateLimitEventsForIdentifier(identifier: string): RateLimitEvent[] {
    return this.rateLimitEvents.filter((event) => event.identifier === identifier);
  }

  // ============================================================================
  // Quota Alerting
  // ============================================================================

  /**
   * Check R2 operations quota and create alert if threshold exceeded
   */
  private checkR2OperationsQuota(date: string): void {
    const metrics = this.getUsageMetrics(date);
    const totalOperations = metrics.r2Writes + metrics.r2Reads;
    const quota = this.config.quotaThresholds.r2OperationsPerMonth;
    const percentageUsed = (totalOperations / quota) * 100;

    if (percentageUsed >= this.config.alertThresholdPercentage) {
      this.createQuotaAlert(
        'r2_operations',
        totalOperations,
        quota,
        percentageUsed,
        `R2 operations have reached ${percentageUsed.toFixed(1)}% of monthly quota`
      );
    }
  }

  /**
   * Check D1 rows read quota and create alert if threshold exceeded
   */
  private checkD1RowsReadQuota(date: string): void {
    const metrics = this.getUsageMetrics(date);
    const quota = this.config.quotaThresholds.d1RowsReadPerDay;
    const percentageUsed = (metrics.d1Queries / quota) * 100;

    if (percentageUsed >= this.config.alertThresholdPercentage) {
      this.createQuotaAlert(
        'd1_rows_read',
        metrics.d1Queries,
        quota,
        percentageUsed,
        `D1 rows read have reached ${percentageUsed.toFixed(1)}% of daily quota`
      );
    }
  }

  /**
   * Check R2 storage quota and create alert if threshold exceeded
   */
  checkR2StorageQuota(totalBytes: number): void {
    const quotaBytes = this.config.quotaThresholds.r2StorageGB * 1024 * 1024 * 1024;
    const percentageUsed = (totalBytes / quotaBytes) * 100;

    if (percentageUsed >= this.config.alertThresholdPercentage) {
      this.createQuotaAlert(
        'r2_storage',
        totalBytes,
        quotaBytes,
        percentageUsed,
        `R2 storage has reached ${percentageUsed.toFixed(1)}% of quota (${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`
      );
    }
  }

  /**
   * Check D1 storage quota and create alert if threshold exceeded
   */
  checkD1StorageQuota(totalBytes: number): void {
    const quotaBytes = this.config.quotaThresholds.d1StorageGB * 1024 * 1024 * 1024;
    const percentageUsed = (totalBytes / quotaBytes) * 100;

    if (percentageUsed >= this.config.alertThresholdPercentage) {
      this.createQuotaAlert(
        'd1_storage',
        totalBytes,
        quotaBytes,
        percentageUsed,
        `D1 storage has reached ${percentageUsed.toFixed(1)}% of quota (${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`
      );
    }
  }

  /**
   * Create a quota alert
   */
  private createQuotaAlert(
    resource: QuotaAlert['resource'],
    currentUsage: number,
    quota: number,
    percentageUsed: number,
    message: string
  ): void {
    // Check if we already have a recent alert for this resource
    const recentAlert = this.quotaAlerts.find(
      (alert) =>
        alert.resource === resource &&
        new Date(alert.timestamp).getTime() > Date.now() - 3600000 // Within last hour
    );

    if (recentAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: QuotaAlert = {
      timestamp: new Date().toISOString(),
      resource,
      currentUsage,
      quota,
      percentageUsed,
      message,
    };

    this.quotaAlerts.push(alert);

    // Log the alert
    this.warn('quota_alert', 'system', {
      resource,
      currentUsage,
      quota,
      percentageUsed,
      message,
    });
  }

  /**
   * Get all quota alerts
   */
  getQuotaAlerts(): QuotaAlert[] {
    return [...this.quotaAlerts];
  }

  /**
   * Get quota alerts for a specific resource
   */
  getQuotaAlertsForResource(resource: QuotaAlert['resource']): QuotaAlert[] {
    return this.quotaAlerts.filter((alert) => alert.resource === resource);
  }

  /**
   * Clear old alerts (older than 24 hours)
   */
  clearOldAlerts(): void {
    const oneDayAgo = Date.now() - 86400000;
    this.quotaAlerts = this.quotaAlerts.filter(
      (alert) => new Date(alert.timestamp).getTime() > oneDayAgo
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.usageMetrics.clear();
    this.rateLimitEvents = [];
    this.quotaAlerts = [];
  }

  /**
   * Get configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      quotaThresholds: {
        ...this.config.quotaThresholds,
        ...(config.quotaThresholds || {}),
      },
    };
  }
}
