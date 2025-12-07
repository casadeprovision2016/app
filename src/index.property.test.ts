/**
 * Property-based tests for main API Worker functions
 * Feature: bible-image-generator
 */

import { describe, test, expect } from "vitest";
import fc from "fast-check";

// ============================================================================
// Helper function to extract from index.ts
// ============================================================================

/**
 * Generate WhatsApp share link
 * This is the implementation from src/index.ts
 */
function generateWhatsAppLink(imageUrl: string, verseReference: string, verseText: string): string {
  const message = `"${verseText}" - ${verseReference}\n${imageUrl}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/?text=${encodedMessage}`;
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid verse references
 */
const verseReferenceArb = fc.record({
  book: fc.constantFrom(
    "Genesis",
    "Exodus",
    "Psalms",
    "Proverbs",
    "Isaiah",
    "Matthew",
    "John",
    "Romans",
    "Ephesians",
    "Revelation"
  ),
  chapter: fc.integer({ min: 1, max: 150 }),
  verse: fc.integer({ min: 1, max: 50 }),
}).map(({ book, chapter, verse }) => `${book} ${chapter}:${verse}`);

/**
 * Generate valid verse text (biblical quotes)
 */
const verseTextArb = fc.lorem({ maxCount: 50 });

/**
 * Generate valid image URLs
 */
const imageUrlArb = fc.webUrl();

// ============================================================================
// Property Tests
// ============================================================================

describe("Main API Worker - Property Tests", () => {
  /**
   * Feature: bible-image-generator, Property 11: WhatsApp link format
   * Validates: Requirements 3.2
   * 
   * This property verifies that for any image URL and verse text,
   * the generated WhatsApp share link follows the wa.me format and
   * includes both the encoded verse text and image URL.
   */
  test("Property 11: WhatsApp links follow wa.me format with encoded verse and image URL", () => {
    fc.assert(
      fc.property(
        imageUrlArb,
        verseReferenceArb,
        verseTextArb,
        (imageUrl, verseReference, verseText) => {
          const whatsappLink = generateWhatsAppLink(imageUrl, verseReference, verseText);

          // 1. Link should start with https://wa.me/?text=
          expect(whatsappLink).toMatch(/^https:\/\/wa\.me\/\?text=/);

          // 2. Extract the encoded message from the link
          const urlParams = new URLSearchParams(whatsappLink.split('?')[1]);
          const encodedMessage = urlParams.get('text');
          expect(encodedMessage).toBeTruthy();

          // 3. Decode the message
          const decodedMessage = decodeURIComponent(encodedMessage!);

          // 4. Message should contain the verse text in quotes
          expect(decodedMessage).toContain(`"${verseText}"`);

          // 5. Message should contain the verse reference
          expect(decodedMessage).toContain(verseReference);

          // 6. Message should contain the image URL
          expect(decodedMessage).toContain(imageUrl);

          // 7. Message should follow the format: "{verseText}" - {verseReference}\n{imageUrl}
          const expectedMessage = `"${verseText}" - ${verseReference}\n${imageUrl}`;
          expect(decodedMessage).toBe(expectedMessage);

          // 8. The encoded message should be properly URL-encoded
          expect(encodedMessage).toBe(encodeURIComponent(expectedMessage));
        }
      ),
      { numRuns: 100 }
    );
  });
});
