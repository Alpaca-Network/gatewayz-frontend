import * as Sentry from "@sentry/nextjs";
import { initializeGlobalErrorHandlers } from "./src/lib/global-error-handlers";

// Get release information
const getRelease = () => {
  if (process.env.NEXT_PUBLIC_SENTRY_RELEASE) {
    return process.env.NEXT_PUBLIC_SENTRY_RELEASE;
  }

  if (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) {
    return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  }

  if (typeof window !== 'undefined') {
    const metaTag = document.querySelector('meta[property="sentry:release"]');
    if (metaTag) {
      return metaTag.getAttribute('content') || undefined;
    }
  }

  return undefined;
};

// =============================================================================
// RATE LIMITING CONFIGURATION
// Prevents 429 errors from Sentry by limiting event frequency
// =============================================================================

// Rate limiting state
const rateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(), // message hash -> last sent timestamp
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 30,        // Max events per minute (Sentry's limit is ~60/min)
  windowMs: 60000,               // 1 minute window
  dedupeWindowMs: 10000,         // Don't send same message within 10 seconds
  maxBreadcrumbs: 50,            // Limit breadcrumbs to reduce payload size
};

/**
 * Check if we should rate limit this event
 * Returns true if the event should be dropped
 */
function shouldRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - rateLimitState.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitState.eventCount = 0;
    rateLimitState.windowStart = now;
    // Clean up old deduplication entries
    for (const [key, timestamp] of rateLimitState.recentMessages) {
      if (now - timestamp > RATE_LIMIT_CONFIG.dedupeWindowMs) {
        rateLimitState.recentMessages.delete(key);
      }
    }
  }

  // Check rate limit
  if (rateLimitState.eventCount >= RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry] Rate limit exceeded, dropping event');
    return true;
  }

  // Deduplication check - create a simple hash of the event
  const messageKey = createEventKey(event);
  const lastSent = rateLimitState.recentMessages.get(messageKey);
  if (lastSent && now - lastSent < RATE_LIMIT_CONFIG.dedupeWindowMs) {
    console.debug('[Sentry] Duplicate event within deduplication window, dropping');
    return true;
  }

  // Update state
  rateLimitState.eventCount++;
  rateLimitState.recentMessages.set(messageKey, now);

  return false;
}

/**
 * Create a unique key for deduplication
 */
function createEventKey(event: Sentry.ErrorEvent): string {
  const message = event.message ||
    event.exception?.values?.[0]?.value ||
    event.exception?.values?.[0]?.type ||
    'unknown';
  const type = event.exception?.values?.[0]?.type || 'message';
  return `${type}:${message.slice(0, 100)}`;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

  // REDUCED: Sample only 10% of transactions to avoid rate limits
  // Increase to 0.5 or 1.0 only for debugging specific issues
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // REDUCED: Only capture replays on errors, not all sessions
  replaysOnErrorSampleRate: 0.5,  // Reduced from 1.0
  replaysSessionSampleRate: 0.05, // Reduced from 0.1

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: RATE_LIMIT_CONFIG.maxBreadcrumbs,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    // REMOVED: consoleLoggingIntegration was sending every console.log/warn/error to Sentry
    // This was a major source of 429 rate limit errors
    // Re-enable only for debugging: Sentry.consoleLoggingIntegration({ levels: ["error"] }),
  ],

  // DISABLED: enableLogs was causing excessive event volume
  // Re-enable only for debugging specific issues
  enableLogs: false,

  // Filter out non-blocking wallet extension errors from Privy AND apply rate limiting
  beforeSend(event, hint) {
    // Apply rate limiting first
    if (shouldRateLimit(event)) {
      return null;
    }

    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
    const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

    // Filter out chrome.runtime.sendMessage errors from Privy wallet provider (inpage.js)
    // These are non-blocking and occur when Privy tries to detect wallet extensions
    if (
      errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('runtime.sendMessage') ||
      (errorMessage.includes('Extension ID') && errorMessage.includes('from a webpage'))
    ) {
      // Check if error originates from Privy's inpage.js or wallet provider code
      if (stackFrames?.some(frame =>
        frame.filename?.includes('inpage.js') ||
        frame.filename?.includes('privy') ||
        frame.function?.includes('Zt') // Minified function name from inpage.js
      )) {
        console.warn('[Sentry] Filtered out non-blocking Privy wallet extension error:', errorMessage);
        return null; // Don't send this error to Sentry
      }
    }

    // Filter out wallet extension removeListener errors (JAVASCRIPT-NEXTJS-2)
    // These occur when wallet extensions (MetaMask, Phantom, etc.) clean up listeners
    if (errorMessage.includes('removeListener') || errorMessage.includes('stopListeners')) {
      if (stackFrames?.some(frame =>
        frame.filename?.includes('inpage.js') ||
        frame.filename?.includes('app:///') ||
        frame.function?.includes('stopListeners')
      )) {
        console.warn('[Sentry] Filtered out wallet extension removeListener error');
        return null;
      }
    }

    return event;
  },
});

// Initialize global error handlers after Sentry is configured
if (typeof window !== 'undefined') {
  initializeGlobalErrorHandlers();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
