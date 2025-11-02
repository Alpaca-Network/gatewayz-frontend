import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/middleware/error-handler";
import { API_BASE_URL } from "@/lib/config";

/**
 * POST /api/auth
 * Proxy route for backend authentication
 * Accepts Privy authentication data and forwards to Gatewayz backend API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
    return handleApiError(error, "API /api/auth");
  }
}
