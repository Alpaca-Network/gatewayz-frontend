import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/app/api/middleware/auth";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if response is HTML (Cloudflare error page)
 */
function isHtmlResponse(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

/**
 * GET /api/user/api-keys
 * Proxy route for fetching user API keys
 * Requires Authorization header with Bearer token
 */
export async function GET(request: NextRequest) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    console.log("[API /api/user/api-keys GET] Proxying API keys request to backend");

    // Retry logic for 500 errors (backend temporary failures)
    const maxRetries = 3;
    let lastError: { status: number; responseText: string } | null = null;
    let responseText: string = '';
    let response: Response | null = null;

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      try {
        if (retryCount > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 4000);
          console.log(`[API /api/user/api-keys GET] Retry attempt ${retryCount}/${maxRetries} after ${waitTime}ms delay`);
          await sleep(waitTime);
        }

        response = await proxyFetch(`${API_BASE_URL}/user/api-keys`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        responseText = await response.text();

        // Retry on 500 errors (server errors that might be temporary)
        if (response.status === 500 && retryCount < maxRetries) {
          const isHtml = isHtmlResponse(responseText);
          console.warn(`[API /api/user/api-keys GET] Backend returned 500 error on attempt ${retryCount + 1}, will retry (isHtml: ${isHtml})`);
          lastError = { status: response.status, responseText };
          continue; // Retry
        }

        if (!response || !response.ok) {
          console.error("[API /api/user/api-keys GET] Backend request failed:", response.status, responseText.substring(0, 500));
          
          // Check if response is HTML (Cloudflare error page)
          const isHtml = isHtmlResponse(responseText);
          
          if (isHtml) {
            // Backend returned HTML error page (likely Cloudflare 500 error)
            console.error("[API /api/user/api-keys GET] Backend returned HTML error page instead of JSON");
            return NextResponse.json(
              {
                error: "Backend API Error",
                status: response.status,
                message: "The backend API is temporarily unavailable. Please try again in a few moments.",
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
                error: "Backend API Error",
                status: response.status,
                message: responseText.substring(0, 500),
              },
              { status: response.status }
            );
          }
        }

        // Success - break out of retry loop
        break;
      } catch (fetchError) {
        // Network errors - retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.warn(`[API /api/user/api-keys GET] Fetch error on attempt ${retryCount + 1}, will retry:`, fetchError);
          await sleep(Math.min(1000 * Math.pow(2, retryCount), 4000));
          continue;
        }
        throw fetchError;
      }
    }

    // If we get here after retries failed, use the last error
    if (lastError && (!response || !response.ok)) {
      const isHtml = isHtmlResponse(lastError.responseText);
      if (isHtml) {
        return NextResponse.json(
          {
            error: "Backend API Error",
            status: 502,
            message: "The backend API is temporarily unavailable after multiple retry attempts. Please try again later.",
          },
          { status: 502 }
        );
      }
    }

    // Ensure we have a valid response
    if (!response || !response.ok || !responseText) {
      return NextResponse.json(
        {
          error: "Backend API Error",
          status: 502,
          message: "Failed to fetch API keys after multiple retry attempts.",
        },
        { status: 502 }
      );
    }

    // Log the response to debug format issues
    try {
      const responseData = JSON.parse(responseText);
      console.log("[API /api/user/api-keys GET] Backend request successful. Response format:", {
        isArray: Array.isArray(responseData),
        hasKeys: typeof responseData === 'object' && 'keys' in responseData,
        keys: typeof responseData === 'object' && 'keys' in responseData ? responseData.keys?.length : 'N/A',
        responseKeys: typeof responseData === 'object' ? Object.keys(responseData) : 'N/A',
        responsePreview: JSON.stringify(responseData).substring(0, 200)
      });
    } catch (parseError) {
      console.warn("[API /api/user/api-keys GET] Could not parse response as JSON:", parseError);
    }

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[API /api/user/api-keys GET] Unexpected error:", error);
    return handleApiError(error, "API /api/user/api-keys GET");
  }
}

/**
 * POST /api/user/api-keys
 * Proxy route for creating new API keys
 * Requires Authorization header with Bearer token
 */
export async function POST(request: NextRequest) {
  try {
    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    // Safely parse request body
    let body;
    try {
      const contentType = request.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return NextResponse.json(
          { error: "Content-Type must be application/json" },
          { status: 400 }
        );
      }
      body = await request.json();
    } catch (parseError) {
      console.error("[API /api/user/api-keys POST] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body", details: parseError instanceof Error ? parseError.message : String(parseError) },
        { status: 400 }
      );
    }

    console.log("[API /api/user/api-keys POST] Proxying create API key request to backend", { body });

    const response = await proxyFetch(`${API_BASE_URL}/user/api-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[API /api/user/api-keys POST] Backend request failed:", response.status, responseText.substring(0, 500));
      
      // Check if response is HTML (Cloudflare error page)
      const isHtml = isHtmlResponse(responseText);
      
      if (isHtml) {
        console.error("[API /api/user/api-keys POST] Backend returned HTML error page instead of JSON");
        return NextResponse.json(
          {
            error: "Backend API Error",
            status: response.status,
            message: "The backend API is temporarily unavailable. Please try again in a few moments.",
            detail: `Received ${response.status} error from backend`,
          },
          { status: 502 }
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
            error: "Backend API Error",
            status: response.status,
            message: responseText.substring(0, 500),
          },
          { status: response.status }
        );
      }
    }

    console.log("[API /api/user/api-keys POST] Backend request successful");

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[API /api/user/api-keys POST] Unexpected error:", error);
    return handleApiError(error, "API /api/user/api-keys POST");
  }
}
