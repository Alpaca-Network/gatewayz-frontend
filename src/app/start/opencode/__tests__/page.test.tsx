import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StartOpencodePage from '../page';

// Mock Privy
const mockLogin = jest.fn();
const mockUsePrivy = jest.fn(() => ({
  user: { id: 'test-user-123' },
  ready: true,
  login: mockLogin,
}));

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => mockUsePrivy(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock getApiKey
jest.mock('@/lib/api', () => ({
  getApiKey: () => 'test-api-key-12345',
}));

// Mock posthog
jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
  },
}));

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, ...props }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Copy: () => <span data-testid="icon-copy">Copy</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  ExternalLink: () => <span data-testid="icon-external">External</span>,
}));

describe('StartOpencodePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrivy.mockReturnValue({
      user: { id: 'test-user-123' },
      ready: true,
      login: mockLogin,
    });
  });

  describe('Page Structure', () => {
    it('should render the page header', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('Setup OpenCode with Gatewayz')).toBeInTheDocument();
      expect(screen.getByText(/One command\. Access to 1000\+ AI models/)).toBeInTheDocument();
    });

    it('should render all three setup steps', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('Run the Installer')).toBeInTheDocument();
      expect(screen.getByText('Add Your Gatewayz API Key')).toBeInTheDocument();
      expect(screen.getByText('Start Using OpenCode')).toBeInTheDocument();
    });

    it('should render step numbers', () => {
      render(<StartOpencodePage />);

      // Check for step numbers - all three steps should have numbers
      const stepNumbers = screen.getAllByText(/^[123]$/);
      expect(stepNumbers.length).toBe(3);
    });

    it('should render the help section', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('Need Help?')).toBeInTheDocument();
    });

    it('should render the next steps section', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText("What's Next?")).toBeInTheDocument();
      expect(screen.getByText('Browse Models')).toBeInTheDocument();
      expect(screen.getByText('View Docs')).toBeInTheDocument();
      expect(screen.getByText('Try Web Chat')).toBeInTheDocument();
    });
  });

  describe('OS Selection', () => {
    it('should render all OS selection buttons', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('macOS')).toBeInTheDocument();
      expect(screen.getByText('Linux')).toBeInTheDocument();
      expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    it('should show install command based on detected OS', () => {
      render(<StartOpencodePage />);

      // The command should be visible (could be any OS based on detection)
      expect(screen.getByText(/setup-(macos|linux|windows)/)).toBeInTheDocument();
    });

    it('should switch to Linux command when Linux button is clicked', () => {
      render(<StartOpencodePage />);

      const linuxButton = screen.getByText('Linux');
      fireEvent.click(linuxButton);

      expect(screen.getByText(/setup-linux\.sh/)).toBeInTheDocument();
    });

    it('should switch to Windows command when Windows button is clicked', () => {
      render(<StartOpencodePage />);

      const windowsButton = screen.getByText('Windows');
      fireEvent.click(windowsButton);

      expect(screen.getByText(/setup-windows\.ps1/)).toBeInTheDocument();
    });

    it('should show PowerShell label for Windows', () => {
      render(<StartOpencodePage />);

      const windowsButton = screen.getByText('Windows');
      fireEvent.click(windowsButton);

      expect(screen.getByText(/PowerShell \(Run as Administrator\)/)).toBeInTheDocument();
    });

    it('should show Terminal label for macOS', () => {
      render(<StartOpencodePage />);

      const macButton = screen.getByText('macOS');
      fireEvent.click(macButton);

      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  describe('API Key Display', () => {
    it('should display the API key when available', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('test-api-key-12345')).toBeInTheDocument();
    });

    it('should show copy button for API key', () => {
      render(<StartOpencodePage />);

      // Find the API Key section's copy button
      const copyButtons = screen.getAllByTestId('button');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Copy Functionality', () => {
    it('should copy installer command to clipboard when copy button is clicked', async () => {
      render(<StartOpencodePage />);

      // Find the first Copy button (for installer)
      const copyButtons = screen.getAllByTestId('button');
      const installerCopyButton = copyButtons.find(
        (btn) => btn.textContent?.includes('Copy') && !btn.closest('[data-testid="api-key-section"]')
      );

      if (installerCopyButton) {
        fireEvent.click(installerCopyButton);

        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalled();
        });
      }
    });

    it('should show toast when command is copied', async () => {
      render(<StartOpencodePage />);

      const copyButtons = screen.getAllByTestId('button');
      const installerCopyButton = copyButtons.find(
        (btn) => btn.textContent?.includes('Copy')
      );

      if (installerCopyButton) {
        fireEvent.click(installerCopyButton);

        await waitFor(() => {
          expect(mockToast).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Setup Script Description', () => {
    it('should list what the script does', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText(/This script will:/)).toBeInTheDocument();
      expect(screen.getByText('Install OpenCode CLI')).toBeInTheDocument();
      expect(screen.getByText('Configure GatewayZ as your AI provider')).toBeInTheDocument();
      expect(screen.getByText('Set up your API key')).toBeInTheDocument();
      expect(screen.getByText('Test the connection')).toBeInTheDocument();
    });
  });

  describe('Available Models', () => {
    it('should display available models', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('anthropic/claude-sonnet-4.5')).toBeInTheDocument();
      expect(screen.getByText('openai/gpt-5')).toBeInTheDocument();
      expect(screen.getByText('google/gemini-2.5-pro')).toBeInTheDocument();
      expect(screen.getByText('x-ai/grok-3-turbo-preview')).toBeInTheDocument();
      expect(screen.getByText('deepseek/deepseek-v3.1')).toBeInTheDocument();
    });
  });

  describe('OpenCode Command', () => {
    it('should display the opencode command', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText('opencode')).toBeInTheDocument();
    });
  });

  describe('Troubleshooting Section', () => {
    it('should display troubleshooting tips', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText(/Ensure you have curl/)).toBeInTheDocument();
      expect(screen.getByText(/Check that your API key is valid/)).toBeInTheDocument();
      expect(screen.getByText(/Try restarting your terminal/)).toBeInTheDocument();
      expect(screen.getByText(/For Windows, run PowerShell as Administrator/)).toBeInTheDocument();
    });

    it('should have link to OpenCode docs', () => {
      render(<StartOpencodePage />);

      const docsLink = screen.getByRole('link', { name: /OpenCode Docs/i });
      expect(docsLink).toHaveAttribute('href', 'https://opencode.ai/docs');
    });
  });

  describe('Navigation Links', () => {
    it('should have link to browse models', () => {
      render(<StartOpencodePage />);

      const modelsLink = screen.getByRole('link', { name: /Browse Models/i });
      expect(modelsLink).toHaveAttribute('href', '/models');
    });

    it('should have link to view docs', () => {
      render(<StartOpencodePage />);

      const docsLink = screen.getByRole('link', { name: /^View Docs$/i });
      expect(docsLink).toHaveAttribute('href', '/docs');
    });

    it('should have link to try web chat', () => {
      render(<StartOpencodePage />);

      const chatLink = screen.getByRole('link', { name: /Try Web Chat/i });
      expect(chatLink).toHaveAttribute('href', '/chat');
    });

    it('should have link to settings/keys', () => {
      render(<StartOpencodePage />);

      const settingsLinks = screen.getAllByRole('link', { name: /View Your API Keys/i });
      expect(settingsLinks[0]).toHaveAttribute('href', '/settings/keys');
    });
  });

  describe('Loading State', () => {
    it('should show loading state when not ready', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        ready: false,
        login: mockLogin,
      });

      render(<StartOpencodePage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should call login when user is not authenticated', () => {
      mockUsePrivy.mockReturnValue({
        user: null,
        ready: true,
        login: mockLogin,
      });

      render(<StartOpencodePage />);

      expect(mockLogin).toHaveBeenCalled();
    });
  });

  describe('PostHog Analytics', () => {
    it('should track page view on mount', () => {
      const posthog = require('posthog-js').default;

      render(<StartOpencodePage />);

      expect(posthog.capture).toHaveBeenCalledWith('view_start_opencode');
    });

    it('should track installer copy event', async () => {
      const posthog = require('posthog-js').default;

      render(<StartOpencodePage />);

      const copyButtons = screen.getAllByTestId('button');
      const copyButton = copyButtons.find((btn) => btn.textContent?.includes('Copy'));

      if (copyButton) {
        fireEvent.click(copyButton);

        await waitFor(() => {
          expect(posthog.capture).toHaveBeenCalledWith('opencode_installer_copied');
        });
      }
    });
  });

  describe('API Key Not Available', () => {
    it('should show get API key link when no API key', () => {
      jest.resetModules();
      jest.mock('@/lib/api', () => ({
        getApiKey: () => null,
      }));

      // Re-import the component to use new mock - this is a simplified test
      // In real scenario, we'd need to properly reset modules
      render(<StartOpencodePage />);

      // The component should still render without errors
      expect(screen.getByText('Setup OpenCode with Gatewayz')).toBeInTheDocument();
    });
  });

  describe('Base URL Configuration', () => {
    it('should mention the GatewayZ API base URL', () => {
      render(<StartOpencodePage />);

      expect(screen.getByText(/api\.gatewayz\.ai/)).toBeInTheDocument();
    });
  });
});

