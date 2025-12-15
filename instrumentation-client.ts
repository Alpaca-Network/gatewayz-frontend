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

// Rate limiting state for error events
const rateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentMessages: new Map<string, number>(), // message hash -> last sent timestamp
  lastCleanup: Date.now(), // Track last cleanup to prevent unbounded growth
};

// Separate rate limiting state for transactions
const transactionRateLimitState = {
  eventCount: 0,
  windowStart: Date.now(),
  recentTransactions: new Map<string, number>(), // transaction name -> last sent timestamp
  lastCleanup: Date.now(),
};

// Rate limiting configuration - balanced for better error visibility
const RATE_LIMIT_CONFIG = {
  maxEventsPerMinute: 10,        // INCREASED: Allow 10 events per minute for better visibility
  windowMs: 60000,               // 1 minute window
  dedupeWindowMs: 60000,         // REDUCED: Don't send same message within 1 minute
  maxBreadcrumbs: 20,            // INCREASED: More breadcrumbs for better debugging context
  cleanupIntervalMs: 30000,      // Cleanup stale entries every 30 seconds
  maxMapSize: 50,                // Maximum entries in deduplication map
  // Transaction-specific limits
  maxTransactionsPerMinute: 10,  // INCREASED: Allow more transactions
  transactionDedupeWindowMs: 30000, // REDUCED: 30 seconds for transaction deduplication
  // Backoff configuration for when we detect 429 errors
  backoffMultiplier: 2,          // Double the wait time after each 429
  maxBackoffMs: 300000,          // Maximum backoff of 5 minutes
  initialBackoffMs: 60000,       // Start with 1 minute backoff after 429
};

