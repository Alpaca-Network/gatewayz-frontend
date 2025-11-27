/**
 * Custom React hook for fetching health leaderboard
 *
 * Gets top or bottom models ranked by health score
 */

import { useState, useEffect, useCallback } from 'react';

export interface HealthScore {
  model_id: string;
  health_score: number;
  requests: number;
  avg_ttft_ms: number | null;
}

interface UseHealthLeaderboardOptions {
  order?: 'asc' | 'desc';
  limit?: number;
  timeBucket?: string;
  pollingInterval?: number; // ms, 0 to disable
  enabled?: boolean;
}

interface UseHealthLeaderboardReturn {
  data: HealthScore[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useHealthLeaderboard(
  options: UseHealthLeaderboardOptions = {}
): UseHealthLeaderboardReturn {
  const {
    order = 'desc',
    limit = 10,
    timeBucket,
    pollingInterval = 10000, // Default 10 seconds
    enabled = true,
  } = options;

  const [data, setData] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!enabled) return;

    try {
      const params = new URLSearchParams({
        order,
        limit: limit.toString(),
      });

      if (timeBucket) {
        params.append('time_bucket', timeBucket);
      }

      const response = await fetch(
        `/api/metrics/health/leaderboard?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.models || []);
      setError(null);
    } catch (err) {
      console.error('[useHealthLeaderboard] Error fetching leaderboard:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [order, limit, timeBucket, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Polling
  useEffect(() => {
    if (!enabled || pollingInterval === 0) return;

    const interval = setInterval(fetchLeaderboard, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchLeaderboard, pollingInterval, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchLeaderboard,
  };
}
