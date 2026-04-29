import { expect, test } from '@playwright/test';

test.describe('Security contract gates (§8.1 / §8.4)', () => {
  test('debug route is removed or returns 401 for unauthenticated callers', async ({ request }) => {
    const res = await request.get('/api/debug');
    // Either the route is deleted (404) or auth-gated (401)
    expect([401, 404]).toContain(res.status());
  });

  test('coverage-catalog search requires authentication', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.get('/api/coverage-catalog/search?q=trip+delay');
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
    await ctx.dispose();
  });

  test('coverage-catalog search rejects empty auth header', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: 'Bearer invalid-token' },
    });
    const res = await ctx.get('/api/coverage-catalog/search?q=cancellation');
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });
});
