/**
 * Tests for safe-storage utility
 * Provides safe storage access with fallbacks
 */

import * as Sentry from '@sentry/nextjs';
import {
  canUseLocalStorage,
  canUseSessionStorage,
  waitForLocalStorageAccess,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  getStorageType,
  isRestrictedStorageEnvironment,
  hasWindow,
} from '../safe-storage';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
}));

describe('safe-storage', () => {
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock storage
    mockLocalStorage = {
      getItem: jest.fn((key: string) => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    mockSessionStorage = {
      getItem: jest.fn((key: string) => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    // Set up window.localStorage and window.sessionStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('hasWindow', () => {
    it('should return true in browser environment', () => {
      expect(hasWindow()).toBe(true);
    });
  });

  describe('canUseLocalStorage', () => {
    it('should return true when localStorage is available', () => {
      expect(canUseLocalStorage()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });

    it('should cache positive result for 60 seconds', () => {
      // First call
      expect(canUseLocalStorage()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);

      // Second call within cache window
      expect(canUseLocalStorage()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should return false when localStorage throws error', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(canUseLocalStorage()).toBe(false);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'localStorage unavailable - using fallback',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });

    it('should log to Sentry only once when localStorage fails', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      canUseLocalStorage();
      canUseLocalStorage();

      // Should only capture once
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('canUseSessionStorage', () => {
    it('should return true when sessionStorage is available', () => {
      expect(canUseSessionStorage()).toBe(true);
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it('should cache positive result for 60 seconds', () => {
      expect(canUseSessionStorage()).toBe(true);
      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(1);

      expect(canUseSessionStorage()).toBe(true);
      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should return false when sessionStorage throws error', () => {
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(canUseSessionStorage()).toBe(false);
    });
  });

  describe('waitForLocalStorageAccess', () => {
    it('should return true immediately if localStorage is available', async () => {
      const result = await waitForLocalStorageAccess();
      expect(result).toBe(true);
    });

    it('should retry and eventually return true if localStorage becomes available', async () => {
      let callCount = 0;
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Not ready yet');
        }
      });

      const result = await waitForLocalStorageAccess({
        attempts: 4,
        baseDelayMs: 10,
      });

      expect(result).toBe(true);
    });

    it('should fallback to sessionStorage if localStorage never becomes available', async () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const result = await waitForLocalStorageAccess({
        attempts: 2,
        baseDelayMs: 10,
      });

      expect(result).toBe(true); // sessionStorage is available
    });

    it('should return false if no storage is available', async () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage unavailable');
      });

      const result = await waitForLocalStorageAccess({
        attempts: 2,
        baseDelayMs: 10,
      });

      expect(result).toBe(false);
    });
  });

  describe('safeLocalStorageGet', () => {
    it('should get value from localStorage', () => {
      (mockLocalStorage.getItem as jest.Mock).mockReturnValue('test-value');

      const result = safeLocalStorageGet('test-key');

      expect(result).toBe('test-value');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    it('should fallback to sessionStorage if localStorage fails', () => {
      (mockLocalStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      (mockSessionStorage.getItem as jest.Mock).mockReturnValue('session-value');

      const result = safeLocalStorageGet('test-key');

      expect(result).toBe('session-value');
    });

    it('should return null if no storage is available', () => {
      (mockLocalStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      (mockSessionStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage error');
      });

      const result = safeLocalStorageGet('test-key');

      expect(result).toBeNull();
    });

    it('should fallback to memory storage', () => {
      // First, disable both storages
      (mockLocalStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      (mockSessionStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage unavailable');
      });

      // Set value in memory
      safeLocalStorageSet('memory-key', 'memory-value');

      // Get should return from memory
      const result = safeLocalStorageGet('memory-key');
      expect(result).toBe('memory-value');
    });
  });

  describe('safeLocalStorageSet', () => {
    it('should set value in localStorage', () => {
      const result = safeLocalStorageSet('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
    });

    it('should fallback to sessionStorage if localStorage fails', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = safeLocalStorageSet('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      );
    });

    it('should fallback to memory storage if both fail', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage error');
      });

      const result = safeLocalStorageSet('test-key', 'test-value');

      expect(result).toBe(true);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Using in-memory storage fallback',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });

    it('should log memory fallback warning only once', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      safeLocalStorageSet('key1', 'value1');
      safeLocalStorageSet('key2', 'value2');

      // Should only log once
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('safeLocalStorageRemove', () => {
    it('should remove value from localStorage', () => {
      safeLocalStorageRemove('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle errors gracefully', () => {
      (mockLocalStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('Remove error');
      });

      expect(() => safeLocalStorageRemove('test-key')).not.toThrow();
    });

    it('should remove from memory storage as well', () => {
      // Disable storages
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      // Set in memory
      safeLocalStorageSet('memory-key', 'value');

      // Verify it's there
      expect(safeLocalStorageGet('memory-key')).toBe('value');

      // Remove
      safeLocalStorageRemove('memory-key');

      // Should be gone
      expect(safeLocalStorageGet('memory-key')).toBeNull();
    });
  });

  describe('getStorageType', () => {
    it('should return "localStorage" when available', () => {
      expect(getStorageType()).toBe('localStorage');
    });

    it('should return "sessionStorage" when only sessionStorage available', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(getStorageType()).toBe('sessionStorage');
    });

    it('should return "memory" when both storages fail', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage unavailable');
      });

      expect(getStorageType()).toBe('memory');
    });
  });

  describe('isRestrictedStorageEnvironment', () => {
    it('should return false when localStorage is available', () => {
      expect(isRestrictedStorageEnvironment()).toBe(false);
    });

    it('should return false when sessionStorage is available', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(isRestrictedStorageEnvironment()).toBe(false);
    });

    it('should return true when both storages are unavailable', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      (mockSessionStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('sessionStorage unavailable');
      });

      expect(isRestrictedStorageEnvironment()).toBe(true);
    });
  });
});
