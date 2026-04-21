import { NextRequest, NextResponse } from 'next/server';
import { CASHIER_CSRF_COOKIE, validateCsrf } from '../../../../lib/csrf';
import { CASHIER_ACCESS_COOKIE, CASHIER_REFRESH_COOKIE } from '../../../../lib/authCookies';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CASHIER_ACCESS_COOKIE);
  response.cookies.delete(CASHIER_REFRESH_COOKIE);
  response.cookies.delete(CASHIER_CSRF_COOKIE);
  return response;
}

