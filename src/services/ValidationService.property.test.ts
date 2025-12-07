/**
 * Property-based tests for ValidationService
 * 
 * Uses fast-check to verify correctness properties across many inputs
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ValidationService } from './ValidationService';

describe('ValidationService - Property-Based Tests', () => {
  let validationService: ValidationService;
  
  beforeEach(() => {
    validationService = new ValidationService();
  });
  
  /**
   * Feature: bible-image-generator, Property 5: Input sanitization
   * Validates: Requirements 1.5
   * 
   * For any prompt containing terms from the blocklist, the sanitizer should
   * either remove the terms or reject the prompt entirely.
   */
  test('Property 5: Input sanitization - blocked terms are removed or rejected', () => {
    // Get the blocklist to use in test
    const blocklist = validationService.getBlocklist();
    
    fc.assert(
      fc.property(
        // Generate prompts that contain blocked terms
        fc.record({
          prefix: fc.string({ minLength: 0, maxLength: 50 }),
          blockedTerm: fc.constantFrom(...blocklist),
          suffix: fc.string({ minLength: 0, maxLength: 50 }),
        }),
        ({ prefix, blockedTerm, suffix }) => {
          const prompt = `${prefix} ${blockedTerm} ${suffix}`.trim();
          
          // Test sanitization: blocked term should be removed
          const sanitized = validationService.sanitizePrompt(prompt);
          const sanitizedLower = sanitized.toLowerCase();
          
          // The sanitized prompt should not contain the blocked term
          expect(sanitizedLower).not.toContain(blockedTerm.toLowerCase());
          
          // Test validation: prompt should be rejected
          const validationResult = validationService.validatePrompt(prompt);
          
          // The validation should fail for prompts with blocked terms
          expect(validationResult.valid).toBe(false);
          expect(validationResult.errors).toBeDefined();
          expect(validationResult.errors!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Sanitization preserves clean prompts
   * 
   * For any prompt that doesn't contain blocked terms, sanitization should
   * return the prompt unchanged (except for whitespace normalization).
   */
  test('sanitization preserves clean prompts', () => {
    fc.assert(
      fc.property(
        // Generate prompts without blocked terms
        fc.string({ minLength: 1, maxLength: 100 })
          .filter(s => {
            const blocklist = validationService.getBlocklist();
            const lower = s.toLowerCase();
            return !blocklist.some(term => lower.includes(term));
          }),
        (cleanPrompt) => {
          const sanitized = validationService.sanitizePrompt(cleanPrompt);
          const validationResult = validationService.validatePrompt(cleanPrompt);
          
          // Clean prompts should pass validation
          expect(validationResult.valid).toBe(true);
          
          // Sanitization should preserve the content (allowing for whitespace changes)
          const normalizedOriginal = cleanPrompt.trim().replace(/\s+/g, ' ');
          const normalizedSanitized = sanitized.trim().replace(/\s+/g, ' ');
          expect(normalizedSanitized).toBe(normalizedOriginal);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Multiple blocked terms are all removed
   * 
   * For any prompt containing multiple blocked terms, all of them should
   * be removed by sanitization.
   */
  test('multiple blocked terms are all removed', () => {
    const blocklist = validationService.getBlocklist();
    
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...blocklist), { minLength: 2, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        (blockedTerms, cleanWords) => {
          // Interleave blocked terms with clean words
          const parts: string[] = [];
          for (let i = 0; i < Math.max(blockedTerms.length, cleanWords.length); i++) {
            if (i < cleanWords.length) {
              parts.push(cleanWords[i % cleanWords.length]);
            }
            if (i < blockedTerms.length) {
              parts.push(blockedTerms[i]);
            }
          }
          
          const prompt = parts.join(' ');
          const sanitized = validationService.sanitizePrompt(prompt);
          const sanitizedLower = sanitized.toLowerCase();
          
          // None of the blocked terms should appear in the sanitized output
          for (const term of blockedTerms) {
            expect(sanitizedLower).not.toContain(term.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Empty or whitespace-only prompts are handled safely
   * 
   * For any empty or whitespace-only prompt, sanitization should return
   * an empty string and validation should pass.
   */
  test('empty or whitespace prompts are handled safely', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t\n  '),
        (emptyPrompt) => {
          const sanitized = validationService.sanitizePrompt(emptyPrompt);
          const validationResult = validationService.validatePrompt(emptyPrompt);
          
          // Sanitized should be empty
          expect(sanitized).toBe('');
          
          // Validation should pass for empty prompts
          expect(validationResult.valid).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('ValidationService - Blocklist Validation', () => {
  let validationService: ValidationService;
  
  beforeEach(() => {
    validationService = new ValidationService();
  });
  
  /**
   * Feature: bible-image-generator, Property 23: Blocklist validation
   * Validates: Requirements 7.1, 7.2
   * 
   * For any prompt containing one or more terms from the moderation blocklist,
   * the validation should fail.
   */
  test('Property 23: Blocklist validation - prompts with blocked terms fail validation', () => {
    const blocklist = validationService.getBlocklist();
    
    fc.assert(
      fc.property(
        // Generate prompts with at least one blocked term
        fc.record({
          prefix: fc.string({ minLength: 0, maxLength: 50 }),
          blockedTerms: fc.array(
            fc.constantFrom(...blocklist),
            { minLength: 1, maxLength: 3 }
          ),
          suffix: fc.string({ minLength: 0, maxLength: 50 }),
        }),
        ({ prefix, blockedTerms, suffix }) => {
          const prompt = `${prefix} ${blockedTerms.join(' ')} ${suffix}`.trim();
          
          // Validate the prompt
          const result = validationService.validatePrompt(prompt);
          
          // The validation MUST fail
          expect(result.valid).toBe(false);
          
          // There MUST be error messages
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          // The error message should mention blocked terms
          const errorMessage = result.errors!.join(' ').toLowerCase();
          expect(errorMessage).toContain('blocked');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Blocklist validation is case-insensitive
   * 
   * For any blocked term in any case variation, validation should fail.
   */
  test('blocklist validation is case-insensitive', () => {
    const blocklist = validationService.getBlocklist();
    
    fc.assert(
      fc.property(
        fc.constantFrom(...blocklist),
        fc.constantFrom('lower', 'UPPER', 'Title', 'MiXeD'),
        (blockedTerm, caseVariant) => {
          let term: string;
          switch (caseVariant) {
            case 'lower':
              term = blockedTerm.toLowerCase();
              break;
            case 'UPPER':
              term = blockedTerm.toUpperCase();
              break;
            case 'Title':
              term = blockedTerm.charAt(0).toUpperCase() + blockedTerm.slice(1).toLowerCase();
              break;
            case 'MiXeD':
              term = blockedTerm
                .split('')
                .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
                .join('');
              break;
            default:
              term = blockedTerm;
          }
          
          const prompt = `This is a ${term} prompt`;
          const result = validationService.validatePrompt(prompt);
          
          // Should fail regardless of case
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Clean prompts pass validation
   * 
   * For any prompt that doesn't contain blocked terms, validation should pass.
   */
  test('clean prompts pass blocklist validation', () => {
    const blocklist = validationService.getBlocklist();
    
    fc.assert(
      fc.property(
        // Generate clean words that are not in the blocklist
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(word => {
              const normalized = word.toLowerCase().trim();
              // Check that the word doesn't contain any blocked term as a substring
              return normalized.length > 0 && 
                     !blocklist.some(term => normalized.includes(term));
            }),
          { minLength: 1, maxLength: 10 }
        ),
        (cleanWords) => {
          const prompt = cleanWords.join(' ');
          const result = validationService.validatePrompt(prompt);
          
          // Should pass validation
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Blocklist can be dynamically updated
   * 
   * For any new term added to the blocklist, prompts containing that term
   * should fail validation.
   */
  test('dynamically added terms are enforced', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 15 })
          .filter(s => /^[a-z]+$/.test(s)), // Only lowercase letters
        (newTerm) => {
          // Add the term to the blocklist
          validationService.addToBlocklist([newTerm]);
          
          // Create a prompt with the new term
          const prompt = `This contains ${newTerm} in it`;
          const result = validationService.validatePrompt(prompt);
          
          // Should fail validation
          expect(result.valid).toBe(false);
          
          // Clean up
          validationService.removeFromBlocklist([newTerm]);
        }
      ),
      { numRuns: 50 }
    );
  });
});
