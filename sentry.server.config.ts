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
};

const SERVER_RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 50,  // Server can handle slightly more
  windowMs: 60000,
  dedupeWindowMs: 5000,    // Shorter dedupe window on server
};

function shouldServerRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  if (now - serverRateLimitState.windowStart > SERVER_RATE_LIMIT_CONFIG.windowMs) {
    serverRateLimitState.eventCount = 0;
    serverRateLimitState.windowStart = now;
    for (const [key, timestamp] of serverRateLimitState.recentMessages) {
      if (now - timestamp > SERVER_RATE_LIMIT_CONFIG.dedupeWindowMs) {
        serverRateLimitState.recentMessages.delete(key);
      }
    }
  }

  if (serverRateLimitState.eventCount >= SERVER_RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry Server] Rate limit exceeded, dropping event');
    return true;
  }

  const messageKey = event.message ||
    event.exception?.values?.[0]?.value ||
    'unknown';
  const lastSent = serverRateLimitState.recentMessages.get(messageKey.slice(0, 100));
  if (lastSent && now - lastSent < SERVER_RATE_LIMIT_CONFIG.dedupeWindowMs) {
    return true;
  }

  serverRateLimitState.eventCount++;
  serverRateLimitState.recentMessages.set(messageKey.slice(0, 100), now);
  return false;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

  // REDUCED: Sample only 10% of transactions to avoid rate limits
  tracesSampleRate: 0.1,

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

  // Filter out non-blocking wallet extension errors from Privy AND apply rate limiting
  beforeSend(event, hint) {
    // Apply rate limiting first
    if (shouldServerRateLimit(event)) {
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
