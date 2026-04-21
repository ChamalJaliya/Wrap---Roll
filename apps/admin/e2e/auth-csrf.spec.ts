import { test, expect } from '@playwright/test';
import { getAdminCsrfToken } from './helpers';

test.describe('Admin cookie-mutating routes require CSRF', () => {
  test('POST /api/auth/set-session without CSRF returns 403', async ({ request }) => {
    const res = await request.post('/api/auth/set-session', {
      data: { accessToken: 'test-access', refreshToken: 'test-refresh' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/i);
  });

  test('POST /api/auth/signin without CSRF returns 403', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email: 'any@example.com', password: 'secret' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/i);
  });

  test('POST /api/auth/signout without CSRF returns 403', async ({ request }) => {
    const res = await request.post('/api/auth/signout', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/i);
  });

  test('POST /api/auth/set-session with wrong x-csrf-token returns 403', async ({ request }) => {
    await getAdminCsrfToken(request);
    const res = await request.post('/api/auth/set-session', {
      data: { accessToken: 'a', refreshToken: 'b' },
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'definitely-not-the-cookie-value',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('GET /api/auth/csrf issues cookie and matching header token', async ({ request }) => {
    const token = await getAdminCsrfToken(request);
    expect(token.length).toBeGreaterThan(10);
    const res = await request.post('/api/auth/set-session', {
      data: { accessToken: 'a', refreshToken: 'b' },
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
