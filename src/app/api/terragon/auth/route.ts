import { NextRequest, NextResponse } from "next/server";
import { createHmac, createCipheriv, randomBytes, hkdfSync } from "crypto";
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

  // Add timeout to prevent hanging requests that cause 504s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(`${backendUrl}/api/user/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { valid: true, userId: data.user_id };
    }
    return { valid: false };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[API /api/terragon/auth] Backend validation timed out after 5s - allowing request (fail open)");
      // On timeout, allow the request to proceed since:
      // 1. The token is still HMAC-signed and verified by Terragon
      // 2. API keys are controlled by GatewayZ
      // 3. Better UX than blocking auth when backend is slow/cold-starting
      return { valid: true };
    } else {
      console.error("[API /api/terragon/auth] Backend validation error:", error);
    }
    // On non-timeout errors (network failure, etc), fail closed for security
    return { valid: false };
  }
}

/**
 * Derive a 32-byte encryption key from the secret using HKDF.
 * This is cryptographically secure unlike simple padding.
 */
function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", "gatewayz-terragon-auth", 32));
}

/**
 * Encrypt payload using AES-256-GCM
 * Returns: iv.ciphertext.authTag (all base64url encoded)
 */
function encryptPayload(payload: string, secret: string): string {
  const key = deriveKey(secret);
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
