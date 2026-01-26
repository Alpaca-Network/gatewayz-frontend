/**
 * Next.js Config Security Headers Tests
 *
 * Tests to verify that the security headers configuration in next.config.ts
 * correctly sets frame protection headers based on route.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Import the next config to test
// Note: We need to mock the environment first
const originalEnv = process.env.NEXT_STATIC_EXPORT;

// Type definitions for Next.js headers configuration
type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };
type NextConfigWithHeaders = { headers?: () => Promise<HeaderRule[]> | HeaderRule[] };

describe('Next.js Config Security Headers', () => {
  let nextConfig: NextConfigWithHeaders;
  let headersConfig: HeaderRule[];

  beforeAll(async () => {
    // Ensure we're not in static export mode
    delete process.env.NEXT_STATIC_EXPORT;

    // Clear the module cache to get fresh config
    jest.resetModules();

    // Import the config
    const configModule = await import('../../../next.config');
    nextConfig = configModule.default;

    // Get the headers configuration
    if (typeof nextConfig.headers === 'function') {
      headersConfig = await nextConfig.headers();
    } else {
      headersConfig = [];
    }
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.NEXT_STATIC_EXPORT = originalEnv;
    }
  });

  describe('headers configuration', () => {
    it('should have headers function defined', () => {
      expect(nextConfig.headers).toBeDefined();
      expect(typeof nextConfig.headers).toBe('function');
    });

    it('should return an array of header rules', () => {
      expect(Array.isArray(headersConfig)).toBe(true);
      expect(headersConfig.length).toBeGreaterThan(0);
    });
  });

  describe('common security headers', () => {
    it('should include Strict-Transport-Security on all routes', () => {
      const rootRule = headersConfig.find(rule => rule.source === '/');
      expect(rootRule).toBeDefined();

      const hstsHeader = rootRule.headers.find(
        (h: { key: string }) => h.key === 'Strict-Transport-Security'
      );
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader.value).toContain('max-age=31536000');
    });

    it('should include X-Content-Type-Options on all routes', () => {
      const rootRule = headersConfig.find(rule => rule.source === '/');
      const header = rootRule.headers.find(
        (h: { key: string }) => h.key === 'X-Content-Type-Options'
      );
      expect(header).toBeDefined();
      expect(header.value).toBe('nosniff');
    });

    it('should include X-XSS-Protection on all routes', () => {
      const rootRule = headersConfig.find(rule => rule.source === '/');
      const header = rootRule.headers.find(
        (h: { key: string }) => h.key === 'X-XSS-Protection'
      );
      expect(header).toBeDefined();
      expect(header.value).toBe('1; mode=block');
    });
  });

  describe('frame protection headers', () => {
    describe('root path (/)', () => {
      it('should have X-Frame-Options: DENY', () => {
        const rootRule = headersConfig.find(rule => rule.source === '/');
        const header = rootRule.headers.find(
          (h: { key: string }) => h.key === 'X-Frame-Options'
        );
        expect(header).toBeDefined();
        expect(header.value).toBe('DENY');
      });

      it('should have frame-ancestors: none in CSP', () => {
        const rootRule = headersConfig.find(rule => rule.source === '/');
        const cspHeader = rootRule.headers.find(
          (h: { key: string }) => h.key === 'Content-Security-Policy'
        );
        expect(cspHeader).toBeDefined();
        expect(cspHeader.value).toContain("frame-ancestors 'none'");
      });
    });

    describe('wildcard path (/:path*)', () => {
      it('should have X-Frame-Options: DENY', () => {
        const wildcardRule = headersConfig.find(rule => rule.source === '/:path*');
        const header = wildcardRule.headers.find(
          (h: { key: string }) => h.key === 'X-Frame-Options'
        );
        expect(header).toBeDefined();
        expect(header.value).toBe('DENY');
      });
    });

    describe('/agent path (allows embedding)', () => {
      it('should exist in headers config', () => {
        const agentRule = headersConfig.find(rule => rule.source === '/agent');
        expect(agentRule).toBeDefined();
      });

      it('should NOT have X-Frame-Options header', () => {
        const agentRule = headersConfig.find(rule => rule.source === '/agent');
        const header = agentRule.headers.find(
          (h: { key: string }) => h.key === 'X-Frame-Options'
        );
        expect(header).toBeUndefined();
      });

      it('should NOT have frame-ancestors CSP', () => {
        const agentRule = headersConfig.find(rule => rule.source === '/agent');
        const cspHeader = agentRule.headers.find(
          (h: { key: string }) => h.key === 'Content-Security-Policy'
        );
        // Either no CSP header or no frame-ancestors in CSP
        if (cspHeader) {
          expect(cspHeader.value).not.toContain('frame-ancestors');
        }
      });

      it('should still have common security headers', () => {
        const agentRule = headersConfig.find(rule => rule.source === '/agent');
        const hstsHeader = agentRule.headers.find(
          (h: { key: string }) => h.key === 'Strict-Transport-Security'
        );
        expect(hstsHeader).toBeDefined();
      });
    });

    describe('/inbox path (allows embedding from trusted origins)', () => {
      it('should exist in headers config', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        expect(inboxRule).toBeDefined();
      });

      it('should NOT have X-Frame-Options header (not compatible with multiple origins)', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        const header = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'X-Frame-Options'
        );
        expect(header).toBeUndefined();
      });

      it('should have CSP with frame-ancestors for trusted GatewayZ origins', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        const cspHeader = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'Content-Security-Policy'
        );
        expect(cspHeader).toBeDefined();
        expect(cspHeader.value).toContain('frame-ancestors');
        expect(cspHeader.value).toContain("'self'");
        expect(cspHeader.value).toContain('https://beta.gatewayz.ai');
        expect(cspHeader.value).toContain('https://gatewayz.ai');
        expect(cspHeader.value).toContain('https://www.gatewayz.ai');
      });

      it('should allow embedding from inbox.gatewayz.ai (terragon-oss)', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        const cspHeader = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'Content-Security-Policy'
        );
        expect(cspHeader.value).toContain('https://inbox.gatewayz.ai');
      });

      it('should NOT allow embedding from arbitrary origins', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        const cspHeader = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'Content-Security-Policy'
        );
        // Should not have wildcard or 'none' (which would be too permissive or too restrictive)
        expect(cspHeader.value).not.toContain("frame-ancestors *");
        expect(cspHeader.value).not.toContain("frame-ancestors 'none'");
      });

      it('should still have common security headers', () => {
        const inboxRule = headersConfig.find(rule => rule.source === '/inbox');
        const hstsHeader = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'Strict-Transport-Security'
        );
        expect(hstsHeader).toBeDefined();

        const xContentType = inboxRule.headers.find(
          (h: { key: string }) => h.key === 'X-Content-Type-Options'
        );
        expect(xContentType).toBeDefined();
      });
    });
  });

  describe('header rule ordering', () => {
    it('should have /agent after /:path* to override it', () => {
      const pathWildcardIndex = headersConfig.findIndex(rule => rule.source === '/:path*');
      const agentIndex = headersConfig.findIndex(rule => rule.source === '/agent');
      expect(agentIndex).toBeGreaterThan(pathWildcardIndex);
    });

    it('should have /inbox after /:path* to override it', () => {
      const pathWildcardIndex = headersConfig.findIndex(rule => rule.source === '/:path*');
      const inboxIndex = headersConfig.findIndex(rule => rule.source === '/inbox');
      expect(inboxIndex).toBeGreaterThan(pathWildcardIndex);
    });
  });
});
