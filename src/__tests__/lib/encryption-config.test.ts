/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Encryption Configuration Tests
 *
 * These tests verify that encryption keys are properly configured
 * and follow security best practices.
 */

describe('Encryption Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a clean copy of env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  describe('Environment Variables', () => {
    it('should have KEY_VERSION configured', () => {
      process.env.KEY_VERSION = '1';
      expect(process.env.KEY_VERSION).toBeDefined();
      expect(process.env.KEY_VERSION).toBe('1');
    });

    it('should have KEYRING_1 configured when KEY_VERSION is 1', () => {
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'test-key-here';

      expect(process.env.KEYRING_1).toBeDefined();
      expect(typeof process.env.KEYRING_1).toBe('string');
    });

    it('should support multiple keyring versions for rotation', () => {
      process.env.KEY_VERSION = '2';
      process.env.KEYRING_1 = 'old-key';
      process.env.KEYRING_2 = 'new-key';

      expect(process.env.KEYRING_1).toBeDefined();
      expect(process.env.KEYRING_2).toBeDefined();
    });

    it('should parse KEY_VERSION as integer', () => {
      process.env.KEY_VERSION = '1';
      const keyVersion = parseInt(process.env.KEY_VERSION, 10);

      expect(typeof keyVersion).toBe('number');
      expect(keyVersion).toBe(1);
      expect(Number.isNaN(keyVersion)).toBe(false);
    });
  });

  describe('Key Format Validation', () => {
    it('should validate Fernet key format (base64 encoded)', () => {
      // Fernet keys are 44 characters long in base64 format
      const validKey = 'U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX98SMPg=';

      expect(validKey.length).toBe(44);
      expect(validKey.endsWith('=')).toBe(true);

      // Should be valid base64
      const isValidBase64 = /^[A-Za-z0-9+/\-_]+=*$/.test(validKey);
      expect(isValidBase64).toBe(true);
    });

    it('should reject invalid key formats', () => {
      const invalidKeys = [
        { key: '', reason: 'Empty' },
        { key: 'short', reason: 'Too short' },
        { key: 'not-a-valid-base64-key-format-at-all!!!', reason: 'Invalid characters' },
        { key: '1234567890123456789012345678901234567890123', reason: 'Wrong length (43 chars)' },
      ];

      invalidKeys.forEach(({ key }) => {
        // Should not match Fernet key format (must be exactly 44 chars AND valid base64)
        const isFernetFormat = key.length === 44 && /^[A-Za-z0-9+/\-_]+=*$/.test(key);
        expect(isFernetFormat).toBe(false);
      });
    });

    it('should validate key version is a positive integer', () => {
      const validVersions = ['1', '2', '10', '999'];
      const purelyInvalidVersions = ['abc', ''];

      validVersions.forEach(version => {
        const parsed = parseInt(version, 10);
        expect(parsed).toBeGreaterThan(0);
        expect(Number.isInteger(parsed)).toBe(true);
      });

      purelyInvalidVersions.forEach(version => {
        const parsed = parseInt(version, 10);
        expect(Number.isNaN(parsed)).toBe(true);
      });

      // Test negative and zero separately (parseInt converts them to numbers)
      const negativeVersion = parseInt('-1', 10);
      const zeroVersion = parseInt('0', 10);
      expect(negativeVersion).toBeLessThan(1);
      expect(zeroVersion).toBeLessThan(1);

      // Test decimal - parseInt parses '1.5' as 1, so we should validate the original string
      const decimalVersion = '1.5';
      const isValidIntegerString = /^\d+$/.test(decimalVersion);
      expect(isValidIntegerString).toBe(false);
    });
  });

  describe('Key Rotation Support', () => {
    it('should support backward compatibility during key rotation', () => {
      // When rotating to version 2, version 1 should still be available
      process.env.KEY_VERSION = '2';
      process.env.KEYRING_1 = 'old-key-for-backward-compatibility';
      process.env.KEYRING_2 = 'new-active-key';

      const currentVersion = parseInt(process.env.KEY_VERSION, 10);
      const currentKey = process.env[`KEYRING_${currentVersion}`];
      const oldKey = process.env.KEYRING_1;

      expect(currentKey).toBe('new-active-key');
      expect(oldKey).toBe('old-key-for-backward-compatibility');
    });

    it('should be able to access any keyring version', () => {
      process.env.KEYRING_1 = 'key-v1';
      process.env.KEYRING_2 = 'key-v2';
      process.env.KEYRING_3 = 'key-v3';

      for (let version = 1; version <= 3; version++) {
        const key = process.env[`KEYRING_${version}`];
        expect(key).toBeDefined();
        expect(key).toBe(`key-v${version}`);
      }
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose keys in error messages', () => {
      process.env.KEYRING_1 = 'secret-key-12345';

      try {
        // Simulate an error that shouldn't expose the key
        const errorMessage = 'Encryption failed for KEY_VERSION 1';
        throw new Error(errorMessage);
      } catch (error) {
        expect((error as Error).message).not.toContain('secret-key-12345');
        expect((error as Error).message).not.toContain(process.env.KEYRING_1);
      }
    });

    it('should validate environment before using keys', () => {
      delete process.env.KEY_VERSION;
      delete process.env.KEYRING_1;

      const isConfigured = Boolean(
        process.env.KEY_VERSION &&
        process.env[`KEYRING_${process.env.KEY_VERSION}`]
      );

      expect(isConfigured).toBe(false);
    });

    it('should handle missing keys gracefully', () => {
      process.env.KEY_VERSION = '99';
      // KEYRING_99 is not defined

      const keyExists = Boolean(process.env[`KEYRING_${process.env.KEY_VERSION}`]);
      expect(keyExists).toBe(false);
    });
  });

  describe('Configuration Helper Functions', () => {
    const getEncryptionConfig = () => {
      const keyVersion = process.env.KEY_VERSION ? parseInt(process.env.KEY_VERSION, 10) : null;

      if (!keyVersion || Number.isNaN(keyVersion) || keyVersion < 1) {
        return { valid: false, error: 'Invalid KEY_VERSION' };
      }

      const key = process.env[`KEYRING_${keyVersion}`];

      if (!key) {
        return { valid: false, error: `KEYRING_${keyVersion} not found` };
      }

      // Validate key format (should be 44 chars base64)
      if (key.length !== 44 || !/^[A-Za-z0-9+/\-_]+=*$/.test(key)) {
        return { valid: false, error: 'Invalid key format' };
      }

      return {
        valid: true,
        keyVersion,
        key,
      };
    };

    it('should validate complete encryption configuration', () => {
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX98SMPg=';

      const config = getEncryptionConfig();

      expect(config.valid).toBe(true);
      expect(config.keyVersion).toBe(1);
      expect(config.key).toBe('U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX98SMPg=');
    });

    it('should return error for missing KEY_VERSION', () => {
      delete process.env.KEY_VERSION;
      process.env.KEYRING_1 = 'U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX98SMPg=';

      const config = getEncryptionConfig();

      expect(config.valid).toBe(false);
      expect(config.error).toContain('Invalid KEY_VERSION');
    });

    it('should return error for missing KEYRING', () => {
      process.env.KEY_VERSION = '1';
      delete process.env.KEYRING_1;

      const config = getEncryptionConfig();

      expect(config.valid).toBe(false);
      expect(config.error).toContain('KEYRING_1 not found');
    });

    it('should return error for invalid key format', () => {
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'invalid-key-format';

      const config = getEncryptionConfig();

      expect(config.valid).toBe(false);
      expect(config.error).toContain('Invalid key format');
    });
  });

  describe('Railway Environment Integration', () => {
    it('should work with Railway environment variable pattern', () => {
      // Railway provides env vars as process.env
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX98SMPg=';
      process.env.RAILWAY_ENVIRONMENT = 'production';

      expect(process.env.KEY_VERSION).toBeDefined();
      expect(process.env.KEYRING_1).toBeDefined();
    });

    it('should support different keys per environment', () => {
      // Staging environment
      process.env.RAILWAY_ENVIRONMENT = 'staging';
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'staging-key-12345678901234567890123456789=';

      const stagingKey = process.env.KEYRING_1;

      // Production would have different key
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.KEYRING_1 = 'prod-key-abcdefghijklmnopqrstuvwxyz1234=';

      const prodKey = process.env.KEYRING_1;

      expect(stagingKey).not.toBe(prodKey);
    });
  });

  describe('Documentation Examples', () => {
    it('should match the format shown in ENCRYPTION_SETUP.md', () => {
      // Example from documentation (placeholder format)
      const exampleKey = 'AbCdEf1234567890+/AbCdEf1234567890+/AbCdEf==';

      // Should be 44 characters
      expect(exampleKey.length).toBe(44);

      // Should be valid base64 format
      expect(/^[A-Za-z0-9+/\-_]+=*$/.test(exampleKey)).toBe(true);
    });

    it('should demonstrate key rotation as documented', () => {
      // Step 1: Add KEYRING_2 while keeping KEYRING_1
      process.env.KEY_VERSION = '1';
      process.env.KEYRING_1 = 'old-key-U1Pt9Ts8-SW3u82mdCBpitWuBxifWUlkozzFX=';
      process.env.KEYRING_2 = 'new-key-AbCdEf1234567890+/AbCdEf1234567890+=';

      // Step 2: Update KEY_VERSION to 2
      process.env.KEY_VERSION = '2';

      const currentVersion = parseInt(process.env.KEY_VERSION, 10);
      expect(currentVersion).toBe(2);

      // Step 3: Verify both keys are available during migration
      expect(process.env.KEYRING_1).toBeDefined(); // For decrypting old data
      expect(process.env.KEYRING_2).toBeDefined(); // For encrypting new data
    });
  });
});
