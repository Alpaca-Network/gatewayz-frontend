/**
 * Comprehensive integration tests for authentication and chat creation flow
 * Tests the full path from login through chat session creation
 * @jest-environment jsdom
 */

import {
  saveApiKey,
  getApiKey,
  removeApiKey,
  saveUserData,
  getUserData,
  processAuthResponse,
  makeAuthenticatedRequest,
  type AuthResponse,
  type UserData,
} from '@/lib/api';
import { ChatHistoryAPI, type ChatSession } from '@/lib/chat-history';

// Mock global fetch
global.fetch = jest.fn();

describe('Auth to Chat Flow - Integration Tests', () => {
  const mockApiKey = 'gw_test_key_123';
  const mockPrivyUserId = 'privy-user-123';
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Login to Chat Session Flow', () => {
    it('should handle full flow: auth -> store creds -> create session', async () => {
      // Step 1: Backend returns auth response
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: mockApiKey,
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        is_new_user: true,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
        tier: 'pro',
        subscription_status: 'active',
        timestamp: new Date().toISOString(),
      };

      // Step 2: Frontend processes auth response
      processAuthResponse(authResponse);

      // Verify credentials stored
      expect(getApiKey()).toBe(mockApiKey);
      const userData = getUserData();
      expect(userData?.user_id).toBe(12345);
      expect(userData?.privy_user_id).toBe(mockPrivyUserId);
      expect(userData?.credits).toBe(500);

      // Step 3: Create ChatHistoryAPI instance
      const chatAPI = new ChatHistoryAPI(
        getApiKey()!,
        undefined,
        userData?.privy_user_id
      );

      // Step 4: Mock chat session creation response
      const mockSession: ChatSession = {
        id: 1,
        user_id: 12345,
        title: 'New Chat',
        model: 'gpt-4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      // Step 5: Create chat session with API
      const session = await chatAPI.createSession('New Chat', 'gpt-4');

      // Verify session created
      expect(session.id).toBe(1);
      expect(session.title).toBe('New Chat');

      // Verify API was called with correct auth
      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBe(`Bearer ${mockApiKey}`);
      expect(fetchCall[0]).toContain(`privy_user_id=${mockPrivyUserId}`);
    });

    it('should recover from auth 401 by triggering re-auth', async () => {
      // Setup: User is authenticated but has invalid key
      saveApiKey('invalid-key');
      saveUserData({
        user_id: 12345,
        api_key: 'invalid-key',
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      });

      // API returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });

      const chatAPI = new ChatHistoryAPI(
        getApiKey()!,
        undefined,
        mockPrivyUserId
      );

      // Should throw auth error with improved message
      await expect(chatAPI.getSessions()).rejects.toThrow(
        'Your session has expired or your API key is invalid'
      );

      // Verify credentials NOT cleared by chat API (context should handle)
      // (The context/provider should handle 401 and trigger re-auth)
      expect(getApiKey()).toBe('invalid-key'); // Still there, context will clear
    });

    it('should handle missing API key gracefully', async () => {
      // No API key stored
      removeApiKey();

      // Attempt to use chat API without credentials
      const chatAPI = new ChatHistoryAPI('', undefined, mockPrivyUserId);

      // Mock auth API endpoint that requires API key
      const mockResponse = { status: 401, ok: false };
      mockFetch.mockResolvedValue(mockResponse);

      // makeAuthenticatedRequest should fail
      await expect(
        makeAuthenticatedRequest('/api/test')
      ).rejects.toThrow('No API key found');
    });

    it('should preserve Privy user ID through auth context', async () => {
      // Setup auth data with Privy ID
      const authData: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: mockApiKey,
        auth_method: 'google',
        privy_user_id: 'privy-google-xyz',
        is_new_user: false,
        display_name: 'Google User',
        email: 'google@example.com',
        credits: 150,
      };

      processAuthResponse(authData);

      const userData = getUserData();
      expect(userData?.privy_user_id).toBe('privy-google-xyz');

      // Create chat API with stored Privy ID
      const chatAPI = new ChatHistoryAPI(
        getApiKey()!,
        undefined,
        userData?.privy_user_id
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 1, title: 'Chat' } }),
      });

      await chatAPI.createSession();

      // Verify Privy ID was included in request
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('privy-google-xyz');
    });
  });

  describe('Session Creation Error Handling', () => {
    beforeEach(() => {
      // Setup authenticated state
      saveApiKey(mockApiKey);
      saveUserData({
        user_id: 12345,
        api_key: mockApiKey,
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      });
    });

    it('should handle backend errors during session creation', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      // Backend returns error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid session data' }),
      });

      await expect(chatAPI.createSession('Test')).rejects.toThrow(
        'Invalid session data'
      );
    });

    it('should handle network timeouts during session creation', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      // Simulate timeout
      mockFetch.mockImplementationOnce(
        () => new Promise((_, reject) => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        })
      );

      await expect(chatAPI.createSession('Test')).rejects.toThrow(
        'Request timed out'
      );
    });

    it('should handle malformed API responses', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      // Backend returns invalid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(chatAPI.createSession('Test')).rejects.toThrow();
    });

    it('should handle 500 server errors gracefully', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });

      await expect(chatAPI.createSession('Test')).rejects.toThrow(
        'Internal server error'
      );
    });

    it('should handle rate limiting (429) errors', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      await expect(chatAPI.createSession('Test')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('Reauthentication on 401 Flow', () => {
    it('should clear credentials when API returns 401', async () => {
      // Setup authenticated state
      saveApiKey('old-key');
      saveUserData({
        user_id: 12345,
        api_key: 'old-key',
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      });

      // Try to make authenticated request
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const response = await makeAuthenticatedRequest('/api/test');

      // Verify 401 response
      expect(response.status).toBe(401);

      // Credentials should be cleared by makeAuthenticatedRequest
      expect(getApiKey()).toBeNull();
      expect(getUserData()).toBeNull();
    });

    it('should support re-login after 401 logout', async () => {
      // First login
      let authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 111,
        api_key: 'key-1',
        auth_method: 'email',
        privy_user_id: 'privy-111',
        is_new_user: false,
        display_name: 'User 1',
        email: 'user1@example.com',
        credits: 100,
      };

      processAuthResponse(authResponse);
      expect(getApiKey()).toBe('key-1');

      // Simulate 401 and logout
      mockFetch.mockResolvedValueOnce({ status: 401, ok: false });
      await makeAuthenticatedRequest('/api/test');
      expect(getApiKey()).toBeNull();

      // Second login (different user)
      authResponse = {
        success: true,
        message: 'Login successful',
        user_id: 222,
        api_key: 'key-2',
        auth_method: 'google',
        privy_user_id: 'privy-222',
        is_new_user: true,
        display_name: 'User 2',
        email: 'user2@example.com',
        credits: 500,
      };

      processAuthResponse(authResponse);
      expect(getApiKey()).toBe('key-2');

      const userData = getUserData();
      expect(userData?.user_id).toBe(222);
      expect(userData?.privy_user_id).toBe('privy-222');
    });
  });

  describe('Message Saving After Session Creation', () => {
    beforeEach(() => {
      saveApiKey(mockApiKey);
      saveUserData({
        user_id: 12345,
        api_key: mockApiKey,
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      });
    });

    it('should save message after successful session creation', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      // Mock session creation
      const mockSession: ChatSession = {
        id: 1,
        user_id: 12345,
        title: 'Test Chat',
        model: 'gpt-4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const session = await chatAPI.createSession('Test Chat', 'gpt-4');

      // Mock message save
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 1,
            session_id: 1,
            role: 'user',
            content: 'Hello',
            created_at: new Date().toISOString(),
          },
        }),
      });

      const message = await chatAPI.saveMessage(
        session.id,
        'user',
        'Hello'
      );

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should handle message save errors without breaking session', async () => {
      const chatAPI = new ChatHistoryAPI(mockApiKey, undefined, mockPrivyUserId);

      // Mock session creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 1,
            user_id: 12345,
            title: 'Test',
            model: 'gpt-4',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
          },
        }),
      });

      const session = await chatAPI.createSession();

      // Mock message save failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Failed to save message' }),
      });

      await expect(
        chatAPI.saveMessage(session.id, 'user', 'Hello')
      ).rejects.toThrow();

      // Session still exists and can be used
      expect(session.id).toBe(1);
    });
  });

  describe('Authentication Context Edge Cases', () => {
    it('should handle auth response with no API key field', () => {
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
      };

      processAuthResponse(authResponse);

      // Credentials should NOT be stored
      expect(getApiKey()).toBeNull();
      expect(getUserData()).toBeNull();
    });

    it('should handle auth response with empty API key', () => {
      const authResponse: any = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: '', // Empty string
        auth_method: 'email',
        privy_user_id: 'privy-xyz',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
      };

      processAuthResponse(authResponse);

      // Empty API key should result in null (treated as no valid key)
      expect(getApiKey()).toBeNull();
    });

    it('should handle concurrent auth attempts', async () => {
      const auth1: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 111,
        api_key: 'key-1',
        auth_method: 'email',
        privy_user_id: 'privy-111',
        is_new_user: false,
        display_name: 'User 1',
        email: 'user1@example.com',
        credits: 100,
      };

      const auth2: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 222,
        api_key: 'key-2',
        auth_method: 'google',
        privy_user_id: 'privy-222',
        is_new_user: false,
        display_name: 'User 2',
        email: 'user2@example.com',
        credits: 200,
      };

      // Process both concurrently (simulating race condition)
      await Promise.all([
        Promise.resolve(processAuthResponse(auth1)),
        Promise.resolve(processAuthResponse(auth2)),
      ]);

      // Last one should win (typical race condition)
      const userData = getUserData();
      // Either user could be stored, depending on timing
      expect([111, 222]).toContain(userData?.user_id);
    });

    it('should validate tier normalization', () => {
      const authResponse: AuthResponse = {
        success: true,
        message: 'Login successful',
        user_id: 12345,
        api_key: mockApiKey,
        auth_method: 'email',
        privy_user_id: mockPrivyUserId,
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 100,
        tier: 'PRO' as any, // Uppercase from backend
      };

      processAuthResponse(authResponse);

      const userData = getUserData();
      expect(userData?.tier).toBe('pro'); // Should be lowercase
    });
  });

  describe('API Request Headers and Authentication', () => {
    it('should include correct auth headers in chat API requests', async () => {
      const testApiKey = 'gw_test_123';
      const testPrivyId = 'privy_xyz_789';

      saveApiKey(testApiKey);

      const chatAPI = new ChatHistoryAPI(testApiKey, undefined, testPrivyId);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await chatAPI.getSessions();

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers.Authorization).toBe(`Bearer ${testApiKey}`);
      expect(headers['Content-Type']).toBe('application/json');
      expect(fetchCall[0]).toContain(`privy_user_id=${testPrivyId}`);
    });

    it('should validate bearer token format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const invalidApiKey = 'not-a-valid-key-format';
      const chatAPI = new ChatHistoryAPI(invalidApiKey);

      // Should still work (backend validates format)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await chatAPI.getSessions();

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe(
        `Bearer ${invalidApiKey}`
      );
    });
  });
});
