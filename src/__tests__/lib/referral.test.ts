/**
 * Tests for referral.ts - Storage and initialization
 *
 * Tests the referral code tracking system's storage functionality.
 * Note: URL parameter removal code is tested through integration tests
 * as unit testing window.location manipulation in jsdom is unreliable.
 */

import {
  getStoredReferralCode,
  storeReferralCode,
  clearReferralCode,
  getReferralSource,
} from '@/lib/referral';
import * as safeStorage from '@/lib/safe-storage';

// Mock the safe-storage module
jest.mock('@/lib/safe-storage');

describe('referral.ts - Storage functionality', () => {
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Reset mock storage
    mockLocalStorage = {};

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeReferralCode and getStoredReferralCode', () => {
    it('should store and retrieve referral code', () => {
      storeReferralCode('STORED123', 'url');
      expect(getStoredReferralCode()).toBe('STORED123');
    });

    it('should store referral source', () => {
      storeReferralCode('CODE123', 'manual');
      expect(getReferralSource()).toBe('manual');
    });

    it('should default source to "url"', () => {
      storeReferralCode('DEFAULT123');
      expect(getReferralSource()).toBe('url');
    });

    it('should return null when no code is stored', () => {
      expect(getStoredReferralCode()).toBeNull();
      expect(getReferralSource()).toBeNull();
    });
  });

  describe('clearReferralCode', () => {
    it('should clear referral code and source', () => {
      storeReferralCode('CLEAR123', 'url');
      expect(getStoredReferralCode()).toBe('CLEAR123');
      expect(getReferralSource()).toBe('url');

      clearReferralCode();
      expect(getStoredReferralCode()).toBeNull();
      expect(getReferralSource()).toBeNull();
    });

    it('should handle clearing when nothing is stored', () => {
      expect(() => clearReferralCode()).not.toThrow();
      expect(getStoredReferralCode()).toBeNull();
    });
  });

  describe('storage persistence', () => {
    it('should persist across multiple operations', () => {
      storeReferralCode('PERSIST123', 'url');
      expect(getStoredReferralCode()).toBe('PERSIST123');

      // Simulate another operation
      storeReferralCode('PERSIST456', 'manual');
      expect(getStoredReferralCode()).toBe('PERSIST456');
      expect(getReferralSource()).toBe('manual');
    });

    it('should overwrite existing code', () => {
      storeReferralCode('OLD123', 'url');
      storeReferralCode('NEW456', 'manual');

      expect(getStoredReferralCode()).toBe('NEW456');
      expect(getReferralSource()).toBe('manual');
    });
  });
});
