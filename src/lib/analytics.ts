/**
 * Analytics Service
 * Sends analytics events to backend Statsig integration
 * This bypasses ad-blocker restrictions on client-side analytics
 *
 * Includes robust error handling for network failures, ad blockers, and timeouts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const ANALYTICS_TIMEOUT_MS = 5000; // 5 second timeout for analytics requests

export interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  value?: string;
  metadata?: Record<string, any>;
}

/**
 * Check if analytics is available (not blocked by ad blocker)
 */
export function isAnalyticsAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (window as any).statsigAvailable !== false;
}

/**
 * Create a timeout promise that rejects after specified time
 */
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Analytics request timeout after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
}

/**
 * Log a single analytics event to the backend with comprehensive error handling
 */
export async function logAnalyticsEvent(
  eventName: string,
  metadata?: Record<string, any>,
  value?: string
): Promise<void> {
  try {
    // Try multiple API key storage locations for compatibility
    const apiKey = localStorage.getItem('gatewayz_api_key')
      || localStorage.getItem('api_key')
      || process.env.NEXT_PUBLIC_DEV_API_KEY;

    if (!apiKey) {
      console.debug('[Analytics] No API key found, skipping event:', eventName);
      return;
    }

    // Use the Next.js API route proxy instead of calling backend directly
    const fetchPromise = fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        event_name: eventName,
        value,
        metadata,
      }),
    });

    // Race between fetch and timeout
    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(ANALYTICS_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      // Check if this is a blocked request
      if (response.status === 0 || response.statusText === 'error') {
        console.warn('[Analytics] Request blocked (likely ad blocker):', eventName);
      } else {
        console.debug('[Analytics] Failed to log event:', eventName, response.status);
      }
    }
  } catch (error) {
    // Categorize the error for better debugging
    const errorString = String(error);

    if (errorString.includes('timeout')) {
      console.debug('[Analytics] Event logging timed out:', eventName);
    } else if (errorString.includes('blocked') || errorString.includes('net::ERR')) {
      console.warn('[Analytics] Event blocked by ad blocker or extension:', eventName);
    } else if (errorString.includes('NetworkError') || errorString.includes('Failed to fetch')) {
      console.debug('[Analytics] Network error logging event:', eventName);
    } else {
      console.debug('[Analytics] Error logging event:', eventName, error);
    }

    // Never throw - analytics should never break the app
  }
}

/**
 * Log multiple analytics events in batch with comprehensive error handling
 */
export async function logAnalyticsEventBatch(
  events: AnalyticsEvent[]
): Promise<void> {
  try {
    if (!events || events.length === 0) {
      console.debug('[Analytics] Empty batch - skipping');
      return;
    }

    // Try multiple API key storage locations for compatibility
    const apiKey = localStorage.getItem('gatewayz_api_key')
      || localStorage.getItem('api_key')
      || process.env.NEXT_PUBLIC_DEV_API_KEY;

    if (!apiKey) {
      console.debug('[Analytics] No API key found, skipping batch events');
      return;
    }

    // Use the Next.js API route proxy instead of calling backend directly
    const fetchPromise = fetch('/api/analytics/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ events }),
    });

    // Race between fetch and timeout
    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(ANALYTICS_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      // Check if this is a blocked request
      if (response.status === 0 || response.statusText === 'error') {
        console.warn('[Analytics] Batch request blocked (likely ad blocker):', events.length, 'events');
      } else {
        console.debug('[Analytics] Failed to log batch events:', response.status);
      }
    }
  } catch (error) {
    // Categorize the error for better debugging
    const errorString = String(error);

    if (errorString.includes('timeout')) {
      console.debug('[Analytics] Batch logging timed out');
    } else if (errorString.includes('blocked') || errorString.includes('net::ERR')) {
      console.warn('[Analytics] Batch blocked by ad blocker or extension');
    } else if (errorString.includes('NetworkError') || errorString.includes('Failed to fetch')) {
      console.debug('[Analytics] Network error logging batch events');
    } else {
      console.debug('[Analytics] Error logging batch events:', error);
    }

    // Never throw - analytics should never break the app
  }
}
