/**
 * Hook for managing token refresh and expiry
 */

import { useEffect, useRef, useCallback } from 'react';
import { getApiKey } from '@/lib/api';
import {
  getTokenMetadata,
  shouldRefreshToken,
  getTokenTimeRemaining,
  saveTokenMetadata,
  isTokenExpired,
} from '@/lib/token-refresh';
import * as Sentry from '@sentry/nextjs';

interface UseTokenRefreshOptions {
  /**
   * Enable automatic token refresh (default: true)
   */
  enabled?: boolean;

  /**
   * Callback when token refresh succeeds
   */
  onRefreshSuccess?: (newApiKey: string) => void;

  /**
   * Callback when token refresh fails
   */
  onRefreshError?: (error: Error) => void;

  /**
   * Callback when token expires
   */
  onTokenExpired?: () => void;

  /**
   * Custom check interval in milliseconds (default: 60000 = 1 minute)
   */
  checkInterval?: number;
}

export function useTokenRefresh(options: UseTokenRefreshOptions = {}) {
  const {
    enabled = true,
    onRefreshSuccess,
    onRefreshError,
    onTokenExpired,
    checkInterval = 60000, // Check every minute
  } = options;

  const refreshInProgressRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiredCheckRef = useRef(false);

  /**
   * Perform token refresh
   */
  const refreshToken = useCallback(async () => {
    if (refreshInProgressRef.current) {
      console.log('[token-refresh] Refresh already in progress');
      return;
    }

    refreshInProgressRef.current = true;

    try {
      const currentKey = getApiKey();
      if (!currentKey) {
        console.warn('[token-refresh] No API key found for refresh');
        return;
      }

      console.log('[token-refresh] Refreshing token...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.api_key) {
        throw new Error('Invalid refresh response');
      }

      // Update token metadata with new expiry
      saveTokenMetadata(data.api_key, data.expires_at);

      console.log('[token-refresh] Token refreshed successfully');

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Token refreshed',
        level: 'info',
        data: {
          expires_at: data.expires_at,
        },
      });

      onRefreshSuccess?.(data.api_key);
    } catch (error) {
      console.error('[token-refresh] Token refresh failed:', error);

      Sentry.captureException(error, {
        tags: { context: 'token-refresh' },
        level: 'warning',
      });

      onRefreshError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [onRefreshSuccess, onRefreshError]);

  /**
   * Check if token needs refresh or has expired
   */
  const checkTokenStatus = useCallback(async () => {
    const currentKey = getApiKey();
    if (!currentKey) {
      return;
    }

    // Check if expired
    if (isTokenExpired()) {
      if (!expiredCheckRef.current) {
        expiredCheckRef.current = true;
        console.warn('[token-refresh] Token has expired');

        Sentry.captureMessage('Token expired', {
          level: 'warning',
          tags: { context: 'token-refresh' },
        });

        onTokenExpired?.();
      }
      return;
    }

    expiredCheckRef.current = false;

    // Check if refresh is needed
    if (shouldRefreshToken()) {
      const timeRemaining = getTokenTimeRemaining();
      console.log(
        `[token-refresh] Token expiring soon (${Math.floor(timeRemaining / 1000)}s remaining)`
      );

      await refreshToken();
    }
  }, [refreshToken, onTokenExpired]);

  /**
   * Set up periodic token status check
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[token-refresh] Starting token refresh monitor');

    // Check immediately
    checkTokenStatus();

    // Set up recurring check
    checkIntervalRef.current = setInterval(() => {
      checkTokenStatus();
    }, checkInterval);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      console.log('[token-refresh] Stopped token refresh monitor');
    };
  }, [enabled, checkTokenStatus, checkInterval]);

  return {
    refreshToken,
    checkTokenStatus,
    getTokenMetadata,
    getTimeRemaining: getTokenTimeRemaining,
  };
}
