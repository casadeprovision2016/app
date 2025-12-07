/**
 * ValidationService: Handles input validation and sanitization
 * 
 * Responsibilities:
 * - Sanitize prompts to remove blocked terms
 * - Load and manage blocklist from KV or configuration
 * - Validate verse reference formats
 * - Validate API request structures
 */

import { 
  ErrorCode, 
  ValidationResult, 
  StylePreset,
  GenerateImageRequest 
} from '../types';

/**
 * Configuration for the validation service
 */
export interface ValidationConfig {
  blocklist?: string[];
  maxPromptLength?: number;
  maxVerseReferenceLength?: number;
}

/**
 * Default blocklist of inappropriate terms
 * In production, this should be loaded from KV storage
 */
const DEFAULT_BLOCKLIST = [
  'violence',
  'hate',
  'explicit',
  'inappropriate',
  'offensive',
  'nsfw',
  'gore',
  'sexual',
  'nude',
  'naked',
  'porn',
  'xxx',
  'kill',
  'murder',
  'death',
  'blood',
  'weapon',
  'gun',
  'knife',
];

/**
 * Valid style presets
 */
const VALID_STYLE_PRESETS: StylePreset[] = ['modern', 'classic', 'minimalist', 'artistic'];

/**
 * Service for input validation and sanitization
 */
export class ValidationService {
  private blocklist: Set<string>;
  private maxPromptLength: number;
  private maxVerseReferenceLength: number;
  private kv?: KVNamespace;
  
  /**
   * Creates a new ValidationService instance
   * 
   * @param kv Optional KV namespace for loading blocklist
   * @param config Optional configuration overrides
   */
  constructor(kv?: KVNamespace, config?: ValidationConfig) {
    this.kv = kv;
    this.blocklist = new Set(config?.blocklist || DEFAULT_BLOCKLIST);
    this.maxPromptLength = config?.maxPromptLength || 1000;
    this.maxVerseReferenceLength = config?.maxVerseReferenceLength || 100;
  }
  
  /**
   * Loads the blocklist from KV storage
   * 
   * If KV is not available or the key doesn't exist, uses the default blocklist.
   * The blocklist should be stored as a JSON array of strings.
   * 
   * @returns Promise that resolves when the blocklist is loaded
   */
  async loadBlocklist(): Promise<void> {
    if (!this.kv) {
      return;
    }
    
    try {
      const blocklistJson = await this.kv.get('config:moderation-blocklist');
      if (blocklistJson) {
        const blocklistArray = JSON.parse(blocklistJson) as string[];
        this.blocklist = new Set(blocklistArray.map(term => term.toLowerCase()));
      }
    } catch (error) {
      console.error('Error loading blocklist from KV:', error);
      // Continue with default blocklist
    }
  }
  
  /**
   * Sanitizes a prompt by removing blocked terms
   * 
   * Removes any words that appear in the blocklist (case-insensitive).
   * Returns the sanitized prompt with blocked terms replaced by "[removed]".
   * 
   * @param prompt The prompt text to sanitize
   * @returns Sanitized prompt string
   */
  sanitizePrompt(prompt: string): string {
    if (!prompt) {
      return '';
    }
    
    // Split into words, preserving punctuation
    const words = prompt.split(/\b/);
    
    // Replace blocked terms
    const sanitized = words.map(word => {
      const normalized = word.toLowerCase().trim();
      if (this.blocklist.has(normalized)) {
        return '[removed]';
      }
      return word;
    });
    
    return sanitized.join('').replace(/\[removed\]\s*/g, '').trim();
  }
  
