import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyPage from '../page';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { makeAuthenticatedRequest } from '@/lib/api';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Info: () => <span data-testid="info-icon">Info</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean }) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock('next/link', () => {
  return ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} data-testid="link">{children}</a>
  );
});

// Mock dependencies
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.test.com',
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('PrivacyPage', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication States', () => {
    it('should show loading state when auth is loading (privyReady=false)', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'idle',
        apiKey: null,
        privyReady: false,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show loading state when auth status is authenticating', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticating',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show loading state when auth status is idle', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'idle',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Connecting to your account...')).toBeInTheDocument();
    });

    it('should show sign-in prompt when not authenticated', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Please sign in to view your privacy settings.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should call login when Sign In button is clicked', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      const signInButton = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => {
        signInButton.click();
      });

      expect(mockLogin).toHaveBeenCalled();
    });
  });

  describe('Cache Settings Loading', () => {
    it('should fetch cache settings when authenticated', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: true,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledWith(
          'https://api.test.com/user/cache-settings'
        );
      });
    });

    it('should not call API when not authenticated', () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      render(<PrivacyPage />);

      expect(makeAuthenticatedRequest).not.toHaveBeenCalled();
    });

    it('should show error toast when cache settings fetch fails', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ detail: 'Server error' }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to load cache settings',
          description: 'Server error',
          variant: 'destructive',
        });
      });
    });

    it('should set settingsLoaded to true even on fetch error', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      (makeAuthenticatedRequest as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to load cache settings',
          description: 'Network error',
          variant: 'destructive',
        });
      });

      // The page should still render the settings after error
      expect(screen.getByText('Response Caching')).toBeInTheDocument();
    });
  });

  describe('Cache Toggle Functionality', () => {
    beforeEach(() => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });
    });

    it('should enable cache when toggle is switched on', async () => {
      // First fetch returns cache disabled but system enabled
      const initialResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(initialResponse);

      render(<PrivacyPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
      });

      // Mock the PUT response
      const updateResponse = {
        ok: true,
        json: () => Promise.resolve({}),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(updateResponse);

      // Find the cache toggle switch (first switch in the component)
      const switches = screen.getAllByTestId('switch');
      const cacheToggle = switches[0];

      await act(async () => {
        fireEvent.click(cacheToggle);
      });

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledWith(
          'https://api.test.com/user/cache-settings?enable_butter_cache=true',
          { method: 'PUT' }
        );
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Response caching enabled',
        description: 'Your API requests may now be cached to reduce costs and improve response times.',
      });
    });

    it('should show error toast when cache toggle fails', async () => {
      const initialResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(initialResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
      });

      // Mock the PUT response to fail
      const updateResponse = {
        ok: false,
        json: () => Promise.resolve({ detail: 'Cache unavailable' }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(updateResponse);

      const switches = screen.getAllByTestId('switch');
      const cacheToggle = switches[0];

      await act(async () => {
        fireEvent.click(cacheToggle);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to update setting',
          description: 'Cache unavailable',
          variant: 'destructive',
        });
      });
    });

    it('should disable cache toggle when system caching is unavailable', async () => {
      const initialResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: false,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(initialResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
      });

      // Wait for settings to load
      await waitFor(() => {
        expect(screen.getByText('Response caching is currently unavailable system-wide.')).toBeInTheDocument();
      });

      const switches = screen.getAllByTestId('switch');
      const cacheToggle = switches[0];

      expect(cacheToggle).toBeDisabled();
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);
    });

    it('should render all privacy sections', async () => {
      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      expect(screen.getByText('Response Caching')).toBeInTheDocument();
      expect(screen.getByText('Paid Models')).toBeInTheDocument();
      expect(screen.getByText('Free Models')).toBeInTheDocument();
      expect(screen.getByText('Chat History')).toBeInTheDocument();
      expect(screen.getByText('Analytics Cookies')).toBeInTheDocument();
    });

    it('should render Butter.dev link', async () => {
      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      const butterDevLink = screen.getByText('Butter.dev');
      expect(butterDevLink).toHaveAttribute('href', 'https://butter.dev');
    });

    it('should render Chatroom link with /chat href', async () => {
      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      const chatroomLink = screen.getByText('Chatroom');
      expect(chatroomLink.closest('a')).toHaveAttribute('href', '/chat');
    });

    it('should show privacy warning when cache is enabled', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: true,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(screen.getByText(/Your prompts will be routed through Butter.dev/)).toBeInTheDocument();
      });
    });

    it('should show Activity link when cache is enabled', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: true,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      render(<PrivacyPage />);

      await waitFor(() => {
        expect(screen.getByText('Activity')).toBeInTheDocument();
      });

      const activityLink = screen.getByText('Activity');
      expect(activityLink.closest('a')).toHaveAttribute('href', '/settings/activity');
    });
  });

  describe('Other Privacy Settings', () => {
    beforeEach(() => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);
    });

    it('should toggle paid models training setting', async () => {
      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      // Find all switches and get the one for paid models training (second switch)
      const switches = screen.getAllByTestId('switch');
      expect(switches.length).toBeGreaterThan(1);

      // Toggle the paid training switch (index 1)
      await act(async () => {
        fireEvent.click(switches[1]);
      });

      // Verify it's now checked
      expect(switches[1]).toBeChecked();
    });

    it('should have free models training enabled by default', async () => {
      render(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });

      // The free models training toggle should be checked by default
      const switches = screen.getAllByTestId('switch');
      // Third and fourth switches are for free models
      expect(switches[3]).toBeChecked();
    });
  });

  describe('Auth State Transitions', () => {
    it('should reset settings when user logs out', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: true,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      const { rerender } = render(<PrivacyPage />);

      await waitFor(() => {
        expect(screen.getByText('Response Caching')).toBeInTheDocument();
      });

      // Simulate logout
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      rerender(<PrivacyPage />);

      expect(screen.getByText('Please sign in to view your privacy settings.')).toBeInTheDocument();
    });

    it('should refetch settings when user logs back in', async () => {
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'unauthenticated',
        apiKey: null,
        privyReady: true,
        login: mockLogin,
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          enable_butter_cache: false,
          system_enabled: true,
        }),
      };
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue(mockResponse);

      const { rerender } = render(<PrivacyPage />);

      expect(screen.getByText('Please sign in to view your privacy settings.')).toBeInTheDocument();
      expect(makeAuthenticatedRequest).not.toHaveBeenCalled();

      // Simulate login
      (useGatewayzAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        apiKey: 'test-api-key',
        privyReady: true,
        login: mockLogin,
      });

      rerender(<PrivacyPage />);

      await waitFor(() => {
        expect(makeAuthenticatedRequest).toHaveBeenCalled();
      });
    });
  });
});
