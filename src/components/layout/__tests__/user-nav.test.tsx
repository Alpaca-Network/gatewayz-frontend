import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { UserNav } from '../user-nav';

// Mock the useGatewayzAuth hook
const mockLogout = jest.fn();
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: () => ({
    logout: mockLogout,
  }),
}));

// Mock the useTier hook
jest.mock('@/hooks/use-tier', () => ({
  useTier: () => ({
    tier: 'basic',
    tierDisplayName: 'Basic',
    tierInfo: null,
    userData: null,
  }),
}));

// Mock the useToast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock the useActiveWallet hook
const mockConnectWallet = jest.fn();
const mockUseActiveWallet = jest.fn(() => ({
  address: null as `0x${string}` | null,
  connect: mockConnectWallet,
}));
jest.mock('@/lib/hooks/use-active-wallet', () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}));

// Mock useLinkAccount (guest upgrade CTA, M2 W3b)
const mockLinkEmail = jest.fn();
jest.mock('@privy-io/react-auth', () => ({
  useLinkAccount: () => ({ linkEmail: mockLinkEmail }),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock ResizeObserver for Radix UI
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock pointer events for Radix UI
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};

describe('UserNav', () => {
  const mockUser = {
    email: { address: 'test@example.com' },
    linkedAccounts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseActiveWallet.mockReturnValue({ address: null, connect: mockConnectWallet });
  });

  describe('Guest accounts (M2 W3b)', () => {
    const guestUser = { isGuest: true, linkedAccounts: [] };

    it('shows "Guest" instead of an email for a guest account', async () => {
      const user = userEvent.setup();
      render(<UserNav user={guestUser} />);

      await user.click(screen.getByRole('button'));

      expect(await screen.findByText('Guest')).toBeInTheDocument();
      expect(screen.queryByText('User')).not.toBeInTheDocument();
    });

    it('shows the upgrade CTA for a guest account, and it calls linkEmail', async () => {
      const user = userEvent.setup();
      render(<UserNav user={guestUser} />);

      await user.click(screen.getByRole('button'));
      const upgradeButton = await screen.findByRole('menuitem', { name: /sign in to save your account/i });
      await user.click(upgradeButton);

      expect(mockLinkEmail).toHaveBeenCalledTimes(1);
    });

    it('does not show the upgrade CTA for a non-guest account', async () => {
      const user = userEvent.setup();
      render(<UserNav user={mockUser} />);

      await user.click(screen.getByRole('button'));
      await screen.findByRole('menu');

      expect(screen.queryByRole('menuitem', { name: /sign in to save your account/i })).not.toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Wallet Display', () => {
    it('should show a "Connect wallet" item when no wallet is active', async () => {
      const user = userEvent.setup();
      render(<UserNav user={mockUser} />);

      await user.click(screen.getByRole('button'));

      expect(await screen.findByRole('menuitem', { name: /connect wallet/i })).toBeInTheDocument();
    });

    it('should call connect() when "Connect wallet" is clicked', async () => {
      const user = userEvent.setup();
      mockConnectWallet.mockResolvedValue(undefined);
      render(<UserNav user={mockUser} />);

      await user.click(screen.getByRole('button'));
      const connectItem = await screen.findByRole('menuitem', { name: /connect wallet/i });
      await user.click(connectItem);

      await waitFor(() => {
        expect(mockConnectWallet).toHaveBeenCalledTimes(1);
      });
    });

    it('should show a truncated wallet address when a wallet is active', async () => {
      mockUseActiveWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        connect: mockConnectWallet,
      });
      const user = userEvent.setup();
      render(<UserNav user={mockUser} />);

      await user.click(screen.getByRole('button'));

      expect(await screen.findByText(/0x1234\.\.\.5678/)).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /connect wallet/i })).not.toBeInTheDocument();
    });
  });

  describe('Sign Out Functionality', () => {
    it('should call logout from useGatewayzAuth when sign out is clicked', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      render(<UserNav user={mockUser} />);

      // Open the dropdown menu
      const avatarButton = screen.getByRole('button');
      await user.click(avatarButton);

      // Wait for menu to appear and find sign out button
      const signOutButton = await screen.findByRole('menuitem', { name: /sign out/i });
      await user.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success toast after successful sign out', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      render(<UserNav user={mockUser} />);

      // Open the dropdown menu
      const avatarButton = screen.getByRole('button');
      await user.click(avatarButton);

      // Wait for menu to appear and find sign out button
      const signOutButton = await screen.findByRole('menuitem', { name: /sign out/i });
      await user.click(signOutButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: 'Signed out successfully' });
      });
    });

    it('should show error toast when sign out fails', async () => {
      const user = userEvent.setup();
      // Raw error message must never reach the user - the toast should show
      // the safe, classified message from getUserMessage() instead.
      const errorMessage = 'Logout failed';
      mockLogout.mockRejectedValue(new Error(errorMessage));

      render(<UserNav user={mockUser} />);

      // Open the dropdown menu
      const avatarButton = screen.getByRole('button');
      await user.click(avatarButton);

      // Wait for menu to appear and find sign out button
      const signOutButton = await screen.findByRole('menuitem', { name: /sign out/i });
      await user.click(signOutButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error signing out',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      });

      // Ensure the raw error text was not leaked to the user
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ description: errorMessage })
      );
    });
  });

  describe('User Display', () => {
    it('should display user email initial', () => {
      render(<UserNav user={mockUser} />);

      // The initial 'T' from test@example.com
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should display Google email initial when no email but has Google', () => {
      const googleUser = {
        google: { email: 'google@example.com' },
        linkedAccounts: [],
      };

      render(<UserNav user={googleUser} />);

      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should display GitHub username initial', () => {
      const githubUser = {
        github: { username: 'octocat' },
        linkedAccounts: [],
      };

      render(<UserNav user={githubUser} />);

      expect(screen.getByText('O')).toBeInTheDocument();
    });

    it('should display "U" as fallback when no identifiable info', () => {
      const emptyUser = {
        linkedAccounts: [],
      };

      render(<UserNav user={emptyUser} />);

      expect(screen.getByText('U')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('should have correct navigation links in dropdown', async () => {
      const user = userEvent.setup();
      render(<UserNav user={mockUser} />);

      // Open the dropdown menu
      const avatarButton = screen.getByRole('button');
      await user.click(avatarButton);

      // Verify navigation links
      expect(await screen.findByRole('menuitem', { name: /account/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /credits/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /api keys/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /presets/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /provisioning keys/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /integrations/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /privacy/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^settings$/i })).toBeInTheDocument();
    });
  });

  describe('Tier Badge Display', () => {
    it('should not show tier badge for basic tier', async () => {
      const user = userEvent.setup();
      render(<UserNav user={mockUser} />);

      // Open the dropdown menu
      const avatarButton = screen.getByRole('button');
      await user.click(avatarButton);

      // Wait for menu to appear
      await screen.findByRole('menu');

      // Basic tier should not have a badge
      expect(screen.queryByText('BASIC')).not.toBeInTheDocument();
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
      expect(screen.queryByText('MAX')).not.toBeInTheDocument();
    });
  });
});

// Note: Tests for tier correction logic (basic tier + active subscription -> pro/max)
// are covered in src/lib/__tests__/tier-utils.test.ts which tests:
// - getUserTier() returns 'pro' when tier='basic' but subscription_status='active'
// - getUserTier() uses tier_display_name to infer correct tier (pro or max)
// - useTier hook provides tierDisplayName that matches the corrected tier
