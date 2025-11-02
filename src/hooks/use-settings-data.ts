import { useState, useEffect, useCallback } from 'react';
import { makeAuthenticatedRequest, getApiKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface UseSettingsDataOptions {
  onError?: (error: any) => void;
  onSuccess?: (data: any) => void;
  enabled?: boolean; // Allows conditional fetching
}

interface UseSettingsDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching data in settings pages
 * Handles authentication, loading states, and error handling
 *
 * @param endpoint - API endpoint to fetch from
 * @param options - Configuration options
 * @returns Object containing data, loading state, error, and refetch function
 *
 * @example
 * const { data, loading, error, refetch } = useSettingsData<ApiKey[]>('/api/user/api-keys');
 *
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorState />;
 * return <DataDisplay data={data} />;
 */
export function useSettingsData<T = any>(
  endpoint: string,
  options: UseSettingsDataOptions = {}
): UseSettingsDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const { onError, onSuccess, enabled = true } = options;

  const fetchData = useCallback(async () => {
    // Skip if disabled
    if (!enabled) {
      setLoading(false);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setLoading(false);
      setError(new Error('No API key found'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await makeAuthenticatedRequest(endpoint);

      if (response.ok) {
        const result = await response.json();
        setData(result);
        onSuccess?.(result);
      } else if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Access denied';
        const err = new Error(errorMessage);
        setError(err);
        toast({
          title: 'Access Denied',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(error);
      onError?.(error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled, toast, onError, onSuccess]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
