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
// Balanced approach: Allow bursts on page load while preventing sustained abuse
// Client-side rate limiting in instrumentation-client.ts handles event deduplication,
// so server-side limiting mainly prevents abuse from malformed/malicious requests
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 30, // INCREASED from 8 - allow normal page load patterns
  windowMs: 60000, // 1 minute window
  maxRequestsPerSecond: 5,  // INCREASED from 1 - allow burst on page load (session + events)
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
 * Try to acquire rate limit quota atomically.
 * Returns success status and retryAfter if limited.
 * This atomic approach prevents TOCTOU race conditions where multiple
 * concurrent requests could bypass rate limits by checking before consuming.
 */
function tryAcquireRateLimitQuota(): { acquired: boolean; retryAfter?: number } {
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
    return { acquired: false, retryAfter };
  }

  // Check second limit (burst protection)
  if (rateLimitState.secondCount >= RATE_LIMIT_CONFIG.maxRequestsPerSecond) {
    return { acquired: false, retryAfter: 1 };
  }

  // Atomically consume quota immediately after check passes
  // This prevents race conditions in concurrent request handling
  rateLimitState.minuteCount++;
  rateLimitState.secondCount++;

  return { acquired: true };
}

/**
 * Release rate limit quota (call if request fails validation after quota acquired)
 * This allows malformed requests to not count against the rate limit
 */
function releaseRateLimitQuota(): void {
  if (rateLimitState.minuteCount > 0) rateLimitState.minuteCount--;
  if (rateLimitState.secondCount > 0) rateLimitState.secondCount--;
}

/**
 * Parse Sentry envelope header to extract DSN and validate project.
 * Only decodes the first line (header) to preserve binary data in the rest of the envelope.
 */
function parseEnvelopeHeader(buffer: ArrayBuffer): { projectId: string; host: string } | null {
  try {
    const bytes = new Uint8Array(buffer);
    // Find the first newline to extract only the header line
    let newlineIndex = bytes.indexOf(10); // 10 = '\n'
    if (newlineIndex === -1) {
      newlineIndex = bytes.length;
    }

    // Decode only the header portion as UTF-8
    const decoder = new TextDecoder("utf-8");
    const headerLine = decoder.decode(bytes.slice(0, newlineIndex));
    const header = JSON.parse(headerLine);

    if (!header.dsn) {
      return null;
    }

    const dsnUrl = new URL(header.dsn);
    // Extract first path segment as project ID (handles /123 and /123/foo cases)
    const projectId = dsnUrl.pathname.replace(/^\/+/, "").split("/")[0];
    // Early return if projectId is empty (e.g., DSN is "https://public@sentry.io/")
    if (!projectId) {
      return null;
    }
    const host = dsnUrl.hostname;

    return { projectId, host };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Try to acquire rate limit quota atomically
    // This prevents TOCTOU race conditions in concurrent request handling
    const { acquired, retryAfter } = tryAcquireRateLimitQuota();
    if (!acquired) {
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

    // Read body as ArrayBuffer to preserve binary data (e.g., session replays)
    // Release quota if body read fails since we can't validate the request
    let buffer: ArrayBuffer;
    try {
      buffer = await request.arrayBuffer();
    } catch (error) {
      releaseRateLimitQuota();
      console.error("[Sentry Tunnel] Failed to read request body:", error);
      return new NextResponse("Bad Request", { status: 400, headers: CORS_HEADERS });
    }
    const envelope = parseEnvelopeHeader(buffer);

    // Validate envelope - release quota for invalid requests
    if (!envelope) {
      releaseRateLimitQuota();
      console.warn("[Sentry Tunnel] Invalid envelope format");
      return new NextResponse("Invalid envelope", { status: 400, headers: CORS_HEADERS });
    }

    // Validate project ID format (security check - must be numeric)
    if (!SENTRY_PROJECT_ID_PATTERN.test(envelope.projectId)) {
      releaseRateLimitQuota();
      console.warn("[Sentry Tunnel] Invalid project ID format:", envelope.projectId);
      return new NextResponse("Invalid project", { status: 403, headers: CORS_HEADERS });
    }

    // Validate host (security check - must be exactly "sentry.io" or "*.sentry.io")
    // This prevents SSRF via malicious domains like "evil-sentry.io"
    // Use case-insensitive comparison per RFC 1035 (DNS is case-insensitive)
    const hostLower = envelope.host.toLowerCase();
    const isValidHost = hostLower === SENTRY_HOST || hostLower.endsWith(`.${SENTRY_HOST}`);
    if (!isValidHost) {
      releaseRateLimitQuota();
      console.warn("[Sentry Tunnel] Invalid Sentry host:", envelope.host);
      return new NextResponse("Invalid host", { status: 403, headers: CORS_HEADERS });
    }

    // Quota already acquired atomically above, proceed to forward request

    // Build upstream URL using normalized lowercase host for consistency
    // DNS is case-insensitive, but using lowercase prevents potential issues
    // with logging, caching, or HTTP clients that might treat URLs differently
    const upstreamUrl = `https://${hostLower}/api/${envelope.projectId}/envelope/`;

    // Forward to Sentry with timeout to prevent hanging requests
    // 10 second timeout prevents tying up server resources if Sentry is slow/unresponsive
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        body: buffer,
        headers: {
          "Content-Type": "application/x-sentry-envelope",
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[Sentry Tunnel] Upstream request timed out");
        return new NextResponse("Gateway Timeout", { status: 504, headers: CORS_HEADERS });
      }
      throw error;
    }
    clearTimeout(timeoutId);

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
    // Note: We intentionally do NOT release quota on unexpected errors.
    // If we reach here, it means:
    // 1. Validation passed (quota should count for valid requests)
    // 2. An unexpected error occurred during forwarding
    // Keeping quota consumed prevents potential abuse via error-triggering requests
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
