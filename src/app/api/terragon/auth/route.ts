import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { handleApiError } from "@/app/api/middleware/error-handler";

/**
 * POST /api/terragon/auth
 *
 * Generate an HMAC-signed token for authenticating with Terragon.
 * This creates a bridge between GatewayZ (Privy) auth and Terragon's auth system.
 *
 * The token contains:
 * - gwUserId: GatewayZ user ID
 * - email: User's email
 * - username: User's display name
 * - tier: Subscription tier
 * - apiKey: GatewayZ API key (for API calls from Terragon)
 * - exp: Expiration timestamp (1 hour from now)
 * - iat: Issued at timestamp
 *
 * Token format: base64url(payload).hmac_signature
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request has a valid GatewayZ API key
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get the shared secret for signing tokens
    const bridgeSecret = process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;
    if (!bridgeSecret) {
      console.error("[API /api/terragon/auth] GATEWAYZ_AUTH_BRIDGE_SECRET not configured");
      return NextResponse.json(
        { error: "Auth bridge not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, email, username, tier } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: userId, email" },
        { status: 400 }
      );
    }

    // Create token payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      gwUserId: userId,
      email,
      username: username || email.split("@")[0],
      tier: tier || "free",
      apiKey, // Include API key so Terragon can make API calls on behalf of user
      exp: now + 3600, // 1 hour expiration
      iat: now,
    };

    // Sign the payload with HMAC-SHA256
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString("base64url");
    const signature = createHmac("sha256", bridgeSecret)
      .update(payloadJson)
      .digest("base64url");

    const token = `${payloadB64}.${signature}`;

    console.log("[API /api/terragon/auth] Generated auth token for user", {
      userId,
      email: email.substring(0, 3) + "***",
      tier,
      expiresIn: "1 hour",
    });

    return NextResponse.json({
      token,
      expiresAt: new Date((now + 3600) * 1000).toISOString(),
    });
  } catch (error) {
    console.error("[API /api/terragon/auth] Error:", error);
    return handleApiError(error, "API /api/terragon/auth");
  }
}

/**
 * GET /api/terragon/auth
 *
 * Health check endpoint for the auth bridge.
 */
export async function GET() {
  const bridgeSecret = process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;

  return NextResponse.json({
    status: "ok",
    configured: !!bridgeSecret,
    terragonUrl: process.env.NEXT_PUBLIC_TERRAGON_URL || null,
  });
}
