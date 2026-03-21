import { expect, test } from '@playwright/test';

test.describe('Safety API contracts', () => {
  test('rejects unauthenticated bypass code requests', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.post('/api/safety/dual-presence/bypass-code', {
      data: { emergency_mode_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect([401, 500]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401) {
      expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
    }
    await ctx.dispose();
  });

  test('requires emergency_mode_id for bypass code requests', async ({ request }) => {
    const res = await request.post('/api/safety/dual-presence/bypass-code', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body?.ok).toBeFalsy();
    expect(String(body?.error || '').toLowerCase()).toContain('emergency_mode_id');
  });

  test('requires delegate_name and contact for delegate registration', async ({ request }) => {
    const noName = await request.post('/api/safety/emergency/delegates', {
      data: { phone_e164: '+10000000000' },
    });
    expect(noName.status()).toBe(400);
    const noNameBody = await noName.json();
    expect(String(noNameBody?.error || '').toLowerCase()).toContain('delegate_name');

    const noContact = await request.post('/api/safety/emergency/delegates', {
      data: { delegate_name: 'Backup Contact' },
    });
    expect(noContact.status()).toBe(400);
    const noContactBody = await noContact.json();
    expect(String(noContactBody?.error || '').toLowerCase()).toContain('phone_e164');
  });

  test('requires emergency_mode_id for emergency end requests', async ({ request }) => {
    const res = await request.post('/api/safety/emergency/end-mode', {
      data: { geolocation_confirmed: true },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body?.error || '').toLowerCase()).toContain('emergency_mode_id');
  });
});
