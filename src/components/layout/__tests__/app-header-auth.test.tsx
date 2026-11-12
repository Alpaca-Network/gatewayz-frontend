/**
 * The header must agree with the rest of the app about whether the user is signed in.
 * The Gatewayz session deliberately outlives the Privy session, so a cached session with
 * an expired Privy login is still "authenticated" — the header used to show "Sign In"
 * there while chat and credits worked.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockAuth: Record<string, unknown> = {};
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: () => mockAuth,
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/chat' }));
jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>);
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/components/analytics/twitter-pixel', () => ({ trackTwitterSignupClick: jest.fn() }));
jest.mock('@/lib/desktop/hooks', () => ({ useIsTauri: () => false }));
jest.mock('@/lib/gpu/flag', () => ({ isGpuMarketplaceEnabled: () => false }));
jest.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));
jest.mock('../search-bar', () => ({ SearchBar: () => null }));
jest.mock('../get-credits-button', () => ({ GetCreditsButton: () => null }));
jest.mock('../credits-display', () => ({ CreditsDisplay: () => <span data-testid="credits" /> }));
jest.mock('../user-nav', () => ({
  UserNav: ({ user }: any) => <span data-testid="user-nav">{user?.email?.address}</span>,
}));

import { AppHeader } from '../app-header';

const base = {
  login: jest.fn(),
  logout: jest.fn(),
  authTiming: null,
  error: null,
};

describe('AppHeader sign-in state', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockAuth)) delete mockAuth[k];
  });

  it('shows the account (not "Sign In") for a cached session whose Privy login expired', () => {
    Object.assign(mockAuth, base, {
      privyUser: null,
      status: 'authenticated',
      userData: { user_id: 10, email: 'user@example.com', credits: 14 },
    });

    render(<AppHeader />);

    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
    expect(screen.getAllByTestId('user-nav')[0]).toHaveTextContent('user@example.com');
  });

  it('shows "Sign In" when there is no session at all', () => {
    Object.assign(mockAuth, base, { privyUser: null, status: 'unauthenticated', userData: null });

    render(<AppHeader />);

    expect(screen.getAllByRole('button', { name: 'Sign In' }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('user-nav')).toBeNull();
  });

  it('uses the Privy user when present', () => {
    Object.assign(mockAuth, base, {
      privyUser: { email: { address: 'privy@example.com' }, linkedAccounts: [] },
      status: 'authenticated',
      userData: { user_id: 10, email: 'user@example.com', credits: 14 },
    });

    render(<AppHeader />);

    expect(screen.getAllByTestId('user-nav')[0]).toHaveTextContent('privy@example.com');
  });
});
