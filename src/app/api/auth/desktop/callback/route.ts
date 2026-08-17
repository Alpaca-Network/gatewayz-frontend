/**
 * Desktop OAuth Callback API Route
 *
 * This endpoint handles OAuth code exchange for desktop app authentication.
 * It receives the authorization code from the desktop OAuth flow and exchanges
 * it with Privy to get an access token.
 */

import { NextRequest, NextResponse } from "next/server";

// SECURITY: this endpoint previously minted a "session token" that was just
// base64(JSON.stringify({code, ...})) — an unsigned, unverified blob with no
// tie back to Privy at all. Any POST with an arbitrary `code` got back a
// token that getDesktopAuthHeaders() then sent as a real
// `Authorization: Bearer` credential on every subsequent API call
// (src/lib/desktop/auth.ts). That is a full auth-bypass shape.
//
// There is no @privy-io/server-auth (or equivalent) integration in this repo
// to actually verify a Privy auth code/token server-side, so we fail closed
// here instead of shipping a second guess at that verification. Re-enable
// only after wiring real server-side verification — see
// https://docs.privy.io/guide/server/authorization — and have it return a
// token whose authenticity the backend can independently verify (e.g. the
// user's real Privy identity token / Gatewayz API key), not a self-issued blob.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Desktop authentication is temporarily unavailable." },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with authorization code." },
    { status: 405 }
  );
}
