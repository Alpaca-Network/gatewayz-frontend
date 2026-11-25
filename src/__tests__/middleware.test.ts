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
  it('runs only for /deck and the /stake pages', () => {
    expect(config.matcher).toEqual(['/deck', '/stake', '/stake/:path*']);
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
});
