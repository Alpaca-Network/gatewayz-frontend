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

    console.log("[API /api/auth] Proxying authentication request to backend");

    // Use timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for backend auth

    try {
      // Wrap fetch in retry logic for 502/503/504 errors
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
          maxRetries: 3,
          initialDelayMs: 500,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
          retryableStatuses: [502, 503, 504],
        }
      );

      clearTimeout(timeoutId);
      const responseText = await response.text();

      if (!response.ok) {
        console.error("[API /api/auth] Backend auth failed:", response.status, responseText.substring(0, 200));
        return new NextResponse(responseText, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      console.log("[API /api/auth] Backend auth successful");

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
