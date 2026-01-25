import React from 'react';
import { render, screen } from '@testing-library/react';
import { FreeModelsBanner } from '../free-models-banner';
import * as api from '@/lib/api';
import * as tierUtils from '@/lib/tier-utils';

// Mock the getUserData function
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
}));

// Mock the tier-utils functions
jest.mock('@/lib/tier-utils', () => ({
  getUserTier: jest.fn(),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock the Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="alert-circle-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

const mockGetUserData = api.getUserData as jest.MockedFunction<typeof api.getUserData>;
const mockGetUserTier = tierUtils.getUserTier as jest.MockedFunction<typeof tierUtils.getUserTier>;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => {
        Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
      }),
    },
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
});

describe('FreeModelsBanner', () => {
  describe('Pro/Max user handling', () => {
    it('should NOT show banner for Pro users even with low credits', () => {
      const proUserData = {
        credits: 300, // 300 cents = $3
        tier: 'pro',
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(proUserData as api.UserData);
      mockGetUserTier.mockReturnValue('pro');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for Pro users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });

    it('should NOT show banner for Pro users with 0 credits', () => {
      const proUserData = {
        credits: 0,
        tier: 'pro',
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(proUserData as api.UserData);
      mockGetUserTier.mockReturnValue('pro');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for Pro users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });

    it('should NOT show banner for Max users even with low credits', () => {
      const maxUserData = {
        credits: 200, // 200 cents = $2
        tier: 'max',
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(maxUserData as api.UserData);
      mockGetUserTier.mockReturnValue('max');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for Max users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });

    it('should NOT show banner for Max users with 0 credits', () => {
      const maxUserData = {
        credits: 0,
        tier: 'max',
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(maxUserData as api.UserData);
      mockGetUserTier.mockReturnValue('max');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for Max users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });

    it('should NOT show banner for Pro users with case-insensitive tier check', () => {
      const proUserData = {
        credits: 100, // 100 cents = $1
        tier: 'Pro', // Uppercase
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(proUserData as api.UserData);
      mockGetUserTier.mockReturnValue('pro'); // getUserTier normalizes to lowercase

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for Pro users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });
  });

  describe('Basic/Trial user handling', () => {
    it('should show banner for basic users with low credits (500 cents = $5 or fewer)', () => {
      const basicUserData = {
        credits: 300, // 300 cents = $3
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      render(<FreeModelsBanner />);

      // Banner should be rendered for basic users with low credits (displays as $3.00)
      expect(screen.getByText(/Low Credits \(\$3\.00 remaining\)/)).toBeInTheDocument();
    });

    it('should show banner for basic users with 0 credits', () => {
      const basicUserData = {
        credits: 0,
        tier: 'basic',
        subscription_status: 'expired' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      render(<FreeModelsBanner />);

      // Banner should show "Trial Credits Used Up" for 0 credits
      expect(screen.getByText(/Trial Credits Used Up/)).toBeInTheDocument();
    });

    it('should show banner for basic users with exactly 500 cents ($5)', () => {
      const basicUserData = {
        credits: 500, // 500 cents = $5
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      render(<FreeModelsBanner />);

      // Banner should be rendered for 500 cents ($5) (threshold is <= 500 cents)
      expect(screen.getByText(/Low Credits \(\$5\.00 remaining\)/)).toBeInTheDocument();
    });

    it('should NOT show banner for basic users with more than 500 cents ($5)', () => {
      const basicUserData = {
        credits: 600, // 600 cents = $6
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered when credits > 500 cents ($5)
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should NOT show banner when userData is null', () => {
      mockGetUserData.mockReturnValue(null);

      render(<FreeModelsBanner />);

      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trial Credits Used Up/)).not.toBeInTheDocument();
    });

    it('should NOT show banner when banner was dismissed within 24 hours', () => {
      const basicUserData = {
        credits: 300, // 300 cents = $3
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      // Set dismissal timestamp to 12 hours ago (within 24 hours)
      const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
      mockLocalStorage['gatewayz_free_models_banner_dismissed'] = twelveHoursAgo.toString();

      render(<FreeModelsBanner />);

      // Banner should NOT be shown because it was dismissed less than 24 hours ago
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
    });

    it('should show banner when banner was dismissed more than 24 hours ago', () => {
      const basicUserData = {
        credits: 300, // 300 cents = $3
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      // Set dismissal timestamp to 25 hours ago (outside 24 hour window)
      const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
      mockLocalStorage['gatewayz_free_models_banner_dismissed'] = twentyFiveHoursAgo.toString();

      render(<FreeModelsBanner />);

      // Banner should be shown because dismissal was more than 24 hours ago (displays as $3.00)
      expect(screen.getByText(/Low Credits \(\$3\.00 remaining\)/)).toBeInTheDocument();
    });

    it('should handle decimal credit values correctly', () => {
      const basicUserData = {
        credits: 370, // 370 cents = $3.70
        tier: 'basic',
        subscription_status: 'trial' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(basicUserData as api.UserData);
      mockGetUserTier.mockReturnValue('basic');

      render(<FreeModelsBanner />);

      // Credits should display as $3.70
      expect(screen.getByText(/Low Credits \(\$3\.70 remaining\)/)).toBeInTheDocument();
    });
  });

  describe('getUserTier integration', () => {
    it('should use getUserTier to determine tier accurately', () => {
      const userData = {
        credits: 200, // 200 cents = $2
        tier: 'basic', // Tier says basic
        subscription_status: 'active' as const, // But has active subscription
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(userData as api.UserData);
      // getUserTier correctly returns 'pro' because of active subscription
      mockGetUserTier.mockReturnValue('pro');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered because getUserTier correctly identifies as pro
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();

      // Verify getUserTier was called with the correct userData
      expect(mockGetUserTier).toHaveBeenCalledWith(userData);
    });

    it('should handle tier inference from tier_display_name', () => {
      const userData = {
        credits: 100, // 100 cents = $1
        tier: 'basic',
        tier_display_name: 'Pro',
        subscription_status: 'active' as const,
        user_id: '123',
      };

      mockGetUserData.mockReturnValue(userData as api.UserData);
      // getUserTier infers 'pro' from tier_display_name
      mockGetUserTier.mockReturnValue('pro');

      render(<FreeModelsBanner />);

      // Banner should NOT be rendered for inferred pro users
      expect(screen.queryByText(/Low Credits/)).not.toBeInTheDocument();
    });
  });
});
