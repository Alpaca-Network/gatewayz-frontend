/**
 * Web Vitals Service
 *
 * Client-side service for collecting and reporting Core Web Vitals metrics.
 * Integrates with the web-vitals library to capture real user metrics.
 */

import type {
  WebVitalName,
  WebVitalRating,
  DeviceType,
  RecordWebVitalsRequest,
  getRating,
} from './web-vitals-types';
import { getRating as getRatingFn } from './web-vitals-types';

// ============================================================================
// Types
// ============================================================================

interface WebVitalEntry {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  delta: number;
  id: string;
  navigationType: string;
  timestamp: number;
}

interface WebVitalsConfig {
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  enabled?: boolean;
  debug?: boolean;
  sampleRate?: number;
}

// ============================================================================
// Web Vitals Service
// ============================================================================

class WebVitalsService {
  private queue: WebVitalEntry[] = [];
  private config: Required<WebVitalsConfig>;
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.config = {
      endpoint: '/api/vitals',
      batchSize: 10,
      flushInterval: 5000,
      enabled: true,
      debug: false,
      sampleRate: 1.0,
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize the service with configuration
   */
  init(config?: WebVitalsConfig): void {
    if (this.isInitialized) return;

    this.config = { ...this.config, ...config };
    this.isInitialized = true;

    if (this.config.enabled && typeof window !== 'undefined') {
      this.startFlushInterval();
      this.setupBeforeUnload();
    }

    if (this.config.debug) {
      console.log('[WebVitals] Service initialized', this.config);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    // Check for crypto.randomUUID availability (not supported in older browsers/WebViews)
    if (
      typeof window !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID (e.g., older Android WebViews)
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';

    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua);
    const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua);

    if (isTablet) return 'tablet';
    if (isMobile) return 'mobile';
    return 'desktop';
  }

  /**
   * Get connection type if available
   */
  getConnectionType(): string | undefined {
    if (typeof navigator === 'undefined') return undefined;

    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        type?: string;
      };
    };

    return nav.connection?.effectiveType || nav.connection?.type;
  }

  /**
   * Record a single Web Vital metric
   */
  record(
    name: WebVitalName,
    value: number,
    options: {
      delta?: number;
      id?: string;
      navigationType?: string;
    } = {}
  ): void {
    if (!this.config.enabled) return;

    // Apply sample rate
    if (Math.random() > this.config.sampleRate) return;

    const device = this.getDeviceType();
    const rating = getRatingFn(name, value, device);

    const entry: WebVitalEntry = {
      name,
      value,
      rating,
      delta: options.delta ?? value,
      id: options.id ?? this.generateSessionId(),
      navigationType: options.navigationType ?? 'navigate',
      timestamp: Date.now(),
    };

    this.queue.push(entry);

    if (this.config.debug) {
      console.log('[WebVitals] Recorded:', entry);
    }

    // Flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Record LCP (Largest Contentful Paint)
   */
  recordLCP(value: number, delta?: number): void {
    this.record('LCP', value, { delta });
  }

  /**
   * Record INP (Interaction to Next Paint)
   */
  recordINP(value: number, delta?: number): void {
    this.record('INP', value, { delta });
  }

  /**
   * Record CLS (Cumulative Layout Shift)
   */
  recordCLS(value: number, delta?: number): void {
    this.record('CLS', value, { delta });
  }

  /**
   * Record FCP (First Contentful Paint)
   */
  recordFCP(value: number, delta?: number): void {
    this.record('FCP', value, { delta });
  }

  /**
   * Record TTFB (Time to First Byte)
   */
  recordTTFB(value: number, delta?: number): void {
    this.record('TTFB', value, { delta });
  }

  /**
   * Start the flush interval timer
   */
  private startFlushInterval(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Setup beforeunload handler to flush remaining metrics
   */
  private setupBeforeUnload(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      }
    });

    window.addEventListener('pagehide', () => {
      this.flush(true);
    });
  }

  /**
   * Flush queued metrics to the backend
   */
  async flush(useBeacon = false): Promise<void> {
    if (this.queue.length === 0) return;

    const entries = [...this.queue];
    this.queue = [];

    const payload: RecordWebVitalsRequest = {
      sessionId: this.sessionId,
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      title: typeof document !== 'undefined' ? document.title : undefined,
      device: this.getDeviceType(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      connectionType: this.getConnectionType(),
      metrics: entries.map((e) => ({
        name: e.name,
        value: e.value,
        rating: e.rating,
        delta: e.delta,
        navigationType: e.navigationType,
      })),
      timestamp: Date.now(),
    };

    if (this.config.debug) {
      console.log('[WebVitals] Flushing:', payload);
    }

    try {
      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Use sendBeacon for page unload
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json',
        });
        navigator.sendBeacon(this.config.endpoint, blob);
      } else {
        // Use fetch for normal flushes
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[WebVitals] Failed to flush:', error);
      }
      // Re-queue failed entries
      this.queue = [...entries, ...this.queue];
    }
  }

  /**
   * Stop the service and flush remaining metrics
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(true);
    this.isInitialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const webVitalsService = new WebVitalsService();

// ============================================================================
// Integration with web-vitals library
// ============================================================================

/**
 * Setup Web Vitals collection using the web-vitals library
 * Call this in your app's root layout or _app.tsx
 */
export async function setupWebVitals(config?: WebVitalsConfig): Promise<void> {
  if (typeof window === 'undefined') return;

  webVitalsService.init(config);

  try {
    // Dynamic import of web-vitals library
    const { onLCP, onINP, onCLS, onFCP, onTTFB } = await import('web-vitals');

    // Report each metric
    onLCP((metric) => {
      webVitalsService.record('LCP', metric.value, {
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    onINP((metric) => {
      webVitalsService.record('INP', metric.value, {
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    onCLS((metric) => {
      webVitalsService.record('CLS', metric.value, {
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    onFCP((metric) => {
      webVitalsService.record('FCP', metric.value, {
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    onTTFB((metric) => {
      webVitalsService.record('TTFB', metric.value, {
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });
  } catch (error) {
    console.error('[WebVitals] Failed to load web-vitals library:', error);
  }
}
