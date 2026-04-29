import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { E2E_AUTH_SKIP_REASON, readAccessTokenFromStorageState } from './utils/supabaseRest';

/**
 * Browser SpeechRecognition is not available in Playwright; we exercise the
 * voice parsing API that backs VoiceNarrationPanel.
 *
 * - With OPENROUTER_API_KEY (and a running dev server): expects structured parse.
 * - Without key on the Next process: expects graceful degradation.
 */
test.describe('Voice narration — parse API', () => {
  test.skip(!hasStorageState(), 'Missing storage state; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  const transcript =
    'My flight AC780 from Toronto to Boston was delayed 3 hours. I spent $47 on dinner.';

  test('POST incident_create returns structured fields when OpenRouter is configured', async ({
    page,
  }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'Set OPENROUTER_API_KEY to run LLM parse assertions.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate(async (tx) => {
      const r = await fetch('/api/voice/parse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'incident_create', transcript: tx }),
      });
      return { status: r.status, body: await r.json() };
    }, transcript);
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.ok).toBeTruthy();
    expect(body.parsed).toBe(true);
    expect(body.fields).toBeTruthy();

    expect(body.fields.disruption_type).toBe('delay');

    const fn = String(body.fields.flight_number ?? '');
    expect(fn.toUpperCase()).toMatch(/AC\s*780|780/);

    const exp = body.fields.estimated_expenses;
    expect(typeof exp === 'number' && Number.isFinite(exp)).toBeTruthy();
    expect(exp).toBeGreaterThan(0);
  });

  test('POST degrades when Next has no OPENROUTER_API_KEY', async ({ page }) => {
    test.skip(
      Boolean(process.env.OPENROUTER_API_KEY),
      'Unset OPENROUTER_API_KEY on the Next dev server to assert fallback (or run in CI without the key).',
    );
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate(async (tx) => {
      const r = await fetch('/api/voice/parse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'incident_create', transcript: tx }),
      });
      return { status: r.status, body: await r.json() };
    }, transcript);
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.ok).toBeTruthy();
    expect(body.parsed).toBe(false);
    expect(body.fields).toEqual({});
    expect(String(body.message ?? '').toLowerCase()).toContain('manually');
  });
});
