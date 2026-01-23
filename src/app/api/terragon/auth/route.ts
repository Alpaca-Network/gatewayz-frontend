import { NextRequest, NextResponse } from "next/server";
import { createHmac, createCipheriv, randomBytes } from "crypto";
import { handleApiError } from "@/app/api/middleware/error-handler";

/**
 * Validate API key against the backend to ensure authenticity
 */
async function validateApiKeyWithBackend(apiKey: string): Promise<{ valid: boolean; userId?: string }> {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    console.warn("[API /api/terragon/auth] BACKEND_URL not configured, skipping backend validation");
    return { valid: true }; // Allow in dev without backend
  }

  try {
    const response = await fetch(`${backendUrl}/api/user/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, userId: data.user_id };
    }
    return { valid: false };
  } catch (error) {
    console.error("[API /api/terragon/auth] Backend validation error:", error);
    // On network error, fail closed for security
    return { valid: false };
  }
}

/**
 * Encrypt payload using AES-256-GCM
 * Returns: iv.ciphertext.authTag (all base64url encoded)
 */
function encryptPayload(payload: string, secret: string): string {
  const key = Buffer.from(secret.padEnd(32, "0").slice(0, 32)); // Ensure 32 bytes
  const iv = randomBytes(12); // 12 bytes for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(payload, "utf8", "base64url");
  encrypted += cipher.final("base64url");
  const authTag = cipher.getAuthTag().toString("base64url");

  return `${iv.toString("base64url")}.${encrypted}.${authTag}`;
}

/**
 * POST /api/terragon/auth
 *
 * Generate an encrypted, HMAC-signed token for authenticating with Terragon.
 * This creates a bridge between GatewayZ (Privy) auth and Terragon's auth system.
 *
 * Security features:
 * - API key is validated against the backend before issuing tokens
 * - Payload is encrypted with AES-256-GCM (not just base64 encoded)
 * - Token includes HMAC signature for integrity verification
 * - Short expiration time (1 hour)
 *
 * The token payload contains:
 * - gwUserId: GatewayZ user ID
 * - email: User's email
 * - username: User's display name
 * - tier: Subscription tier
 * - keyHash: Hash of API key (not the key itself)
 * - exp: Expiration timestamp (1 hour from now)
 * - iat: Issued at timestamp
 *
 * Token format: encrypted_payload.hmac_signature
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
        { error: "Invalid API key format" },
        { status: 401 }
      );
    }

    // Validate API key against the backend
    const validation = await validateApiKeyWithBackend(apiKey);
    if (!validation.valid) {
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

    // Create token payload - note: we store a hash of the API key, not the key itself
    const now = Math.floor(Date.now() / 1000);
    const keyHash = createHmac("sha256", bridgeSecret)
      .update(apiKey)
      .digest("base64url")
      .slice(0, 16); // Short hash for identification, not full key

    const payload = {
      gwUserId: userId,
      email,
      username: username || email.split("@")[0],
      tier: tier || "free",
      keyHash, // Only store a hash, not the actual API key
      exp: now + 3600, // 1 hour expiration
      iat: now,
    };

    // Encrypt the payload with AES-256-GCM
    const payloadJson = JSON.stringify(payload);
    const encryptedPayload = encryptPayload(payloadJson, bridgeSecret);

    // Sign the encrypted payload with HMAC-SHA256 for integrity
    const signature = createHmac("sha256", bridgeSecret)
      .update(encryptedPayload)
      .digest("base64url");

    const token = `${encryptedPayload}.${signature}`;

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
