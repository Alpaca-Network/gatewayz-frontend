import { render, screen, waitFor } from "@testing-library/react";
import TerragonAuthPage from "../page";

// Mock Next.js hooks
const mockSearchParams = new Map<string, string>();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Mock the auth hook
const mockLogin = jest.fn();
let mockAuthState = {
  isAuthenticated: false,
  loading: false,
  login: mockLogin,
  privyReady: true,
};

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

// Mock the API functions
const mockGetApiKeyWithRetry = jest.fn().mockResolvedValue(null);
const mockGetUserData = jest.fn().mockReturnValue(null);

jest.mock("@/lib/api", () => ({
  getApiKeyWithRetry: (...args: unknown[]) => mockGetApiKeyWithRetry(...args),
  getUserData: () => mockGetUserData(),
}));

// Mock fetch for the token generation API
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("TerragonAuthPage", () => {
  beforeEach(() => {
    mockSearchParams.clear();
    mockLogin.mockClear();
    mockGetApiKeyWithRetry.mockResolvedValue(null);
    mockGetUserData.mockReturnValue(null);
    mockFetch.mockReset();
    mockAuthState = {
      isAuthenticated: false,
      loading: false,
      login: mockLogin,
      privyReady: true,
    };
    // Clear sessionStorage
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

  describe("authenticated user flow", () => {
    it("should generate token and redirect when user is already authenticated", async () => {
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/api/auth/callback?returnUrl=/dashboard");
      mockAuthState = {
        isAuthenticated: true,
        loading: false,
        login: mockLogin,
        privyReady: true,
      };
      mockGetApiKeyWithRetry.mockResolvedValue("test-api-key-12345");
      mockGetUserData.mockReturnValue({
        user_id: 42,
        email: "test@example.com",
        display_name: "TestUser",
        tier: "pro",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "encrypted-token-value" }),
      });

      // Mock window.location.href
      const locationHrefSpy = jest.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        href: window.location.href,
      } as Location);
      delete (window as { location?: Location }).location;
      window.location = { href: "" } as Location;

      render(<TerragonAuthPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test-api-key-12345",
            }),
          })
        );
      });

      // Should redirect with gwauth token
      await waitFor(() => {
        expect(window.location.href).toContain("gwauth=encrypted-token-value");
      });

      // Should not trigger login
      expect(mockLogin).not.toHaveBeenCalled();

      // Restore
      locationHrefSpy?.mockRestore();
    });
  });
});
