/**
 * POST /api/audit/log
 *
 * Endpoint to log security audit events
 * Can be called with or without authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const BACKEND_TIMEOUT_MS = 10000;

interface AuditLogRequest {
  event_type: string;
  user_id?: number;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  device_fingerprint?: string;
  auth_method?: string;
  status: 'success' | 'failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as AuditLogRequest;

    // Validate required fields
    if (!body.event_type || !body.status || !body.severity || !body.timestamp) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get IP address from request headers
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Get authorization header if present
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    // Enrich audit entry with request context
    const enrichedEntry = {
      ...body,
      ip_address: body.ip_address || ipAddress,
      user_agent: body.user_agent || req.headers.get('user-agent') || undefined,
    };

    // Forward to backend audit logging endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${BACKEND_API_BASE}/v1/audit/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(enrichedEntry),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Backend audit logging is best-effort - don't fail the request
      if (!response.ok) {
        console.warn('[audit] Backend audit log failed:', response.status);

        // Still log to Sentry for critical events
        if (body.severity === 'critical' || body.severity === 'high') {
          Sentry.captureMessage(`Audit logging failed: ${body.event_type}`, {
            level: 'warning',
            tags: { service: 'audit', severity: body.severity },
          });
        }
      }

      // Always return success to client (don't block on audit logging failures)
      return NextResponse.json({ success: true });
    } catch (error) {
      clearTimeout(timeoutId);

      // Log timeout or network errors
      console.warn('[audit] Failed to send audit log to backend:', error);

      if (body.severity === 'critical' || body.severity === 'high') {
        Sentry.captureException(error, {
          tags: { service: 'audit', event: body.event_type },
        });
      }

      // Still return success to client
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[audit] Error processing audit log request:', error);

    // Log parsing errors
    Sentry.captureException(error, {
      tags: { service: 'audit', context: 'request-parsing' },
    });

    // Return success anyway - audit failures shouldn't block user operations
    return NextResponse.json({ success: true });
  }
}
