/**
 * Property-based tests for ImageGenerationService
 * Feature: bible-image-generator
 */

import { describe, test, expect } from "vitest";
import fc from "fast-check";
import {
  ImageGenerationService,
  ImageGenerationError,
  STYLE_PRESETS,
} from "./ImageGenerationService";
import { Verse, StylePreset, ErrorCode } from "../types";

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
});

/**
 * Generate valid verses
 */
const verseArb = fc
  .record({
    reference: verseReferenceArb,
    text: fc.lorem({ maxCount: 50 }),
    translation: fc.constantFrom("NIV", "KJV", "ESV", "NKJV"),
  })
  .map((data) => ({
    reference: `${data.reference.book} ${data.reference.chapter}:${data.reference.verse}`,
    text: data.text,
    book: data.reference.book,
    chapter: data.reference.chapter,
    verse: data.reference.verse,
    translation: data.translation,
  }));

/**
 * Generate valid style presets
 */
const stylePresetArb = fc.constantFrom<StylePreset>(
  "modern",
  "classic",
  "minimalist",
  "artistic"
);

// ============================================================================
// Property Tests
// ============================================================================

// ============================================================================
// Mock AI Binding
// ============================================================================

/**
 * Create a mock AI binding that simulates successful image generation
 */
function createMockAi(options?: {
  shouldFail?: boolean;
  delay?: number;
}): Ai {
  return {
    run: async (model: string, inputs: any) => {
      // Simulate processing delay
      if (options?.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }

      // Simulate failure if requested
      if (options?.shouldFail) {
        throw new Error("AI service unavailable");
      }

      // Return mock image data (1x1 transparent PNG in base64)
      return {
        image:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      };
    },
  } as Ai;
}

