import { render, screen, act } from "@testing-library/react";
import AgentPage from "../page";

// Store original env
const originalEnv = process.env;

describe("AgentPage", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
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

    it("should not show loading state when URL is not configured", () => {
      render(<AgentPage />);

      expect(
        screen.queryByText("Loading Coding Agent...")
      ).not.toBeInTheDocument();
    });
  });

  describe("URL validation", () => {
    it("should reject HTTP URLs", () => {
      process.env.NEXT_PUBLIC_AGENT_URL = "http://test-agent.vercel.app";
      render(<AgentPage />);

      expect(screen.getByText(/Invalid agent URL/i)).toBeInTheDocument();
      expect(screen.queryByTitle("Coding Agent")).not.toBeInTheDocument();
    });

    it("should reject URLs from unapproved domains", () => {
      process.env.NEXT_PUBLIC_AGENT_URL = "https://malicious-site.com";
      render(<AgentPage />);

      expect(screen.getByText(/Invalid agent URL/i)).toBeInTheDocument();
      expect(screen.queryByTitle("Coding Agent")).not.toBeInTheDocument();
    });

    it("should accept HTTPS URLs from vercel.app domain", () => {
      process.env.NEXT_PUBLIC_AGENT_URL =
        "https://my-coding-agent.vercel.app";
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toBeInTheDocument();
    });

    it("should accept HTTPS URLs from gatewayz.ai domain", () => {
      process.env.NEXT_PUBLIC_AGENT_URL = "https://agent.gatewayz.ai";
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toBeInTheDocument();
    });

    it("should reject malformed URLs", () => {
      process.env.NEXT_PUBLIC_AGENT_URL = "not-a-valid-url";
      render(<AgentPage />);

      expect(screen.getByText(/Invalid agent URL/i)).toBeInTheDocument();
    });
  });

  describe("loading timeout", () => {
    const testAgentUrl = "https://test-coding-agent.vercel.app";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_AGENT_URL = testAgentUrl;
    });

    it("should show timeout error after 30 seconds", () => {
      render(<AgentPage />);

      expect(screen.getByText("Loading Coding Agent...")).toBeInTheDocument();

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
      expect(
        screen.queryByText("Loading Coding Agent...")
      ).not.toBeInTheDocument();
    });
  });

  describe("when NEXT_PUBLIC_AGENT_URL is set to valid URL", () => {
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

    it("should have secure iframe sandbox attributes without allow-same-origin", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      );
      // Critical security check: ensure allow-same-origin is NOT present
      expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    });

    it("should have clipboard permissions", () => {
      render(<AgentPage />);

      const iframe = screen.getByTitle("Coding Agent");
      expect(iframe).toHaveAttribute(
        "allow",
        "clipboard-read; clipboard-write"
      );
    });
  });
});
