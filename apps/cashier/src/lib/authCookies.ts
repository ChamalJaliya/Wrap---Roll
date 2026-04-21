export const CASHIER_ACCESS_COOKIE = 'wr_cashier_at';
export const CASHIER_REFRESH_COOKIE = 'wr_cashier_rt';

export const cashierCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

