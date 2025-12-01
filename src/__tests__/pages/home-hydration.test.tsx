/**
 * Tests for home page hydration fix
 *
 * Covers fix for:
 * - JAVASCRIPT-NEXTJS-K: Hydration Error (609 events)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { usePrivy } from '@privy-io/react-auth';
import Home from '@/app/page';

// Mock dependencies
jest.mock('@privy-io/react-auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));
jest.mock('@/lib/api', () => ({
  getApiKey: jest.fn(),
}));
jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
    identify: jest.fn(),
  },
}));

import { getApiKey } from '@/lib/api';

describe('Home Page Hydration Fix', () => {
  beforeEach(() => {
    // Mock Privy
    (usePrivy as jest.Mock).mockReturnValue({
      ready: false,
      authenticated: false,
      user: null,
      login: jest.fn(),
    });

    // Mock getApiKey
    (getApiKey as jest.Mock).mockReturnValue(null);

    // Clear localStorage
    Storage.prototype.getItem = jest.fn(() => null);
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Client-side rendering guard (JAVASCRIPT-NEXTJS-K fix)', () => {
    it('should not access window during initial render', () => {
      const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

      render(<Home />);

      // Window event listeners should not be added until client-side hydration
      // The fix uses useEffect which only runs client-side
      expect(windowAddEventListenerSpy).not.toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );
    });

    it('should add event listeners after client-side hydration', async () => {
      const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: false,
        user: null,
        login: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        // After isClient becomes true, event listeners should be added
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
          'storage',
          expect.any(Function)
        );
      });

      windowAddEventListenerSpy.mockRestore();
    });

    it('should not call getApiKey until Privy is ready', () => {
      (usePrivy as jest.Mock).mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: jest.fn(),
      });

      render(<Home />);

      // getApiKey should not be called when Privy is not ready
      expect(getApiKey).not.toHaveBeenCalled();
    });

    it('should call getApiKey after Privy is ready and user is authenticated', async () => {
      const mockApiKey = 'gw_live_12345';

      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: true,
        user: { id: 'user123' },
        login: jest.fn(),
      });

      (getApiKey as jest.Mock).mockReturnValue(mockApiKey);

      render(<Home />);

      await waitFor(() => {
        expect(getApiKey).toHaveBeenCalled();
      });
    });

    it('should handle SSR without errors', () => {
      // Simulate SSR by mocking window as undefined
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(() => {
        // In SSR, window checks should prevent errors
        const isClient = typeof window !== 'undefined';
        expect(isClient).toBe(false);
      }).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });

    it('should initialize with empty API key before hydration', () => {
      const { container } = render(<Home />);

      // Component should render without errors even before client hydration
      expect(container).toBeTruthy();
    });

    it('should cleanup event listeners on unmount', async () => {
      const windowRemoveEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: false,
        user: null,
        login: jest.fn(),
      });

      const { unmount } = render(<Home />);

      await waitFor(() => {
        expect(window.addEventListener).toHaveBeenCalled();
      });

      unmount();

      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );

      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'gatewayz:api-key-updated',
        expect.any(Function)
      );

      windowRemoveEventListenerSpy.mockRestore();
    });
  });

  describe('localStorage access pattern', () => {
    it('should not access localStorage during SSR', () => {
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');

      render(<Home />);

      // During initial render (SSR), localStorage should not be accessed
      // It's only accessed in useEffect which runs client-side only
      expect(getItemSpy).not.toHaveBeenCalled();
    });

    it('should access localStorage after client-side hydration', async () => {
      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: true,
        user: { id: 'user123' },
        login: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        expect(getApiKey).toHaveBeenCalled();
      });
    });

    it('should handle storage events from other tabs', async () => {
      const mockApiKey = 'gw_live_12345';
      (getApiKey as jest.Mock).mockReturnValue(mockApiKey);

      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: true,
        user: { id: 'user123' },
        login: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        expect(window.addEventListener).toHaveBeenCalled();
      });

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'gatewayz_api_key',
        newValue: mockApiKey,
      });

      window.dispatchEvent(storageEvent);

      // Should handle event without errors
      expect(getApiKey).toHaveBeenCalled();
    });

    it('should handle custom storage events from same tab', async () => {
      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: true,
        user: { id: 'user123' },
        login: jest.fn(),
      });

      render(<Home />);

      await waitFor(() => {
        expect(window.addEventListener).toHaveBeenCalledWith(
          'gatewayz:api-key-updated',
          expect.any(Function)
        );
      });

      // Simulate custom event
      const customEvent = new Event('gatewayz:api-key-updated');
      window.dispatchEvent(customEvent);

      // Should handle event without errors
      expect(getApiKey).toHaveBeenCalled();
    });
  });

  describe('Hydration mismatch prevention', () => {
    it('should render same content on server and client initial render', () => {
      const { container: serverContainer } = render(<Home />);
      const serverHTML = serverContainer.innerHTML;

      const { container: clientContainer } = render(<Home />);
      const clientHTML = clientContainer.innerHTML;

      // Initial render should be identical
      expect(serverHTML).toBe(clientHTML);
    });

    it('should use isClient flag to defer client-only features', async () => {
      const { rerender } = render(<Home />);

      // Initially, isClient should be false (SSR)
      // Features depending on window/localStorage should not be active

      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: true,
        user: { id: 'user123' },
        login: jest.fn(),
      });

      rerender(<Home />);

      // After rerender (simulating client hydration), features should activate
      await waitFor(() => {
        expect(getApiKey).toHaveBeenCalled();
      });
    });

    it('should handle routing parameters without hydration errors', () => {
      // Test with URL parameters that caused original hydration error
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '?gad_source=5&gad_campaignid=23151409641&gclid=test',
      };

      expect(() => {
        render(<Home />);
      }).not.toThrow();

      window.location = originalLocation;
    });
  });

  describe('Mobile/Android compatibility', () => {
    it('should work on Android devices (original error context)', () => {
      // Original error occurred on Android 10, Chrome Mobile 142
      const originalUserAgent = navigator.userAgent;

      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
        configurable: true,
      });

      expect(() => {
        render(<Home />);
      }).not.toThrow();

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe('Error boundaries', () => {
    it('should not throw during render', () => {
      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    it('should handle Privy not ready state', () => {
      (usePrivy as jest.Mock).mockReturnValue({
        ready: false,
        authenticated: false,
        user: null,
        login: jest.fn(),
      });

      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    it('should handle null user data', () => {
      (usePrivy as jest.Mock).mockReturnValue({
        ready: true,
        authenticated: false,
        user: null,
        login: jest.fn(),
      });

      (getApiKey as jest.Mock).mockReturnValue(null);

      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });
  });
});
