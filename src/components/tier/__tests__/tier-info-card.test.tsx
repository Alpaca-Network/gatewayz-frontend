import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TierInfoCard } from '../tier-info-card';
import { useTier } from '@/hooks/use-tier';

// Mock the useTier hook
jest.mock('@/hooks/use-tier', () => ({
  useTier: jest.fn(),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="alert-icon">AlertCircle</span>,
  CheckCircle: () => <span data-testid="check-icon">CheckCircle</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  Sparkles: () => <span data-testid="sparkles-icon">Sparkles</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
}));

describe('TierInfoCard', () => {
  const mockUseTier = useTier as jest.MockedFunction<typeof useTier>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Tier Display', () => {
    it('should display basic tier info for pay-per-use users', () => {
      mockUseTier.mockReturnValue({
        tier: 'basic',
        tierInfo: {
          name: 'basic',
          displayName: 'Basic',
          description: 'Pay-per-use access to all features',
          monthlyPrice: 'Pay-per-use',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText(/pay-per-use plan/i)).toBeInTheDocument();
    });
  });

  describe('Trial Users', () => {
    it('should display trial badge and trial info panel', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier with more features',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: true,
        trialExpired: false,
        trialExpirationDate: futureDate,
        trialDaysRemaining: 7,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      // Should show trial badge
      expect(screen.getByText('Trial')).toBeInTheDocument();
      // Should show trial info panel
      expect(screen.getByText("You're on a free trial!")).toBeInTheDocument();
      expect(screen.getByText('Days Remaining')).toBeInTheDocument();
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('Expires On')).toBeInTheDocument();
      // Should show upgrade prompt
      expect(screen.getByText(/Upgrade to a paid plan/i)).toBeInTheDocument();
    });

    it('should show trial expiring soon warning', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: true,
        trialExpired: false,
        trialExpirationDate: futureDate,
        trialDaysRemaining: 1,
        trialExpiringSoon: true,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      // Should show expiring soon warning
      expect(screen.getByText(/ending soon/i)).toBeInTheDocument();
    });

    it('should show unknown when trial days remaining is null', () => {
      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: true,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Expired Trial Users', () => {
    it('should display expired badge and expired trial notice', () => {
      mockUseTier.mockReturnValue({
        tier: 'basic',
        tierInfo: {
          name: 'basic',
          displayName: 'Basic',
          description: 'Pay-per-use access',
          monthlyPrice: 'Pay-per-use',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: true,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      // Should show expired badge
      expect(screen.getByText('Expired')).toBeInTheDocument();
      // Should show expired trial notice
      expect(screen.getByText('Your trial has expired')).toBeInTheDocument();
      expect(screen.getByText(/Upgrade to a paid plan to continue/i)).toBeInTheDocument();
    });
  });

  describe('Active Subscription', () => {
    it('should display active subscription status', () => {
      const renewalDate = new Date();
      renewalDate.setMonth(renewalDate.getMonth() + 1);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('$20/month')).toBeInTheDocument();
      expect(screen.getByText('Next Billing Date')).toBeInTheDocument();
    });

    it('should show expiring soon warning for subscription', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 2);

      mockUseTier.mockReturnValue({
        tier: 'max',
        tierInfo: {
          name: 'max',
          displayName: 'Max',
          description: 'Maximum tier',
          monthlyPrice: '$50/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: true,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText(/expires soon/i)).toBeInTheDocument();
    });
  });

  describe('Cancelled/Past Due Subscriptions', () => {
    it('should display cancelled subscription status', () => {
      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Cancelled',
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('should display past due subscription status', () => {
      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$20/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Past due',
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Past due')).toBeInTheDocument();
    });
  });

  describe('Credit Breakdown for Pro/Max users', () => {
    it('should display credit breakdown section for Pro users with active subscription and userData', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 2000,
          tier: 'pro',
          subscription_status: 'active',
          subscription_allowance: 1500, // $15.00
          purchased_credits: 500, // $5.00
          total_credits: 2000, // $20.00
        },
      });

      render(<TierInfoCard />);

      // Should show credit breakdown section
      expect(screen.getByText('Credit Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Monthly Allowance')).toBeInTheDocument();
      expect(screen.getByText('$15.00')).toBeInTheDocument();
      expect(screen.getByText('Resets on billing date')).toBeInTheDocument();
      expect(screen.getByText('Purchased Credits')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument();
      expect(screen.getByText('Never expire')).toBeInTheDocument();
      expect(screen.getByText('Total Available')).toBeInTheDocument();
      expect(screen.getByText('$20.00')).toBeInTheDocument();
    });

    it('should display credit breakdown section for Max users with active subscription and userData', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 10);

      mockUseTier.mockReturnValue({
        tier: 'max',
        tierInfo: {
          name: 'max',
          displayName: 'Max',
          description: 'Maximum tier',
          monthlyPrice: '$75/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Max User',
          email: 'max@example.com',
          credits: 16000,
          tier: 'max',
          subscription_status: 'active',
          subscription_allowance: 15000, // $150.00
          purchased_credits: 1000, // $10.00
          total_credits: 16000, // $160.00
        },
      });

      render(<TierInfoCard />);

      // Should show credit breakdown section
      expect(screen.getByText('Credit Breakdown')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('$160.00')).toBeInTheDocument();
    });

    it('should handle Pro user with 0 purchased credits', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 20);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 1500,
          tier: 'pro',
          subscription_status: 'active',
          subscription_allowance: 1500, // $15.00
          purchased_credits: 0, // $0.00
          total_credits: 1500, // $15.00
        },
      });

      render(<TierInfoCard />);

      // Should show credit breakdown with 0 purchased credits
      expect(screen.getByText('Credit Breakdown')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle missing subscription_allowance (defaults to 0)', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 500,
          tier: 'pro',
          subscription_status: 'active',
          // subscription_allowance is undefined
          purchased_credits: 500,
        },
      });

      render(<TierInfoCard />);

      // Should show credit breakdown section with default values
      expect(screen.getByText('Credit Breakdown')).toBeInTheDocument();
    });

    it('should NOT display credit breakdown when userData is null', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null, // No userData
      });

      render(<TierInfoCard />);

      // Should NOT show credit breakdown
      expect(screen.queryByText('Credit Breakdown')).not.toBeInTheDocument();
    });

    it('should NOT display credit breakdown for basic tier even with userData', () => {
      mockUseTier.mockReturnValue({
        tier: 'basic',
        tierInfo: {
          name: 'basic',
          displayName: 'Basic',
          description: 'Pay-per-use access',
          monthlyPrice: 'Pay-per-use',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Basic User',
          email: 'basic@example.com',
          credits: 500,
          tier: 'basic',
        },
      });

      render(<TierInfoCard />);

      // Should NOT show credit breakdown for basic tier
      expect(screen.queryByText('Credit Breakdown')).not.toBeInTheDocument();
    });

    it('should NOT display credit breakdown for Pro users without active subscription', () => {
      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Cancelled',
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 500,
          tier: 'pro',
          subscription_status: 'cancelled',
          subscription_allowance: 0,
          purchased_credits: 500,
        },
      });

      render(<TierInfoCard />);

      // Should NOT show credit breakdown for cancelled subscription
      expect(screen.queryByText('Credit Breakdown')).not.toBeInTheDocument();
    });

    it('should use total_credits from userData when available', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 2000, // This might be different
          tier: 'pro',
          subscription_status: 'active',
          subscription_allowance: 1500,
          purchased_credits: 500,
          total_credits: 2500, // total_credits takes precedence
        },
      });

      render(<TierInfoCard />);

      // Should show total_credits value
      expect(screen.getByText('$25.00')).toBeInTheDocument();
    });

    it('should fallback to credits when total_credits is undefined', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: {
          user_id: 1,
          api_key: 'test-key',
          auth_method: 'email',
          privy_user_id: 'privy-1',
          display_name: 'Pro User',
          email: 'pro@example.com',
          credits: 2000, // Fallback to this value
          tier: 'pro',
          subscription_status: 'active',
          subscription_allowance: 1500,
          purchased_credits: 500,
          // total_credits is undefined
        },
      });

      render(<TierInfoCard />);

      // Should show credits value as fallback
      expect(screen.getByText('$20.00')).toBeInTheDocument();
    });
  });

  describe('Credit Renewal for Pro/Max users', () => {
    it('should display credit renewal info for Pro users with active subscription', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      // Should show credit renewal section
      expect(screen.getByText('Credit Renewal')).toBeInTheDocument();
      expect(screen.getByText('Days until renewal')).toBeInTheDocument();
      expect(screen.getByText('15 days')).toBeInTheDocument();
      expect(screen.getByText('Renewal date')).toBeInTheDocument();
      expect(screen.getByText(/credits will be replenished/i)).toBeInTheDocument();
    });

    it('should display credit renewal info for Max users with active subscription', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 7);

      mockUseTier.mockReturnValue({
        tier: 'max',
        tierInfo: {
          name: 'max',
          displayName: 'Max',
          description: 'Maximum tier',
          monthlyPrice: '$75/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      // Should show credit renewal section
      expect(screen.getByText('Credit Renewal')).toBeInTheDocument();
      expect(screen.getByText('7 days')).toBeInTheDocument();
    });

    it('should show "Today" when renewal is due today', () => {
      const renewalDate = new Date();

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: true,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('Credit Renewal')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should show singular "day" when 1 day remaining', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 1);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.getByText('1 day')).toBeInTheDocument();
    });

    it('should NOT show credit renewal for basic tier users', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'basic',
        tierInfo: {
          name: 'basic',
          displayName: 'Basic',
          description: 'Pay-per-use access',
          monthlyPrice: 'Pay-per-use',
          features: [],
        },
        hasSubscription: false,
        subscriptionStatusText: null,
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.queryByText('Credit Renewal')).not.toBeInTheDocument();
    });

    it('should NOT show credit renewal for cancelled subscriptions', () => {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Cancelled',
        renewalDate: renewalDate,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.queryByText('Credit Renewal')).not.toBeInTheDocument();
    });

    it('should NOT show credit renewal when no renewal date is available', () => {
      mockUseTier.mockReturnValue({
        tier: 'pro',
        tierInfo: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional tier',
          monthlyPrice: '$10/month',
          features: [],
        },
        hasSubscription: true,
        subscriptionStatusText: 'Active',
        renewalDate: null,
        isExpiringSoon: false,
        isTrial: false,
        trialExpired: false,
        trialExpirationDate: null,
        trialDaysRemaining: null,
        trialExpiringSoon: false,
        isLoading: false,
        error: null,
        userData: null,
      });

      render(<TierInfoCard />);

      expect(screen.queryByText('Credit Renewal')).not.toBeInTheDocument();
    });
  });
});