// Track 429 backoff state
const backoffState = {
  inBackoff: false,
  backoffUntil: 0,
  currentBackoffMs: RATE_LIMIT_CONFIG.initialBackoffMs,
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
 * Create a unique key for error event deduplication
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
 * Transaction event interface for type safety
 * Using custom interface since Sentry's TransactionEvent isn't exported in newer versions
 */
interface TransactionEventLike {
  transaction?: string;
  contexts?: {
    trace?: {
      op?: string;
    };
  };
}

/**
 * Create a unique key for transaction deduplication
 * Uses transaction name instead of error message
 */
function createTransactionKey(event: TransactionEventLike): string {
  // Use the transaction name as the key
  const transactionName = event.transaction || 'unknown';
  const op = event.contexts?.trace?.op || 'unknown-op';
  return `txn:${op}:${transactionName.slice(0, 100)}`;
}

/**
 * Check if event should be filtered out (wallet errors, etc.)
 * Called BEFORE rate limiting to avoid wasting quota on filtered events
 */
function shouldFilterEvent(event: Sentry.ErrorEvent, hint: Sentry.EventHint): boolean {
  const error = hint.originalException;
  const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const eventMessage = event.message || '';
  const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

  // Filter out "message port closed" errors from Chrome extensions
  // These are benign browser extension communication errors that occur when:
  // - An extension's background page/service worker is unloaded
  // - Communication between content script and background script is interrupted
  // - Extensions like password managers, ad blockers, etc. disconnect
  // These errors are NOT from our application code and are completely harmless
  const errorMessageLower = errorMessage.toLowerCase();
  const eventMessageLower = eventMessage.toLowerCase();
  if (
    errorMessageLower.includes('message port closed') ||
    errorMessageLower.includes('the message port closed before a response was received') ||
    eventMessageLower.includes('message port closed') ||
    eventMessageLower.includes('the message port closed before a response was received')
  ) {
    console.debug('[Sentry] Filtered out Chrome extension "message port closed" error (benign browser behavior)');
    return true;
  }

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
      console.debug('[Sentry] Filtered out non-blocking Privy wallet extension error');
      return true;
    }
  }

  // Filter out wallet extension removeListener errors
  // These errors occur when wallet extensions (MetaMask, etc.) are unloading
  // and are completely harmless - they don't affect functionality
  if (
    errorMessage.includes('removeListener') ||
    errorMessage.includes('stopListeners') ||
    eventMessage.includes('removeListener') ||
    eventMessage.includes('stopListeners') ||
    (errorMessage.includes('Cannot read properties of undefined') && errorMessage.includes('removeListener'))
  ) {
    // Filter regardless of stack frame since these are always from extensions
    console.debug('[Sentry] Filtered out wallet extension removeListener error');
    return true;
  }

  // NOTE: "Pending prompt timed out" errors are now captured (not filtered)
  // These are important for debugging UI timeout issues

  // Filter out WalletConnect relay errors (non-critical)
  if (
    errorMessageLower.includes('walletconnect') ||
    errorMessageLower.includes('relay.walletconnect.com') ||
    errorMessageLower.includes('websocket error 1006') ||
    errorMessageLower.includes('explorer-api.walletconnect')
  ) {
    console.debug('[Sentry] Filtered out non-critical WalletConnect relay error');
    return true;
  }

  // NOTE: Next.js hydration errors are now captured (not filtered)
  // These are important for debugging SSR/hydration mismatches

  // Filter out 429 rate limit errors from monitoring/telemetry endpoints
  // These create a cascade: Sentry tries to report 429 errors, which causes more 429s
  if (
    errorMessageLower.includes('429') ||
    errorMessageLower.includes('too many requests') ||
    eventMessageLower.includes('429') ||
    eventMessageLower.includes('too many requests')
  ) {
    // Check if it's related to monitoring/telemetry endpoints
    const isMonitoringError =
      errorMessageLower.includes('/monitoring') ||
      errorMessageLower.includes('sentry') ||
      errorMessageLower.includes('telemetry') ||
      eventMessageLower.includes('/monitoring') ||
      eventMessageLower.includes('sentry') ||
      eventMessageLower.includes('telemetry') ||
      // Check request URL in breadcrumbs or stack frames
      stackFrames?.some(frame =>
        frame.filename?.includes('/monitoring') ||
        frame.filename?.includes('sentry')
      );

    if (isMonitoringError) {
      // Trigger backoff mode when we detect a 429 from our own monitoring
      enterBackoffMode();
      console.debug('[Sentry] Filtered out 429 rate limit error from monitoring endpoint (prevents cascade)');
      return true;
    }
  }

  // Filter out network errors related to monitoring/telemetry
  // These are non-critical and can cause cascading errors
  if (
    errorMessageLower.includes('failed to fetch') ||
    errorMessageLower.includes('network error') ||
    errorMessageLower.includes('networkerror')
  ) {
    // Check if the error is related to monitoring/telemetry endpoints
    // Use lowercase for consistent case-insensitive matching
    const isMonitoringNetworkError =
      errorMessageLower.includes('/monitoring') ||
      errorMessageLower.includes('sentry.io') ||
      errorMessageLower.includes('telemetry') ||
      eventMessageLower.includes('/monitoring') ||
      eventMessageLower.includes('sentry.io') ||
      eventMessageLower.includes('telemetry');

    if (isMonitoringNetworkError) {
      console.debug('[Sentry] Filtered out network error from monitoring/Sentry endpoint');
      return true;
    }
  }

  return false;
}

/**
 * Enter backoff mode after receiving a 429 error
 * Called when we detect a rate limit error
 */
function enterBackoffMode(): void {
  const now = Date.now();
  backoffState.inBackoff = true;

  // Store the actual backoff duration for logging before updating currentBackoffMs
  const actualBackoffMs = backoffState.currentBackoffMs;
  backoffState.backoffUntil = now + actualBackoffMs;

  // Increase backoff for next time (exponential backoff)
  backoffState.currentBackoffMs = Math.min(
    backoffState.currentBackoffMs * RATE_LIMIT_CONFIG.backoffMultiplier,
    RATE_LIMIT_CONFIG.maxBackoffMs
  );

  console.warn(`[Sentry] Entering backoff mode for ${actualBackoffMs / 1000}s due to rate limiting`);
}

/**
 * Check if we're currently in backoff mode
 * Returns true if we should drop events
 */
