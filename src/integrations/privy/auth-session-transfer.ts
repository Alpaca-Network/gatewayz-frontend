/**
 * Session Transfer Module
 *
 * Handles transferring authentication session from gatewayz.ai to beta.gatewayz.ai
 * Provides utilities for encoding/decoding session parameters and managing redirects
 */

const SESSION_TRANSFER_TOKEN_KEY = 'gatewayz_session_transfer_token';
const SESSION_TRANSFER_USER_ID_KEY = 'gatewayz_session_transfer_user_id';
const SESSION_TRANSFER_TIMESTAMP_KEY = 'gatewayz_session_transfer_timestamp';
const SESSION_TRANSFER_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Redirects to beta domain with session transfer parameters
 * @param token - API key or session token to transfer
 * @param userId - Gatewayz user ID
 * @param betaDomain - Beta domain URL (default: https://beta.gatewayz.ai)
 * @param returnUrl - Optional URL to return to after auth on beta domain
 * @param action - Optional action parameter (e.g., 'signin', 'freetrial')
 */
export function redirectToBetaWithSession(
  token: string,
  userId: string | number,
  betaDomain: string = 'https://beta.gatewayz.ai',
  returnUrl?: string,
  action?: string
): void {
  const params = new URLSearchParams();
  params.append('token', token);
  params.append('userId', String(userId));

  if (returnUrl) {
    params.append('returnUrl', returnUrl);
  }

  if (action) {
    params.append('action', action);
  }

  const redirectUrl = `${betaDomain}?${params.toString()}`;
  console.log('[SessionTransfer] Redirecting to beta with session:', {
    domain: betaDomain,
    hasReturnUrl: !!returnUrl,
    action: action || undefined,
  });

  // Use location.href for a hard redirect
  window.location.href = redirectUrl;
}

/**
 * Extracts session transfer parameters from URL
 * Called on beta domain to retrieve transferred session
 * @returns Object with token, userId, returnUrl, and action if present
 */
export function getSessionTransferParams(): {
  token: string | null;
  userId: string | null;
  returnUrl: string | null;
  action: string | null;
} {
  if (typeof window === 'undefined') {
    return { token: null, userId: null, returnUrl: null, action: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    token: params.get('token'),
    userId: params.get('userId'),
    returnUrl: params.get('returnUrl'),
    action: params.get('action'),
  };
}

/**
 * Cleans up session transfer parameters from URL
 * Should be called after processing parameters to maintain clean history
 */
export function cleanupSessionTransferParams(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Replace current history entry to remove transfer params from URL
  // Use replaceState to avoid creating a new history entry
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
    console.log('[SessionTransfer] URL parameters cleaned up from history');
  } catch (error) {
    console.warn('[SessionTransfer] Failed to cleanup URL parameters:', error);
    // Fallback: try again with just pathname
    try {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());
    } catch (fallbackError) {
      console.error('[SessionTransfer] Failed to cleanup URL even with fallback:', fallbackError);
    }
  }
}

/**
 * Stores session transfer token in sessionStorage for persistence
 * SessionStorage is domain-specific and cleared on tab close
 * @param token - API key or session token
 * @param userId - Gatewayz user ID
 */
export function storeSessionTransferToken(token: string, userId: string | number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const timestamp = Date.now();
  sessionStorage.setItem(SESSION_TRANSFER_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_TRANSFER_USER_ID_KEY, String(userId));
  sessionStorage.setItem(SESSION_TRANSFER_TIMESTAMP_KEY, String(timestamp));

  console.log('[SessionTransfer] Stored session transfer token:', {
    userId,
    timestamp,
  });
}

/**
 * Retrieves stored session transfer token from sessionStorage
 * Auto-expires after 10 minutes
 * @returns Token and userId if available and not expired, null otherwise
 */
export function getStoredSessionTransferToken(): {
  token: string | null;
  userId: string | null;
} {
  if (typeof window === 'undefined') {
    return { token: null, userId: null };
  }

  const token = sessionStorage.getItem(SESSION_TRANSFER_TOKEN_KEY);
  const userId = sessionStorage.getItem(SESSION_TRANSFER_USER_ID_KEY);
  const timestamp = sessionStorage.getItem(SESSION_TRANSFER_TIMESTAMP_KEY);

  // Check if token exists
  if (!token || !userId) {
    return { token: null, userId: null };
  }

  // Check if token has expired
  if (timestamp) {
    const storedTime = parseInt(timestamp, 10);
    const elapsed = Date.now() - storedTime;

    if (elapsed > SESSION_TRANSFER_EXPIRY_MS) {
      console.log('[SessionTransfer] Session transfer token expired, clearing');
      clearSessionTransferToken();
      return { token: null, userId: null };
    }

    console.log('[SessionTransfer] Retrieved valid session transfer token:', {
      userId,
      expiresIn: SESSION_TRANSFER_EXPIRY_MS - elapsed,
    });
  }

  return { token, userId };
}

/**
 * Clears session transfer token from sessionStorage
 */
export function clearSessionTransferToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(SESSION_TRANSFER_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TRANSFER_USER_ID_KEY);
  sessionStorage.removeItem(SESSION_TRANSFER_TIMESTAMP_KEY);

  console.log('[SessionTransfer] Cleared session transfer token');
}

/**
 * Validates if a session transfer token is available and valid
 * @returns true if token exists and is not expired
 */
export function isSessionTransferTokenValid(): boolean {
  const { token } = getStoredSessionTransferToken();
  return !!token;
}
