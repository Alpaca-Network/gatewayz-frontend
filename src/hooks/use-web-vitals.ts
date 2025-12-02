/**
 * Custom React hooks for Web Vitals data fetching
 *
 * Provides real-time Web Vitals data with automatic polling and caching.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  WebVitalsSummary,
  PagePerformanceData,
  PageWebVitals,
  DeviceType,
} from '@/lib/web-vitals-types';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled) return;

    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        device,
      });

      if (path) {
        params.append('path', path);
      }

      const response = await fetch(`/api/vitals?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Web Vitals summary: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('[useWebVitalsSummary] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [hours, device, path, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Polling
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPages = useCallback(async () => {
    if (!enabled) return;

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
        sortOrder,
      });

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/vitals/pages?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch page performance: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('[usePagePerformance] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [limit, offset, sortBy, sortOrder, search, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Polling
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;

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
