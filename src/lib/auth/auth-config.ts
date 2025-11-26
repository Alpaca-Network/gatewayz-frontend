/**
 * Auth Configuration
 *
 * Centralized configuration for all auth-related timeouts, retries, and settings.
 * This is the SINGLE SOURCE OF TRUTH for auth timing parameters.
 */

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

/**
 * All timeout values in milliseconds.
 * These are carefully calibrated to work together.
 */
export const AUTH_TIMEOUTS = {
  /**
   * Time to wait for Privy token retrieval.
   * This can be slow on first login or slow networks.
   */
  TOKEN_RETRIEVAL: 10_000, // 10 seconds

  /**
   * Time to wait for backend sync per attempt.
   * Backend may need time to create user, validate token, etc.
   */
  BACKEND_SYNC_PER_ATTEMPT: 15_000, // 15 seconds

  /**
   * Safety buffer added to calculated timeouts.
   * Accounts for network jitter and processing delays.
   */
  SAFETY_BUFFER: 5_000, // 5 seconds

  /**
   * Maximum total time for the entire auth flow.
   * Calculated as: (BACKEND_SYNC_PER_ATTEMPT * MAX_RETRIES) + backoff + buffer
   * = (15s * 3) + ~3s backoff + 5s buffer = ~53s, rounded to 60s
   */
  TOTAL_AUTH_FLOW: 60_000, // 60 seconds

  /**
   * Time to wait for auth refresh operation.
   * Should be faster than initial auth since user data exists.
   */
  REFRESH: 15_000, // 15 seconds

  /**
   * Delay before auto-retry after recoverable error.
   */
  AUTO_RETRY_DELAY: 1_000, // 1 second
} as const;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

export const AUTH_RETRIES = {
  /**
   * Maximum retry attempts for backend sync.
   * Total attempts = 1 initial + MAX_RETRIES retries
   */
  MAX_BACKEND_SYNC: 2, // 3 total attempts

  /**
   * Maximum retry attempts for token retrieval.
   */
  MAX_TOKEN_RETRIEVAL: 2, // 3 total attempts

  /**
   * HTTP status codes that should trigger a retry.
   */
  RETRYABLE_STATUS_CODES: [502, 503, 504] as const,

  /**
   * Backoff configuration for retries.
   * Uses exponential backoff with jitter.
   */
  BACKOFF: {
    INITIAL_DELAY: 500,    // 500ms
    MAX_DELAY: 5_000,      // 5 seconds
    MULTIPLIER: 2,
    JITTER: 0.1,           // 10% jitter
  },
} as const;

// =============================================================================
// NETWORK-ADAPTIVE TIMEOUTS
// =============================================================================

export type NetworkCondition = 'fast' | 'moderate' | 'slow' | 'very_slow';

/**
 * Timeout multipliers based on network conditions.
 * Applied to base timeouts for slower networks.
 */
export const NETWORK_MULTIPLIERS: Record<NetworkCondition, number> = {
  fast: 1.0,
  moderate: 1.5,
  slow: 2.0,
  very_slow: 3.0,
};

/**
 * Detect network condition based on connection API.
 * Falls back to 'moderate' if not available.
 */
export function detectNetworkCondition(): NetworkCondition {
  if (typeof navigator === 'undefined') return 'moderate';

  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
  }).connection;

  if (!connection) return 'moderate';

  // Data saver mode = treat as slow
  if (connection.saveData) return 'slow';

  // Use effective connection type if available
  const effectiveType = connection.effectiveType;
  if (effectiveType) {
    switch (effectiveType) {
      case '4g':
        return 'fast';
      case '3g':
        return 'moderate';
      case '2g':
        return 'slow';
      case 'slow-2g':
        return 'very_slow';
      default:
        return 'moderate';
    }
  }

  // Fall back to downlink speed
  const downlink = connection.downlink;
  if (downlink !== undefined) {
    if (downlink >= 10) return 'fast';
    if (downlink >= 1.5) return 'moderate';
    if (downlink >= 0.5) return 'slow';
    return 'very_slow';
  }

  return 'moderate';
}

/**
 * Get adaptive timeout based on current network conditions.
 */
export function getAdaptiveTimeout(baseTimeout: number): number {
  const condition = detectNetworkCondition();
  const multiplier = NETWORK_MULTIPLIERS[condition];
  return Math.floor(baseTimeout * multiplier);
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const AUTH_STORAGE_KEYS = {
  API_KEY: 'gatewayz_api_key',
  USER_DATA: 'gatewayz_user_data',
  REFERRAL_CODE: 'gatewayz_referral_code',
  SESSION_TRANSFER_TOKEN: 'gatewayz_session_transfer_token',
} as const;

// =============================================================================
// EVENT NAMES
// =============================================================================

export const AUTH_EVENTS = {
  REFRESH_REQUEST: 'gatewayz:refresh-auth',
  REFRESH_COMPLETE: 'gatewayz:refresh-complete',
  NEW_USER_WELCOME: 'gatewayz:new-user-welcome',
  LOGOUT: 'gatewayz:logout',
  STATE_CHANGE: 'gatewayz:auth-state-change',
} as const;

// =============================================================================
// API ENDPOINTS
// =============================================================================

export const AUTH_ENDPOINTS = {
  AUTH: '/api/auth',
  REFRESH: '/api/auth/refresh',
  INVALIDATE: '/api/auth/invalidate',
  USER: '/api/user',
} as const;

// =============================================================================
// HELPER: Calculate total possible auth time
// =============================================================================

/**
 * Calculate the maximum time the auth flow could take with all retries.
 * Used to set appropriate timeouts and show accurate loading states.
 */
export function calculateMaxAuthTime(): number {
  const attempts = AUTH_RETRIES.MAX_BACKEND_SYNC + 1; // initial + retries
  const perAttempt = AUTH_TIMEOUTS.BACKEND_SYNC_PER_ATTEMPT;

  // Calculate total backoff time
  let totalBackoff = 0;
  let delay: number = AUTH_RETRIES.BACKOFF.INITIAL_DELAY;
  for (let i = 0; i < AUTH_RETRIES.MAX_BACKEND_SYNC; i++) {
    totalBackoff += delay;
    delay = Math.min(delay * AUTH_RETRIES.BACKOFF.MULTIPLIER, AUTH_RETRIES.BACKOFF.MAX_DELAY) as number;
  }

  return (attempts * perAttempt) + totalBackoff + AUTH_TIMEOUTS.SAFETY_BUFFER;
}

// =============================================================================
// HELPER: Exponential backoff with jitter
// =============================================================================

/**
 * Calculate backoff delay for a given retry attempt.
 * Uses exponential backoff with jitter to prevent thundering herd.
 */
export function calculateBackoff(attempt: number): number {
  const { INITIAL_DELAY, MAX_DELAY, MULTIPLIER, JITTER } = AUTH_RETRIES.BACKOFF;

  // Exponential backoff
  const exponentialDelay = INITIAL_DELAY * Math.pow(MULTIPLIER, attempt);
  const cappedDelay = Math.min(exponentialDelay, MAX_DELAY);

  // Add jitter (random variation)
  const jitterRange = cappedDelay * JITTER;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // -jitter to +jitter

  return Math.floor(cappedDelay + jitter);
}
