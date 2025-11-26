/**
 * Auth Service
 *
 * Handles all authentication operations:
 * - Privy token retrieval
 * - Backend sync with retry logic
 * - Session persistence
 * - Auth refresh
 *
 * This service contains ALL retry/timeout logic in one place.
 */

import {
  AuthenticatedUser,
  AuthError,
  AuthErrorCode,
  AuthMethod,
  AuthRequestBody,
  AuthResponse,
  Result,
  StoredUserData,
  UserTier,
  ok,
  err,
} from './types';
import {
  AUTH_TIMEOUTS,
  AUTH_RETRIES,
  AUTH_STORAGE_KEYS,
  AUTH_ENDPOINTS,
  AUTH_EVENTS,
  calculateBackoff,
  getAdaptiveTimeout,
} from './auth-config';

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveApiKey(apiKey: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTH_STORAGE_KEYS.API_KEY, apiKey);
  } catch (error) {
    console.warn('[AuthService] Failed to save API key:', error);
  }
}

export function getApiKey(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const key = storage.getItem(AUTH_STORAGE_KEYS.API_KEY);
    return key && key.trim().length > 0 ? key : null;
  } catch {
    return null;
  }
}

export function saveUserData(userData: StoredUserData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTH_STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.warn('[AuthService] Failed to save user data:', error);
  }
}

export function getUserData(): StoredUserData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const data = storage.getItem(AUTH_STORAGE_KEYS.USER_DATA);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearAuthData(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(AUTH_STORAGE_KEYS.API_KEY);
    storage.removeItem(AUTH_STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.warn('[AuthService] Failed to clear auth data:', error);
  }
}

export function getReferralCode(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(AUTH_STORAGE_KEYS.REFERRAL_CODE);
  } catch {
    return null;
  }
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

function createAuthError(
  code: AuthErrorCode,
  message: string,
  details?: Record<string, unknown>
): AuthError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
  };
}

function isRetryableStatus(status: number): boolean {
  return (AUTH_RETRIES.RETRYABLE_STATUS_CODES as readonly number[]).includes(status);
}

// =============================================================================
// NETWORK HELPERS
// =============================================================================

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = AUTH_TIMEOUTS.BACKEND_SYNC_PER_ATTEMPT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// AUTH SERVICE CLASS
// =============================================================================

export class AuthService {
  private static instance: AuthService | null = null;

  // Prevent concurrent sync operations
  private syncInProgress = false;
  private syncPromise: Promise<Result<AuthenticatedUser>> | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ===========================================================================
  // RESTORE SESSION
  // ===========================================================================

