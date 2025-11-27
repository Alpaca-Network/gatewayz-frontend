/**
 * Custom React hook for fetching time-series trend data
 *
 * Gets historical metrics over the last N hours
 */

import { useState, useEffect, useCallback } from 'react';

export interface TrendDataPoint {
  time_bucket: string;
  value: number;
}

interface UseTrendDataOptions {
  model: string;
  metric: 'ttft' | 'requests' | 'success_rate';
  hours?: number;
  pollingInterval?: number; // ms, 0 to disable
  enabled?: boolean;
}

interface UseTrendDataReturn {
  data: TrendDataPoint[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTrendData(
  options: UseTrendDataOptions
): UseTrendDataReturn {
  const {
    model,
    metric,
    hours = 6,
    pollingInterval = 30000, // Default 30 seconds (trends change slower)
    enabled = true,
  } = options;

  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrends = useCallback(async () => {
    if (!enabled || !model) return;

    try {
      const params = new URLSearchParams({
        model,
        metric,
        hours: hours.toString(),
      });

      const response = await fetch(`/api/metrics/trends?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch trend data: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data_points || []);
      setError(null);
    } catch (err) {
      console.error('[useTrendData] Error fetching trends:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [model, metric, hours, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Polling
  useEffect(() => {
    if (!enabled || pollingInterval === 0) return;

    const interval = setInterval(fetchTrends, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchTrends, pollingInterval, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchTrends,
  };
}
