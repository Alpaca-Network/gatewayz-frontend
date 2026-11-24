import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GEO_COOKIE, STAKE_UNAVAILABLE_PATH, shouldBlockStakePath } from '@/lib/stake/region';

// Vercel's edge sets this from the client IP; absent in local dev.
const COUNTRY_HEADER = 'x-vercel-ip-country';

export function middleware(request: NextRequest) {
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
  const response = shouldBlockStakePath(pathname, country)
    ? NextResponse.rewrite(new URL(STAKE_UNAVAILABLE_PATH, request.url))
    : NextResponse.next();
  // Readable by client components that need the visitor's country.
  response.cookies.set(GEO_COOKIE, country, { path: '/', sameSite: 'lax', httpOnly: false });
  return response;
}

export const config = {
  matcher: ['/deck', '/rewards', '/stake', '/stake/:path*'],
};
