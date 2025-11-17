import React from 'react';
import { render, screen } from '@testing-library/react';
import { PrivyProviderWrapper } from '../privy-provider';

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

// Mock RateLimitHandler
jest.mock('@/components/auth/rate-limit-handler', () => ({
  RateLimitHandler: () => null,
}));

describe('PrivyProviderWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__PRIVY_CONFIG__ = null;
    // Reset env
    delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Email Verification Configuration', () => {
    it('should enable email verification with verifyEmailOnSignup', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config).toBeDefined();
      expect(config.email).toBeDefined();
      expect(config.email.verifyEmailOnSignup).toBe(true);
    });

    it('should have email in loginMethods', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.loginMethods).toContain('email');
    });

    it('should verify email verification is not accidentally removed', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      // Regression test: ensure this doesn't become null, undefined, or false
      expect(config.email).not.toBeNull();
      expect(config.email).not.toBeUndefined();
      expect(config.email.verifyEmailOnSignup).not.toBe(false);
      expect(config.email.verifyEmailOnSignup).not.toBe(null);
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

  describe('External Wallets Configuration', () => {
    it('should disable solana external wallets', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(config.externalWallets).toBeDefined();
      expect(config.externalWallets.solana).toBeDefined();
      expect(config.externalWallets.solana.enabled).toBe(false);
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

    it('should have email verification config present', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      // This test prevents accidental removal of the email config object
      expect(config.email).toBeDefined();
      expect(typeof config.email).toBe('object');
      expect(Object.keys(config.email).length).toBeGreaterThan(0);
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
      expect(config.email).toBeDefined();
      expect(config.defaultChain).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('email verification setting should be boolean', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id-12345';

      render(
        <PrivyProviderWrapper>
          <div>Test Child</div>
        </PrivyProviderWrapper>
      );

      const config = (global as any).__PRIVY_CONFIG__;
      expect(typeof config.email.verifyEmailOnSignup).toBe('boolean');
    });

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
});
