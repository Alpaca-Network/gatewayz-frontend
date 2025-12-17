import * as Sentry from "@sentry/nextjs";

// Edge runtime rate limiting state
const edgeRateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(),
  lastCleanup: Date.now(),
};

const EDGE_RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 10,    // REDUCED from 30 to prevent 429s
  windowMs: 60000,
  dedupeWindowMs: 60000,     // INCREASED from 5s to 60s to prevent duplicates
  cleanupIntervalMs: 30000,
  maxMapSize: 100,
};

function cleanupEdgeStaleEntries(): void {
  const now = Date.now();
  if (now - edgeRateLimitState.lastCleanup < EDGE_RATE_LIMIT_CONFIG.cleanupIntervalMs) {
    return;
  }
  edgeRateLimitState.lastCleanup = now;

  for (const [key, timestamp] of edgeRateLimitState.recentMessages) {
    if (now - timestamp > EDGE_RATE_LIMIT_CONFIG.dedupeWindowMs) {
      edgeRateLimitState.recentMessages.delete(key);
    }
  }

  if (edgeRateLimitState.recentMessages.size > EDGE_RATE_LIMIT_CONFIG.maxMapSize) {
    const entries = Array.from(edgeRateLimitState.recentMessages.entries())
      .sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - EDGE_RATE_LIMIT_CONFIG.maxMapSize);
    for (const [key] of toRemove) {
      edgeRateLimitState.recentMessages.delete(key);
    }
  }
}

function shouldFilterEdgeEvent(errorMessage: string, event?: Sentry.ErrorEvent): boolean {
  const normalizedMessage = (errorMessage || '').toLowerCase();

  const isWalletExtensionError =
    normalizedMessage.includes('chrome.runtime.sendmessage') ||
    normalizedMessage.includes('runtime.sendmessage') ||
    (normalizedMessage.includes('extension id') && normalizedMessage.includes('from a webpage'));

  const isWalletConnectRelayError =
    normalizedMessage.includes('walletconnect') ||
    normalizedMessage.includes('requestrelay') ||
    normalizedMessage.includes('websocket error 1006') ||
    normalizedMessage.includes('explorer-api.walletconnect.com') ||
    normalizedMessage.includes('relay.walletconnect.com');

  // Filter out "N+1 API Call" performance monitoring events
  // These are triggered by our intentional parallel model prefetch optimization
  const isN1ApiCall =
    event?.level === 'info' &&
    (normalizedMessage.includes('n+1 api call') ||
     event?.message?.toLowerCase().includes('n+1 api call'));

  return isWalletExtensionError || isWalletConnectRelayError || isN1ApiCall;
}

function shouldEdgeRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  cleanupEdgeStaleEntries();

  if (now - edgeRateLimitState.windowStart > EDGE_RATE_LIMIT_CONFIG.windowMs) {
    edgeRateLimitState.eventCount = 0;
    edgeRateLimitState.windowStart = now;
  }

  if (edgeRateLimitState.eventCount >= EDGE_RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry Edge] Rate limit exceeded, dropping event');
    return true;
  }

  // Include exception type in deduplication key to avoid incorrectly
  // deduplicating different error types with the same message
  const message = event.message ||
    event.exception?.values?.[0]?.value ||
    event.exception?.values?.[0]?.type ||
    'unknown';
  const type = event.exception?.values?.[0]?.type || 'message';
  const messageKey = `${type}:${message.slice(0, 100)}`;
  const lastSent = edgeRateLimitState.recentMessages.get(messageKey);
  if (lastSent && now - lastSent < EDGE_RATE_LIMIT_CONFIG.dedupeWindowMs) {
    return true;
  }

  edgeRateLimitState.eventCount++;
  edgeRateLimitState.recentMessages.set(messageKey, now);
  return false;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // REDUCED: Sample only 1% of transactions to avoid rate limits
  tracesSampleRate: 0.01,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: 50,

  // DISABLED: enableLogs was causing excessive event volume
  enableLogs: false,

  // Filter out non-blocking errors FIRST, then apply rate limiting
  // This prevents filtered events from consuming rate limit quota
  beforeSend(event, hint) {
    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';

    // Filter BEFORE rate limiting to avoid wasting quota
    if (shouldFilterEdgeEvent(errorMessage, event)) {
      console.warn('[Sentry] Filtered out non-blocking wallet/extension error:', errorMessage);
      return null;
    }

    // Apply rate limiting only for events that pass filtering
    if (shouldEdgeRateLimit(event)) {
      return null;
    }

    return event;
  },
});
