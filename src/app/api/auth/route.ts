import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";
import { retryFetch } from "@/lib/retry-utils";

/**
 * POST /api/auth
 * Proxy route for backend authentication
 * Accepts Privy authentication data and forwards to Gatewayz backend API
 * Includes automatic retry logic for transient errors (502/503/504)
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    const body = await request.json();

    console.log("[API /api/auth] Proxying authentication request to backend", {
      has_privy_user_id: !!body.privy_user_id,
      has_token: !!body.token,
      is_new_user: body.is_new_user,
      timestamp: new Date().toISOString(),
    });

    // Use timeout to prevent hanging requests
    // Increased from 15s to 30s to handle backend load and slow network conditions
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for backend auth

    try {
      // Wrap fetch in retry logic for 429/502/503/504 errors
      // - 429: Rate limiting from backend
      // - 502/503/504: Transient server errors
      // Increased retry delay to give backend time to recover under load
      const response = await retryFetch(
        () =>
          proxyFetch(`${API_BASE_URL}/auth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }),
        {
          maxRetries: 2, // Reduced from 3 to keep total retry time under 90s guard timeout
          initialDelayMs: 1000, // Increased from 500ms to give backend more recovery time
          maxDelayMs: 10000, // Increased from 5s to 10s
          backoffMultiplier: 2,
          retryableStatuses: [429, 502, 503, 504],
        }
      );

      clearTimeout(timeoutId);
      const responseText = await response.text();
      const durationMs = Date.now() - requestStartTime;

      if (!response.ok) {
        console.error("[API /api/auth] Backend auth failed", {
          status: response.status,
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200),
          durationMs,
        });

        // Check if response is HTML/XML (cloud provider error page)
        const trimmed = responseText.trim();
        const isNonJson = trimmed.startsWith('<!DOCTYPE') ||
                         trimmed.startsWith('<html') ||
                         trimmed.startsWith('<?xml');

        if (isNonJson) {
          console.error("[API /api/auth] Backend returned non-JSON response (HTML/XML error)");
          return NextResponse.json(
            {
              error: "Authentication service error",
              status: response.status,
              message: "The authentication service returned an invalid response. Please try again.",
              detail: `Received ${response.status} error from backend`,
            },
            { status: 502 } // Bad Gateway - indicates backend issue
          );
        }

        // Try to parse as JSON error response
        try {
          const errorData = JSON.parse(responseText);
          return NextResponse.json(errorData, {
            status: response.status,
          });
        } catch {
          // Not valid JSON, return generic error
          return NextResponse.json(
            {
              error: "Authentication failed",
              status: response.status,
              message: responseText.substring(0, 200),
            },
            { status: response.status }
          );
        }
      }

      console.log("[API /api/auth] Backend auth successful", {
        status: response.status,
        durationMs,
      });

      // Validate response is JSON before returning
      try {
        JSON.parse(responseText);
        return new NextResponse(responseText, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch {
        console.error("[API /api/auth] Backend returned non-JSON success response");
        return NextResponse.json(
          {
            error: "Invalid response format",
            message: "Authentication service returned invalid data",
          },
          { status: 502 }
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - requestStartTime;

      // Handle timeout and network errors
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error("[API /api/auth] Backend request timeout", {
            durationMs,
            timeoutMs: 30000,
          });
          return new NextResponse(
            JSON.stringify({ error: "Authentication service timeout" }),
            {
              status: 504,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        console.error("[API /api/auth] Backend request failed", {
          errorName: fetchError.name,
          errorMessage: fetchError.message,
          durationMs,
        });
      }

      throw fetchError;
    }
  } catch (error) {
    const durationMs = Date.now() - requestStartTime;
    console.error("[API /api/auth] Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return handleApiError(error, "API /api/auth");
  }
}
