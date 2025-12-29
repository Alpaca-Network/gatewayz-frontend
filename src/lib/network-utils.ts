/**
 * Network utilities for detecting connectivity and handling offline scenarios
 */

type ConnectionCallback = (isOnline: boolean) => void;

class NetworkMonitor {
  private listeners: Set<ConnectionCallback> = new Set();
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('online', () => {
      this._isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      this.notifyListeners();
    });

    // Also check connectivity periodically (handles cases where browser events are unreliable)
    this.startPeriodicCheck();
  }

  private startPeriodicCheck() {
    // Check every 10 seconds
    setInterval(async () => {
      const wasOnline = this._isOnline;
      this._isOnline = await this.checkConnectivity();

      if (wasOnline !== this._isOnline) {
        this.notifyListeners();
      }
    }, 10000);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this._isOnline));
  }

  /**
   * Check actual network connectivity by pinging a lightweight endpoint
   */
  async checkConnectivity(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    try {
      // Use a lightweight HEAD request to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // If our API is unreachable, try a more universal check
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // Fallback: check if we can reach anything
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);
        return true;
      } catch {
        return false;
      }
    }
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  subscribe(callback: ConnectionCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
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
