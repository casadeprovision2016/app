/**
 * Property-based tests for CAPTCHA enforcement in RateLimiter
 * 
 * Feature: bible-image-generator, Property 19: CAPTCHA enforcement
 * Validates: Requirements 5.5
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { RateLimiter } from './RateLimiter';
import { UserTier } from '../types';

/**
 * Mock Durable Object State for testing
 */
class MockDurableObjectState implements Partial<DurableObjectState> {
  private storageMap = new Map<string, any>();
  
  get id(): DurableObjectId {
    return {
      toString: () => 'test-id',
      equals: () => false,
      name: 'test-limiter',
    } as DurableObjectId;
  }
  
  get storage(): DurableObjectStorage {
    const storageMap = this.storageMap;
    return {
      get: async (key: string) => storageMap.get(key),
      put: async (key: string, value: any) => {
        storageMap.set(key, value);
      },
      delete: async (key: string) => {
        storageMap.delete(key);
        return true;
      },
      list: async () => new Map(),
      deleteAll: async () => {},
      transaction: async (closure: any) => closure(),
      getAlarm: async () => null,
      setAlarm: async () => {},
      deleteAlarm: async () => {},
      sync: async () => {},
    } as any;
  }
  
  waitUntil(promise: Promise<any>): void {}
  
  blockConcurrencyWhile(callback: () => Promise<any>): Promise<any> {
    return callback();
  }
}

/**
 * Mock environment with CAPTCHA enabled
 */
const createMockEnv = (captchaEnabled: boolean = true, highFrequencyThreshold: number = 10): any => ({
  RATE_LIMIT_ANONYMOUS: '5',
  RATE_LIMIT_AUTHENTICATED: '20',
  TURNSTILE_ENABLED: captchaEnabled ? 'true' : 'false',
  TURNSTILE_HIGH_FREQUENCY_THRESHOLD: highFrequencyThreshold.toString(),
  TURNSTILE_SITE_KEY: 'test-site-key',
  TURNSTILE_SECRET_KEY: 'test-secret-key',
});

/**
 * Helper to create a RateLimiter instance
 */
const createRateLimiter = (captchaEnabled: boolean = true, threshold: number = 10): RateLimiter => {
  const state = new MockDurableObjectState() as unknown as DurableObjectState;
  const env = createMockEnv(captchaEnabled, threshold);
  return new RateLimiter(state, env);
};

/**
 * Helper to make multiple requests
 */
const makeRequests = async (
  limiter: RateLimiter,
  identifier: string,
  tier: UserTier,
  count: number
): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await limiter.recordRequest(identifier, tier);
  }
};

