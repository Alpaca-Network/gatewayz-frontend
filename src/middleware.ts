import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { STAKE_UNAVAILABLE_PATH, shouldBlockStakePath } from '@/lib/stake/region';

// Vercel's edge sets this from the client IP; absent in local dev.
const COUNTRY_HEADER = 'x-vercel-ip-country';

/**
 * Query params of the retired `?token=&userId=` session hand-off. The app no
 * longer accepts a credential in the URL (www.gatewayz.ai sends a one-time
 * `?code=` instead), so a page request that still carries them is redirected
 * to the same URL without them, before any page script or analytics tag can
 * read the URL. Values are never logged.
 */
export const LEGACY_SESSION_PARAMS = ['token', 'userId'] as const;

function stripLegacySessionParams(request: NextRequest): NextResponse | null {
  const url = request.nextUrl.clone();
  let found = false;
  for (const name of LEGACY_SESSION_PARAMS) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name);
      found = true;
    }
  }
  if (!found) {
    return null;
  }
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export function middleware(request: NextRequest) {
  const legacy = stripLegacySessionParams(request);
  if (legacy) {
    return legacy;
  }

  const { pathname } = request.nextUrl;

  // Redirect /deck to Canva presentation
  if (pathname === '/deck') {
    return NextResponse.redirect(
      'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
      307
    );
  }

  // The /stake pages are not shown in the US or Canada (src/lib/stake/region.ts).
  // /stake/terms stays readable; every other /stake page shows /stake/unavailable.
  const country = request.headers.get(COUNTRY_HEADER)?.toUpperCase() ?? '';
  return shouldBlockStakePath(pathname, country)
    ? NextResponse.rewrite(new URL(STAKE_UNAVAILABLE_PATH, request.url))
    : NextResponse.next();
}

export const config = {
  matcher: [
    '/deck',
    '/stake',
    '/stake/:path*',
    // Any page request carrying a legacy session param (API routes and static
    // assets excluded). The `has` condition keeps every other request out of
    // the middleware.
    {
      source: '/((?!api/|_next/static|_next/image|monitoring).*)',
      has: [{ type: 'query', key: 'token' }],
    },
    {
      source: '/((?!api/|_next/static|_next/image|monitoring).*)',
      has: [{ type: 'query', key: 'userId' }],
    },
  ],
};
