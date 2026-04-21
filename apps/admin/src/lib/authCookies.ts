export const ADMIN_ACCESS_COOKIE = 'wr_admin_at';
export const ADMIN_REFRESH_COOKIE = 'wr_admin_rt';

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};
