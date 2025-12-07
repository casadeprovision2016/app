/**
 * Unit tests for ShareService
 */

import { describe, test, expect } from 'vitest';
import { ShareService } from './ShareService';
import { Verse } from '../types';

describe('ShareService', () => {
  const service = new ShareService();
  
  const sampleVerse: Verse = {
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son',
    book: 'John',
    chapter: 3,
    verse: 16,
    translation: 'NIV',
  };
  
  const sampleImageUrl = 'https://example.com/images/john-3-16.webp';
  
  describe('generateWhatsAppLink', () => {
    test('should generate a valid WhatsApp link', () => {
      const link = service.generateWhatsAppLink(sampleImageUrl, sampleVerse);
      
      expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/);
    });
    
    test('should include verse text in the link', () => {
      const link = service.generateWhatsAppLink(sampleImageUrl, sampleVerse);
      const decodedLink = decodeURIComponent(link);
      
      expect(decodedLink).toContain(sampleVerse.text);
    });
    
    test('should include verse reference in the link', () => {
      const link = service.generateWhatsAppLink(sampleImageUrl, sampleVerse);
      const decodedLink = decodeURIComponent(link);
      
      expect(decodedLink).toContain(sampleVerse.reference);
    });
    
    test('should include image URL in the link', () => {
      const link = service.generateWhatsAppLink(sampleImageUrl, sampleVerse);
      const decodedLink = decodeURIComponent(link);
      
      expect(decodedLink).toContain(sampleImageUrl);
    });
    
    test('should properly encode special characters', () => {
      const verseWithSpecialChars: Verse = {
        ...sampleVerse,
        text: 'He said, "Come & follow me!"',
      };
      
      const link = service.generateWhatsAppLink(sampleImageUrl, verseWithSpecialChars);
      
      // Should be a valid URL
      expect(() => new URL(link)).not.toThrow();
      
      // Should contain encoded special characters
      expect(link).toContain('%22'); // Encoded quote
      expect(link).toContain('%26'); // Encoded ampersand
    });
    
    test('should format message correctly', () => {
      const link = service.generateWhatsAppLink(sampleImageUrl, sampleVerse);
      const urlMatch = link.match(/^https:\/\/wa\.me\/\?text=(.+)$/);
      
      expect(urlMatch).toBeTruthy();
      
      if (urlMatch) {
        const decodedMessage = decodeURIComponent(urlMatch[1]);
        const expectedMessage = `"${sampleVerse.text}" - ${sampleVerse.reference}\n${sampleImageUrl}`;
        
        expect(decodedMessage).toBe(expectedMessage);
      }
    });
  });
  
  describe('generateWebShareData', () => {
    test('should generate valid Web Share data', () => {
      const shareData = service.generateWebShareData(sampleImageUrl, sampleVerse);
      
      expect(shareData).toHaveProperty('title');
      expect(shareData).toHaveProperty('text');
      expect(shareData).toHaveProperty('url');
    });
    
    test('should include verse reference in title', () => {
      const shareData = service.generateWebShareData(sampleImageUrl, sampleVerse);
      
      expect(shareData.title).toContain(sampleVerse.reference);
      expect(shareData.title).toContain('Bible Image');
    });
    
    test('should include verse text and reference in text field', () => {
      const shareData = service.generateWebShareData(sampleImageUrl, sampleVerse);
      
      expect(shareData.text).toContain(sampleVerse.text);
      expect(shareData.text).toContain(sampleVerse.reference);
    });
    
    test('should include image URL in url field', () => {
      const shareData = service.generateWebShareData(sampleImageUrl, sampleVerse);
      
      expect(shareData.url).toBe(sampleImageUrl);
    });
    
    test('should format text with quotes around verse', () => {
      const shareData = service.generateWebShareData(sampleImageUrl, sampleVerse);
      
      expect(shareData.text).toMatch(/^".+" - .+$/);
      expect(shareData.text).toContain(`"${sampleVerse.text}"`);
    });
  });
});
