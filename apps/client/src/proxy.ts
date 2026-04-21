/** Next.js 16+ edge entry (`proxy.ts`); not the Nest HTTP proxy — that is `next.config.js` → `/api/nest` rewrites. */
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
