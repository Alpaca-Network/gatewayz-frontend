/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

// Track redirect calls for assertions
let lastRedirectUrl: string | null = null;

// Mock the redirect utility BEFORE importing the component
jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  redirectTo: jest.fn((url: string) => {
    lastRedirectUrl = url;
  }),
}));

// Import the mocked function for assertions
import { redirectTo } from "@/lib/utils";

// Import the component AFTER setting up the mock
import InboxPage from "../page";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  LogIn: () => <div data-testid="login-icon" />,
}));

// Mock UI components
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, asChild, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) => {
    if (asChild) {
      return <>{children}</>;
    }
    return <button onClick={onClick} {...props}>{children}</button>;
  },
}));

// Mock the auth context
const mockLogin = jest.fn();
const mockAuthContext = {
  status: "authenticated" as const,
  apiKey: "gw_live_test_api_key",
  userData: {
    user_id: "user-123",
    email: "test@example.com",
    display_name: "Test User",
    tier: "pro",
  },
  login: mockLogin,
  logout: jest.fn(),
  refresh: jest.fn(),
  privyUser: null,
  privyReady: true,
  privyAuthenticated: true,
  error: null,
  authTiming: {
    startTime: null,
    elapsedMs: 0,
    retryCount: 0,
    maxRetries: 3,
    isSlowAuth: false,
    phase: "idle" as const,
  },
};

jest.mock("@/context/gatewayz-auth-context", () => ({
  useGatewayzAuth: () => mockAuthContext,
}));

// Mock fetch
global.fetch = jest.fn();

// Store original env
const originalEnv = process.env;

