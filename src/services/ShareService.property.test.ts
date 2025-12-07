/**
 * Property-based tests for ShareService
 * Using fast-check for property-based testing
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ShareService } from './ShareService';
import { Verse } from '../types';

describe('ShareService - Property-Based Tests', () => {
  /**
   * Feature: bible-image-generator, Property 11: WhatsApp link format
   * 
   * Property: For any image URL and verse text, the generated WhatsApp share link
   * should follow the wa.me format and include both the encoded verse text and image URL.
   * 
   * This test verifies:
   * 1. The link starts with "https://wa.me/?text="
   * 2. The link contains the encoded verse text
   * 3. The link contains the encoded verse reference
   * 4. The link contains the encoded image URL
   * 5. The message is properly URL-encoded
   * 
   * Validates: Requirements 3.2
   */
  test('Property 11: WhatsApp link format - contains verse and URL', () => {
    // Custom generator for valid image URLs
    const imageUrlArb = fc.webUrl({ withFragments: false, withQueryParameters: false });
    
    // Custom generator for verse objects
    const verseArb = fc.record({
      reference: fc.record({
        book: fc.constantFrom('John', 'Psalm', 'Genesis', 'Romans', 'Matthew', 'Proverbs', 'Isaiah'),
        chapter: fc.integer({ min: 1, max: 150 }),
        verse: fc.integer({ min: 1, max: 50 }),
      }).map(({ book, chapter, verse }) => `${book} ${chapter}:${verse}`),
      text: fc.lorem({ maxCount: 50 }),
      book: fc.constantFrom('John', 'Psalm', 'Genesis', 'Romans', 'Matthew', 'Proverbs', 'Isaiah'),
      chapter: fc.integer({ min: 1, max: 150 }),
      verse: fc.integer({ min: 1, max: 50 }),
      translation: fc.constantFrom('NIV', 'KJV', 'ESV', 'NKJV'),
    });
    
    fc.assert(
      fc.property(
        imageUrlArb,
        verseArb,
        (imageUrl, verse) => {
          const service = new ShareService();
          const whatsappLink = service.generateWhatsAppLink(imageUrl, verse);
          
          // 1. Verify the link starts with the correct WhatsApp URL format
          expect(whatsappLink).toMatch(/^https:\/\/wa\.me\/\?text=/);
          
          // 2. Decode the URL to verify the message content
          const urlMatch = whatsappLink.match(/^https:\/\/wa\.me\/\?text=(.+)$/);
          expect(urlMatch).toBeTruthy();
          
          if (urlMatch) {
            const encodedMessage = urlMatch[1];
            const decodedMessage = decodeURIComponent(encodedMessage);
            
            // 3. Verify the decoded message contains the verse text (in quotes)
            expect(decodedMessage).toContain(`"${verse.text}"`);
            
            // 4. Verify the decoded message contains the verse reference
            expect(decodedMessage).toContain(verse.reference);
            
            // 5. Verify the decoded message contains the image URL
            expect(decodedMessage).toContain(imageUrl);
            
            // 6. Verify the message format: "{verseText}" - {verseReference}\n{imageUrl}
            const expectedMessage = `"${verse.text}" - ${verse.reference}\n${imageUrl}`;
            expect(decodedMessage).toBe(expectedMessage);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: WhatsApp link should be properly URL-encoded
   * 
   * For any verse with special characters, the WhatsApp link should properly encode them
   */
  test('Property: WhatsApp link handles special characters', () => {
    // Generator for verses with special characters
    const verseWithSpecialCharsArb = fc.record({
      reference: fc.constant('John 3:16'),
      text: fc.constantFrom(
        'For God so loved the world!',
        'Love & peace be with you',
        'He said, "Come to me"',
        'Faith, hope, and love—these three',
        '100% faithful & true'
      ),
      book: fc.constant('John'),
      chapter: fc.constant(3),
      verse: fc.constant(16),
      translation: fc.constant('NIV'),
    });
    
    fc.assert(
      fc.property(
        fc.webUrl(),
        verseWithSpecialCharsArb,
        (imageUrl, verse) => {
          const service = new ShareService();
          const whatsappLink = service.generateWhatsAppLink(imageUrl, verse);
          
          // The link should be a valid URL (no unencoded special characters)
          expect(() => new URL(whatsappLink)).not.toThrow();
          
          // Decode and verify the message is intact
          const urlMatch = whatsappLink.match(/^https:\/\/wa\.me\/\?text=(.+)$/);
          if (urlMatch) {
            const decodedMessage = decodeURIComponent(urlMatch[1]);
            expect(decodedMessage).toContain(verse.text);
            expect(decodedMessage).toContain(verse.reference);
            expect(decodedMessage).toContain(imageUrl);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Web Share API data should contain all required fields
   * 
   * For any image URL and verse, the Web Share data should have title, text, and url
   */
  test('Property: Web Share data completeness', () => {
    const verseArb = fc.record({
      reference: fc.record({
        book: fc.constantFrom('John', 'Psalm', 'Genesis'),
        chapter: fc.integer({ min: 1, max: 150 }),
        verse: fc.integer({ min: 1, max: 50 }),
      }).map(({ book, chapter, verse }) => `${book} ${chapter}:${verse}`),
      text: fc.lorem({ maxCount: 50 }),
      book: fc.constantFrom('John', 'Psalm', 'Genesis'),
      chapter: fc.integer({ min: 1, max: 150 }),
      verse: fc.integer({ min: 1, max: 50 }),
      translation: fc.constant('NIV'),
    });
    
    fc.assert(
      fc.property(
        fc.webUrl(),
        verseArb,
        (imageUrl, verse) => {
          const service = new ShareService();
          const shareData = service.generateWebShareData(imageUrl, verse);
          
          // Verify all required fields are present
          expect(shareData.title).toBeDefined();
          expect(shareData.text).toBeDefined();
          expect(shareData.url).toBeDefined();
          
          // Verify the fields contain expected content
          expect(shareData.title).toContain(verse.reference);
          expect(shareData.title).toContain('Bible Image');
          
          expect(shareData.text).toContain(verse.text);
          expect(shareData.text).toContain(verse.reference);
          
          expect(shareData.url).toBe(imageUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: generateWhatsAppLink should be deterministic
   * 
   * For the same inputs, the function should always return the same output
   */
  test('Property: WhatsApp link generation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.record({
          reference: fc.constant('John 3:16'),
          text: fc.constant('For God so loved the world'),
          book: fc.constant('John'),
          chapter: fc.constant(3),
          verse: fc.constant(16),
          translation: fc.constant('NIV'),
        }),
        (imageUrl, verse) => {
          const service = new ShareService();
          
          const link1 = service.generateWhatsAppLink(imageUrl, verse);
          const link2 = service.generateWhatsAppLink(imageUrl, verse);
          
          // Should return identical links
          expect(link1).toBe(link2);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: generateWebShareData should be deterministic
   * 
   * For the same inputs, the function should always return the same output
   */
  test('Property: Web Share data generation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.record({
          reference: fc.constant('Psalm 23:1'),
          text: fc.constant('The Lord is my shepherd'),
          book: fc.constant('Psalm'),
          chapter: fc.constant(23),
          verse: fc.constant(1),
          translation: fc.constant('NIV'),
        }),
        (imageUrl, verse) => {
          const service = new ShareService();
          
          const data1 = service.generateWebShareData(imageUrl, verse);
          const data2 = service.generateWebShareData(imageUrl, verse);
          
          // Should return identical data
          expect(data1.title).toBe(data2.title);
          expect(data1.text).toBe(data2.text);
          expect(data1.url).toBe(data2.url);
        }
      ),
      { numRuns: 100 }
    );
  });
});
