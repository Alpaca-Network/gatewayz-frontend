import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/app/api/middleware/auth";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";
import { proxyFetch } from "@/lib/proxy-fetch";

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

    const response = await proxyFetch(`${API_BASE_URL}/user/api-keys`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[API /api/user/api-keys GET] Backend request failed:", response.status, responseText);
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    console.log("[API /api/user/api-keys GET] Backend request successful");

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
      console.error("[API /api/user/api-keys POST] Backend request failed:", response.status, responseText);
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
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
