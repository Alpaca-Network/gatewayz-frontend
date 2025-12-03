import * as Sentry from "@sentry/nextjs";

// Edge runtime rate limiting state
const edgeRateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(),
};

const EDGE_RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 30,
  windowMs: 60000,
  dedupeWindowMs: 5000,
};

function shouldEdgeRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  if (now - edgeRateLimitState.windowStart > EDGE_RATE_LIMIT_CONFIG.windowMs) {
    edgeRateLimitState.eventCount = 0;
    edgeRateLimitState.windowStart = now;
    for (const [key, timestamp] of edgeRateLimitState.recentMessages) {
      if (now - timestamp > EDGE_RATE_LIMIT_CONFIG.dedupeWindowMs) {
        edgeRateLimitState.recentMessages.delete(key);
      }
    }
  }

  if (edgeRateLimitState.eventCount >= EDGE_RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry Edge] Rate limit exceeded, dropping event');
    return true;
  }

  const messageKey = event.message ||
    event.exception?.values?.[0]?.value ||
    'unknown';
  const lastSent = edgeRateLimitState.recentMessages.get(messageKey.slice(0, 100));
  if (lastSent && now - lastSent < EDGE_RATE_LIMIT_CONFIG.dedupeWindowMs) {
    return true;
  }

  edgeRateLimitState.eventCount++;
  edgeRateLimitState.recentMessages.set(messageKey.slice(0, 100), now);
  return false;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // REDUCED: Sample only 10% of transactions to avoid rate limits
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: 50,

  // DISABLED: enableLogs was causing excessive event volume
  enableLogs: false,

  // Filter out non-blocking wallet extension errors from Privy AND apply rate limiting
  beforeSend(event, hint) {
    // Apply rate limiting first
    if (shouldEdgeRateLimit(event)) {
      return null;
    }
    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
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

    if (isWalletExtensionError || isWalletConnectRelayError) {
      const label = isWalletConnectRelayError ? 'WalletConnect relay error' : 'Privy wallet extension error';
      console.warn(`[Sentry] Filtered out non-blocking ${label}:`, errorMessage);
      return null; // Don't send this error to Sentry
    }

    return event;
  },
});
