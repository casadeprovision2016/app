import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';

interface DailyVerseProps {
  onFetch?: () => void;
  autoRefreshInterval?: number; // in milliseconds, default 5 minutes
}

export const DailyVerse: React.FC<DailyVerseProps> = ({ 
  onFetch,
  autoRefreshInterval = 5 * 60 * 1000 // 5 minutes default
}) => {
  const { dailyVerse, isLoading, error } = useAppContext();
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch daily verse on mount
  useEffect(() => {
    if (!dailyVerse && onFetch) {
      onFetch();
      setLastFetchTime(Date.now());
    }
  }, [dailyVerse, onFetch]);

  // Auto-refresh logic
  useEffect(() => {
    if (!onFetch) return;

    // Set up interval to check for new daily verse
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      
      // Only fetch if enough time has passed
      if (timeSinceLastFetch >= autoRefreshInterval) {
        onFetch();
        setLastFetchTime(now);
      }
    }, autoRefreshInterval);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [onFetch, autoRefreshInterval, lastFetchTime]);

  const handleManualRefresh = () => {
    if (onFetch && !isLoading) {
      onFetch();
      setLastFetchTime(Date.now());
    }
  };

  if (isLoading && !dailyVerse) {
    return (
      <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">
              Daily Verse
            </h2>
            <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-lg h-64 sm:h-80 md:h-96"></div>
            <p className="text-center text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-3 sm:mt-4">
              Loading today's verse...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !dailyVerse) {
    return (
      <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl overflow-hidden p-4 sm:p-5 md:p-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">
            Daily Verse
          </h2>
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-3 sm:px-4 py-3 rounded">
            <p className="font-semibold mb-2 text-sm sm:text-base">Error loading daily verse</p>
            <p className="text-xs sm:text-sm mb-3 sm:mb-4">{error}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-red-400 text-white font-semibold py-2 px-4 rounded transition-all touch-target touch-feedback no-select text-sm sm:text-base"
              aria-label="Retry loading daily verse"
            >
              {isLoading ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dailyVerse) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 md:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex-1 text-center">
              Daily Verse
            </h2>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="ml-2 sm:ml-4 p-2 rounded-full hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-target touch-feedback"
              aria-label="Refresh daily verse"
              title="Refresh daily verse"
            >
              <svg
                className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <p className="text-center text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-5 md:mb-6 px-2">
            {new Date(dailyVerse.generatedAt).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {isLoading && (
            <div className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">
              Checking for updates...
            </div>
          )}
        </div>

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}
          <img
            src={dailyVerse.imageUrl}
            alt={dailyVerse.verseReference}
            className="w-full h-auto"
          />
        </div>

        <div className="p-4 sm:p-5 md:p-6 bg-white dark:bg-gray-800">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white mb-2 sm:mb-3 px-2">
            {dailyVerse.verseReference}
          </h3>
          <p className="text-base sm:text-lg md:text-xl text-center text-gray-700 dark:text-gray-300 italic px-4">
            "{dailyVerse.verseText}"
          </p>
        </div>
      </div>
    </div>
  );
};
