/**
 * Tests for use-search-augmentation hook
 *
 * Tests the search augmentation functionality that fetches web search
 * results and returns formatted context for non-tool models.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchAugmentation } from '@/lib/hooks/use-search-augmentation';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useSearchAugmentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('augmentWithSearch', () => {
    it('should return null for empty query', async () => {
      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('');
      });

      expect(context).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null for whitespace-only query', async () => {
      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('   ');
      });

      expect(context).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          context: '[Web Search Results]\nTest results\n[End of Search Results]',
          results_count: 3,
        }),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      await act(async () => {
        await result.current.augmentWithSearch('test query');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/search/augment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test query',
          max_results: 5,
          include_answer: true,
        }),
      });
    });

    it('should return context on successful response', async () => {
      const expectedContext = '[Web Search Results]\nSummary: Test answer\n\nSources:\n1. Test Title\n   Test content\n   https://test.com\n[End of Search Results]';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          context: expectedContext,
          results_count: 1,
        }),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('test query');
      });

      expect(context).toBe(expectedContext);
    });

    it('should set isSearching to true while fetching', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() => useSearchAugmentation());

      expect(result.current.isSearching).toBe(false);

      // Start the search but don't await it
      let searchPromise: Promise<string | null>;
      act(() => {
        searchPromise = result.current.augmentWithSearch('test query');
      });

      // isSearching should be true while fetching
      expect(result.current.isSearching).toBe(true);

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            context: 'test',
            results_count: 1,
          }),
        });
        await searchPromise;
      });

      // isSearching should be false after fetch completes
      expect(result.current.isSearching).toBe(false);
    });

    it('should return null and set error when API returns success: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Search service unavailable',
          results_count: 0,
        }),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('test query');
      });

      expect(context).toBeNull();
      expect(result.current.lastError).toBe('Search service unavailable');
    });

    it('should return null and set error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('test query');
      });

      expect(context).toBeNull();
      expect(result.current.lastError).toContain('Search failed: 500');
    });

    it('should return null and set error when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('test query');
      });

      expect(context).toBeNull();
      expect(result.current.lastError).toBe('Network error');
    });

    it('should handle non-Error thrown values', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useSearchAugmentation());

      let context: string | null = null;
      await act(async () => {
        context = await result.current.augmentWithSearch('test query');
      });

      expect(context).toBeNull();
      expect(result.current.lastError).toBe('Search failed');
    });

    it('should clear previous error on new request', async () => {
      // First request fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Error'),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      await act(async () => {
        await result.current.augmentWithSearch('test query 1');
      });

      expect(result.current.lastError).not.toBeNull();

      // Second request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          context: 'test',
          results_count: 1,
        }),
      });

      await act(async () => {
        await result.current.augmentWithSearch('test query 2');
      });

      expect(result.current.lastError).toBeNull();
    });

    it('should trim whitespace from query before sending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          context: 'test',
          results_count: 1,
        }),
      });

      const { result } = renderHook(() => useSearchAugmentation());

      await act(async () => {
        await result.current.augmentWithSearch('  test query  ');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tools/search/augment', expect.objectContaining({
        body: JSON.stringify({
          query: 'test query',
          max_results: 5,
          include_answer: true,
        }),
      }));
    });
  });
});
