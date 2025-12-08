import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClaudeCodePage from '../page';
import { usePrivy } from '@privy-io/react-auth';
import { getApiKey } from '@/lib/api';

// Mock dependencies
jest.mock('@privy-io/react-auth');
jest.mock('@/lib/api');
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

const mockUsePrivy = usePrivy as jest.MockedFunction<typeof usePrivy>;
const mockGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

describe('ClaudeCodePage', () => {
  const mockLogin = jest.fn();
  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock toast
    jest.mock('@/hooks/use-toast', () => ({
      useToast: () => ({ toast: mockToast }),
    }));

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Authentication', () => {
    it('should display page when authenticated', () => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key-123');

      render(<ClaudeCodePage />);

      expect(screen.getByText('Claude Code + GatewayZ')).toBeInTheDocument();
    });

    it('should trigger login when not authenticated', () => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: false,
        login: mockLogin,
      } as any);

      render(<ClaudeCodePage />);

      expect(mockLogin).toHaveBeenCalled();
    });

    it('should not trigger login when not ready', () => {
      mockUsePrivy.mockReturnValue({
        ready: false,
        authenticated: false,
        login: mockLogin,
      } as any);

      render(<ClaudeCodePage />);

      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('OS Selection', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key');
    });

    it('should render Windows button', () => {
      render(<ClaudeCodePage />);
      expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    it('should render macOS button', () => {
      render(<ClaudeCodePage />);
      expect(screen.getByText('macOS')).toBeInTheDocument();
    });

    it('should render Linux button', () => {
      render(<ClaudeCodePage />);
      expect(screen.getByText('Linux')).toBeInTheDocument();
    });

    it('should switch to macOS command when macOS button is clicked', () => {
      render(<ClaudeCodePage />);

      const macOSButton = screen.getByText('macOS');
      fireEvent.click(macOSButton);

      expect(
        screen.getByText(/bash.*setup-macos\.sh/)
      ).toBeInTheDocument();
    });

    it('should switch to Linux command when Linux button is clicked', () => {
      render(<ClaudeCodePage />);

      const linuxButton = screen.getByText('Linux');
      fireEvent.click(linuxButton);

      expect(
        screen.getByText(/bash.*setup-linux\.sh/)
      ).toBeInTheDocument();
    });
  });

  describe('API Key Display', () => {
    it('should display API key when available', () => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key-123');

      render(<ClaudeCodePage />);

      expect(screen.getByText('test-api-key-123')).toBeInTheDocument();
      expect(screen.getByText('Your API Key')).toBeInTheDocument();
    });

    it('should display warning when API key is not available', () => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('');

      render(<ClaudeCodePage />);

      expect(screen.getByText('API Key Required')).toBeInTheDocument();
      expect(screen.getByText('Get Your API Key')).toBeInTheDocument();
    });
  });

  describe('Code Block Contrast', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key');
    });

    it('should render code blocks with proper contrast classes for light mode', () => {
      render(<ClaudeCodePage />);

      // Check that code elements have light mode text color (text-green-300)
      const codeElements = screen.getAllByRole('code');
      codeElements.forEach((element) => {
        expect(element.className).toContain('text-green-300');
      });
    });

    it('should render code blocks with dark mode classes', () => {
      render(<ClaudeCodePage />);

      // Check that code blocks have dark mode background
      const codeBlocks = document.querySelectorAll('.bg-slate-950');
      expect(codeBlocks.length).toBeGreaterThan(0);

      codeBlocks.forEach((block) => {
        expect(block.className).toContain('dark:bg-slate-900');
      });
    });

    it('should render code text with responsive color classes', () => {
      render(<ClaudeCodePage />);

      const codeElements = document.querySelectorAll('code');
      codeElements.forEach((element) => {
        // Should have both light and dark mode text colors
        expect(element.className).toMatch(/text-green-300.*dark:text-green-400/);
      });
    });
  });

  describe('Copy to Clipboard', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key-123');
    });

    it('should copy install command to clipboard', async () => {
      render(<ClaudeCodePage />);

      const copyButtons = screen.getAllByText('Copy');
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });

    it('should show "Copied!" text after copying', async () => {
      render(<ClaudeCodePage />);

      const copyButtons = screen.getAllByText('Copy');
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should copy API key to clipboard', async () => {
      render(<ClaudeCodePage />);

      const apiKeyCopyButton = screen.getAllByText('Copy')[1]; // Second copy button is for API key
      fireEvent.click(apiKeyCopyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-api-key-123');
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key');
    });

    it('should have proper heading hierarchy', () => {
      render(<ClaudeCodePage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Claude Code + GatewayZ');
    });

    it('should have accessible buttons', () => {
      render(<ClaudeCodePage />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((button) => {
        expect(button).toBeVisible();
      });
    });

    it('should have accessible links', () => {
      render(<ClaudeCodePage />);

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);

      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });
  });

  describe('Model List', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: mockLogin,
      } as any);
      mockGetApiKey.mockReturnValue('test-api-key');
    });

    it('should display available models', () => {
      render(<ClaudeCodePage />);

      expect(screen.getByText('GPT-5')).toBeInTheDocument();
      expect(screen.getByText('Gemini 2.5 Pro')).toBeInTheDocument();
      expect(screen.getByText('Grok Code Fast 1')).toBeInTheDocument();
      expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
    });

    it('should display model providers', () => {
      render(<ClaudeCodePage />);

      expect(screen.getByText('by OpenAI')).toBeInTheDocument();
      expect(screen.getByText('by Google')).toBeInTheDocument();
      expect(screen.getByText('by Anthropic')).toBeInTheDocument();
    });
  });
});
