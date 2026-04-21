import { test, expect } from '@playwright/test';
import { getAdminCsrfToken } from './helpers';

/**
 * Validates `POST /api/auth/signin` rejects accounts whose Supabase user_metadata.role
 * is not ADMIN. Requires a real Supabase user with a non-ADMIN role.
 *
 * Set in CI or locally:
 *   E2E_NONADMIN_EMAIL
 *   E2E_NONADMIN_PASSWORD
 */
test.describe('Admin sign-in role gate (optional)', () => {
  test('POST /api/auth/signin returns 403 for non-admin user', async ({ request }) => {
    const email = process.env.E2E_NONADMIN_EMAIL;
    const password = process.env.E2E_NONADMIN_PASSWORD;
    test.skip(
      !email || !password,
      'Set E2E_NONADMIN_EMAIL and E2E_NONADMIN_PASSWORD to run this assertion against Supabase.',
    );

    const token = await getAdminCsrfToken(request);
    const res = await request.post('/api/auth/signin', {
      data: { email, password },
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(String(body.error)).toMatch(/not allowed/i);
  });
});
