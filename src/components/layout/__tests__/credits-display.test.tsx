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
        credits: 5,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 5, // Tiered credits: allowance remaining
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance in progress bar
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
        credits: 5,
        tier: 'PRO' as any, // Simulate backend sending uppercase
        subscription_status: 'active',
        subscription_allowance: 5, // Tiered credits: allowance remaining
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
        credits: 75,
        tier: 'max',
        subscription_status: 'active',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should show credit amount in progress bar
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
        credits: 75,
        tier: 'MAX' as any, // Simulate backend sending uppercase
        subscription_status: 'active',
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
        credits: 25, // More than 3 trial credits = purchased credits
        tier: 'basic',
        subscription_status: 'trial', // Stale status - should be ignored due to purchased credits
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credits, not trial badge
      expect(screen.getByText('25')).toBeInTheDocument();
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
        credits: 50, // More than 3 trial credits = purchased credits
        tier: 'basic',
        subscription_status: 'expired', // Stale status - should be ignored due to purchased credits
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show credits, not upgrade prompt
      expect(screen.getByText('50')).toBeInTheDocument();
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
        credits: 5, // $5 remaining of $15 allocation
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 5, // Tiered credits
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance
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
        credits: 75, // $75 remaining of $150 allocation
        tier: 'max',
        subscription_status: 'active',
        subscription_allowance: 75, // Tiered credits
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should show subscription allowance
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
        credits: 5,
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 5,
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
        credits: 8, // 80% of $15 allocation
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 8,
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show $8 subscription allowance
      expect(screen.getByText('$8')).toBeInTheDocument();
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
        credits: 1, // Only 10% remaining - should show red
        tier: 'pro',
        subscription_status: 'active',
        subscription_allowance: 1, // Tiered credits: allowance remaining
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show $1 subscription allowance amount
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
        credits: 3,
        tier: undefined, // Missing tier field!
        tier_display_name: 'Pro', // But has display name
        subscription_status: 'active',
        subscription_allowance: 3, // Tiered credits: allowance remaining
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show Pro badge (using tier_display_name since it's provided)
      expect(screen.getByText('Pro')).toBeInTheDocument();
      // Should show subscription allowance amount
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
        credits: 5,
        tier: undefined,
        tier_display_name: undefined,
        subscription_status: 'active',
        subscription_allowance: 5, // Tiered credits: allowance remaining
        purchased_credits: 0,
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge (fallback to uppercase since tier_display_name is missing)
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should show subscription allowance amount
      expect(screen.getByText('$5')).toBeInTheDocument();
      // Should show Add Credits button
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
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
        subscription_allowance: 15, // Tiered credits for PRO
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
