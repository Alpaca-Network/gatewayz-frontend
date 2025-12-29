/**
 * @jest-environment jsdom
 */

import {
  getStoredReferralCode,
  storeReferralCode,
  clearReferralCode,
  getReferralSource,
} from '../referral';

// Mock safe-storage module
jest.mock('../safe-storage', () => {
  const storage = new Map<string, string>();
  return {
    safeLocalStorageGet: jest.fn((key: string) => storage.get(key) ?? null),
    safeLocalStorageSet: jest.fn((key: string, value: string) => {
      storage.set(key, value);
      return true;
    }),
    safeLocalStorageRemove: jest.fn((key: string) => {
      storage.delete(key);
    }),
    __storage: storage, // Expose for test manipulation
    __clear: () => storage.clear(),
  };
});

// Get the mocked module
const mockSafeStorage = jest.requireMock('../safe-storage') as {
  safeLocalStorageGet: jest.Mock;
  safeLocalStorageSet: jest.Mock;
  safeLocalStorageRemove: jest.Mock;
  __storage: Map<string, string>;
  __clear: () => void;
};

describe('referral utilities', () => {
  beforeEach(() => {
    // Clear storage between tests
    mockSafeStorage.__clear();
    jest.clearAllMocks();
  });

  describe('storeReferralCode', () => {
    it('should store referral code with default source', () => {
      storeReferralCode('TEST123');

      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_code',
        'TEST123'
      );
      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_source',
        'url'
      );
    });

    it('should store referral code with custom source', () => {
      storeReferralCode('TEST456', 'signup');

      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_code',
        'TEST456'
      );
      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_source',
        'signup'
      );
    });

    it('should store referral code with manual source', () => {
      storeReferralCode('MANUAL789', 'manual');

      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_code',
        'MANUAL789'
      );
      expect(mockSafeStorage.safeLocalStorageSet).toHaveBeenCalledWith(
        'gatewayz_referral_source',
        'manual'
      );
    });
  });

  describe('getStoredReferralCode', () => {
    it('should return stored referral code', () => {
      mockSafeStorage.__storage.set('gatewayz_referral_code', 'STORED123');

      expect(getStoredReferralCode()).toBe('STORED123');
    });

    it('should return null when no code is stored', () => {
      expect(getStoredReferralCode()).toBeNull();
    });
  });

  describe('clearReferralCode', () => {
    it('should remove referral code and source from storage', () => {
      mockSafeStorage.__storage.set('gatewayz_referral_code', 'TO_CLEAR');
      mockSafeStorage.__storage.set('gatewayz_referral_source', 'url');

      clearReferralCode();

      expect(mockSafeStorage.safeLocalStorageRemove).toHaveBeenCalledWith('gatewayz_referral_code');
      expect(mockSafeStorage.safeLocalStorageRemove).toHaveBeenCalledWith('gatewayz_referral_source');
    });

    it('should not throw when storage is empty', () => {
      expect(() => clearReferralCode()).not.toThrow();
    });
  });

  describe('getReferralSource', () => {
    it('should return stored referral source', () => {
      mockSafeStorage.__storage.set('gatewayz_referral_source', 'signup');

      expect(getReferralSource()).toBe('signup');
    });

    it('should return null when no source is stored', () => {
      expect(getReferralSource()).toBeNull();
    });

    it('should return url source when stored', () => {
      mockSafeStorage.__storage.set('gatewayz_referral_source', 'url');

      expect(getReferralSource()).toBe('url');
    });
  });

  describe('storage integration', () => {
    it('should store and retrieve referral code correctly', () => {
      storeReferralCode('INTEGRATION_TEST', 'signup');

      expect(getStoredReferralCode()).toBe('INTEGRATION_TEST');
      expect(getReferralSource()).toBe('signup');
    });

    it('should clear stored referral code', () => {
      storeReferralCode('TO_BE_CLEARED', 'url');
      expect(getStoredReferralCode()).toBe('TO_BE_CLEARED');

      clearReferralCode();

      // After mock clear, the storage map should have the key removed
      // The real storage is mocked, so we check the mock was called
      expect(mockSafeStorage.safeLocalStorageRemove).toHaveBeenCalledWith('gatewayz_referral_code');
    });
  });
});
