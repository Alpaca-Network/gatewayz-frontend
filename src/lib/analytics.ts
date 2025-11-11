/**
 * Analytics Service
 * Sends analytics events to backend Statsig integration
 * This bypasses ad-blocker restrictions on client-side analytics
 *
 * Enhanced with:
 * - Release SHA and version tracking
 * - Environment metadata
 * - Service name identification
 */

import { buildInfo } from './build-info';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  value?: string;
  metadata?: Record<string, any>;
}

/**
 * Get standard metadata to include with all events
 */
function getStandardMetadata(): Record<string, any> {
  return {
    release_sha: buildInfo.sha,
    release_short_sha: buildInfo.shortSha,
    release_version: buildInfo.version,
    release_branch: buildInfo.branch,
    service_name: buildInfo.serviceName,
    environment: buildInfo.environment,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log a single analytics event to the backend
 * Automatically includes release SHA, version, and environment metadata
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

    // Merge user metadata with standard metadata
    const enrichedMetadata = {
      ...getStandardMetadata(),
      ...metadata,
    };

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
        metadata: enrichedMetadata,
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
 * Automatically includes release SHA, version, and environment metadata for each event
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

    // Enrich each event with standard metadata
    const standardMetadata = getStandardMetadata();
    const enrichedEvents = events.map(event => ({
      ...event,
      metadata: {
        ...standardMetadata,
        ...event.metadata,
      },
    }));

    // Use the Next.js API route proxy instead of calling backend directly
    const response = await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ events: enrichedEvents }),
    });

    if (!response.ok) {
      console.warn('[Analytics] Failed to log batch events:', response.status);
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('[Analytics] Error logging batch events:', error);
  }
}
