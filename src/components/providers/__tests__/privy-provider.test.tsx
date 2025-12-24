import React from 'react';
import { render, screen } from '@testing-library/react';
import { PrivyProviderWrapper } from '../privy-provider';

const mockUsePathname = jest.fn(() => '/');
const mockUseSearchParams = jest.fn(() => ({
  toString: () => '',
}));
const mockIsVercelPreviewDeployment = jest.fn(() => false);
const mockBuildPreviewSafeRedirectUrl = jest.fn();

// Mock the dynamic import
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (...args: any[]) => {
    const dynamicModule = jest.requireActual('next/dynamic');
    const dynamicActualComp = dynamicModule.default;
    const RequiredComponent = dynamicActualComp(args[0]);
    RequiredComponent.preload ? RequiredComponent.preload() : RequiredComponent.render?.preload?.();
    return RequiredComponent;
  },
}));

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock Privy
jest.mock('@privy-io/react-auth', () => ({
  PrivyProvider: ({ children, config }: any) => {
    // Store config for testing
    (global as any).__PRIVY_CONFIG__ = config;
    return <div data-testid="privy-provider">{children}</div>;
  },
}));

// Mock the GatewayzAuthProvider
jest.mock('@/context/gatewayz-auth-context', () => ({
  GatewayzAuthProvider: ({ children }: any) => (
    <div data-testid="gatewayz-auth-provider">{children}</div>
  ),
}));

// Mock PreviewHostnameInterceptor
jest.mock('@/components/auth/preview-hostname-interceptor', () => ({
  PreviewHostnameInterceptor: () => null,
}));

jest.mock('@/lib/preview-hostname-handler', () => ({
  isVercelPreviewDeployment: () => mockIsVercelPreviewDeployment(),
}));

jest.mock('@/lib/preview-oauth-redirect', () => ({
  buildPreviewSafeRedirectUrl: (args: unknown) => mockBuildPreviewSafeRedirectUrl(args),
  DEFAULT_PREVIEW_REDIRECT_ORIGIN: 'https://beta.gatewayz.ai',
}));

// Mock RateLimitHandler
jest.mock('@/components/auth/rate-limit-handler', () => ({
  RateLimitHandler: () => null,
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
}));

const mockCanUseLocalStorage = jest.fn(() => true);
const mockWaitForLocalStorageAccess = jest.fn(() => Promise.resolve(true));

jest.mock('@/lib/safe-storage', () => ({
  canUseLocalStorage: () => mockCanUseLocalStorage(),
  waitForLocalStorageAccess: () => mockWaitForLocalStorageAccess(),
}));

