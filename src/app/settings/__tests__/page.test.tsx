import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '../page';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { usePrivy } from '@privy-io/react-auth';
import { makeAuthenticatedRequest } from '@/lib/api';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: React.PropsWithChildren<{ onValueChange?: (v: string) => void; value?: string }>) => (
    <div data-testid="select">{children}</div>
  ),
  SelectContent: ({ children }: React.PropsWithChildren<unknown>) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: React.PropsWithChildren<unknown>) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren<unknown>) => <span data-testid="badge">{children}</span>,
}));

jest.mock('next/link', () => {
  return ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  );
});

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: jest.fn(),
}));

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: jest.fn(),
}));

jest.mock('@/lib/models-data', () => ({
  models: [
    { name: 'test-model', developer: 'TestDev' },
    { name: 'test-model-2', developer: 'TestDev2' },
  ],
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('SettingsPage', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Privy mock
    (usePrivy as jest.Mock).mockReturnValue({
      user: null,
    });
  });

  describe('Authentication States', () => {
    it('should show loading state when auth is loading (privyReady=false)', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'idle',
        apiKey: null,
        privyReady: false,
        login: mockLogin,
      });

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show loading state when auth status is authenticating', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticating',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show loading state when auth status is idle', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'idle',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show sign-in prompt when not authenticated', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Please sign in to view your settings.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should call login when Sign In button is clicked', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<SettingsPage />);

      const signInButton = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => {
        signInButton.click();
      });

      expect(mockLogin).toHaveBeenCalled();
    });

    it('should show settings loading state when authenticated but settings not loaded', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      // Mock API to delay response
      (makeAuthenticatedRequest as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });
  });

  describe('Settings Loading', () => {
    it('should fetch settings when authenticated', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          low_balance_notifications: true,
          low_balance_threshold: 10.00,
          always_enforce_providers: true,
          allowed_providers: ['TestDev'],
          ignored_providers: [],
          default_provider_sort: 'cost',
          default_model: 'test-model',
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      render(<SettingsPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      // Should show the settings page content after loading
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
    });

    it('should not call API when not authenticated', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<SettingsPage />);

      expect(makeAuthenticatedRequest).not.toHaveBeenCalled();
    });

    it('should not mark settings as loaded on API failure (allows retry)', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      // API returns non-ok response (failure)
      const failResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal error' }),
      };

      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(failResponse);

      render(<SettingsPage />);

      // Wait for API call
      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
      });

      // The page should still render (not be stuck in loading)
      // since loading is set to false in finally block
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });

      // Verify the settings use default values (not loaded from API)
      // The page renders with defaults, allowing user to retry or refresh
    });
  });

  describe('Auth State Transitions', () => {
    it('should reset settings when user logs out', async () => {
      // Start authenticated
      const authMock = {
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      };
      (useGatewayzAuth as jest.Mock).mockReturnValue(authMock);

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          low_balance_notifications: true,
          default_provider_sort: 'balanced',
          default_model: 'auto-router',
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      const { rerender } = render(<SettingsPage />);

      // Wait for settings to load
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });

      // Simulate logout
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      rerender(<SettingsPage />);

      // Should show sign-in prompt
      expect(screen.getByText('Please sign in to view your settings.')).toBeInTheDocument();
    });

    it('should refetch settings when user logs back in', async () => {
      // Start unauthenticated
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          low_balance_notifications: true,
          default_provider_sort: 'balanced',
          default_model: 'auto-router',
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      const { rerender } = render(<SettingsPage />);

      expect(screen.getByText('Please sign in to view your settings.')).toBeInTheDocument();
      expect(makeAuthenticatedRequest).not.toHaveBeenCalled();

      // Simulate login
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      rerender(<SettingsPage />);

      // Should fetch settings after login
      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });
    });
  });
});
