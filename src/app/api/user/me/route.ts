import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";

/**
 * GET /api/user/me
 * Fetches current user information using the API key from Authorization header
 * Proxies to backend /user/profile endpoint
 */
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: "http.server", name: "GET /api/user/me" },
    async (span) => {
      try {
        const authHeader = request.headers.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          span.setAttribute("error", true);
          span.setAttribute("error_type", "missing_auth");
          return NextResponse.json(
            { error: "Missing or invalid authorization header" },
            { status: 401 }
          );
        }

        console.log("[API /api/user/me] Fetching user info from backend");

        const response = await proxyFetch(`${API_BASE_URL}/user/profile`, {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
        });

        span.setAttribute("backend_status", response.status);

        const responseText = await response.text();

        if (!response.ok) {
          span.setAttribute("error", true);
          span.setAttribute("error_type", "backend_error");
          span.setAttribute("backend_status", response.status);
          console.error("[API /api/user/me] Backend request failed:", response.status, responseText);
          return new NextResponse(responseText, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
            },
          });
        }

        console.log("[API /api/user/me] User info fetched successfully");
        span.setStatus("ok");
        span.setAttribute("response_size", responseText.length);

        return new NextResponse(responseText, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        span.setStatus("error");
        span.setAttribute("error", true);
        return handleApiError(error, "API /api/user/me");
      }
    }
  );
}
