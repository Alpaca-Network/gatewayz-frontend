/**
 * Tests for referral.ts - URL parameter removal functionality
 *
 * These tests specifically cover the new URL parameter removal code added in PR #625
 * to address code coverage requirements for the 7 new lines that:
 * 1. Remove ref/referral parameters from URL after storing
 * 2. Preserve Next.js history state (not overwrite with empty object)
 * 3. Handle errors gracefully
 */

import { initializeReferralTracking } from '@/lib/referral';
import * as safeStorage from '@/lib/safe-storage';

// Mock the safe-storage module
jest.mock('@/lib/safe-storage');

describe('referral.ts - URL parameter removal (PR #625)', () => {
  let mockLocalStorage: Record<string, string> = {};
  let mockSessionStorage: Record<string, string> = {};
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mock storage
    mockLocalStorage = {};
    mockSessionStorage = {};

    // Mock safe storage functions
    jest.spyOn(safeStorage, 'safeLocalStorageGet').mockImplementation((key: string) => {
      return mockLocalStorage[key] ?? null;
    });
    jest.spyOn(safeStorage, 'safeLocalStorageSet').mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
    });
    jest.spyOn(safeStorage, 'safeLocalStorageRemove').mockImplementation((key: string) => {
      delete mockLocalStorage[key];
    });

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock sessionStorage
    delete (window as any).sessionStorage;
    (window as any).sessionStorage = {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        mockSessionStorage = {};
      },
    };
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    jest.restoreAllMocks();
  });

  describe('initializeReferralTracking - URL parameter removal', () => {
    it('should remove ref parameter from URL after storing referral code', () => {
      const replaceStateSpy = jest.fn();

      // Mock window.location with a ref parameter
      delete (window as any).location;
      (window as any).location = {
        search: '?ref=TEST123&other=param',
        href: 'http://localhost?ref=TEST123&other=param',
      };

      // Mock window.history with state
      delete (window as any).history;
      (window as any).history = {
        state: { test: 'state' },
        replaceState: replaceStateSpy,
      };

      initializeReferralTracking();

      // Verify ref parameter was removed from URL
      expect(replaceStateSpy).toHaveBeenCalledTimes(1);
      const calledUrl = replaceStateSpy.mock.calls[0][2];
      expect(calledUrl).not.toContain('ref=');
      expect(calledUrl).toContain('other=param');
    });

    it('should preserve Next.js history state when removing URL parameters', () => {
      const mockHistoryState = { __NEXT_DATA__: { page: '/test' }, key: 'test-key' };
      const replaceStateSpy = jest.fn();

      delete (window as any).location;
      (window as any).location = {
        search: '?ref=PRESERVE123',
        href: 'http://localhost?ref=PRESERVE123',
      };

      delete (window as any).history;
      (window as any).history = {
        state: mockHistoryState,
        replaceState: replaceStateSpy,
      };

      initializeReferralTracking();

      // Verify history state was preserved (not replaced with empty object)
      expect(replaceStateSpy).toHaveBeenCalledWith(
        mockHistoryState, // Should preserve this, NOT pass {}
        '',
        expect.any(String)
      );
    });

    it('should remove both ref and referral parameters from URL', () => {
      const replaceStateSpy = jest.fn();

      delete (window as any).location;
      (window as any).location = {
        search: '?ref=REF123&referral=REFERRAL456',
        href: 'http://localhost?ref=REF123&referral=REFERRAL456',
      };

      delete (window as any).history;
      (window as any).history = {
        state: null,
        replaceState: replaceStateSpy,
      };

      initializeReferralTracking();

      const calledUrl = replaceStateSpy.mock.calls[0][2];
      expect(calledUrl).not.toContain('ref=');
      expect(calledUrl).not.toContain('referral=');
    });

    it('should log success message after removing ref parameter', () => {
      const replaceStateSpy = jest.fn();

      delete (window as any).location;
      (window as any).location = {
        search: '?ref=LOG123',
        href: 'http://localhost?ref=LOG123',
      };

      delete (window as any).history;
      (window as any).history = {
        state: null,
        replaceState: replaceStateSpy,
      };

      initializeReferralTracking();

      expect(consoleLogSpy).toHaveBeenCalledWith('[Referral] Removed ref parameter from URL');
    });

    it('should handle URL manipulation errors gracefully', () => {
      delete (window as any).location;
      (window as any).location = {
        search: '?ref=ERROR123',
        href: 'http://localhost?ref=ERROR123',
      };

      delete (window as any).history;
      (window as any).history = {
        replaceState: jest.fn(() => {
          throw new Error('replaceState failed');
        }),
      };

      // Should not throw
      expect(() => initializeReferralTracking()).not.toThrow();

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Referral] Failed to remove ref parameter from URL:',
        expect.any(Error)
      );
    });

    it('should only attempt URL removal when ref parameter is present', () => {
      const replaceStateSpy = jest.fn();

      delete (window as any).location;
      (window as any).location = {
        search: '', // No ref parameter
        href: 'http://localhost',
      };

      delete (window as any).history;
      (window as any).history = {
        state: null,
        replaceState: replaceStateSpy,
      };

      initializeReferralTracking();

      // Should NOT call replaceState when there's no ref parameter
      expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('should handle new URL() constructor errors', () => {
      // Mock location with invalid href to trigger URL constructor error
      delete (window as any).location;
      (window as any).location = {
        search: '?ref=BADURL123',
        href: 'not a valid url',
      };

      delete (window as any).history;
      (window as any).history = {
        replaceState: jest.fn(),
      };

      // Should not throw
      expect(() => initializeReferralTracking()).not.toThrow();

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Referral] Failed to remove ref parameter from URL:',
        expect.any(Error)
      );
    });
  });
});
