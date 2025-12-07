/**
 * Unit tests for ValidationService
 * 
 * Tests specific examples and edge cases for validation logic
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ValidationService } from './ValidationService';
import { GenerateImageRequest } from '../types';

describe('ValidationService', () => {
  let validationService: ValidationService;
  
  beforeEach(() => {
    validationService = new ValidationService();
  });
  
  describe('sanitizePrompt', () => {
    test('removes single blocked term', () => {
      const prompt = 'Create a beautiful violence scene';
      const sanitized = validationService.sanitizePrompt(prompt);
      
      expect(sanitized).not.toContain('violence');
      expect(sanitized).toContain('Create');
      expect(sanitized).toContain('beautiful');
      expect(sanitized).toContain('scene');
    });
    
    test('removes multiple blocked terms', () => {
      const prompt = 'violence and hate with explicit content';
      const sanitized = validationService.sanitizePrompt(prompt);
      
      expect(sanitized).not.toContain('violence');
      expect(sanitized).not.toContain('hate');
      expect(sanitized).not.toContain('explicit');
    });
    
    test('handles empty prompt', () => {
      const sanitized = validationService.sanitizePrompt('');
      expect(sanitized).toBe('');
    });
    
    test('handles prompt with only blocked terms', () => {
      const prompt = 'violence hate explicit';
      const sanitized = validationService.sanitizePrompt(prompt);
      
      expect(sanitized).toBe('');
    });
    
    test('preserves clean prompt', () => {
      const prompt = 'Create a beautiful peaceful scene with love and hope';
      const sanitized = validationService.sanitizePrompt(prompt);
      
      expect(sanitized).toBe(prompt);
    });
    
    test('is case-insensitive', () => {
      const prompt = 'VIOLENCE Violence violence';
      const sanitized = validationService.sanitizePrompt(prompt);
      
      expect(sanitized.toLowerCase()).not.toContain('violence');
    });
  });
  
  describe('validatePrompt', () => {
    test('rejects prompt with blocked term', () => {
      const result = validationService.validatePrompt('This has violence in it');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('blocked terms');
    });
    
    test('accepts clean prompt', () => {
      const result = validationService.validatePrompt('A peaceful beautiful scene');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    test('accepts empty prompt', () => {
      const result = validationService.validatePrompt('');
      
      expect(result.valid).toBe(true);
    });
    
    test('rejects prompt exceeding max length', () => {
      const longPrompt = 'a'.repeat(1001);
      const result = validationService.validatePrompt(longPrompt);
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('maximum length');
    });
  });
  
  describe('validateVerseReference', () => {
    test('accepts valid simple reference', () => {
      const result = validationService.validateVerseReference('John 3:16');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    test('accepts reference with numbered book', () => {
      const result = validationService.validateVerseReference('1 Corinthians 13:4');
      
      expect(result.valid).toBe(true);
    });
    
    test('accepts reference with verse range', () => {
      const result = validationService.validateVerseReference('John 3:16-17');
      
      expect(result.valid).toBe(true);
    });
    
    test('accepts multi-word book names', () => {
      const result = validationService.validateVerseReference('Song of Solomon 2:1');
      
      expect(result.valid).toBe(true);
    });
    
    test('rejects empty reference', () => {
      const result = validationService.validateVerseReference('');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('required');
    });
    
    test('rejects invalid format - missing colon', () => {
      const result = validationService.validateVerseReference('John 3 16');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('Invalid verse reference format');
    });
    
    test('rejects invalid format - missing chapter', () => {
      const result = validationService.validateVerseReference('John :16');
      
      expect(result.valid).toBe(false);
    });
    
    test('rejects invalid format - missing verse', () => {
      const result = validationService.validateVerseReference('John 3:');
      
      expect(result.valid).toBe(false);
    });
    
    test('rejects zero chapter number', () => {
      const result = validationService.validateVerseReference('John 0:16');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('positive');
    });
    
    test('rejects zero verse number', () => {
      const result = validationService.validateVerseReference('John 3:0');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('positive');
    });
    
    test('rejects invalid verse range', () => {
      const result = validationService.validateVerseReference('John 3:17-16');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('End verse must be greater');
    });
    
    test('rejects reference exceeding max length', () => {
      const longRef = 'A'.repeat(101) + ' 1:1';
      const result = validationService.validateVerseReference(longRef);
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('maximum length');
    });
  });
  
  describe('validateStylePreset', () => {
    test('accepts valid style presets', () => {
      expect(validationService.validateStylePreset('modern').valid).toBe(true);
      expect(validationService.validateStylePreset('classic').valid).toBe(true);
      expect(validationService.validateStylePreset('minimalist').valid).toBe(true);
      expect(validationService.validateStylePreset('artistic').valid).toBe(true);
    });
    
    test('accepts undefined style preset', () => {
      const result = validationService.validateStylePreset(undefined);
      
      expect(result.valid).toBe(true);
    });
    
    test('rejects invalid style preset', () => {
      const result = validationService.validateStylePreset('invalid');
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('Invalid style preset');
    });
  });
  
  describe('validateGenerationRequest', () => {
    test('accepts valid complete request', () => {
      const request: GenerateImageRequest = {
        verseReference: 'John 3:16',
        verseText: 'For God so loved the world...',
        stylePreset: 'modern',
        customPrompt: 'A beautiful peaceful scene',
        requestId: 'test-123',
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(true);
    });
    
    test('accepts minimal valid request', () => {
      const request: GenerateImageRequest = {
        verseReference: 'John 3:16',
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(true);
    });
    
    test('rejects request with invalid verse reference', () => {
      const request: GenerateImageRequest = {
        verseReference: 'invalid',
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    test('rejects request with invalid style preset', () => {
      const request: GenerateImageRequest = {
        verseReference: 'John 3:16',
        stylePreset: 'invalid' as any,
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(false);
    });
    
    test('rejects request with blocked terms in custom prompt', () => {
      const request: GenerateImageRequest = {
        verseReference: 'John 3:16',
        customPrompt: 'violence and hate',
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(false);
    });
    
    test('rejects request with verse text exceeding max length', () => {
      const request: GenerateImageRequest = {
        verseReference: 'John 3:16',
        verseText: 'a'.repeat(1001),
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('Verse text exceeds maximum length');
    });
    
    test('accumulates multiple validation errors', () => {
      const request: GenerateImageRequest = {
        verseReference: 'invalid',
        stylePreset: 'invalid' as any,
        customPrompt: 'violence',
      };
      
      const result = validationService.validateGenerationRequest(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(1);
    });
  });
  
  describe('blocklist management', () => {
    test('getBlocklist returns current blocklist', () => {
      const blocklist = validationService.getBlocklist();
      
      expect(Array.isArray(blocklist)).toBe(true);
      expect(blocklist.length).toBeGreaterThan(0);
    });
    
    test('addToBlocklist adds new terms', () => {
      const newTerms = ['newterm1', 'newterm2'];
      validationService.addToBlocklist(newTerms);
      
      const blocklist = validationService.getBlocklist();
      expect(blocklist).toContain('newterm1');
      expect(blocklist).toContain('newterm2');
    });
    
    test('removeFromBlocklist removes terms', () => {
      const terms = ['testterm'];
      validationService.addToBlocklist(terms);
      
      let blocklist = validationService.getBlocklist();
      expect(blocklist).toContain('testterm');
      
      validationService.removeFromBlocklist(terms);
      blocklist = validationService.getBlocklist();
      expect(blocklist).not.toContain('testterm');
    });
    
    test('blocklist operations are case-insensitive', () => {
      validationService.addToBlocklist(['TestTerm']);
      
      const blocklist = validationService.getBlocklist();
      expect(blocklist).toContain('testterm');
    });
  });
});
