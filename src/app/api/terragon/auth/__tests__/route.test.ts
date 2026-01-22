import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { createHmac } from "crypto";

// Store original env
const originalEnv = process.env;

describe("API /api/terragon/auth", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GATEWAYZ_AUTH_BRIDGE_SECRET = "test-secret-key-for-testing";
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

    it("should return 401 when API key is invalid", async () => {
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

    it("should generate a valid signed token", async () => {
      const apiKey = "gw_live_valid_api_key_12345";
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

      // Verify token structure (base64url.signature)
      const tokenParts = data.token.split(".");
      expect(tokenParts).toHaveLength(2);

      // Decode and verify payload
      const payloadJson = Buffer.from(tokenParts[0], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      expect(payload.gwUserId).toBe("user-123");
      expect(payload.email).toBe("test@example.com");
      expect(payload.username).toBe("testuser");
      expect(payload.tier).toBe("pro");
      expect(payload.apiKey).toBe(apiKey);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));

      // Verify signature
      const expectedSig = createHmac("sha256", "test-secret-key-for-testing")
        .update(payloadJson)
        .digest("base64url");
      expect(tokenParts[1]).toBe(expectedSig);
    });

    it("should use email prefix as username when username not provided", async () => {
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
      const payloadJson = Buffer.from(data.token.split(".")[0], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      expect(payload.username).toBe("test");
    });

    it("should default tier to free when not provided", async () => {
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
      const payloadJson = Buffer.from(data.token.split(".")[0], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      expect(payload.tier).toBe("free");
    });

    it("should set expiration to 1 hour from now", async () => {
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

      const payloadJson = Buffer.from(data.token.split(".")[0], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      // Should expire approximately 1 hour from now (with some tolerance)
      expect(payload.exp - now).toBeGreaterThanOrEqual(3590);
      expect(payload.exp - now).toBeLessThanOrEqual(3610);
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
