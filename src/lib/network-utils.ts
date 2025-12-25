/**
 * Network utilities for detecting connectivity and handling offline scenarios
 * 
 * The NetworkMonitor uses lazy initialization to prevent uncontrolled network
 * requests at module load time. Periodic connectivity checks only run when
 * there are active subscribers, reducing interference with third-party scripts
 * like Google Analytics (gtag) and avoiding browser extension conflicts.
 */

type ConnectionCallback = (isOnline: boolean) => void;

class NetworkMonitor {
  private listeners: Set<ConnectionCallback> = new Set();
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private initialized = false;
  private periodicCheckInterval: ReturnType<typeof setInterval> | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;

  constructor() {
    // Don't initialize automatically - use lazy initialization
    // This prevents network requests at module load time which can
    // interfere with gtag and other third-party scripts
  }

  /**
   * Lazily initialize the network monitor
   * Only called when there are active subscribers
   */
  private init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.boundOnlineHandler = () => {
      this._isOnline = true;
      this.notifyListeners();
    };

    this.boundOfflineHandler = () => {
      this._isOnline = false;
      this.notifyListeners();
    };

    window.addEventListener('online', this.boundOnlineHandler);
    window.addEventListener('offline', this.boundOfflineHandler);
  }

  /**
   * Cleanup event listeners and intervals
   * Called when there are no more subscribers
   */
  private cleanup() {
    if (typeof window === 'undefined') return;

    if (this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }

    if (this.boundOfflineHandler) {
      window.removeEventListener('offline', this.boundOfflineHandler);
      this.boundOfflineHandler = null;
    }

    this.stopPeriodicCheck();
    this.initialized = false;
  }

  /**
   * Start periodic connectivity checks
   * Only runs when there are active subscribers
   */
  private startPeriodicCheck() {
    // Don't start if already running or no listeners
    if (this.periodicCheckInterval || this.listeners.size === 0) return;

    // Check every 30 seconds (increased from 10s to reduce network noise)
    this.periodicCheckInterval = setInterval(async () => {
      // Stop if no listeners to prevent unnecessary network requests
      if (this.listeners.size === 0) {
        this.stopPeriodicCheck();
        return;
      }

      try {
        const wasOnline = this._isOnline;
        this._isOnline = await this.checkConnectivity();

        if (wasOnline !== this._isOnline) {
          this.notifyListeners();
        }
      } catch {
        // Silently handle any errors during periodic check
        // This prevents errors from propagating to error monitoring
      }
    }, 30000);
  }

  /**
   * Stop periodic connectivity checks
   */
  private stopPeriodicCheck() {
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this._isOnline));
  }

  /**
   * Check actual network connectivity by pinging a lightweight endpoint
   * 
   * This method is designed to fail silently and never throw errors that
   * would be captured by error monitoring. Network errors during connectivity
   * checks are expected and should not pollute error logs.
   */
  async checkConnectivity(): Promise<boolean> {
    // Fast path: if browser says we're offline, trust it
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      // Use a lightweight HEAD request to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
        // Use keepalive to prevent connection issues during page transitions
        keepalive: true,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Silently handle fetch errors - these are expected when offline
      // or when browser extensions interfere with requests
      // Don't log to console to avoid polluting logs with expected errors
      
      // Check if the error is from an abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout occurred - likely slow connection, consider offline
        return false;
      }

      // For any other error, try navigator.onLine as fallback
      // This avoids making additional network requests that could fail
      if (typeof navigator !== 'undefined') {
        return navigator.onLine;
      }

      return false;
    }
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Subscribe to network status changes
   * Lazily initializes the monitor and starts periodic checks when first subscriber is added
   * Automatically cleans up when last subscriber unsubscribes
   */
  subscribe(callback: ConnectionCallback): () => void {
    // Lazily initialize when first subscriber is added
    if (this.listeners.size === 0) {
      this.init();
      // Delay starting periodic check to avoid interfering with initial page load
      // This gives gtag and other third-party scripts time to initialize
      setTimeout(() => {
        if (this.listeners.size > 0) {
          this.startPeriodicCheck();
        }
      }, 5000);
    }

    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);

      // Cleanup when no more subscribers to avoid unnecessary network requests
      if (this.listeners.size === 0) {
        this.cleanup();
      }
    };
  }

  /**
   * Manually destroy the network monitor
   * Useful for testing or when the monitor is no longer needed
   */
  destroy() {
    this.listeners.clear();
    this.cleanup();
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();

/**
 * Hook for React components to monitor network status
 */
export function getNetworkStatus(): boolean {
  return networkMonitor.isOnline;
}

/**
 * Wait for network to come back online
 */
export function waitForOnline(timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (networkMonitor.isOnline) {
      resolve(true);
      return;
    }

    const timeoutId = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      if (isOnline) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

/**
 * Execute a function with automatic retry when offline
 */
export async function executeWithOfflineRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    waitForOnlineTimeoutMs?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelayMs = 2000,
    waitForOnlineTimeoutMs = 30000,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Wait for online if we're offline
    if (!networkMonitor.isOnline) {
      console.log('[NetworkUtils] Offline, waiting for connection...');
      const cameOnline = await waitForOnline(waitForOnlineTimeoutMs);

      if (!cameOnline) {
        throw new Error('Network unavailable. Please check your connection and try again.');
      }

      console.log('[NetworkUtils] Connection restored, resuming...');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a network error
      const isNetworkError =
        lastError.message.includes('fetch') ||
        lastError.message.includes('network') ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.name === 'TypeError';

      if (isNetworkError && attempt < maxRetries - 1) {
        console.log(`[NetworkUtils] Network error on attempt ${attempt + 1}, retrying...`);

        // Wait before retry with exponential backoff
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
