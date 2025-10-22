import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.gatewayz.ai";

/**
 * DELETE /api/user/api-keys/[keyId]
 * Proxy route for deleting an API key
 * Requires Authorization header with Bearer token
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const body = await request.json();
    const { keyId } = params;

    console.log(`[API /api/user/api-keys/${keyId} DELETE] Proxying delete API key request to backend`);

    const response = await fetch(`${API_BASE_URL}/user/api-keys/${keyId}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[API /api/user/api-keys/${keyId} DELETE] Backend request failed:`, response.status, responseText);
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`[API /api/user/api-keys/${keyId} DELETE] Backend request successful`);

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[API /api/user/api-keys/[keyId] DELETE] Error proxying request:", error);
    return NextResponse.json(
      { error: "Internal server error deleting API key" },
      { status: 500 }
    );
  }
}
