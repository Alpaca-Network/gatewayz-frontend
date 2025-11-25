/**
 * Session Invalidation Management
 * Handles session invalidation on critical account changes
 * Prevents attackers from maintaining access after password/email changes
 */

const SESSION_INVALIDATION_ID_KEY = 'gatewayz_session_invalidation_id';

export interface SessionInvalidationContext {
  session_invalidation_id: string;
  reason: 'password_changed' | 'email_changed' | 'mfa_changed' | 'device_removed' | 'manual';
  timestamp: number; // Unix timestamp
  logout_all_other_sessions: boolean;
}

/**
 * Generate a new session invalidation ID
 * This ID changes when the user modifies critical account properties
 */
export function generateSessionInvalidationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `sid-${timestamp}-${random}`;
}

/**
 * Get current session invalidation ID
 */
export function getSessionInvalidationId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const storage = window.localStorage;
    return storage.getItem(SESSION_INVALIDATION_ID_KEY);
  } catch (error) {
    console.warn('[session-invalidation] Failed to get session invalidation ID:', error);
    return null;
  }
}

/**
 * Save session invalidation ID
 */
export function saveSessionInvalidationId(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    storage.setItem(SESSION_INVALIDATION_ID_KEY, id);
    console.log('[session-invalidation] Updated session invalidation ID');
  } catch (error) {
    console.warn('[session-invalidation] Failed to save session invalidation ID:', error);
  }
}

/**
 * Clear session invalidation ID (typically on logout)
 */
export function clearSessionInvalidationId(): void {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    storage.removeItem(SESSION_INVALIDATION_ID_KEY);
  } catch (error) {
    console.warn('[session-invalidation] Failed to clear session invalidation ID:', error);
  }
}

/**
 * Validate session invalidation ID against backend version
 * Returns false if session has been invalidated (user needs to re-auth)
 */
export function validateSessionInvalidationId(serverSideId: string): boolean {
  const clientSideId = getSessionInvalidationId();

  if (!clientSideId) {
    console.warn('[session-invalidation] No client-side session ID found');
    return false;
  }

  if (clientSideId !== serverSideId) {
    console.warn('[session-invalidation] Session invalidation ID mismatch - session has been invalidated');
    return false;
  }

  return true;
}

/**
 * Mark password as changed - invalidate all other sessions
 */
export function onPasswordChanged(): SessionInvalidationContext {
  const newId = generateSessionInvalidationId();
  saveSessionInvalidationId(newId);

  const context: SessionInvalidationContext = {
    session_invalidation_id: newId,
    reason: 'password_changed',
    timestamp: Date.now(),
    logout_all_other_sessions: true,
  };

  console.log('[session-invalidation] Password changed - invalidating all other sessions');
  return context;
}

/**
 * Mark email as changed - invalidate all other sessions
 */
export function onEmailChanged(newEmail: string): SessionInvalidationContext {
  const newId = generateSessionInvalidationId();
  saveSessionInvalidationId(newId);

  const context: SessionInvalidationContext = {
    session_invalidation_id: newId,
    reason: 'email_changed',
    timestamp: Date.now(),
    logout_all_other_sessions: true,
  };

  console.log('[session-invalidation] Email changed to', newEmail, '- invalidating all other sessions');
  return context;
}

/**
 * Mark 2FA as changed - invalidate all other sessions
 */
export function onMfaChanged(): SessionInvalidationContext {
  const newId = generateSessionInvalidationId();
  saveSessionInvalidationId(newId);

  const context: SessionInvalidationContext = {
    session_invalidation_id: newId,
    reason: 'mfa_changed',
    timestamp: Date.now(),
    logout_all_other_sessions: true,
  };

  console.log('[session-invalidation] MFA settings changed - invalidating all other sessions');
  return context;
}

/**
 * Mark device as removed - invalidate that device's session
 */
export function onDeviceRemoved(deviceId: string): SessionInvalidationContext {
  const newId = generateSessionInvalidationId();
  saveSessionInvalidationId(newId);

  const context: SessionInvalidationContext = {
    session_invalidation_id: newId,
    reason: 'device_removed',
    timestamp: Date.now(),
    logout_all_other_sessions: false,
  };

  console.log('[session-invalidation] Device', deviceId, 'removed - invalidating device session');
  return context;
}

/**
 * Manually invalidate all sessions
 */
export function invalidateAllSessions(): SessionInvalidationContext {
  const newId = generateSessionInvalidationId();
  saveSessionInvalidationId(newId);

  const context: SessionInvalidationContext = {
    session_invalidation_id: newId,
    reason: 'manual',
    timestamp: Date.now(),
    logout_all_other_sessions: true,
  };

  console.log('[session-invalidation] Manually invalidating all sessions');
  return context;
}

/**
 * Build request headers with session invalidation ID
 * Should be included in authenticated API requests
 */
export function getSessionInvalidationHeaders(): Record<string, string> {
  const id = getSessionInvalidationId();

  if (!id) {
    return {};
  }

  return {
    'X-Session-Invalidation-ID': id,
  };
}

/**
 * Check if response indicates session has been invalidated
 * Backend returns 401 with specific header if invalidation ID mismatch
 */
export function handleSessionInvalidationResponse(response: Response): boolean {
  // Check for session invalidation header
  const headerValue = response.headers.get('X-Session-Invalidated');

  if (headerValue === 'true') {
    console.warn('[session-invalidation] Server indicates session has been invalidated');
    clearSessionInvalidationId();
    return false;
  }

  return true;
}

/**
 * Format invalidation reason for display
 */
export function formatInvalidationReason(reason: string): string {
  const reasons: Record<string, string> = {
    password_changed: 'Your password was changed',
    email_changed: 'Your email address was changed',
    mfa_changed: '2FA settings were modified',
    device_removed: 'This device was removed from your account',
    manual: 'You invalidated all sessions',
  };

  return reasons[reason] || 'Your session was invalidated for security';
}
