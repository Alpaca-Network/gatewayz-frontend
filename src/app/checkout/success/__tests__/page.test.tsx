import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SuccessPage from '../page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      const params: Record<string, string> = {
        session_id: 'cs_test_abc123xyz',
        tier: 'pro',
        amount: '50',
      };
      return params[key] || null;
    },
  }),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 data-testid="card-title" className={className}>{children}</h2>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, readOnly, className }: any) => (
    <input
      data-testid="input"
      value={value}
      readOnly={readOnly}
      className={className}
    />
  ),
}));

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Copy: () => <span data-testid="icon-copy">Copy</span>,
  Gift: () => <span data-testid="icon-gift">Gift</span>,
  CheckCircle: () => <span data-testid="icon-check-circle">CheckCircle</span>,
  Share2: () => <span data-testid="icon-share">Share</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  ArrowRight: () => <span data-testid="icon-arrow-right">ArrowRight</span>,
}));

// Mock the API module
const mockGetUserData = jest.fn();
const mockMakeAuthenticatedRequest = jest.fn();

jest.mock('@/lib/api', () => ({
  getUserData: () => mockGetUserData(),
  makeAuthenticatedRequest: (...args: any[]) => mockMakeAuthenticatedRequest(...args),
}));

jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.test.com',
}));

describe('SuccessPage - Post-purchase Confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockGetUserData.mockReturnValue({
        user_id: 1,
        api_key: 'test-api-key',
        email: 'test@example.com',
      });
      mockMakeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ referral_code: 'TESTREF123' }),
      });
    });

    it('should render the thank you message', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Thank You for Your Purchase!')).toBeInTheDocument();
      });
    });

    it('should display the Pro tier name', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        const proElements = screen.getAllByText(/Pro/);
        expect(proElements.length).toBeGreaterThan(0);
      });
    });

    it('should render the order confirmation card', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Order Confirmation')).toBeInTheDocument();
      });
    });

    it('should display the amount', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('$50')).toBeInTheDocument();
      });
    });

    it('should show Complete status', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Complete')).toBeInTheDocument();
      });
    });

    it('should render the referral CTA section', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Earn Free Credits!')).toBeInTheDocument();
      });
    });

    it('should fetch and display the referral link', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        const inputs = screen.getAllByTestId('input');
        const referralInput = inputs.find(input =>
          (input as HTMLInputElement).value.includes('TESTREF123')
        );
        expect(referralInput).toBeInTheDocument();
      });
    });

    it('should render Share Referral Link button', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Share Referral Link')).toBeInTheDocument();
      });
    });

    it('should render Copy Link button', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Copy Link')).toBeInTheDocument();
      });
    });

    it('should render navigation buttons', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('View Referral Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Start Using Gatewayz')).toBeInTheDocument();
      });
    });

    it('should display the referral code', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('TESTREF123')).toBeInTheDocument();
      });
    });

    it('should call the referral code API', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(mockMakeAuthenticatedRequest).toHaveBeenCalledWith(
          'https://api.test.com/referral/code'
        );
      });
    });

    it('should display transaction ID (truncated)', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Transaction ID')).toBeInTheDocument();
        // The session ID is truncated to first 20 chars + '...'
        expect(screen.getByText('cs_test_abc123xyz...')).toBeInTheDocument();
      });
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockGetUserData.mockReturnValue(null);
    });

    it('should display session expired message', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should display sign in button', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('loading state', () => {
    it('should eventually resolve from loading state', async () => {
      mockGetUserData.mockReturnValue(null);
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('referral messaging', () => {
    beforeEach(() => {
      mockGetUserData.mockReturnValue({
        user_id: 1,
        api_key: 'test-api-key',
      });
      mockMakeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ referral_code: 'TESTREF123' }),
      });
    });

    it('should display bonus credits message', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText(/bonus credits/)).toBeInTheDocument();
      });
    });

    it('should display reward explanation', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('Both you and your friend get rewarded')).toBeInTheDocument();
      });
    });

    it('should display how referrals work', async () => {
      render(<SuccessPage />);

      await waitFor(() => {
        expect(screen.getByText('When they sign up and make their first purchase')).toBeInTheDocument();
      });
    });
  });

  describe('API error handling', () => {
    beforeEach(() => {
      mockGetUserData.mockReturnValue({
        user_id: 1,
        api_key: 'test-api-key',
      });
    });

    it('should handle API failure gracefully', async () => {
      mockMakeAuthenticatedRequest.mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<SuccessPage />);

      // Should still render the page structure
      await waitFor(() => {
        expect(screen.getByText('Thank You for Your Purchase!')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockMakeAuthenticatedRequest.mockRejectedValue(new Error('Network error'));

      render(<SuccessPage />);

      // Should still render the page structure
      await waitFor(() => {
        expect(screen.getByText('Thank You for Your Purchase!')).toBeInTheDocument();
      });
    });
  });
});

describe('SuccessPage - Clipboard functionality', () => {
  beforeEach(() => {
    mockGetUserData.mockReturnValue({
      user_id: 1,
      api_key: 'test-api-key',
    });
    mockMakeAuthenticatedRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ referral_code: 'TESTREF123' }),
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('should copy referral link when Copy Link button is clicked', async () => {
    render(<SuccessPage />);

    // Wait for the referral link to be loaded first
    await waitFor(() => {
      const inputs = screen.getAllByTestId('input');
      const referralInput = inputs.find(input =>
        (input as HTMLInputElement).value.includes('TESTREF123')
      );
      expect(referralInput).toBeInTheDocument();
    });

    // Now the copy button should be enabled
    const copyButtons = screen.getAllByText('Copy Link');
    const copyButton = copyButtons[0].closest('button');
    expect(copyButton).not.toBeDisabled();

    fireEvent.click(copyButton!);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });
});
