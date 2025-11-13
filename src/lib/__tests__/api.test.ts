import {
  saveApiKey,
  getApiKey,
  removeApiKey,
  requestAuthRefresh,
  saveUserData,
  getUserData,
  makeAuthenticatedRequest,
  processAuthResponse,
  AUTH_REFRESH_EVENT,
  NEW_USER_WELCOME_EVENT,
  type AuthResponse,
  type UserData,
} from '../api';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

// Mock global fetch
global.fetch = jest.fn();

describe('api utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('API Key Management', () => {
    describe('saveApiKey', () => {
      it('should save API key to localStorage', () => {
        const apiKey = 'test-api-key-123';

        saveApiKey(apiKey);

        expect(localStorage.getItem('gatewayz_api_key')).toBe(apiKey);
      });

      it('should overwrite existing API key', () => {
        saveApiKey('old-key');
        saveApiKey('new-key');

        expect(localStorage.getItem('gatewayz_api_key')).toBe('new-key');
      });

      it('should do nothing in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        saveApiKey('test-key');

        // Should not throw error
        expect(true).toBe(true);

        global.window = originalWindow;
      });
    });

    describe('getApiKey', () => {
      it('should retrieve API key from localStorage', () => {
        localStorage.setItem('gatewayz_api_key', 'test-api-key-123');

        const apiKey = getApiKey();

        expect(apiKey).toBe('test-api-key-123');
      });

      it('should return null when no API key exists', () => {
        const apiKey = getApiKey();

        expect(apiKey).toBeNull();
      });

      it('should return null in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        const apiKey = getApiKey();

        expect(apiKey).toBeNull();

        global.window = originalWindow;
      });
    });

    describe('removeApiKey', () => {
      it('should remove API key and user data from localStorage', () => {
        localStorage.setItem('gatewayz_api_key', 'test-api-key');
        localStorage.setItem('gatewayz_user_data', JSON.stringify({ user_id: 123 }));

        removeApiKey();

        expect(localStorage.getItem('gatewayz_api_key')).toBeNull();
        expect(localStorage.getItem('gatewayz_user_data')).toBeNull();
      });

      it('should not affect other localStorage items', () => {
        localStorage.setItem('gatewayz_api_key', 'test-api-key');
        localStorage.setItem('other_item', 'other-value');

        removeApiKey();

        expect(localStorage.getItem('gatewayz_api_key')).toBeNull();
        expect(localStorage.getItem('other_item')).toBe('other-value');
      });

      it('should do nothing in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        removeApiKey();

        // Should not throw error
        expect(true).toBe(true);

        global.window = originalWindow;
      });
    });

    describe('requestAuthRefresh', () => {
      it('should dispatch auth refresh event', () => {
        const eventListener = jest.fn();
        window.addEventListener(AUTH_REFRESH_EVENT, eventListener);

        requestAuthRefresh();

        expect(eventListener).toHaveBeenCalledTimes(1);
        expect(eventListener).toHaveBeenCalledWith(expect.any(Event));

        window.removeEventListener(AUTH_REFRESH_EVENT, eventListener);
      });

      it('should do nothing in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        requestAuthRefresh();

        // Should not throw error
        expect(true).toBe(true);

        global.window = originalWindow;
      });
    });
  });

  describe('User Data Management', () => {
    describe('saveUserData', () => {
      it('should save user data to localStorage as JSON', () => {
        const userData: UserData = {
          user_id: 12345,
          api_key: 'test-api-key',
          auth_method: 'email',
          privy_user_id: 'privy-123',
          display_name: 'Test User',
          email: 'test@example.com',
          credits: 100,
          tier: 'pro',
          subscription_status: 'active',
        };

        saveUserData(userData);

        const stored = localStorage.getItem('gatewayz_user_data');
        expect(stored).toBeDefined();
        expect(JSON.parse(stored!)).toEqual(userData);
      });

      it('should overwrite existing user data', () => {
        const oldData: UserData = {
          user_id: 111,
          api_key: 'old-key',
          auth_method: 'email',
          privy_user_id: 'privy-old',
          display_name: 'Old User',
          email: 'old@example.com',
          credits: 50,
        };

        const newData: UserData = {
          user_id: 222,
          api_key: 'new-key',
          auth_method: 'google',
          privy_user_id: 'privy-new',
          display_name: 'New User',
          email: 'new@example.com',
          credits: 200,
        };

        saveUserData(oldData);
        saveUserData(newData);

        const stored = localStorage.getItem('gatewayz_user_data');
        expect(JSON.parse(stored!)).toEqual(newData);
      });

      it('should do nothing in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        const userData: UserData = {
          user_id: 12345,
          api_key: 'test-api-key',
          auth_method: 'email',
          privy_user_id: 'privy-123',
          display_name: 'Test User',
          email: 'test@example.com',
          credits: 100,
        };

        saveUserData(userData);

        // Should not throw error
        expect(true).toBe(true);

        global.window = originalWindow;
      });
    });

    describe('getUserData', () => {
      it('should retrieve user data from localStorage', () => {
        const userData: UserData = {
          user_id: 12345,
          api_key: 'test-api-key',
          auth_method: 'email',
          privy_user_id: 'privy-123',
          display_name: 'Test User',
          email: 'test@example.com',
          credits: 100,
        };

        localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));

        const retrieved = getUserData();

        expect(retrieved).toEqual(userData);
      });

      it('should return null when no user data exists', () => {
        const retrieved = getUserData();

        expect(retrieved).toBeNull();
      });

      it('should parse JSON correctly', () => {
        const userData: UserData = {
          user_id: 12345,
          api_key: 'test-api-key',
          auth_method: 'email',
          privy_user_id: 'privy-123',
          display_name: 'Test User',
          email: 'test@example.com',
          credits: 100,
          tier: 'max',
          subscription_status: 'active',
          subscription_end_date: 1735689600,
        };

        localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));

        const retrieved = getUserData();

        expect(retrieved).toEqual(userData);
        expect(retrieved?.tier).toBe('max');
        expect(retrieved?.subscription_end_date).toBe(1735689600);
      });

      it('should return null in SSR environment', () => {
        const originalWindow = global.window;
        (global as any).window = undefined;

        const retrieved = getUserData();

        expect(retrieved).toBeNull();

        global.window = originalWindow;
      });

      it('should handle malformed JSON gracefully', () => {
        localStorage.setItem('gatewayz_user_data', 'invalid-json{');

        expect(() => {
          getUserData();
        }).toThrow();
      });
    });
  });

  describe('makeAuthenticatedRequest', () => {
    it('should make request with Authorization header', async () => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-123');

      const mockResponse = { ok: true, json: async () => ({ success: true }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const response = await makeAuthenticatedRequest('/api/test');

      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key-123',
        },
      });

      expect(response).toBe(mockResponse);
    });

    it('should merge custom headers with default headers', async () => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-123');

      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await makeAuthenticatedRequest('/api/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key-123',
          'X-Custom-Header': 'custom-value',
        },
      });
    });

    it('should allow overriding Content-Type header', async () => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-123');

      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await makeAuthenticatedRequest('/api/test', {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': 'Bearer test-api-key-123',
        },
      });
    });

    it('should pass through other request options', async () => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-123');

      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await makeAuthenticatedRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key-123',
        },
      });
    });

    it('should throw error when no API key is available', async () => {
      await expect(makeAuthenticatedRequest('/api/test')).rejects.toThrow(
        'No API key found. User must be authenticated.'
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should clear credentials on 401 response', async () => {
      localStorage.setItem('gatewayz_api_key', 'invalid-api-key');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({ user_id: 123 }));

      const mockResponse = { status: 401, ok: false };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const response = await makeAuthenticatedRequest('/api/test');

      expect(response.status).toBe(401);
      expect(localStorage.getItem('gatewayz_api_key')).toBeNull();
      expect(localStorage.getItem('gatewayz_user_data')).toBeNull();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'API key is invalid (401), clearing stored credentials'
      );
    });

    it('should NOT clear credentials on other error statuses', async () => {
      localStorage.setItem('gatewayz_api_key', 'valid-api-key');

      const mockResponse = { status: 500, ok: false };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await makeAuthenticatedRequest('/api/test');

      expect(localStorage.getItem('gatewayz_api_key')).toBe('valid-api-key');
    });
  });

  describe('processAuthResponse', () => {
    it('should save API key and user data from auth response', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 150,
        timestamp: '2025-01-01T00:00:00Z',
        tier: 'pro',
        subscription_status: 'active',
      };

      processAuthResponse(authResponse);

      expect(localStorage.getItem('gatewayz_api_key')).toBe('new-api-key-789');

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData).toEqual({
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 150,
        tier: 'pro',
        tier_display_name: undefined,
        subscription_status: 'active',
        subscription_end_date: undefined,
      });
    });

    it('should convert decimal credits to integer', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 150.75, // Decimal
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(150); // Floored
    });

    it('should handle undefined credits', () => {
      const authResponse: any = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: undefined,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(0);
    });

    it('should handle null credits', () => {
      const authResponse: any = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: null,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(0);
    });

    it('should handle NaN credits', () => {
      const authResponse: any = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: NaN,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(0);
    });

    it('should normalize tier to lowercase', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        timestamp: null,
        tier: 'PRO' as any, // Uppercase from backend
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.tier).toBe('pro');
    });

    it('should preserve tier_display_name', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        timestamp: null,
        tier: 'max',
        tier_display_name: 'MAX',
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.tier_display_name).toBe('MAX');
    });

    it('should trigger welcome event for new users', () => {
      const eventListener = jest.fn();
      window.addEventListener(NEW_USER_WELCOME_EVENT, eventListener);

      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: true, // New user
        display_name: 'New User',
        email: 'new@example.com',
        credits: 500,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { credits: 500 },
        })
      );

      window.removeEventListener(NEW_USER_WELCOME_EVENT, eventListener);
    });

    it('should NOT trigger welcome event for existing users', () => {
      const eventListener = jest.fn();
      window.addEventListener(NEW_USER_WELCOME_EVENT, eventListener);

      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false, // Existing user
        display_name: 'Existing User',
        email: 'existing@example.com',
        credits: 100,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      expect(eventListener).not.toHaveBeenCalled();

      window.removeEventListener(NEW_USER_WELCOME_EVENT, eventListener);
    });

    it('should warn when API key is missing', () => {
      const authResponse: any = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        // api_key is missing
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Authentication response missing API key:',
        expect.objectContaining({
          success: true,
          has_api_key: false,
        })
      );

      expect(localStorage.getItem('gatewayz_api_key')).toBeNull();
      expect(localStorage.getItem('gatewayz_user_data')).toBeNull();
    });

    it('should log API key preview securely', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'very-long-api-key-that-should-be-truncated',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Processing auth response:',
        expect.objectContaining({
          api_key_preview: 'very-long-...',
        })
      );
    });

    it('should handle zero credits', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 0,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(0);
    });

    it('should handle negative credits (edge case)', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'new-api-key-789',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: -50,
        timestamp: null,
      };

      processAuthResponse(authResponse);

      const storedUserData = JSON.parse(
        localStorage.getItem('gatewayz_user_data')!
      );

      expect(storedUserData.credits).toBe(-50);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full authentication workflow', async () => {
      // Step 1: Process auth response
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: 'auth-key-123',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: true,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
        timestamp: null,
        tier: 'pro',
      };

      processAuthResponse(authResponse);

      // Step 2: Verify credentials stored
      expect(getApiKey()).toBe('auth-key-123');
      const userData = getUserData();
      expect(userData?.user_id).toBe(12345);

      // Step 3: Make authenticated request
      const mockResponse = { ok: true, json: async () => ({ data: 'test' }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const response = await makeAuthenticatedRequest('/api/test');
      expect(response.ok).toBe(true);

      // Step 4: Request auth refresh
      const eventListener = jest.fn();
      window.addEventListener(AUTH_REFRESH_EVENT, eventListener);
      requestAuthRefresh();
      expect(eventListener).toHaveBeenCalled();

      // Step 5: Logout
      removeApiKey();
      expect(getApiKey()).toBeNull();
      expect(getUserData()).toBeNull();

      window.removeEventListener(AUTH_REFRESH_EVENT, eventListener);
    });

    it('should handle 401 and require re-authentication', async () => {
      // Setup authenticated state
      saveApiKey('valid-key');
      saveUserData({
        user_id: 12345,
        api_key: 'valid-key',
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      });

      // API returns 401
      const mockResponse = { status: 401, ok: false };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await makeAuthenticatedRequest('/api/test');

      // Credentials should be cleared
      expect(getApiKey()).toBeNull();
      expect(getUserData()).toBeNull();

      // Next request should fail (no API key)
      await expect(makeAuthenticatedRequest('/api/test')).rejects.toThrow(
        'No API key found'
      );
    });
  });
});