  /**
   * Validates a prompt against the blocklist
   * 
   * Checks if the prompt contains any blocked terms.
   * 
   * @param prompt The prompt text to validate
   * @returns ValidationResult indicating if the prompt is valid
   */
  validatePrompt(prompt: string): ValidationResult {
    if (!prompt) {
      return { valid: true };
    }
    
    if (prompt.length > this.maxPromptLength) {
      return {
        valid: false,
        errors: [`Prompt exceeds maximum length of ${this.maxPromptLength} characters`],
      };
    }
    
    // Check for blocked terms
    const words = prompt.toLowerCase().split(/\b/);
    const foundBlockedTerms: string[] = [];
    
    for (const word of words) {
      const normalized = word.trim();
      if (this.blocklist.has(normalized)) {
        foundBlockedTerms.push(normalized);
      }
    }
    
    if (foundBlockedTerms.length > 0) {
      return {
        valid: false,
        errors: [`Prompt contains blocked terms: ${foundBlockedTerms.join(', ')}`],
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validates a verse reference format
   * 
   * Checks if the reference matches expected patterns:
   * - "Book Chapter:Verse" (e.g., "John 3:16")
   * - "Book Chapter:Verse-EndVerse" (e.g., "John 3:16-17")
   * - Supports books with numbers (e.g., "1 Corinthians 13:4")
   * 
   * @param reference The verse reference to validate
   * @returns ValidationResult indicating if the reference is valid
   */
  validateVerseReference(reference: string): ValidationResult {
    if (!reference || typeof reference !== 'string') {
      return {
        valid: false,
        errors: ['Verse reference is required'],
      };
    }
    
    if (reference.length > this.maxVerseReferenceLength) {
      return {
        valid: false,
        errors: [`Verse reference exceeds maximum length of ${this.maxVerseReferenceLength} characters`],
      };
    }
    
    // Pattern: "Book Chapter:Verse" or "Book Chapter:Verse-EndVerse"
    // Examples: "John 3:16", "1 Corinthians 13:4", "John 3:16-17"
    const pattern = /^((?:\d\s)?[A-Za-z\s]+)\s+(\d+):(\d+)(?:-(\d+))?$/;
    const match = reference.trim().match(pattern);
    
    if (!match) {
      return {
        valid: false,
        errors: [
          'Invalid verse reference format. Expected format: "Book Chapter:Verse" (e.g., "John 3:16")',
        ],
      };
    }
    
    // Validate chapter and verse numbers are positive
    const chapter = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);
    const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
    
    if (chapter <= 0 || verse <= 0) {
      return {
        valid: false,
        errors: ['Chapter and verse numbers must be positive'],
      };
    }
    
    if (endVerse !== undefined && endVerse <= verse) {
      return {
        valid: false,
        errors: ['End verse must be greater than start verse'],
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validates a style preset
   * 
   * @param stylePreset The style preset to validate
   * @returns ValidationResult indicating if the style preset is valid
   */
  validateStylePreset(stylePreset?: string): ValidationResult {
    if (!stylePreset) {
      return { valid: true }; // Optional field
    }
    
    if (!VALID_STYLE_PRESETS.includes(stylePreset as StylePreset)) {
      return {
        valid: false,
        errors: [
          `Invalid style preset. Must be one of: ${VALID_STYLE_PRESETS.join(', ')}`,
        ],
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validates a complete generation request
   * 
   * Validates all fields in the request including:
   * - Verse reference format
   * - Style preset (if provided)
   * - Custom prompt (if provided)
   * 
   * @param request The generation request to validate
   * @returns ValidationResult with all validation errors
   */
  validateGenerationRequest(request: GenerateImageRequest): ValidationResult {
    const errors: string[] = [];
    
    // Validate verse reference
    const verseRefResult = this.validateVerseReference(request.verseReference);
    if (!verseRefResult.valid && verseRefResult.errors) {
      errors.push(...verseRefResult.errors);
    }
    
    // Validate style preset
    const styleResult = this.validateStylePreset(request.stylePreset);
    if (!styleResult.valid && styleResult.errors) {
      errors.push(...styleResult.errors);
    }
    
    // Validate custom prompt
    if (request.customPrompt) {
      const promptResult = this.validatePrompt(request.customPrompt);
      if (!promptResult.valid && promptResult.errors) {
        errors.push(...promptResult.errors);
      }
    }
    
    // Validate verse text if provided
    if (request.verseText && request.verseText.length > 1000) {
      errors.push('Verse text exceeds maximum length of 1000 characters');
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    return { valid: true };
  }
  
  /**
   * Gets the current blocklist
   * 
   * @returns Array of blocked terms
   */
  getBlocklist(): string[] {
    return Array.from(this.blocklist);
  }
  
  /**
   * Adds terms to the blocklist
   * 
   * @param terms Terms to add to the blocklist
   */
  addToBlocklist(terms: string[]): void {
    for (const term of terms) {
      this.blocklist.add(term.toLowerCase());
    }
  }
  
  /**
   * Removes terms from the blocklist
   * 
   * @param terms Terms to remove from the blocklist
   */
  removeFromBlocklist(terms: string[]): void {
    for (const term of terms) {
      this.blocklist.delete(term.toLowerCase());
    }
  }
}
