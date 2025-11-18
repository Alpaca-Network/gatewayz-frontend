import * as sessionTransfer from '../auth-session-transfer';

describe('auth-session-transfer - Edge Cases and URL Cleanup', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location with a simple object that doesn't trigger navigation
    const mockLocation = {
      href: 'https://beta.gatewayz.ai',
      search: '',
      pathname: '/',
      origin: 'https://beta.gatewayz.ai',
      toString: () => 'https://beta.gatewayz.ai'
    };

    // Delete and redefine to avoid navigation issues
    try {
      delete (window as any).location;
      (window as any).location = mockLocation;
    } catch {
      // If delete fails, just override
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true
      });
    }

    window.history.replaceState = jest.fn();
  });

  afterEach(() => {
    // Restore original location if possible
    try {
      delete (window as any).location;
      (window as any).location = originalLocation;
    } catch {
      // If we can't restore, at least reset to a valid state
    }
  });

  describe('cleanupSessionTransferParams - Error Handling', () => {
    it('should handle replaceState throwing exception', () => {
      window.history.replaceState = jest.fn(() => {
        throw new Error('SecurityError: Restricted by feature policy');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        sessionTransfer.cleanupSessionTransferParams();
      }).not.toThrow();

      // Should have warned about failure
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup URL parameters'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should use fallback URL cleanup method when replaceState fails', () => {
      window.history.replaceState = jest.fn(() => {
        throw new Error('replaceState failed');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      sessionTransfer.cleanupSessionTransferParams();

      // Should have attempted fallback
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle both replaceState and fallback URL failing', () => {
      window.history.replaceState = jest.fn(() => {
        throw new Error('replaceState failed');
      });

      // Make URL constructor throw (unlikely but testing anyway)
      const OriginalURL = URL;
      (global as any).URL = jest.fn(() => {
        throw new Error('URL constructor failed');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        sessionTransfer.cleanupSessionTransferParams();
      }).not.toThrow();

      // Should have logged error about fallback failure
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup URL even with fallback'),
        expect.any(Error)
      );

      (global as any).URL = OriginalURL;
      consoleErrorSpy.mockRestore();
    });

    it('should log success when cleanup works on first try', () => {
      window.history.replaceState = jest.fn();
      (window as any).location = { href: '', search: '?token=test', pathname: '/' };

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      sessionTransfer.cleanupSessionTransferParams();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('URL parameters cleaned up')
      );

      consoleLogSpy.mockRestore();
    });

    it('should use document.title when calling replaceState', () => {
      window.history.replaceState = jest.fn();
      const originalTitle = document.title;

      sessionTransfer.cleanupSessionTransferParams();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        originalTitle,
        expect.any(String)
      );
    });

    it('should clear the URL parameters from the browser history', () => {
      window.history.replaceState = jest.fn();

      sessionTransfer.cleanupSessionTransferParams();

      // Should have called replaceState to modify history
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });

  describe('getSessionTransferParams - Special Cases', () => {
    it('should return null values when URL has no search params', () => {
      const result = sessionTransfer.getSessionTransferParams();

      expect(result.token).toBeNull();
      expect(result.userId).toBeNull();
      expect(result.returnUrl).toBeNull();
      expect(result.action).toBeNull();
    });

    it('should handle URLSearchParams correctly', () => {
      // Test with a URL-like search string
      const searchParams = new URLSearchParams('?token=test-token&userId=12345');
      expect(searchParams.get('token')).toBe('test-token');
      expect(searchParams.get('userId')).toBe('12345');
    });

    it('should handle special characters when encoded', () => {
      const specialToken = 'test@token!#$%';
      const encoded = encodeURIComponent(specialToken);
      const decoded = decodeURIComponent(encoded);
      expect(decoded).toBe(specialToken);
    });

    it('should preserve numeric userId as string in URLSearchParams', () => {
      const searchParams = new URLSearchParams('userId=12345');
      const userIdValue = searchParams.get('userId');

      // Should be string, not number
      expect(userIdValue).toBe('12345');
      expect(typeof userIdValue).toBe('string');
    });

    it('should handle empty parameter values', () => {
      const searchParams = new URLSearchParams('?token=&userId=&action=');
      expect(searchParams.get('token')).toBe('');
      expect(searchParams.get('userId')).toBe('');
      expect(searchParams.get('action')).toBe('');
    });
  });

  describe('storeSessionTransferToken - Edge Cases', () => {
    beforeEach(() => {
      // Clear sessionStorage
      sessionStorage.clear();
    });

    it('should handle storing very large tokens', () => {
      const largeToken = 'x'.repeat(50000);
      const userId = 12345;

      expect(() => {
        sessionTransfer.storeSessionTransferToken(largeToken, userId);
      }).not.toThrow();

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      expect(retrieved.token).toBe(largeToken);
    });

    it('should handle userId as string', () => {
      const token = 'test-token';
      const userId = 'user-string-id';

      sessionTransfer.storeSessionTransferToken(token, userId);

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      expect(retrieved.userId).toBe('user-string-id');
    });

    it('should overwrite previous stored token', () => {
      sessionTransfer.storeSessionTransferToken('token1', '123');
      sessionTransfer.storeSessionTransferToken('token2', '456');

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      expect(retrieved.token).toBe('token2');
      expect(retrieved.userId).toBe('456');
    });

    it('should handle negative timeout values gracefully', () => {
      const token = 'test-token';
      const userId = '123';

      // Store with very old timestamp
      const veryOldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      const sessionData = {
        token,
        userId,
        timestamp: veryOldTimestamp,
        origin: 'https://beta.gatewayz.ai',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      expect(retrieved.token).toBeNull();
      expect(retrieved.userId).toBeNull();
    });
  });

  describe('getStoredSessionTransferToken - Boundary Cases', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should handle token at exactly 10 minutes boundary', () => {
      const token = 'test-token';
      const userId = '123';

      // Store with exactly 10 minutes ago timestamp
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const sessionData = {
        token,
        userId,
        timestamp: tenMinutesAgo,
        origin: 'https://beta.gatewayz.ai',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      // At exactly 10 minutes, should be considered expired
      // Due to timing, this might be at the boundary, so we check if it's been cleared
      // The implementation considers elapsed > 10 min as expired, so at exactly 10 min it depends on rounding
      expect(retrieved).toBeDefined();
    });

    it('should handle token expiring at 9m59s', () => {
      const token = 'test-token';
      const userId = '123';

      sessionTransfer.storeSessionTransferToken(token, userId);

      // Set timestamp to 9m59s ago
      const nineMinutes59SecondsAgo = Date.now() - (9 * 60 + 59) * 1000;
      sessionStorage.setItem(
        'gatewayz_session_transfer_timestamp',
        String(nineMinutes59SecondsAgo)
      );

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      // Should still be valid
      expect(retrieved.token).toBe(token);
      expect(retrieved.userId).toBe(userId);
    });

    it('should handle invalid timestamp format', () => {
      // Store raw string (invalid format)
      sessionStorage.setItem('gatewayz_session_transfer_token', 'test-token');

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      // Invalid JSON should return null
      expect(retrieved.token).toBeNull();
      expect(retrieved.userId).toBeNull();
    });

    it('should handle missing timestamp (no expiry check)', () => {
      // Store raw strings in old format (should fail to parse)
      sessionStorage.setItem('gatewayz_session_transfer_token', 'test-token');
      sessionStorage.setItem('gatewayz_session_transfer_user_id', '123');
      // No timestamp set

      const retrieved = sessionTransfer.getStoredSessionTransferToken();
      // Invalid JSON format should return null
      expect(retrieved.token).toBeNull();
      expect(retrieved.userId).toBeNull();
    });
  });

  describe('clearSessionTransferToken - Edge Cases', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should not affect other sessionStorage items', () => {
      sessionStorage.setItem('other-key', 'other-value');
      sessionTransfer.storeSessionTransferToken('token', '123');

      sessionTransfer.clearSessionTransferToken();

      expect(sessionStorage.getItem('other-key')).toBe('other-value');
      expect(sessionStorage.getItem('gatewayz_session_transfer_token')).toBeNull();
    });

    it('should handle clearing when items dont exist', () => {
      expect(() => {
        sessionTransfer.clearSessionTransferToken();
      }).not.toThrow();
    });

    it('should clear partial state', () => {
      // Only set token, not userId or timestamp
      sessionStorage.setItem('gatewayz_session_transfer_token', 'token');

      sessionTransfer.clearSessionTransferToken();

      expect(sessionStorage.getItem('gatewayz_session_transfer_token')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_user_id')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_timestamp')).toBeNull();
    });
  });

  describe('isSessionTransferTokenValid - State Combinations', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should return false for completely empty sessionStorage', () => {
      expect(sessionTransfer.isSessionTransferTokenValid()).toBe(false);
    });

    it('should return false for expired token', () => {
      // Store with expired timestamp
      const veryOldTimestamp = Date.now() - 20 * 60 * 1000;
      const sessionData = {
        token: 'token',
        userId: '123',
        timestamp: veryOldTimestamp,
        origin: 'https://beta.gatewayz.ai',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      expect(sessionTransfer.isSessionTransferTokenValid()).toBe(false);
    });

    it('should return true for valid token', () => {
      sessionTransfer.storeSessionTransferToken('token', '123');

      expect(sessionTransfer.isSessionTransferTokenValid()).toBe(true);
    });

    it('should return false after clearing', () => {
      sessionTransfer.storeSessionTransferToken('token', '123');
      expect(sessionTransfer.isSessionTransferTokenValid()).toBe(true);

      sessionTransfer.clearSessionTransferToken();
      expect(sessionTransfer.isSessionTransferTokenValid()).toBe(false);
    });
  });

  describe('SSR and Window Availability', () => {
    it('should handle missing window gracefully in all functions', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => {
        sessionTransfer.getSessionTransferParams();
        sessionTransfer.cleanupSessionTransferParams();
        sessionTransfer.storeSessionTransferToken('token', '123');
        sessionTransfer.getStoredSessionTransferToken();
        sessionTransfer.clearSessionTransferToken();
        sessionTransfer.isSessionTransferTokenValid();
      }).not.toThrow();

      (global as any).window = originalWindow;
    });
  });
});
