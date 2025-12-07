import React, { useState, useMemo } from 'react';
import { useAppContext, GeneratedImage } from '../context/AppContext';

interface GalleryProps {
  onImageClick?: (image: GeneratedImage) => void;
}

type FilterType = 'all' | 'verse' | 'date';
type SortOrder = 'newest' | 'oldest';

const ITEMS_PER_PAGE = 12;

export const Gallery: React.FC<GalleryProps> = ({ onImageClick }) => {
  const { generationHistory } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort images
  const filteredAndSortedImages = useMemo(() => {
    let filtered = [...generationHistory];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((image) => {
        const query = searchQuery.toLowerCase();
        if (filterType === 'verse' || filterType === 'all') {
          if (
            image.verseReference.toLowerCase().includes(query) ||
            image.verseText.toLowerCase().includes(query)
          ) {
            return true;
          }
        }
        return false;
      });
    }

    // Apply date filter
    if (dateFilter && filterType === 'date') {
      filtered = filtered.filter((image) => {
        if (!image.generatedAt) return false;
        const imageDate = new Date(image.generatedAt).toISOString().split('T')[0];
        return imageDate === dateFilter;
      });
    }

    // Sort images
    filtered.sort((a, b) => {
      const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
      const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [generationHistory, searchQuery, filterType, dateFilter, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedImages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentImages = filteredAndSortedImages.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, dateFilter, sortOrder]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (generationHistory.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg px-4">
            No images generated yet. Create your first Bible image above!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-5 md:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 px-2">
          Your Gallery ({filteredAndSortedImages.length} {filteredAndSortedImages.length === 1 ? 'image' : 'images'})
        </h2>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
          {/* Filter Type Selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 sm:px-4 py-2 rounded-md transition-all whitespace-nowrap touch-target touch-feedback no-select text-sm sm:text-base ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('verse')}
              className={`px-3 sm:px-4 py-2 rounded-md transition-all whitespace-nowrap touch-target touch-feedback no-select text-sm sm:text-base ${
                filterType === 'verse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              By Verse
            </button>
            <button
              type="button"
              onClick={() => setFilterType('date')}
              className={`px-3 sm:px-4 py-2 rounded-md transition-all whitespace-nowrap touch-target touch-feedback no-select text-sm sm:text-base ${
                filterType === 'date'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              By Date
            </button>
          </div>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-target text-sm sm:text-base"
            aria-label="Sort order"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Search/Filter Input */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
          {filterType === 'verse' || filterType === 'all' ? (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by verse reference or text..."
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-target"
              aria-label="Search verses"
            />
          ) : null}

          {filterType === 'date' && (
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-target"
              aria-label="Filter by date"
            />
          )}

          {(searchQuery || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDateFilter('');
              }}
              className="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all touch-target touch-feedback no-select text-sm sm:text-base whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {currentImages.length > 0 ? (
        <>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
            {currentImages.map((image) => (
              <div
                key={image.imageId}
                onClick={() => onImageClick?.(image)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 active:scale-98 touch-feedback"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onImageClick?.(image);
                  }
                }}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt={image.verseReference}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white mb-1">
                    {image.verseReference}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {image.verseText}
                  </p>
                  {image.generatedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(image.generatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-target touch-feedback no-select text-sm sm:text-base"
              >
                Previous
              </button>

              <div className="flex gap-1 overflow-x-auto max-w-full px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  if (!showPage) {
                    // Show ellipsis
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span
                          key={page}
                          className="px-2 sm:px-3 py-2 text-gray-500 dark:text-gray-400 text-sm sm:text-base"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      type="button"
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 sm:px-4 py-2 rounded-md transition-all touch-target touch-feedback no-select text-sm sm:text-base ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-target touch-feedback no-select text-sm sm:text-base"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base px-4">
            No images match your filters.
          </p>
        </div>
      )}
    </div>
  );
};
