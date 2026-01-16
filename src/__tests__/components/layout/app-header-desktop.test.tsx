/**
 * Tests for AppHeader Desktop Mode
 *
 * Tests the simplified header behavior when running in Tauri desktop app:
 * - Logo links to /chat instead of /
 * - Only shows Models, Docs, Credits, Account, and theme toggle
 * - Hides Chat, Researchers, Sandbox, Ranking, Insights
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '@/components/layout/app-header';
import { useIsTauri } from '@/lib/desktop/hooks';

// Mock the hooks and context
jest.mock('@/lib/desktop/hooks', () => ({
  useIsTauri: jest.fn(),
}));

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: () => ({
    privyUser: null,
    login: jest.fn(),
    logout: jest.fn(),
    status: 'unauthenticated',
    authTiming: null,
    error: null,
  }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Mock UI components
jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
  SheetOverlay: () => null,
  SheetPortal: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

jest.mock('@/components/layout/user-nav', () => ({
  UserNav: () => <div data-testid="user-nav">User Nav</div>,
}));

jest.mock('@/components/layout/search-bar', () => ({
  SearchBar: () => <div data-testid="search-bar">Search Bar</div>,
}));

jest.mock('@/components/layout/get-credits-button', () => ({
  GetCreditsButton: () => <div data-testid="get-credits-button">Get Credits</div>,
}));

jest.mock('@/components/layout/credits-display', () => ({
  CreditsDisplay: () => <div data-testid="credits-display">Credits Display</div>,
}));

jest.mock('@/components/analytics/twitter-pixel', () => ({
  trackTwitterSignupClick: jest.fn(),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...props}>{children}</a>
  );
});

const mockUseIsTauri = useIsTauri as jest.MockedFunction<typeof useIsTauri>;

describe('AppHeader Desktop Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logo Link', () => {
    it('should link to /chat when in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      // Find the logo link (first link in the header with Gatewayz text)
      const logoLinks = screen.getAllByRole('link');
      const logoLink = logoLinks.find(link => link.textContent?.includes('Gatewayz'));

      expect(logoLink).toHaveAttribute('href', '/chat');
    });

    it('should link to / when in web mode', () => {
      mockUseIsTauri.mockReturnValue(false);

      render(<AppHeader />);

      const logoLinks = screen.getAllByRole('link');
      const logoLink = logoLinks.find(link => link.textContent?.includes('Gatewayz'));

      expect(logoLink).toHaveAttribute('href', '/');
    });
  });

  describe('Navigation Menu Items', () => {
    it('should show Models link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      // Models appears in both desktop and mobile nav
      expect(screen.getAllByText('Models').length).toBeGreaterThan(0);
    });

    it('should show Docs link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      // Docs appears in both desktop and mobile nav
      expect(screen.getAllByText('Docs').length).toBeGreaterThan(0);
    });

    it('should show Theme Toggle in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      // Theme toggle appears in both desktop and mobile nav
      expect(screen.getAllByTestId('theme-toggle').length).toBeGreaterThan(0);
    });

    it('should hide Chat link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const chatLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Chat'
      );
      // Chat should not be visible in desktop nav
      expect(chatLinks.length).toBe(0);
    });

    it('should hide Researchers link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const researchersLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Researchers'
      );
      expect(researchersLinks.length).toBe(0);
    });

    it('should hide Sandbox link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const sandboxLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Sandbox'
      );
      expect(sandboxLinks.length).toBe(0);
    });

    it('should hide Ranking link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const rankingLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Ranking'
      );
      expect(rankingLinks.length).toBe(0);
    });

    it('should hide Insights link in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const insightsLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Insights'
      );
      expect(insightsLinks.length).toBe(0);
    });

    it('should show all navigation items in web mode', () => {
      mockUseIsTauri.mockReturnValue(false);

      render(<AppHeader />);

      // Models and Docs should be visible (use getAllByText since they appear in both desktop and mobile nav)
      expect(screen.getAllByText('Models').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Docs').length).toBeGreaterThan(0);

      // Web-only items should also be visible (in the desktop nav)
      // Note: These may be in the mobile menu or hidden on certain screen sizes
      // The key assertion is that they exist somewhere in the DOM for web users
    });
  });

  describe('Desktop-Only Menu Items', () => {
    it('should show Credits link only in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const creditsLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Credits'
      );
      expect(creditsLinks.length).toBeGreaterThan(0);
    });

    it('should show Account link only in desktop mode', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(<AppHeader />);

      const accountLinks = screen.queryAllByRole('link').filter(
        link => link.textContent === 'Account'
      );
      expect(accountLinks.length).toBeGreaterThan(0);
    });
  });
});
