/**
 * RateLimiter Durable Object
 * 
 * Provides distributed rate limiting using Cloudflare Durable Objects.
 * Tracks request counts per user/IP and enforces tier-based limits.
 * 
 * Features:
 * - Tier-based rate limiting (anonymous vs authenticated)
 * - Progressive rate limiting for suspicious patterns
 * - Automatic reset logic
 * - Retry-After calculation
 * - Concurrency-safe operations
 */

import { UserTier, RateLimitResult } from '../types';

/**
 * Configuration for rate limits per tier
 */
export interface RateLimitTierConfig {
  anonymous: number;      // Requests per hour for anonymous users
  authenticated: number;  // Requests per hour for authenticated users
}

/**
 * Request tracking data stored in Durable Object storage
 */
interface RequestTracker {
  count: number;           // Number of requests in current window
  windowStart: number;     // Timestamp when the current window started
  suspiciousScore: number; // Score for detecting suspicious patterns (0-100)
  lastRequestTime: number; // Timestamp of last request
  captchaRequired: boolean; // Whether CAPTCHA verification is required
  captchaVerifiedAt?: number; // Timestamp when CAPTCHA was last verified
}

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMITS: RateLimitTierConfig = {
  anonymous: 5,
  authenticated: 20,
};

/**
 * Time window for rate limiting (in milliseconds)
 */
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Threshold for suspicious pattern detection
 */
const SUSPICIOUS_THRESHOLD = 50;

/**
 * Progressive rate limit reduction when suspicious
 */
const PROGRESSIVE_LIMIT_FACTOR = 0.5; // Reduce limit by 50%

/**
 * Minimum time between requests to avoid suspicion (in milliseconds)
 */
const MIN_REQUEST_INTERVAL = 1000; // 1 second

/**
 * RateLimiter Durable Object class
 * 
 * Each instance tracks rate limits for a specific identifier (user ID or IP address).
 */
export class RateLimiter implements DurableObject {
  private state: DurableObjectState;
  private config: RateLimitTierConfig;
  private turnstileEnabled: boolean;
  private highFrequencyThreshold: number;
  private turnstileSiteKey?: string;
  private turnstileSecretKey?: string;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    
    // Load rate limit configuration from environment variables
    this.config = {
      anonymous: parseInt(env.RATE_LIMIT_ANONYMOUS || '5', 10),
      authenticated: parseInt(env.RATE_LIMIT_AUTHENTICATED || '20', 10),
    };
    
