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

  describe('/inbox and /code redirects (removed)', () => {
    it('should NOT have a redirect rule for /inbox (Terragon dashboard retired)', () => {
      const inboxRedirect = redirects.find((r) => r.source === '/inbox');
      expect(inboxRedirect).toBeUndefined();
    });

    it('should NOT have a redirect rule for /code (Terragon dashboard retired)', () => {
      const codeRedirect = redirects.find((r) => r.source === '/code');
      expect(codeRedirect).toBeUndefined();
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

  describe('/catalog consolidation redirects (Task 8)', () => {
    it.each(['/catalog', '/catalog/models', '/catalog/providers'])(
      'redirects %s to /models (temporary, no host restriction)',
      (source) => {
        const rule = redirects.find((r) => r.source === source);
        expect(rule).toBeDefined();
        expect(rule?.destination).toBe('/models');
        expect(rule?.permanent).toBe(false);
        expect(rule).not.toHaveProperty('has');
      }
    );
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

});
