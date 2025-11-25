/**
 * StreamCoordinator - Coordinates stream operations with auth refresh
 *
 * Handles 401 authentication errors by:
 * 1. Coordinating with auth context for token refresh
 * 2. Preventing multiple concurrent refreshes
 * 3. Retrieving new API key after refresh completes
 * 4. Allowing consumers to retry with new credentials
 */

import { getApiKey, requestAuthRefresh } from '@/lib/api';

export class StreamCoordinator {
  private static isRefreshing = false;
  private static refreshPromise: Promise<void> | null = null;

  /**
   * Handle 401 authentication error by refreshing auth and retrieving new API key
   *
   * If multiple 401s occur concurrently, this method ensures only one refresh
   * happens and all callers wait for the same refresh to complete.
   *
   * @returns Promise that resolves when refresh is complete
   * @throws Error if refresh times out (>30 seconds)
   */
  static async handleAuthError(): Promise<void> {
    // If already refreshing, reuse the existing refresh promise
    if (StreamCoordinator.isRefreshing) {
      console.log('[StreamCoordinator] Auth refresh already in progress, waiting for existing refresh');

      // Wait for existing refresh to complete
      if (StreamCoordinator.refreshPromise) {
        await StreamCoordinator.refreshPromise;
      }
      return;
    }

    // Mark as refreshing to prevent concurrent refreshes
    StreamCoordinator.isRefreshing = true;

    try {
      console.log('[StreamCoordinator] Starting auth refresh');

      // Create and store the refresh promise so concurrent calls can reuse it
      StreamCoordinator.refreshPromise = requestAuthRefresh();

      // Wait for auth refresh to complete
      // This now returns a promise that resolves when AUTH_REFRESH_COMPLETE_EVENT fires
      await StreamCoordinator.refreshPromise;

      console.log('[StreamCoordinator] Auth refresh completed successfully');
    } catch (error) {
      console.error('[StreamCoordinator] Auth refresh failed:', error);
      throw error;
    } finally {
      // Reset state after refresh attempt (success or failure)
      StreamCoordinator.isRefreshing = false;
      StreamCoordinator.refreshPromise = null;
    }
  }

  /**
   * Get current API key from localStorage
   * Call this after handleAuthError() to get the refreshed key
   *
   * @returns Current API key or null if not authenticated
   */
  static getApiKey(): string | null {
    const apiKey = getApiKey();
    if (apiKey) {
      console.log('[StreamCoordinator] Retrieved API key from storage');
    } else {
      console.warn('[StreamCoordinator] No API key available in storage');
    }
    return apiKey;
  }

  /**
   * Reset coordinator state
   * Useful for testing or explicit cleanup
   */
  static reset(): void {
    StreamCoordinator.isRefreshing = false;
    StreamCoordinator.refreshPromise = null;
  }
}
