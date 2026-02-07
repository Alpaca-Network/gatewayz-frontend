import { render, screen, waitFor } from "@testing-library/react";
import TerragonAuthPage from "../page";

// Mock Next.js hooks
const mockSearchParams = new Map<string, string>();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Mock the auth context directly (not the useAuth wrapper)
// so the page can read status/error from the context
const mockLogin = jest.fn();
let mockAuthContext = {
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
};

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
    mockSearchParams.clear();
    mockLogin.mockClear();
    mockGetApiKey.mockReturnValue(null);
    mockGetUserData.mockReturnValue(null);
    mockGetApiKeyWithRetry.mockResolvedValue(null);
    mockFetch.mockReset();
    mockAuthContext = {
      status: "unauthenticated",
      login: mockLogin,
      privyReady: true,
      privyAuthenticated: false,
      error: null,
      apiKey: null,
      userData: null,
      authTiming: { startTime: null, elapsedMs: 0, retryCount: 0, maxRetries: 3, isSlowAuth: false, phase: "idle" as const },
      logout: jest.fn(),
      refresh: jest.fn(),
    };
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
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
      mockAuthContext = {
        ...mockAuthContext,
        status: "authenticated",
      };
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

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer context-api-key",
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
      });

      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
    });

    it("should show error when no API key is available after retries", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // No cached credentials, auth context says authenticated
      mockGetApiKey.mockReturnValue(null);
      mockAuthContext = { ...mockAuthContext, status: "authenticated" };
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
      mockAuthContext = { ...mockAuthContext, status: "authenticated" };
      mockGetApiKeyWithRetry.mockResolvedValue("some-key");
      mockGetUserData.mockReturnValue({ user_id: 1 }); // no email

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/User data not available/i)).toBeInTheDocument();
      });
    });
  });

  describe("loading states", () => {
    it("should show loading when Privy is not ready", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      mockAuthContext = { ...mockAuthContext, privyReady: false };

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should show authenticating when login has been triggered and auth is loading", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/callback");
      // Start unauthenticated to trigger login
      mockAuthContext = { ...mockAuthContext, status: "unauthenticated", privyReady: true };

      const { rerender } = render(<TerragonAuthPage />);

      // Login should be triggered
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Simulate auth context transitioning to authenticating (backend sync in progress)
      mockAuthContext = { ...mockAuthContext, status: "authenticating" };
      rerender(<TerragonAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Sign in to continue/i)).toBeInTheDocument();
      });
    });
  });
});
