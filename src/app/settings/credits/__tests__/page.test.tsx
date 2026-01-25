import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CreditsPage from '../page';
import { getUserData, makeAuthenticatedRequest, saveUserData, requestAuthRefresh } from '@/lib/api';
import type { UserData } from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
  makeAuthenticatedRequest: jest.fn(),
  saveUserData: jest.fn(),
  requestAuthRefresh: jest.fn(),
  API_BASE_URL: 'https://api.example.com',
}));

// Mock the config
jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.example.com',
}));

// Mock the stripe module
jest.mock('@/lib/stripe', () => ({
  redirectToCheckout: jest.fn(),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Info: () => <span data-testid="info-icon">Info</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
  ArrowUpRight: () => <span data-testid="arrow-icon">ArrowUpRight</span>,
  ChevronLeft: () => <span data-testid="chevron-left">ChevronLeft</span>,
  ChevronRight: () => <span data-testid="chevron-right">ChevronRight</span>,
  CreditCard: () => <span data-testid="credit-card">CreditCard</span>,
  MoreHorizontal: () => <span data-testid="more-horizontal">MoreHorizontal</span>,
  CheckCircle: () => <span data-testid="check-circle">CheckCircle</span>,
  Sparkles: () => <span data-testid="sparkles">Sparkles</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

// Mock child components
jest.mock('@/components/tier/tier-info-card', () => ({
  TierInfoCard: () => <div data-testid="tier-info-card">TierInfoCard</div>,
}));

jest.mock('@/components/pricing/pricing-section', () => ({
  PricingSection: () => <div data-testid="pricing-section">PricingSection</div>,
}));

describe('CreditsPage', () => {
  const mockBasicUserData: UserData = {
    user_id: 1,
    api_key: 'test-key',
    auth_method: 'email',
    privy_user_id: 'test-privy-id',
    display_name: 'Test User',
    email: 'test@example.com',
    credits: 5000, // $50.00
    tier: 'basic',
  };

  const mockProUserData: UserData = {
    user_id: 1,
    api_key: 'test-key',
    auth_method: 'email',
    privy_user_id: 'test-privy-id',
    display_name: 'Pro User',
    email: 'pro@example.com',
    credits: 2000, // $20.00 total
    tier: 'pro',
    subscription_status: 'active',
    subscription_allowance: 1500, // $15.00 allowance
    purchased_credits: 500, // $5.00 purchased
    total_credits: 2000,
    subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
  };

  const mockMaxUserData: UserData = {
    user_id: 1,
    api_key: 'test-key',
    auth_method: 'email',
    privy_user_id: 'test-privy-id',
    display_name: 'Max User',
    email: 'max@example.com',
    credits: 16000, // $160.00 total
    tier: 'max',
    subscription_status: 'active',
    subscription_allowance: 15000, // $150.00 allowance
    purchased_credits: 1000, // $10.00 purchased
    total_credits: 16000,
    subscription_end_date: Math.floor(Date.now() / 1000) + 86400 * 30,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset window.history.replaceState
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: jest.fn(),
      },
      writable: true,
    });
    // Mock successful API responses by default
    (makeAuthenticatedRequest as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ credits: 5000, transactions: [] }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render the credits page with main heading', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByText('Credits')).toBeInTheDocument();
    });

    it('should render TierInfoCard component', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByTestId('tier-info-card')).toBeInTheDocument();
    });

    it('should render PricingSection component', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByTestId('pricing-section')).toBeInTheDocument();
    });

    it('should display Available Balance section', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByText('Available Balance')).toBeInTheDocument();
    });

    it('should display Recent Transactions header', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Check for the transactions header (may have multiple text nodes)
      const transactionsHeaders = screen.getAllByText('Recent Transactions');
      expect(transactionsHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Credit Balance Display', () => {
    it('should show loading state initially when no user data', async () => {
      (getUserData as jest.Mock).mockReturnValue(null);

      await act(async () => {
        render(<CreditsPage />);
      });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Credit Breakdown for Pro/Max Users', () => {
    it('should display credit breakdown cards for Pro users with active subscription', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockProUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should show Monthly Allowance card
      expect(screen.getByText('Monthly Allowance')).toBeInTheDocument();
      expect(screen.getByText('$15.00')).toBeInTheDocument();
      expect(screen.getByText('Resets on billing date')).toBeInTheDocument();

      // Should show Purchased Credits card
      expect(screen.getByText('Purchased Credits')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument();
      expect(screen.getByText('Never expire')).toBeInTheDocument();

      // Should show Total Available card
      expect(screen.getByText('Total Available')).toBeInTheDocument();
      expect(screen.getByText('$20.00')).toBeInTheDocument();
      expect(screen.getByText('Combined balance')).toBeInTheDocument();
    });

    it('should display credit breakdown cards for Max users with active subscription', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockMaxUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should show Monthly Allowance card
      expect(screen.getByText('Monthly Allowance')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();

      // Should show Purchased Credits card
      expect(screen.getByText('Purchased Credits')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();

      // Should show Total Available card
      expect(screen.getByText('Total Available')).toBeInTheDocument();
      expect(screen.getByText('$160.00')).toBeInTheDocument();
    });

    it('should NOT display credit breakdown for basic tier users', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should not show breakdown cards
      expect(screen.queryByText('Monthly Allowance')).not.toBeInTheDocument();
      expect(screen.queryByText('Combined balance')).not.toBeInTheDocument();
    });

    it('should NOT display credit breakdown for Pro users without active subscription', async () => {
      const inactiveProUser = {
        ...mockProUserData,
        subscription_status: 'cancelled' as const,
      };
      (getUserData as jest.Mock).mockReturnValue(inactiveProUser);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should not show breakdown cards
      expect(screen.queryByText('Combined balance')).not.toBeInTheDocument();
    });

    it('should handle Pro user with 0 purchased credits', async () => {
      const proUserNoPurchased = {
        ...mockProUserData,
        purchased_credits: 0,
        total_credits: 1500,
      };
      (getUserData as jest.Mock).mockReturnValue(proUserNoPurchased);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should show credit breakdown with values
      expect(screen.getByText('Purchased Credits')).toBeInTheDocument();
      // Should show $0.00 for purchased credits
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle missing subscription_allowance (defaults to 0)', async () => {
      const proUserMissingAllowance = {
        ...mockProUserData,
        subscription_allowance: undefined,
      };
      (getUserData as jest.Mock).mockReturnValue(proUserMissingAllowance);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Should handle undefined by defaulting to 0
      expect(screen.getByText('Monthly Allowance')).toBeInTheDocument();
    });
  });

  describe('Buy Credits Dialog', () => {
    it('should show Buy Credits button', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });

    it('should open dialog when Buy Credits button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Click Buy Credits button
      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      // Dialog should open
      expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
      expect(screen.getByText('Scale')).toBeInTheDocument();
    });

    it('should show credit packages with discounts', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Click Buy Credits button
      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      // Check for discount badges
      expect(screen.getByText('10% off')).toBeInTheDocument();
      expect(screen.getByText('25% off')).toBeInTheDocument();
      expect(screen.getByText('30% off')).toBeInTheDocument();
    });

    it('should show "Best Value" badge on popular package', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Click Buy Credits button
      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      expect(screen.getByText('Best Value')).toBeInTheDocument();
    });
  });

  describe('Transactions', () => {
    it('should show "No transactions yet" when there are no transactions', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ credits: 5000, transactions: [] }),
      });

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(screen.getByText('No transactions yet')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when user data is being fetched', async () => {
      (getUserData as jest.Mock).mockReturnValue(null);

      await act(async () => {
        render(<CreditsPage />);
      });

      // Should show loading in the Suspense fallback or initial state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Custom Amount Input', () => {
    it('should display custom amount input field', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByLabelText(/Enter custom amount or select a package/i)).toBeInTheDocument();
    });

    it('should show minimum $5.00 hint text', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Find the minimum hint text (there may be multiple for auto top-up)
      const minHints = screen.getAllByText('Minimum $5.00');
      expect(minHints.length).toBeGreaterThan(0);
    });

    it('should allow entering a custom amount', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, '25.00');
        jest.runAllTimers();
      });

      expect(customInput).toHaveValue('25.00');
    });

    it('should redirect to checkout with custom amount when valid amount entered', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, '50');
        jest.runAllTimers();
      });

      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      expect(mockPush).toHaveBeenCalledWith('/checkout?package=custom&amount=50&mode=credits');
    });

    it('should show alert when custom amount is below $5 minimum', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, '3');
        jest.runAllTimers();
      });

      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      expect(alertMock).toHaveBeenCalledWith('Minimum custom amount is $5.00');
      expect(mockPush).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });

    it('should show alert when custom amount exceeds $10,000 maximum', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, '15000');
        jest.runAllTimers();
      });

      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      expect(alertMock).toHaveBeenCalledWith('Maximum custom amount is $10,000.00');
      expect(mockPush).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });

    it('should open dialog when no custom amount is entered', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const buyButton = screen.getByText('Buy Credits');
      await act(async () => {
        await user.click(buyButton);
        jest.runAllTimers();
      });

      // Dialog should open instead of redirecting
      expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should only allow numbers and decimal point in custom amount', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, 'abc123.45xyz');
        jest.runAllTimers();
      });

      // Should only contain numbers and decimal
      expect(customInput).toHaveValue('123.45');
    });

    it('should limit decimal places to 2', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const customInput = screen.getByLabelText(/Enter custom amount or select a package/i);
      await act(async () => {
        await user.type(customInput, '25.999');
        jest.runAllTimers();
      });

      // Should only allow 2 decimal places
      expect(customInput).toHaveValue('25.99');
    });
  });

  describe('Auto Top-Up Settings', () => {
    it('should display Auto Top-Up section', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      expect(screen.getByText('Auto Top-Up')).toBeInTheDocument();
      expect(screen.getByText(/Automatically add credits when your balance falls below/i)).toBeInTheDocument();
    });

    it('should have auto top-up toggle initially disabled', async () => {
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // The switch should be rendered but the settings form should not be visible
      expect(screen.queryByLabelText('When balance falls below')).not.toBeInTheDocument();
    });

    it('should show auto top-up form when toggle is enabled', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Find and click the switch (it's in the Auto Top-Up section)
      const switches = screen.getAllByRole('switch');
      const autoTopUpSwitch = switches[0]; // First switch is auto top-up

      await act(async () => {
        await user.click(autoTopUpSwitch);
        jest.runAllTimers();
      });

      // Form should now be visible
      expect(screen.getByLabelText('When balance falls below')).toBeInTheDocument();
      expect(screen.getByLabelText('Automatically add')).toBeInTheDocument();
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });

    it('should show info notice about payment method', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      const switches = screen.getAllByRole('switch');
      await act(async () => {
        await user.click(switches[0]);
        jest.runAllTimers();
      });

      expect(screen.getByText(/Auto top-up requires a saved payment method/i)).toBeInTheDocument();
    });

    it('should load saved auto top-up settings from user data', async () => {
      const userWithAutoTopUp: UserData = {
        ...mockBasicUserData,
        settings: {
          auto_topup_enabled: true,
          auto_topup_threshold: 1500, // $15.00 in cents
          auto_topup_amount: 5000, // $50.00 in cents
        },
      };
      (getUserData as jest.Mock).mockReturnValue(userWithAutoTopUp);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Form should be visible since auto top-up is enabled
      expect(screen.getByLabelText('When balance falls below')).toHaveValue('15.00');
      expect(screen.getByLabelText('Automatically add')).toHaveValue('50.00');
    });

    it('should save auto top-up settings when Save Settings is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Enable auto top-up
      const switches = screen.getAllByRole('switch');
      await act(async () => {
        await user.click(switches[0]);
        jest.runAllTimers();
      });

      // Fill in values
      const thresholdInput = screen.getByLabelText('When balance falls below');
      const amountInput = screen.getByLabelText('Automatically add');

      await act(async () => {
        await user.clear(thresholdInput);
        await user.type(thresholdInput, '20');
        await user.clear(amountInput);
        await user.type(amountInput, '100');
        jest.runAllTimers();
      });

      // Click save
      const saveButton = screen.getByText('Save Settings');
      await act(async () => {
        await user.click(saveButton);
        jest.runAllTimers();
      });

      // Verify API was called with correct data
      expect(makeAuthenticatedRequest).toHaveBeenCalledWith(
        'https://api.example.com/user/profile',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            settings: {
              auto_topup_enabled: true,
              auto_topup_threshold: 2000, // $20.00 in cents
              auto_topup_amount: 10000, // $100.00 in cents
            },
          }),
        })
      );
    });

    it('should show alert when threshold is below $5 minimum', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Enable auto top-up
      const switches = screen.getAllByRole('switch');
      await act(async () => {
        await user.click(switches[0]);
        jest.runAllTimers();
      });

      // Set threshold below $5
      const thresholdInput = screen.getByLabelText('When balance falls below');
      await act(async () => {
        await user.clear(thresholdInput);
        await user.type(thresholdInput, '3');
        jest.runAllTimers();
      });

      // Click save
      const saveButton = screen.getByText('Save Settings');
      await act(async () => {
        await user.click(saveButton);
        jest.runAllTimers();
      });

      expect(alertMock).toHaveBeenCalledWith('Threshold must be at least $5.00');
      alertMock.mockRestore();
    });

    it('should show alert when top-up amount is below $5 minimum', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Enable auto top-up
      const switches = screen.getAllByRole('switch');
      await act(async () => {
        await user.click(switches[0]);
        jest.runAllTimers();
      });

      // Set valid threshold but invalid amount
      const thresholdInput = screen.getByLabelText('When balance falls below');
      const amountInput = screen.getByLabelText('Automatically add');
      await act(async () => {
        await user.clear(thresholdInput);
        await user.type(thresholdInput, '10');
        await user.clear(amountInput);
        await user.type(amountInput, '2');
        jest.runAllTimers();
      });

      // Click save
      const saveButton = screen.getByText('Save Settings');
      await act(async () => {
        await user.click(saveButton);
        jest.runAllTimers();
      });

      expect(alertMock).toHaveBeenCalledWith('Top-up amount must be at least $5.00');
      alertMock.mockRestore();
    });

    it('should show "Settings saved" after successful save', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (getUserData as jest.Mock).mockReturnValue(mockBasicUserData);
      (makeAuthenticatedRequest as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Enable auto top-up
      const switches = screen.getAllByRole('switch');
      await act(async () => {
        await user.click(switches[0]);
        jest.runAllTimers();
      });

      // Click save (default values should be valid)
      const saveButton = screen.getByText('Save Settings');
      await act(async () => {
        await user.click(saveButton);
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(screen.getByText('Settings saved')).toBeInTheDocument();
      });
    });

    it('should show "Changes not saved" when settings are modified', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const userWithAutoTopUp: UserData = {
        ...mockBasicUserData,
        settings: {
          auto_topup_enabled: true,
          auto_topup_threshold: 1000,
          auto_topup_amount: 2500,
        },
      };
      (getUserData as jest.Mock).mockReturnValue(userWithAutoTopUp);

      await act(async () => {
        render(<CreditsPage />);
        jest.runAllTimers();
      });

      // Modify a value
      const thresholdInput = screen.getByLabelText('When balance falls below');
      await act(async () => {
        await user.clear(thresholdInput);
        await user.type(thresholdInput, '15');
        jest.runAllTimers();
      });

      expect(screen.getByText('Changes not saved')).toBeInTheDocument();
    });
  });
});
