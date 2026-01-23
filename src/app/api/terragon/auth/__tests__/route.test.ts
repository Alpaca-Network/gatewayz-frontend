import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { createHmac, createDecipheriv } from "crypto";

// Mock fetch for backend validation
global.fetch = jest.fn();

// Helper to decrypt token payload for testing
function decryptPayload(encryptedPayload: string, secret: string): Record<string, unknown> {
  const key = Buffer.from(secret.padEnd(32, "0").slice(0, 32));
  const [ivB64, encrypted, authTagB64] = encryptedPayload.split(".");
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "base64url", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// Store original env
const originalEnv = process.env;

describe("API /api/terragon/auth", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GATEWAYZ_AUTH_BRIDGE_SECRET = "test-secret-key-for-testing";
    // Don't set BACKEND_URL to skip backend validation in tests
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    (global.fetch as jest.Mock).mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("POST /api/terragon/auth", () => {
    it("should return 401 when authorization header is missing", async () => {
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing authorization header");
    });

    it("should return 401 when API key format is invalid", async () => {
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer abc",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key format");
    });

    it("should return 401 when backend validation fails", async () => {
      process.env.BACKEND_URL = "https://api.gatewayz.ai";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_fake_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("should return 500 when bridge secret is not configured", async () => {
      delete process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;

      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("Auth bridge not configured");
    });

    it("should return 400 when required fields are missing", async () => {
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          username: "testuser",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: userId, email");
    });

    it("should generate a valid encrypted and signed token", async () => {
      const apiKey = "gw_live_valid_api_key_12345";
      const secret = "test-secret-key-for-testing";
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
          username: "testuser",
          tier: "pro",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.expiresAt).toBeDefined();

      // Token format: iv.encrypted.authTag.signature (4 parts total)
      const lastDotIndex = data.token.lastIndexOf(".");
      const encryptedPayload = data.token.slice(0, lastDotIndex);
      const signature = data.token.slice(lastDotIndex + 1);

      // Verify signature
      const expectedSig = createHmac("sha256", secret)
        .update(encryptedPayload)
        .digest("base64url");
      expect(signature).toBe(expectedSig);

      // Decrypt and verify payload
      const payload = decryptPayload(encryptedPayload, secret);
      expect(payload.gwUserId).toBe("user-123");
      expect(payload.email).toBe("test@example.com");
      expect(payload.username).toBe("testuser");
      expect(payload.tier).toBe("pro");
      // API key should NOT be in payload (only keyHash)
      expect(payload.apiKey).toBeUndefined();
      expect(payload.keyHash).toBeDefined();
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it("should use email prefix as username when username not provided", async () => {
      const secret = "test-secret-key-for-testing";
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      const lastDotIndex = data.token.lastIndexOf(".");
      const encryptedPayload = data.token.slice(0, lastDotIndex);
      const payload = decryptPayload(encryptedPayload, secret);

      expect(payload.username).toBe("test");
    });

    it("should default tier to free when not provided", async () => {
      const secret = "test-secret-key-for-testing";
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      const lastDotIndex = data.token.lastIndexOf(".");
      const encryptedPayload = data.token.slice(0, lastDotIndex);
      const payload = decryptPayload(encryptedPayload, secret);

      expect(payload.tier).toBe("free");
    });

    it("should set expiration to 1 hour from now", async () => {
      const secret = "test-secret-key-for-testing";
      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const now = Math.floor(Date.now() / 1000);
      const response = await POST(request);
      const data = await response.json();

      const lastDotIndex = data.token.lastIndexOf(".");
      const encryptedPayload = data.token.slice(0, lastDotIndex);
      const payload = decryptPayload(encryptedPayload, secret);

      // Should expire approximately 1 hour from now (with some tolerance)
      expect((payload.exp as number) - now).toBeGreaterThanOrEqual(3590);
      expect((payload.exp as number) - now).toBeLessThanOrEqual(3610);
    });

    it("should validate API key against backend when BACKEND_URL is set", async () => {
      process.env.BACKEND_URL = "https://api.gatewayz.ai";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user_id: "user-123" }),
      });

      const request = new NextRequest("http://localhost/api/terragon/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gw_live_valid_api_key_12345",
        },
        body: JSON.stringify({
          userId: "user-123",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify backend was called
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.gatewayz.ai/api/user/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer gw_live_valid_api_key_12345" },
        })
      );
    });
  });

  describe("GET /api/terragon/auth", () => {
    it("should return health check status when configured", async () => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = "https://test-terragon.railway.app";

      const response = await GET();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data.configured).toBe(true);
      expect(data.terragonUrl).toBe("https://test-terragon.railway.app");
    });

    it("should return configured: false when secret is not set", async () => {
      delete process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;

      const response = await GET();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data.configured).toBe(false);
    });

    it("should return null terragonUrl when not configured", async () => {
      delete process.env.NEXT_PUBLIC_TERRAGON_URL;

      const response = await GET();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.terragonUrl).toBeNull();
    });
  });
});
