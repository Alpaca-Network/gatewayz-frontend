/**
 * Sentry Metrics Service
 *
 * Provides application-level metrics tracking using Sentry's metrics feature.
 * Metrics are connected to errors, logs, and spans for easier debugging.
 *
 * Available metric types:
 * - count: Counter for events (e.g., button clicks, API calls)
 * - gauge: Point-in-time values (e.g., queue size, health score)
 * - distribution: Timing/size distributions (e.g., response times, token counts)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/metrics/
 */

import * as Sentry from '@sentry/nextjs';

// Type definitions for metric attributes
type MetricAttributeValue = string | number | boolean | undefined;
type MetricAttributes = Record<string, MetricAttributeValue>;

interface ApiMetricAttributes {
  endpoint?: string;
  method?: string;
  status_code?: string;
  provider?: string;
  model?: string;
  error_type?: string;
  success?: string;
  [key: string]: MetricAttributeValue;
}

interface ChatMetricAttributes {
  model?: string;
  provider?: string;
  is_streaming?: string;
  has_tools?: string;
  message_type?: string;
  [key: string]: MetricAttributeValue;
}

interface UserMetricAttributes {
  tier?: string;
  auth_method?: string;
  is_guest?: string;
  [key: string]: MetricAttributeValue;
}

/**
 * Convert various types to string for Sentry attributes
 * Filters out undefined values
 */
function toStringAttributes(attrs: MetricAttributes): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) {
      result[key] = typeof value === 'boolean' ? String(value) : value;
    }
  }
  return result;
}

/**
 * Sentry Metrics Service
 * Centralized metrics tracking for the frontend application
 */
