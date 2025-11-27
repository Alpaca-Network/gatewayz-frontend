/**
 * Custom React hook for fetching real-time metrics
 *
 * Fetches model, provider, or gateway metrics from the backend API
 * with automatic polling and WebSocket support (future)
 */

import { useState, useEffect, useCallback } from 'react';

export interface RealtimeMetrics {
  model?: string;
  provider?: string;
  time_bucket: string;
  requests: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_ttft_ms: number | null;
  avg_total_time_ms: number | null;
  error_breakdown: {
    timeout: number;
    rate_limit: number;
    network: number;
    other: number;
  };
}

interface UseRealtimeMetricsOptions {
  type: 'model' | 'provider' | 'gateway';
  id: string;
  timeBucket?: string;
  pollingInterval?: number; // ms, 0 to disable
  enabled?: boolean;
}

interface UseRealtimeMetricsReturn {
  data: RealtimeMetrics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRealtimeMetrics(
  options: UseRealtimeMetricsOptions
): UseRealtimeMetricsReturn {
  const {
    type,
    id,
    timeBucket,
    pollingInterval = 5000, // Default 5 seconds
    enabled = true,
  } = options;

  const [data, setData] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!enabled) return;

    try {
      const params = new URLSearchParams({
        type,
        id,
      });

      if (timeBucket) {
        params.append('time_bucket', timeBucket);
      }

      const response = await fetch(`/api/metrics/realtime?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      console.error('[useRealtimeMetrics] Error fetching metrics:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [type, id, timeBucket, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Polling
  useEffect(() => {
    if (!enabled || pollingInterval === 0) return;

    const interval = setInterval(fetchMetrics, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchMetrics, pollingInterval, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
