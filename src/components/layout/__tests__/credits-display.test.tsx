import { render, screen, waitFor } from '@testing-library/react';
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

      expect(screen.getByText('1,000')).toBeInTheDocument();

      // Simulate upgrade to PRO
      const upgradedUserData: UserData = {
        ...initialUserData,
        tier: 'pro',
        subscription_status: 'active',
      };

      (getUserData as jest.Mock).mockReturnValue(upgradedUserData);

      // Trigger storage event
      window.dispatchEvent(new Event('storage'));

      // Wait for update
      await waitFor(() => {
        expect(screen.getByText('PRO')).toBeInTheDocument();
      });
    });
  });
});