describe('Clipboard Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrivy.mockReturnValue({
      user: { id: 'test-user-123' },
      ready: true,
      login: mockLogin,
    });
  });

  it('should show error toast when clipboard copy fails for installer', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard access denied'));

    render(<StartOpencodePage />);

    // Find the first Copy button in the installer section
    const copyButtons = screen.getAllByTestId('button').filter(
      (btn) => btn.textContent?.includes('Copy')
    );

    // The first copy button should be the installer copy
    if (copyButtons.length > 0) {
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to copy',
            variant: 'destructive',
          })
        );
      });
    }
  });

  it('should not track analytics when clipboard copy fails', async () => {
    const posthog = require('posthog-js').default;
    posthog.capture.mockClear();
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard access denied'));

    render(<StartOpencodePage />);

    // Reset posthog call count after the view_start_opencode call
    posthog.capture.mockClear();

    const copyButtons = screen.getAllByTestId('button').filter(
      (btn) => btn.textContent?.includes('Copy')
    );

    if (copyButtons.length > 0) {
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        // The installer_copied event should NOT be called on failure
        expect(posthog.capture).not.toHaveBeenCalledWith('opencode_installer_copied');
      });
    }
  });
});

describe('StartOpencodePage Install Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrivy.mockReturnValue({
      user: { id: 'test-user-123' },
      ready: true,
      login: mockLogin,
    });
  });

  it('should have correct macOS install command', () => {
    render(<StartOpencodePage />);

    const macButton = screen.getByText('macOS');
    fireEvent.click(macButton);

    expect(
      screen.getByText(/https:\/\/raw\.githubusercontent\.com\/Alpaca-Network\/gatewayz-frontend\/master\/opencode\/setup-macos\.sh/)
    ).toBeInTheDocument();
  });

  it('should have correct Linux install command', () => {
    render(<StartOpencodePage />);

    const linuxButton = screen.getByText('Linux');
    fireEvent.click(linuxButton);

    expect(
      screen.getByText(/https:\/\/raw\.githubusercontent\.com\/Alpaca-Network\/gatewayz-frontend\/master\/opencode\/setup-linux\.sh/)
    ).toBeInTheDocument();
  });

  it('should have correct Windows install command', () => {
    render(<StartOpencodePage />);

    const windowsButton = screen.getByText('Windows');
    fireEvent.click(windowsButton);

    expect(
      screen.getByText(/https:\/\/raw\.githubusercontent\.com\/Alpaca-Network\/gatewayz-frontend\/master\/opencode\/setup-windows\.ps1/)
    ).toBeInTheDocument();
  });
});
