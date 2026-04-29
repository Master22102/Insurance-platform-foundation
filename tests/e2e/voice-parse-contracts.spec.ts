import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { E2E_AUTH_SKIP_REASON, readAccessTokenFromStorageState } from './utils/supabaseRest';

/**
 * Voice parse API contracts (new `context_type` API).
 * Doctrine: §7.4 voice authority, §1.9 structural truth, §10.2 (onboarding parse free — no credits here).
 */
test.describe('Voice parse API contracts (§7.4 / §1.9)', () => {
  test.describe('Public — signal_capture', () => {
    test('signal_capture: rejects missing transcript', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: { context_type: 'signal_capture', round_number: 1 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_REQUEST');
    });

    test('signal_capture: rejects empty transcript', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: { context_type: 'signal_capture', transcript: '', round_number: 1 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_REQUEST');
    });

    test('signal_capture: enforces 3-round ceiling (§7.4.14)', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: {
          context_type: 'signal_capture',
          transcript: 'I want to visit Italy',
          round_number: 4,
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('MAX_ROUNDS_EXCEEDED');
    });

    test('signal_capture: accepts round_number 3 (max allowed, §7.4.14)', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: {
          context_type: 'signal_capture',
          transcript: 'I love Italian food and my dog Max is coming with us',
          round_number: 3,
        },
      });
      expect([200, 503, 502]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.context_type).toBe('signal_capture');
        expect(typeof body.parsed.pet_travel).toBe('boolean');
        expect(Array.isArray(body.parsed.places)).toBe(true);
        expect(Array.isArray(body.parsed.catch_bucket)).toBe(true);
        expect(Array.isArray(body.parsed.venue_intents)).toBe(true);
        expect(typeof body.parsed.wayfarer_response).toBe('string');
        expect(body.parsed.wayfarer_response.length).toBeGreaterThan(0);
        expect(String(body.model_used).toLowerCase()).toContain('sonnet');
      }
    });

    test('signal_capture: pet_travel extracted from narration', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: {
          context_type: 'signal_capture',
          transcript: 'My golden retriever is coming with us to France for the summer',
          round_number: 1,
        },
      });
      if (res.status() !== 200) return;
      const body = await res.json();
      expect(body.parsed.pet_travel).toBe(true);
      expect(body.parsed.pet_type).toMatch(/dog|golden|retriever/i);
      expect(body.parsed.pet_destination_type).toBe('international');
    });

    test('rejects invalid context_type', async ({ request }) => {
      const res = await request.post('/api/voice/parse', {
        data: { context_type: 'made_up_type', transcript: 'test' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_REQUEST');
    });
  });

  test.describe('Authenticated — incident / carrier / §1.9', () => {
    test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
    test.use({ storageState: getStorageStatePath() });

    test('incident_create: structured disruption parse returns schema-valid output', async ({ page }) => {
      test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not set.');
      const t = readAccessTokenFromStorageState();
      test.skip(!t, E2E_AUTH_SKIP_REASON);
      await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      const body = await page.evaluate(async () => {
        const r = await fetch('/api/voice/parse', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_type: 'incident_create',
            transcript:
              'My Air France flight AF447 from Paris to New York was cancelled due to weather. I spent 80 euros on dinner and transport.',
          }),
        });
        return { status: r.status, json: await r.json() };
      });
      expect(body.status).toBe(200);
      const j = body.json;
      expect(j.success).toBe(true);
      expect(j.parsed.disruption_type).toBe('cancellation');
      expect(String(j.parsed.carrier ?? '')).toMatch(/air france/i);
      expect(String(j.parsed.flight_number ?? '')).toMatch(/AF447|447/i);
      expect(typeof j.parsed.summary).toBe('string');
      expect(String(j.model_used).toLowerCase()).toContain('haiku');
    });

    test('incident_create: preserves causality ambiguity (§1.9.4)', async ({ page }) => {
      test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not set.');
      const t = readAccessTokenFromStorageState();
      test.skip(!t, E2E_AUTH_SKIP_REASON);
      await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      const body = await page.evaluate(async () => {
        const r = await fetch('/api/voice/parse', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_type: 'incident_create',
            transcript: 'They said it was weather but I think it was actually crew shortage',
          }),
        });
        return { status: r.status, json: await r.json() };
      });
      expect(body.status).toBe(200);
      const notes = String(body.json.parsed.causality_notes ?? '').toLowerCase();
      expect(notes).toMatch(/weather|crew|shortage/);
    });

    test('carrier_response: returns structured offer type', async ({ page }) => {
      test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not set.');
      const t = readAccessTokenFromStorageState();
      test.skip(!t, E2E_AUTH_SKIP_REASON);
      await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      const body = await page.evaluate(async () => {
        const r = await fetch('/api/voice/parse', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_type: 'carrier_response',
            transcript: 'The gate agent offered me a 200 euro travel voucher valid for 12 months',
          }),
        });
        return { status: r.status, json: await r.json() };
      });
      expect(body.status).toBe(200);
      expect(body.json.parsed.offer_type).toBe('voucher_issued');
      expect(body.json.parsed.offer_amount).toBe(200);
      expect(String(body.json.parsed.offer_currency ?? '')).toMatch(/EUR|euro/i);
    });

    test('response never contains outcome prediction language (§1.9.3)', async ({ page }) => {
      test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not set.');
      const t = readAccessTokenFromStorageState();
      test.skip(!t, E2E_AUTH_SKIP_REASON);
      await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      const body = await page.evaluate(async () => {
        const r = await fetch('/api/voice/parse', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_type: 'incident_create',
            transcript: 'My flight was delayed 5 hours. I have Chase Sapphire Reserve.',
          }),
        });
        return { status: r.status, json: await r.json() };
      });
      expect(body.status).toBe(200);
      const responseText = JSON.stringify(body.json.parsed).toLowerCase();
      expect(responseText).not.toMatch(/guaranteed|you will receive|you are entitled|will be reimbursed/);
    });
  });
});
