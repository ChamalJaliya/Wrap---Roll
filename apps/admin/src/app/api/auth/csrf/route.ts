import { NextResponse } from 'next/server';
import { issueCsrfToken } from '../../../../lib/csrf';

export async function GET() {
  const response = NextResponse.json({ ok: true });
  const token = issueCsrfToken(response);
  response.headers.set('x-csrf-token', token);
  return response;
}
