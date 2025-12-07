import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface GeneratedImage {
  imageId: string;
  imageUrl: string;
  whatsappShareUrl: string;
  verseReference: string;
  verseText: string;
  generatedAt?: string;
}

export interface DailyVerse {
  imageId: string;
  imageUrl: string;
  verseReference: string;
  verseText: string;
  generatedAt: string;
}

interface AppState {
  currentImage: GeneratedImage | null;
  dailyVerse: DailyVerse | null;
  generationHistory: GeneratedImage[];
  isLoading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  setCurrentImage: (image: GeneratedImage | null) => void;
  setDailyVerse: (verse: DailyVerse | null) => void;
  addToHistory: (image: GeneratedImage) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToHistory = (image: GeneratedImage) => {
    setGenerationHistory((prev) => [image, ...prev]);
  };

  const clearError = () => setError(null);

  const value: AppContextType = {
    currentImage,
    dailyVerse,
    generationHistory,
    isLoading,
    error,
    setCurrentImage,
    setDailyVerse,
    addToHistory,
    setIsLoading,
    setError,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
