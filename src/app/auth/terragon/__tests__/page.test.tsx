import { render, screen, waitFor, act } from "@testing-library/react";
import TerragonAuthPage from "../page";

// ------- Mocks -------

const mockSearchParams = new Map<string, string>();
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

const mockLogin = jest.fn();
function createMockAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    status: "unauthenticated" as string,
    login: mockLogin,
    privyReady: true,
    privyAuthenticated: false,
    error: null as string | null,
    apiKey: null as string | null,
    userData: null,
    authTiming: {
      startTime: null,
      elapsedMs: 0,
      retryCount: 0,
      maxRetries: 3,
      isSlowAuth: false,
      phase: "idle" as const,
    },
    logout: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

let mockAuthContext = createMockAuthContext();
jest.mock("@/context/gatewayz-auth-context", () => ({
  useGatewayzAuth: () => mockAuthContext,
}));

const mockGetApiKey = jest.fn().mockReturnValue(null);
const mockGetUserData = jest.fn().mockReturnValue(null);
const mockGetApiKeyWithRetry = jest.fn().mockResolvedValue(null);
jest.mock("@/lib/api", () => ({
  getApiKey: () => mockGetApiKey(),
  getUserData: () => mockGetUserData(),
  getApiKeyWithRetry: (...args: unknown[]) => mockGetApiKeyWithRetry(...args),
}));

// Mock the redirect helper so we can assert the exact URL
const mockNavigate = jest.fn();
jest.mock("../navigate", () => ({
  navigateTo: (url: string) => mockNavigate(url),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ------- Helpers -------

/** Set up mocks for a user with cached credentials who will get a token */
function setupAuthenticatedUser(overrides: {
  apiKey?: string;
  userId?: number;
  email?: string;
  displayName?: string;
  tier?: string;
  token?: string;
} = {}) {
  const apiKey = overrides.apiKey ?? "gw_test_key_12345";
  const userData = {
    user_id: overrides.userId ?? 42,
    email: overrides.email ?? "test@example.com",
    display_name: overrides.displayName ?? "TestUser",
    tier: overrides.tier ?? "pro",
  };
  const token = overrides.token ?? "iv.ciphertext.authTag.signature";

  mockGetApiKey.mockReturnValue(apiKey);
  mockGetApiKeyWithRetry.mockResolvedValue(apiKey);
  mockGetUserData.mockReturnValue(userData);
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ token }),
  });

  return { apiKey, userData, token };
}

// ------- Test Suite -------

