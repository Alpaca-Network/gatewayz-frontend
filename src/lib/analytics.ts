/**
 * Analytics Service
 * Sends analytics events to backend Statsig integration
 * This bypasses ad-blocker restrictions on client-side analytics
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  value?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a single analytics event to the backend
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
      console.warn('[Analytics] No API key found, skipping event:', eventName);
      return;
    }

    // Use the Next.js API route proxy instead of calling backend directly
    const response = await fetch('/api/analytics/events', {
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

    if (!response.ok) {
      console.warn('[Analytics] Failed to log event:', eventName, response.status);
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('[Analytics] Error logging event:', eventName, error);
  }
}

/**
 * Log multiple analytics events in batch
 */
export async function logAnalyticsEventBatch(
  events: AnalyticsEvent[]
): Promise<void> {
  try {
    // Try multiple API key storage locations for compatibility
    const apiKey = localStorage.getItem('gatewayz_api_key')
      || localStorage.getItem('api_key')
      || process.env.NEXT_PUBLIC_DEV_API_KEY;

    if (!apiKey) {
      console.warn('[Analytics] No API key found, skipping batch events');
      return;
    }

    // Use the Next.js API route proxy instead of calling backend directly
    const response = await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      console.warn('[Analytics] Failed to log batch events:', response.status);
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('[Analytics] Error logging batch events:', error);
  }
}
