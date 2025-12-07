import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

interface GeneratorFormProps {
  onGenerate?: (params: GenerationParams) => void;
}

export interface GenerationParams {
  verseReference: string;
  stylePreset: string;
  customPrompt?: string;
}

const stylePresets = [
  { value: 'modern', label: 'Modern', description: 'Contemporary and clean aesthetic' },
  { value: 'classic', label: 'Classic', description: 'Traditional and timeless style' },
  { value: 'minimalist', label: 'Minimalist', description: 'Simple and elegant design' },
  { value: 'artistic', label: 'Artistic', description: 'Creative and expressive interpretation' },
];

// Verse reference validation regex
// Matches formats like: "John 3:16", "Genesis 1:1", "Psalms 23:1-6", "1 Corinthians 13:4"
const VERSE_REFERENCE_PATTERN = /^(\d\s)?[A-Za-z]+\s+\d+:\d+(-\d+)?$/;

export const GeneratorForm: React.FC<GeneratorFormProps> = ({ onGenerate }) => {
  const { isLoading, setError, clearError } = useAppContext();
  const [verseReference, setVerseReference] = useState('');
  const [stylePreset, setStylePreset] = useState('modern');
  const [customPrompt, setCustomPrompt] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    verseReference?: string;
    customPrompt?: string;
  }>({});

  const validateVerseReference = (value: string): string | undefined => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return 'Verse reference is required';
    }
    
    if (!VERSE_REFERENCE_PATTERN.test(trimmed)) {
      return 'Invalid verse format. Use format like "John 3:16" or "Genesis 1:1"';
    }
    
    return undefined;
  };

  const validateCustomPrompt = (value: string): string | undefined => {
    const trimmed = value.trim();
    
    if (trimmed && trimmed.length > 500) {
      return 'Custom prompt must be 500 characters or less';
    }
    
    return undefined;
  };

  const handleVerseReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVerseReference(value);
    
    // Clear validation error when user starts typing
    if (validationErrors.verseReference) {
      setValidationErrors((prev) => ({ ...prev, verseReference: undefined }));
    }
    
    // Clear global error
    clearError();
  };

  const handleCustomPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomPrompt(value);
    
    // Clear validation error when user starts typing
    if (validationErrors.customPrompt) {
      setValidationErrors((prev) => ({ ...prev, customPrompt: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    clearError();
    
    // Validate all fields
    const verseError = validateVerseReference(verseReference);
    const promptError = validateCustomPrompt(customPrompt);
    
    const errors: typeof validationErrors = {};
    
    if (verseError) {
      errors.verseReference = verseError;
    }
    
    if (promptError) {
      errors.customPrompt = promptError;
    }
    
    // If there are validation errors, set them and return
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    // Clear validation errors
    setValidationErrors({});

    const params: GenerationParams = {
      verseReference: verseReference.trim(),
      stylePreset,
      customPrompt: customPrompt.trim() || undefined,
    };

    onGenerate?.(params);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto p-4 sm:p-5 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-5 md:mb-6 text-gray-900 dark:text-white">
        Generate Bible Image
      </h2>

      {/* Verse Reference Input */}
      <div className="mb-3 sm:mb-4">
        <label htmlFor="verseReference" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
          Verse Reference <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="verseReference"
          value={verseReference}
          onChange={handleVerseReferenceChange}
          placeholder="e.g., John 3:16"
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors touch-target ${
            validationErrors.verseReference
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          disabled={isLoading}
          aria-invalid={!!validationErrors.verseReference}
          aria-describedby={validationErrors.verseReference ? 'verseReference-error' : undefined}
          required
        />
        {validationErrors.verseReference && (
          <p id="verseReference-error" className="mt-1.5 text-xs sm:text-sm text-red-600 dark:text-red-400">
            {validationErrors.verseReference}
          </p>
        )}
        <p className="mt-1.5 text-xs sm:text-xs text-gray-500 dark:text-gray-400">
          Enter a verse in the format: Book Chapter:Verse (e.g., John 3:16)
        </p>
      </div>

      {/* Style Preset Selector */}
      <div className="mb-3 sm:mb-4">
        <label htmlFor="stylePreset" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
          Style Preset
        </label>
        <select
          id="stylePreset"
          value={stylePreset}
          onChange={(e) => setStylePreset(e.target.value)}
          className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white cursor-pointer touch-target"
          disabled={isLoading}
        >
          {stylePresets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label} - {preset.description}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs sm:text-xs text-gray-500 dark:text-gray-400">
          Choose a visual style for your image
        </p>
      </div>

      {/* Custom Prompt Textarea */}
      <div className="mb-4 sm:mb-5 md:mb-6">
        <label htmlFor="customPrompt" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
          Custom Prompt (Optional)
        </label>
        <textarea
          id="customPrompt"
          value={customPrompt}
          onChange={handleCustomPromptChange}
          placeholder="Add additional details for the image..."
          rows={3}
          maxLength={500}
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-colors ${
            validationErrors.customPrompt
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          disabled={isLoading}
          aria-invalid={!!validationErrors.customPrompt}
          aria-describedby={validationErrors.customPrompt ? 'customPrompt-error' : 'customPrompt-help'}
        />
        {validationErrors.customPrompt && (
          <p id="customPrompt-error" className="mt-1.5 text-xs sm:text-sm text-red-600 dark:text-red-400">
            {validationErrors.customPrompt}
          </p>
        )}
        <div className="mt-1.5 flex justify-between items-center gap-2">
          <p id="customPrompt-help" className="text-xs text-gray-500 dark:text-gray-400 flex-1">
            Add specific details or themes you'd like in the image
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {customPrompt.length}/500
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-3.5 px-6 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-target touch-feedback no-select text-base sm:text-base"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Generating...
          </span>
        ) : (
          'Generate Image'
        )}
      </button>
    </form>
  );
};
