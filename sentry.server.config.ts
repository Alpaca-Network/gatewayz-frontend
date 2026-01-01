import * as Sentry from "@sentry/nextjs";

// Get release information
const getRelease = () => {
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }

  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA;
  }

  try {
    const packageJson = require('./package.json');
    return `${packageJson.name}@${packageJson.version}`;
  } catch (e) {
    return undefined;
  }
};

// Server-side rate limiting state
const serverRateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(),
  lastCleanup: Date.now(),
};

const SERVER_RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 20,  // REDUCED from 50 to prevent 429s
  windowMs: 60000,
  dedupeWindowMs: 60000,   // INCREASED from 5s to 60s to prevent duplicates
  cleanupIntervalMs: 30000,
  maxMapSize: 100,
};

function cleanupServerStaleEntries(): void {
  const now = Date.now();
  if (now - serverRateLimitState.lastCleanup < SERVER_RATE_LIMIT_CONFIG.cleanupIntervalMs) {
    return;
  }
  serverRateLimitState.lastCleanup = now;

  for (const [key, timestamp] of serverRateLimitState.recentMessages) {
    if (now - timestamp > SERVER_RATE_LIMIT_CONFIG.dedupeWindowMs) {
      serverRateLimitState.recentMessages.delete(key);
    }
  }

  if (serverRateLimitState.recentMessages.size > SERVER_RATE_LIMIT_CONFIG.maxMapSize) {
    const entries = Array.from(serverRateLimitState.recentMessages.entries())
      .sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - SERVER_RATE_LIMIT_CONFIG.maxMapSize);
    for (const [key] of toRemove) {
      serverRateLimitState.recentMessages.delete(key);
    }
  }
}

function shouldFilterServerEvent(errorMessage: string, event?: Sentry.ErrorEvent): boolean {
  const normalizedMessage = (errorMessage || '').toLowerCase();

  const isWalletExtensionError =
    normalizedMessage.includes('chrome.runtime.sendmessage') ||
    normalizedMessage.includes('runtime.sendmessage') ||
    (normalizedMessage.includes('extension id') && normalizedMessage.includes('from a webpage')) ||
    normalizedMessage.includes('removelistener') ||
    normalizedMessage.includes('stoplisteners') ||
    normalizedMessage.includes('inpage.js');

  const isWalletConnectRelayError =
    normalizedMessage.includes('walletconnect') ||
    normalizedMessage.includes('requestrelay') ||
    normalizedMessage.includes('websocket error 1006') ||
    normalizedMessage.includes('explorer-api.walletconnect.com') ||
    normalizedMessage.includes('relay.walletconnect.com');

  // Filter out hydration errors from Google Ads parameters and dynamic content
  const isHydrationError =
    normalizedMessage.includes('hydration') &&
    (normalizedMessage.includes("didn't match") ||
     normalizedMessage.includes('text content does not match') ||
     normalizedMessage.includes('there was an error while hydrating'));

  // Filter out "N+1 API Call" performance monitoring events
  // These are triggered by our intentional parallel model prefetch optimization
  const isN1ApiCall =
    event?.level === 'info' &&
    (normalizedMessage.includes('n+1 api call') ||
     (event?.message?.toLowerCase() || '').includes('n+1 api call'));

  // Filter out localStorage/sessionStorage access denied errors (browser privacy mode)
  const isStorageAccessDenied =
    (normalizedMessage.includes('localstorage') || normalizedMessage.includes('sessionstorage') || normalizedMessage.includes('local storage')) &&
    (normalizedMessage.includes('access is denied') || normalizedMessage.includes('access denied') || normalizedMessage.includes('not available') || normalizedMessage.includes('permission denied'));

  // Filter out Android WebView "Java object is gone" errors
  const isJavaObjectGone =
    normalizedMessage.includes('java object is gone') ||
    normalizedMessage.includes('javaobject');

  // Filter out Privy iframe errors (external auth provider)
  const isPrivyIframeError =
    (normalizedMessage.includes('iframe not initialized') || normalizedMessage.includes('origin not allowed')) &&
    normalizedMessage.includes('privy');

  // Filter out "Large HTTP payload" info events
  const isLargePayloadInfo =
    event?.level === 'info' &&
    (normalizedMessage.includes('large http payload') ||
     (event?.message?.toLowerCase() || '').includes('large http payload'));

  return isWalletExtensionError || isWalletConnectRelayError || isHydrationError || isN1ApiCall || isStorageAccessDenied || isJavaObjectGone || isPrivyIframeError || isLargePayloadInfo;
}

function shouldServerRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  cleanupServerStaleEntries();

  if (now - serverRateLimitState.windowStart > SERVER_RATE_LIMIT_CONFIG.windowMs) {
    serverRateLimitState.eventCount = 0;
    serverRateLimitState.windowStart = now;
  }

  if (serverRateLimitState.eventCount >= SERVER_RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry Server] Rate limit exceeded, dropping event');
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
  const lastSent = serverRateLimitState.recentMessages.get(messageKey);
  if (lastSent && now - lastSent < SERVER_RATE_LIMIT_CONFIG.dedupeWindowMs) {
    return true;
  }

  serverRateLimitState.eventCount++;
  serverRateLimitState.recentMessages.set(messageKey, now);
  return false;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

  // REDUCED: Sample only 1% of transactions to avoid rate limits
  tracesSampleRate: 0.01,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: 50,

  integrations: [
    // REMOVED: consoleLoggingIntegration was sending every console.log/warn/error to Sentry
    // This was a major source of 429 rate limit errors
    // Re-enable only for debugging: Sentry.consoleLoggingIntegration({ levels: ["error"] }),
  ],

  // DISABLED: enableLogs was causing excessive event volume
  enableLogs: false,

  // Filter out non-blocking errors FIRST, then apply rate limiting
  // This prevents filtered events from consuming rate limit quota
  beforeSend(event, hint) {
    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';

    // Filter BEFORE rate limiting to avoid wasting quota
    if (shouldFilterServerEvent(errorMessage, event)) {
      console.warn('[Sentry] Filtered out non-blocking wallet/extension error:', errorMessage);
      return null;
    }

    // Apply rate limiting only for events that pass filtering
    if (shouldServerRateLimit(event)) {
      return null;
    }

    return event;
  },
});
