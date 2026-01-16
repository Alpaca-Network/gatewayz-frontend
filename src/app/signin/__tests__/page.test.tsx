import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

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
let mockAuthenticated = false;
let mockReady = true;

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: mockLogin,
    authenticated: mockAuthenticated,
    ready: mockReady,
  }),
}));

// Import after mocks
import SigninPage from '../page';

describe('SigninPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    mockAuthenticated = false;
    mockReady = true;
  });

  describe('Auto-trigger login modal', () => {
    it('should auto-trigger Privy login modal when unauthenticated user visits', async () => {
      render(<SigninPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-trigger login multiple times on re-render', async () => {
      const { rerender } = render(<SigninPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      rerender(<SigninPage />);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should not trigger login when Privy is not ready', () => {
      mockReady = false;
      render(<SigninPage />);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should not trigger login when user is already authenticated', () => {
      mockAuthenticated = true;
      render(<SigninPage />);
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Redirect behavior', () => {
    it('should redirect authenticated users to /chat by default', async () => {
      mockAuthenticated = true;

      render(<SigninPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat');
      });
    });

    it('should redirect to returnUrl when provided and authenticated', async () => {
      mockAuthenticated = true;
      mockSearchParams.set('returnUrl', '/settings');

      render(<SigninPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });
    });

    it('should include ref code in redirect URL when authenticated', async () => {
      mockAuthenticated = true;
      mockSearchParams.set('ref', 'TEST123');

      render(<SigninPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });

    it('should handle returnUrl with existing query params and ref code', async () => {
      mockAuthenticated = true;
      mockSearchParams.set('returnUrl', '/chat?model=gpt-4');
      mockSearchParams.set('ref', 'TEST123');

      render(<SigninPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?model=gpt-4&ref=TEST123');
      });
    });

    it('should handle malformed returnUrl ending with ?', async () => {
      mockAuthenticated = true;
      mockSearchParams.set('returnUrl', '/chat?');
      mockSearchParams.set('ref', 'TEST123');

      render(<SigninPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when Privy is not ready', () => {
      mockReady = false;
      render(<SigninPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show redirecting message when authenticated', () => {
      mockAuthenticated = true;
      render(<SigninPage />);
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });

    it('should show redirect to sign in message when unauthenticated', async () => {
      render(<SigninPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(screen.getByText('Redirecting to sign in...')).toBeInTheDocument();
    });
  });
});
