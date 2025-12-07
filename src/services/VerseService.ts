/**
 * VerseService: Manages verse data retrieval and selection
 * 
 * Responsibilities:
 * - Parse verse references (e.g., "John 3:16")
 * - Retrieve verses from embedded JSON or D1 database
 * - Select daily verses for automated generation
 * - Search verses by reference or text
 */

import { Verse, ErrorCode } from '../types';
import versesData from '../data/verses.json';

/**
 * Error thrown when a verse reference is invalid or not found
 */
export class VerseNotFoundError extends Error {
  code: ErrorCode;
  
  constructor(message: string) {
    super(message);
    this.name = 'VerseNotFoundError';
    this.code = ErrorCode.INVALID_VERSE_REFERENCE;
  }
}

/**
 * Parsed components of a verse reference
 */
interface ParsedReference {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number; // For ranges like "John 3:16-17"
}

/**
 * Service for managing biblical verse data
 */
export class VerseService {
  private verses: Verse[];
  private db?: D1Database;
  
  /**
   * Creates a new VerseService instance
   * @param db Optional D1 database binding for verse queries
   */
  constructor(db?: D1Database) {
    this.verses = versesData as Verse[];
    this.db = db;
  }
  
  /**
   * Retrieves a verse by its reference
   * 
   * @param reference Verse reference (e.g., "John 3:16", "Psalm 23:1")
   * @returns Promise resolving to the Verse object
   * @throws VerseNotFoundError if the reference is invalid or verse not found
   */
  async getVerse(reference: string): Promise<Verse> {
    // Parse the reference
    const parsed = this.parseReference(reference);
    
    // Try to find in embedded data first
    const embeddedVerse = this.findInEmbeddedData(parsed);
    if (embeddedVerse) {
      return embeddedVerse;
    }
    
    // If D1 is available, query the database
    if (this.db) {
      const dbVerse = await this.findInDatabase(parsed);
      if (dbVerse) {
        return dbVerse;
      }
    }
    
    // Verse not found
    throw new VerseNotFoundError(
      `Verse not found: ${reference}. Please check the reference format (e.g., "John 3:16").`
    );
  }
  
  /**
   * Retrieves the current daily verse
   * 
   * Selects a verse from the database rotation or falls back to embedded data.
   * Updates the last_used timestamp and use_count in the database.
   * 
   * @returns Promise resolving to the daily Verse object
   */
  async getDailyVerse(): Promise<Verse> {
    if (!this.db) {
      // Fallback: return a random verse from embedded data
      return this.getRandomEmbeddedVerse();
    }
    
    try {
      // Query for the least recently used verse
      const result = await this.db
        .prepare(`
          SELECT reference, text, book, chapter, verse, translation, theme
          FROM verses
          ORDER BY last_used ASC NULLS FIRST, use_count ASC
          LIMIT 1
        `)
        .first<{
          reference: string;
          text: string;
          book: string;
          chapter: number;
          verse: number;
          translation: string;
          theme: string | null;
        }>();
      
      if (!result) {
        // No verses in database, use embedded data
        return this.getRandomEmbeddedVerse();
      }
      
      // Update the verse usage statistics
      await this.db
        .prepare(`
          UPDATE verses
          SET last_used = datetime('now'),
              use_count = use_count + 1
          WHERE reference = ?
        `)
        .bind(result.reference)
        .run();
      
      // Return the verse
      return {
        reference: result.reference,
        text: result.text,
        book: result.book,
        chapter: result.chapter,
        verse: result.verse,
        translation: result.translation,
      };
    } catch (error) {
      // Database error, fallback to embedded data
      console.error('Error fetching daily verse from database:', error);
      return this.getRandomEmbeddedVerse();
    }
  }
  
