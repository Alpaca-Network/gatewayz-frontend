/**
 * Tests for Desktop Authentication Utilities
 */

import {
  generateDesktopOAuthUrl,
  handleDesktopOAuthCallback,
  isDesktopAuthenticated,
  signOutDesktop,
  getDesktopAuthHeaders,
  createInitialDesktopAuthState,
  DESKTOP_OAUTH_PROVIDERS,
} from "../auth";

// Mock the Tauri module
jest.mock("../tauri", () => ({
  isTauri: jest.fn(() => false),
  getAuthToken: jest.fn(),
  setAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
}));

const mockTauri = require("../tauri");

// Mock fetch
global.fetch = jest.fn();

// Mock crypto.getRandomValues
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: jest.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

describe("Desktop Authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe("DESKTOP_OAUTH_PROVIDERS", () => {
    it("has google provider configured", () => {
      expect(DESKTOP_OAUTH_PROVIDERS.google).toBeDefined();
      expect(DESKTOP_OAUTH_PROVIDERS.google.provider).toBe("google");
      expect(DESKTOP_OAUTH_PROVIDERS.google.redirectScheme).toBe("gatewayz");
    });

    it("has github provider configured", () => {
      expect(DESKTOP_OAUTH_PROVIDERS.github).toBeDefined();
      expect(DESKTOP_OAUTH_PROVIDERS.github.provider).toBe("github");
      expect(DESKTOP_OAUTH_PROVIDERS.github.redirectScheme).toBe("gatewayz");
    });
  });

  describe("generateDesktopOAuthUrl", () => {
    it("throws error for unknown provider", () => {
      expect(() => generateDesktopOAuthUrl("unknown")).toThrow(
        "Unknown OAuth provider: unknown"
      );
    });

    it("generates valid OAuth URL for google", () => {
      const url = generateDesktopOAuthUrl("google");
      expect(url).toContain("accounts.google.com");
      expect(url).toContain("redirect_uri=gatewayz%3A%2F%2Fauth%2Fcallback");
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=");
      expect(url).toContain("state=");
    });

    it("stores state in sessionStorage", () => {
      generateDesktopOAuthUrl("google");
      const state = sessionStorage.getItem("oauth_state");
      expect(state).toBeTruthy();
      expect(state!.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it("generates valid OAuth URL for github", () => {
      const url = generateDesktopOAuthUrl("github");
      expect(url).toContain("github.com/login/oauth/authorize");
      expect(url).toContain("redirect_uri=gatewayz%3A%2F%2Fauth%2Fcallback");
    });
  });

  describe("handleDesktopOAuthCallback", () => {
    it("returns error when error parameter is present", async () => {
      const result = await handleDesktopOAuthCallback(
        "error=access_denied&error_description=User+denied"
      );
      expect(result).toEqual({
        success: false,
        error: "access_denied",
      });
    });

    it("returns error when code is missing", async () => {
      const result = await handleDesktopOAuthCallback("state=abc123");
      expect(result).toEqual({
        success: false,
        error: "Missing code or state parameter",
      });
    });

    it("returns error when state is missing", async () => {
      const result = await handleDesktopOAuthCallback("code=abc123");
      expect(result).toEqual({
        success: false,
        error: "Missing code or state parameter",
      });
    });

    it("returns error when state does not match", async () => {
      sessionStorage.setItem("oauth_state", "expected_state");
      const result = await handleDesktopOAuthCallback(
        "code=abc123&state=wrong_state"
      );
      expect(result).toEqual({
        success: false,
        error: "Invalid state parameter",
      });
    });

    it("exchanges code for token on success", async () => {
      sessionStorage.setItem("oauth_state", "valid_state");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "access_token_123" }),
      });
      mockTauri.setAuthToken.mockResolvedValue(undefined);

      const result = await handleDesktopOAuthCallback(
        "code=auth_code&state=valid_state"
      );

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/desktop/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "auth_code" }),
      });
      expect(mockTauri.setAuthToken).toHaveBeenCalledWith("access_token_123");
    });

    it("handles API error response", async () => {
      sessionStorage.setItem("oauth_state", "valid_state");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Invalid code" }),
      });

      const result = await handleDesktopOAuthCallback(
        "code=invalid_code&state=valid_state"
      );

      expect(result).toEqual({
        success: false,
        error: "Invalid code",
      });
    });

    it("handles network errors", async () => {
      sessionStorage.setItem("oauth_state", "valid_state");
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await handleDesktopOAuthCallback(
        "code=auth_code&state=valid_state"
      );

      expect(result).toEqual({
        success: false,
        error: "Network error",
      });
    });
  });

  describe("isDesktopAuthenticated", () => {
    it("returns false when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      const result = await isDesktopAuthenticated();
      expect(result).toBe(false);
    });

    it("returns false when no token is stored", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue(null);
      const result = await isDesktopAuthenticated();
      expect(result).toBe(false);
    });

    it("returns true when token is stored", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue("valid_token");
      const result = await isDesktopAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe("signOutDesktop", () => {
    it("does nothing when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      await signOutDesktop();
      expect(mockTauri.clearAuthToken).not.toHaveBeenCalled();
    });

    it("clears token and notifies backend when in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.clearAuthToken.mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await signOutDesktop();

      expect(mockTauri.clearAuthToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/signout", {
        method: "POST",
      });
    });
  });

  describe("getDesktopAuthHeaders", () => {
    it("returns empty object when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({});
    });

    it("returns empty object when no token", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue(null);
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({});
    });

    it("returns auth headers when token exists", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue("bearer_token_123");
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({
        Authorization: "Bearer bearer_token_123",
        "X-Desktop-Client": "true",
      });
    });
  });

  describe("createInitialDesktopAuthState", () => {
    it("returns correct initial state", () => {
      const state = createInitialDesktopAuthState();
      expect(state).toEqual({
        isAuthenticated: false,
        isLoading: true,
        error: null,
        user: null,
      });
    });
  });
});