describe('RateLimiter CAPTCHA Enforcement', () => {
  /**
   * Feature: bible-image-generator, Property 19: CAPTCHA enforcement
   * 
   * For any user exceeding the high-frequency threshold when Turnstile is enabled,
   * subsequent requests should require CAPTCHA verification.
   */
  test('users exceeding high-frequency threshold require CAPTCHA when enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 5, max: 15 }), // high frequency threshold
        fc.integer({ min: 1, max: 10 }), // requests below threshold
        fc.integer({ min: 1, max: 10 }), // requests above threshold
        async (identifier, tier, threshold, belowCount, aboveCount) => {
          // Create limiter with CAPTCHA enabled
          const limiter = createRateLimiter(true, threshold);
          
          // Make requests below threshold
          const requestsBelowThreshold = Math.min(belowCount, threshold - 1);
          await makeRequests(limiter, identifier, tier, requestsBelowThreshold);
          
          // Check that CAPTCHA is not required yet
          const resultBefore = await limiter.checkLimit(identifier, tier);
          expect(resultBefore.captchaRequired).toBe(false);
          
          // Make requests to exceed threshold
          const totalRequests = threshold + aboveCount;
          await makeRequests(limiter, identifier, tier, totalRequests - requestsBelowThreshold);
          
          // Check that CAPTCHA is now required
          const resultAfter = await limiter.checkLimit(identifier, tier);
          expect(resultAfter.captchaRequired).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: CAPTCHA not required when disabled
   * 
   * For any user, regardless of request count, CAPTCHA should not be required
   * when Turnstile is disabled.
   */
  test('CAPTCHA not required when Turnstile is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 10, max: 100 }), // request count (well above any threshold)
        async (identifier, tier, requestCount) => {
          // Create limiter with CAPTCHA disabled
          const limiter = createRateLimiter(false, 10);
          
          // Make many requests
          await makeRequests(limiter, identifier, tier, requestCount);
          
          // Check that CAPTCHA is never required
          const result = await limiter.checkLimit(identifier, tier);
          expect(result.captchaRequired).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: CAPTCHA requirement persists until verification
   * 
   * For any user who has triggered CAPTCHA requirement, the requirement
   * should persist across multiple check calls until CAPTCHA is verified.
   */
  test('CAPTCHA requirement persists until verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 5, max: 10 }), // threshold
        fc.integer({ min: 2, max: 5 }), // number of checks to perform
        async (identifier, tier, threshold, numChecks) => {
          const limiter = createRateLimiter(true, threshold);
          
          // Exceed threshold
          await makeRequests(limiter, identifier, tier, threshold + 5);
          
          // Verify CAPTCHA is required multiple times
          for (let i = 0; i < numChecks; i++) {
            const result = await limiter.checkLimit(identifier, tier);
            expect(result.captchaRequired).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: CAPTCHA verification clears requirement
   * 
   * For any user who has triggered CAPTCHA requirement, successfully
   * verifying the CAPTCHA should clear the requirement.
   */
  test('successful CAPTCHA verification clears requirement', async () => {
    // Mock global fetch for Turnstile API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        json: async () => ({ success: true }),
      } as Response;
    };
    
    try {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // identifier
          fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
          fc.integer({ min: 5, max: 10 }), // threshold
          async (identifier, tier, threshold) => {
            const limiter = createRateLimiter(true, threshold);
            
            // Exceed threshold to trigger CAPTCHA
            await makeRequests(limiter, identifier, tier, threshold + 5);
            
            // Verify CAPTCHA is required
            const resultBefore = await limiter.checkLimit(identifier, tier);
            expect(resultBefore.captchaRequired).toBe(true);
            
            // Verify CAPTCHA (mock successful verification)
            await limiter.verifyCaptcha(identifier, 'valid-token');
            
            // Check that CAPTCHA is no longer required
            const resultAfter = await limiter.checkLimit(identifier, tier);
            expect(resultAfter.captchaRequired).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  /**
   * Property: Different users have independent CAPTCHA requirements
   * 
   * For any two different users, triggering CAPTCHA for one should not
   * affect the other.
   */
  test('CAPTCHA requirements are independent per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier1
        fc.string({ minLength: 1, maxLength: 50 }), // identifier2
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 5, max: 10 }), // threshold
        async (id1, id2, tier, threshold) => {
          // Ensure identifiers are different
          fc.pre(id1 !== id2);
          
          const limiter = createRateLimiter(true, threshold);
          
          // User 1 exceeds threshold
          await makeRequests(limiter, id1, tier, threshold + 5);
          
          // User 2 makes only a few requests
          await makeRequests(limiter, id2, tier, 2);
          
          // Check user 1 requires CAPTCHA
          const result1 = await limiter.checkLimit(id1, tier);
          expect(result1.captchaRequired).toBe(true);
          
          // Check user 2 does not require CAPTCHA
          const result2 = await limiter.checkLimit(id2, tier);
          expect(result2.captchaRequired).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: CAPTCHA threshold is configurable
   * 
   * For any valid threshold value, the system should enforce CAPTCHA
   * at that specific threshold.
   */
  test('CAPTCHA threshold is configurable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 3, max: 20 }), // configurable threshold
        async (identifier, tier, threshold) => {
          const limiter = createRateLimiter(true, threshold);
          
          // Make requests just below threshold
          await makeRequests(limiter, identifier, tier, threshold - 1);
          const resultBefore = await limiter.checkLimit(identifier, tier);
          expect(resultBefore.captchaRequired).toBe(false);
          
          // Make one more request to reach threshold
          await makeRequests(limiter, identifier, tier, 1);
          const resultAt = await limiter.checkLimit(identifier, tier);
          expect(resultAt.captchaRequired).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: CAPTCHA requirement blocks requests
   * 
   * For any user with CAPTCHA requirement, requests should be blocked
   * until CAPTCHA is verified.
   */
  test('requests blocked when CAPTCHA required', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // identifier
        fc.constantFrom('anonymous' as UserTier, 'authenticated' as UserTier), // tier
        fc.integer({ min: 5, max: 10 }), // threshold
        async (identifier, tier, threshold) => {
          const limiter = createRateLimiter(true, threshold);
          
          // Exceed threshold
          await makeRequests(limiter, identifier, tier, threshold + 5);
          
          // Check that requests are blocked
          const result = await limiter.checkLimit(identifier, tier);
          expect(result.captchaRequired).toBe(true);
          expect(result.allowed).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
