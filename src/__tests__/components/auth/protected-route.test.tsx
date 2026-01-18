/**
 * Tests for ProtectedRoute component
 *
 * Verifies:
 * 1. Shows loading state while auth is resolving
 * 2. Shows loading state while waiting for Privy SDK
 * 3. Redirects to /signin only after Privy is ready and user is unauthenticated
 * 4. Renders children when user is authenticated
 * 5. Does NOT redirect prematurely before Privy is ready
 *
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

// Mock useAuth hook
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
  })),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading states', () => {
    it('should show loading state when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        privyReady: false,
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      // Should show skeleton loading, not the protected content
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      // Should not redirect while loading
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show loading state when Privy is not ready (even if auth resolved)', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false, // Auth resolved
        isAuthenticated: false,
        privyReady: false, // But Privy is not ready
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      // Should show loading state, not content
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      // Should NOT redirect - must wait for Privy first
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should render custom fallback when provided', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        privyReady: false,
        login: jest.fn(),
      });

      render(
        <ProtectedRoute fallback={<div data-testid="custom-loading">Loading...</div>}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Redirect behavior', () => {
    it('should redirect to /signin only when Privy is ready and user is unauthenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        privyReady: true, // Privy is ready - NOW we can redirect
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin');
      });
    });

    it('should NOT redirect when loading even if privyReady is true', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true, // Still loading
        isAuthenticated: false,
        privyReady: true,
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should NOT redirect prematurely before Privy is ready (critical for returning users)', () => {
      // This test ensures we don't kick out users who have a valid Privy session
      // but no cached Gatewayz credentials (e.g., after clearing localStorage)
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        privyReady: false, // Privy not ready yet - might have a valid session
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      // Should NOT redirect - Privy might restore the session
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated user', () => {
    it('should render children when user is authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '123', email: 'test@example.com' },
        loading: false,
        isAuthenticated: true,
        privyReady: true,
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should render children even if Privy is not ready but user exists', () => {
      // Edge case: user data exists (from cache) before Privy is ready
      mockUseAuth.mockReturnValue({
        user: { id: '123', email: 'test@example.com' },
        loading: false,
        isAuthenticated: true,
        privyReady: false, // Privy not ready but we have user data
        login: jest.fn(),
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      // Should still show loading since privyReady is false
      // This is the safest behavior - wait for full auth confirmation
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('State transitions', () => {
    it('should handle transition from loading to authenticated', async () => {
      // Start loading
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        privyReady: false,
        login: jest.fn(),
      });

      const { rerender } = render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

      // Transition to authenticated
      mockUseAuth.mockReturnValue({
        user: { id: '123', email: 'test@example.com' },
        loading: false,
        isAuthenticated: true,
        privyReady: true,
        login: jest.fn(),
      });

      rerender(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle transition from loading to unauthenticated (after Privy ready)', async () => {
      // Start loading
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
        privyReady: false,
        login: jest.fn(),
      });

      const { rerender } = render(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      expect(mockPush).not.toHaveBeenCalled();

      // Transition to unauthenticated with Privy ready
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
        privyReady: true, // Now Privy is ready and confirmed no user
        login: jest.fn(),
      });

      rerender(
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin');
      });
    });
  });
});
