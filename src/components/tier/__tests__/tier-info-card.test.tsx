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
