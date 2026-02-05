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
jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    loading: false,
    login: mockLogin,
    privyReady: true,
  }),
}));

// Mock the API functions
jest.mock("@/lib/api", () => ({
  getApiKey: () => null,
  getUserData: () => null,
}));

describe("TerragonAuthPage", () => {
  beforeEach(() => {
    mockSearchParams.clear();
    mockLogin.mockClear();
  });

  describe("callback parameter handling", () => {
    it('should accept "callback" parameter', async () => {
      const callbackUrl = "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback";
      mockSearchParams.set("callback", callbackUrl);

      render(<TerragonAuthPage />);

      // Should trigger login since user is not authenticated
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show authenticating state, not error
      expect(screen.queryByText(/Missing callback URL/i)).not.toBeInTheDocument();
    });

    it('should accept "redirect_uri" parameter (OAuth-style)', async () => {
      const redirectUri = "https://terragon-www-production.up.railway.app/api/auth/gatewayz/callback?returnUrl=%2Fdashboard";
      mockSearchParams.set("redirect_uri", redirectUri);

      render(<TerragonAuthPage />);

      // Should trigger login since user is not authenticated
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show authenticating state, not error
      expect(screen.queryByText(/Missing callback URL/i)).not.toBeInTheDocument();
    });

    it('should prefer "callback" over "redirect_uri" when both are present', async () => {
      // Use valid allowed domains for both parameters
      mockSearchParams.set("callback", "https://terragon-www-production.up.railway.app/callback");
      mockSearchParams.set("redirect_uri", "https://app.terragon.ai/redirect");

      render(<TerragonAuthPage />);

      // Should trigger login - the callback parameter should be used
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
});
