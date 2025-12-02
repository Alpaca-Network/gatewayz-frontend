import {
  redirectToBetaWithSession,
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
  clearSessionTransferToken,
  isSessionTransferTokenValid,
} from '../auth-session-transfer';
import {
  runInSSRContext,
  testSSRFunctions,
} from '@/__tests__/utils/ssr-test-helper';
import { TEST_USER, TEST_TIMESTAMPS } from '@/__tests__/utils/test-constants';

// Mock console methods (stored but not used for assertions due to implementation details)
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Helper to mock window.location - use jsdom's Location properly
function mockLocation(props: { href?: string; search?: string; pathname?: string }) {
  // Create a new URL object that jsdom can work with
  const url = `http://localhost${props.pathname || '/'}${props.search || ''}`;

  // Use jsdom's built-in history API to change location
  window.history.pushState({}, '', url);
}

describe('auth-session-transfer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    // Set default location
    mockLocation({ search: '', pathname: '/test-path' });

    // Mock window.history.replaceState (but not pushState, used by mockLocation)
    window.history.replaceState = jest.fn();

    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(TEST_TIMESTAMPS.NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Consolidated SSR tests - replaces 5 individual SSR tests scattered throughout
  testSSRFunctions([
    {
      name: 'getSessionTransferParams',
      fn: () => getSessionTransferParams(),
      expected: { token: null, userId: null, returnUrl: null, action: null },
    },
    {
      name: 'cleanupSessionTransferParams',
      fn: () => cleanupSessionTransferParams(),
      expected: undefined,
    },
    {
      name: 'storeSessionTransferToken',
      fn: () => storeSessionTransferToken('token', '123'),
      expected: undefined,
    },
    {
      name: 'getStoredSessionTransferToken',
      fn: () => getStoredSessionTransferToken(),
      expected: { token: null, userId: null },
    },
    {
      name: 'clearSessionTransferToken',
      fn: () => clearSessionTransferToken(),
      expected: undefined,
    },
    {
      name: 'isSessionTransferTokenValid',
      fn: () => isSessionTransferTokenValid(),
      expected: false,
    },
  ]);

  describe('redirectToBetaWithSession', () => {
    it.skip('should redirect to beta domain with token and userId (jsdom limitation)', () => {
      // Skipping: jsdom doesn't support navigation via href assignment
      // This function is tested via E2E tests in Playwright
      const token = 'test-api-key-123';
      const userId = '12345';

      redirectToBetaWithSession(token, userId);

      expect(window.location.href).toBe(
        'https://beta.gatewayz.ai?token=test-api-key-123&userId=12345'
      );
    });

    it.skip('should redirect with returnUrl parameter (jsdom limitation)', () => {
      // Skipping: jsdom doesn't support navigation via href assignment
      const token = 'test-api-key-123';
      const userId = '12345';
      const returnUrl = '/dashboard';

      redirectToBetaWithSession(token, userId, 'https://beta.gatewayz.ai', returnUrl);

      expect(window.location.href).toBe(
        'https://beta.gatewayz.ai?token=test-api-key-123&userId=12345&returnUrl=%2Fdashboard'
      );
    });

    it.skip('should use custom beta domain (jsdom limitation)', () => {
      // Skipping: jsdom doesn't support navigation via href assignment
      const token = 'test-api-key-123';
      const userId = '12345';
      const customDomain = 'https://custom-beta.example.com';

      redirectToBetaWithSession(token, userId, customDomain);

      expect(window.location.href).toBe(
        'https://custom-beta.example.com?token=test-api-key-123&userId=12345'
      );
    });

    it.skip('should convert numeric userId to string (jsdom limitation)', () => {
      // Skipping: jsdom doesn't support navigation via href assignment
      const token = 'test-api-key-123';
      const userId = 12345; // Numeric

      redirectToBetaWithSession(token, userId);

      expect(window.location.href).toBe(
        'https://beta.gatewayz.ai?token=test-api-key-123&userId=12345'
      );
    });

    it.skip('should URL encode special characters in parameters (jsdom limitation)', () => {
      // Skipping: jsdom doesn't support navigation via href assignment
      const token = 'token+with/special=chars';
      const userId = '12345';
      const returnUrl = '/path?query=value&foo=bar';

      redirectToBetaWithSession(token, userId, 'https://beta.gatewayz.ai', returnUrl);

      expect(window.location.href).toContain('token=token%2Bwith%2Fspecial%3Dchars');
      expect(window.location.href).toContain(
        'returnUrl=%2Fpath%3Fquery%3Dvalue%26foo%3Dbar'
      );
    });
  });

  describe('getSessionTransferParams', () => {
    it('should extract all parameters from URL', () => {
      mockLocation({
        search: '?token=test-token&userId=12345&returnUrl=/dashboard&action=signin',
      });

      const params = getSessionTransferParams();

      expect(params).toEqual({
        token: 'test-token',
        userId: '12345',
        returnUrl: '/dashboard',
        action: 'signin',
      });
    });

    it('should return null for missing parameters', () => {
      mockLocation({
        search: '?token=test-token',
      });

      const params = getSessionTransferParams();

      expect(params).toEqual({
        token: 'test-token',
        userId: null,
        returnUrl: null,
        action: null,
      });
    });

    it('should handle empty search string', () => {
      mockLocation({
        search: '',
      });

      const params = getSessionTransferParams();

      expect(params).toEqual({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });
    });

    it('should handle URL-encoded parameters', () => {
      mockLocation({
        search: '?token=token%2Bwith%2Fspecial&returnUrl=%2Fpath%3Fquery%3Dvalue',
      });

      const params = getSessionTransferParams();

      expect(params.token).toBe('token+with/special');
      expect(params.returnUrl).toBe('/path?query=value');
    });

    // SSR behavior tested in consolidated testSSRFunctions block above

    it('should handle duplicate parameters (first one wins in URLSearchParams)', () => {
      mockLocation({
        search: '?token=first-token&token=second-token&userId=123',
      });

      const params = getSessionTransferParams();

      // URLSearchParams.get() returns the first value for duplicate keys
      expect(params.token).toBe('first-token');
    });
  });

  describe('cleanupSessionTransferParams', () => {
    it('should remove all query parameters from URL', () => {
      mockLocation({
        pathname: '/test-path',
        search: '?token=test-token&userId=12345',
      });

      cleanupSessionTransferParams();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        '/test-path'
      );
    });

    it('should preserve pathname', () => {
      mockLocation({
        pathname: '/dashboard/settings',
        search: '?token=test-token',
      });

      cleanupSessionTransferParams();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        '/dashboard/settings'
      );
    });

    // SSR behavior tested in consolidated testSSRFunctions block above
  });

  describe('storeSessionTransferToken', () => {
    it('should store token, userId, and timestamp in sessionStorage', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      storeSessionTransferToken(token, userId);

      const stored = sessionStorage.getItem('gatewayz_session_transfer_token');
      expect(stored).toBeTruthy();

      const sessionData = JSON.parse(stored!);
      expect(sessionData.token).toBe(token);
      expect(sessionData.userId).toBe(userId);
      expect(sessionData.timestamp).toBe(1000000);
      expect(sessionData.origin).toBe('http://localhost');
      expect(sessionData.fingerprint).toBeTruthy();
    });

    it('should convert numeric userId to string', () => {
      const token = 'test-api-key-123';
      const userId = 12345;

      storeSessionTransferToken(token, userId);

      const stored = sessionStorage.getItem('gatewayz_session_transfer_token');
      expect(stored).toBeTruthy();

      const sessionData = JSON.parse(stored!);
      expect(sessionData.userId).toBe('12345');
    });

    it('should overwrite existing values', () => {
      storeSessionTransferToken('old-token', '111');
      storeSessionTransferToken('new-token', '222');

      const stored = sessionStorage.getItem('gatewayz_session_transfer_token');
      expect(stored).toBeTruthy();

      const sessionData = JSON.parse(stored!);
      expect(sessionData.token).toBe('new-token');
      expect(sessionData.userId).toBe('222');
    });

    // SSR behavior tested in consolidated testSSRFunctions block above
  });

  describe('getStoredSessionTransferToken', () => {
    it('should retrieve valid token within expiry window', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      // Store in new JSON format
      const sessionData = {
        token,
        userId,
        timestamp: 1000000,
        origin: 'http://localhost',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      // Mock current time as 2 minutes later (within 10-minute expiry)
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 2 * 60 * 1000);

      const result = getStoredSessionTransferToken();

      expect(result).toEqual({ token, userId });
    });

    it('should clear and return null for expired token', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      // Store in new JSON format
      const sessionData = {
        token,
        userId,
        timestamp: 1000000,
        origin: 'http://localhost',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      // Mock current time as 11 minutes later (past 10-minute expiry)
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 11 * 60 * 1000);

      const result = getStoredSessionTransferToken();

      expect(result).toEqual({ token: null, userId: null });

      // Verify storage was cleared
      expect(sessionStorage.getItem('gatewayz_session_transfer_token')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_user_id')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_timestamp')).toBeNull();
    });

    it('should return null when token is missing', () => {
      // Store invalid JSON without token
      const sessionData = {
        userId: '12345',
        timestamp: Date.now(),
        origin: 'http://localhost'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      const result = getStoredSessionTransferToken();

      expect(result).toEqual({ token: null, userId: null });
    });

    it('should return null when userId is missing', () => {
      // Store invalid JSON without userId
      const sessionData = {
        token: 'test-token',
        timestamp: Date.now(),
        origin: 'http://localhost'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      const result = getStoredSessionTransferToken();

      expect(result).toEqual({ token: null, userId: null });
    });

    it('should return null when origin mismatches', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      // Store with different origin
      const sessionData = {
        token,
        userId,
        timestamp: Date.now(),
        origin: 'http://different-origin.com',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      const result = getStoredSessionTransferToken();

      expect(result).toEqual({ token: null, userId: null });
    });

    // SSR behavior tested in consolidated testSSRFunctions block above

    it('should handle exactly 10 minutes (boundary case)', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      // Store in new JSON format
      const sessionData = {
        token,
        userId,
        timestamp: 1000000,
        origin: 'http://localhost',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      // Exactly 10 minutes later
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 10 * 60 * 1000);

      const result = getStoredSessionTransferToken();

      // Should still be valid (not expired)
      expect(result).toEqual({ token, userId });
    });

    it('should handle 10 minutes + 1ms (just expired)', () => {
      const token = 'test-api-key-123';
      const userId = '12345';

      // Store in new JSON format
      const sessionData = {
        token,
        userId,
        timestamp: 1000000,
        origin: 'http://localhost',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      // 10 minutes + 1ms later
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 10 * 60 * 1000 + 1);

      const result = getStoredSessionTransferToken();

      // Should be expired
      expect(result).toEqual({ token: null, userId: null });
    });
  });

  describe('clearSessionTransferToken', () => {
    it('should remove all session transfer items from sessionStorage', () => {
      sessionStorage.setItem('gatewayz_session_transfer_token', 'test-token');
      sessionStorage.setItem('gatewayz_session_transfer_user_id', '12345');
      sessionStorage.setItem('gatewayz_session_transfer_timestamp', '1000000');

      clearSessionTransferToken();

      expect(sessionStorage.getItem('gatewayz_session_transfer_token')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_user_id')).toBeNull();
      expect(sessionStorage.getItem('gatewayz_session_transfer_timestamp')).toBeNull();
    });

    it('should not affect other sessionStorage items', () => {
      sessionStorage.setItem('gatewayz_session_transfer_token', 'test-token');
      sessionStorage.setItem('other_item', 'other-value');

      clearSessionTransferToken();

      expect(sessionStorage.getItem('gatewayz_session_transfer_token')).toBeNull();
      expect(sessionStorage.getItem('other_item')).toBe('other-value');
    });

    // SSR behavior tested in consolidated testSSRFunctions block above
  });

  describe('isSessionTransferTokenValid', () => {
    it('should return true when valid token exists', () => {
      // Store in new JSON format
      const sessionData = {
        token: 'test-token',
        userId: '12345',
        timestamp: 1000000,
        origin: 'http://localhost',
        fingerprint: 'test-fingerprint'
      };
      sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

      // Mock current time within expiry
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 5 * 60 * 1000);

      const isValid = isSessionTransferTokenValid();

      expect(isValid).toBe(true);
    });

    it('should return false when token is expired', () => {
      sessionStorage.setItem('gatewayz_session_transfer_token', 'test-token');
      sessionStorage.setItem('gatewayz_session_transfer_user_id', '12345');
      sessionStorage.setItem('gatewayz_session_transfer_timestamp', '1000000');

      // Mock current time past expiry
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 11 * 60 * 1000);

      const isValid = isSessionTransferTokenValid();

      expect(isValid).toBe(false);
    });

    it('should return false when token does not exist', () => {
      const isValid = isSessionTransferTokenValid();

      expect(isValid).toBe(false);
    });

    // SSR behavior tested in consolidated testSSRFunctions block above
  });

  describe('Integration Scenarios', () => {
    it('should support full session transfer workflow', () => {
      // Step 1: Store token
      storeSessionTransferToken('my-api-key', '99999');

      // Step 2: Retrieve token within expiry
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 1 * 60 * 1000);
      const result = getStoredSessionTransferToken();
      expect(result).toEqual({ token: 'my-api-key', userId: '99999' });

      // Step 3: Validate token
      expect(isSessionTransferTokenValid()).toBe(true);

      // Step 4: Clear token
      clearSessionTransferToken();

      // Step 5: Validate again (should be false)
      expect(isSessionTransferTokenValid()).toBe(false);
    });

    it('should handle token expiry during session', () => {
      // Store token (uses TEST_TIMESTAMPS.NOW from beforeEach)
      storeSessionTransferToken('my-api-key', '99999');

      // First retrieval within expiry (5 minutes after NOW)
      jest.spyOn(Date, 'now').mockReturnValue(TEST_TIMESTAMPS.NOW + 5 * 60 * 1000);
      let result = getStoredSessionTransferToken();
      expect(result.token).toBe('my-api-key');

      // Second retrieval past expiry (15 minutes after NOW, beyond 10-min expiry)
      jest.spyOn(Date, 'now').mockReturnValue(TEST_TIMESTAMPS.NOW + 15 * 60 * 1000);
      result = getStoredSessionTransferToken();
      expect(result.token).toBeNull();

      // Validate should also return false
      expect(isSessionTransferTokenValid()).toBe(false);
    });
  });
});
