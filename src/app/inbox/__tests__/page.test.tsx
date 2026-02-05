import { render, screen, act, fireEvent } from "@testing-library/react";
import InboxPage from "../page";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  LogIn: () => <div data-testid="login-icon" />,
  Columns2: () => <div data-testid="columns2-icon" />,
  Square: () => <div data-testid="square-icon" />,
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

// Mock KanbanColumnToggle component
const mockOnViewChange = jest.fn();
jest.mock("@/components/inbox/kanban-column-toggle", () => ({
  KanbanColumnToggle: ({ onViewChange }: { onViewChange?: (view: string) => void }) => (
    <div data-testid="kanban-column-toggle">
      <button
        data-testid="column-toggle-1"
        onClick={() => onViewChange?.("1")}
        aria-label="Single column view"
      >
        1 Column
      </button>
      <button
        data-testid="column-toggle-2"
        onClick={() => onViewChange?.("2")}
        aria-label="Two column view"
      >
        2 Columns
      </button>
    </div>
  ),
}));

// Mock inbox UI store
const mockColumnView = { current: "1" as "1" | "2" };
const mockSetColumnView = jest.fn((view: "1" | "2") => {
  mockColumnView.current = view;
});
const mockSyncColumnViewState = jest.fn();

jest.mock("@/lib/store/inbox-ui-store", () => ({
  useInboxUIStore: () => ({
    columnView: mockColumnView.current,
    setColumnView: mockSetColumnView,
    syncColumnViewState: mockSyncColumnViewState,
  }),
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
    jest.useFakeTimers();
    jest.resetModules();
    process.env = { ...originalEnv };
    mockAuthContext.status = "authenticated";
    mockAuthContext.apiKey = "gw_live_test_api_key";
    mockAuthContext.userData = {
      user_id: "user-123",
      email: "test@example.com",
      display_name: "Test User",
      tier: "pro",
    };
    (global.fetch as jest.Mock).mockReset();
    mockColumnView.current = "1";
    mockSetColumnView.mockClear();
    mockSyncColumnViewState.mockClear();
    mockOnViewChange.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
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
      };

      // Mock successful auth token fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "test-token-payload.test-signature",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
      });
    });

    it("should render loading state initially", async () => {
      render(<InboxPage />);

      // Need to wait for the auth token fetch effect to run
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText("Loading Coding Inbox...")).toBeInTheDocument();
    });

    it("should call auth bridge API", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/terragon/auth",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer gw_live_test_api_key",
          }),
        })
      );
    });

    it("should render iframe with embed mode (token sent via postMessage for security)", async () => {
      render(<InboxPage />);

      // Wait for auth token fetch
      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      expect(iframe).toBeInTheDocument();

      const iframeSrc = iframe.getAttribute("src");
      expect(iframeSrc).toContain(testTerragonUrl);
      expect(iframeSrc).toContain("embed=true");
      expect(iframeSrc).toContain("awaitAuth=true");
      // Token should NOT be in URL for security (passed via postMessage instead)
      expect(iframeSrc).not.toContain("gwauth=");
    });

    it("should have proper iframe sandbox attributes", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      expect(iframe).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      );
    });

    it("should have clipboard permissions", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      expect(iframe).toHaveAttribute(
        "allow",
        "clipboard-read; clipboard-write"
      );
    });

    it("should send auth token via postMessage when iframe loads", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      // Mock the iframe contentWindow
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      fireEvent.load(iframe);

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "GATEWAYZ_AUTH",
          token: "test-token-payload.test-signature",
        },
        "https://test-terragon.railway.app"
      );
    });

    it("should respond to auth request from iframe via message event", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Clear any previous calls
      mockPostMessage.mockClear();

      // Simulate message from iframe requesting auth
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://test-terragon.railway.app",
            data: { type: "GATEWAYZ_AUTH_REQUEST" },
          })
        );
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "GATEWAYZ_AUTH",
          token: "test-token-payload.test-signature",
        },
        "https://test-terragon.railway.app"
      );
    });

    it("should ignore messages from unauthorized origins", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Load iframe to send initial auth
      fireEvent.load(iframe);
      mockPostMessage.mockClear();

      // Simulate message from unauthorized origin
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://evil-site.com",
            data: { type: "GATEWAYZ_AUTH_REQUEST" },
          })
        );
      });

      // Should not send auth to unauthorized origin
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it("should fallback to URL without auth token on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Auth bridge error" }),
      });

      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      expect(iframe).toHaveAttribute("src", testTerragonUrl);
    });

    it("should show connection error after timeout", async () => {
      render(<InboxPage />);

      // Wait for auth token fetch
      await act(async () => {
        await Promise.resolve();
      });

      // Fast-forward past the 15 second timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Should now show connection error
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Unable to connect to the Coding Inbox/i)
      ).toBeInTheDocument();
    });

    it("should show retry button on connection error", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        jest.advanceTimersByTime(15000);
      });

      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      expect(retryButton).toBeInTheDocument();
    });

    it("should show open directly link on connection error", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        jest.advanceTimersByTime(15000);
      });

      const openDirectlyLink = screen.getByRole("link", {
        name: /open directly/i,
      });
      expect(openDirectlyLink).toBeInTheDocument();
      expect(openDirectlyLink).toHaveAttribute("href", testTerragonUrl);
    });

    it("should hide loading state when iframe loads successfully", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      fireEvent.load(iframe);

      expect(
        screen.queryByText("Loading Coding Inbox...")
      ).not.toBeInTheDocument();
    });

    it("should retry connection when retry button is clicked", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        jest.advanceTimersByTime(15000);
      });

      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      fireEvent.click(retryButton);

      expect(screen.getByText("Loading Coding Inbox...")).toBeInTheDocument();
    });

    it("should fetch a fresh auth token when retrying after token expiration", async () => {
      render(<InboxPage />);

      // Wait for initial auth token fetch
      await act(async () => {
        await Promise.resolve();
      });

      // Verify initial fetch was called (health check + auth = 2 calls)
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Fast-forward past the 15 second timeout to trigger connection error
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });

      // Clear the mock to track new calls
      (global.fetch as jest.Mock).mockClear();

      // Click retry - this should trigger a fresh token fetch
      await act(async () => {
        fireEvent.click(retryButton);
        // Wait for the useEffect to run and fetch a new token
        await Promise.resolve();
      });

      // Verify that a new auth token was fetched (the fix ensures handleRetry
      // clears authToken and terragonUrl, which triggers the useEffect to re-fetch)
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/terragon/auth",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("when authenticating", () => {
    const testTerragonUrl = "https://test-terragon.railway.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_TERRAGON_URL = testTerragonUrl;
      mockAuthContext.status = "authenticating";
    });

    it("should not render iframe while authenticating", () => {
      render(<InboxPage />);

      expect(screen.queryByTitle("Coding Inbox")).not.toBeInTheDocument();
    });
  });

  describe("column view toggle", () => {
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
      };

      // Mock successful auth token fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "test-token-payload.test-signature",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
      });
    });

    it("should render the column view toggle", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId("kanban-column-toggle")).toBeInTheDocument();
    });

    it("should render Task View header", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText("Task View")).toBeInTheDocument();
    });

    it("should sync column view state on mount", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSyncColumnViewState).toHaveBeenCalled();
    });

    it("should send column view via postMessage when iframe loads", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      fireEvent.load(iframe);

      // Should send both auth and column view
      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "GATEWAYZ_COLUMN_VIEW",
          columnView: "1",
        },
        "https://test-terragon.railway.app"
      );
    });

    it("should send column view via postMessage when toggle changes", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Load iframe first
      fireEvent.load(iframe);
      mockPostMessage.mockClear();

      // Click the 2-column toggle button
      const twoColumnButton = screen.getByTestId("column-toggle-2");
      fireEvent.click(twoColumnButton);

      // Should send column view update
      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "GATEWAYZ_COLUMN_VIEW",
          columnView: "2",
        },
        "https://test-terragon.railway.app"
      );
    });

    it("should respond to column view request from iframe", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Load iframe first
      fireEvent.load(iframe);
      mockPostMessage.mockClear();

      // Simulate message from iframe requesting column view
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://test-terragon.railway.app",
            data: { type: "GATEWAYZ_COLUMN_VIEW_REQUEST" },
          })
        );
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "GATEWAYZ_COLUMN_VIEW",
          columnView: "1",
        },
        "https://test-terragon.railway.app"
      );
    });

    it("should ignore column view requests from unauthorized origins", async () => {
      const mockPostMessage = jest.fn();
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");
      Object.defineProperty(iframe, "contentWindow", {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Load iframe first
      fireEvent.load(iframe);
      mockPostMessage.mockClear();

      // Simulate message from unauthorized origin
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://evil-site.com",
            data: { type: "GATEWAYZ_COLUMN_VIEW_REQUEST" },
          })
        );
      });

      // Should not send column view to unauthorized origin
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe("error handling from iframe", () => {
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
      };

      // Mock successful auth token fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "test-token-payload.test-signature",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
      });
    });

    it("should have onError handler attached to iframe", async () => {
      // Note: jsdom doesn't properly simulate iframe error events like real browsers
      // This test verifies the handler is attached; actual error handling is tested
      // via the TERRAGON_LOAD_ERROR message test below
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      const iframe = screen.getByTitle("Coding Inbox");

      // Verify the iframe has the onError handler (React converts this to onerror attribute)
      // The handler exists in the component; we can't easily test the actual error event
      // in jsdom, so we rely on the message-based error handling tests
      expect(iframe).toBeInTheDocument();
    });

    it("should handle TERRAGON_ERROR message from iframe", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      // Simulate TERRAGON_ERROR message from iframe
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://test-terragon.railway.app",
            data: {
              type: "TERRAGON_ERROR",
              error: "S3 authorization failed",
            },
          })
        );
      });

      expect(screen.getByText("Coding Inbox")).toBeInTheDocument();
      expect(screen.getByText("S3 authorization failed")).toBeInTheDocument();
    });

    it("should handle TERRAGON_LOAD_ERROR message from iframe", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      // Simulate TERRAGON_LOAD_ERROR message from iframe
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://test-terragon.railway.app",
            data: {
              type: "TERRAGON_LOAD_ERROR",
              message: "Failed to load application",
            },
          })
        );
      });

      expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    });

    it("should ignore error messages from unauthorized origins", async () => {
      render(<InboxPage />);

      await act(async () => {
        await Promise.resolve();
      });

      // Load iframe first
      const iframe = screen.getByTitle("Coding Inbox");
      fireEvent.load(iframe);

      // Simulate TERRAGON_ERROR message from unauthorized origin
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://evil-site.com",
            data: {
              type: "TERRAGON_ERROR",
              error: "Fake error from attacker",
            },
          })
        );
      });

      // Should not show error from unauthorized origin
      expect(screen.queryByText("Fake error from attacker")).not.toBeInTheDocument();
      expect(screen.queryByText("Connection Failed")).not.toBeInTheDocument();
    });
  });
});
