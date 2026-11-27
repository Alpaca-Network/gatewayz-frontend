/**
 * @jest-environment node
 */
import { safeEqual, verifyBearerSecret, getConfiguredSecret } from '../secret-auth';

describe('secret-auth', () => {
  const originalEnv = process.env;
  // Built at runtime so no secret-looking literal lives in the repo
  const secret = ['unit', 'test', 'value', String(Date.now())].join('-');

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('safeEqual', () => {
    it('returns true for equal strings', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
    });

    it('returns false for different strings, including different lengths', () => {
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'abcd')).toBe(false);
      expect(safeEqual('', 'a')).toBe(false);
    });
  });

  describe('getConfiguredSecret', () => {
    it('returns null for unset or blank env', () => {
      delete process.env.TEST_SECRET_ENV;
      expect(getConfiguredSecret('TEST_SECRET_ENV')).toBeNull();
      process.env.TEST_SECRET_ENV = '   ';
      expect(getConfiguredSecret('TEST_SECRET_ENV')).toBeNull();
    });
  });

  describe('verifyBearerSecret', () => {
    it('fails closed with 503 when the secret is not configured', () => {
      delete process.env.TEST_SECRET_ENV;
      expect(verifyBearerSecret('Bearer anything', 'TEST_SECRET_ENV')).toEqual({
        ok: false,
        status: 503,
        error: 'Endpoint not configured',
      });
    });

    it('rejects the old hardcoded default when the secret is not configured', () => {
      delete process.env.TEST_SECRET_ENV;
      const result = verifyBearerSecret('Bearer default-secret-change-me', 'TEST_SECRET_ENV');
      expect(result.ok).toBe(false);
    });

    it('returns 401 for missing or wrong header', () => {
      process.env.TEST_SECRET_ENV = secret;
      expect(verifyBearerSecret(null, 'TEST_SECRET_ENV')).toMatchObject({ ok: false, status: 401 });
      expect(verifyBearerSecret('Bearer nope', 'TEST_SECRET_ENV')).toMatchObject({ ok: false, status: 401 });
      expect(verifyBearerSecret(secret, 'TEST_SECRET_ENV')).toMatchObject({ ok: false, status: 401 });
    });

    it('accepts the correct bearer secret', () => {
      process.env.TEST_SECRET_ENV = secret;
      expect(verifyBearerSecret(`Bearer ${secret}`, 'TEST_SECRET_ENV')).toEqual({ ok: true });
    });
  });
});