describe('PrivyProviderWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__PRIVY_CONFIG__ = null;
    // Reset env
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    delete process.env.NEXT_PUBLIC_PRIVY_OAUTH_REDIRECT_ORIGIN;
    mockCanUseLocalStorage.mockReturnValue(true);
    mockWaitForLocalStorageAccess.mockResolvedValue(true);
    mockIsVercelPreviewDeployment.mockReturnValue(false);
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue({
      toString: () => '',
    });
    mockBuildPreviewSafeRedirectUrl.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Email Login Configuration', () => {
    it('should have email in loginMethods for verification code delivery', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      // Privy automatically handles email verification when email is in loginMethods
      expect(config.loginMethods).toContain('email');
    });

    it('should not have removed email from loginMethods', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      // Regression test: ensure email wasn't accidentally removed
      const hasEmail = config.loginMethods.includes('email');
      expect(hasEmail).toBe(true);
    });
  });

  describe('Login Methods Configuration', () => {
    it('should include email, google, and github login methods', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.loginMethods).toEqual(
        expect.arrayContaining(['email', 'google', 'github'])
      );
    });

    it('should have exactly 3 login methods', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.loginMethods).toHaveLength(3);
    });
  });

  describe('Appearance Configuration', () => {
    it('should have light theme', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.appearance.theme).toBe('light');
    });

    it('should have black accent color', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.appearance.accentColor).toBe('#000000');
    });

    it('should have logo configured', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.appearance.logo).toBe('/logo_black.svg');
    });
  });

    describe('Embedded Wallets Configuration', () => {
      it('should enable ethereum embedded wallets for users without wallets', () => {
        process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

        render(
          <PrivyProviderWrapper>
            <div>Test Child</div>
          </PrivyProviderWrapper>
        );

        const config = (global as any).__PRIVY_CONFIG__;
        expect(config.embeddedWallets).toBeDefined();
        expect(config.embeddedWallets.ethereum).toBeDefined();
        expect(config.embeddedWallets.ethereum.createOnLogin).toBe('users-without-wallets');
      });
    });

    describe('Storage Availability Guard', () => {
      it('should show warning when localStorage cannot be accessed', async () => {
        mockCanUseLocalStorage.mockReturnValue(false);
        mockWaitForLocalStorageAccess.mockResolvedValue(false);

        render(
          <PrivyProviderWrapper>
            <div>Test Child</div>
          </PrivyProviderWrapper>
        );

        expect(
          await screen.findByText('Browser storage is disabled')
        ).toBeInTheDocument();
      });
    });

  describe('Provider Structure', () => {
    it('should render PrivyProvider', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      expect(screen.getByTestId('privy-provider')).toBeInTheDocument();
    });

    it('should render GatewayzAuthProvider as child of PrivyProvider', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      expect(screen.getByTestId('gatewayz-auth-provider')).toBeInTheDocument();
    });

    it('should render children correctly', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child Content</div>
        </PrivyProviderWrapper>
      );

      expect(screen.getByText('Test Child Content')).toBeInTheDocument();
    });
  });

  describe('App ID Configuration', () => {
    it('should use NEXT_PUBLIC_PRIVY_APP_ID from environment', () => {
      const testAppId = 'clx123456789abcdef123';
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = testAppId;

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config).toBeDefined();
      // The appId is passed separately to PrivyProvider, not in config
      // Just verify config exists and is properly formed
      expect(config.loginMethods).toBeDefined();
    });

    it('should warn when NEXT_PUBLIC_PRIVY_APP_ID is not set', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'NEXT_PUBLIC_PRIVY_APP_ID is not set - authentication will not work'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Preview OAuth redirect override', () => {
    it('should not set customOAuthRedirectUrl outside preview deployments', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.customOAuthRedirectUrl).toBeUndefined();
      expect(mockBuildPreviewSafeRedirectUrl).not.toHaveBeenCalled();
    });

    it('should set preview-safe redirect when on Vercel preview host', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      mockIsVercelPreviewDeployment.mockReturnValue(true);
      mockUsePathname.mockReturnValue('/rankings');
      mockUseSearchParams.mockReturnValue({
        toString: () => 'tab=usage',
      });
      process.env.NEXT_PUBLIC_PRIVY_OAUTH_REDIRECT_ORIGIN = 'https://beta.gatewayz.ai';
      mockBuildPreviewSafeRedirectUrl.mockReturnValue('https://beta.gatewayz.ai/rankings?tab=usage#stats');

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.customOAuthRedirectUrl).toBe('https://beta.gatewayz.ai/rankings?tab=usage#stats');
      expect(mockBuildPreviewSafeRedirectUrl).toHaveBeenCalledTimes(1);
      expect(mockBuildPreviewSafeRedirectUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          targetOrigin: 'https://beta.gatewayz.ai',
        }),
      );
    });

    it('should fall back to default beta domain when env override is absent', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      mockIsVercelPreviewDeployment.mockReturnValue(true);
      mockUsePathname.mockReturnValue('/chat');
      mockUseSearchParams.mockReturnValue({
        toString: () => '',
      });
      mockBuildPreviewSafeRedirectUrl.mockReturnValue('https://beta.gatewayz.ai/chat');

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.customOAuthRedirectUrl).toBe('https://beta.gatewayz.ai/chat');
      expect(mockBuildPreviewSafeRedirectUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          targetOrigin: 'https://beta.gatewayz.ai',
        }),
      );
    });
  });

  describe('Regression Tests', () => {
    it('should not have removed email from loginMethods', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      // This test specifically prevents the issue where email was removed from loginMethods
      const hasEmail = config.loginMethods.includes('email');
      expect(hasEmail).toBe(true);
    });

    it('should maintain all required authentication settings', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;

      // Check all critical settings are present
      expect(config.loginMethods).toBeDefined();
      expect(config.appearance).toBeDefined();
      expect(config.embeddedWallets).toBeDefined();
      expect(config.defaultChain).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('loginMethods should be an array of strings', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(Array.isArray(config.loginMethods)).toBe(true);
      expect(config.loginMethods.every((m: any) => typeof m === 'string')).toBe(true);
    });
  });

  describe('Wallet Extension Error Handling', () => {
    it('should call preventDefault for wallet extension errors (chrome.runtime.sendMessage)', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with a wallet extension error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'Error: Could not establish connection. Receiving end does not exist. chrome.runtime.sendMessage' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] Wallet extension error detected'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should NOT call preventDefault for WalletConnect relay errors', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with a WalletConnect relay error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'WalletConnect relay connection failed' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      // WalletConnect relay errors should NOT call preventDefault (let Privy handle)
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] WalletConnect relay error detected'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should call preventDefault for runtime.sendMessage errors from extensions', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with a generic runtime.sendMessage error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'runtime.sendMessage error in content script' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should NOT call preventDefault for non-wallet errors', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with a generic error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'Some other unrelated error' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      // Generic errors should NOT have preventDefault called
      expect(preventDefaultSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    // Note: "Cannot redefine property: ethereum" errors are handled by ErrorSuppressor component
    // which is loaded earlier in the component tree (layout.tsx) to centralize error suppression
  });

  describe('Privy Wallet Creation Error Handling', () => {
    it('should call preventDefault for "User wallet creation failed" errors', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with wallet creation failed error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'User wallet creation failed' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      // User-initiated wallet creation cancellation should call preventDefault
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] User cancelled wallet creation'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should call preventDefault for unknown_embedded_wallet_error privyErrorCode', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with Privy error code
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { 
          message: 'Some wallet error',
          privyErrorCode: 'unknown_embedded_wallet_error'
        },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      // Privy error code unknown_embedded_wallet_error should call preventDefault
      expect(preventDefaultSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should NOT call preventDefault for iframe initialization errors', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      // Create a mock PromiseRejectionEvent with iframe error
      const mockEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(mockEvent, 'reason', {
        value: { message: 'iframe not initialized' },
        writable: false,
      });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');

      window.dispatchEvent(mockEvent);

      // Transient Privy errors should NOT call preventDefault - let Privy handle recovery
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] Privy iframe initialization error detected'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });
});
