/**
 * Custom React hooks for Web Vitals data fetching
 *
 * Provides real-time Web Vitals data with automatic polling and caching.
 * Optimized for performance with:
 * - Request deduplication
 * - Debounced search
 * - Stable callback references
 * - Efficient re-render prevention
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  WebVitalsSummary,
  PagePerformanceData,
  PageWebVitals,
  DeviceType,
} from '@/lib/web-vitals-types';

// ============================================================================
// Utility: Debounce Hook
// ============================================================================

/**
 * Custom hook for debouncing values
 * Prevents excessive API calls when search input changes rapidly
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Types
// ============================================================================

interface UseWebVitalsSummaryOptions {
  hours?: number;
  device?: DeviceType | 'all';
  path?: string;
  pollingInterval?: number;
  enabled?: boolean;
}

interface UseWebVitalsSummaryReturn {
  data: WebVitalsSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UsePagePerformanceOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  pollingInterval?: number;
  enabled?: boolean;
}

interface UsePagePerformanceReturn {
  data: PagePerformanceData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// useWebVitalsSummary Hook
// ============================================================================

export function useWebVitalsSummary(
  options: UseWebVitalsSummaryOptions = {}
): UseWebVitalsSummaryReturn {
  const {
    hours = 24,
    device = 'all',
    path,
    pollingInterval = 60000, // 1 minute default
    enabled = true,
  } = options;

  const [data, setData] = useState<WebVitalsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Track in-flight requests to prevent duplicate fetches
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Stable fetch function that doesn't change on every render
  const fetchSummary = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        device,
      });

      if (path) {
        params.append('path', path);
      }

      const response = await fetch(`/api/vitals?${params.toString()}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Web Vitals summary: ${response.statusText}`);
      }

      const result = await response.json();

      // Only update state if component is still mounted and request wasn't aborted
      if (isMountedRef.current && !abortController.signal.aborted) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('[useWebVitalsSummary] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [hours, device, path, enabled]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup: abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Polling with cleanup
  useEffect(() => {
    if (!enabled || pollingInterval === 0) return;

    const interval = setInterval(fetchSummary, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchSummary, pollingInterval, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchSummary,
  };
}

// ============================================================================
// usePagePerformance Hook
// ============================================================================

export function usePagePerformance(
  options: UsePagePerformanceOptions = {}
): UsePagePerformanceReturn {
  const {
    limit = 20,
    offset = 0,
    sortBy = 'pageLoads',
    sortOrder = 'desc',
    search = '',
    pollingInterval = 60000,
    enabled = true,
  } = options;

  const [data, setData] = useState<PagePerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Debounce search input to prevent excessive API calls while typing
  // 300ms delay provides good balance between responsiveness and efficiency
  const debouncedSearch = useDebouncedValue(search, 300);

  // Track in-flight requests to prevent duplicate fetches
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  const fetchPages = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(`/api/vitals/pages?${params.toString()}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page performance: ${response.statusText}`);
      }

      const result = await response.json();

      // Only update state if component is still mounted and request wasn't aborted
      if (isMountedRef.current && !abortController.signal.aborted) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('[usePagePerformance] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, offset, sortBy, sortOrder, debouncedSearch, enabled]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup: abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Polling with cleanup
  useEffect(() => {
    if (!enabled || pollingInterval === 0) return;

    const interval = setInterval(fetchPages, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchPages, pollingInterval, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchPages,
  };
}

// ============================================================================
// useWebVitalsHistory Hook
// ============================================================================

interface UseWebVitalsHistoryOptions {
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';
  hours?: number;
  device?: DeviceType | 'all';
  enabled?: boolean;
}

interface HistoryDataPoint {
  timestamp: string;
  value: number;
  rating: string;
}

interface UseWebVitalsHistoryReturn {
  data: HistoryDataPoint[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useWebVitalsHistory(
  options: UseWebVitalsHistoryOptions
): UseWebVitalsHistoryReturn {
  const { metric, hours = 24, device = 'all', enabled = true } = options;

  const [data, setData] = useState<HistoryDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        device,
      });

      const response = await fetch(`/api/vitals?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Web Vitals history: ${response.statusText}`);
      }

      const result: WebVitalsSummary = await response.json();
      const vitalData = result.vitals[metric];

      setData(vitalData?.history || []);
      setError(null);
    } catch (err) {
      console.error('[useWebVitalsHistory] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [metric, hours, device, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    data,
    loading,
    error,
    refetch: fetchHistory,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get performance score color based on score value
 */
export function usePerformanceScoreColor(score: number): string {
  return useMemo(() => {
    if (score >= 90) return 'hsl(var(--chart-2))'; // Green
    if (score >= 50) return 'hsl(var(--chart-4))'; // Orange
    return 'hsl(var(--chart-5))'; // Red
  }, [score]);
}

/**
 * Hook to calculate opportunity score for a page
 */
export function useOpportunityScore(page: PageWebVitals | null): number {
  return useMemo(() => {
    if (!page) return 0;

    // Opportunity is the potential improvement weighted by traffic
    const maxScore = 100;
    const currentScore = page.performanceScore;
    const potentialGain = maxScore - currentScore;

    // Weight by page loads (more traffic = more opportunity)
    const trafficWeight = Math.min(page.pageLoads / 1000, 1);

    return Math.round(potentialGain * trafficWeight);
  }, [page]);
}
