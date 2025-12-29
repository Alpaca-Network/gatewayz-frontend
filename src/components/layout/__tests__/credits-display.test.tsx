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
    it('should display PRO badge for pro tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 5000,
        tier: 'pro',
        subscription_status: 'active',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show PRO badge
      expect(screen.getByText('PRO')).toBeInTheDocument();
      // Should not show credit count
      expect(screen.queryByText('5,000')).not.toBeInTheDocument();
    });

    it('should handle uppercase PRO tier from backend', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 5000,
        tier: 'PRO' as any, // Simulate backend sending uppercase
        subscription_status: 'active',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should still show PRO badge after normalization
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });
  });

  describe('MAX Tier Users', () => {
    it('should display MAX badge for max tier users', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
        tier: 'max',
        subscription_status: 'active',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show MAX badge
      expect(screen.getByText('MAX')).toBeInTheDocument();
      // Should not show credit count
      expect(screen.queryByText('15,000')).not.toBeInTheDocument();
    });

    it('should handle uppercase MAX tier from backend', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Max User',
        email: 'max@example.com',
        credits: 15000,
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
    it('should display trial badge with days remaining', () => {
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
        credits: 1000,
        tier: 'pro',
        subscription_status: 'trial',
        trial_expires_at: futureDate.toISOString(),
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show trial badge with days remaining
      expect(screen.getByText(/Trial.*\(5d\)/)).toBeInTheDocument();
      // Should not show PRO badge or credits
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });

    it('should display "Trial ending" when trial expires within 1 day', () => {
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
        credits: 1000,
        tier: 'pro',
        subscription_status: 'trial',
        trial_expires_at: futureDate.toISOString(),
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show "Trial ending" text
      expect(screen.getByText('Trial ending')).toBeInTheDocument();
    });

    it('should display trial without days when trial_expires_at is not set', () => {
      const mockUserData: UserData = {
        user_id: 1,
        api_key: 'test-key',
        auth_method: 'email',
        privy_user_id: 'test-privy-id',
        display_name: 'Trial User',
        email: 'trial@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'trial',
      };

      (getUserData as jest.Mock).mockReturnValue(mockUserData);

      render(<CreditsDisplay />);

      // Should show just "Trial" without days
      expect(screen.getByText('Trial')).toBeInTheDocument();
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
