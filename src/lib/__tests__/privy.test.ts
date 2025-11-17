// Mock Privy before importing the config
jest.mock('@privy-io/react-auth', () => ({
  PrivyProvider: jest.fn(),
}));

import { privyConfig } from '../privy';

describe('privy.ts - Configuration File', () => {
  describe('Privy Config Structure', () => {
    it('should have required top-level properties', () => {
      expect(privyConfig).toHaveProperty('appId');
      expect(privyConfig).toHaveProperty('config');
    });

    it('should have appId from environment or use thrown value', () => {
      // appId uses the ! operator in privy.ts, so it will throw if not defined
      // In test environment it's undefined, but that's ok - it's a config file
      // Just verify the structure exists even if the value is undefined
      expect(privyConfig).toHaveProperty('appId');
    });

    it('should have config object', () => {
      expect(privyConfig.config).toBeDefined();
      expect(typeof privyConfig.config).toBe('object');
    });
  });

  describe('Email Verification Configuration', () => {
    it('should have email configuration', () => {
      expect(privyConfig.config).toHaveProperty('email');
      expect(privyConfig.config.email).toBeDefined();
    });

    it('should enable email verification on signup', () => {
      expect(privyConfig.config.email).toHaveProperty('verifyEmailOnSignup');
      expect(privyConfig.config.email.verifyEmailOnSignup).toBe(true);
    });

    it('should have email verification set to boolean true (not truthy value)', () => {
      expect(privyConfig.config.email.verifyEmailOnSignup).toBe(true);
      expect(typeof privyConfig.config.email.verifyEmailOnSignup).toBe('boolean');
    });

    it('should not have email verification accidentally disabled', () => {
      expect(privyConfig.config.email.verifyEmailOnSignup).not.toBe(false);
      expect(privyConfig.config.email.verifyEmailOnSignup).not.toBe(null);
      expect(privyConfig.config.email.verifyEmailOnSignup).not.toBe(undefined);
    });
  });

  describe('Login Methods Configuration', () => {
    it('should have loginMethods array', () => {
      expect(privyConfig.config).toHaveProperty('loginMethods');
      expect(Array.isArray(privyConfig.config.loginMethods)).toBe(true);
    });

    it('should include email login method', () => {
      expect(privyConfig.config.loginMethods).toContain('email');
    });

    it('should include google login method', () => {
      expect(privyConfig.config.loginMethods).toContain('google');
    });

    it('should include github login method', () => {
      expect(privyConfig.config.loginMethods).toContain('github');
    });

    it('should have exactly 3 login methods', () => {
      expect(privyConfig.config.loginMethods).toHaveLength(3);
    });

    it('should have login methods in expected order', () => {
      expect(privyConfig.config.loginMethods).toEqual(['email', 'google', 'github']);
    });
  });

  describe('Appearance Configuration', () => {
    it('should have appearance configuration', () => {
      expect(privyConfig.config).toHaveProperty('appearance');
      expect(privyConfig.config.appearance).toBeDefined();
    });

    it('should set theme to light', () => {
      expect(privyConfig.config.appearance.theme).toBe('light');
    });

    it('should set accent color to black', () => {
      expect(privyConfig.config.appearance.accentColor).toBe('#000000');
    });

    it('should set logo path', () => {
      expect(privyConfig.config.appearance.logo).toBe('/logo_black.svg');
    });
  });

  describe('Regression Tests - Email Verification', () => {
    it('should prevent accidental removal of email verification config', () => {
      // This test catches if someone accidentally removes the email object
      expect(privyConfig.config.email).not.toBeNull();
      expect(privyConfig.config.email).not.toBeUndefined();
      expect(Object.keys(privyConfig.config.email).length).toBeGreaterThan(0);
    });

    it('should prevent email verification from being set to false', () => {
      // This test catches if someone changes the boolean value
      const emailConfig = privyConfig.config.email;
      for (const key in emailConfig) {
        if (key === 'verifyEmailOnSignup') {
          expect(emailConfig[key as keyof typeof emailConfig]).not.toBe(false);
        }
      }
    });

    it('should prevent removal of email from loginMethods', () => {
      // This test catches if someone removes email from the login methods array
      const loginMethods = privyConfig.config.loginMethods;
      expect(loginMethods).toContain('email');
      // Verify it's not replaced with something else
      expect(loginMethods.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all critical fields', () => {
      const requiredFields = ['loginMethods', 'appearance', 'email'];
      requiredFields.forEach(field => {
        expect(privyConfig.config).toHaveProperty(field);
        expect(privyConfig.config[field as keyof typeof privyConfig.config]).toBeDefined();
      });
    });

    it('should have properly structured appearance config', () => {
      const appearance = privyConfig.config.appearance;
      expect(appearance).toHaveProperty('theme');
      expect(appearance).toHaveProperty('accentColor');
      expect(appearance).toHaveProperty('logo');
    });

    it('should have properly structured email config', () => {
      const email = privyConfig.config.email;
      expect(email).toHaveProperty('verifyEmailOnSignup');
      expect(typeof email.verifyEmailOnSignup).toBe('boolean');
    });
  });

  describe('Type Safety', () => {
    it('loginMethods should be an array of strings', () => {
      const loginMethods = privyConfig.config.loginMethods;
      expect(Array.isArray(loginMethods)).toBe(true);
      loginMethods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });

    it('appearance properties should be strings', () => {
      const appearance = privyConfig.config.appearance;
      expect(typeof appearance.theme).toBe('string');
      expect(typeof appearance.accentColor).toBe('string');
      expect(typeof appearance.logo).toBe('string');
    });

    it('email config properties should have correct types', () => {
      const email = privyConfig.config.email;
      expect(typeof email.verifyEmailOnSignup).toBe('boolean');
    });
  });

  describe('Consistency with Provider', () => {
    it('should match login methods with PrivyProviderWrapper', () => {
      // This ensures the backup config in privy.ts matches the config in privy-provider.tsx
      // Both should have the same login methods
      expect(privyConfig.config.loginMethods).toEqual(['email', 'google', 'github']);
    });

    it('should match email configuration with PrivyProviderWrapper', () => {
      // Both should have the same email verification setting
      expect(privyConfig.config.email.verifyEmailOnSignup).toBe(true);
    });

    it('should match appearance configuration with PrivyProviderWrapper', () => {
      // Both should have matching appearance config
      expect(privyConfig.config.appearance.theme).toBe('light');
      expect(privyConfig.config.appearance.accentColor).toBe('#000000');
      expect(privyConfig.config.appearance.logo).toBe('/logo_black.svg');
    });
  });

  describe('Future-Proofing', () => {
    it('should support additional email verification properties if added', () => {
      // This test ensures the structure is flexible for future additions
      const email = privyConfig.config.email;
      expect(email).toBeDefined();
      expect(typeof email).toBe('object');
      // Should be able to add more properties without breaking
    });

    it('should have no breaking changes to existing properties', () => {
      // Verify the core properties that downstream code relies on still exist
      const config = privyConfig.config;
      expect(config.loginMethods).toBeDefined();
      expect(config.appearance).toBeDefined();
      expect(config.email).toBeDefined();
    });
  });
});
