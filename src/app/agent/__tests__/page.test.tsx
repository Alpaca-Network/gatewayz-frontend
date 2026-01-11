import { render, screen } from "@testing-library/react";
import AgentPage from "../page";

// Store original env
const originalEnv = process.env;

describe("AgentPage", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
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
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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
  });
});
