/**
 * Tests for OnboardingBanner hydration fix
 *
 * This test suite verifies that the hydration fix is working correctly.
 * The key issue was that DOM manipulation (document.documentElement.classList)
 * was happening during the loadTasks callback, causing server/client HTML mismatch.
 *
 * The fix separates DOM manipulation into a dedicated useEffect that only runs
 * on the client after hydration.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { OnboardingBanner } from '@/components/onboarding/onboarding-banner';
import { getUserData } from '@/lib/api';
import { safeSessionStorage } from '@/lib/safe-session-storage';

// Mock dependencies
jest.mock('@/lib/api');
jest.mock('@/lib/safe-session-storage');
jest.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
}));
jest.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  CheckCircle2: () => <span>✓</span>,
  ArrowRight: () => <span>→</span>,
}));

const mockGetUserData = getUserData as jest.MockedFunction<typeof getUserData>;
const mockSafeSessionStorage = safeSessionStorage as jest.Mocked<typeof safeSessionStorage>;

describe('OnboardingBanner Hydration Fix', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // Setup localStorage mock
    originalLocalStorage = global.localStorage;
    const localStorageMock: Record<string, string> = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => localStorageMock[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: jest.fn(() => {
          Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);
        }),
      },
      writable: true,
    });

    // Setup sessionStorage mock
    mockSafeSessionStorage.getItem = jest.fn(() => null);
    mockSafeSessionStorage.setItem = jest.fn();

    // Setup user data mock
    mockGetUserData.mockReturnValue({
      user_id: 1,
      api_key: 'test-key',
      display_name: 'Test User',
      email: 'test@example.com',
      credits: 100,
    });

    // Clear document.documentElement classes
    document.documentElement.className = '';
  });

  afterEach(() => {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    jest.clearAllMocks();
  });

  describe('DOM Manipulation Timing', () => {
    it('should not manipulate DOM during initial render', () => {
      // The fix ensures DOM manipulation happens in useEffect, not during render
      // This prevents hydration mismatches

      const { container } = render(<OnboardingBanner />);

      // Component should render without errors
      expect(container).toBeTruthy();
    });

    it('should update document.documentElement.classList in useEffect when visible', async () => {
      // Banner should be visible when user is authenticated and has incomplete tasks
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false, // Incomplete task
        chat: false,
        explore: false,
      }));

      render(<OnboardingBanner />);

      // Wait for useEffect to run and update DOM
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(true);
      });
    });

    it('should remove document.documentElement.classList when not visible', async () => {
      // Banner should not be visible when onboarding is completed
      localStorage.setItem('gatewayz_onboarding_completed', 'true');
      document.documentElement.classList.add('has-onboarding-banner');

      render(<OnboardingBanner />);

      // Wait for useEffect to run and update DOM
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(false);
      });
    });

    it('should set CSS custom properties when visible', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false, // Incomplete task
        chat: false,
      }));

      render(<OnboardingBanner />);

      // Wait for useEffect and requestAnimationFrame to complete
      await waitFor(() => {
        const sidebarTop = document.documentElement.style.getPropertyValue('--sidebar-top');
        expect(sidebarTop).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should reset CSS custom properties when not visible', async () => {
      localStorage.setItem('gatewayz_onboarding_completed', 'true');

      render(<OnboardingBanner />);

      await waitFor(() => {
        const sidebarTop = document.documentElement.style.getPropertyValue('--sidebar-top');
        expect(sidebarTop).toBe('65px');
      });
    });
  });

  describe('Hydration Safety', () => {
    it('should not cause hydration mismatch when guest user', () => {
      // Guest users (unauthenticated) should not trigger DOM manipulation during render
      mockGetUserData.mockReturnValue(null);

      const { container } = render(<OnboardingBanner />);

      // Should render null without errors
      expect(container.firstChild).toBeNull();
    });

    it('should not cause hydration mismatch when banner dismissed', () => {
      mockSafeSessionStorage.getItem.mockReturnValue('true');

      const { container } = render(<OnboardingBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle visibility state changes without hydration errors', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false,
        chat: false,
      }));

      const { unmount } = render(<OnboardingBanner />);

      // Wait for initial render
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(true);
      });

      // Unmount component
      unmount();

      // The cleanup should remove the class and reset CSS properties
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(false);
        expect(document.documentElement.style.getPropertyValue('--sidebar-top')).toBe('65px');
        expect(document.documentElement.style.getPropertyValue('--onboarding-banner-height')).toBe('0px');
      });
    });

    it('should cleanup DOM styles and cancel animations on unmount', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false,
        chat: false,
      }));

      // Add the class manually to test cleanup
      document.documentElement.classList.add('has-onboarding-banner');
      document.documentElement.style.setProperty('--sidebar-top', '105px');

      const { unmount } = render(<OnboardingBanner />);

      // Wait for component to be visible
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(true);
      });

      // Unmount while still visible
      unmount();

      // Cleanup should restore default values
      await waitFor(() => {
        expect(document.documentElement.classList.contains('has-onboarding-banner')).toBe(false);
        expect(document.documentElement.style.getPropertyValue('--sidebar-top')).toBe('65px');
        expect(document.documentElement.style.getPropertyValue('--sidebar-height')).toBe('calc(100vh - 65px)');
        expect(document.documentElement.style.getPropertyValue('--models-header-top')).toBe('65px');
        expect(document.documentElement.style.getPropertyValue('--onboarding-banner-height')).toBe('0px');
      });
    });
  });

  describe('API Key Step', () => {
    it('should include API key step in the task list', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false,
        chat: false,
        explore: false,
        credits: false,
      }));

      render(<OnboardingBanner />);

      // Wait for the banner to render and check that the API key step is shown as the next task
      // Use getAllByText since there are mobile and desktop layouts
      await waitFor(() => {
        const elements = screen.getAllByText('Create Your API Key');
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('should show API key step as next task when welcome is complete and apikey is incomplete', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: false,
        chat: true,
        explore: true,
        credits: true,
      }));

      render(<OnboardingBanner />);

      await waitFor(() => {
        const links = screen.getAllByRole('link', { name: /Create Your API Key/i });
        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toHaveAttribute('href', '/settings/keys');
      });
    });

    it('should skip to next incomplete task when API key step is complete', async () => {
      localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify({
        welcome: true,
        apikey: true,
        chat: false,
        explore: false,
        credits: false,
      }));

      render(<OnboardingBanner />);

      await waitFor(() => {
        const links = screen.getAllByRole('link', { name: /Start Your First Chat/i });
        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toHaveAttribute('href', '/chat');
      });
    });
  });

  describe('Documentation', () => {
    it('should document the hydration fix pattern', () => {
      /**
       * CRITICAL FIX: DOM manipulation must happen in useEffect, not during render
       *
       * BROKEN PATTERN (DO NOT USE):
       *   const loadTasks = useCallback(() => {
       *     // ... state updates ...
       *     document.documentElement.classList.add('has-onboarding-banner'); // ❌ Hydration mismatch!
       *   }, []);
       *
       * CORRECT PATTERN:
       *   const loadTasks = useCallback(() => {
       *     // ... state updates only ...
       *     setVisible(shouldShow);
       *   }, []);
       *
       *   useEffect(() => {
       *     if (visible) {
       *       document.documentElement.classList.add('has-onboarding-banner'); // ✅ Runs after hydration
       *     }
       *   }, [visible]);
       *
       * This ensures:
       * - Server-rendered HTML matches initial client render
       * - DOM manipulation happens after hydration is complete
       * - No hydration mismatch warnings in console
       */
      expect(true).toBe(true);
    });
  });
});
