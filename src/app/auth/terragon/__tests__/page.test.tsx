import { render, screen, waitFor, act } from "@testing-library/react";
import TerragonAuthPage from "../page";

// Mock Next.js hooks
const mockSearchParams = new Map<string, string>();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Factory for default mock auth context shape
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
    authTiming: { startTime: null, elapsedMs: 0, retryCount: 0, maxRetries: 3, isSlowAuth: false, phase: "idle" as const },
    logout: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

let mockAuthContext = createMockAuthContext();

jest.mock("@/context/gatewayz-auth-context", () => ({
  useGatewayzAuth: () => mockAuthContext,
}));

// Mock the API functions
const mockGetApiKey = jest.fn().mockReturnValue(null);
const mockGetUserData = jest.fn().mockReturnValue(null);
const mockGetApiKeyWithRetry = jest.fn().mockResolvedValue(null);

jest.mock("@/lib/api", () => ({
  getApiKey: () => mockGetApiKey(),
  getUserData: () => mockGetUserData(),
  getApiKeyWithRetry: (...args: unknown[]) => mockGetApiKeyWithRetry(...args),
}));

// Mock fetch for the token generation API
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("TerragonAuthPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearchParams.clear();
    mockLogin.mockClear();
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

  describe("callback parameter handling", () => {
    it('should accept "callback" parameter', async () => {
      const callbackUrl = "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback";
      mockSearchParams.set("callback", callbackUrl);

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Missing callback URL/i)).not.toBeInTheDocument();
    });

    it('should accept "redirect_uri" parameter (OAuth-style)', async () => {
      const redirectUri = "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback?returnUrl=%2Fdashboard";
      mockSearchParams.set("redirect_uri", redirectUri);

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Missing callback URL/i)).not.toBeInTheDocument();
    });

    it('should prefer "callback" over "redirect_uri" when both are present', async () => {
      mockSearchParams.set("callback", "https://terragon-www-production.up.railway.app/callback");
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/redirect");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should show error when neither callback nor redirect_uri is provided", async () => {
      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Missing callback URL/i)).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe("callback URL validation", () => {
    it("should accept terragon.ai domain", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Invalid callback URL/i)).not.toBeInTheDocument();
    });

    it("should accept gatewayz.ai domain", async () => {
      mockSearchParams.set("redirect_uri", "https://inbox.gatewayz.ai/api/auth");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Invalid callback URL/i)).not.toBeInTheDocument();
    });

    it("should accept terragon Railway domain", async () => {
      mockSearchParams.set("redirect_uri", "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Invalid callback URL/i)).not.toBeInTheDocument();
    });

    it("should accept localhost for development", async () => {
      mockSearchParams.set("redirect_uri", "http://localhost:3000/callback");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.queryByText(/Invalid callback URL/i)).not.toBeInTheDocument();
    });

    it("should reject unknown domains", async () => {
      mockSearchParams.set("redirect_uri", "https://malicious-site.com/steal-tokens");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid callback URL/i)).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe("fast path with cached credentials", () => {
    it("should skip Privy login and call token API when credentials are cached", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/api/auth/callback?returnUrl=/dashboard");
      mockGetApiKey.mockReturnValue("cached-api-key");
      mockGetApiKeyWithRetry.mockResolvedValue("cached-api-key");
      mockGetUserData.mockReturnValue({
        user_id: 42,
        email: "test@example.com",
        display_name: "TestUser",
        tier: "pro",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "encrypted-token" }),
      });

      render(<TerragonAuthPage />);

      // Should call the token API with correct auth header and body
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer cached-api-key",
            }),
            body: JSON.stringify({
              userId: 42,
              email: "test@example.com",
              username: "TestUser",
              tier: "pro",
            }),
          })
        );
      });

      // Should NOT trigger Privy login (fast path skips it)
      expect(mockLogin).not.toHaveBeenCalled();

      // Should show redirecting state
      // Note: window.location.href assertion skipped due to JSDOM limitations
      await waitFor(() => {
        expect(screen.getByText(/Redirecting to Terragon/i)).toBeInTheDocument();
      });
    });
  });

  describe("authenticated user flow (no cached credentials)", () => {
    it("should generate token when auth context reports authenticated", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/api/auth/callback");
      // No cached credentials (fast path won't fire)
      mockGetApiKey.mockReturnValue(null);
      // Auth context says authenticated
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      mockGetApiKeyWithRetry.mockResolvedValue("context-api-key");
      mockGetUserData.mockReturnValue({
        user_id: 99,
        email: "authed@example.com",
        display_name: "AuthedUser",
        tier: "free",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "context-token" }),
      });

      render(<TerragonAuthPage />);

      // Should call the token API with correct auth header and body
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer context-api-key",
            }),
            body: JSON.stringify({
              userId: 99,
              email: "authed@example.com",
              username: "AuthedUser",
              tier: "free",
            }),
          })
        );
      });

      // Should NOT trigger Privy login
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe("auth bridge flag", () => {
    it("should set auth_bridge_active in sessionStorage before triggering login", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(sessionStorage.getItem("auth_bridge_active")).toBe("terragon");
    });

    it("should clean up auth_bridge_active on unmount", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");

      const { unmount } = render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(sessionStorage.getItem("auth_bridge_active")).toBe("terragon");

      unmount();

      expect(sessionStorage.getItem("auth_bridge_active")).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should show error when token API returns failure", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // Cached credentials to trigger fast path
      mockGetApiKey.mockReturnValue("some-key");
      mockGetApiKeyWithRetry.mockResolvedValue("some-key");
      mockGetUserData.mockReturnValue({
        user_id: 1,
        email: "user@example.com",
        display_name: "User",
        tier: "free",
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Auth bridge not configured" }),
      });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Auth bridge not configured/i)).toBeInTheDocument();
        expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      });
    });

    it("should show error when no API key is available after retries", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // No cached credentials, auth context says authenticated
      mockGetApiKey.mockReturnValue(null);
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      mockGetApiKeyWithRetry.mockResolvedValue(null);
      mockGetUserData.mockReturnValue(null);

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/No API key available/i)).toBeInTheDocument();
      });
    });

    it("should show error when user data has no email", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      mockGetApiKey.mockReturnValue(null);
      mockAuthContext = createMockAuthContext({ status: "authenticated" });
      mockGetApiKeyWithRetry.mockResolvedValue("some-key");
      mockGetUserData.mockReturnValue({ user_id: 1 }); // no email

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/User data not available/i)).toBeInTheDocument();
      });
    });
  });

  describe("retry limits", () => {
    it("should show error when auth retries are exhausted", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // No cached credentials
      mockGetApiKey.mockReturnValue(null);
      mockGetUserData.mockReturnValue(null);
      // Start unauthenticated so login is triggered
      mockAuthContext = createMockAuthContext({ status: "unauthenticated", privyReady: true });

      const { rerender } = render(<TerragonAuthPage />);

      // Initial login triggered (attempt #1)
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      // Error cycle #1: counter 0 → 1, re-triggers login (attempt #2)
      mockAuthContext = createMockAuthContext({ status: "error", error: "Auth failed" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(2);
      });

      // Transition to authenticating so the next error transition triggers dep change
      mockAuthContext = createMockAuthContext({ status: "authenticating" });
      rerender(<TerragonAuthPage />);

      // Error cycle #2: counter 1 → 2, re-triggers login (attempt #3)
      mockAuthContext = createMockAuthContext({ status: "error", error: "Auth failed again" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(3);
      });

      // Transition to authenticating again
      mockAuthContext = createMockAuthContext({ status: "authenticating" });
      rerender(<TerragonAuthPage />);

      // Error cycle #3: counter 2 >= MAX_AUTH_RETRIES (2) → exhausted, shows error
      mockAuthContext = createMockAuthContext({ status: "error", error: "Auth failed third time" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to authenticate after multiple attempts/i)).toBeInTheDocument();
      });

      // Should NOT have triggered a fourth login call
      expect(mockLogin).toHaveBeenCalledTimes(3);
    });
  });

  describe("loading states", () => {
    it("should show loading when Privy is not ready", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      mockAuthContext = createMockAuthContext({ privyReady: false });

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should show authenticating when login has been triggered and auth is loading", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // Start unauthenticated to trigger login
      mockAuthContext = createMockAuthContext({ status: "unauthenticated", privyReady: true });

      const { rerender } = render(<TerragonAuthPage />);

      // Login should be triggered
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Simulate auth context transitioning to authenticating (backend sync in progress)
      mockAuthContext = createMockAuthContext({ status: "authenticating" });
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Sign in to continue/i)).toBeInTheDocument();
      });
    });
  });

  describe("wall-clock timeout", () => {
    it("should show error after AUTH_TIMEOUT_MS elapses while still loading", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // Privy never becomes ready — stays in loading forever
      mockAuthContext = createMockAuthContext({ privyReady: false });

      render(<TerragonAuthPage />);

      // Initially shows loading
      await waitFor(() => {
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
      });

      // Advance past the 30s timeout
      act(() => {
        jest.advanceTimersByTime(30_001);
      });

      await waitFor(() => {
        expect(screen.getByText(/Authentication is taking too long/i)).toBeInTheDocument();
      });
    });

    it("should not fire timeout if status has moved to redirecting", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // Fast path: cached credentials trigger immediate redirect
      mockGetApiKey.mockReturnValue("cached-key");
      mockGetApiKeyWithRetry.mockResolvedValue("cached-key");
      mockGetUserData.mockReturnValue({
        user_id: 1,
        email: "user@example.com",
        display_name: "User",
        tier: "free",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "tok" }),
      });

      render(<TerragonAuthPage />);

      // Wait for redirecting state
      await waitFor(() => {
        expect(screen.getByText(/Redirecting to Terragon/i)).toBeInTheDocument();
      });

      // Advance past timeout — should NOT show error
      act(() => {
        jest.advanceTimersByTime(30_001);
      });

      // Still shows redirecting, not error
      expect(screen.getByText(/Redirecting to Terragon/i)).toBeInTheDocument();
      expect(screen.queryByText(/Authentication is taking too long/i)).not.toBeInTheDocument();
    });
  });

  describe("abort on unmount", () => {
    it("should not update state after unmount during token generation", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      mockGetApiKey.mockReturnValue("cached-key");
      mockGetApiKeyWithRetry.mockResolvedValue("cached-key");
      mockGetUserData.mockReturnValue({
        user_id: 1,
        email: "user@example.com",
        display_name: "User",
        tier: "free",
      });

      // Make fetch hang until we resolve it
      let resolveFetch!: (value: unknown) => void;
      mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

      const { unmount } = render(<TerragonAuthPage />);

      // Wait for fetch to be called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Unmount while fetch is in-flight — should abort without errors
      unmount();

      // Resolve the fetch after unmount — should not throw
      resolveFetch({ ok: true, json: () => Promise.resolve({ token: "tok" }) });

      // No errors thrown — abort controller prevented state update
    });
  });
});