    // Load Turnstile CAPTCHA configuration
    this.turnstileEnabled = env.TURNSTILE_ENABLED === 'true';
    this.highFrequencyThreshold = parseInt(env.TURNSTILE_HIGH_FREQUENCY_THRESHOLD || '10', 10);
    this.turnstileSiteKey = env.TURNSTILE_SITE_KEY;
    this.turnstileSecretKey = env.TURNSTILE_SECRET_KEY;
  }
  
  /**
   * Handles HTTP requests to the Durable Object
   * 
   * Supports:
   * - POST /check - Check if request is allowed
   * - POST /record - Record a request
   * - POST /reset - Reset rate limit for identifier
   * - GET /status - Get current rate limit status
   * - POST /verify-captcha - Verify CAPTCHA token
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      if (path === '/check' && request.method === 'POST') {
        const body = await request.json() as { identifier: string; tier: UserTier };
        const result = await this.checkLimit(body.identifier, body.tier);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/record' && request.method === 'POST') {
        const body = await request.json() as { identifier: string; tier: UserTier };
        await this.recordRequest(body.identifier, body.tier);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/reset' && request.method === 'POST') {
        const body = await request.json() as { identifier: string };
        await this.resetLimit(body.identifier);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/status' && request.method === 'GET') {
        const identifier = url.searchParams.get('identifier');
        const tier = (url.searchParams.get('tier') || 'anonymous') as UserTier;
        
        if (!identifier) {
          return new Response(JSON.stringify({ error: 'Missing identifier' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const result = await this.checkLimit(identifier, tier);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/verify-captcha' && request.method === 'POST') {
        const body = await request.json() as { identifier: string; token: string };
        const result = await this.verifyCaptcha(body.identifier, body.token);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('RateLimiter error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  /**
   * Checks if a request is allowed under the rate limit
   * 
   * @param identifier User ID or IP address
   * @param tier User tier (anonymous or authenticated)
   * @returns Promise resolving to RateLimitResult
   */
  async checkLimit(identifier: string, tier: UserTier): Promise<RateLimitResult> {
    const tracker = await this.getTracker(identifier);
    const now = Date.now();
    
    // Check if we need to reset the window
    if (now - tracker.windowStart >= RATE_LIMIT_WINDOW) {
      // Window expired, reset
      tracker.count = 0;
      tracker.windowStart = now;
      tracker.suspiciousScore = Math.max(0, tracker.suspiciousScore - 10); // Decay suspicion
      await this.saveTracker(identifier, tracker);
    }
    
    // Check if CAPTCHA is required
    const captchaRequired = this.isCaptchaRequired(tracker);
    
    // If CAPTCHA is required, block the request
    if (captchaRequired) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: tracker.windowStart + RATE_LIMIT_WINDOW,
        captchaRequired: true,
      };
    }
    
    // Get the base limit for this tier
    let limit = this.config[tier];
    
    // Apply progressive rate limiting if suspicious
    if (tracker.suspiciousScore >= SUSPICIOUS_THRESHOLD) {
      limit = Math.floor(limit * PROGRESSIVE_LIMIT_FACTOR);
    }
    
    // Calculate remaining requests
    const remaining = Math.max(0, limit - tracker.count);
    const allowed = tracker.count < limit;
    
    // Calculate reset time (end of current window)
    const resetAt = tracker.windowStart + RATE_LIMIT_WINDOW;
    
    return {
      allowed,
      remaining,
      resetAt,
      captchaRequired: false,
    };
  }
  
  /**
   * Records a request and updates the rate limit counter
   * 
   * Also updates suspicious pattern detection and CAPTCHA requirements.
   * 
   * @param identifier User ID or IP address
   * @param tier User tier (anonymous or authenticated)
   * @returns Promise that resolves when the request is recorded
   */
  async recordRequest(identifier: string, tier: UserTier): Promise<void> {
    const tracker = await this.getTracker(identifier);
    const now = Date.now();
    
    // Check if we need to reset the window
    if (now - tracker.windowStart >= RATE_LIMIT_WINDOW) {
      tracker.count = 0;
      tracker.windowStart = now;
      tracker.suspiciousScore = Math.max(0, tracker.suspiciousScore - 10);
    }
    
    // Increment request count
    tracker.count++;
    
    // Update suspicious pattern detection
    if (tracker.lastRequestTime > 0) {
      const timeSinceLastRequest = now - tracker.lastRequestTime;
      
      // Rapid requests increase suspicion
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        tracker.suspiciousScore = Math.min(100, tracker.suspiciousScore + 10);
      } else {
        // Normal spacing decreases suspicion
        tracker.suspiciousScore = Math.max(0, tracker.suspiciousScore - 1);
      }
    }
    
    tracker.lastRequestTime = now;
    
    // Check if CAPTCHA should be required based on request count
    if (this.turnstileEnabled && tracker.count >= this.highFrequencyThreshold) {
      tracker.captchaRequired = true;
    }
    
    await this.saveTracker(identifier, tracker);
  }
  
  /**
   * Resets the rate limit for an identifier
   * 
   * Useful for administrative actions or testing.
   * 
   * @param identifier User ID or IP address
   * @returns Promise that resolves when the limit is reset
   */
  async resetLimit(identifier: string): Promise<void> {
    await this.state.storage.delete(this.getStorageKey(identifier));
  }
  
  /**
   * Verifies a CAPTCHA token and clears the CAPTCHA requirement if valid
   * 
   * @param identifier User ID or IP address
   * @param token Turnstile CAPTCHA token
   * @returns Promise resolving to verification result
   */
  async verifyCaptcha(identifier: string, token: string): Promise<{ success: boolean; error?: string }> {
    if (!this.turnstileEnabled) {
      return { success: true }; // CAPTCHA not enabled, always succeed
    }
    
    if (!this.turnstileSecretKey) {
      console.error('Turnstile secret key not configured');
      return { success: false, error: 'CAPTCHA verification not configured' };
    }
    
    try {
      // Verify token with Turnstile API
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.turnstileSecretKey,
          response: token,
        }),
      });
      
      const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
      
      if (result.success) {
        // Clear CAPTCHA requirement
        const tracker = await this.getTracker(identifier);
        tracker.captchaRequired = false;
        tracker.captchaVerifiedAt = Date.now();
        await this.saveTracker(identifier, tracker);
        
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result['error-codes']?.join(', ') || 'CAPTCHA verification failed' 
        };
      }
    } catch (error) {
      console.error('CAPTCHA verification error:', error);
      return { success: false, error: 'CAPTCHA verification failed' };
    }
  }
  
  /**
   * Checks if CAPTCHA is required for a tracker
   * 
   * @param tracker Request tracker
   * @returns True if CAPTCHA is required
   */
  private isCaptchaRequired(tracker: RequestTracker): boolean {
    if (!this.turnstileEnabled) {
      return false;
    }
    
    return tracker.captchaRequired === true;
  }
  
  /**
   * Retrieves the request tracker for an identifier
   * 
   * Creates a new tracker if one doesn't exist.
   * 
   * @param identifier User ID or IP address
   * @returns Promise resolving to RequestTracker
   */
  private async getTracker(identifier: string): Promise<RequestTracker> {
    const key = this.getStorageKey(identifier);
    const stored = await this.state.storage.get<RequestTracker>(key);
    
    if (stored) {
      return stored;
    }
    
    // Create new tracker
    return {
      count: 0,
      windowStart: Date.now(),
      suspiciousScore: 0,
      lastRequestTime: 0,
      captchaRequired: false,
    };
  }
  
  /**
   * Saves the request tracker to storage
   * 
   * @param identifier User ID or IP address
   * @param tracker The tracker data to save
   * @returns Promise that resolves when the tracker is saved
   */
  private async saveTracker(identifier: string, tracker: RequestTracker): Promise<void> {
    const key = this.getStorageKey(identifier);
    await this.state.storage.put(key, tracker);
  }
  
  /**
   * Generates the storage key for an identifier
   * 
   * @param identifier User ID or IP address
   * @returns Storage key string
   */
  private getStorageKey(identifier: string): string {
    return `tracker:${identifier}`;
  }
}
