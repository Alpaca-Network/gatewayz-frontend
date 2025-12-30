import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PathChooserModal } from '../path-chooser-modal';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock Privy
const mockLogin = jest.fn();
const mockUsePrivy = jest.fn(() => ({
  user: { id: 'test-user-123' },
  login: mockLogin,
}));

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => mockUsePrivy(),
}));

// Mock posthog
jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage: { [key: string]: string } = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]); },
  },
  writable: true,
});

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="dialog-description">{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) =>
    <button onClick={onClick} className={className} data-testid="button">{children}</button>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    <button onClick={onClick} data-testid="dropdown-item">{children}</button>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dropdown-trigger">{children}</div>,
}));

jest.mock('lucide-react', () => ({
  Code2: () => <span data-testid="icon-code2">Code2</span>,
  Terminal: () => <span data-testid="icon-terminal">Terminal</span>,
  MessageSquare: () => <span data-testid="icon-message">MessageSquare</span>,
  ChevronDown: () => <span data-testid="icon-chevron">ChevronDown</span>,
}));

describe('PathChooserModal', () => {
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUsePrivy.mockReturnValue({
      user: { id: 'test-user-123' },
      login: mockLogin,
    });
  });

  describe('Modal Structure', () => {
    it('should render when open is true', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<PathChooserModal open={false} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should render the modal title', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Choose Your Path')).toBeInTheDocument();
    });

    it('should render the modal description', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('How do you want to get started with Gatewayz?')).toBeInTheDocument();
    });
  });

  describe('Path Options', () => {
    it('should render API path option', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Use the API')).toBeInTheDocument();
    });

    it('should render Terminal Coding Agent option', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Terminal Coding Agent')).toBeInTheDocument();
    });

    it('should render Chat path option', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Open Chat')).toBeInTheDocument();
    });

    it('should show Claude Code in dropdown', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should show OpenCode in dropdown', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('OpenCode')).toBeInTheDocument();
    });
  });

  describe('Path Navigation (Authenticated User)', () => {
    it('should navigate to /start/api when API is selected', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const apiButton = screen.getByText('Use the API');
      fireEvent.click(apiButton);

      expect(mockPush).toHaveBeenCalledWith('/start/api');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should navigate to /start/chat when Chat is selected', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const chatButton = screen.getByText('Open Chat');
      fireEvent.click(chatButton);

      expect(mockPush).toHaveBeenCalledWith('/start/chat');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should navigate to /start/claude-code when Claude Code is selected', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const claudeCodeItem = screen.getByText('Claude Code');
      fireEvent.click(claudeCodeItem);

      expect(mockPush).toHaveBeenCalledWith('/start/claude-code');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should navigate to /start/opencode when OpenCode is selected', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const opencodeItem = screen.getByText('OpenCode');
      fireEvent.click(opencodeItem);

      expect(mockPush).toHaveBeenCalledWith('/start/opencode');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Path Selection (Unauthenticated User)', () => {
    beforeEach(() => {
      mockUsePrivy.mockReturnValue({
        user: null,
        login: mockLogin,
      });
    });

    it('should call login when API is selected by unauthenticated user', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const apiButton = screen.getByText('Use the API');
      fireEvent.click(apiButton);

      expect(mockLogin).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should store onboarding path when unauthenticated user selects API', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const apiButton = screen.getByText('Use the API');
      fireEvent.click(apiButton);

      expect(window.localStorage.getItem('onboarding_path')).toBe('api');
    });

    it('should call login when Claude Code is selected by unauthenticated user', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const claudeCodeItem = screen.getByText('Claude Code');
      fireEvent.click(claudeCodeItem);

      expect(mockLogin).toHaveBeenCalled();
      expect(window.localStorage.getItem('onboarding_path')).toBe('claude-code');
    });

    it('should call login when OpenCode is selected by unauthenticated user', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const opencodeItem = screen.getByText('OpenCode');
      fireEvent.click(opencodeItem);

      expect(mockLogin).toHaveBeenCalled();
      expect(window.localStorage.getItem('onboarding_path')).toBe('opencode');
    });

    it('should navigate directly when Chat is selected by unauthenticated user', () => {
      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const chatButton = screen.getByText('Open Chat');
      fireEvent.click(chatButton);

      // Chat doesn't require auth
      expect(mockPush).toHaveBeenCalledWith('/start/chat');
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Analytics', () => {
    it('should track path selection', () => {
      const posthog = require('posthog-js').default;

      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const apiButton = screen.getByText('Use the API');
      fireEvent.click(apiButton);

      expect(posthog.capture).toHaveBeenCalledWith('path_selected', { path: 'api' });
    });

    it('should track claude-code path selection', () => {
      const posthog = require('posthog-js').default;

      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const claudeCodeItem = screen.getByText('Claude Code');
      fireEvent.click(claudeCodeItem);

      expect(posthog.capture).toHaveBeenCalledWith('path_selected', { path: 'claude-code' });
    });

    it('should track opencode path selection', () => {
      const posthog = require('posthog-js').default;

      render(<PathChooserModal open={true} onOpenChange={mockOnOpenChange} />);

      const opencodeItem = screen.getByText('OpenCode');
      fireEvent.click(opencodeItem);

      expect(posthog.capture).toHaveBeenCalledWith('path_selected', { path: 'opencode' });
    });
  });
});
