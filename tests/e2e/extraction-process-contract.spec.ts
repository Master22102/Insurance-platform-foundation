import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';

test.describe('Extraction process API contract', () => {
  test('rejects unauthenticated process requests', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.post('/api/extraction/process', {
      data: { document_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect([401, 500]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401) {
      expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
    }
    await ctx.dispose();
  });

  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('requires document_id for authenticated requests', async ({ page }) => {
    const res = await page.request.post('/api/extraction/process', {
      data: { sync: true },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body?.ok).toBeFalsy();
    expect(String(body?.error || '').toLowerCase()).toContain('document_id');
  });
});
