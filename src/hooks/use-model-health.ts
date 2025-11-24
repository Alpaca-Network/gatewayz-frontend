/**
 * Model Health Hooks
 * Custom React hooks for fetching and managing model health data
 */

import { useState, useEffect, useCallback } from "react";
import {
  ModelHealth,
  ModelHealthStats,
  ModelHealthListResponse,
  UnhealthyModelsResponse,
  ProviderSummary,
  ProviderListResponse,
} from "@/types/model-health";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

/**
 * Hook to fetch health data for a specific model
 */
export function useModelHealth(provider: string, model: string) {
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!provider || !model) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/model-health/${provider}/${model}`);

      if (response.status === 404) {
        // No health data yet for this model
        setHealth(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error("Failed to fetch model health:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [provider, model]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, error, refetch: fetchHealth };
}

/**
 * Hook to fetch overall system statistics
 */
export function useModelHealthStats() {
  const [stats, setStats] = useState<ModelHealthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/model-health/stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch model health stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook to fetch list of all models with health data
 */
export function useModelHealthList(limit: number = 50, offset: number = 0) {
  const [data, setData] = useState<ModelHealthListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/model-health?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch model health list:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { data, loading, error, refetch: fetchList };
}

/**
 * Hook to fetch unhealthy models
 */
export function useUnhealthyModels(errorThreshold: number = 0.2) {
  const [data, setData] = useState<UnhealthyModelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnhealthy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/model-health/unhealthy?error_threshold=${errorThreshold}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch unhealthy models:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [errorThreshold]);

  useEffect(() => {
    fetchUnhealthy();
  }, [fetchUnhealthy]);

  return { data, loading, error, refetch: fetchUnhealthy };
}

/**
 * Hook to fetch provider summary
 */
export function useProviderSummary(provider: string) {
  const [summary, setSummary] = useState<ProviderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/model-health/provider/${provider}/summary`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch provider summary:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

/**
 * Hook to fetch list of all providers
 */
export function useProviderList() {
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/model-health/providers`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ProviderListResponse = await response.json();
      setProviders(data.providers);
    } catch (err) {
      console.error("Failed to fetch provider list:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return { providers, loading, error, refetch: fetchProviders };
}

/**
 * Hook with polling support for real-time updates
 * Stops polling when tab is hidden
 */
export function useModelHealthPolling(
  fetchFn: () => void,
  intervalMs: number = 60000 // Default: 1 minute
) {
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const poll = () => {
      if (!document.hidden) {
        fetchFn();
      }
    };

    // Initial fetch
    poll();

    // Set up polling
    intervalId = setInterval(poll, intervalMs);

    // Cleanup
    return () => clearInterval(intervalId);
  }, [fetchFn, intervalMs]);
}
