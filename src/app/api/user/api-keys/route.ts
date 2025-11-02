import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/app/api/middleware/auth";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";

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

    const response = await fetch(`${API_BASE_URL}/user/api-keys`, {
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

    const body = await request.json();

    console.log("[API /api/user/api-keys POST] Proxying create API key request to backend");

    const response = await fetch(`${API_BASE_URL}/user/api-keys`, {
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
    return handleApiError(error, "API /api/user/api-keys POST");
  }
}
