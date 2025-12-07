import React from 'react';
import { GeneratedImage } from '../context/AppContext';

interface ImageDisplayProps {
  image: GeneratedImage;
  onShare?: () => void;
  onDownload?: () => void;
}

/**
 * ImageDisplay component displays a generated biblical image with sharing and download capabilities.
 * 
 * Features:
 * - Responsive image display with proper sizing
 * - Download button to save image locally
 * - WhatsApp share button for easy sharing
 * - Web Share API integration for mobile devices
 * - Displays verse reference and text
 * 
 * Requirements: 11.4, 3.3, 3.4
 */
export const ImageDisplay: React.FC<ImageDisplayProps> = ({ image, onShare, onDownload }) => {
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      // Fetch the image as a blob
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${image.verseReference.replace(/\s+/g, '-')}.webp`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: open in new tab
      window.open(image.imageUrl, '_blank');
    }
  };

  const handleWhatsAppShare = () => {
    if (onShare) {
      onShare();
      return;
    }

    // Use the WhatsApp share URL from the API response
    if (image.whatsappShareUrl) {
      window.open(image.whatsappShareUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback: construct WhatsApp share URL manually
      const message = encodeURIComponent(`"${image.verseText}" - ${image.verseReference}\n${image.imageUrl}`);
      window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleWebShare = async () => {
    // Check if Web Share API is available (primarily mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: image.verseReference,
          text: `"${image.verseText}" - ${image.verseReference}`,
          url: image.imageUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to WhatsApp
          handleWhatsAppShare();
        }
      }
    } else {
      // Fallback to WhatsApp for desktop
      handleWhatsAppShare();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-5 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Image Display with responsive sizing */}
      <div className="mb-4 sm:mb-5 md:mb-6">
        <img
          src={image.imageUrl}
          alt={`Biblical image for ${image.verseReference}`}
          className="w-full h-auto rounded-lg shadow-md object-contain max-h-[400px] sm:max-h-[500px] md:max-h-[600px]"
          loading="lazy"
        />
      </div>

      {/* Verse Reference and Text */}
      <div className="mb-4 sm:mb-5 md:mb-6 text-center px-2">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
          {image.verseReference}
        </h3>
        <p className="text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 italic leading-relaxed">
          "{image.verseText}"
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 min-w-[120px] sm:min-w-[140px] max-w-[200px] bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base"
          aria-label="Download image"
        >
          📥 Download
        </button>

        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="flex-1 min-w-[120px] sm:min-w-[140px] max-w-[200px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base"
          aria-label="Share on WhatsApp"
        >
          💬 WhatsApp
        </button>

        {/* Web Share API button - only show on supported devices */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleWebShare}
            className="flex-1 min-w-[120px] sm:min-w-[140px] max-w-[200px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base"
            aria-label="Share via Web Share API"
          >
            🔗 Share
          </button>
        )}
      </div>

      {/* Generation timestamp (if available) */}
      {image.generatedAt && (
        <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Generated: {new Date(image.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};
