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
  try {
    const body = await request.json();

    console.log("[API /api/auth] Proxying authentication request to backend (attempt 1/3 with retries)");

    // Use timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for backend auth
    console.log("[API /api/auth] Request timeout: 15000ms per attempt");

    try {
      // Wrap fetch in retry logic for 502/503/504 errors
      // Using 2 retries: 1 initial attempt + 2 retries = 3 total attempts
      console.log("[API /api/auth] Starting authentication with retry logic (maxRetries: 2, initialDelay: 500ms)");
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
          maxRetries: 2,
          initialDelayMs: 500,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
          retryableStatuses: [502, 503, 504],
        }
      );

      clearTimeout(timeoutId);
      const responseText = await response.text();

      if (!response.ok) {
        console.error("[API /api/auth] Backend auth failed with status:", response.status);
        console.error("[API /api/auth] Error response:", responseText.substring(0, 200));
        return new NextResponse(responseText, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      console.log("[API /api/auth] Backend auth successful - returning 200");

      return new NextResponse(responseText, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle timeout and network errors
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error("[API /api/auth] Backend request timeout");
          return new NextResponse(
            JSON.stringify({ error: "Authentication service timeout" }),
            {
              status: 504,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      throw fetchError;
    }
  } catch (error) {
    return handleApiError(error, "API /api/auth");
  }
}
