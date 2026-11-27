/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { config, middleware } from '../middleware';

// jest.setup.js swaps NextResponse for a plain Response; the middleware needs the real one.
jest.unmock('next/server');

function run(path: string, country?: string) {
  const headers = country ? { 'x-vercel-ip-country': country } : undefined;
  return middleware(new NextRequest(`https://gatewayz.ai${path}`, { headers }));
}

describe('middleware', () => {
  it('runs for /deck, the /stake pages and page requests carrying legacy session params', () => {
    expect(config.matcher.slice(0, 3)).toEqual(['/deck', '/stake', '/stake/:path*']);
    const conditional = config.matcher.slice(3) as Array<{ source: string; has: Array<{ type: string; key: string }> }>;
    expect(conditional.map((m) => m.has)).toEqual([
      [{ type: 'query', key: 'token' }],
      [{ type: 'query', key: 'userId' }],
    ]);
    for (const m of conditional) {
      const re = new RegExp(`^${m.source}$`);
      expect(re.test('/')).toBe(true);
      expect(re.test('/chat')).toBe(true);
      expect(re.test('/api/user/me')).toBe(false);
      expect(re.test('/_next/static/chunks/x.js')).toBe(false);
    }
  });

  it.each(['US', 'CA', 'us'])('serves /stake/unavailable for /stake pages from %s', (country) => {
    for (const path of ['/stake', '/stake/ada']) {
      expect(run(path, country).headers.get('x-middleware-rewrite')).toBe('https://gatewayz.ai/stake/unavailable');
    }
  });

  it('lets the terms, the unavailable page, other countries and unknown countries through', () => {
    for (const response of [run('/stake/terms', 'US'), run('/stake/unavailable', 'CA'), run('/stake', 'FR'), run('/stake')]) {
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('sets no cookie', () => {
    for (const response of [run('/stake', 'US'), run('/stake', 'FR'), run('/stake/terms', 'CA')]) {
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  it('still redirects /deck', () => {
    const response = run('/deck', 'US');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('canva.com');
  });

  describe('legacy session params', () => {
    const FAKE = 'fake-session-value-123';

    it('redirects to the same URL without token and userId, keeping other params and the path', () => {
      const response = run(`/chat?token=${FAKE}&userId=42&returnUrl=%2Fsettings&utm_source=x`);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') as string);
      expect(location.pathname).toBe('/chat');
      expect(location.searchParams.has('token')).toBe(false);
      expect(location.searchParams.has('userId')).toBe(false);
      expect(location.searchParams.get('returnUrl')).toBe('/settings');
      expect(location.searchParams.get('utm_source')).toBe('x');
      expect(response.headers.get('location')).not.toContain(FAKE);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('strips either param on its own', () => {
      expect(new URL(run(`/?token=${FAKE}`).headers.get('location') as string).search).toBe('');
      expect(new URL(run('/?userId=42').headers.get('location') as string).search).toBe('');
    });

    it('keeps the one-time code param', () => {
      const location = new URL(run(`/?code=abc&token=${FAKE}`).headers.get('location') as string);
      expect(location.searchParams.get('code')).toBe('abc');
      expect(location.searchParams.has('token')).toBe(false);
    });

    it('strips before the /stake gate runs', () => {
      const response = run(`/stake?token=${FAKE}`, 'US');
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://gatewayz.ai/stake');
    });

    it('does not log the values', () => {
      const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
      run(`/?token=${FAKE}&userId=42`);
      for (const spy of spies) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(FAKE);
        spy.mockRestore();
      }
    });

    it('passes other requests through untouched', () => {
      expect(run('/stake?code=abc', 'FR').headers.get('x-middleware-next')).toBe('1');
    });
  });
});