  /**
   * Try to restore session from localStorage.
   * Returns user if valid session exists, null otherwise.
   */
  async restoreSession(): Promise<AuthenticatedUser | null> {
    const apiKey = getApiKey();
    const userData = getUserData();

    if (!apiKey || !userData) {
      return null;
    }

    // Validate the session is still valid by making a quick API call
    try {
      const response = await fetchWithTimeout(AUTH_ENDPOINTS.USER, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // Quick check
      });

      if (response.status === 401) {
        // Session expired
        clearAuthData();
        return null;
      }

      if (!response.ok) {
        // Other error, but don't clear session yet - might be temporary
        console.warn('[AuthService] Session validation failed:', response.status);
        // Return cached user data optimistically
      }

      // Session is valid, return user from cache
      return this.storedUserToAuthenticatedUser(userData, apiKey);
    } catch (error) {
      // Network error - return cached data optimistically
      console.warn('[AuthService] Session validation error:', error);
      return this.storedUserToAuthenticatedUser(userData, apiKey);
    }
  }

  private storedUserToAuthenticatedUser(
    stored: StoredUserData,
    apiKey: string
  ): AuthenticatedUser {
    return {
      userId: stored.user_id,
      privyUserId: stored.privy_user_id,
      apiKey,
      email: stored.email,
      displayName: stored.display_name,
      credits: stored.credits,
      tier: (stored.tier || 'basic') as UserTier,
      tierDisplayName: stored.tier_display_name,
      subscriptionStatus: stored.subscription_status,
      subscriptionEndDate: stored.subscription_end_date,
      isNewUser: false,
      authMethod: stored.auth_method as AuthMethod,
    };
  }

  // ===========================================================================
  // SYNC WITH BACKEND
  // ===========================================================================

  /**
   * Sync Privy authentication with backend.
   * Handles retries and timeouts internally.
   */
  async syncWithBackend(
    privyUserId: string,
    token: string | null,
    privyUser: {
      email?: { address: string } | null;
      wallet?: { address: string } | null;
      google?: { email: string } | null;
      github?: { username: string } | null;
      linkedAccounts?: Array<{ type: string; [key: string]: unknown }>;
    },
    authMethod: AuthMethod
  ): Promise<Result<AuthenticatedUser>> {
    // Prevent concurrent syncs
    if (this.syncInProgress && this.syncPromise) {
      console.log('[AuthService] Sync already in progress, waiting...');
      return this.syncPromise;
    }

    this.syncInProgress = true;
    this.syncPromise = this.performSync(privyUserId, token, privyUser, authMethod);

    try {
      return await this.syncPromise;
    } finally {
      this.syncInProgress = false;
      this.syncPromise = null;
    }
  }

  private async performSync(
    privyUserId: string,
    token: string | null,
    privyUser: {
      email?: { address: string } | null;
      wallet?: { address: string } | null;
      google?: { email: string } | null;
      github?: { username: string } | null;
      linkedAccounts?: Array<{ type: string; [key: string]: unknown }>;
    },
    authMethod: AuthMethod
  ): Promise<Result<AuthenticatedUser>> {
    const requestBody = this.buildAuthRequest(privyUserId, token, privyUser, authMethod);
    const maxRetries = AUTH_RETRIES.MAX_BACKEND_SYNC;
    const timeout = getAdaptiveTimeout(AUTH_TIMEOUTS.BACKEND_SYNC_PER_ATTEMPT);

    let lastError: AuthError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = calculateBackoff(attempt - 1);
        console.log(`[AuthService] Retry ${attempt}/${maxRetries} after ${backoff}ms`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }

      try {
        console.log(`[AuthService] Sync attempt ${attempt + 1}/${maxRetries + 1}`);

        const response = await fetchWithTimeout(AUTH_ENDPOINTS.AUTH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          timeout,
        });

        // Handle specific status codes
        if (response.status === 401) {
          return err(createAuthError(
            'INVALID_TOKEN',
            'Authentication token is invalid or expired'
          ));
        }

        if (response.status === 429) {
          return err(createAuthError(
            'RATE_LIMITED',
            'Too many authentication attempts. Please wait and try again.',
            { retryAfter: response.headers.get('Retry-After') }
          ));
        }

        if (isRetryableStatus(response.status)) {
          lastError = createAuthError(
            'BACKEND_ERROR',
            `Server error (${response.status}). Retrying...`,
            { status: response.status }
          );
          continue; // Retry
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          return err(createAuthError(
            'BACKEND_ERROR',
            `Authentication failed: ${errorText}`,
            { status: response.status }
          ));
        }

        // Parse successful response
        const data = await response.json() as AuthResponse;

        if (!data.success || !data.api_key) {
          return err(createAuthError(
            'BACKEND_ERROR',
            data.message || 'Authentication failed: Missing API key'
          ));
        }

        // Save to storage
        const user = this.processAuthResponse(data, authMethod);
        this.persistAuthData(user);

        // Dispatch completion event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(AUTH_EVENTS.REFRESH_COMPLETE));

          // Welcome new users
          if (data.is_new_user) {
            window.dispatchEvent(new CustomEvent(AUTH_EVENTS.NEW_USER_WELCOME, {
              detail: { credits: user.credits }
            }));
          }
        }

        return ok(user);

      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = createAuthError('TIMEOUT', 'Authentication request timed out');
          } else {
            lastError = createAuthError(
              'NETWORK_ERROR',
              `Network error: ${error.message}`,
              { originalError: error.message }
            );
          }
        } else {
          lastError = createAuthError('UNKNOWN', 'An unexpected error occurred');
        }

        // Continue to retry on network errors
        console.warn(`[AuthService] Attempt ${attempt + 1} failed:`, lastError.message);
      }
    }

    // All retries exhausted
    return err(lastError || createAuthError('UNKNOWN', 'Authentication failed after all retries'));
  }

  private buildAuthRequest(
    privyUserId: string,
    token: string | null,
    privyUser: {
      email?: { address: string } | null;
      wallet?: { address: string } | null;
      google?: { email: string } | null;
      github?: { username: string } | null;
      linkedAccounts?: Array<{ type: string; [key: string]: unknown }>;
    },
    authMethod: AuthMethod
  ): AuthRequestBody {
    return {
      user: {
        privy_user_id: privyUserId,
        email: privyUser.email?.address ?? null,
        wallet_address: privyUser.wallet?.address ?? null,
        google_email: privyUser.google?.email ?? null,
        github_username: privyUser.github?.username ?? null,
        linked_accounts: privyUser.linkedAccounts?.map(account => {
          const { type, ...rest } = account;
          return {
            ...rest,
            type: type === 'github_oauth' ? 'github' : type,
          };
        }),
      },
      token,
      privy_user_id: privyUserId,
      auth_method: authMethod,
      referral_code: getReferralCode(),
    };
  }

  private processAuthResponse(data: AuthResponse, authMethod: AuthMethod): AuthenticatedUser {
    // Normalize credits
    const credits = data.credits !== undefined && data.credits !== null && !isNaN(data.credits)
      ? Math.floor(data.credits)
      : 0;

    return {
      userId: data.user_id,
      privyUserId: data.privy_user_id,
      apiKey: data.api_key,
      email: data.email,
      displayName: data.display_name,
      credits,
      tier: (data.tier?.toLowerCase() as UserTier) || 'basic',
      tierDisplayName: data.tier_display_name,
      subscriptionStatus: data.subscription_status,
      subscriptionEndDate: data.subscription_end_date,
      isNewUser: data.is_new_user,
      authMethod,
    };
  }

  private persistAuthData(user: AuthenticatedUser): void {
    saveApiKey(user.apiKey);
    saveUserData({
      user_id: user.userId,
      api_key: user.apiKey,
      auth_method: user.authMethod,
      privy_user_id: user.privyUserId,
      display_name: user.displayName,
      email: user.email,
      credits: user.credits,
      tier: user.tier,
      tier_display_name: user.tierDisplayName,
      subscription_status: user.subscriptionStatus,
      subscription_end_date: user.subscriptionEndDate,
    });
  }

  // ===========================================================================
  // REFRESH
  // ===========================================================================

  /**
   * Refresh the current session.
   * Used when API key might be stale or after 401 errors.
   */
  async refresh(): Promise<Result<AuthenticatedUser>> {
    const apiKey = getApiKey();
    if (!apiKey) {
      return err(createAuthError('SESSION_EXPIRED', 'No active session to refresh'));
    }

    try {
      const response = await fetchWithTimeout(AUTH_ENDPOINTS.REFRESH, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: AUTH_TIMEOUTS.REFRESH,
      });

      if (response.status === 401) {
        clearAuthData();
        return err(createAuthError('SESSION_EXPIRED', 'Session has expired. Please log in again.'));
      }

      if (!response.ok) {
        return err(createAuthError(
          'BACKEND_ERROR',
          `Refresh failed with status ${response.status}`
        ));
      }

      const data = await response.json();

      if (!data.success || !data.api_key) {
        return err(createAuthError('BACKEND_ERROR', 'Refresh response missing API key'));
      }

      // Update stored credentials
      const userData = getUserData();
      const user: AuthenticatedUser = {
        userId: data.user_id || userData?.user_id || 0,
        privyUserId: data.privy_user_id || userData?.privy_user_id || '',
        apiKey: data.api_key,
        email: data.email || userData?.email || '',
        displayName: data.display_name || userData?.display_name || '',
        credits: Math.floor(data.credits ?? userData?.credits ?? 0),
        tier: (data.tier?.toLowerCase() || userData?.tier || 'basic') as UserTier,
        tierDisplayName: data.tier_display_name || userData?.tier_display_name,
        subscriptionStatus: data.subscription_status || userData?.subscription_status,
        subscriptionEndDate: data.subscription_end_date || userData?.subscription_end_date,
        isNewUser: false,
        authMethod: (userData?.auth_method || 'email') as AuthMethod,
      };

      this.persistAuthData(user);

      // Dispatch completion event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_EVENTS.REFRESH_COMPLETE));
      }

      return ok(user);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return err(createAuthError('TIMEOUT', 'Refresh request timed out'));
      }
      return err(createAuthError(
        'NETWORK_ERROR',
        `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  // ===========================================================================
  // LOGOUT
  // ===========================================================================

  /**
   * Clear all auth data and dispatch logout event.
   */
  logout(): void {
    clearAuthData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EVENTS.LOGOUT));
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const authService = AuthService.getInstance();
