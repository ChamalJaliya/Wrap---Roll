import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

export async function getAdminCsrfToken(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/auth/csrf');
  const errBody = res.status() !== 200 ? await res.text() : '';
  expect(res.status(), errBody || 'GET /api/auth/csrf').toBe(200);
  const token = res.headers()['x-csrf-token'];
  expect(token, 'x-csrf-token header missing').toBeTruthy();
  return token!;
}
