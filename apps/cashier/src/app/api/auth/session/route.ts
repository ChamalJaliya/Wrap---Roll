import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CASHIER_ACCESS_COOKIE,
  CASHIER_REFRESH_COOKIE,
  cashierCookieOptions,
} from '../../../../lib/authCookies';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(CASHIER_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(CASHIER_REFRESH_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (!userError && userData.user) {
    const role = String(userData.user.user_metadata?.role ?? '').toUpperCase();
    if (role !== 'CASHIER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({
      user: { id: userData.user.id, email: userData.user.email, role },
      accessToken,
    });
  }

  if (!refreshToken) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (refreshError || !refreshed.session || !refreshed.user) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }
  const role = String(refreshed.user.user_metadata?.role ?? '').toUpperCase();
  if (role !== 'CASHIER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const response = NextResponse.json({
    user: { id: refreshed.user.id, email: refreshed.user.email, role },
    accessToken: refreshed.session.access_token,
  });
  response.cookies.set(
    CASHIER_ACCESS_COOKIE,
    refreshed.session.access_token,
    cashierCookieOptions,
  );
  response.cookies.set(
    CASHIER_REFRESH_COOKIE,
    refreshed.session.refresh_token,
    cashierCookieOptions,
  );
  return response;
}

