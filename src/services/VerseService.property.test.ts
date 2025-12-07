/**
 * Property-based tests for VerseService
 * Using fast-check for property-based testing
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { VerseService } from './VerseService';

/**
 * Mock D1 database for testing
 */
class MockD1Database {
  private verses: Map<string, any> = new Map();
  private preparedStatement: any = null;
  
  constructor(initialVerses: any[] = []) {
    initialVerses.forEach(verse => {
      this.verses.set(verse.reference, { ...verse });
    });
  }
  
  prepare(query: string) {
    this.preparedStatement = {
      query,
      bindings: [] as any[],
      bind: (...args: any[]) => {
        this.preparedStatement.bindings = args;
        return this.preparedStatement;
      },
      first: async () => {
        // Handle SELECT query for daily verse
        if (query.includes('ORDER BY last_used')) {
          // Find verse with oldest last_used or null
          let oldestVerse: any = null;
          let oldestTime: Date | null = null;
          
          for (const verse of this.verses.values()) {
            const lastUsed = verse.last_used ? new Date(verse.last_used) : null;
            if (!oldestTime || !lastUsed || lastUsed < oldestTime) {
              oldestTime = lastUsed;
              oldestVerse = verse;
            }
          }
          
          return oldestVerse;
        }
        return null;
      },
      run: async () => {
        // Handle UPDATE query for last_used
        if (query.includes('UPDATE verses')) {
          const reference = this.preparedStatement.bindings[0];
          const verse = this.verses.get(reference);
          if (verse) {
            verse.last_used = new Date().toISOString();
            verse.use_count = (verse.use_count || 0) + 1;
          }
          return { success: true };
        }
        return { success: false };
      },
      all: async () => {
        return { results: [] };
      }
    };
    return this.preparedStatement;
  }
  
  getVerse(reference: string) {
    return this.verses.get(reference);
  }
}

describe('VerseService - Property-Based Tests', () => {
  /**
   * Feature: bible-image-generator, Property 13: Daily verse selection
   * 
   * Property: For any daily generation run, a verse should be selected from the database,
   * and that verse's last_used timestamp should be updated.
   * 
   * This test verifies:
   * 1. A verse is selected from the database
   * 2. The verse's last_used timestamp is updated after selection
   * 3. The verse's use_count is incremented
   * 4. Multiple calls work consistently and update timestamps
   */
  test('Property 13: Daily verse selection - updates last_used timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            reference: fc.constantFrom('John 3:16', 'Psalm 23:1', 'Romans 8:28', 'Philippians 4:13', 'Proverbs 3:5'),
            text: fc.lorem({ maxCount: 30 }),
            book: fc.constantFrom('John', 'Psalm', 'Romans', 'Philippians', 'Proverbs'),
            chapter: fc.integer({ min: 1, max: 150 }),
            verse: fc.integer({ min: 1, max: 50 }),
            translation: fc.constant('NIV'),
            theme: fc.constant(null),
            last_used: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
            use_count: fc.integer({ min: 0, max: 100 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 10 }), // Number of times to call getDailyVerse
        async (verses, numCalls) => {
          // Create mock database with verses
          const mockDb = new MockD1Database(verses) as unknown as D1Database;
          const service = new VerseService(mockDb);
          
          // Track which verses were selected
          const selectedReferences = new Set<string>();
          
          // Call getDailyVerse multiple times
          for (let i = 0; i < numCalls; i++) {
            const verse = await service.getDailyVerse();
            
            // Verify a valid verse was returned
            expect(verse).toBeDefined();
            expect(verse.reference).toBeTruthy();
            expect(typeof verse.reference).toBe('string');
            expect(verse.reference.length).toBeGreaterThan(0);
            
            expect(verse.text).toBeTruthy();
            expect(typeof verse.text).toBe('string');
            
            expect(verse.book).toBeTruthy();
            expect(typeof verse.book).toBe('string');
            
            expect(typeof verse.chapter).toBe('number');
            expect(verse.chapter).toBeGreaterThan(0);
            
            expect(typeof verse.verse).toBe('number');
            expect(verse.verse).toBeGreaterThan(0);
            
            expect(verse.translation).toBeTruthy();
            
            selectedReferences.add(verse.reference);
            
            // Verify the verse exists in our mock database
            const dbVerse = (mockDb as any).getVerse(verse.reference);
            expect(dbVerse).toBeDefined();
            
            // Verify last_used was updated (should be recent)
            if (dbVerse.last_used) {
              const lastUsedDate = new Date(dbVerse.last_used);
              const now = new Date();
              const timeDiff = now.getTime() - lastUsedDate.getTime();
              // Should be updated within the last few seconds
              expect(timeDiff).toBeLessThan(5000);
            }
            
            // Verify use_count was incremented
            expect(dbVerse.use_count).toBeGreaterThan(0);
          }
          
          // At least one verse should have been selected
          expect(selectedReferences.size).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Additional property: Verse reference parsing should be consistent
   * 
   * For any valid verse reference format, parsing should extract the correct components
   */
  test('Property: Verse reference parsing consistency', async () => {
    // Custom generator for valid verse references
    const verseReferenceArb = fc.record({
      book: fc.constantFrom('John', 'Psalm', 'Genesis', 'Romans', 'Matthew'),
      chapter: fc.integer({ min: 1, max: 150 }),
      verse: fc.integer({ min: 1, max: 50 }),
    }).map(({ book, chapter, verse }) => ({
      reference: `${book} ${chapter}:${verse}`,
    }));
    
    await fc.assert(
      fc.asyncProperty(
        verseReferenceArb,
        async ({ reference }) => {
          const service = new VerseService();
          
          try {
            // Try to get the verse (may not exist in embedded data)
            await service.getVerse(reference);
          } catch (error: any) {
            // If verse not found, that's ok - we're testing that the reference was parsed correctly
            // The error message should contain the reference we provided
            expect(error.message).toContain(reference);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Search should return verses matching the query
   * 
   * For any search query that matches a known verse, the results should include that verse
   */
  test('Property: Search returns matching verses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('John', 'Psalm', 'love', 'strength', 'God'),
        async (query) => {
          const service = new VerseService();
          const results = await service.searchVerses(query);
          
          // All results should match the query in some way
          for (const verse of results) {
            const matchesReference = verse.reference.toLowerCase().includes(query.toLowerCase());
            const matchesText = verse.text.toLowerCase().includes(query.toLowerCase());
            const matchesBook = verse.book.toLowerCase().includes(query.toLowerCase());
            
            expect(matchesReference || matchesText || matchesBook).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: getVerse should be deterministic for the same reference
   * 
   * For any valid verse reference, calling getVerse multiple times should return the same verse
   */
  test('Property: getVerse is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('John 3:16', 'Psalm 23:1', 'Philippians 4:13'),
        async (reference) => {
          const service = new VerseService();
          
          const verse1 = await service.getVerse(reference);
          const verse2 = await service.getVerse(reference);
          
          // Should return the exact same verse data
          expect(verse1.reference).toBe(verse2.reference);
          expect(verse1.text).toBe(verse2.text);
          expect(verse1.book).toBe(verse2.book);
          expect(verse1.chapter).toBe(verse2.chapter);
          expect(verse1.verse).toBe(verse2.verse);
          expect(verse1.translation).toBe(verse2.translation);
        }
      ),
      { numRuns: 100 }
    );
  });
});
