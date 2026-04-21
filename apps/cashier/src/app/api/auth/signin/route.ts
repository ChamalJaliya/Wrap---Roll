import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CASHIER_ACCESS_COOKIE,
  CASHIER_REFRESH_COOKIE,
  cashierCookieOptions,
} from '../../../../lib/authCookies';
import { issueCsrfToken, validateCsrf } from '../../../../lib/csrf';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
  }

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { error: error?.message || 'Sign in failed.' },
      { status: 401 },
    );
  }

  const role = String(data.user.user_metadata?.role ?? '').toUpperCase();
  if (role !== 'CASHIER' && role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'This account is not allowed to access cashier.' },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    user: { id: data.user.id, email: data.user.email, role },
  });
  response.cookies.set(
    CASHIER_ACCESS_COOKIE,
    data.session.access_token,
    cashierCookieOptions,
  );
  response.cookies.set(
    CASHIER_REFRESH_COOKIE,
    data.session.refresh_token,
    cashierCookieOptions,
  );
  issueCsrfToken(response);
  return response;
}

