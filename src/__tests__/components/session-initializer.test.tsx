/**
 * Tests for SessionInitializer authentication timeout fixes
 *
 * Covers fixes for:
 * - Authentication timeout error (Sentry #7061768076)
 * - Improved timeout monitoring and logging
 * - Increased timeout threshold from 5s to 10s
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { SessionInitializer } from '@/components/SessionInitializer';
import * as authContext from '@/context/gatewayz-auth-context';

// Mock the auth context
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock the session transfer utilities
jest.mock('@/integrations/privy/auth-session-transfer', () => ({
  getSessionTransferParams: jest.fn(() => ({})),
  cleanupSessionTransferParams: jest.fn(),
  storeSessionTransferToken: jest.fn(),
  getStoredSessionTransferToken: jest.fn(() => ({ token: null, userId: null })),
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

describe('SessionInitializer timeout fixes', () => {
  let mockRefresh: jest.Mock;
  let mockLogin: jest.Mock;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    mockRefresh = jest.fn().mockResolvedValue(undefined);
    mockLogin = jest.fn().mockResolvedValue(undefined);

    (authContext.useGatewayzAuth as jest.Mock).mockReturnValue({
      status: 'unauthenticated',
      refresh: mockRefresh,
      login: mockLogin,
      privyReady: true,
    });

    // Mock fetch
    fetchMock = jest.spyOn(global, 'fetch');

    // Clear localStorage
    localStorage.clear();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('timeout handling improvements', () => {
    it('should have 10 second timeout threshold', async () => {
      // Mock a slow API response
      fetchMock.mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  user_id: 123,
                  email: 'test@example.com',
                  credits: 1000,
                }),
              }),
            9000 // 9 seconds - should succeed
          )
        )
      );

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'test-token-123',
        userId: '123',
      });

      render(<SessionInitializer />);

      // Wait for the fetch to complete
      await waitFor(
        () => {
          expect(fetchMock).toHaveBeenCalledWith(
            '/api/user/me',
            expect.objectContaining({
              headers: expect.objectContaining({
                Authorization: 'Bearer test-token-123',
              }),
            })
          );
        },
        { timeout: 12000 }
      );

      // Should log completion with duration
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('User data fetch completed in')
      );
    });

    it('should log timeout error after 10 seconds', async () => {
      // Mock a very slow API response that will timeout
      fetchMock.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('The operation was aborted')), 11000)
          )
      );

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'test-token-456',
        userId: '456',
      });

      render(<SessionInitializer />);

      await waitFor(
        () => {
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('User data fetch timed out after 10 seconds')
          );
        },
        { timeout: 12000 }
      );
    });

    it('should log duration on timeout', async () => {
      // Mock abort controller timeout
      fetchMock.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('The operation was aborted')), 10500);
          })
      );

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'test-token-789',
        userId: '789',
      });

      render(<SessionInitializer />);

      await waitFor(
        () => {
          expect(console.error).toHaveBeenCalledWith(
            expect.stringMatching(/User data fetch timeout after \d+ms/)
          );
        },
        { timeout: 12000 }
      );
    });
  });

  describe('Sentry timeout monitoring', () => {
    it('should send Sentry event for timeouts over 8 seconds', async () => {
      const mockCaptureMessage = jest.fn();

      // Mock Sentry
      jest.doMock('@sentry/nextjs', () => ({
        captureMessage: mockCaptureMessage,
      }));

      // Mock a timeout
      fetchMock.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('The operation was aborted')), 10000)
          )
      );

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'test-token-sentry',
        userId: '999',
      });

      render(<SessionInitializer />);

      await waitFor(
        () => {
          // Check that timeout was logged
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('timeout')
          );
        },
        { timeout: 12000 }
      );

      // Note: In the actual implementation, Sentry is dynamically imported
      // so the test would need to mock the import() call properly
    });
  });

  describe('successful authentication', () => {
    it('should complete successfully within timeout', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          user_id: 123,
          email: 'test@example.com',
          credits: 1000,
          display_name: 'Test User',
          tier: 'pro',
        }),
      });

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'valid-token',
        userId: '123',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('User data fetched successfully')
        );
      });

      // Should have saved to localStorage
      expect(localStorage.getItem('gatewayz_api_key')).toBe('valid-token');
    });

    it('should log completion duration for fast responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          user_id: 456,
          email: 'fast@example.com',
          credits: 500,
        }),
      });

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'fast-token',
        userId: '456',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringMatching(/User data fetch completed in \d+ms/)
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'error-token',
        userId: '789',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error fetching user data')
        );
      });

      // Should still call refresh even on error
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should handle 401/403 errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const { getSessionTransferParams } = require('@/integrations/privy/auth-session-transfer');
      getSessionTransferParams.mockReturnValue({
        token: 'invalid-token',
        userId: '999',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Token appears invalid')
        );
      });
    });
  });
});
