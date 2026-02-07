/**
 * Tests for Next.js config redirects
 * Verifies that the redirect configuration is correctly set up
 */

import { getRedirects, TERRAGON_DASHBOARD_URL } from '@/config/redirects';
import type { Redirect } from 'next/dist/lib/load-custom-routes';

describe('Next.js config redirects', () => {
  let redirects: Redirect[];

  beforeAll(() => {
    redirects = getRedirects();
  });

  describe('/inbox redirect', () => {
    it('should have a redirect rule for /inbox', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      expect(inboxRedirect).toBeDefined();
    });

    it('should redirect /inbox to Terragon dashboard', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      expect(inboxRedirect?.destination).toBe(TERRAGON_DASHBOARD_URL);
    });

    it('should use temporary redirect (not permanent)', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      expect(inboxRedirect?.permanent).toBe(false);
    });

    it('should not have host-based restriction (redirects for all hosts)', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      // The redirect should NOT have a "has" property with host restrictions
      expect(inboxRedirect).not.toHaveProperty('has');
    });
  });

  describe('/code redirect', () => {
    it('should have a redirect rule for /code', () => {
      const codeRedirect = redirects.find((r) => r.source === '/code');
      expect(codeRedirect).toBeDefined();
    });

    it('should redirect /code to Terragon dashboard', () => {
      const codeRedirect = redirects.find((r) => r.source === '/code');
      expect(codeRedirect?.destination).toBe(TERRAGON_DASHBOARD_URL);
    });

    it('should use temporary redirect (not permanent)', () => {
      const codeRedirect = redirects.find((r) => r.source === '/code');
      expect(codeRedirect?.permanent).toBe(false);
    });

    it('should not have host-based restriction (redirects for all hosts)', () => {
      const codeRedirect = redirects.find((r) => r.source === '/code');
      expect(codeRedirect).not.toHaveProperty('has');
    });
  });

  describe('/terragon redirect', () => {
    it('should have a redirect rule for /terragon', () => {
      const terragonRedirect = redirects.find((r) => r.source === '/terragon');
      expect(terragonRedirect).toBeDefined();
    });

    it('should redirect /terragon to Terragon dashboard', () => {
      const terragonRedirect = redirects.find((r) => r.source === '/terragon');
      expect(terragonRedirect?.destination).toBe(TERRAGON_DASHBOARD_URL);
    });

    it('should have host-based restriction for beta.gatewayz.ai only', () => {
      const terragonRedirect = redirects.find((r) => r.source === '/terragon');
      expect(terragonRedirect).toHaveProperty('has');

      const hasCondition = (terragonRedirect as any)?.has;
      expect(hasCondition).toEqual([
        {
          type: 'host',
          value: 'beta.gatewayz.ai',
        },
      ]);
    });
  });

  describe('redirect destination validation', () => {
    it('should use HTTPS protocol for Terragon URL', () => {
      expect(TERRAGON_DASHBOARD_URL).toMatch(/^https:\/\//);
    });

    it('should point to the dashboard path', () => {
      expect(TERRAGON_DASHBOARD_URL).toContain('/dashboard');
    });

    it('should use the Railway production URL', () => {
      expect(TERRAGON_DASHBOARD_URL).toContain('terragon');
      expect(TERRAGON_DASHBOARD_URL).toContain('.railway.app');
    });
  });

  describe('redirect consistency', () => {
    it('should have /inbox and /code redirect to the same destination', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      const codeRedirect = redirects.find((r) => r.source === '/code');

      expect(inboxRedirect?.destination).toBe(codeRedirect?.destination);
    });

    it('should have /inbox and /code with the same permanent setting', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      const codeRedirect = redirects.find((r) => r.source === '/code');

      expect(inboxRedirect?.permanent).toBe(codeRedirect?.permanent);
    });
  });
});
