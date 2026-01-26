/**
 * CSP Configuration Tests
 *
 * Tests to verify that the Content Security Policy configuration
 * includes all required domains for Privy, Stripe, analytics, and other services.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('CSP Configuration', () => {
  describe('vercel.json CSP', () => {
    let vercelConfig: any;
    let cspHeader: string;

    beforeAll(() => {
      const vercelPath = path.join(__dirname, '../../../vercel.json');
      const vercelContent = fs.readFileSync(vercelPath, 'utf-8');
      vercelConfig = JSON.parse(vercelContent);

      // Find the CSP header
      const allHeaders = vercelConfig.headers?.[0]?.headers || [];
      const cspHeaderObj = allHeaders.find(
        (h: { key: string; value: string }) => h.key === 'Content-Security-Policy'
      );
      cspHeader = cspHeaderObj?.value || '';
    });

    it('should have headers configuration', () => {
      expect(vercelConfig.headers).toBeDefined();
      expect(vercelConfig.headers.length).toBeGreaterThan(0);
    });

    it('should have Content-Security-Policy header', () => {
      expect(cspHeader).toBeTruthy();
    });

    describe('script-src directive', () => {
      it("should allow 'self'", () => {
        expect(cspHeader).toContain("script-src 'self'");
      });

      it("should allow 'unsafe-inline' for inline scripts", () => {
        expect(cspHeader).toContain("'unsafe-inline'");
      });

      it('should allow Google Tag Manager', () => {
        expect(cspHeader).toContain('https://www.googletagmanager.com');
      });

      it('should allow Google Analytics', () => {
        expect(cspHeader).toContain('https://www.google-analytics.com');
      });

      it('should allow Privy auth scripts', () => {
        expect(cspHeader).toContain('https://auth.privy.io');
        expect(cspHeader).toContain('https://*.privy.io');
      });

      it('should allow Stripe scripts', () => {
        expect(cspHeader).toContain('https://js.stripe.com');
        expect(cspHeader).toContain('https://*.stripe.com');
      });

      it('should allow Sentry scripts', () => {
        expect(cspHeader).toContain('https://*.sentry.io');
      });

      it('should allow LinkedIn scripts', () => {
        expect(cspHeader).toContain('https://snap.licdn.com');
      });

      it('should allow Twitter analytics scripts', () => {
        expect(cspHeader).toContain('https://static.ads-twitter.com');
      });

      it('should allow Wistia video scripts', () => {
        expect(cspHeader).toContain('https://fast.wistia.com');
        expect(cspHeader).toContain('https://*.wistia.com');
      });

      it('should allow WalletConnect scripts', () => {
        expect(cspHeader).toContain('https://*.walletconnect.com');
      });

      it('should allow Statsig scripts', () => {
        expect(cspHeader).toContain('https://*.statsig.com');
      });

      it('should allow PostHog scripts', () => {
        expect(cspHeader).toContain('https://*.posthog.com');
      });

      it('should allow Reddit ads scripts', () => {
        expect(cspHeader).toContain('https://www.redditstatic.com');
      });

      it('should allow Google Ads scripts', () => {
        expect(cspHeader).toContain('https://googleads.g.doubleclick.net');
        expect(cspHeader).toContain('https://www.googleadservices.com');
      });
    });

    describe('font-src directive', () => {
      it('should allow data: URIs for inline fonts', () => {
        expect(cspHeader).toMatch(/font-src[^;]*data:/);
      });

      it('should allow Google Fonts', () => {
        expect(cspHeader).toContain('https://fonts.gstatic.com');
      });
    });

    describe('connect-src directive', () => {
      it('should allow GatewayZ API', () => {
        expect(cspHeader).toContain('https://api.gatewayz.ai');
        expect(cspHeader).toContain('https://*.gatewayz.ai');
      });

      it('should allow Supabase connections', () => {
        expect(cspHeader).toContain('https://*.supabase.co');
        expect(cspHeader).toContain('wss://*.supabase.co');
      });

      it('should allow Privy API connections', () => {
        expect(cspHeader).toContain('https://api.privy.io');
        expect(cspHeader).toContain('https://*.privy.io');
      });

      it('should allow WalletConnect connections', () => {
        expect(cspHeader).toContain('https://explorer-api.walletconnect.com');
        expect(cspHeader).toContain('https://*.walletconnect.com');
        expect(cspHeader).toContain('wss://*.walletconnect.com');
      });

      it('should allow Stripe API connections', () => {
        expect(cspHeader).toContain('https://api.stripe.com');
      });

      it('should allow Cloudflare DNS', () => {
        expect(cspHeader).toContain('https://cloudflare-dns.com');
      });

      it('should allow PostHog connections', () => {
        expect(cspHeader).toContain('https://us.i.posthog.com');
        expect(cspHeader).toContain('https://us-assets.i.posthog.com');
        expect(cspHeader).toContain('https://*.posthog.com');
      });

      it('should allow Google Ads connections', () => {
        expect(cspHeader).toContain('https://googleads.g.doubleclick.net');
      });

      it('should allow Reddit pixel connections', () => {
        expect(cspHeader).toContain('https://pixel-config.reddit.com');
        expect(cspHeader).toContain('https://*.reddit.com');
      });

      it('should allow Statsig beyondwickedmapping domain', () => {
        expect(cspHeader).toContain('https://beyondwickedmapping.org');
      });
    });

    describe('frame-src directive', () => {
      it('should allow Privy iframes', () => {
        expect(cspHeader).toContain('https://*.privy.io');
      });

      it('should allow Stripe iframes', () => {
        expect(cspHeader).toContain('https://js.stripe.com');
      });

      it('should allow WalletConnect verification', () => {
        expect(cspHeader).toContain('https://verify.walletconnect.com');
      });

      it('should allow Cloudflare challenges', () => {
        expect(cspHeader).toContain('https://challenges.cloudflare.com');
      });

      it('should allow Gatewayz iframes', () => {
        expect(cspHeader).toContain('https://*.gatewayz.ai');
      });
    });

    describe('img-src directive', () => {
      it('should allow data: URIs for inline images', () => {
        expect(cspHeader).toMatch(/img-src[^;]*data:/);
      });

      it('should allow blob: URIs', () => {
        expect(cspHeader).toMatch(/img-src[^;]*blob:/);
      });

      it('should allow all HTTPS images', () => {
        expect(cspHeader).toMatch(/img-src[^;]*https:/);
      });
    });

    describe('worker-src directive', () => {
      it('should allow blob: for web workers', () => {
        expect(cspHeader).toContain("worker-src 'self' blob:");
      });
    });
  });

  describe('Tauri CSP', () => {
    let tauriConfig: any;
    let tauriCsp: string;

    beforeAll(() => {
      const tauriPath = path.join(__dirname, '../../../src-tauri/tauri.conf.json');
      const tauriContent = fs.readFileSync(tauriPath, 'utf-8');
      tauriConfig = JSON.parse(tauriContent);
      tauriCsp = tauriConfig.app?.security?.csp || '';
    });

    it('should have CSP configuration', () => {
      expect(tauriCsp).toBeTruthy();
    });

    it('should allow IPC protocols', () => {
      expect(tauriCsp).toContain('ipc:');
      expect(tauriCsp).toContain('tauri:');
    });

    it('should allow data: fonts for inline fonts', () => {
      expect(tauriCsp).toMatch(/font-src[^;]*data:/);
    });

    it('should allow Supabase connections', () => {
      expect(tauriCsp).toContain('https://*.supabase.co');
    });

    it('should allow Privy connections', () => {
      expect(tauriCsp).toContain('https://*.privy.io');
    });

    it('should allow Stripe connections', () => {
      expect(tauriCsp).toContain('https://*.stripe.com');
    });

    it('should allow worker blobs', () => {
      expect(tauriCsp).toContain("worker-src 'self' blob:");
    });
  });
});
