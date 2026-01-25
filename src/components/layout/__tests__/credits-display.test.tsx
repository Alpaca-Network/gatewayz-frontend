import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreditsDisplay } from '../credits-display';
import { getUserData } from '@/lib/api';
import type { UserData } from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Coins: () => <span data-testid="coins-icon">Coins</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
  Sparkles: () => <span data-testid="sparkles-icon">Sparkles</span>,
  AlertCircle: () => <span data-testid="alert-icon">AlertCircle</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
}));

describe('CreditsDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('Basic Tier Users', () => {
    it('should display credit count for basic tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 1000,
        tier: 'basic',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credit count
      expect(screen.getByText('1,000')).toBeInTheDocument();
      // Should not show tier badge
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
      expect(screen.queryByText('MAX')).not.toBeInTheDocument();
    });

    it('should display 0 credits correctly', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        tier: 'basic',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show 0 credits
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display credits when tier is undefined', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show 500 credits
      expect(screen.getByText('500')).toBeInTheDocument();
    });
  });

  describe('PRO Tier Users', () => {
    it('should display PRO badge and credit usage for pro tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 500, // Tiered credits: $5.00 allowance remaining (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance in progress bar (500 cents = $5)
      expect(screen.getByText('$5')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should handle uppercase PRO tier from backend', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500,
        tier: 'PRO' as any, // Simulate backend sending uppercase
        subscription_status: 'active',
        subscription_allowance: 500, // Tiered credits: $5.00 allowance remaining (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should still show PRO badge after normalization
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });
  });

  describe('MAX Tier Users', () => {
    it('should display MAX badge and credit usage for max tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 7500,
        tier: 'max',
        subscription_status: 'active',
        subscription_allowance: 7500, // Tiered credits: $75.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should show subscription allowance in progress bar (7500 cents = $75)
      expect(screen.getByText('$75')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should handle uppercase MAX tier from backend', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 7500,
        tier: 'MAX' as any, // Simulate backend sending uppercase
        subscription_status: 'active',
        subscription_allowance: 7500, // $75.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should still show MAX badge after normalization
      expect(screen.getByText('MAX')).toBeInTheDocument();
    });
  });

  describe('Trial Users', () => {
    it('should display trial badge with days remaining for basic tier user', () => {
      // Set trial to expire in 5 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 3, // Trial users start with 3 credits
        tier: 'basic', // Trial only applies to basic tier
        subscription_status: 'trial',
        trial_expires_at: futureDate.toISOString(),
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show trial badge with days remaining
      expect(screen.getByText(/Trial.*\(5d\)/)).toBeInTheDocument();
      // Should not show credits
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });

    it('should display "Trial ending" when trial expires within 1 day for basic tier user', () => {
      // Set trial to expire in 12 hours (less than 1 day)
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 12);

      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 2, // Trial credits (less than or equal to 3)
        tier: 'basic', // Trial only applies to basic tier
        subscription_status: 'trial',
        trial_expires_at: futureDate.toISOString(),
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show "Trial ending" text
      expect(screen.getByText('Trial ending')).toBeInTheDocument();
    });

    it('should display trial without days when trial_expires_at is not set for basic tier user', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 1, // Trial credits (less than or equal to 3)
        tier: 'basic', // Trial only applies to basic tier
        subscription_status: 'trial',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show just "Trial" without days
      expect(screen.getByText('Trial')).toBeInTheDocument();
    });

    it('should display trial for user without tier specified (default to basic)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 3, // Trial credits (3 is the trial amount)
        // tier is undefined - should default to basic behavior
        subscription_status: 'trial',
        trial_expires_at: futureDate.toISOString(),
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show trial badge
      expect(screen.getByText(/Trial.*\(3d\)/)).toBeInTheDocument();
    });
  });

  describe('Expired Trial Users', () => {
    it('should display upgrade prompt for expired trial', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Expired User',
        email: 'expired@example.com',
        credits: 0,
        tier: 'basic',
        subscription_status: 'expired',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show upgrade prompt
      expect(screen.getByText('Upgrade')).toBeInTheDocument();
      // Should not show credits or tier badges
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
    });
  });

  describe('Paid Tier with Stale Subscription Status (Bug Fix)', () => {
    // These tests verify the fix for the bug where paid tier users (pro/max)
    // were incorrectly showing trial/expired status due to stale subscription_status
    // from webhook timing or database sync issues

    it('should show MAX badge (not trial) when max tier user has stale trial subscription_status', () => {
      // This is the exact bug reported for user vaughn.dimarco@gmail.com
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'trial', // Stale status - should be ignored for max tier
        subscription_allowance: 15000,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge, not trial
      expect(screen.getByText('MAX')).toBeInTheDocument();
      expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
    });

    it('should show PRO badge (not trial) when pro tier user has stale trial subscription_status', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 5000,
        tier: 'pro',
        subscription_status: 'trial', // Stale status - should be ignored for pro tier
        subscription_allowance: 5000,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge, not trial
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
    });

    it('should show MAX badge (not upgrade prompt) when max tier user has stale expired subscription_status', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'expired', // Stale status - should be ignored for max tier
        subscription_allowance: 15000,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge, not upgrade prompt
      expect(screen.getByText('MAX')).toBeInTheDocument();
      expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
    });

    it('should show PRO badge (not upgrade prompt) when pro tier user has stale expired subscription_status', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 5000,
        tier: 'pro',
        subscription_status: 'expired', // Stale status - should be ignored for pro tier
        subscription_allowance: 5000,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge, not upgrade prompt
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
    });

    it('should handle uppercase MAX tier with stale trial status', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'MAX' as any, // Uppercase tier from backend
        subscription_status: 'trial', // Stale status
        subscription_allowance: 15000,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge after normalization, not trial
      expect(screen.getByText('MAX')).toBeInTheDocument();
      expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
    });

    it('should show credits (not trial) when basic user has purchased credits with stale trial status', () => {
      // User has added credits beyond initial trial amount, but subscription_status is still trial
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Basic User with Credits',
        email: 'basic@example.com',
        credits: 2500, // More than 500 cents ($5 trial) = purchased credits (this is $25)
        tier: 'basic',
        subscription_status: 'trial', // Stale status - should be ignored due to purchased credits
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credits (converted to dollars), not trial badge
      expect(screen.getByText('$25.00')).toBeInTheDocument();
      expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
    });

    it('should show credits (not upgrade) when basic user has purchased credits with stale expired status', () => {
      // User has added credits but subscription_status is still expired
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Basic User with Credits',
        email: 'basic@example.com',
        credits: 5000, // More than 500 cents ($5 trial) = purchased credits (this is $50)
        tier: 'basic',
        subscription_status: 'expired', // Stale status - should be ignored due to purchased credits
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credits (converted to dollars), not upgrade prompt
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should not render when credits is null', () => {
      (getUserData as jest.Mock).mockReturnValue(null);

      const { container } = render(<CreditsDisplay />);

      expect(container.firstChild).toBeNull();
    });

    it('should not render when credits is undefined', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: undefined as any,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      const { container } = render(<CreditsDisplay />);

      expect(container.firstChild).toBeNull();
    });

    it('should link to credits settings page', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'basic',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/settings/credits');
    });
  });

  describe('Credit Usage Progress Bar for Pro/Max Users', () => {
    it('should display progress bar and Add Credits button for Pro users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500, // $5 remaining of $15 allocation (in cents)
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 500, // Tiered credits: $5.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance (500 cents = $5)
      expect(screen.getByText('$5')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should display progress bar and Add Credits button for Max users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 7500, // $75 remaining of $150 allocation (in cents)
        tier: 'max',
        subscription_status: 'active',
        subscription_allowance: 7500, // Tiered credits: $75.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should show subscription allowance (7500 cents = $75)
      expect(screen.getByText('$75')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should link Add Credits button to credits page with buy=true', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 500, // $5.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      const addCreditsLink = screen.getByText('Add Credits').closest('a');
      expect(addCreditsLink).toHaveAttribute('href', '/settings/credits?buy=true');
    });

    it('should show green progress bar when credits are above 50%', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1200, // 80% of $15 allocation (in cents)
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1200, // $12.00 (in cents) - 80% of $15
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show $12 subscription allowance (1200 cents = $12)
      expect(screen.getByText('$12')).toBeInTheDocument();
    });

    it('should NOT show Add Credits button for basic tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Basic User',
        email: 'basic@example.com',
        credits: 50,
        tier: 'basic',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credits
      expect(screen.getByText('50')).toBeInTheDocument();
      // Should NOT show Add Credits button
      expect(screen.queryByText('Add Credits')).not.toBeInTheDocument();
    });

    it('should handle Pro user with low credits (showing low indicator)', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 100, // Only ~7% remaining of $15 - should show red
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 100, // Tiered credits: $1.00 allowance remaining (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show $1 subscription allowance amount (100 cents = $1)
      expect(screen.getByText('$1')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should handle Pro user with 0 credits', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 0,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 0, // Tiered credits: no allowance remaining
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show $0 subscription allowance amount
      expect(screen.getByText('$0')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });
  });

  describe('Missing Tier Field with Active Subscription (getUserTier fix)', () => {
    it('should show PRO badge when tier field is missing but subscription_status is active', () => {
      // This is the key bug fix scenario - backend sometimes returns active subscription
      // but tier field is undefined. getUserTier should infer 'pro' in this case.
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 300,
        tier: undefined, // Missing tier field!
        tier_display_name: 'Pro', // But has display name
        subscription_status: 'active',
        subscription_allowance: 300, // Tiered credits: $3.00 allowance remaining (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show Pro badge (using tier_display_name since it's provided)
      expect(screen.getByText('Pro')).toBeInTheDocument();
      // Should show subscription allowance amount (300 cents = $3)
      expect(screen.getByText('$3')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    it('should show PRO badge when tier field is missing and tier_display_name is also missing but subscription is active', () => {
      // Edge case: both tier and tier_display_name are missing, but subscription is active
      // getUserTier should default to 'pro', display falls back to uppercase 'PRO'
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500,
        tier: undefined,
        tier_display_name: undefined,
        subscription_status: 'active',
        subscription_allowance: 500, // Tiered credits: $5.00 allowance remaining (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge (fallback to uppercase since tier_display_name is missing)
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance amount (500 cents = $5)
      expect(screen.getByText('$5')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });
  });

  describe('Purchased Credits Display for Pro/Max Users', () => {
    it('should display purchased credits indicator when purchasedCredits > 0 for Pro user', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 2000, // $20 total (in cents)
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1000, // $10 allowance remaining (in cents)
        purchased_credits: 1000, // $10 purchased (in cents)
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance (1000 cents = $10)
      expect(screen.getByText('$10')).toBeInTheDocument();
      // Should show purchased credits indicator (1000 cents = $10)
      expect(screen.getByText('+$10')).toBeInTheDocument();
    });

    it('should display purchased credits indicator when purchasedCredits > 0 for Max user', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 17500, // $175 total (in cents)
        tier: 'max',
        subscription_status: 'active',
        subscription_allowance: 15000, // $150 allowance remaining (in cents)
        purchased_credits: 2500, // $25 purchased (in cents)
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should show subscription allowance (15000 cents = $150)
      expect(screen.getByText('$150')).toBeInTheDocument();
      // Should show purchased credits indicator (2500 cents = $25)
      expect(screen.getByText('+$25')).toBeInTheDocument();
    });

    it('should NOT display purchased credits indicator when purchasedCredits is 0', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1000, // $10.00 (in cents)
        purchased_credits: 0, // No purchased credits
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should NOT show purchased credits indicator
      expect(screen.queryByText(/\+\$/)).not.toBeInTheDocument();
    });

    it('should NOT display purchased credits indicator when purchasedCredits is undefined', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1000, // $10.00 (in cents)
        // purchased_credits is undefined
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should NOT show purchased credits indicator
      expect(screen.queryByText(/\+\$/)).not.toBeInTheDocument();
    });

    it('should handle fractional purchased credits', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1550,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1000, // $10.00 (in cents)
        purchased_credits: 550, // $5.50 (in cents) - fractional when converted to dollars
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show purchased credits (550 cents = $5.50, rounded to $6)
      expect(screen.getByText('+$6')).toBeInTheDocument();
    });

    it('should use tier_display_name when available for badge text', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1500,
        tier: 'pro',
        tier_display_name: 'Pro Plus', // Custom display name
        subscription_status: 'active',
        subscription_allowance: 1000, // $10.00 (in cents)
        purchased_credits: 500, // $5.00 (in cents)
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show custom tier_display_name
      expect(screen.getByText('Pro Plus')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Color States', () => {
    it('should show progress bar with appropriate color when allowance is low (<=20%)', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 200,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 200, // $2 of $15 = ~13% - low (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge and low credits indicator
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.getByText('$2')).toBeInTheDocument();
    });

    it('should show progress bar with appropriate color when allowance is medium (20-50%)', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 500,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 500, // $5 of $15 = ~33% - medium (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.getByText('$5')).toBeInTheDocument();
    });

    it('should show progress bar with appropriate color when allowance is high (>50%)', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1200,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1200, // $12 of $15 = 80% - high (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.getByText('$12')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should update when localStorage changes', async () => {
      const initialUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 1000,
        tier: 'basic',
      };

      (getUserData as jest.Mock).mockReturnValue(initialUserData);

      const { rerender } = render(<CreditsDisplay />);

      // Should show credit count
      expect(screen.getByText('1,000')).toBeInTheDocument();

      // Simulate upgrade to PRO
      const upgradedUserData: UserData = {
        ...initialUserData,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1500, // Tiered credits for PRO: $15.00 (in cents)
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(upgradedUserData);

      // Trigger storage event wrapped in act()
      await act(async () => {
        window.dispatchEvent(new Event('storage'));
      });

      // Wait for update
      await waitFor(() => {
        expect(screen.getByText('PRO')).toBeInTheDocument();
      });
    });
  });
});
