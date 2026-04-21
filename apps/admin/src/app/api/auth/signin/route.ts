import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, adminCookieOptions } from '../../../../lib/authCookies';
import { issueCsrfToken, validateCsrf } from '../../../../lib/csrf';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
  }

  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: error?.message || 'Sign in failed.' }, { status: 401 });
  }

  const role = String(data.user.user_metadata?.role ?? '').toUpperCase();
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'This account is not allowed to access admin.' },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    user: { id: data.user.id, email: data.user.email, role },
  });

  response.cookies.set(ADMIN_ACCESS_COOKIE, data.session.access_token, adminCookieOptions);
  response.cookies.set(ADMIN_REFRESH_COOKIE, data.session.refresh_token, adminCookieOptions);
  issueCsrfToken(response);
  return response;
}
