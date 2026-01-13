/**
 * Desktop OAuth Callback API Route
 *
 * This endpoint handles OAuth code exchange for desktop app authentication.
 * It receives the authorization code from the desktop OAuth flow and exchanges
 * it with Privy to get an access token.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, provider = "privy" } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code is required" },
        { status: 400 }
      );
    }

    // For Privy authentication, we need to verify the code through Privy's API
    // The desktop app uses the same Privy authentication flow as the web app,
    // but with a custom redirect scheme (gatewayz://)

    // In the desktop context, the auth flow works as follows:
    // 1. Desktop app opens Privy login in external browser
    // 2. User authenticates with Privy (email, Google, GitHub, etc.)
    // 3. Privy redirects to gatewayz://auth/callback with auth data
    // 4. Desktop app captures the deep link and sends data here
    // 5. This endpoint validates and returns a session token

    // Since Privy handles the full OAuth flow including token exchange,
    // we primarily need to validate the callback and create a desktop session

    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;

    if (!privyAppId || !privyAppSecret) {
      console.error("[Desktop Auth] Missing Privy configuration");
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 500 }
      );
    }

    // Verify the authorization code with Privy
    // Note: The actual implementation depends on Privy's server-side API
    // For now, we'll return the code as a token placeholder
    // In production, this should exchange the code for a proper Privy session

    // TODO: Implement proper Privy server-side token exchange
    // Reference: https://docs.privy.io/guide/server/authorization

    // For the initial implementation, we'll create a simple session token
    // The desktop app can use this to maintain its authenticated state
    const sessionToken = Buffer.from(
      JSON.stringify({
        code,
        provider,
        timestamp: Date.now(),
        type: "desktop_session",
      })
    ).toString("base64");

    return NextResponse.json({
      token: sessionToken,
      type: "desktop",
      expiresIn: 86400, // 24 hours
    });
  } catch (error) {
    console.error("[Desktop Auth] Callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with authorization code." },
    { status: 405 }
  );
}
