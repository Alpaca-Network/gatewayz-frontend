import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth
 * Proxy route for backend authentication
 * Accepts Privy authentication data and forwards to Gatewayz backend API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

    console.log("[API /api/auth] Proxying authentication request to backend");

    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[API /api/auth] Backend auth failed:", response.status, responseText);
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
  } catch (error) {
    console.error("[API /api/auth] Error proxying auth request:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    );
  }
}
