/**
 * Model Health Hooks
 * Custom React hooks for fetching and managing model health data
 *
 * All hooks now support optional authentication via API key parameter.
 * When apiKey is provided, requests are authenticated for better rate limits and audit logging.
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
import { monitoringService } from "@/lib/monitoring-service";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

/**
 * Hook to fetch health data for a specific model
 *
 * @param provider - Provider name (e.g., "openai")
 * @param model - Model name (e.g., "gpt-4")
 * @param apiKey - Optional API key for authenticated requests
 */
export function useModelHealth(provider: string, model: string, apiKey?: string) {
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!provider || !model) return;

    setLoading(true);
    setError(null);

    try {
      const data = await monitoringService.getModelHealth(provider, model, apiKey);
      setHealth(data);
    } catch (err) {
      console.error("Failed to fetch model health:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [provider, model, apiKey]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, error, refetch: fetchHealth };
}

/**
 * Hook to fetch overall system statistics
 *
 * @param apiKey - Optional API key for authenticated requests
 */
export function useModelHealthStats(apiKey?: string) {
  const [stats, setStats] = useState<ModelHealthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await monitoringService.getHealthStats(apiKey);
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch model health stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook to fetch list of all models with health data
 *
 * @param limit - Number of results to return (default: 50)
 * @param offset - Offset for pagination (default: 0)
 * @param apiKey - Optional API key for authenticated requests
 */
export function useModelHealthList(limit: number = 50, offset: number = 0, apiKey?: string) {
  const [data, setData] = useState<ModelHealthListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await monitoringService.getModelHealthList(limit, offset, apiKey);
      setData(result);
    } catch (err) {
      console.error("Failed to fetch model health list:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, apiKey]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { data, loading, error, refetch: fetchList };
}

/**
 * Hook to fetch unhealthy models
 *
 * @param errorThreshold - Error rate threshold (0-1, default: 0.2 = 20%)
 * @param apiKey - Optional API key for authenticated requests
 */
export function useUnhealthyModels(errorThreshold: number = 0.2, apiKey?: string) {
  const [data, setData] = useState<UnhealthyModelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnhealthy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await monitoringService.getUnhealthyModels(errorThreshold, apiKey);
      setData(result);
    } catch (err) {
      console.error("Failed to fetch unhealthy models:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [errorThreshold, apiKey]);

  useEffect(() => {
    fetchUnhealthy();
  }, [fetchUnhealthy]);

  return { data, loading, error, refetch: fetchUnhealthy };
}

/**
 * Hook to fetch provider summary
 *
 * @param provider - Provider name (e.g., "openai")
 * @param apiKey - Optional API key for authenticated requests
 */
export function useProviderSummary(provider: string, apiKey?: string) {
  const [summary, setSummary] = useState<ProviderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      const data = await monitoringService.getProviderSummary(provider, apiKey);
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch provider summary:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

/**
 * Hook to fetch list of all providers
 *
 * @param apiKey - Optional API key for authenticated requests
 */
export function useProviderList(apiKey?: string) {
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data: ProviderListResponse = await monitoringService.getProviderList(apiKey);
      setProviders(data.providers);
    } catch (err) {
      console.error("Failed to fetch provider list:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

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
