/**
 * Tests for use-critic-search-detection hook
 *
 * Tests the critic model-based search detection that determines when
 * web search should be automatically enabled based on query content.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useCriticSearchDetection } from '@/lib/hooks/use-critic-search-detection';
import { ModelOption } from '@/components/chat/model-select';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the keyword-based fallback
jest.mock('@/lib/hooks/use-auto-search-detection', () => ({
  useAutoSearchDetection: () => ({
    shouldAutoEnableSearch: jest.fn().mockReturnValue(true), // Fallback returns true
  }),
}));

describe('useCriticSearchDetection', () => {
  const mockModelWithTools: ModelOption = {
    value: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    providerId: 'openai',
    supportsTools: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIfSearchNeeded', () => {
    it('should return needsSearch=false when autoEnableSearch preference is false', async () => {
      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'What is the latest news about AI?',
          mockModelWithTools,
          false // autoEnableSearch disabled
        );
      });

      expect(response.needsSearch).toBe(false);
      expect(response.usedFallback).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return needsSearch=false for very short queries', async () => {
      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Hi',
          mockModelWithTools,
          true
        );
      });

      expect(response.needsSearch).toBe(false);
      expect(response.usedFallback).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call critic API and return needsSearch=true when API says YES', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          needsSearch: true,
          reason: 'YES',
          responseTime: 200,
        }),
      });

      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Who is the CEO of OpenAI?',
          mockModelWithTools,
          true
        );
      });

      expect(response.needsSearch).toBe(true);
      expect(response.usedFallback).toBe(false);
      expect(response.reason).toBe('YES');
      expect(mockFetch).toHaveBeenCalledWith('/api/search/critic', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Who is the CEO of OpenAI?' }),
      }));
    });

    it('should call critic API and return needsSearch=false when API says NO', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          needsSearch: false,
          reason: 'NO',
          responseTime: 150,
        }),
      });

      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Explain how recursion works',
          mockModelWithTools,
          true
        );
      });

      expect(response.needsSearch).toBe(false);
      expect(response.usedFallback).toBe(false);
      expect(response.reason).toBe('NO');
    });

    it('should fall back to keyword detection when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'What is the latest news?',
          mockModelWithTools,
          true
        );
      });

      // Should use fallback which is mocked to return true
      expect(response.needsSearch).toBe(true);
      expect(response.usedFallback).toBe(true);
      expect(response.reason).toContain('Fallback');
    });

    it('should fall back to keyword detection when API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useCriticSearchDetection());

      const response = await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Current Bitcoin price',
          mockModelWithTools,
          true
        );
      });

      expect(response.needsSearch).toBe(true);
      expect(response.usedFallback).toBe(true);
    });

    it('should cache results for identical queries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          needsSearch: true,
          reason: 'YES',
          responseTime: 200,
        }),
      });

      const { result } = renderHook(() => useCriticSearchDetection());

      // First call
      await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Is GitHub down?',
          mockModelWithTools,
          true
        );
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call with same query (should be cached)
      await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Is GitHub down?',
          mockModelWithTools,
          true
        );
      });

      // Should still only have 1 fetch call due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should set isChecking state during API call', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useCriticSearchDetection());

      expect(result.current.isChecking).toBe(false);

      // Start the check
      let checkPromise: Promise<any>;
      act(() => {
        checkPromise = result.current.checkIfSearchNeeded(
          'What is trending on Twitter?',
          mockModelWithTools,
          true
        );
      });

      // Should be checking now
      expect(result.current.isChecking).toBe(true);

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ needsSearch: true, reason: 'YES' }),
        });
        await checkPromise;
      });

      // Should no longer be checking
      expect(result.current.isChecking).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          needsSearch: true,
          reason: 'YES',
          responseTime: 200,
        }),
      });

      const { result } = renderHook(() => useCriticSearchDetection());

      // First call
      await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Weather today?',
          mockModelWithTools,
          true
        );
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      act(() => {
        result.current.clearCache();
      });

      // Same query should now hit API again
      await act(async () => {
        return result.current.checkIfSearchNeeded(
          'Weather today?',
          mockModelWithTools,
          true
        );
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
