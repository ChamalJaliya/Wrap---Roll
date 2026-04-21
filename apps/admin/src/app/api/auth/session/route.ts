import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, adminCookieOptions } from '../../../../lib/authCookies';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

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
    return NextResponse.json({
      user: {
        id: userData.user.id,
        email: userData.user.email,
        role: String(userData.user.user_metadata?.role ?? '').toUpperCase(),
      },
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

  const response = NextResponse.json({
    user: {
      id: refreshed.user.id,
      email: refreshed.user.email,
      role: String(refreshed.user.user_metadata?.role ?? '').toUpperCase(),
    },
    accessToken: refreshed.session.access_token,
  });
  response.cookies.set(ADMIN_ACCESS_COOKIE, refreshed.session.access_token, adminCookieOptions);
  response.cookies.set(ADMIN_REFRESH_COOKIE, refreshed.session.refresh_token, adminCookieOptions);
  return response;
}
