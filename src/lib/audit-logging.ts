/**
 * Audit Logging Module
 * Logs security-relevant events for monitoring and compliance
 */

export type AuditEventType =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'token_expired'
  | 'failed_auth'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'password_changed'
  | 'email_changed'
  | 'device_added'
  | 'device_removed'
  | 'device_trusted'
  | 'device_untrusted'
  | 'session_invalidated'
  | 'suspicious_activity_detected'
  | 'rate_limit_exceeded'
  | 'api_key_generated'
  | 'api_key_revoked';

export interface AuditLogEntry {
  event_type: AuditEventType;
  user_id?: number;
  timestamp: string; // ISO 8601
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  device_fingerprint?: string;
  auth_method?: string;
  status: 'success' | 'failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
  error_message?: string;
  metadata?: {
    anomaly_score?: number;
    risk_level?: 'low' | 'medium' | 'high';
    flags?: string[];
  };
}

/**
 * Send audit log entry to backend
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const timestamp = new Date().toISOString();

    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp,
      user_agent: navigator.userAgent,
      ip_address: entry.ip_address, // Should be set by backend via request headers
    };

    // Get current API key if available for auth
    const apiKey = localStorage.getItem('gatewayz_api_key');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch('/api/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(logEntry),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Don't throw - audit logging should not break the app
    console.warn('[audit] Failed to log audit event:', error);
  }
}

/**
 * Log successful login
 */
export function logLogin(
  userId: number,
  authMethod: string,
  deviceId?: string
): Promise<void> {
  return logAuditEvent({
    event_type: 'login',
    user_id: userId,
    auth_method: authMethod,
    device_id: deviceId,
    status: 'success',
    severity: 'medium',
    details: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log logout
 */
export function logLogout(userId: number, reason?: string): Promise<void> {
  return logAuditEvent({
    event_type: 'logout',
    user_id: userId,
    status: 'success',
    severity: 'low',
    details: {
      reason,
    },
  });
}

/**
 * Log failed authentication attempt
 */
export function logFailedAuth(
  authMethod: string,
  reason: string,
  deviceId?: string
): Promise<void> {
  return logAuditEvent({
    event_type: 'failed_auth',
    auth_method: authMethod,
    device_id: deviceId,
    status: 'failure',
    severity: 'medium',
    error_message: reason,
    details: {
      attempt_time: new Date().toISOString(),
    },
  });
}

/**
 * Log token refresh
 */
export function logTokenRefresh(userId: number, success: boolean): Promise<void> {
  return logAuditEvent({
    event_type: 'token_refresh',
    user_id: userId,
    status: success ? 'success' : 'failure',
    severity: 'low',
  });
}

/**
 * Log token expiration
 */
export function logTokenExpired(userId: number): Promise<void> {
  return logAuditEvent({
    event_type: 'token_expired',
    user_id: userId,
    status: 'failure',
    severity: 'medium',
  });
}

/**
 * Log password change
 */
export function logPasswordChanged(userId: number): Promise<void> {
  return logAuditEvent({
    event_type: 'password_changed',
    user_id: userId,
    status: 'success',
    severity: 'high',
    details: {
      requires_session_invalidation: true,
    },
  });
}

/**
 * Log email change
 */
export function logEmailChanged(userId: number, oldEmail: string, newEmail: string): Promise<void> {
  return logAuditEvent({
    event_type: 'email_changed',
    user_id: userId,
    status: 'success',
    severity: 'high',
    details: {
      old_email: oldEmail,
      new_email: newEmail,
      requires_verification: true,
    },
  });
}

/**
 * Log device trust changes
 */
export function logDeviceTrust(
  userId: number,
  action: 'added' | 'removed' | 'trusted' | 'untrusted',
  deviceId: string
): Promise<void> {
  const eventTypeMap = {
    added: 'device_added' as AuditEventType,
    removed: 'device_removed' as AuditEventType,
    trusted: 'device_trusted' as AuditEventType,
    untrusted: 'device_untrusted' as AuditEventType,
  };

  return logAuditEvent({
    event_type: eventTypeMap[action],
    user_id: userId,
    device_id: deviceId,
    status: 'success',
    severity: 'high',
  });
}

/**
 * Log suspicious activity detection
 */
export function logSuspiciousActivity(
  userId: number,
  flags: string[],
  anomalyScore: number,
  riskLevel: 'low' | 'medium' | 'high'
): Promise<void> {
  return logAuditEvent({
    event_type: 'suspicious_activity_detected',
    user_id: userId,
    status: 'failure',
    severity: riskLevel === 'high' ? 'critical' : 'high',
    details: {
      suspicious_flags: flags,
    },
    metadata: {
      anomaly_score: anomalyScore,
      risk_level: riskLevel,
      flags,
    },
  });
}

/**
 * Log rate limit exceeded
 */
export function logRateLimitExceeded(
  endpoint: string,
  userId?: number,
  retryAfter?: number
): Promise<void> {
  return logAuditEvent({
    event_type: 'rate_limit_exceeded',
    user_id: userId,
    status: 'failure',
    severity: 'medium',
    details: {
      endpoint,
      retry_after: retryAfter,
    },
  });
}

/**
 * Log API key generation
 */
export function logApiKeyGenerated(userId: number, keyId: string): Promise<void> {
  return logAuditEvent({
    event_type: 'api_key_generated',
    user_id: userId,
    status: 'success',
    severity: 'medium',
    details: {
      key_id: keyId,
    },
  });
}

/**
 * Log API key revocation
 */
export function logApiKeyRevoked(userId: number, keyId: string): Promise<void> {
  return logAuditEvent({
    event_type: 'api_key_revoked',
    user_id: userId,
    status: 'success',
    severity: 'high',
    details: {
      key_id: keyId,
    },
  });
}

/**
 * Log session invalidation (critical security event)
 */
export function logSessionInvalidated(
  userId: number,
  reason: 'password_changed' | 'email_changed' | 'mfa_changed' | 'manual' | 'other',
  deviceId?: string
): Promise<void> {
  return logAuditEvent({
    event_type: 'session_invalidated',
    user_id: userId,
    device_id: deviceId,
    status: 'success',
    severity: 'high',
    details: {
      reason,
      all_sessions_invalidated: reason !== 'manual',
    },
  });
}
