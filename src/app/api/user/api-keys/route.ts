import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

/**
 * GET /api/user/api-keys
 * Proxy route for fetching user API keys
 * Requires Authorization header with Bearer token
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    console.log("[API /api/user/api-keys GET] Proxying API keys request to backend");

    const response = await fetch(`${API_BASE_URL}/user/api-keys`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
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
    console.error("[API /api/user/api-keys GET] Error proxying request:", error);
    return NextResponse.json(
      { error: "Internal server error fetching API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/api-keys
 * Proxy route for creating new API keys
 * Requires Authorization header with Bearer token
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const body = await request.json();

    console.log("[API /api/user/api-keys POST] Proxying create API key request to backend");

    const response = await fetch(`${API_BASE_URL}/user/api-keys`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
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
    console.error("[API /api/user/api-keys POST] Error proxying request:", error);
    return NextResponse.json(
      { error: "Internal server error creating API key" },
      { status: 500 }
    );
  }
}