describe("TerragonAuthPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearchParams.clear();
    mockLogin.mockClear();
    mockNavigate.mockClear();
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
    mockGetApiKeyWithRetry.mockResolvedValue(null);
    mockFetch.mockReset();
    mockAuthContext = createMockAuthContext();
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================
  // REDIRECT TESTS (the critical path)
  // ============================

  describe("redirect back to Terragon", () => {
    it("should redirect to callback URL with gwauth token appended", async () => {
      const callbackUrl =
        "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback?returnUrl=%2Fdashboard";
      mockSearchParams.set("redirect_uri", callbackUrl);
      const { token } = setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });

      const redirectUrl = new URL(mockNavigate.mock.calls[0][0]);
      expect(redirectUrl.origin).toBe(
        "https://terragon-www-production.up.railway.app"
      );
      expect(redirectUrl.pathname).toBe("/api/auth/gatewayz/callback");
      expect(redirectUrl.searchParams.get("returnUrl")).toBe("/dashboard");
      expect(redirectUrl.searchParams.get("gwauth")).toBe(token);
    });

    it("should redirect to terragon.ai domain with gwauth token", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/auth/callback"
      );
      const { token } = setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });

      const redirectUrl = new URL(mockNavigate.mock.calls[0][0]);
      expect(redirectUrl.origin).toBe("https://app.terragon.ai");
      expect(redirectUrl.searchParams.get("gwauth")).toBe(token);
    });

    it("should call /api/terragon/auth with correct body and auth header", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      const { apiKey } = setupAuthenticatedUser({
        userId: 99,
        email: "alice@example.com",
        displayName: "Alice",
        tier: "max",
      });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            }),
            body: JSON.stringify({
              userId: 99,
              email: "alice@example.com",
              username: "Alice",
              tier: "max",
            }),
          })
        );
      });
    });

    it("should use email prefix as username when display_name is missing", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      setupAuthenticatedUser({ displayName: "", email: "bob@corp.com" });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.username).toBe("bob");
    });

    it("should clean up auth_bridge_active flag before redirect", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      // Start without cached creds so login is triggered (sets the flag)
      mockAuthContext = createMockAuthContext({
        status: "unauthenticated",
        privyReady: true,
      });

      const { rerender } = render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
      expect(sessionStorage.getItem("auth_bridge_active")).toBe("terragon");

      // Now simulate auth success with credentials appearing
      setupAuthenticatedUser();
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });

      // Flag should be cleaned up before redirect
      expect(sessionStorage.getItem("auth_bridge_active")).toBeNull();
    });
  });

  // ============================
  // CALLBACK URL VALIDATION
  // ============================

  describe("callback URL validation", () => {
    it("should show error when callback is missing", async () => {
      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Missing callback URL/i)
        ).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should reject http:// on non-localhost domains", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "http://app.terragon.ai/callback"
      );
      setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid callback URL/i)
        ).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should reject unknown domains", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://evil.com/steal"
      );

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid callback URL/i)
        ).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    const allowedDomains = [
      "https://app.terragon.ai/callback",
      "https://terragon-www-production.up.railway.app/callback",
      "https://inbox.gatewayz.ai/callback",
      "http://localhost:3000/callback",
    ];

    it.each(allowedDomains)("should accept %s", async (url) => {
      mockSearchParams.set("redirect_uri", url);
      setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });
    });

    it("should accept domains from NEXT_PUBLIC_TERRAGON_CALLBACK_URLS env", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS;
      process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS =
        "https://my-custom-terragon.vercel.app";

      try {
        // This domain is not in the static allow-list
        mockSearchParams.set(
          "redirect_uri",
          "https://my-custom-terragon.vercel.app/callback"
        );
        setupAuthenticatedUser();

        render(<TerragonAuthPage />);

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledTimes(1);
        });
      } finally {
        if (originalEnv === undefined) {
          delete process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS;
        } else {
          process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS = originalEnv;
        }
      }
    });

    it("should accept bare hostname from NEXT_PUBLIC_TERRAGON_CALLBACK_URLS env", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS;
      process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS = "custom-terragon.example.com";

      try {
        mockSearchParams.set(
          "redirect_uri",
          "https://custom-terragon.example.com/callback"
        );
        setupAuthenticatedUser();

        render(<TerragonAuthPage />);

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledTimes(1);
        });
      } finally {
        if (originalEnv === undefined) {
          delete process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS;
        } else {
          process.env.NEXT_PUBLIC_TERRAGON_CALLBACK_URLS = originalEnv;
        }
      }
    });
  });

  // ============================
  // FAST PATH (cached credentials)
  // ============================

  describe("fast path with cached credentials", () => {
    it("should skip Privy login when localStorage has credentials", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  // ============================
  // SLOW PATH (Privy login)
  // ============================

  describe("slow path with Privy login", () => {
    it("should trigger login when no cached credentials", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
      expect(sessionStorage.getItem("auth_bridge_active")).toBe("terragon");
    });

    it("should show loading when Privy is not ready", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockAuthContext = createMockAuthContext({ privyReady: false });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should use cached credentials fallback when auth errors", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      // No cached creds initially → triggers login
      mockAuthContext = createMockAuthContext({
        status: "unauthenticated",
        privyReady: true,
      });

      const { rerender } = render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      // Auth fails but cached credentials now exist (synced from another tab).
      // The effect checks getApiKey() twice: once at the fast-path (line 251)
      // and once at the auth-error fallback (line 275). We need the fast-path
      // call to return null so execution reaches the fallback.
      const token = "iv.ciphertext.authTag.signature";
      mockGetApiKey
        .mockReturnValueOnce(null)           // fast-path check → skip
        .mockReturnValue("gw_test_key_12345"); // auth-error fallback → found
      mockGetApiKeyWithRetry.mockResolvedValue("gw_test_key_12345");
      mockGetUserData
        .mockReturnValueOnce(null)           // fast-path check → skip
        .mockReturnValue({
          user_id: 42,
          email: "test@example.com",
          display_name: "TestUser",
          tier: "pro",
        });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token }),
      });
      mockAuthContext = createMockAuthContext({
        status: "error",
        error: "some auth error",
      });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });
    });

    it("should redirect after auth context becomes authenticated", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      // No cached creds initially
      mockAuthContext = createMockAuthContext({
        status: "unauthenticated",
        privyReady: true,
      });

      const { rerender } = render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      // Simulate successful authentication
      setupAuthenticatedUser();
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================
  // ERROR HANDLING
  // ============================

  describe("error handling", () => {
    it("should show error when token API fails", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockGetApiKey.mockReturnValue("key");
      mockGetApiKeyWithRetry.mockResolvedValue("key");
      mockGetUserData.mockReturnValue({
        user_id: 1,
        email: "a@b.com",
        display_name: "A",
        tier: "free",
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Auth bridge not configured" }),
      });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Auth bridge not configured/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Authentication Error/i)
        ).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should show error when API returns empty token", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      setupAuthenticatedUser({ token: "" });
      // Override the fetch mock to return empty token
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "" }),
      });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/empty auth token/i)
        ).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should show error when no API key after retries", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      mockGetApiKeyWithRetry.mockResolvedValue(null);

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/No API key available/i)
        ).toBeInTheDocument();
      });
    });

    it("should show error after auth retries exhausted", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockAuthContext = createMockAuthContext({
        status: "unauthenticated",
        privyReady: true,
      });

      const { rerender } = render(<TerragonAuthPage />);

      // Initial login
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      // Error → retry → error → retry → error → give up
      for (let i = 0; i < 2; i++) {
        mockAuthContext = createMockAuthContext({
          status: "error",
          error: `fail ${i}`,
        });
        rerender(<TerragonAuthPage />);
        await waitFor(() => {
          expect(mockLogin).toHaveBeenCalledTimes(i + 2);
        });
        mockAuthContext = createMockAuthContext({ status: "authenticating" });
        rerender(<TerragonAuthPage />);
      }

      // Final error — retries exhausted
      mockAuthContext = createMockAuthContext({
        status: "error",
        error: "final",
      });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Unable to authenticate after multiple attempts/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ============================
  // TIMEOUT
  // ============================

  describe("timeout", () => {
    it("should show error after 30s when stuck loading", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockAuthContext = createMockAuthContext({ privyReady: false });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
      });

      act(() => {
        jest.advanceTimersByTime(30_001);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Authentication is taking too long/i)
        ).toBeInTheDocument();
      });
    });

    it("should not timeout if already redirecting", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      setupAuthenticatedUser();

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });

      act(() => {
        jest.advanceTimersByTime(30_001);
      });

      expect(
        screen.queryByText(/Authentication is taking too long/i)
      ).not.toBeInTheDocument();
    });
  });

  // ============================
  // ABORT ON UNMOUNT
  // ============================

  describe("abort on unmount", () => {
    it("should abort in-flight fetch and not crash on unmount", async () => {
      mockSearchParams.set(
        "redirect_uri",
        "https://app.terragon.ai/callback"
      );
      mockGetApiKey.mockReturnValue("key");
      mockGetApiKeyWithRetry.mockResolvedValue("key");
      mockGetUserData.mockReturnValue({
        user_id: 1,
        email: "a@b.com",
        display_name: "A",
        tier: "free",
      });

      // Mock fetch that rejects with AbortError when the signal fires
      mockFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );

      const { unmount } = render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      unmount();

      // No crash — abort prevented state update on unmounted component
    });
  });
});
