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
  lastCleanup: Date.now(), // Track last cleanup to prevent unbounded growth
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 20,        // Max events per minute (reduced to avoid 429s)
  windowMs: 60000,               // 1 minute window
  dedupeWindowMs: 30000,         // Don't send same message within 30 seconds (increased)
  maxBreadcrumbs: 30,            // Limit breadcrumbs to reduce payload size
  cleanupIntervalMs: 30000,      // Cleanup stale entries every 30 seconds
  maxMapSize: 50,                // Maximum entries in deduplication map
};

/**
 * Cleanup stale entries from the deduplication map
 * Called periodically to prevent unbounded memory growth
 */
function cleanupStaleEntries(): void {
  const now = Date.now();

  // Only cleanup if enough time has passed
  if (now - rateLimitState.lastCleanup < RATE_LIMIT_CONFIG.cleanupIntervalMs) {
    return;
  }

  rateLimitState.lastCleanup = now;

  // Remove entries older than dedupeWindowMs
  for (const [key, timestamp] of rateLimitState.recentMessages) {
    if (now - timestamp > RATE_LIMIT_CONFIG.dedupeWindowMs) {
      rateLimitState.recentMessages.delete(key);
    }
  }

  // If still too large, remove oldest entries
  if (rateLimitState.recentMessages.size > RATE_LIMIT_CONFIG.maxMapSize) {
    const entries = Array.from(rateLimitState.recentMessages.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp ascending
    const toRemove = entries.slice(0, entries.length - RATE_LIMIT_CONFIG.maxMapSize);
    for (const [key] of toRemove) {
      rateLimitState.recentMessages.delete(key);
    }
  }
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

/**
 * Check if event should be filtered out (wallet errors, etc.)
 * Called BEFORE rate limiting to avoid wasting quota on filtered events
 */
function shouldFilterEvent(event: Sentry.ErrorEvent, hint: Sentry.EventHint): boolean {
  const error = hint.originalException;
  const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

  // Filter out chrome.runtime.sendMessage errors from Privy wallet provider (inpage.js)
  if (
    errorMessage.includes('chrome.runtime.sendMessage') ||
    errorMessage.includes('runtime.sendMessage') ||
    (errorMessage.includes('Extension ID') && errorMessage.includes('from a webpage'))
  ) {
    if (stackFrames?.some(frame =>
      frame.filename?.includes('inpage.js') ||
      frame.filename?.includes('privy') ||
      frame.function?.includes('Zt')
    )) {
      console.warn('[Sentry] Filtered out non-blocking Privy wallet extension error:', errorMessage);
      return true;
    }
  }

  // Filter out wallet extension removeListener errors
  if (errorMessage.includes('removeListener') || errorMessage.includes('stopListeners')) {
    if (stackFrames?.some(frame =>
      frame.filename?.includes('inpage.js') ||
      frame.filename?.includes('app:///') ||
      frame.function?.includes('stopListeners')
    )) {
      console.warn('[Sentry] Filtered out wallet extension removeListener error');
      return true;
    }
  }

  return false;
}

/**
 * Check if we should rate limit this event
 * Returns true if the event should be dropped
 * Note: Only call this AFTER shouldFilterEvent returns false
 */
function shouldRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  cleanupStaleEntries();

  // Reset window if expired
  if (now - rateLimitState.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitState.eventCount = 0;
    rateLimitState.windowStart = now;
  }

  // Check rate limit
  if (rateLimitState.eventCount >= RATE_LIMIT_CONFIG.maxEventsPerMinute) {
    console.warn('[Sentry] Rate limit exceeded, dropping event');
    return true;
  }

  // Deduplication check
  const messageKey = createEventKey(event);
  const lastSent = rateLimitState.recentMessages.get(messageKey);
  if (lastSent && now - lastSent < RATE_LIMIT_CONFIG.dedupeWindowMs) {
    console.debug('[Sentry] Duplicate event within deduplication window, dropping');
    return true;
  }

  // Update state only for events that will be sent
  rateLimitState.eventCount++;
  rateLimitState.recentMessages.set(messageKey, now);

  return false;
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

  // REDUCED: Only capture replays on errors, disable session replays to reduce 429s
  // Session replays send continuous data which contributes to rate limiting
  replaysOnErrorSampleRate: 0.1,  // Reduced from 0.5 - only 10% of error sessions
  replaysSessionSampleRate: 0,    // Disabled - was causing too many requests

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

  // Filter out non-blocking errors FIRST, then apply rate limiting
  // This prevents filtered events from consuming rate limit quota
  beforeSend(event, hint) {
    // Filter out wallet errors BEFORE rate limiting to avoid wasting quota
    if (shouldFilterEvent(event, hint)) {
      return null;
    }

    // Apply rate limiting only for events that pass filtering
    if (shouldRateLimit(event)) {
      return null;
    }

    return event;
  },
});

// Initialize global error handlers after Sentry is configured
if (typeof window !== 'undefined') {
  initializeGlobalErrorHandlers();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
