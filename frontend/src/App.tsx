import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import {
  GeneratorForm,
  ImageDisplay,
  DailyVerse,
  Gallery,
  ShareModal,
} from './components';
import type { GenerationParams } from './components/GeneratorForm';
import { apiClient } from './services/apiClient';

const AppContent: React.FC = () => {
  const {
    currentImage,
    dailyVerse,
    error,
    setCurrentImage,
    setDailyVerse,
    addToHistory,
    setIsLoading,
    setError,
    clearError,
  } = useAppContext();

  const [showShareModal, setShowShareModal] = useState(false);
  const [imageToShare, setImageToShare] = useState(currentImage);

  const handleGenerate = async (params: GenerationParams) => {
    clearError();
    setIsLoading(true);

    try {
      const image = await apiClient.generateImage({
        verseReference: params.verseReference,
        stylePreset: params.stylePreset,
        customPrompt: params.customPrompt,
      });
      
      setCurrentImage(image);
      addToHistory(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchDailyVerse = async () => {
    setIsLoading(true);
    clearError();

    try {
      const verse = await apiClient.getDailyVerse();
      setDailyVerse(verse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageClick = (image: typeof currentImage) => {
    setImageToShare(image);
    setShowShareModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-6 md:py-8">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <header className="text-center mb-6 sm:mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4 px-2">
            Bible Image Generator
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 px-4">
            Create beautiful AI-generated images from biblical verses
          </p>
        </header>

        {error && (
          <div className="max-w-2xl mx-auto mb-4 sm:mb-6">
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-3 sm:px-4 py-3 rounded relative text-sm sm:text-base">
              <span className="block sm:inline pr-8">{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="absolute top-0 bottom-0 right-0 px-3 sm:px-4 py-3 touch-target"
                aria-label="Close error message"
              >
                <svg className="fill-current h-5 w-5 sm:h-6 sm:w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {!currentImage && !dailyVerse && (
          <DailyVerse onFetch={handleFetchDailyVerse} />
        )}

        <div className="mb-6 sm:mb-8 md:mb-12">
          <GeneratorForm onGenerate={handleGenerate} />
        </div>

        {currentImage && (
          <div className="mb-6 sm:mb-8 md:mb-12">
            <ImageDisplay
              image={currentImage}
              onShare={() => {
                setImageToShare(currentImage);
                setShowShareModal(true);
              }}
            />
          </div>
        )}

        <Gallery onImageClick={handleImageClick} />

        {imageToShare && (
          <ShareModal
            image={imageToShare}
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
