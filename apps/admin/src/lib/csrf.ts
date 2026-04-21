import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_CSRF_COOKIE = 'wr_admin_csrf';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(response: NextResponse, token = randomUUID()) {
  response.cookies.set(ADMIN_CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return token;
}

export function validateCsrf(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER) || '';
  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
