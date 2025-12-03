import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// SENTRY TUNNEL ROUTE WITH RATE LIMITING
// Proxies Sentry events through our server to bypass ad-blockers while
// preventing 429 errors from Sentry's rate limits.
// =============================================================================

// Sentry endpoint - the tunnel forwards events here
// Must match exactly "sentry.io" or end with ".sentry.io" to prevent SSRF via domains like "evil-sentry.io"
const SENTRY_HOST = "sentry.io";
// Allow any Sentry project ID that's numeric (validation happens via DSN)
// The DSN in the envelope must match the DSN configured in the Sentry SDK
const SENTRY_PROJECT_ID_PATTERN = /^\d+$/;

// CORS headers for cross-origin requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 50, // Sentry's typical limit is ~60/min, stay under
  windowMs: 60000, // 1 minute window
  maxRequestsPerSecond: 5, // Burst limit per second
  secondWindowMs: 1000,
};

// In-memory rate limiting state (resets on server restart)
// For production with multiple instances, use Redis or similar
const rateLimitState = {
  minuteCount: 0,
  minuteWindowStart: Date.now(),
  secondCount: 0,
  secondWindowStart: Date.now(),
};

/**
 * Check if request should be rate limited
 */
function checkRateLimit(): { limited: boolean; retryAfter?: number } {
  const now = Date.now();

  // Reset minute window if expired
  if (now - rateLimitState.minuteWindowStart > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitState.minuteCount = 0;
    rateLimitState.minuteWindowStart = now;
  }

  // Reset second window if expired
  if (now - rateLimitState.secondWindowStart > RATE_LIMIT_CONFIG.secondWindowMs) {
    rateLimitState.secondCount = 0;
    rateLimitState.secondWindowStart = now;
  }

  // Check minute limit
  if (rateLimitState.minuteCount >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_CONFIG.windowMs - (now - rateLimitState.minuteWindowStart)) / 1000
    );
    return { limited: true, retryAfter };
  }

  // Check second limit (burst protection)
  if (rateLimitState.secondCount >= RATE_LIMIT_CONFIG.maxRequestsPerSecond) {
    return { limited: true, retryAfter: 1 };
  }

  // Increment counters
  rateLimitState.minuteCount++;
  rateLimitState.secondCount++;

  return { limited: false };
}

/**
 * Parse Sentry envelope to extract DSN and validate project
 */
function parseEnvelope(body: string): { projectId: string; host: string } | null {
  try {
    // Sentry envelopes have a header as the first line
    const headerLine = body.split("\n")[0];
    const header = JSON.parse(headerLine);

    if (!header.dsn) {
      return null;
    }

    const dsnUrl = new URL(header.dsn);
    // Extract first path segment as project ID (handles /123 and /123/foo cases)
    const projectId = dsnUrl.pathname.replace(/^\/+/, "").split("/")[0];
    const host = dsnUrl.hostname;

    return { projectId, host };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const { limited, retryAfter } = checkRateLimit();
    if (limited) {
      console.warn("[Sentry Tunnel] Rate limit exceeded, rejecting request");
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(retryAfter || 60),
          "X-RateLimit-Limit": String(RATE_LIMIT_CONFIG.maxRequestsPerMinute),
          "X-RateLimit-Remaining": "0",
        },
      });
    }

    // Read and parse envelope
    const body = await request.text();
    const envelope = parseEnvelope(body);

    if (!envelope) {
      console.warn("[Sentry Tunnel] Invalid envelope format");
      return new NextResponse("Invalid envelope", { status: 400, headers: CORS_HEADERS });
    }

    // Validate project ID format (security check - must be numeric)
    if (!SENTRY_PROJECT_ID_PATTERN.test(envelope.projectId)) {
      console.warn("[Sentry Tunnel] Invalid project ID format:", envelope.projectId);
      return new NextResponse("Invalid project", { status: 403, headers: CORS_HEADERS });
    }

    // Validate host (security check - must be exactly "sentry.io" or "*.sentry.io")
    // This prevents SSRF via malicious domains like "evil-sentry.io"
    const isValidHost = envelope.host === SENTRY_HOST || envelope.host.endsWith(`.${SENTRY_HOST}`);
    if (!isValidHost) {
      console.warn("[Sentry Tunnel] Invalid Sentry host:", envelope.host);
      return new NextResponse("Invalid host", { status: 403, headers: CORS_HEADERS });
    }

    // Build upstream URL
    const upstreamUrl = `https://${envelope.host}/api/${envelope.projectId}/envelope/`;

    // Forward to Sentry
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
    });

    // Log if Sentry returns rate limit (shouldn't happen with our rate limiting)
    if (upstreamResponse.status === 429) {
      console.warn("[Sentry Tunnel] Upstream returned 429 - consider reducing rate limit");
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Sentry Tunnel] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500, headers: CORS_HEADERS });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
