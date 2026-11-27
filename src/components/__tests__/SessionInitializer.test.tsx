import { render, waitFor } from '@testing-library/react';
import { SessionInitializer } from '../SessionInitializer';
import * as sessionTransfer from '@/integrations/privy/auth-session-transfer';
import * as api from '@/lib/api';
import * as transferCode from '@/integrations/privy/session-transfer-code';
import { useRouter } from 'next/navigation';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));

jest.mock('@/integrations/privy/auth-session-transfer', () => ({
  getSessionTransferParams: jest.fn(),
  cleanupSessionTransferParams: jest.fn(),
  storeSessionTransferToken: jest.fn(),
  getStoredSessionTransferToken: jest.fn(),
  clearSessionTransferToken: jest.fn(),
}));

jest.mock('@/integrations/privy/session-transfer-code', () => ({
  getSessionTransferCode: jest.fn(),
  redeemSessionTransferCode: jest.fn(),
  confirmAccountSwitch: jest.fn(),
  accountLabel: jest.requireActual('@/integrations/privy/session-transfer-code').accountLabel,
}));

jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
  saveApiKey: jest.fn(),
  saveUserData: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('SessionInitializer', () => {
  let mockRouter: { push: jest.Mock };
  let mockAuthContext: {
    status: string;
    refresh: jest.Mock;
    login: jest.Mock;
    privyReady: boolean;
  };

  beforeEach(() => {
    // Reset ALL mocks including their implementations and return values
    jest.resetAllMocks();

    // Reset fetch mock completely
    (global.fetch as jest.Mock).mockReset();
    // Set a default that will cause tests to fail if they don't set up fetch
    (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch not mocked in test'));

    // Clear SessionInitializer cache for tests
    if (typeof (window as any).__clearSessionInitializerCache === 'function') {
      (window as any).__clearSessionInitializerCache();
    }

    // Setup router mock
    mockRouter = {
      push: jest.fn(),
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Setup auth context mock
    mockAuthContext = {
      status: 'unauthenticated',
      refresh: jest.fn().mockResolvedValue(undefined),
      login: jest.fn().mockResolvedValue(undefined),
      privyReady: true,
    };
    (useGatewayzAuth as jest.Mock).mockReturnValue(mockAuthContext);

    // Default mock implementations
    (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
      token: null,
      userId: null,
      returnUrl: null,
      action: null,
    });

    (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
      token: null,
      userId: null,
    });

    // No ?code= by default; account-switch prompts are accepted unless a test says otherwise
    (transferCode.getSessionTransferCode as jest.Mock).mockReturnValue(null);
    (transferCode.confirmAccountSwitch as jest.Mock).mockReturnValue(true);
    (api.getUserData as jest.Mock).mockReturnValue(null);
  });

  // Earlier tests replace window.localStorage; give each test a real-ish one.
  function setStorage(values: Record<string, string> = {}) {
    const store = new Map(Object.entries(values));
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k) : null),
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
      writable: true,
      configurable: true,
    });
  }

  const redeemed = {
    api_key: 'gw_live_redeemed_key',
    user_id: 77,
    privy_user_id: 'did:privy:y',
    email: 'y@example.com',
    display_name: 'Y',
  };
  const profile = {
    user_id: 77,
    email: 'y@example.com',
    display_name: 'Y',
    credits: 5,
    tier: 'Pro',
  };

  /** A valid ?code= that redeems to `redeemed`, with its profile fetch succeeding. */
  function mockCodeTransfer() {
    setStorage();
    (transferCode.getSessionTransferCode as jest.Mock).mockReturnValue('one-time-code');
    (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
      status: 'ok',
      session: redeemed,
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });
  }

  describe('Legacy ?token=&userId= params are ignored', () => {
    const SECRET_TOKEN = 'gw_live_legacy_secret_token';

    beforeEach(() => {
      window.history.replaceState(
        { keep: true },
        '',
        `/chat?token=${SECRET_TOKEN}&userId=5&returnUrl=%2Fsettings&ref=x#top`
      );
      // The helper still reports what is in the URL; the component must ignore it
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: SECRET_TOKEN,
        userId: '5',
        returnUrl: '/settings',
        action: null,
      });
    });

    afterEach(() => {
      window.history.replaceState(null, '', '/');
    });

    it('strips token and userId from the URL, keeps the rest, and never uses them', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      const log = jest.spyOn(console, 'log').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(window.location.search).toBe('?returnUrl=%2Fsettings&ref=x');
      });
      expect(window.location.pathname).toBe('/chat');
      expect(window.location.hash).toBe('#top');
      expect(window.history.state).toEqual({ keep: true });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[SessionInit] Ignored legacy session-transfer params'),
        'token, userId'
      );
      const logged = JSON.stringify([...warn.mock.calls, ...log.mock.calls]);
      expect(logged).not.toContain(SECRET_TOKEN);

      // Give the async init a chance to run, then check nothing was stored or fetched
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(global.fetch).not.toHaveBeenCalled();
      expect(api.saveApiKey).not.toHaveBeenCalled();
      expect(api.saveUserData).not.toHaveBeenCalled();
      expect(sessionTransfer.storeSessionTransferToken).not.toHaveBeenCalled();
      expect(transferCode.confirmAccountSwitch).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();

      warn.mockRestore();
      log.mockRestore();
    });

    it('strips them even while waiting for Privy', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      mockAuthContext.privyReady = false;
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: SECRET_TOKEN,
        userId: '5',
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(window.location.search).toBe('?returnUrl=%2Fsettings&ref=x');
      });
      expect(api.saveApiKey).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn when the URL has no legacy params', async () => {
      window.history.replaceState(null, '', '/chat?ref=x');
      const warn = jest.spyOn(console, 'warn').mockImplementation();

      render(<SessionInitializer />);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(window.location.search).toBe('?ref=x');
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Ignored legacy session-transfer params'),
        expect.anything()
      );
      warn.mockRestore();
    });

    it('never restores a transfer token left in sessionStorage', async () => {
      window.history.replaceState(null, '', '/');
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });
      (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
        token: 'stored-token',
        userId: '12345',
      });

      render(<SessionInitializer />);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(sessionTransfer.getStoredSessionTransferToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(api.saveApiKey).not.toHaveBeenCalled();
    });
  });

  describe('Action Parameter Handling', () => {
    it('should trigger login when action parameter is present and user is unauthenticated', async () => {
      mockAuthContext.status = 'unauthenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });

      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();
    });

    it('should handle freetrial action', async () => {
      mockAuthContext.status = 'unauthenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'freetrial',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });

      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();
    });

    it('should NOT trigger login when action is present but user is authenticated', async () => {
      mockAuthContext.status = 'authenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).not.toHaveBeenCalled();
      });
    });

    it('should wait for Privy to be ready before processing action', async () => {
      mockAuthContext.status = 'unauthenticated';
      mockAuthContext.privyReady = false; // Privy not ready yet

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'freetrial',
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Privy not ready yet')
        );
      });

      expect(mockAuthContext.login).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should trigger login once status transitions from idle to unauthenticated', async () => {
      mockAuthContext.status = 'idle';
      mockAuthContext.privyReady = true;

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      const { rerender } = render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).not.toHaveBeenCalled();
      });

      mockAuthContext.status = 'unauthenticated';
      rerender(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should do nothing when already authenticated and no params', async () => {
      mockAuthContext.status = 'authenticated';

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: null,
      });

      (sessionTransfer.getStoredSessionTransferToken as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockAuthContext.refresh).not.toHaveBeenCalled();
      });
    });

    it('should handle missing token but present userId', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: '12345',
        returnUrl: null,
        action: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(sessionTransfer.storeSessionTransferToken).not.toHaveBeenCalled();
        expect(api.saveApiKey).not.toHaveBeenCalled();
      });
    });

    it('should handle missing userId but present token', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: 'test-token',
        userId: null,
        returnUrl: null,
        action: null,
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(sessionTransfer.storeSessionTransferToken).not.toHaveBeenCalled();
        expect(api.saveApiKey).not.toHaveBeenCalled();
      });
    });

    it('should catch and log errors during initialization', async () => {
      const mockError = new Error('Initialization error');

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Error initializing session:'),
          mockError
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('should only run initialization once on mount', async () => {
      mockCodeTransfer();

      const { rerender } = render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledTimes(1);
      });

      // Rerender component
      rerender(<SessionInitializer />);

      // Should not trigger additional calls
      expect(api.saveApiKey).toHaveBeenCalledTimes(1);
      expect(transferCode.redeemSessionTransferCode).toHaveBeenCalledTimes(1);
    });

    it('should render null (no UI)', () => {
      const { container } = render(<SessionInitializer />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle localStorage.getItem throwing exception', async () => {
      mockCodeTransfer();
      const originalGetItem = window.localStorage.getItem;
      window.localStorage.getItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key');
      });
      expect(mockAuthContext.refresh).toHaveBeenCalledWith();

      window.localStorage.getItem = originalGetItem;
    });

    it('should handle saveUserData throwing exception gracefully', async () => {
      mockCodeTransfer();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (api.saveUserData as jest.Mock).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        // API key should still be saved
        expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key');
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Failed to save user data'),
          expect.any(Error)
        );
      });

      expect(mockAuthContext.refresh).toHaveBeenCalledWith();

      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple consecutive initialization attempts', async () => {
      mockCodeTransfer();

      const { rerender } = render(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledTimes(1);
      });

      // Rapid rerenders shouldn't cause multiple initializations
      rerender(<SessionInitializer />);
      rerender(<SessionInitializer />);
      rerender(<SessionInitializer />);

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle getSessionTransferParams throwing exception', async () => {
      const mockError = new Error('getSessionTransferParams failed');

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Error checking session transfer params'),
          mockError
        );
      });

      // Should not attempt to save anything
      expect(api.saveApiKey).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should continue despite cleanupSessionTransferParams throwing exception', async () => {
      mockCodeTransfer();

      (sessionTransfer.cleanupSessionTransferParams as jest.Mock).mockImplementation(() => {
        throw new Error('History API not available');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SessionInit] Warning: Failed to cleanup session transfer params'),
          expect.any(Error)
        );
      });

      await waitFor(() => {
        expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key');
      });

      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Privy Readiness and Action Parameters', () => {
    it('should wait for Privy to be ready and then process action', async () => {
      mockAuthContext.status = 'unauthenticated';
      mockAuthContext.privyReady = false;

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      const { rerender } = render(<SessionInitializer />);

      // Action should not be processed yet
      expect(mockAuthContext.login).not.toHaveBeenCalled();

      // Now Privy becomes ready
      mockAuthContext.privyReady = true;
      rerender(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });
    });

    it('should not process action if already authenticated', async () => {
      mockAuthContext.status = 'authenticated';
      mockAuthContext.privyReady = true;

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'signin',
      });

      render(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).not.toHaveBeenCalled();
      });
    });

    it('should process action only once even with multiple Privy ready changes', async () => {
      mockAuthContext.status = 'unauthenticated';
      let privyReady = false;

      const getMockContext = () => ({
        ...mockAuthContext,
        privyReady,
      });

      (useGatewayzAuth as jest.Mock).mockImplementation(() => getMockContext());

      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: null,
        action: 'freetrial',
      });

      const { rerender } = render(<SessionInitializer />);

      // Privy becomes ready
      privyReady = true;
      rerender(<SessionInitializer />);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalledTimes(1);
      });

      // Privy ready changes again (shouldn't trigger another login)
      rerender(<SessionInitializer />);

      // Should still be called only once
      expect(mockAuthContext.login).toHaveBeenCalledTimes(1);
    });
  });

  describe('One-time transfer code (?code=)', () => {
    beforeEach(() => {
      setStorage();
      (transferCode.getSessionTransferCode as jest.Mock).mockReturnValue('one-time-code');
    });

    it('strips the code before redeeming, then stores the session', async () => {
      const order: string[] = [];
      (sessionTransfer.cleanupSessionTransferParams as jest.Mock).mockImplementation(() => {
        order.push('cleanup');
      });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockImplementation(async () => {
        order.push('redeem');
        return { status: 'ok', session: redeemed };
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key'));
      expect(order).toEqual(['cleanup', 'redeem']);
      expect(transferCode.redeemSessionTransferCode).toHaveBeenCalledWith('one-time-code');
      expect(api.saveUserData).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 77, api_key: 'gw_live_redeemed_key', tier: 'pro' })
      );
      // No one is signed in yet: no prompt needed
      expect(transferCode.confirmAccountSwitch).not.toHaveBeenCalled();
      expect(mockAuthContext.refresh).toHaveBeenCalled();
    });

    it('asks before switching away from a different signed-in user', async () => {
      setStorage({ gatewayz_api_key: 'gw_live_existing' });
      (api.getUserData as jest.Mock).mockReturnValue({ user_id: 1, email: 'x@example.com' });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (transferCode.confirmAccountSwitch as jest.Mock).mockReturnValue(false);

      render(<SessionInitializer />);

      await waitFor(() => expect(transferCode.confirmAccountSwitch).toHaveBeenCalled());
      expect((transferCode.confirmAccountSwitch as jest.Mock).mock.calls[0][0]).toBe(
        "You're signed in as x@example.com. Switch to y@example.com?"
      );
      await waitFor(() => expect(mockAuthContext.refresh).toHaveBeenCalled());
      expect(api.saveApiKey).not.toHaveBeenCalled();
      expect(api.saveUserData).not.toHaveBeenCalled();
    });

    it('switches when the person confirms', async () => {
      setStorage({ gatewayz_api_key: 'gw_live_existing' });
      (api.getUserData as jest.Mock).mockReturnValue({ user_id: 1, email: 'x@example.com' });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key'));
      expect(transferCode.confirmAccountSwitch).toHaveBeenCalledTimes(1);
    });

    it('does not ask when already signed in as the same user', async () => {
      setStorage({ gatewayz_api_key: 'gw_live_other_key_same_user' });
      (api.getUserData as jest.Mock).mockReturnValue({ user_id: 77, email: 'y@example.com' });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(api.saveApiKey).toHaveBeenCalled());
      expect(transferCode.confirmAccountSwitch).not.toHaveBeenCalled();
    });

    it.each(['invalid', 'unavailable'])('keeps the current state when redeem is %s', async (status) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({ status });

      render(<SessionInitializer />);

      await waitFor(() => expect(mockAuthContext.refresh).toHaveBeenCalled());
      expect(sessionTransfer.cleanupSessionTransferParams).toHaveBeenCalled();
      expect(api.saveApiKey).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('rejects a redeemed key whose profile belongs to someone else', async () => {
      const err = jest.spyOn(console, 'error').mockImplementation();
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: { ...redeemed, api_key: 'gw_live_mismatch_key' },
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ...profile, user_id: 999 }),
      });

      render(<SessionInitializer />);

      await waitFor(() => expect(mockAuthContext.refresh).toHaveBeenCalled());
      expect(api.saveApiKey).not.toHaveBeenCalled();
      err.mockRestore();
    });

    it('redirects to a same-origin returnUrl after redeeming', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: '/dashboard',
        action: null,
      });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/dashboard'));
    });

    it('does not redirect to an off-site returnUrl', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: null,
        userId: null,
        returnUrl: '//evil.example.com/phish',
        action: null,
      });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(api.saveApiKey).toHaveBeenCalled());
      await waitFor(() => expect(mockAuthContext.refresh).toHaveBeenCalled());
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('prefers the code over legacy token params', async () => {
      (sessionTransfer.getSessionTransferParams as jest.Mock).mockReturnValue({
        token: 'legacy-token',
        userId: '5',
        returnUrl: null,
        action: null,
      });
      (transferCode.redeemSessionTransferCode as jest.Mock).mockResolvedValue({
        status: 'ok',
        session: redeemed,
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => profile });

      render(<SessionInitializer />);

      await waitFor(() => expect(api.saveApiKey).toHaveBeenCalledWith('gw_live_redeemed_key'));
      expect(api.saveApiKey).not.toHaveBeenCalledWith('legacy-token');
    });
  });
});
