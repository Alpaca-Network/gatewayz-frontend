import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect /deck to Canva presentation
  if (request.nextUrl.pathname === '/deck') {
    return NextResponse.redirect(
      'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
      307
    );
  }
}

export const config = {
  matcher: '/deck',
};
