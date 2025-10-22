import { NextRequest, NextResponse } from "next/server";

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

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

    console.log("[API /api/user/api-keys] Proxying API keys request to backend");

    const response = await fetch(`${API_BASE_URL}/user/api-keys`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[API /api/user/api-keys] Backend request failed:", response.status, responseText);
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    console.log("[API /api/user/api-keys] Backend request successful");

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[API /api/user/api-keys] Error proxying request:", error);
    return NextResponse.json(
      { error: "Internal server error fetching API keys" },
      { status: 500 }
    );
  }
}
