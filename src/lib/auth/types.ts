/**
 * Auth Module Type Definitions
 *
 * Centralized type definitions for the authentication system.
 * These types define the contract between auth components.
 */

// =============================================================================
// AUTH STATES
// =============================================================================

/**
 * All possible authentication states.
 * The auth system is modeled as a state machine with these states.
 */
export type AuthState =
  | 'idle'           // Initial state, checking for cached credentials
  | 'unauthenticated' // No valid credentials, user needs to log in
  | 'authenticating' // Privy login in progress
  | 'syncing'        // Privy auth succeeded, syncing with backend
  | 'authenticated'  // Fully authenticated with valid API key
  | 'error'          // Auth failed with an error
  | 'refreshing';    // Refreshing credentials (e.g., after 401)

/**
 * Auth state with associated data
 */
export type AuthStateData =
  | { state: 'idle' }
  | { state: 'unauthenticated'; reason?: string }
  | { state: 'authenticating'; method: AuthMethod }
  | { state: 'syncing'; privyUserId: string }
  | { state: 'authenticated'; user: AuthenticatedUser }
  | { state: 'error'; error: AuthError; retryable: boolean }
  | { state: 'refreshing'; previousState: 'authenticated' };

// =============================================================================
// USER TYPES
// =============================================================================

export type UserTier = 'basic' | 'pro' | 'max';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive' | 'trial' | 'expired';
export type AuthMethod = 'email' | 'google' | 'github' | 'wallet' | 'session_transfer';

/**
 * User data returned from backend after successful authentication
 */
export interface AuthenticatedUser {
  userId: number;
  privyUserId: string;
  apiKey: string;
  email: string;
  displayName: string;
  credits: number;
  tier: UserTier;
  tierDisplayName?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEndDate?: number; // Unix timestamp
  isNewUser: boolean;
  authMethod: AuthMethod;
}

/**
 * Minimal user data stored in localStorage
 */
export interface StoredUserData {
  user_id: number;
  api_key: string;
  auth_method: string;
  privy_user_id: string;
  display_name: string;
  email: string;
  credits: number;
  tier?: UserTier;
  tier_display_name?: string;
  subscription_status?: SubscriptionStatus;
  subscription_end_date?: number;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export type AuthErrorCode =
  | 'NETWORK_ERROR'       // Network request failed
  | 'TIMEOUT'             // Request timed out
  | 'INVALID_TOKEN'       // Privy token invalid/expired
  | 'BACKEND_ERROR'       // Backend returned error
  | 'RATE_LIMITED'        // Too many requests (429)
  | 'SESSION_EXPIRED'     // API key no longer valid (401)
  | 'UNKNOWN';            // Unexpected error

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// =============================================================================
// AUTH EVENTS
// =============================================================================

/**
 * Events that can trigger state transitions
 */
export type AuthEvent =
  | { type: 'LOGIN_START'; method: AuthMethod }
  | { type: 'PRIVY_SUCCESS'; privyUserId: string; token: string | null }
  | { type: 'PRIVY_ERROR'; error: Error }
  | { type: 'SYNC_SUCCESS'; user: AuthenticatedUser }
  | { type: 'SYNC_ERROR'; error: AuthError }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; user: AuthenticatedUser }
  | { type: 'REFRESH_ERROR'; error: AuthError }
  | { type: 'SESSION_RESTORED'; user: AuthenticatedUser }
  | { type: 'SESSION_INVALID' }
  | { type: 'RESET' };

// =============================================================================
// AUTH CONTEXT TYPES
// =============================================================================

/**
 * The public API exposed by the auth context
 */
export interface AuthContextValue {
  // State
  state: AuthState;
  user: AuthenticatedUser | null;
  error: AuthError | null;

  // Computed
  isAuthenticated: boolean;
  isLoading: boolean;
  apiKey: string | null;

  // Actions
  login: (method?: AuthMethod) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// BACKEND API TYPES
// =============================================================================

/**
 * Request body for /api/auth endpoint
 */
export interface AuthRequestBody {
  user: {
    privy_user_id: string;
    email?: string | null;
    wallet_address?: string | null;
    google_email?: string | null;
    github_username?: string | null;
    linked_accounts?: Array<{
      type: string;
      [key: string]: unknown;
    }>;
  };
  token: string | null;
  privy_user_id: string;
  auth_method: string;
  referral_code?: string | null;
}

/**
 * Response from /api/auth endpoint
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  user_id: number;
  api_key: string;
  auth_method: string;
  privy_user_id: string;
  is_new_user: boolean;
  display_name: string;
  email: string;
  credits: number;
  timestamp: string | null;
  tier?: UserTier;
  tier_display_name?: string;
  subscription_status?: SubscriptionStatus;
  subscription_end_date?: number;
}

// =============================================================================
// RESULT TYPES (for explicit error handling)
// =============================================================================

export type Result<T, E = AuthError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// =============================================================================
// STATE MACHINE TYPES
// =============================================================================

export interface AuthMachineContext {
  user: AuthenticatedUser | null;
  error: AuthError | null;
  retryCount: number;
  lastSyncAttempt: number | null;
}

export interface AuthMachineConfig {
  onStateChange?: (state: AuthState, context: AuthMachineContext) => void;
  onAuthenticated?: (user: AuthenticatedUser) => void;
  onLogout?: () => void;
  onError?: (error: AuthError) => void;
}
