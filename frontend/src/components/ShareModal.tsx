import React, { useState } from 'react';
import { GeneratedImage } from '../context/AppContext';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';
import { document } from 'postcss';

interface ShareModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ShareModal component provides a modal dialog with various sharing options.
 * 
 * Features:
 * - WhatsApp share button with pre-formatted message
 * - Copy-to-clipboard functionality for image URL
 * - Placeholder for future social media integrations
 * - Responsive modal design with backdrop
 * - Keyboard accessibility (ESC to close)
 * 
 * Requirements: 3.2, 3.3, 3.4
 */
export const ShareModal: React.FC<ShareModalProps> = ({ image, isOpen, onClose }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  /**
   * Handles WhatsApp sharing by opening WhatsApp with pre-formatted message.
   * Uses the whatsappShareUrl from the API response if available.
   * Requirements: 3.2, 3.4
   */
  const handleWhatsAppShare = () => {
    if (image.whatsappShareUrl) {
      window.open(image.whatsappShareUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback: construct WhatsApp share URL manually
      const message = encodeURIComponent(
        `"${image.verseText}" - ${image.verseReference}\n${image.imageUrl}`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Handles Web Share API for mobile devices.
   * Falls back to WhatsApp if Web Share API is not available.
   * Requirements: 3.3, 3.4
   */
  const handleWebShare = async () => {
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

  /**
   * Copies the image URL to clipboard.
   * Shows success feedback for 2 seconds.
   * Requirements: 3.3
   */
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(image.imageUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = image.imageUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  /**
   * Handles backdrop click to close modal.
   */
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto smooth-scroll">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors touch-target"
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Modal header */}
        <h2
          id="share-modal-title"
          className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 pr-8"
        >
          Share Image
        </h2>

        {/* Verse preview */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">
            {image.verseReference}
          </p>
          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic">
            "{image.verseText}"
          </p>
        </div>

        {/* Share options */}
        <div className="space-y-2.5 sm:space-y-3">
          {/* WhatsApp share button */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base"
            aria-label="Share on WhatsApp"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Share on WhatsApp
          </button>

          {/* Web Share API button (mobile) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleWebShare}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base"
              aria-label="Share via native share dialog"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>
          )}

          {/* Copy to clipboard button */}
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className={`w-full flex items-center justify-center gap-2 sm:gap-3 ${
              copySuccess
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            } active:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-target touch-feedback no-select text-sm sm:text-base`}
            aria-label="Copy image URL to clipboard"
          >
            {copySuccess ? (
              <>
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy Link
              </>
            )}
          </button>

          {/* Future social media buttons placeholder */}
          <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center mb-2 sm:mb-3">
              More sharing options coming soon
            </p>
            <div className="flex gap-2 justify-center opacity-50">
              {/* Facebook placeholder */}
              <button
                type="button"
                disabled
                className="p-2.5 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                aria-label="Facebook sharing (coming soon)"
                title="Coming soon"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </button>

              {/* Twitter/X placeholder */}
              <button
                type="button"
                disabled
                className="p-2.5 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                aria-label="Twitter/X sharing (coming soon)"
                title="Coming soon"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>

              {/* Instagram placeholder */}
              <button
                type="button"
                disabled
                className="p-2.5 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                aria-label="Instagram sharing (coming soon)"
                title="Coming soon"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
