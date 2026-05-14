/** Next.js 16+ edge entry (`proxy.ts`). Lets `/api/nest/*` hit the App Route for cookie → Bearer mapping. */
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_ACCESS_COOKIE } from './lib/authCookies';

const PUBLIC_PATHS = ['/auth/signin', '/auth/callback'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/api/nest/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

/** Edge auth gate + allow `/api/nest/*` through so the App Route can map httpOnly cookie → Bearer. */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Mistaken Nest paths hit Next as `/api/admin/...` (missing `nest`). Rewrite to the real proxy route.
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    const url = request.nextUrl.clone();
    const tail = pathname.slice('/api/admin'.length);
    url.pathname = `/api/nest/admin${tail}`;
    return NextResponse.rewrite(url);
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
