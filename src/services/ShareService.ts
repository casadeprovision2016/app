/**
 * ShareService: Manages share link generation for various platforms
 * 
 * Responsibilities:
 * - Generate WhatsApp share links with formatted messages
 * - Create Web Share API data for native sharing
 * - Format share messages with verse text and image URLs
 */

import { Verse, ShareData } from '../types';

/**
 * Service for generating share links and data
 */
export class ShareService {
  /**
   * Generates a WhatsApp share link with encoded message
   * 
   * Creates a wa.me URL that opens WhatsApp with a pre-populated message
   * containing the verse text, reference, and image URL.
   * 
   * Format: https://wa.me/?text={encodedMessage}
   * Message: "{verseText}" - {verseReference}\n{imageUrl}
   * 
   * @param imageUrl Public URL of the generated image
   * @param verse Verse object containing reference and text
   * @returns WhatsApp share URL
   */
  generateWhatsAppLink(imageUrl: string, verse: Verse): string {
    // Construct the message with verse text, reference, and image URL
    const message = `"${verse.text}" - ${verse.reference}\n${imageUrl}`;
    
    // Encode the message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Return the WhatsApp share URL
    return `https://wa.me/?text=${encodedMessage}`;
  }
  
  /**
   * Generates Web Share API data for native sharing
   * 
   * Creates a ShareData object that can be used with the Web Share API
   * to open the native sharing dialog on mobile devices.
   * 
   * @param imageUrl Public URL of the generated image
   * @param verse Verse object containing reference and text
   * @returns ShareData object for Web Share API
   */
  generateWebShareData(imageUrl: string, verse: Verse): ShareData {
    return {
      title: `${verse.reference} - Bible Image`,
      text: `"${verse.text}" - ${verse.reference}`,
      url: imageUrl,
    };
  }
}
