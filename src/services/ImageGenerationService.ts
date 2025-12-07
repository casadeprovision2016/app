/**
 * Image Generation Service
 * Handles AI model interaction and prompt engineering for biblical image generation
 */

import {
  GenerationParams,
  GeneratedImage,
  Verse,
  StylePreset,
  ValidationResult,
  ErrorCode,
} from "../types";

/**
 * Style preset configurations for image generation
 */
export const STYLE_PRESETS: Record<
  StylePreset,
  { adjectives: string; negativePrompt: string }
> = {
  modern: {
    adjectives:
      "contemporary, clean, minimalist aesthetic, soft lighting, professional photography style",
    negativePrompt: "vintage, old-fashioned, cluttered, dark, grainy",
  },
  classic: {
    adjectives:
      "traditional, renaissance-inspired, oil painting style, warm golden tones, classical composition",
    negativePrompt: "modern, digital, neon, abstract, cartoonish",
  },
  minimalist: {
    adjectives:
      "simple, clean lines, negative space, subtle colors, zen-like, peaceful",
    negativePrompt: "busy, cluttered, complex, ornate, detailed",
  },
  artistic: {
    adjectives:
      "creative, expressive, vibrant colors, dynamic composition, artistic interpretation",
    negativePrompt: "plain, boring, dull, lifeless, generic",
  },
};

/**
 * Theme keywords for verse analysis
 */
const VERSE_THEMES: Record<string, string[]> = {
  love: ["love", "beloved", "compassion", "mercy", "grace"],
  hope: ["hope", "faith", "trust", "believe", "promise"],
  strength: ["strength", "power", "mighty", "courage", "strong"],
  peace: ["peace", "calm", "rest", "still", "quiet"],
  joy: ["joy", "rejoice", "glad", "happy", "celebrate"],
  light: ["light", "shine", "bright", "illuminate", "radiance"],
  nature: ["mountain", "valley", "river", "tree", "garden", "shepherd"],
  wisdom: ["wisdom", "knowledge", "understanding", "teach", "learn"],
};

/**
 * Custom error for image generation failures
 */
export class ImageGenerationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

/**
 * Service for generating AI images based on biblical verses
 */
export class ImageGenerationService {
  private readonly MODEL_NAME = "@cf/black-forest-labs/flux-1-schnell";
  private readonly DEFAULT_STEPS = 4;
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  constructor(private ai: Ai) {}

  /**
   * Generate an image based on verse and style parameters
   */
  async generate(params: GenerationParams): Promise<GeneratedImage> {
    const startTime = Date.now();

    try {
      // Validate prompt
      const validation = this.validatePrompt(params.prompt);
      if (!validation.valid) {
        throw new ImageGenerationError(
          `Invalid prompt: ${validation.errors?.join(", ")}`,
          ErrorCode.INVALID_REQUEST_FORMAT,
          { errors: validation.errors }
        );
      }

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new ImageGenerationError(
              "Image generation timed out after 30 seconds",
              ErrorCode.AI_SERVICE_TIMEOUT
            )
          );
        }, this.TIMEOUT_MS);
      });

      // Create generation promise
      const generationPromise = this.ai.run(this.MODEL_NAME, {
        prompt: params.prompt,
        steps: params.steps || this.DEFAULT_STEPS,
      });

      // Race between generation and timeout
      const result = await Promise.race([generationPromise, timeoutPromise]);

      // Check if result has image data
      if (!result || typeof result !== "object" || !("image" in result)) {
        throw new ImageGenerationError(
          "AI service returned invalid response",
          ErrorCode.MODEL_INFERENCE_FAILED,
          { result }
        );
      }

      const output = result as { image?: string };

      if (!output.image) {
        throw new ImageGenerationError(
          "AI service did not return image data",
          ErrorCode.MODEL_INFERENCE_FAILED
        );
      }

      // Decode base64 image
      const imageData = this.base64ToArrayBuffer(output.image);

      const duration = Date.now() - startTime;

      return {
        imageData,
        format: "png", // flux-1-schnell returns PNG
        metadata: {
          model: this.MODEL_NAME,
          seed: params.seed || 0,
          dimensions: {
            width: params.width || 1024,
            height: params.height || 1024,
          },
          duration,
        },
      };
    } catch (error) {
      // Re-throw ImageGenerationError as-is
      if (error instanceof ImageGenerationError) {
        throw error;
      }

      // Wrap other errors
      throw new ImageGenerationError(
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.MODEL_INFERENCE_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Construct a prompt combining verse text and style parameters
   */
  constructPrompt(verse: Verse, style: StylePreset): string {
    const styleConfig = STYLE_PRESETS[style];

    // Analyze verse for themes
    const themes = this.extractThemes(verse.text);
    const themeDescription = themes.length > 0 ? themes.join(", ") : "faith";

    // Build prompt
    const prompt = [
      "Inspirational biblical scene,",
      `theme of ${themeDescription},`,
      verse.text.substring(0, 100), // Include part of verse text
      styleConfig.adjectives,
      "high quality, detailed, professional",
    ].join(" ");

    return prompt;
  }

  /**
   * Validate prompt for safety and format
   */
  validatePrompt(prompt: string): ValidationResult {
    const errors: string[] = [];

    // Check if prompt is empty
    if (!prompt || prompt.trim().length === 0) {
      errors.push("Prompt cannot be empty");
    }

    // Check prompt length
    if (prompt.length > 1000) {
      errors.push("Prompt exceeds maximum length of 1000 characters");
    }

    // Check for minimum length
    if (prompt.trim().length < 10) {
      errors.push("Prompt must be at least 10 characters");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Extract themes from verse text
   */
  private extractThemes(verseText: string): string[] {
    const text = verseText.toLowerCase();
    const foundThemes: string[] = [];

    for (const [theme, keywords] of Object.entries(VERSE_THEMES)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          foundThemes.push(theme);
          break; // Only add theme once
        }
      }
    }

    return foundThemes;
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

    // Decode base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }
}
