/**
 * Custom React hook for fetching provider summary metrics
 *
 * Gets aggregated metrics across all models for a provider
 */

import { useState, useEffect, useCallback } from 'react';

export interface ProviderSummary {
  provider: string;
  time_bucket: string;
  total_requests: number;
  total_models: number;
  avg_success_rate: number;
  avg_ttft_ms: number | null;
  top_models: Array<{
    model_id: string;
    requests: number;
  }>;
  error_distribution: {
    timeout: number;
    rate_limit: number;
    network: number;
    other: number;
  };
}

interface UseProviderSummaryOptions {
  provider: string;
  timeBucket?: string;
  pollingInterval?: number; // ms, 0 to disable
  enabled?: boolean;
}

interface UseProviderSummaryReturn {
  data: ProviderSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProviderSummary(
  options: UseProviderSummaryOptions
): UseProviderSummaryReturn {
  const {
    provider,
    timeBucket,
    pollingInterval = 10000, // Default 10 seconds
    enabled = true,
  } = options;

  const [data, setData] = useState<ProviderSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled || !provider) return;

    try {
      const params = new URLSearchParams({
        provider,
      });

      if (timeBucket) {
        params.append('time_bucket', timeBucket);
      }

      const response = await fetch(
        `/api/metrics/provider/summary?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch provider summary: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      console.error('[useProviderSummary] Error fetching summary:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [provider, timeBucket, enabled]);

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