  /**
   * Searches for verses matching a query
   * 
   * Searches by reference or text content in both embedded data and database.
   * 
   * @param query Search query (reference or text fragment)
   * @returns Promise resolving to array of matching Verse objects
   */
  async searchVerses(query: string): Promise<Verse[]> {
    const results: Verse[] = [];
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search embedded data
    for (const verse of this.verses) {
      if (
        verse.reference.toLowerCase().includes(normalizedQuery) ||
        verse.text.toLowerCase().includes(normalizedQuery) ||
        verse.book.toLowerCase().includes(normalizedQuery)
      ) {
        results.push(verse);
      }
    }
    
    // Search database if available
    if (this.db) {
      try {
        const dbResults = await this.db
          .prepare(`
            SELECT reference, text, book, chapter, verse, translation
            FROM verses
            WHERE reference LIKE ? OR text LIKE ? OR book LIKE ?
            LIMIT 50
          `)
          .bind(`%${query}%`, `%${query}%`, `%${query}%`)
          .all<{
            reference: string;
            text: string;
            book: string;
            chapter: number;
            verse: number;
            translation: string;
          }>();
        
        if (dbResults.results) {
          for (const row of dbResults.results) {
            // Avoid duplicates from embedded data
            if (!results.some(v => v.reference === row.reference)) {
              results.push({
                reference: row.reference,
                text: row.text,
                book: row.book,
                chapter: row.chapter,
                verse: row.verse,
                translation: row.translation,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error searching verses in database:', error);
      }
    }
    
    return results;
  }
  
  /**
   * Parses a verse reference string into its components
   * 
   * Supports formats:
   * - "John 3:16"
   * - "Psalm 23:1"
   * - "1 Corinthians 13:4"
   * - "John 3:16-17" (ranges)
   * 
   * @param reference Verse reference string
   * @returns Parsed reference components
   * @throws VerseNotFoundError if the reference format is invalid
   */
  private parseReference(reference: string): ParsedReference {
    // Normalize the reference
    const normalized = reference.trim();
    
    // Pattern: "Book Chapter:Verse" or "Book Chapter:Verse-EndVerse"
    // Examples: "John 3:16", "1 Corinthians 13:4", "John 3:16-17"
    const pattern = /^((?:\d\s)?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/;
    const match = normalized.match(pattern);
    
    if (!match) {
      throw new VerseNotFoundError(
        `Invalid verse reference format: "${reference}". Expected format: "Book Chapter:Verse" (e.g., "John 3:16").`
      );
    }
    
    const [, book, chapterStr, verseStr, endVerseStr] = match;
    
    return {
      book: book.trim(),
      chapter: parseInt(chapterStr, 10),
      verse: parseInt(verseStr, 10),
      endVerse: endVerseStr ? parseInt(endVerseStr, 10) : undefined,
    };
  }
  
  /**
   * Finds a verse in the embedded JSON data
   * 
   * @param parsed Parsed reference components
   * @returns Verse object if found, undefined otherwise
   */
  private findInEmbeddedData(parsed: ParsedReference): Verse | undefined {
    return this.verses.find(
      v =>
        v.book.toLowerCase() === parsed.book.toLowerCase() &&
        v.chapter === parsed.chapter &&
        v.verse === parsed.verse
    );
  }
  
  /**
   * Finds a verse in the D1 database
   * 
   * @param parsed Parsed reference components
   * @returns Promise resolving to Verse object if found, undefined otherwise
   */
  private async findInDatabase(parsed: ParsedReference): Promise<Verse | undefined> {
    if (!this.db) {
      return undefined;
    }
    
    try {
      const result = await this.db
        .prepare(`
          SELECT reference, text, book, chapter, verse, translation
          FROM verses
          WHERE LOWER(book) = LOWER(?) AND chapter = ? AND verse = ?
          LIMIT 1
        `)
        .bind(parsed.book, parsed.chapter, parsed.verse)
        .first<{
          reference: string;
          text: string;
          book: string;
          chapter: number;
          verse: number;
          translation: string;
        }>();
      
      if (!result) {
        return undefined;
      }
      
      return {
        reference: result.reference,
        text: result.text,
        book: result.book,
        chapter: result.chapter,
        verse: result.verse,
        translation: result.translation,
      };
    } catch (error) {
      console.error('Error querying verse from database:', error);
      return undefined;
    }
  }
  
  /**
   * Returns a random verse from the embedded data
   * 
   * @returns Random Verse object
   */
  private getRandomEmbeddedVerse(): Verse {
    const randomIndex = Math.floor(Math.random() * this.verses.length);
    return this.verses[randomIndex];
  }
}
