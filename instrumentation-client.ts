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

  // Filter out Next.js hydration errors from Google Ads parameters and dynamic content
  // These errors occur when SSR HTML doesn't match CSR due to:
  // - Google Ads query parameters (gad_source, gad_campaignid, gclid)
  // - Dynamic timestamps, user-specific content, A/B testing, etc.
  // These are benign and non-blocking - the page still functions correctly
  // The mismatch gets resolved on the client side automatically
  const isHydrationError =
    errorMessageLower.includes('hydration') ||
    eventMessageLower.includes('hydration') ||
    errorMessageLower.includes("text content does not match server-rendered") ||
    errorMessageLower.includes("text content does not match") ||
    errorMessageLower.includes("there was an error while hydrating") ||
    errorMessageLower.includes("hydration error") ||
    eventMessageLower.includes("text content does not match server-rendered") ||
    eventMessageLower.includes("text content does not match") ||
    eventMessageLower.includes("there was an error while hydrating") ||
    eventMessageLower.includes("hydration error");

  if (isHydrationError) {
    console.debug('[Sentry] Filtered out hydration error (benign SSR/CSR mismatch from dynamic content)');
    return true;
  }

  // Filter out DOM manipulation race condition errors (removeChild, insertBefore)
  // These occur during React concurrent updates or when third-party scripts
  // (like Statsig, analytics, browser extensions) manipulate the DOM simultaneously with React
  // These are benign timing issues that don't affect functionality - React recovers automatically
  const isDOMManipulationError =
    (errorMessageLower.includes('removechild') ||
     errorMessageLower.includes('insertbefore') ||
     eventMessageLower.includes('removechild') ||
     eventMessageLower.includes('insertbefore')) &&
    (errorMessageLower.includes('not a child of this node') ||
     errorMessageLower.includes('failed to execute') ||
     eventMessageLower.includes('not a child of this node') ||
     eventMessageLower.includes('failed to execute'));

  if (isDOMManipulationError) {
    console.debug('[Sentry] Filtered out DOM manipulation race condition error (benign timing issue)');
    return true;
  }

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

  // Filter out "N+1 API Call" performance monitoring events
  // These are triggered by our intentional parallel model prefetch optimization
  // The prefetch hook makes 6 parallel requests to different gateways for performance
  // This is NOT a bug - it's a deliberate optimization pattern
  // Filter regardless of level since these can appear as info, warning, or unset
  if (
    errorMessageLower.includes('n+1') ||
    errorMessageLower.includes('n + 1') ||
    errorMessageLower.includes('n plus 1') ||
    eventMessageLower.includes('n+1') ||
    eventMessageLower.includes('n + 1') ||
    eventMessageLower.includes('n plus 1') ||
    (event.message?.toLowerCase() || '').includes('n+1') ||
    (event.message?.toLowerCase() || '').includes('n + 1')
  ) {
    console.debug('[Sentry] Filtered out N+1 API Call event (intentional parallel prefetch optimization)');
    return true;
  }

  // Filter out localStorage access denied errors (browser privacy mode / iframes)
  // These occur when users browse in private/incognito mode or when the site is in an iframe
  // with strict privacy settings. These are not application bugs.
  if (
    errorMessageLower.includes('localstorage') ||
    errorMessageLower.includes('local storage') ||
    errorMessageLower.includes('sessionstorage') ||
    eventMessageLower.includes('localstorage') ||
    eventMessageLower.includes('local storage') ||
    eventMessageLower.includes('sessionstorage')
  ) {
    if (
      errorMessageLower.includes('access is denied') ||
      errorMessageLower.includes('access denied') ||
      errorMessageLower.includes('not available') ||
      errorMessageLower.includes('permission denied') ||
      eventMessageLower.includes('access is denied') ||
      eventMessageLower.includes('access denied') ||
      eventMessageLower.includes('not available') ||
      eventMessageLower.includes('permission denied')
    ) {
      console.debug('[Sentry] Filtered out localStorage/sessionStorage access denied error (browser privacy mode)');
      return true;
    }
  }

  // Filter out "Java object is gone" errors (Android WebView)
  // These occur in Android WebView when Java bridge objects are garbage collected
  // This is an external browser behavior, not an application bug
  if (
    errorMessageLower.includes('java object is gone') ||
    errorMessageLower.includes('javaobject') ||
    eventMessageLower.includes('java object is gone') ||
    eventMessageLower.includes('javaobject')
  ) {
    console.debug('[Sentry] Filtered out Android WebView "Java object is gone" error (external browser behavior)');
    return true;
  }

  // Filter out Privy iframe errors (external authentication provider)
  // These are thrown by Privy's authentication iframe, not our application code
  if (
    errorMessageLower.includes('iframe not initialized') ||
    errorMessageLower.includes('origin not allowed') ||
    eventMessageLower.includes('iframe not initialized') ||
    eventMessageLower.includes('origin not allowed')
  ) {
    // Check if it's related to Privy
    const isPrivyError =
      errorMessageLower.includes('privy') ||
      eventMessageLower.includes('privy') ||
      stackFrames?.some(frame =>
        frame.filename?.includes('privy') ||
        frame.filename?.includes('auth.privy.io')
      );

    if (isPrivyError) {
      // Filter if it's definitely Privy
      console.debug('[Sentry] Filtered out Privy iframe initialization error (external auth provider)');
      return true;
    }
  }

  // Filter out Privy internal state management errors
  // These occur during Privy's internal state updates and are handled by their SDK
  const isPrivyInternalError =
    (errorMessageLower.includes('object not found matching id') &&
     errorMessageLower.includes('methodname') &&
     errorMessageLower.includes('update')) ||
    (errorMessageLower.includes('non-error promise rejection') &&
     errorMessageLower.includes('object not found')) ||
    (eventMessageLower.includes('object not found matching id') &&
     eventMessageLower.includes('methodname') &&
     eventMessageLower.includes('update')) ||
    (eventMessageLower.includes('non-error promise rejection') &&
     eventMessageLower.includes('object not found'));

  if (isPrivyInternalError) {
    console.debug('[Sentry] Filtered out Privy internal state management error (handled by Privy SDK)');
    return true;
  }

  // Filter out "Large HTTP payload" info events
  // These are monitoring/info level events that don't indicate errors
  if (
    event.level === 'info' &&
    (errorMessageLower.includes('large http payload') ||
     eventMessageLower.includes('large http payload') ||
     (event.message?.toLowerCase() || '').includes('large http payload'))
  ) {
    console.debug('[Sentry] Filtered out Large HTTP payload info event (monitoring only)');
    return true;
  }

  // Filter out generic "Load failed" TypeError from resource loading (but keep API errors)
  // These are usually from:
  // - CDN failures (temporary)
  // - Network issues (transient)
  // - Ad blockers (third-party)
  // - Browser extensions blocking resources
  // The browser automatically retries these, so they're not actionable
  // We KEEP API-related load failures as those indicate backend issues
  const isGenericLoadFailed =
    (errorMessage === 'Load failed' || eventMessage === 'Load failed') &&
    (event.exception?.values?.[0]?.type === 'TypeError' || !event.exception?.values?.[0]?.type);

  if (isGenericLoadFailed) {
    // Check if it's an API call - if so, don't filter (we want to see API failures)
    const isAPIError =
      errorMessageLower.includes('api') ||
      errorMessageLower.includes('/api/') ||
      eventMessageLower.includes('api') ||
      eventMessageLower.includes('/api/') ||
      stackFrames?.some(frame =>
        frame.filename?.includes('/api/') ||
        frame.filename?.includes('api.')
      );

    if (!isAPIError) {
      console.debug('[Sentry] Filtered out generic resource Load failed error (CDN/network/ad blocker)');
      return true;
    }
  }

  // Filter out cross-origin "Script error." messages
  // These occur when third-party scripts (Google Analytics, ads, etc.) loaded from
  // different origins throw errors without proper CORS headers
  // We cannot debug these as we don't have stack traces or error details
  const isScriptError =
    (errorMessage === 'Script error.' || errorMessage === 'Script error' ||
     eventMessage === 'Script error.' || eventMessage === 'Script error') &&
    (!stackFrames || stackFrames.length === 0);

  if (isScriptError) {
    console.debug('[Sentry] Filtered out cross-origin Script error (third-party script without CORS)');
    return true;
  }

  // Filter out generic "[GlobalError] Script error." messages from error handler
  // These are wrapped versions of cross-origin script errors from third-party scripts
  const isGlobalErrorScriptError =
    /^\[GlobalError\] Script error\.$/i.test(errorMessage) ||
    /^\[GlobalError\] Script error\.$/i.test(eventMessage);

  if (isGlobalErrorScriptError) {
    console.debug('[Sentry] Filtered out [GlobalError] Script error (third-party script)');
    return true;
  }

  // Filter out ChunkLoadError from deployments
  // These occur when a new deployment invalidates cached chunks while users have the page open
  // Users need to reload the page - this is expected behavior, not an application bug
  const isChunkLoadError =
    errorMessageLower.includes('chunkloaderror') ||
    errorMessageLower.includes('loading chunk') ||
    errorMessageLower.includes('loading css chunk') ||
    errorMessageLower.includes('failed to fetch dynamically imported module') ||
    eventMessageLower.includes('chunkloaderror') ||
    eventMessageLower.includes('loading chunk') ||
    eventMessageLower.includes('loading css chunk') ||
    eventMessageLower.includes('failed to fetch dynamically imported module');

  if (isChunkLoadError) {
    console.debug('[Sentry] Filtered out ChunkLoadError (deployment invalidated cached chunks, requires reload)');
    return true;
  }

  // Filter out IndexedDB errors from browser privacy modes or database cleanup
  // These occur when:
  // - Users browse in private/incognito mode (iOS Safari, Firefox)
  // - Browser privacy extensions clean up storage
  // - Database is deleted while operations are in progress
  // These are not application bugs and cannot be fixed in our code
  const isIndexedDBError =
    (errorMessageLower.includes('indexeddb') ||
     errorMessageLower.includes('idbdatabase') ||
     errorMessageLower.includes('createobjectstore') ||
     eventMessageLower.includes('indexeddb') ||
     eventMessageLower.includes('idbdatabase') ||
     eventMessageLower.includes('createobjectstore')) &&
    (errorMessageLower.includes('undefined') ||
     errorMessageLower.includes('closing') ||
     errorMessageLower.includes('not found') ||
     errorMessageLower.includes('invalidstateerror') ||
     eventMessageLower.includes('undefined') ||
     eventMessageLower.includes('closing') ||
     eventMessageLower.includes('not found') ||
     eventMessageLower.includes('invalidstateerror'));

  if (isIndexedDBError) {
    console.debug('[Sentry] Filtered out IndexedDB error (browser privacy mode or database cleanup)');
    return true;
  }

  // Filter out build/minification lexical declaration errors
  // These occur when minified code (variable names like 'tH', 'eR') has initialization issues
  // These are rare edge cases in the build process that:
  // - Are not reproducible
  // - Don't indicate actual code bugs
  // - Often resolve on page refresh
  const isBuildError =
    (errorMessageLower.includes("can't access lexical declaration") ||
     errorMessageLower.includes("cannot access") ||
     eventMessageLower.includes("can't access lexical declaration") ||
     eventMessageLower.includes("cannot access")) &&
    (errorMessageLower.includes('before initialization') ||
     eventMessageLower.includes('before initialization'));

  if (isBuildError) {
    console.debug('[Sentry] Filtered out build/minification lexical declaration error (transient edge case)');
    return true;
  }

  // Filter out Safari regex errors (browser compatibility)
  // Safari doesn't support certain regex features like named capture groups in some versions
  // This is a browser limitation, not an application bug
  const isSafariRegexError =
    (errorMessageLower.includes('invalid regular expression') ||
     eventMessageLower.includes('invalid regular expression')) &&
    (errorMessageLower.includes('invalid group specifier') ||
     errorMessageLower.includes('group specifier name') ||
     eventMessageLower.includes('invalid group specifier') ||
     eventMessageLower.includes('group specifier name'));

  if (isSafariRegexError) {
    console.debug('[Sentry] Filtered out Safari regex error (browser compatibility issue)');
    return true;
  }

  // Filter out Cross-Origin-Opener-Policy (COOP) errors
  // These are browser/extension compatibility check errors that don't affect functionality
  const isCOOPError =
    errorMessageLower.includes('cross-origin-opener-policy') ||
    errorMessageLower.includes('error checking cross-origin-opener-policy') ||
    eventMessageLower.includes('cross-origin-opener-policy') ||
    eventMessageLower.includes('error checking cross-origin-opener-policy');

  if (isCOOPError) {
    console.debug('[Sentry] Filtered out Cross-Origin-Opener-Policy error (browser compatibility check)');
    return true;
  }

  // Filter out Privy session timeout errors (external service)
  // These occur when the Privy authentication service times out
  // This is an external service issue, not an application bug
  const isPrivySessionTimeout =
    (errorMessageLower.includes('auth.privy.io') ||
     eventMessageLower.includes('auth.privy.io')) &&
    (errorMessageLower.includes('timeouterror') ||
     errorMessageLower.includes('timeout') ||
     errorMessageLower.includes('no response') ||
     eventMessageLower.includes('timeouterror') ||
     eventMessageLower.includes('timeout') ||
     eventMessageLower.includes('no response'));

  if (isPrivySessionTimeout) {
    console.debug('[Sentry] Filtered out Privy session timeout error (external service timeout)');
    return true;
  }

  // Filter out AbortError "signal is aborted without reason"
  // These occur when:
  // - Network requests are cancelled due to page navigation
  // - Users quickly switch between models/chats
  // - Timeout AbortControllers fire during normal operation
  // These are expected behaviors, not application bugs
  const isAbortError =
    (errorMessage.includes('AbortError') ||
     eventMessage.includes('AbortError') ||
     event.exception?.values?.[0]?.type === 'AbortError') &&
    (errorMessageLower.includes('signal is aborted') ||
     errorMessageLower.includes('aborted without reason') ||
     errorMessageLower.includes('user aborted') ||
     errorMessageLower.includes('the operation was aborted') ||
     eventMessageLower.includes('signal is aborted') ||
     eventMessageLower.includes('aborted without reason') ||
     eventMessageLower.includes('user aborted') ||
     eventMessageLower.includes('the operation was aborted'));

  if (isAbortError) {
    console.debug('[Sentry] Filtered out AbortError (expected cancellation behavior)');
    return true;
  }

  // Filter out AI SDK streaming errors
  // These occur when models complete without generating content or return lifecycle events
  // This is expected behavior for certain models/prompts, not an application error
  const isAISDKStreamingError =
    errorMessageLower.includes('no response received from model') ||
    errorMessageLower.includes('part types received') ||
    errorMessageLower.includes('streamingerror') ||
    errorMessageLower.includes('completed without generating any content') ||
    errorMessageLower.includes('may not be properly configured') ||
    errorMessageLower.includes('may not support') ||
    eventMessageLower.includes('no response received from model') ||
    eventMessageLower.includes('part types received') ||
    eventMessageLower.includes('streamingerror') ||
    eventMessageLower.includes('completed without generating any content') ||
    eventMessageLower.includes('may not be properly configured') ||
    eventMessageLower.includes('may not support');

  if (isAISDKStreamingError) {
    console.debug('[Sentry] Filtered out AI SDK streaming error (expected model behavior)');
    return true;
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

  // Sample 1% of transactions for performance monitoring (reduced from 10% to stay within quota)
  tracesSampleRate: 0.01,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Session replays - SIGNIFICANTLY REDUCED to stay within Sentry quota
  // Previous settings (100% errors + 10% sessions) caused 798% overage on replays quota
  replaysOnErrorSampleRate: 0.01,   // Capture replay for 1% of errors (reduced from 100%)
  replaysSessionSampleRate: 0,      // Disable session replays entirely (reduced from 10%)

  // Limit breadcrumbs to reduce payload size
  maxBreadcrumbs: RATE_LIMIT_CONFIG.maxBreadcrumbs,

  // Ignore errors from third-party scripts and browser extensions
  // NOTE: 'Script error' and 'Load failed' are NOT in this list because we have
  // nuanced filtering logic in beforeSend() that preserves important errors:
  // - Script errors WITH stack traces (may be from our code)
  // - Load failed errors related to API calls (backend issues we need to see)
  ignoreErrors: [
    // Chrome extensions
    'Extension context invalidated',
    'Extension ID',
    // Wallet extensions
    'removeListener',
    'stopListeners',
  ],

  // Deny URLs from third-party domains and browser extensions
  denyUrls: [
    // Browser extensions
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /extensions\//i,
    /^chrome:\/\//i,
    // Wallet extensions
    /inpage\.js/i,
    /contentscript\.js/i,
    /evmAsk\.js/i,
    // Google Analytics and Ads
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /doubleclick\.net/i,
    /googleads\.g\.doubleclick\.net/i,
    /stats\.g\.doubleclick\.net/i,
    /pagead\/js/i,
    // Other third-party analytics (specific CDN patterns to avoid filtering local integration files)
    /cdn\.statsig\.com/i,
    /statsig-sdk/i,
    /app\.posthog\.com/i,
    /posthog-js/i,
    // WalletConnect
    /walletconnect\.com/i,
    /walletconnect\.org/i,
  ],

  // Enable replay integration for session recordings
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Capture console.error() calls as actual Sentry events, not just breadcrumbs
    // This provides critical error context without the noise that caused 429s
    // Previous config captured ALL console levels and overwhelmed Sentry quota
    // Using captureConsoleIntegration instead of consoleIntegration to send as events
    Sentry.captureConsoleIntegration({
      levels: ['error'],  // Only error level, not 'log', 'info', 'warn', 'debug'
    }),
  ],

  // DISABLED: enableLogs was causing excessive event volume and consoleIntegration errors
  // The consoleIntegration API changed in Sentry SDK v10+ and was causing runtime errors
  // Re-enable only for debugging with proper integration: Sentry.consoleIntegration()
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
