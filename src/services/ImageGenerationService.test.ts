/**
 * Unit tests for ImageGenerationService
 */

import { describe, test, expect } from "vitest";
import {
  ImageGenerationService,
  ImageGenerationError,
  STYLE_PRESETS,
} from "./ImageGenerationService";
import { Verse, ErrorCode } from "../types";

describe("ImageGenerationService", () => {
  describe("constructPrompt", () => {
    test("should construct prompt with verse and style", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const verse: Verse = {
        reference: "John 3:16",
        text: "For God so loved the world that he gave his one and only Son",
        book: "John",
        chapter: 3,
        verse: 16,
        translation: "NIV",
      };

      const prompt = service.constructPrompt(verse, "modern");

      expect(prompt).toContain("Inspirational biblical scene");
      expect(prompt).toContain("contemporary");
      expect(prompt).toContain("loved");
    });

    test("should include style adjectives for each preset", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const verse: Verse = {
        reference: "Psalm 23:1",
        text: "The Lord is my shepherd, I shall not want",
        book: "Psalms",
        chapter: 23,
        verse: 1,
        translation: "NIV",
      };

      const modernPrompt = service.constructPrompt(verse, "modern");
      expect(modernPrompt).toContain("contemporary");

      const classicPrompt = service.constructPrompt(verse, "classic");
      expect(classicPrompt).toContain("traditional");

      const minimalistPrompt = service.constructPrompt(verse, "minimalist");
      expect(minimalistPrompt).toContain("simple");

      const artisticPrompt = service.constructPrompt(verse, "artistic");
      expect(artisticPrompt).toContain("creative");
    });
  });

  describe("validatePrompt", () => {
    test("should accept valid prompts", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const result = service.validatePrompt(
        "A beautiful scene with mountains and rivers"
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("should reject empty prompts", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const result = service.validatePrompt("");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Prompt cannot be empty");
    });

    test("should reject prompts that are too short", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const result = service.validatePrompt("short");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Prompt must be at least 10 characters"
      );
    });

    test("should reject prompts that are too long", () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      const longPrompt = "a".repeat(1001);
      const result = service.validatePrompt(longPrompt);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Prompt exceeds maximum length of 1000 characters"
      );
    });
  });

  describe("generate", () => {
    test("should throw error for invalid prompt", async () => {
      const mockAi = {} as Ai;
      const service = new ImageGenerationService(mockAi);

      await expect(service.generate({ prompt: "" })).rejects.toThrow(
        ImageGenerationError
      );

      try {
        await service.generate({ prompt: "" });
      } catch (error) {
        expect(error).toBeInstanceOf(ImageGenerationError);
        expect((error as ImageGenerationError).code).toBe(
          ErrorCode.INVALID_REQUEST_FORMAT
        );
      }
    });

    test("should handle AI service failures", async () => {
      const mockAi = {
        run: async () => {
          throw new Error("AI service unavailable");
        },
      } as Ai;

      const service = new ImageGenerationService(mockAi);

      await expect(
        service.generate({ prompt: "A beautiful scene" })
      ).rejects.toThrow(ImageGenerationError);

      try {
        await service.generate({ prompt: "A beautiful scene" });
      } catch (error) {
        expect(error).toBeInstanceOf(ImageGenerationError);
        expect((error as ImageGenerationError).code).toBe(
          ErrorCode.MODEL_INFERENCE_FAILED
        );
      }
    });

    test(
      "should handle timeout",
      { timeout: 35000 },
      async () => {
        const mockAi = {
          run: async () => {
            // Simulate a long-running operation that exceeds 30 seconds
            await new Promise((resolve) => setTimeout(resolve, 31000));
            return { image: "base64data" };
          },
        } as Ai;

        const service = new ImageGenerationService(mockAi);

        try {
          await service.generate({ prompt: "A beautiful scene" });
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(ImageGenerationError);
          expect((error as ImageGenerationError).code).toBe(
            ErrorCode.AI_SERVICE_TIMEOUT
          );
          expect((error as ImageGenerationError).message).toContain(
            "timed out after 30 seconds"
          );
        }
      }
    );

    test("should handle missing image in response", async () => {
      const mockAi = {
        run: async () => {
          return {}; // No image field
        },
      } as Ai;

      const service = new ImageGenerationService(mockAi);

      await expect(
        service.generate({ prompt: "A beautiful scene" })
      ).rejects.toThrow(ImageGenerationError);

      try {
        await service.generate({ prompt: "A beautiful scene" });
      } catch (error) {
        expect(error).toBeInstanceOf(ImageGenerationError);
        expect((error as ImageGenerationError).code).toBe(
          ErrorCode.MODEL_INFERENCE_FAILED
        );
      }
    });

    test("should successfully generate image with valid input", async () => {
      const mockAi = {
        run: async () => {
          return {
            image:
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          };
        },
      } as Ai;

      const service = new ImageGenerationService(mockAi);

      const result = await service.generate({
        prompt: "A beautiful biblical scene",
      });

      expect(result).toBeDefined();
      expect(result.imageData).toBeInstanceOf(ArrayBuffer);
      expect(result.format).toBe("png");
      expect(result.metadata.model).toBe(
        "@cf/black-forest-labs/flux-1-schnell"
      );
    });
  });

  describe("STYLE_PRESETS", () => {
    test("should have all required style presets", () => {
      expect(STYLE_PRESETS.modern).toBeDefined();
      expect(STYLE_PRESETS.classic).toBeDefined();
      expect(STYLE_PRESETS.minimalist).toBeDefined();
      expect(STYLE_PRESETS.artistic).toBeDefined();
    });

    test("each preset should have adjectives and negativePrompt", () => {
      for (const [style, config] of Object.entries(STYLE_PRESETS)) {
        expect(config.adjectives).toBeDefined();
        expect(config.adjectives.length).toBeGreaterThan(0);
        expect(config.negativePrompt).toBeDefined();
        expect(config.negativePrompt.length).toBeGreaterThan(0);
      }
    });
  });
});
