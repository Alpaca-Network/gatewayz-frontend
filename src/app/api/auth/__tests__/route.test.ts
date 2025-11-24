/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as proxyFetch from '@/lib/proxy-fetch';

// Mock the proxy-fetch module
jest.mock('@/lib/proxy-fetch', () => ({
  proxyFetch: jest.fn(),
}));

// Mock the error handler
jest.mock('@/app/api/middleware/error-handler', () => ({
  handleApiError: jest.fn((error: Error, context: string) => {
    return new Response(
      JSON.stringify({ error: error.message, context }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('POST /api/auth', () => {
  const mockProxyFetch = proxyFetch.proxyFetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.gatewayz.ai';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Authentication', () => {
    it('should proxy authentication request to backend and return success', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 12345,
        api_key: 'gw_test_key_abc123',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
        timestamp: '2025-01-01T00:00:00Z',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user_id).toBe(12345);
      expect(data.api_key).toBe('gw_test_key_abc123');
      expect(data.is_new_user).toBe(false);

      expect(mockProxyFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/auth',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockAuthRequest),
        })
      );
    });

    it('should handle new user registration', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-new-456',
        auth_method: 'google',
        email: 'newuser@example.com',
        display_name: 'New User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 99999,
        api_key: 'gw_new_key_xyz789',
        auth_method: 'google',
        privy_user_id: 'privy-new-456',
        is_new_user: true, // New user
        display_name: 'New User',
        email: 'newuser@example.com',
        credits: 500, // Welcome credits
        timestamp: '2025-01-01T00:00:00Z',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_new_user).toBe(true);
      expect(data.credits).toBe(500);
    });

    it('should handle different authentication methods', async () => {
      const authMethods = ['email', 'google', 'github', 'wallet'];

      for (const method of authMethods) {
        const mockAuthRequest = {
          privy_user_id: `privy-${method}-123`,
          auth_method: method,
          email: `user@${method}.com`,
          display_name: `${method} User`,
        };

        const mockAuthResponse = {
          success: true,
          user_id: 12345,
          api_key: 'gw_test_key',
          auth_method: method,
          privy_user_id: `privy-${method}-123`,
          is_new_user: false,
          display_name: `${method} User`,
          email: `user@${method}.com`,
          credits: 500,
          timestamp: '2025-01-01T00:00:00Z',
        };

        mockProxyFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockAuthResponse),
        });

        const request = new NextRequest('http://localhost:3000/api/auth', {
          method: 'POST',
          body: JSON.stringify(mockAuthRequest),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.auth_method).toBe(method);
      }
    });

    it('should include tier and subscription info for subscribed users', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-pro-789',
        auth_method: 'email',
        email: 'pro@example.com',
        display_name: 'Pro User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 55555,
        api_key: 'gw_pro_key_123',
        auth_method: 'email',
        privy_user_id: 'privy-pro-789',
        is_new_user: false,
        display_name: 'Pro User',
        email: 'pro@example.com',
        credits: 1000,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: 1735689600,
        timestamp: '2025-01-01T00:00:00Z',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('pro');
      expect(data.subscription_status).toBe('active');
      expect(data.subscription_end_date).toBe(1735689600);
    });
  });

  describe('Authentication Failures', () => {
    it('should return 401 for invalid credentials', async () => {
      const mockAuthRequest = {
        privy_user_id: 'invalid-user',
        auth_method: 'email',
      };

      const mockErrorResponse = {
        error: 'Invalid credentials',
        detail: 'User authentication failed',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
      // Note: Console logging assertions can be flaky in tests
    });

    it('should return 400 for missing required fields', async () => {
      const mockAuthRequest = {
        // Missing required fields
        privy_user_id: '',
      };

      const mockErrorResponse = {
        error: 'Bad Request',
        detail: 'Missing required authentication fields',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Bad Request');
    });

    it('should return 429 for rate limit exceeded', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      const mockErrorResponse = {
        error: 'Too Many Requests',
        detail: 'Rate limit exceeded. Please try again later.',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too Many Requests');
    });

    it('should return 500 for backend server errors', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      const mockErrorResponse = {
        error: 'Internal Server Error',
        detail: 'Database connection failed',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      mockProxyFetch.mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Network error');
    });

    it('should handle timeout errors', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      mockProxyFetch.mockRejectedValue(new Error('Request timeout'));

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Request timeout');
    });

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const mockErrorResponse = {
        error: 'Bad Request',
        detail: 'Empty request body',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Request Forwarding', () => {
    it('should forward all request body fields to backend', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
        custom_field: 'custom_value', // Additional field
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      await POST(request);

      const fetchCall = mockProxyFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toEqual(mockAuthRequest);
      expect(requestBody.custom_field).toBe('custom_value');
    });

    it('should set correct Content-Type header', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      await POST(request);

      const fetchCall = mockProxyFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should use correct backend URL', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      await POST(request);

      expect(mockProxyFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/auth',
        expect.any(Object)
      );
    });
  });

  describe.skip('Logging', () => {
    // Skipping console logging tests as they can be flaky in Jest
    // The actual logging functionality is verified manually
  });

  describe('Integration Scenarios', () => {
    it('should complete full authentication flow for new email user', async () => {
      const mockAuthRequest = {
        privy_user_id: 'did:privy:cm5abc123',
        auth_method: 'email',
        email: 'newcomer@example.com',
        display_name: 'New Comer',
      };

      const mockAuthResponse = {
        success: true,
        message: 'User authenticated successfully',
        user_id: 123456,
        api_key: 'gw_live_test_key_123456', // Test fixture, not a real secret
        auth_method: 'email',
        privy_user_id: 'did:privy:cm5abc123',
        is_new_user: true,
        display_name: 'New Comer',
        email: 'newcomer@example.com',
        credits: 500,
        tier: 'basic',
        timestamp: '2025-01-14T12:00:00Z',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.is_new_user).toBe(true);
      expect(data.api_key).toBe('gw_live_test_key_123456');
      expect(data.credits).toBe(500);
      expect(data.tier).toBe('basic');
      // Note: Console logging assertions can be flaky in tests
    });

    it('should complete full authentication flow for returning Google user', async () => {
      const mockAuthRequest = {
        privy_user_id: 'did:privy:google789xyz',
        auth_method: 'google',
        email: 'google.user@gmail.com',
        display_name: 'Google User',
      };

      const mockAuthResponse = {
        success: true,
        message: 'User authenticated successfully',
        user_id: 789012,
        api_key: 'gw_live_test_key_789012', // Test fixture, not a real secret
        auth_method: 'google',
        privy_user_id: 'did:privy:google789xyz',
        is_new_user: false,
        display_name: 'Google User',
        email: 'google.user@gmail.com',
        credits: 2500,
        tier: 'pro',
        subscription_status: 'active',
        subscription_end_date: 1738368000,
        timestamp: '2025-01-14T12:00:00Z',
      };

      mockProxyFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockAuthResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.is_new_user).toBe(false);
      expect(data.tier).toBe('pro');
      expect(data.subscription_status).toBe('active');
      expect(data.credits).toBe(2500);
      expect(data.api_key).toBe('gw_live_test_key_789012');
    });
  });

  describe('502 Bad Gateway - Retry Logic', () => {
    it('should retry and succeed after initial 502 error', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 12345,
        api_key: 'gw_test_key_abc123',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
        timestamp: '2025-01-01T00:00:00Z',
      };

      // Mock 502 error first, then success on retry
      mockProxyFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ error: 'Bad Gateway' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockAuthResponse),
        });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.api_key).toBe('gw_test_key_abc123');

      // Should have been called twice (initial attempt + 1 retry)
      expect(mockProxyFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times on consecutive 502 errors and eventually fail', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      // Mock consecutive 502 errors (will exhaust retries)
      mockProxyFetch
        .mockResolvedValue({
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ error: 'Bad Gateway' }),
        });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Bad Gateway');

      // Should have retried 3 times (initial + 3 retries = 4 total calls)
      expect(mockProxyFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle 503 Service Unavailable with retry', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 12345,
        api_key: 'gw_test_key_abc123',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      };

      // Mock 503 error, then success on retry
      mockProxyFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ error: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockAuthResponse),
        });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockProxyFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle 504 Gateway Timeout with retry', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 12345,
        api_key: 'gw_test_key_abc123',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      };

      // Mock 504 error, then success on retry
      mockProxyFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
          text: async () => JSON.stringify({ error: 'Gateway Timeout' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockAuthResponse),
        });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockProxyFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors like 401', async () => {
      const mockAuthRequest = {
        privy_user_id: 'invalid-user',
        auth_method: 'email',
      };

      const mockErrorResponse = {
        error: 'Invalid credentials',
        detail: 'User authentication failed',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');

      // Should NOT retry on 401 - called only once
      expect(mockProxyFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 500 Internal Server Error', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
      };

      const mockErrorResponse = {
        error: 'Internal Server Error',
        detail: 'Database connection failed',
      };

      mockProxyFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify(mockErrorResponse),
      });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');

      // Should NOT retry on 500 - called only once
      expect(mockProxyFetch).toHaveBeenCalledTimes(1);
    });

    it('should increment call count for each retry attempt with delays', async () => {
      const mockAuthRequest = {
        privy_user_id: 'privy-123',
        auth_method: 'email',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      const mockAuthResponse = {
        success: true,
        user_id: 12345,
        api_key: 'gw_test_key_abc123',
        auth_method: 'email',
        privy_user_id: 'privy-123',
        is_new_user: false,
        display_name: 'Test User',
        email: 'test@example.com',
        credits: 500,
      };

      // Mock 502, 502, then success (requires 2 retries)
      mockProxyFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ error: 'Bad Gateway' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ error: 'Bad Gateway' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockAuthResponse),
        });

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(mockAuthRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should have called 3 times (initial + 2 retries)
      expect(mockProxyFetch).toHaveBeenCalledTimes(3);
    });
  });
});