describe("InboxPage", () => {
  beforeEach(() => {
    // Reset environment but NOT modules (to keep mocks intact)
    process.env = { ...originalEnv };
    mockAuthContext.status = "authenticated";
    mockAuthContext.apiKey = "gw_live_test_api_key";
    mockAuthContext.userData = {
      user_id: "user-123",
      email: "test@example.com",
      display_name: "Test User",
      tier: "pro",
    };
    // Reset all mock implementations and calls
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    lastRedirectUrl = null;
  });

  afterEach(() => {
    // Clean up rendered components between tests
    cleanup();
    jest.clearAllTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("when NEXT_PUBLIC_TERRAGON_URL is not set", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_TERRAGON_URL;
    });

    it("should render setup instructions", () => {
      render(<InboxPage />);

      expect(screen.getByText("Coding Inbox")).toBeInTheDocument();
      expect(
        screen.getByText(/Terragon URL not configured/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Setup Instructions:")).toBeInTheDocument();
    });

    it("should render link to terragon-oss repository", () => {
      render(<InboxPage />);

      const repoLink = screen.getByRole("link", {
        name: /terragon-oss/i,
      });
      expect(repoLink).toBeInTheDocument();
      expect(repoLink).toHaveAttribute(
        "href",
        "https://github.com/terragon-labs/terragon-oss"
      );
    });
  });

  describe("when user is unauthenticated", () => {
    const testTerragonUrl = "https://test-terragon.railway.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = testTerragonUrl;
      mockAuthContext.status = "unauthenticated";
      mockAuthContext.apiKey = null;
      mockAuthContext.userData = null;
    });

    it("should render sign in prompt", () => {
      render(<InboxPage />);

      expect(screen.getByText("Coding Inbox")).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to access your AI coding inbox/i)
      ).toBeInTheDocument();
    });

    it("should render sign in button", () => {
      render(<InboxPage />);

      const signInButton = screen.getByRole("button", {
        name: /sign in to continue/i,
      });
      expect(signInButton).toBeInTheDocument();
    });

    it("should call login when sign in button is clicked", () => {
      render(<InboxPage />);

      const signInButton = screen.getByRole("button", {
        name: /sign in to continue/i,
      });
      fireEvent.click(signInButton);

      expect(mockLogin).toHaveBeenCalled();
    });
  });

  describe("when NEXT_PUBLIC_TERRAGON_URL is set and user is authenticated", () => {
    const testTerragonUrl = "https://test-terragon.railway.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = testTerragonUrl;
      mockAuthContext.status = "authenticated";
      mockAuthContext.apiKey = "gw_live_test_api_key";
      mockAuthContext.userData = {
        user_id: "user-123",
        email: "test@example.com",
        display_name: "Test User",
        tier: "pro",
        credits: 5000, // $50 in cents
        subscription_allowance: 2000, // $20 monthly allowance
        purchased_credits: 3000, // $30 purchased
      };
      // Note: Individual tests set up their own fetch mocks
    });

    const setupSuccessfulFetch = () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "test-token-payload.test-signature",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
      });
    };

    const setupFailedFetch = () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Auth bridge error" }),
      });
    };

    it("should render redirecting state", async () => {
      setupSuccessfulFetch();
      render(<InboxPage />);

      await waitFor(() => {
        expect(screen.getByText(/Redirecting to Coding Inbox.../i)).toBeInTheDocument();
      });
    });

    it("should call auth bridge API with credits information", async () => {
      setupSuccessfulFetch();
      render(<InboxPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/terragon/auth",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer gw_live_test_api_key",
            }),
            body: JSON.stringify({
              userId: "user-123",
              email: "test@example.com",
              username: "Test User",
              tier: "pro",
              credits: 5000,
              subscriptionAllowance: 2000,
              purchasedCredits: 3000,
            }),
          })
        );
      });
    });

    it("should redirect to Terragon with auth token", async () => {
      setupSuccessfulFetch();
      render(<InboxPage />);

      await waitFor(() => {
        expect(redirectTo).toHaveBeenCalledWith(
          `${testTerragonUrl}/?gwauth=test-token-payload.test-signature`
        );
      });
    });

    it("should show error on API failure", async () => {
      setupFailedFetch();
      render(<InboxPage />);

      await waitFor(() => {
        expect(screen.getByText("Auth bridge error")).toBeInTheDocument();
      });
    });

    it("should show try again button on error", async () => {
      setupFailedFetch();
      render(<InboxPage />);

      await waitFor(() => {
        const tryAgainButton = screen.getByRole("button", {
          name: /try again/i,
        });
        expect(tryAgainButton).toBeInTheDocument();
      });
    });

    it("should show open directly link on error", async () => {
      setupFailedFetch();
      render(<InboxPage />);

      await waitFor(() => {
        const openDirectlyLink = screen.getByRole("link", {
          name: /open terragon directly/i,
        });
        expect(openDirectlyLink).toBeInTheDocument();
        expect(openDirectlyLink).toHaveAttribute("href", testTerragonUrl);
      });
    });

    it("should retry when try again button is clicked", async () => {
      // Set up mock to return error first, then success on retry
      let callCount = 0;
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Auth bridge error" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              token: "new-test-token",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            }),
        });
      });

      render(<InboxPage />);

      // Wait for error state (first fetch fails)
      await waitFor(() => {
        expect(screen.getByText("Auth bridge error")).toBeInTheDocument();
      });

      // Click try again
      const tryAgainButton = screen.getByRole("button", {
        name: /try again/i,
      });
      fireEvent.click(tryAgainButton);

      // Should redirect after retry succeeds (second fetch succeeds)
      await waitFor(() => {
        expect(redirectTo).toHaveBeenCalledWith(
          `${testTerragonUrl}/?gwauth=new-test-token`
        );
      });
    });
  });

  describe("when authenticating", () => {
    const testTerragonUrl = "https://test-terragon.railway.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = testTerragonUrl;
      mockAuthContext.status = "authenticating";
    });

    it("should show loading state while authenticating", () => {
      render(<InboxPage />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should not redirect while authenticating", () => {
      render(<InboxPage />);

      expect(redirectTo).not.toHaveBeenCalled();
    });
  });

  describe("when status is idle", () => {
    const testTerragonUrl = "https://test-terragon.railway.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = testTerragonUrl;
      mockAuthContext.status = "idle";
    });

    it("should show loading state while idle", () => {
      render(<InboxPage />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should not redirect while idle", () => {
      render(<InboxPage />);

      expect(redirectTo).not.toHaveBeenCalled();
    });
  });
});
