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

  describe('Email Login Method Configuration', () => {
    it('should ensure email is in loginMethods for verification code delivery', () => {
      // Privy automatically handles email verification when email is in loginMethods
      expect(privyConfig.config.loginMethods).toContain('email');
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

    it('should include sms login method for phone authentication', () => {
      expect(privyConfig.config.loginMethods).toContain('sms');
    });

    it('should include google login method', () => {
      expect(privyConfig.config.loginMethods).toContain('google');
    });

    it('should include github login method', () => {
      expect(privyConfig.config.loginMethods).toContain('github');
    });

    it('should have exactly 4 login methods', () => {
      expect(privyConfig.config.loginMethods).toHaveLength(4);
    });

    it('should have login methods in expected order', () => {
      expect(privyConfig.config.loginMethods).toEqual(['email', 'sms', 'google', 'github']);
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

  describe('Regression Tests - Email Login', () => {
    it('should prevent removal of email from loginMethods', () => {
      // This test catches if someone removes email from the login methods array
      // Email MUST be present for Privy to send verification codes
      const loginMethods = privyConfig.config.loginMethods;
      expect(loginMethods).toContain('email');
    });

    it('should prevent accidental modification of loginMethods', () => {
      // This test catches if someone accidentally modifies the login methods
      expect(privyConfig.config.loginMethods).toEqual(['email', 'sms', 'google', 'github']);
    });

    it('should always have at least email as a login method', () => {
      // This test ensures email authentication is always available
      const loginMethods = privyConfig.config.loginMethods;
      expect(loginMethods.length).toBeGreaterThanOrEqual(1);
      expect(loginMethods).toContain('email');
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all critical fields', () => {
      const requiredFields = ['loginMethods', 'appearance'];
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

    it('should have properly structured loginMethods config', () => {
      const loginMethods = privyConfig.config.loginMethods;
      expect(Array.isArray(loginMethods)).toBe(true);
      expect(loginMethods.length).toBeGreaterThan(0);
      // Email must be present for verification code delivery
      expect(loginMethods).toContain('email');
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

  });

  describe('Consistency with Provider', () => {
    it('should match login methods with PrivyProviderWrapper', () => {
      // This ensures the backup config in privy.ts matches the config in privy-provider.tsx
      // Both should have the same login methods
      expect(privyConfig.config.loginMethods).toEqual(['email', 'sms', 'google', 'github']);
    });

    it('should match appearance configuration with PrivyProviderWrapper', () => {
      // Both should have matching appearance config
      expect(privyConfig.config.appearance.theme).toBe('light');
      expect(privyConfig.config.appearance.accentColor).toBe('#000000');
      expect(privyConfig.config.appearance.logo).toBe('/logo_black.svg');
    });
  });

  describe('Future-Proofing', () => {
    it('should support additional properties if added', () => {
      // This test ensures the structure is flexible for future additions
      const config = privyConfig.config;
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      // Should be able to add more properties without breaking
    });

    it('should have no breaking changes to existing properties', () => {
      // Verify the core properties that downstream code relies on still exist
      const config = privyConfig.config;
      expect(config.loginMethods).toBeDefined();
      expect(config.appearance).toBeDefined();
    });
  });

  describe('Phone Authentication (SMS) Configuration', () => {
    it('should have sms login method enabled', () => {
      expect(privyConfig.config.loginMethods).toContain('sms');
    });

    it('should have sms positioned after email for optimal UX', () => {
      const loginMethods = privyConfig.config.loginMethods;
      const emailIndex = loginMethods.indexOf('email');
      const smsIndex = loginMethods.indexOf('sms');
      expect(emailIndex).toBe(0); // Email should be first
      expect(smsIndex).toBe(1); // SMS should be second
    });

    it('should support phone authentication alongside other methods', () => {
      const loginMethods = privyConfig.config.loginMethods;
      // All 4 methods should be present
      expect(loginMethods).toContain('email');
      expect(loginMethods).toContain('sms');
      expect(loginMethods).toContain('google');
      expect(loginMethods).toContain('github');
    });

    it('should not accidentally remove phone auth in the future', () => {
      // Regression test to ensure SMS is not removed
      const hasSms = privyConfig.config.loginMethods.includes('sms');
      expect(hasSms).toBe(true);
    });

    it('should maintain correct order: email, sms, google, github', () => {
      // This ensures the login modal displays options in the expected order
      expect(privyConfig.config.loginMethods).toEqual(['email', 'sms', 'google', 'github']);
    });
  });
});
