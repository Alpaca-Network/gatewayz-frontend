import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
let mockAuthenticated = false;
let mockReady = true;

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: mockLogin,
    authenticated: mockAuthenticated,
    ready: mockReady,
  }),
}));

// Mock GatewayzAuth context
let mockAuthStatus: 'idle' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'error' = 'unauthenticated';

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: () => ({
    status: mockAuthStatus,
  }),
}));

// Mock referral utilities
const mockStoreReferralCode = jest.fn();
jest.mock('@/lib/referral', () => ({
  storeReferralCode: (...args: unknown[]) => mockStoreReferralCode(...args),
}));

// Mock Twitter pixel tracking
const mockTrackTwitterSignupClick = jest.fn();
jest.mock('@/components/analytics/twitter-pixel', () => ({
  trackTwitterSignupClick: () => mockTrackTwitterSignupClick(),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>{children}</p>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, size, className }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    size?: string;
    className?: string;
  }) => (
    <button
      data-testid="signup-button"
      disabled={disabled}
      onClick={onClick}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Gift: () => <span data-testid="icon-gift">Gift</span>,
}));

// Import after mocks
import SignupPage from '../page';

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    mockAuthenticated = false;
    mockReady = true;
    mockAuthStatus = 'unauthenticated';
    mockLogin.mockClear();
    mockPush.mockClear();
    mockStoreReferralCode.mockClear();
    mockTrackTwitterSignupClick.mockClear();
  });

  describe('Auto-trigger login modal', () => {
    it('should auto-trigger Privy login modal when unauthenticated user visits', async () => {
      render(<SignupPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should track Twitter signup click when auto-triggering login', async () => {
      render(<SignupPage />);

      await waitFor(() => {
        expect(mockTrackTwitterSignupClick).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-trigger login multiple times on re-render', async () => {
      const { rerender } = render(<SignupPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      // Simulate re-render
      rerender(<SignupPage />);

      // Login should still only be called once
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should not trigger login when Privy is not ready', () => {
      mockReady = false;

      render(<SignupPage />);

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should not trigger login when user is already authenticated', () => {
      mockAuthenticated = true;

      render(<SignupPage />);

      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Redirect behavior', () => {
    // Note: Redirects only happen for users who were ALREADY authenticated when landing on the page
    // New signups are handled by the auth context (redirects to /onboarding)

    it('should redirect already-authenticated users to /chat by default', async () => {
      // Simulate a user who was already authenticated when they landed on the page
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat');
      });
    });

    it('should redirect to returnUrl when provided and already authenticated', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/settings');

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });
    });

    it('should include ref code in redirect URL when already authenticated', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('ref', 'TEST123');

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });

    it('should NOT auto-redirect for new signups (auth context handles this)', async () => {
      // User starts unauthenticated, then authenticates (simulating new signup flow)
      mockAuthenticated = false;
      mockAuthStatus = 'unauthenticated';

      const { rerender } = render(<SignupPage />);

      // User completes signup - Privy becomes authenticated, but Gatewayz is still syncing
      mockAuthenticated = true;
      mockAuthStatus = 'authenticating';
      rerender(<SignupPage />);

      // Should NOT redirect during authenticating state
      expect(mockPush).not.toHaveBeenCalled();

      // Authentication completes
      mockAuthStatus = 'authenticated';
      rerender(<SignupPage />);

      // Should still NOT redirect because this is a new signup (wasAlreadyAuthenticatedRef was false)
      // The auth context will handle redirecting to /onboarding
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    it('should handle returnUrl with existing query params and ref code', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/chat?model=gpt-4');
      mockSearchParams.set('ref', 'TEST123');

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?model=gpt-4&ref=TEST123');
      });
    });

    it('should properly encode referral codes with special characters', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('ref', 'TEST&=?#123');

      render(<SignupPage />);

      await waitFor(() => {
        // Special characters should be URL-encoded
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST%26%3D%3F%23123');
      });
    });

    it('should handle hash fragments correctly (query before hash)', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/chat#section');
      mockSearchParams.set('ref', 'HASH123');

      render(<SignupPage />);

      await waitFor(() => {
        // Query param should come BEFORE hash fragment
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=HASH123#section');
      });
    });

    it('should handle returnUrl with both query params and hash', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/chat?model=gpt-4#section');
      mockSearchParams.set('ref', 'COMPLEX123');

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?model=gpt-4&ref=COMPLEX123#section');
      });
    });

    it('should replace existing ref param to avoid duplicates', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/chat?ref=OLD123&model=gpt-4');
      mockSearchParams.set('ref', 'NEW123');

      render(<SignupPage />);

      await waitFor(() => {
        // Should replace OLD123 with NEW123, not append
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=NEW123&model=gpt-4');
      });
    });

    it('should handle malformed returnUrl ending with ?', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/chat?');
      mockSearchParams.set('ref', 'TEST123');

      render(<SignupPage />);

      await waitFor(() => {
        // Should clean up trailing ? and add ref correctly
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=TEST123');
      });
    });

    it('should handle malformed returnUrl ending with &', async () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('returnUrl', '/settings?foo=bar&');
      mockSearchParams.set('ref', 'TEST123');

      render(<SignupPage />);

      await waitFor(() => {
        // Should clean up trailing & and add ref correctly
        expect(mockPush).toHaveBeenCalledWith('/settings?foo=bar&ref=TEST123');
      });
    });
  });

  describe('Referral code handling', () => {
    it('should store referral code when present in URL', async () => {
      mockSearchParams.set('ref', 'REFERRAL123');

      render(<SignupPage />);

      await waitFor(() => {
        expect(mockStoreReferralCode).toHaveBeenCalledWith('REFERRAL123', 'signup');
      });
    });

    it('should not store referral code when not present', () => {
      render(<SignupPage />);

      expect(mockStoreReferralCode).not.toHaveBeenCalled();
    });

    it('should display referral code in the UI', () => {
      mockSearchParams.set('ref', 'DISPLAY123');

      render(<SignupPage />);

      expect(screen.getByText('DISPLAY123')).toBeInTheDocument();
      expect(screen.getByText('Referral Code')).toBeInTheDocument();
    });

    it('should show referral-specific welcome message', () => {
      mockSearchParams.set('ref', 'WELCOME123');

      render(<SignupPage />);

      expect(screen.getByText(/You've been invited!/)).toBeInTheDocument();
      expect(screen.getByText(/bonus credits/)).toBeInTheDocument();
    });

    it('should store referral code BEFORE redirecting already-authenticated users (race condition fix)', async () => {
      // This test verifies the fix for the race condition where redirect could happen
      // before referral code storage completes for already-authenticated users
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';
      mockSearchParams.set('ref', 'RACE_TEST');

      render(<SignupPage />);

      await waitFor(() => {
        // Verify referral code was stored
        expect(mockStoreReferralCode).toHaveBeenCalledWith('RACE_TEST', 'signup');
      });

      // Verify redirect happened (but after storage)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?ref=RACE_TEST');
      });

      // Verify storage was called before push
      const storeCallOrder = mockStoreReferralCode.mock.invocationCallOrder[0];
      const pushCallOrder = mockPush.mock.invocationCallOrder[0];
      expect(storeCallOrder).toBeLessThan(pushCallOrder);
    });
  });

  describe('Loading state', () => {
    it('should show loading state in button when Privy is not ready', () => {
      mockReady = false;

      render(<SignupPage />);

      // PERFORMANCE OPTIMIZATION: The card structure is always rendered for better FCP
      // The loading state is now shown in the button, not as a separate page
      const button = screen.getByTestId('signup-button');
      expect(button).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Card structure should still be visible for better FCP/LCP
      expect(screen.getByText('Welcome to Gatewayz!')).toBeInTheDocument();
    });

    it('should show signing in state in button when authentication is in progress', () => {
      mockReady = true;
      mockAuthenticated = true;
      mockAuthStatus = 'authenticating';

      render(<SignupPage />);

      // The button shows "Signing in..." when authentication is in progress
      const button = screen.getByTestId('signup-button');
      expect(button).toBeDisabled();
      expect(screen.getByText('Signing in...')).toBeInTheDocument();

      // Card structure should still be visible
      expect(screen.getByText('Welcome to Gatewayz!')).toBeInTheDocument();
    });

    it('should show redirecting message in button when fully authenticated', () => {
      mockAuthenticated = true;
      mockAuthStatus = 'authenticated';

      render(<SignupPage />);

      // The button shows "Redirecting..." when fully authenticated
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();

      // Card structure should still be visible
      expect(screen.getByText('Welcome to Gatewayz!')).toBeInTheDocument();
    });

    it('should always render card structure for good FCP/LCP (performance optimization)', () => {
      mockReady = false;

      render(<SignupPage />);

      // Core card elements should always be visible
      expect(screen.getByText('Welcome to Gatewayz!')).toBeInTheDocument();
      expect(screen.getByText("What you'll get:")).toBeInTheDocument();
      expect(screen.getByText('Access to 10,000+ AI models')).toBeInTheDocument();
      expect(screen.getByText('$3 in free trial credits')).toBeInTheDocument();
    });
  });

  describe('Page structure', () => {
    it('should render welcome title', () => {
      render(<SignupPage />);

      expect(screen.getByText('Welcome to Gatewayz!')).toBeInTheDocument();
    });

    it('should render signup button', () => {
      render(<SignupPage />);

      expect(screen.getByText('Sign Up Now')).toBeInTheDocument();
    });

    it('should render benefits list', () => {
      render(<SignupPage />);

      expect(screen.getByText('Access to 10,000+ AI models')).toBeInTheDocument();
      expect(screen.getByText('$3 in free trial credits')).toBeInTheDocument();
      expect(screen.getByText('Advanced AI routing & analytics')).toBeInTheDocument();
    });

    it('should show bonus credits item when referral code is present', () => {
      mockSearchParams.set('ref', 'BONUS123');

      render(<SignupPage />);

      expect(screen.getByText('Bonus credits from referral')).toBeInTheDocument();
    });

    it('should not show bonus credits item when no referral code', () => {
      render(<SignupPage />);

      expect(screen.queryByText('Bonus credits from referral')).not.toBeInTheDocument();
    });
  });

  describe('Manual signup button', () => {
    it('should call login when clicking signup button', async () => {
      const user = userEvent.setup();

      // Clear auto-trigger to test manual click
      render(<SignupPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });

      mockLogin.mockClear();

      const button = screen.getByTestId('signup-button');
      await user.click(button);

      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should show loading state in button when Privy is not ready', () => {
      mockReady = false;

      render(<SignupPage />);

      // PERFORMANCE OPTIMIZATION: Button is always visible for better FCP/LCP
      // But it shows loading state and is disabled
      const button = screen.getByTestId('signup-button');
      expect(button).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should track Twitter signup click on manual button click', async () => {
      const user = userEvent.setup();

      render(<SignupPage />);

      // Wait for auto-trigger
      await waitFor(() => {
        expect(mockTrackTwitterSignupClick).toHaveBeenCalledTimes(1);
      });

      mockTrackTwitterSignupClick.mockClear();

      const button = screen.getByTestId('signup-button');
      await user.click(button);

      expect(mockTrackTwitterSignupClick).toHaveBeenCalledTimes(1);
    });
  });
});
