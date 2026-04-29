import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasOpenRouterKey } from './utils/e2eEnv';
import { voiceParseUntil429 } from './utils/securityHardening.e2e';
import { E2E_AUTH_SKIP_REASON, readAccessTokenFromStorageState } from './utils/supabaseRest';

test.describe('Voice parse — contexts and limits', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.use({ storageState: getStorageStatePath() });
  test.describe.configure({ mode: 'serial' });

  test('incident_create returns title, description, disruption_type', async ({ page }) => {
    test.skip(!hasOpenRouterKey(), 'OPENROUTER_API_KEY not set.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    const body = await page.evaluate(async () => {
      const r = await fetch('/api/voice/parse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'incident_create',
          transcript: 'My flight was delayed 4 hours at JFK, airline was Delta.',
        }),
      });
      return { status: r.status, json: await r.json() };
    });
    expect(body.status).toBe(200);
    expect(body.json?.parsed).toBeTruthy();
    expect(body.json?.fields?.title).toBeTruthy();
    expect(body.json?.fields?.description).toBeTruthy();
    expect(body.json?.fields?.disruption_type).toBeTruthy();
  });

  test('route_segment context returns origin / destination / dates', async ({ page }) => {
    test.skip(!hasOpenRouterKey(), 'OPENROUTER_API_KEY not set.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    const body = await page.evaluate(async () => {
      const r = await fetch('/api/voice/parse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'route_segment',
          transcript: "I'm flying from JFK to Lisbon on June 15th 2026.",
        }),
      });
      return { status: r.status, json: await r.json() };
    });
    expect(body.status).toBe(200);
    expect(body.json?.parsed).toBeTruthy();
    const f = body.json?.fields ?? {};
    const o = String(f.origin || '').toLowerCase();
    expect(o.includes('jfk') || o.includes('john') || o.includes('kennedy')).toBeTruthy();
    expect(String(f.destination || '').toLowerCase()).toContain('lisbon');
    expect(f.depart_date || f.arrive_date || f.notes).toBeTruthy();
  });

  test('voice parse 429 + Retry-After after burst', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Shared in-memory limiter — single desktop project.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    const { last, retryAfter } = await voiceParseUntil429(page);
    expect(last).toBe(429);
    expect(retryAfter).toBeTruthy();
  });
});
