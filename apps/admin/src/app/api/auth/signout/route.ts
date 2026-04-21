import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from '../../../../lib/authCookies';
import { ADMIN_CSRF_COOKIE, validateCsrf } from '../../../../lib/csrf';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_ACCESS_COOKIE);
  response.cookies.delete(ADMIN_REFRESH_COOKIE);
  response.cookies.delete(ADMIN_CSRF_COOKIE);
  return response;
}
