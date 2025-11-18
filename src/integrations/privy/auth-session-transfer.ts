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

  // Store with additional security metadata
  const sessionData = {
    token,
    userId: String(userId),
    timestamp,
    origin: window.location.origin,
    fingerprint: generateSessionFingerprint(),
  };

  // Store as a single JSON object for better security
  sessionStorage.setItem(SESSION_TRANSFER_TOKEN_KEY, JSON.stringify(sessionData));

  console.log('[SessionTransfer] Stored session transfer token:', {
    userId,
    timestamp,
    origin: sessionData.origin,
  });
}

/**
 * Generate a browser fingerprint for session validation
 */
function generateSessionFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    window.screen.width.toString(),
    window.screen.height.toString(),
    window.screen.colorDepth?.toString() || 'unknown',
  ];

  // Simple hash function for fingerprinting
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
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

  try {
    const storedData = sessionStorage.getItem(SESSION_TRANSFER_TOKEN_KEY);

    if (!storedData) {
      return { token: null, userId: null };
    }

    // Parse the stored JSON data
    const sessionData = JSON.parse(storedData);

    // Validate structure
    if (!sessionData.token || !sessionData.userId) {
      clearSessionTransferToken();
      return { token: null, userId: null };
    }

    // Check if token has expired
    const elapsed = Date.now() - sessionData.timestamp;
    if (elapsed > SESSION_TRANSFER_EXPIRY_MS) {
      console.log('[SessionTransfer] Session transfer token expired, clearing');
      clearSessionTransferToken();
      return { token: null, userId: null };
    }

    // Validate fingerprint for additional security
    const currentFingerprint = generateSessionFingerprint();
    if (sessionData.fingerprint && sessionData.fingerprint !== currentFingerprint) {
      console.warn('[SessionTransfer] Session fingerprint mismatch - potential security issue');
      // Log but don't block - fingerprint can change with browser updates
    }

    // Validate origin
    if (sessionData.origin && sessionData.origin !== window.location.origin) {
      console.error('[SessionTransfer] Origin mismatch - blocking potential CSRF attack');
      clearSessionTransferToken();
      return { token: null, userId: null };
    }

    console.log('[SessionTransfer] Retrieved valid session transfer token:', {
      userId: sessionData.userId,
      expiresIn: SESSION_TRANSFER_EXPIRY_MS - elapsed,
    });

    return { token: sessionData.token, userId: sessionData.userId };
  } catch (error) {
    console.error('[SessionTransfer] Error retrieving session token:', error);
    clearSessionTransferToken();
    return { token: null, userId: null };
  }
}

/**
 * Clears session transfer token from sessionStorage
 */
export function clearSessionTransferToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Clear the main token key (now stores JSON)
  sessionStorage.removeItem(SESSION_TRANSFER_TOKEN_KEY);

  // Clear legacy keys if they exist (backward compatibility)
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
