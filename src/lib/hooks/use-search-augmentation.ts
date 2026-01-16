/**
 * Search augmentation hook for non-tool models
 *
 * This hook provides web search functionality for models that don't support
 * native tool calling. It fetches search results and formats them as context
 * that can be prepended to the user's message.
 */

import { useCallback, useState } from 'react';

interface SearchAugmentResponse {
  success: boolean;
  context: string | null;
  error: string | null;
  results_count: number;
}

interface UseSearchAugmentationReturn {
  augmentWithSearch: (query: string) => Promise<string | null>;
  isSearching: boolean;
  lastError: string | null;
}

/**
 * Hook to augment user queries with web search results
 *
 * @returns Object with augmentWithSearch function, loading state, and error state
 */
export function useSearchAugmentation(): UseSearchAugmentationReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Perform web search and return formatted context to prepend to the message
   *
   * @param query - The user's query to search for
   * @returns Formatted search context string, or null if search failed/no results
   */
  const augmentWithSearch = useCallback(async (query: string): Promise<string | null> => {
    if (!query.trim()) {
      return null;
    }

    setIsSearching(true);
    setLastError(null);

    try {
      const response = await fetch('/api/tools/search/augment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          max_results: 5,
          include_answer: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} ${errorText}`);
      }

      const data: SearchAugmentResponse = await response.json();

      if (!data.success) {
        setLastError(data.error || 'Search failed');
        return null;
      }

      return data.context;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      setLastError(errorMessage);
      console.error('[useSearchAugmentation] Error:', error);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    augmentWithSearch,
    isSearching,
    lastError,
  };
}

export default useSearchAugmentation;
