import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, adminCookieOptions } from '../../../../lib/authCookies';
import { issueCsrfToken, validateCsrf } from '../../../../lib/csrf';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
  }

  const { accessToken, refreshToken } = await request.json();
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, accessToken, adminCookieOptions);
  response.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, adminCookieOptions);
  issueCsrfToken(response);
  return response;
}
