/**
 * Critic-based search detection hook
 *
 * Uses a small, fast AI model (Gemini 2.0 Flash) to determine if a query
 * requires real-time information. This provides much better accuracy than
 * keyword matching, as the model can understand semantic intent.
 *
 * Features:
 * - Fast: ~200-500ms response time
 * - Cheap: ~$0.00001 per query
 * - Reliable: Falls back to keyword detection on failure
 * - Smart: Understands implicit need for current info
 */

import { useCallback, useState, useRef } from 'react';
import { ModelOption } from '@/components/chat/model-select';
import { useAutoSearchDetection } from './use-auto-search-detection';

interface CriticResult {
  needsSearch: boolean;
  reason?: string;
  usedFallback: boolean;
  responseTime?: number;
}

interface CriticCache {
  result: CriticResult;
  timestamp: number;
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// Timeout for critic API call: 3 seconds
const CRITIC_TIMEOUT_MS = 3000;

/**
 * Hook for critic-based auto-search detection
 *
 * @returns Object with checkIfSearchNeeded function and loading state
 */
export function useCriticSearchDetection() {
  const [isChecking, setIsChecking] = useState(false);
  const { shouldAutoEnableSearch: keywordFallback } = useAutoSearchDetection();

  // Simple in-memory cache to avoid redundant API calls for identical queries
  const cacheRef = useRef<Map<string, CriticCache>>(new Map());

  /**
   * Check if a query needs web search using the critic model
   *
   * @param input - The user's query
   * @param model - The selected model (used for fallback)
   * @param autoEnableSearch - User's preference for auto-detection
   * @returns Promise resolving to CriticResult
   */
  const checkIfSearchNeeded = useCallback(async (
    input: string,
    model: ModelOption | null,
    autoEnableSearch: boolean
  ): Promise<CriticResult> => {
    // Respect user preference - if auto-search is disabled, don't check
    if (!autoEnableSearch) {
      return { needsSearch: false, usedFallback: false };
    }

    const trimmedInput = input.trim();

    // Skip very short queries - not enough context
    // Use same minimum (10 chars) as keyword fallback for consistent behavior
    if (trimmedInput.length < 10) {
      return { needsSearch: false, usedFallback: false };
    }

    // Check cache first
    const cacheKey = trimmedInput.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[CriticSearch] Cache hit for query');
      return cached.result;
    }

    setIsChecking(true);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CRITIC_TIMEOUT_MS);

      const response = await fetch('/api/search/critic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedInput }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Critic API returned ${response.status}`);
      }

      const data = await response.json();

      // Check for API-level errors
      if (data.error && !data.needsSearch) {
        throw new Error(data.error);
      }

      const result: CriticResult = {
        needsSearch: data.needsSearch,
        reason: data.reason,
        usedFallback: false,
        responseTime: data.responseTime,
      };

      // Cache the result
      cacheRef.current.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      // Limit cache size to prevent memory issues
      if (cacheRef.current.size > 100) {
        const now = Date.now();
        const entries = Array.from(cacheRef.current.entries());

        // First, remove expired entries
        const expiredKeys = entries
          .filter(([, cache]) => now - cache.timestamp >= CACHE_TTL_MS)
          .map(([key]) => key);
        expiredKeys.forEach((key) => cacheRef.current.delete(key));

        // If still over limit, remove oldest valid entries
        if (cacheRef.current.size > 100) {
          const remainingEntries = Array.from(cacheRef.current.entries());
          remainingEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          const toRemove = remainingEntries.slice(0, cacheRef.current.size - 50);
          toRemove.forEach(([key]) => cacheRef.current.delete(key));
        }
      }

      return result;

    } catch (error) {
      // Log the error for monitoring
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('abort');

      console.warn(
        '[CriticSearch] Falling back to keyword detection:',
        isTimeout ? 'timeout' : errorMessage
      );

      // Fall back to keyword detection
      const needsSearch = keywordFallback(input, model, autoEnableSearch);

      return {
        needsSearch,
        reason: `Fallback: ${isTimeout ? 'timeout' : errorMessage}`,
        usedFallback: true,
      };

    } finally {
      setIsChecking(false);
    }
  }, [keywordFallback]);

  /**
   * Clear the cache (useful for testing or when user changes settings)
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    checkIfSearchNeeded,
    isChecking,
    clearCache,
  };
}

export default useCriticSearchDetection;