export const sentryMetrics = {
  // ============================================================================
  // API Request Metrics
  // ============================================================================

  /**
   * Track an API request
   * @param endpoint - API endpoint path
   * @param method - HTTP method (GET, POST, etc.)
   * @param durationMs - Request duration in milliseconds
   * @param statusCode - HTTP status code
   * @param extraAttrs - Additional attributes
   */
  trackApiRequest(
    endpoint: string,
    method: string,
    durationMs: number,
    statusCode: number,
    extraAttrs: Partial<ApiMetricAttributes> = {}
  ): void {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const attrs = toStringAttributes({
      endpoint: normalizedEndpoint,
      method,
      status_code: String(statusCode),
      success: String(statusCode >= 200 && statusCode < 400),
      ...extraAttrs,
    });

    // Track request count
    Sentry.metrics.count('api.request.count', 1, {
      attributes: attrs,
    });

    // Track request latency distribution
    Sentry.metrics.distribution('api.request.duration_ms', durationMs, {
      attributes: { endpoint: normalizedEndpoint, method },
      unit: 'millisecond',
    });

    // Track errors separately
    if (statusCode >= 400) {
      Sentry.metrics.count('api.request.error', 1, {
        attributes: {
          endpoint: normalizedEndpoint,
          method,
          status_code: String(statusCode),
          error_type: getErrorType(statusCode),
        },
      });
    }
  },

  /**
   * Track API request failure
   * @param endpoint - API endpoint path
   * @param errorType - Type of error (network, timeout, etc.)
   * @param extraAttrs - Additional attributes
   */
  trackApiError(
    endpoint: string,
    errorType: string,
    extraAttrs: Partial<ApiMetricAttributes> = {}
  ): void {
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    Sentry.metrics.count('api.error.count', 1, {
      attributes: toStringAttributes({
        endpoint: normalizedEndpoint,
        error_type: errorType,
        ...extraAttrs,
      }),
    });
  },

  // ============================================================================
  // Chat/LLM Metrics
  // ============================================================================

  /**
   * Track a chat completion request
   * @param model - Model identifier
   * @param provider - Provider name
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param durationMs - Total processing time in milliseconds
   * @param extraAttrs - Additional attributes
   */
  trackChatCompletion(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
    extraAttrs: Partial<ChatMetricAttributes> = {}
  ): void {
    const totalTokens = inputTokens + outputTokens;
    const attrs = toStringAttributes({ model, provider, ...extraAttrs });

    // Track request count
    Sentry.metrics.count('chat.completion.count', 1, { attributes: attrs });

    // Track token usage distributions
    Sentry.metrics.distribution('chat.tokens.input', inputTokens, {
      attributes: attrs,
      unit: 'none',
    });

    Sentry.metrics.distribution('chat.tokens.output', outputTokens, {
      attributes: attrs,
      unit: 'none',
    });

    Sentry.metrics.distribution('chat.tokens.total', totalTokens, {
      attributes: attrs,
      unit: 'none',
    });

    // Track latency
    Sentry.metrics.distribution('chat.completion.duration_ms', durationMs, {
      attributes: attrs,
      unit: 'millisecond',
    });

    // Track tokens per second throughput
    if (durationMs > 0) {
      const tokensPerSecond = (totalTokens / durationMs) * 1000;
      Sentry.metrics.distribution('chat.throughput.tokens_per_second', tokensPerSecond, {
        attributes: attrs,
        unit: 'none',
      });
    }

    // Track unique models used (using count as a workaround since set is not available)
    Sentry.metrics.count('chat.model_used', 1, {
      attributes: { model, provider },
    });
  },

  /**
   * Track chat completion error
   * @param model - Model identifier
   * @param provider - Provider name
   * @param errorType - Type of error
   * @param extraAttrs - Additional attributes
   */
  trackChatError(
    model: string,
    provider: string,
    errorType: string,
    extraAttrs: Partial<ChatMetricAttributes> = {}
  ): void {
    Sentry.metrics.count('chat.error.count', 1, {
      attributes: toStringAttributes({
        model,
        provider,
        error_type: errorType,
        ...extraAttrs,
      }),
    });
  },

  /**
   * Track streaming chat metrics
   * @param model - Model identifier
   * @param provider - Provider name
   * @param timeToFirstToken - Time to first token in milliseconds
   * @param totalDuration - Total streaming duration in milliseconds
   * @param tokenCount - Total tokens streamed
   * @param extraAttrs - Additional attributes
   */
  trackChatStreaming(
    model: string,
    provider: string,
    timeToFirstToken: number,
    totalDuration: number,
    tokenCount: number,
    extraAttrs: Partial<ChatMetricAttributes> = {}
  ): void {
    const attrs = toStringAttributes({ model, provider, ...extraAttrs });

    // Track time to first token (TTFT)
    Sentry.metrics.distribution('chat.streaming.ttft_ms', timeToFirstToken, {
      attributes: attrs,
      unit: 'millisecond',
    });

    // Track total streaming duration
    Sentry.metrics.distribution('chat.streaming.duration_ms', totalDuration, {
      attributes: attrs,
      unit: 'millisecond',
    });

    // Track streaming token count
    Sentry.metrics.distribution('chat.streaming.tokens', tokenCount, {
      attributes: attrs,
      unit: 'none',
    });
  },

  // ============================================================================
  // Provider Health Metrics
  // ============================================================================

  /**
   * Track provider health score
   * @param provider - Provider name
   * @param healthScore - Health score (0-100)
   * @param status - Health status (healthy, degraded, unhealthy)
   */
  trackProviderHealth(
    provider: string,
    healthScore: number,
    status: 'healthy' | 'degraded' | 'unhealthy'
  ): void {
    const attrs = { provider, status };

    // Track health score as gauge
    Sentry.metrics.gauge('provider.health.score', healthScore, {
      attributes: attrs,
      unit: 'none',
    });

    // Track health status changes
    Sentry.metrics.count('provider.health.status_check', 1, {
      attributes: attrs,
    });
  },

  /**
   * Track provider latency metrics
   * @param provider - Provider name
   * @param model - Model identifier
   * @param avgLatency - Average latency in milliseconds
   * @param p50 - 50th percentile latency
   * @param p95 - 95th percentile latency
   * @param p99 - 99th percentile latency
   */
  trackProviderLatency(
    provider: string,
    model: string,
    avgLatency: number,
    p50?: number,
    p95?: number,
    p99?: number
  ): void {
    const attrs = { provider, model };

    Sentry.metrics.gauge('provider.latency.avg_ms', avgLatency, {
      attributes: attrs,
      unit: 'millisecond',
    });

    if (p50 !== undefined) {
      Sentry.metrics.gauge('provider.latency.p50_ms', p50, {
        attributes: attrs,
        unit: 'millisecond',
      });
    }

    if (p95 !== undefined) {
      Sentry.metrics.gauge('provider.latency.p95_ms', p95, {
        attributes: attrs,
        unit: 'millisecond',
      });
    }

    if (p99 !== undefined) {
      Sentry.metrics.gauge('provider.latency.p99_ms', p99, {
        attributes: attrs,
        unit: 'millisecond',
      });
    }
  },

  /**
   * Track provider error rate
   * @param provider - Provider name
   * @param errorRate - Error rate (0-1)
   * @param totalRequests - Total requests in period
   * @param totalErrors - Total errors in period
   */
  trackProviderErrorRate(
    provider: string,
    errorRate: number,
    totalRequests: number,
    totalErrors: number
  ): void {
    const attrs = { provider };

    Sentry.metrics.gauge('provider.error_rate', errorRate * 100, {
      attributes: attrs,
      unit: 'percent',
    });

    Sentry.metrics.gauge('provider.requests.total', totalRequests, {
      attributes: attrs,
      unit: 'none',
    });

    Sentry.metrics.gauge('provider.errors.total', totalErrors, {
      attributes: attrs,
      unit: 'none',
    });
  },

  // ============================================================================
  // User Engagement Metrics
  // ============================================================================

  /**
   * Track user action
   * @param action - Action name (e.g., 'login', 'send_message', 'select_model')
   * @param extraAttrs - Additional attributes
   */
  trackUserAction(action: string, extraAttrs: Partial<UserMetricAttributes> = {}): void {
    Sentry.metrics.count('user.action', 1, {
      attributes: toStringAttributes({ action, ...extraAttrs }),
    });
  },

  /**
   * Track active user (for DAU/MAU)
   * Uses count with user_id as attribute to track unique users
   * @param userId - User identifier (hashed)
   * @param extraAttrs - Additional attributes
   */
  trackActiveUser(userId: string, extraAttrs: Partial<UserMetricAttributes> = {}): void {
    Sentry.metrics.count('user.active', 1, {
      attributes: toStringAttributes({ user_id: userId, ...extraAttrs }),
    });
  },

  /**
   * Track user session duration
   * @param durationSeconds - Session duration in seconds
   * @param extraAttrs - Additional attributes
   */
  trackSessionDuration(durationSeconds: number, extraAttrs: Partial<UserMetricAttributes> = {}): void {
    Sentry.metrics.distribution('user.session.duration_seconds', durationSeconds, {
      attributes: toStringAttributes({ ...extraAttrs }),
      unit: 'second',
    });
  },

  /**
   * Track user tier/subscription
   * @param tier - User tier (basic, pro, max)
   * @param status - Subscription status
   */
  trackUserTier(
    tier: string,
    status: 'active' | 'trial' | 'cancelled' | 'expired'
  ): void {
    Sentry.metrics.count('user.tier.count', 1, {
      attributes: { tier, status },
    });
  },

  // ============================================================================
  // Performance Metrics
  // ============================================================================

  /**
   * Track page load performance
   * @param pageName - Page identifier
   * @param loadTimeMs - Page load time in milliseconds
   * @param extraAttrs - Additional attributes
   */
  trackPageLoad(
    pageName: string,
    loadTimeMs: number,
    extraAttrs: MetricAttributes = {}
  ): void {
    const attrs = toStringAttributes({ page: pageName, ...extraAttrs });

    Sentry.metrics.distribution('page.load_time_ms', loadTimeMs, {
      attributes: attrs,
      unit: 'millisecond',
    });

    Sentry.metrics.count('page.load.count', 1, {
      attributes: attrs,
    });
  },

  /**
   * Track client-side error
   * @param errorType - Type of error
   * @param source - Error source (component, hook, etc.)
   * @param extraAttrs - Additional attributes
   */
  trackClientError(
    errorType: string,
    source: string,
    extraAttrs: MetricAttributes = {}
  ): void {
    Sentry.metrics.count('client.error.count', 1, {
      attributes: toStringAttributes({
        error_type: errorType,
        source,
        ...extraAttrs,
      }),
    });
  },

  // ============================================================================
  // Feature Usage Metrics
  // ============================================================================

  /**
   * Track feature usage
   * @param feature - Feature name
   * @param action - Action within feature (e.g., 'open', 'use', 'close')
   * @param extraAttrs - Additional attributes
   */
  trackFeatureUsage(
    feature: string,
    action: string,
    extraAttrs: MetricAttributes = {}
  ): void {
    Sentry.metrics.count('feature.usage', 1, {
      attributes: toStringAttributes({ feature, action, ...extraAttrs }),
    });
  },

  /**
   * Track model selection
   * @param model - Model identifier
   * @param provider - Provider name
   * @param source - Selection source (search, recent, favorite)
   */
  trackModelSelection(
    model: string,
    provider: string,
    source: 'search' | 'recent' | 'favorite' | 'default' | 'auto'
  ): void {
    Sentry.metrics.count('model.selection', 1, {
      attributes: { model, provider, source },
    });
  },

  // ============================================================================
  // Cache Metrics
  // ============================================================================

  /**
   * Track cache hit/miss
   * @param cacheName - Cache identifier
   * @param hit - Whether it was a cache hit
   * @param extraAttrs - Additional attributes
   */
  trackCacheAccess(
    cacheName: string,
    hit: boolean,
    extraAttrs: MetricAttributes = {}
  ): void {
    Sentry.metrics.count('cache.access', 1, {
      attributes: toStringAttributes({
        cache: cacheName,
        result: hit ? 'hit' : 'miss',
        ...extraAttrs,
      }),
    });
  },

  /**
   * Track cache size
   * @param cacheName - Cache identifier
   * @param size - Number of items in cache
   * @param sizeBytes - Size in bytes (optional)
   */
  trackCacheSize(
    cacheName: string,
    size: number,
    sizeBytes?: number
  ): void {
    Sentry.metrics.gauge('cache.items', size, {
      attributes: { cache: cacheName },
      unit: 'none',
    });

    if (sizeBytes !== undefined) {
      Sentry.metrics.gauge('cache.size_bytes', sizeBytes, {
        attributes: { cache: cacheName },
        unit: 'byte',
      });
    }
  },

  // ============================================================================
  // Circuit Breaker Metrics
  // ============================================================================

  /**
   * Track circuit breaker state change
   * @param provider - Provider name
   * @param model - Model identifier
   * @param state - Circuit state (CLOSED, OPEN, HALF_OPEN)
   * @param failureCount - Number of failures
   */
  trackCircuitBreakerState(
    provider: string,
    model: string,
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    failureCount: number
  ): void {
    const attrs = { provider, model, state };

    Sentry.metrics.count('circuit_breaker.state_change', 1, {
      attributes: attrs,
    });

    Sentry.metrics.gauge('circuit_breaker.failures', failureCount, {
      attributes: attrs,
      unit: 'none',
    });
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize API endpoint for consistent tagging
 * Removes IDs and query params to group similar endpoints
 */
function normalizeEndpoint(endpoint: string): string {
  return endpoint
    // Remove query parameters
    .split('?')[0]
    // Remove trailing slashes
    .replace(/\/+$/, '')
    // Replace UUIDs with placeholder
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs with placeholder
    .replace(/\/\d+/g, '/:id')
    // Normalize base URL
    .replace(/^https?:\/\/[^/]+/, '');
}

/**
 * Get error type from HTTP status code
 */
function getErrorType(statusCode: number): string {
  if (statusCode >= 500) return 'server_error';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 401) return 'unauthorized';
  if (statusCode >= 400) return 'client_error';
  return 'unknown';
}

export default sentryMetrics;
