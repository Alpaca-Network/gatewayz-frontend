import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { handleApiError, HttpError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";
import { cacheAside, cacheKey, CACHE_PREFIX, TTL } from "@/lib/cache-strategies";

/**
 * GET /api/user/me
 * Fetches current user information using the API key from Authorization header
 * Proxies to backend /user/profile endpoint (with Redis caching)
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

        // Extract API key for cache key
        const apiKey = authHeader.replace("Bearer ", "");
        const userCacheId = Buffer.from(apiKey).toString('base64').slice(0, 16);
        const profileCacheKey = cacheKey(CACHE_PREFIX.USER, userCacheId, 'profile');

        console.log("[API /api/user/me] Fetching user info (with Redis cache)");

        // Use cache-aside pattern with Redis
        const userData = await cacheAside(
          profileCacheKey,
          async () => {
            // Fetch from backend on cache miss
            console.log("[Cache MISS] Fetching user profile from backend");
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

              // Parse error details if available
              let errorData;
              try {
                errorData = JSON.parse(responseText);
              } catch {
                errorData = { detail: responseText };
              }

              throw new HttpError(
                errorData.detail || errorData.error || `Backend error: ${response.status}`,
                response.status,
                errorData
              );
            }

            return JSON.parse(responseText);
          },
          TTL.USER_PROFILE,
          'user_profile' // Metrics category
        );

        console.log("[API /api/user/me] User info fetched successfully");
        span.setStatus('ok' as any);
        span.setAttribute("cached", true);

        return NextResponse.json(userData, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        span.setStatus('error' as any);
        span.setAttribute("error", true);
        return handleApiError(error, "API /api/user/me");
      }
    }
  );
}