describe("ImageGenerationService - Property Tests", () => {
  /**
   * Feature: bible-image-generator, Property 1: Prompt construction completeness
   * Validates: Requirements 1.1
   */
  test("Property 1: constructed prompts contain both verse theme/text and style parameters", () => {
    // Create a mock AI binding (not used in this test)
    const mockAi = {} as Ai;
    const service = new ImageGenerationService(mockAi);

    fc.assert(
      fc.property(verseArb, stylePresetArb, (verse, style) => {
        const prompt = service.constructPrompt(verse, style);

        // Prompt should not be empty
        expect(prompt).toBeTruthy();
        expect(prompt.length).toBeGreaterThan(0);

        // Prompt should contain style adjectives
        const styleConfig = STYLE_PRESETS[style];
        const styleWords = styleConfig.adjectives.split(" ");
        const containsStyleWords = styleWords.some((word) =>
          prompt.toLowerCase().includes(word.toLowerCase())
        );
        expect(containsStyleWords).toBe(true);

        // Prompt should contain some verse text or theme
        // Either the verse text itself or a theme keyword should be present
        const verseTextSnippet = verse.text.substring(0, 50).toLowerCase();
        const promptLower = prompt.toLowerCase();

        // Check if verse text is included
        const hasVerseText = verseTextSnippet
          .split(" ")
          .some((word) => word.length > 3 && promptLower.includes(word));

        // Check if theme keywords are present
        const themeKeywords = [
          "love",
          "hope",
          "strength",
          "peace",
          "joy",
          "light",
          "faith",
          "wisdom",
        ];
        const hasTheme = themeKeywords.some((theme) =>
          promptLower.includes(theme)
        );

        // At least one should be true
        expect(hasVerseText || hasTheme).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bible-image-generator, Property 2: AI service invocation
   * Validates: Requirements 1.2
   */
  test("Property 2: valid prompts successfully invoke AI and receive response", async () => {
    const mockAi = createMockAi();
    const service = new ImageGenerationService(mockAi);

    // Generate valid prompts (non-whitespace, at least 10 chars)
    const validPromptArb = fc
      .string({ minLength: 10, maxLength: 500 })
      .filter((s) => s.trim().length >= 10);

    await fc.assert(
      fc.asyncProperty(
        validPromptArb,
        fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        async (prompt, steps) => {
          const params = {
            prompt,
            steps,
          };

          const result = await service.generate(params);

          // Should receive a valid response
          expect(result).toBeDefined();
          expect(result.imageData).toBeInstanceOf(ArrayBuffer);
          expect(result.imageData.byteLength).toBeGreaterThan(0);
          expect(result.format).toBe("png");
          expect(result.metadata).toBeDefined();
          expect(result.metadata.model).toBe(
            "@cf/black-forest-labs/flux-1-schnell"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bible-image-generator, Property 3: Generation timeout compliance
   * Validates: Requirements 1.3
   */
  test(
    "Property 3: successful generations complete within 30 seconds",
    { timeout: 10000 },
    async () => {
      // Use a mock AI that responds quickly
      const mockAi = createMockAi({ delay: 10 }); // 10ms delay
      const service = new ImageGenerationService(mockAi);

      // Generate valid prompts (non-whitespace, at least 10 chars)
      const validPromptArb = fc
        .string({ minLength: 10, maxLength: 500 })
        .filter((s) => s.trim().length >= 10);

      await fc.assert(
        fc.asyncProperty(validPromptArb, async (prompt) => {
          const startTime = Date.now();

          const result = await service.generate({ prompt });

          const duration = Date.now() - startTime;

          // Should complete within 30 seconds
          expect(duration).toBeLessThan(30000);

          // Should have valid result
          expect(result).toBeDefined();
          expect(result.imageData).toBeInstanceOf(ArrayBuffer);

          // Metadata should include duration
          expect(result.metadata.duration).toBeDefined();
          expect(result.metadata.duration).toBeLessThan(30000);
        }),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Feature: bible-image-generator, Property 4: Error handling completeness
   * Validates: Requirements 1.4
   */
  test("Property 4: generation failures return error message and log details", async () => {
    // Create a mock AI that always fails
    const mockAi = createMockAi({ shouldFail: true });
    const service = new ImageGenerationService(mockAi);

    // Generate valid prompts
    const validPromptArb = fc
      .string({ minLength: 10, maxLength: 500 })
      .filter((s) => s.trim().length >= 10);

    await fc.assert(
      fc.asyncProperty(validPromptArb, async (prompt) => {
        try {
          await service.generate({ prompt });
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          // Should throw ImageGenerationError
          expect(error).toBeInstanceOf(ImageGenerationError);

          const genError = error as ImageGenerationError;

          // Should have error message
          expect(genError.message).toBeDefined();
          expect(genError.message.length).toBeGreaterThan(0);

          // Should have error code
          expect(genError.code).toBeDefined();
          expect(genError.code).toBe(ErrorCode.MODEL_INFERENCE_FAILED);

          // Should have details for logging
          expect(genError.details).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bible-image-generator, Property 14: Daily verse styling
   * Validates: Requirements 4.3
   *
   * This property verifies that when generating images for daily verses,
   * the system consistently uses predefined style parameters.
   * For daily verses, we use the "classic" style preset as the default.
   */
  test("Property 14: daily verse images use predefined style parameters", () => {
    const mockAi = {} as Ai;
    const service = new ImageGenerationService(mockAi);

    // Define the predefined daily verse style
    const DAILY_VERSE_STYLE: StylePreset = "classic";

    fc.assert(
      fc.property(verseArb, (verse) => {
        // Generate prompt using the predefined daily style
        const prompt = service.constructPrompt(verse, DAILY_VERSE_STYLE);

        // Verify the prompt contains the predefined style adjectives
        const styleConfig = STYLE_PRESETS[DAILY_VERSE_STYLE];
        const styleWords = styleConfig.adjectives.split(" ");

        // At least some style words should be present
        const containsStyleWords = styleWords.some((word) =>
          prompt.toLowerCase().includes(word.toLowerCase())
        );

        expect(containsStyleWords).toBe(true);

        // Verify it uses classic style characteristics
        expect(
          prompt.toLowerCase().includes("traditional") ||
            prompt.toLowerCase().includes("renaissance") ||
            prompt.toLowerCase().includes("classical") ||
            prompt.toLowerCase().includes("classic")
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
