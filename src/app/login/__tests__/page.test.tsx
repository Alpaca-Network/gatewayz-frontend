import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParams = new Map<string, string>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Mock Privy
const mockLogin = jest.fn();
const mockGetAccessToken = jest.fn().mockResolvedValue('mock-access-token');
let mockAuthenticated = false;
let mockReady = true;
let mockUser: any = null;

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: mockLogin,
    authenticated: mockAuthenticated,
    ready: mockReady,
    user: mockUser,
    getAccessToken: mockGetAccessToken,
  }),
}));

// Mock auth-sync to avoid actual API calls
jest.mock('@/integrations/privy/auth-sync', () => ({
  syncPrivyToGatewayz: jest.fn().mockResolvedValue({
    authResponse: {
      api_key: 'mock-api-key',
      user_id: 123,
    },
    privyAccessToken: 'mock-token',
  }),
}));

// Import after mocks
import LoginPage from '../page';

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    mockAuthenticated = false;
    mockReady = true;
    mockUser = null;
  });

  describe('Auto-trigger login modal', () => {
    it('should auto-trigger Privy login modal when unauthenticated user visits', async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-trigger login multiple times on re-render', async () => {
      const { rerender } = render(<LoginPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      rerender(<LoginPage />);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should not trigger login when Privy is not ready', () => {
      mockReady = false;
      render(<LoginPage />);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should not trigger login when user is already authenticated', () => {
      mockAuthenticated = true;
      render(<LoginPage />);
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Redirect behavior', () => {
    const mockUserObj = {
      id: 'privy-user-123',
      linkedAccounts: [{ type: 'email', email: 'test@example.com' }],
    };

    it('should redirect authenticated users to /chat by default', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat');
      });
    });

    it('should redirect to returnUrl when provided and authenticated', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('returnUrl', '/settings');

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });
    });

    it('should include ref code in redirect URL when authenticated', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('ref', 'TEST123');

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });

    it('should handle returnUrl with existing query params and ref code', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('returnUrl', '/chat?model=gpt-4');
      mockSearchParams.set('ref', 'TEST123');

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?model=gpt-4&ref=TEST123');
      });
    });

    it('should handle malformed returnUrl ending with ?', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('returnUrl', '/chat?');
      mockSearchParams.set('ref', 'TEST123');

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when Privy is not ready', () => {
      mockReady = false;
      render(<LoginPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show redirecting message when authenticated', () => {
      mockAuthenticated = true;
      mockUser = { id: 'privy-user-123', linkedAccounts: [] };
      render(<LoginPage />);
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });

    it('should show redirect to login message when unauthenticated', async () => {
      render(<LoginPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    });
  });

  describe('Desktop auth flow', () => {
    const mockUserObj = {
      id: 'privy-user-123',
      linkedAccounts: [{ type: 'email', email: 'test@example.com' }],
    };

    it('should show connecting message when processing desktop auth', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Connecting to desktop app...')).toBeInTheDocument();
      });
    });

    it('should not redirect to web route when desktop=true', async () => {
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      // Wait a bit to ensure no redirect happens
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not call router.push for web routes
      expect(mockPush).not.toHaveBeenCalledWith('/chat');
    });

    it('should call syncPrivyToGatewayz when desktop=true', async () => {
      const { syncPrivyToGatewayz } = require('@/integrations/privy/auth-sync');
      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      await waitFor(() => {
        expect(syncPrivyToGatewayz).toHaveBeenCalledWith(
          mockUserObj,
          'mock-access-token',
          null
        );
      });
    });

    it('should show error message when backend sync fails', async () => {
      const { syncPrivyToGatewayz } = require('@/integrations/privy/auth-sync');
      syncPrivyToGatewayz.mockRejectedValueOnce(new Error('Network error'));

      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show error when API key is missing from response', async () => {
      const { syncPrivyToGatewayz } = require('@/integrations/privy/auth-sync');
      syncPrivyToGatewayz.mockResolvedValueOnce({
        authResponse: { user_id: 123, api_key: null },
        privyAccessToken: 'mock-token',
      });

      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('No API key received from backend')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { syncPrivyToGatewayz } = require('@/integrations/privy/auth-sync');
      syncPrivyToGatewayz.mockRejectedValueOnce(new Error('Network error'));

      mockAuthenticated = true;
      mockUser = mockUserObj;
      mockSearchParams.set('desktop', 'true');

      render(<LoginPage />);

      // Wait for error to show
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Reset mock to succeed on retry
      syncPrivyToGatewayz.mockResolvedValueOnce({
        authResponse: { api_key: 'mock-api-key', user_id: 123 },
        privyAccessToken: 'mock-token',
      });

      // Click retry button
      const retryButton = screen.getByText('Try again');
      await userEvent.click(retryButton);

      // Should show connecting message again
      await waitFor(() => {
        expect(screen.queryByText('Authentication Failed')).not.toBeInTheDocument();
      });
    });
  });
});