function isInBackoff(): boolean {
  if (!backoffState.inBackoff) {
    return false;
  }

  const now = Date.now();
  if (now >= backoffState.backoffUntil) {
    // Backoff period expired, reset
    backoffState.inBackoff = false;
    // Reduce backoff time for next occurrence (gradual recovery)
    backoffState.currentBackoffMs = Math.max(
      backoffState.currentBackoffMs / RATE_LIMIT_CONFIG.backoffMultiplier,
      RATE_LIMIT_CONFIG.initialBackoffMs
    );
    console.debug('[Sentry] Backoff period ended, resuming normal operation');
    return false;
  }

  return true;
}

/**
 * Check if we should rate limit this error event
 * Returns true if the event should be dropped
 * Note: Only call this AFTER shouldFilterEvent returns false
 */
function shouldRateLimit(event: Sentry.ErrorEvent): boolean {
  const now = Date.now();

  // Check if we're in backoff mode first (highest priority)
  if (isInBackoff()) {
    console.debug('[Sentry] In backoff mode, dropping event');
    return true;
  }

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

/**
 * Cleanup stale transaction entries
 */
function cleanupStaleTransactionEntries(): void {
  const now = Date.now();

  // Only cleanup if enough time has passed
  if (now - transactionRateLimitState.lastCleanup < RATE_LIMIT_CONFIG.cleanupIntervalMs) {
    return;
  }

  transactionRateLimitState.lastCleanup = now;

  // Remove entries older than dedupeWindowMs
  for (const [key, timestamp] of transactionRateLimitState.recentTransactions) {
    if (now - timestamp > RATE_LIMIT_CONFIG.transactionDedupeWindowMs) {
      transactionRateLimitState.recentTransactions.delete(key);
    }
  }

  // If still too large, remove oldest entries
  if (transactionRateLimitState.recentTransactions.size > RATE_LIMIT_CONFIG.maxMapSize) {
    const entries = Array.from(transactionRateLimitState.recentTransactions.entries())
      .sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - RATE_LIMIT_CONFIG.maxMapSize);
    for (const [key] of toRemove) {
      transactionRateLimitState.recentTransactions.delete(key);
    }
  }
}

/**
 * Check if we should rate limit this transaction
 * Returns true if the transaction should be dropped
 */
function shouldRateLimitTransaction(event: TransactionEventLike): boolean {
  const now = Date.now();

  // Check if we're in backoff mode first (highest priority)
  // Transactions also respect backoff to reduce overall load
  if (isInBackoff()) {
    console.debug('[Sentry] In backoff mode, dropping transaction');
    return true;
  }

  // Periodic cleanup to prevent unbounded memory growth
  cleanupStaleTransactionEntries();

  // Reset window if expired
  if (now - transactionRateLimitState.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    transactionRateLimitState.eventCount = 0;
    transactionRateLimitState.windowStart = now;
  }

  // Check rate limit
  if (transactionRateLimitState.eventCount >= RATE_LIMIT_CONFIG.maxTransactionsPerMinute) {
    console.warn('[Sentry] Transaction rate limit exceeded, dropping transaction');
    return true;
  }

  // Deduplication check using transaction-specific key
  const transactionKey = createTransactionKey(event);
  const lastSent = transactionRateLimitState.recentTransactions.get(transactionKey);
  if (lastSent && now - lastSent < RATE_LIMIT_CONFIG.transactionDedupeWindowMs) {
    console.debug('[Sentry] Duplicate transaction within deduplication window, dropping');
    return true;
  }

  // Update state only for transactions that will be sent
  transactionRateLimitState.eventCount++;
  transactionRateLimitState.recentTransactions.set(transactionKey, now);

  return false;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

  // Sample 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable session replays for better error debugging
  replaysOnErrorSampleRate: 1,    // Capture replay for 100% of errors
  replaysSessionSampleRate: 0.1,  // Capture 10% of sessions (balances cost/privacy with debugging)

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: RATE_LIMIT_CONFIG.maxBreadcrumbs,

  // Enable replay integration for session recordings
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Enable console logging integration for error-level logs
  enableLogs: true,

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

  // Also rate limit transactions to prevent 429s
  beforeSendTransaction(event) {
    // Apply transaction-specific rate limiting (uses transaction name, not error message)
    if (shouldRateLimitTransaction(event)) {
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
