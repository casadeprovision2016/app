import { describe, test, expect } from "vitest";
import {
  ErrorCode,
  type Verse,
  type ImageMetadata,
  type GenerationParams,
  type GeneratedImage,
  type GenerateImageRequest,
  type GenerateImageResponse,
  type ErrorResponse,
  type StylePreset,
  type UserTier,
  type RateLimitResult,
  type ValidationResult,
} from "./index";

describe("Core Data Models and Types", () => {
  describe("Verse interface", () => {
    test("should accept valid verse data", () => {
      const verse: Verse = {
        reference: "John 3:16",
        text: "For God so loved the world...",
        book: "John",
        chapter: 3,
        verse: 16,
        translation: "NIV",
      };

      expect(verse.reference).toBe("John 3:16");
      expect(verse.book).toBe("John");
      expect(verse.chapter).toBe(3);
    });
  });

  describe("ImageMetadata interface", () => {
    test("should accept valid metadata with required fields", () => {
      const metadata: ImageMetadata = {
        imageId: "test-id-123",
        verseReference: "John 3:16",
        verseText: "For God so loved the world...",
        prompt: "Inspirational biblical scene",
        stylePreset: "modern",
        generatedAt: new Date().toISOString(),
        tags: ["daily-verse"],
        moderationStatus: "approved",
      };

      expect(metadata.imageId).toBe("test-id-123");
      expect(metadata.moderationStatus).toBe("approved");
    });

    test("should accept metadata with optional fields", () => {
      const metadata: ImageMetadata = {
        imageId: "test-id-456",
        userId: "user-123",
        verseReference: "Psalms 23:1",
        verseText: "The Lord is my shepherd",
        prompt: "Peaceful scene",
        stylePreset: "classic",
        generatedAt: new Date().toISOString(),
        tags: [],
        moderationStatus: "pending",
        r2Key: "images/2025/01/test.webp",
        fileSize: 50000,
        format: "webp",
        width: 1024,
        height: 1024,
      };

      expect(metadata.userId).toBe("user-123");
      expect(metadata.r2Key).toBe("images/2025/01/test.webp");
    });
  });

  describe("GenerationParams interface", () => {
    test("should accept minimal generation params", () => {
      const params: GenerationParams = {
        prompt: "A beautiful biblical scene",
      };

      expect(params.prompt).toBe("A beautiful biblical scene");
    });

    test("should accept full generation params", () => {
      const params: GenerationParams = {
        prompt: "A beautiful biblical scene",
        seed: 12345,
        width: 1024,
        height: 1024,
        steps: 30,
      };

      expect(params.seed).toBe(12345);
      expect(params.width).toBe(1024);
    });
  });

  describe("GeneratedImage interface", () => {
    test("should accept valid generated image data", () => {
      const buffer = new ArrayBuffer(100);
      const image: GeneratedImage = {
        imageData: buffer,
        format: "webp",
        metadata: {
          model: "flux-2-dev",
          seed: 12345,
          dimensions: { width: 1024, height: 1024 },
        },
      };

      expect(image.format).toBe("webp");
      expect(image.metadata.model).toBe("flux-2-dev");
    });
  });

  describe("API Request Types", () => {
    test("GenerateImageRequest should accept minimal request", () => {
      const request: GenerateImageRequest = {
        verseReference: "John 3:16",
      };

      expect(request.verseReference).toBe("John 3:16");
    });

    test("GenerateImageRequest should accept full request", () => {
      const request: GenerateImageRequest = {
        verseReference: "John 3:16",
        verseText: "For God so loved the world...",
        stylePreset: "modern",
        customPrompt: "Add golden light",
        requestId: "req-123",
      };

      expect(request.stylePreset).toBe("modern");
      expect(request.requestId).toBe("req-123");
    });
  });

  describe("API Response Types", () => {
    test("GenerateImageResponse should have correct structure", () => {
      const response: GenerateImageResponse = {
        imageId: "img-123",
        imageUrl: "https://example.com/image.webp",
        whatsappShareUrl: "https://wa.me/?text=...",
        verseReference: "John 3:16",
        verseText: "For God so loved the world...",
      };

      expect(response.imageId).toBe("img-123");
      expect(response.whatsappShareUrl).toContain("wa.me");
    });
  });

  describe("Error Types", () => {
    test("ErrorResponse should have correct structure", () => {
      const error: ErrorResponse = {
        error: {
          code: ErrorCode.INVALID_VERSE_REFERENCE,
          message: "Invalid verse reference format",
          requestId: "req-123",
        },
      };

      expect(error.error.code).toBe(ErrorCode.INVALID_VERSE_REFERENCE);
      expect(error.error.message).toBeTruthy();
    });

    test("ErrorResponse should accept optional fields", () => {
      const error: ErrorResponse = {
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: "Too many requests",
          requestId: "req-456",
          retryAfter: 3600,
          details: { limit: 5, current: 6 },
        },
      };

      expect(error.error.retryAfter).toBe(3600);
      expect(error.error.details).toBeDefined();
    });
  });

  describe("Type Constraints", () => {
    test("StylePreset should only accept valid values", () => {
      const validStyles: StylePreset[] = [
        "modern",
        "classic",
        "minimalist",
        "artistic",
      ];

      validStyles.forEach((style) => {
        const request: GenerateImageRequest = {
          verseReference: "John 3:16",
          stylePreset: style,
        };
        expect(request.stylePreset).toBe(style);
      });
    });

    test("UserTier should only accept valid values", () => {
      const tiers: UserTier[] = ["anonymous", "authenticated"];

      tiers.forEach((tier) => {
        const tierValue: UserTier = tier;
        expect(tierValue).toBe(tier);
      });
    });

    test("ModerationStatus should only accept valid values", () => {
      const statuses = ["pending", "approved", "rejected"] as const;

      statuses.forEach((status) => {
        const metadata: ImageMetadata = {
          imageId: "test",
          verseReference: "John 3:16",
          verseText: "Test",
          prompt: "Test",
          stylePreset: "modern",
          generatedAt: new Date().toISOString(),
          tags: [],
          moderationStatus: status,
        };
        expect(metadata.moderationStatus).toBe(status);
      });
    });
  });

  describe("Utility Types", () => {
    test("RateLimitResult should have correct structure", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 4,
        resetAt: Date.now() + 3600000,
      };

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test("ValidationResult should support valid and invalid states", () => {
      const validResult: ValidationResult = {
        valid: true,
      };

      const invalidResult: ValidationResult = {
        valid: false,
        errors: ["Invalid format", "Missing field"],
      };

      expect(validResult.valid).toBe(true);
      expect(invalidResult.errors).toHaveLength(2);
    });
  });
});
