import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import AgentPage from "../page";

// Store original env
const originalEnv = process.env;

describe("AgentPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("when NEXT_PUBLIC_AGENT_URL is not set", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_AGENT_URL;
    });

    it("should render setup instructions", () => {
      render(<AgentPage />);

      expect(screen.getByText("Coding Agent")).toBeInTheDocument();
      expect(
        screen.getByText(/Agent URL not configured/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Setup Instructions:")).toBeInTheDocument();
    });

    it("should render deploy with Vercel button", () => {
      render(<AgentPage />);

      const deployButton = screen.getByRole("link", {
        name: /deploy with vercel/i,
      });
      expect(deployButton).toBeInTheDocument();
      expect(deployButton).toHaveAttribute(
        "href",
        expect.stringContaining("vercel.com/new/clone")
      );
    });

    it("should render link to coding-agent-template repository", () => {
      render(<AgentPage />);

      const repoLink = screen.getByRole("link", {
        name: /coding-agent-template/i,
      });
      expect(repoLink).toBeInTheDocument();
      expect(repoLink).toHaveAttribute(
        "href",
        "https://github.com/vercel-labs/coding-agent-template"
      );
    });
  });

  describe("when NEXT_PUBLIC_AGENT_URL is set", () => {
    const testAgentUrl = "https://test-coding-agent.vercel.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_AGENT_URL = testAgentUrl;
    });

    it("should render iframe with the agent URL", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute("src", testAgentUrl);
    });

    it("should render loading state initially", () => {
      render(<AgentPage />);

      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();
    });

    it("should have proper iframe sandbox attributes", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      );
    });

    it("should have clipboard permissions", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toHaveAttribute(
        "allow",
        "clipboard-read; clipboard-write"
      );
    });

    it("should show connection error after timeout", async () => {
      render(<AgentPage />);

      // Initially should show loading
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();

      // Fast-forward past the 15 second timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Should now show connection error
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Unable to connect to the Coding Agent/i)
      ).toBeInTheDocument();
    });

    it("should show retry button on connection error", async () => {
      render(<AgentPage />);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      expect(retryButton).toBeInTheDocument();
    });

    it("should show open directly link on connection error", async () => {
      render(<AgentPage />);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      const openDirectlyLink = screen.getByRole("link", {
        name: /open directly/i,
      });
      expect(openDirectlyLink).toBeInTheDocument();
      expect(openDirectlyLink).toHaveAttribute("href", testAgentUrl);
    });

    it("should display the configured URL in connection error", async () => {
      render(<AgentPage />);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      expect(screen.getByText(/Configured URL:/i)).toBeInTheDocument();
      expect(screen.getByText(testAgentUrl)).toBeInTheDocument();
    });

    it("should retry connection when retry button is clicked", async () => {
      render(<AgentPage />);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Verify error state
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      fireEvent.click(retryButton);

      // Should show loading again
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();
    });

    it("should hide loading state when iframe loads successfully", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");

      // Simulate iframe load
      fireEvent.load(iframe);

      // Loading message should be gone
      expect(
        screen.queryByText("Loading Coding Agent...")
      ).not.toBeInTheDocument();
    });

    it("should remount iframe with new key when retrying connection", () => {
      const { container } = render(<AgentPage />);

      // Get initial iframe key
      const initialIframe = container.querySelector("iframe");
      expect(initialIframe).toHaveAttribute("src", testAgentUrl);

      // Fast-forward past the timeout to trigger connection error
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Click retry
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      fireEvent.click(retryButton);

      // New iframe should be rendered (React will remount due to key change)
      const newIframe = container.querySelector("iframe");
      expect(newIframe).toBeInTheDocument();
      expect(newIframe).toHaveAttribute("src", testAgentUrl);
    });

    it("should not show connection error if iframe loads before timeout", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");

      // Simulate iframe load before timeout
      fireEvent.load(iframe);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Should NOT show connection error since iframe loaded successfully
      expect(screen.queryByText("Connection Failed")).not.toBeInTheDocument();
    });

    it("should clear existing timeout when retrying", () => {
      render(<AgentPage />);

      // Fast-forward to just before timeout
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      // Should still be loading
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();

      // Trigger timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Now in error state
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      fireEvent.click(retryButton);

      // Should be loading again
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();

      // Advance time but not enough to trigger new timeout
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should still be loading (not error yet)
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();
    });

    it("should show possible causes list in connection error", () => {
      render(<AgentPage />);

      // Fast-forward past the timeout
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      expect(screen.getByText("Possible causes:")).toBeInTheDocument();
      expect(
        screen.getByText(/The Coding Agent server is not running or unreachable/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Network connectivity issues or firewall blocking/i)
      ).toBeInTheDocument();
    });

    it("should show connection error again if retry times out", () => {
      render(<AgentPage />);

      // Fast-forward past the initial timeout to trigger connection error
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Verify we're in error state
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      fireEvent.click(retryButton);

      // Should be loading again
      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();
      expect(screen.queryByText("Connection Failed")).not.toBeInTheDocument();

      // Fast-forward past the retry timeout (another 15 seconds)
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Should show connection error again since iframe didn't load
      expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    });
  });
});
