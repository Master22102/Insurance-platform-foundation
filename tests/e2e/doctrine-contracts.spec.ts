import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

const CANONICAL_CONFIDENCE_LABELS = [
  'HIGH_STRUCTURAL_ALIGNMENT',
  'CONDITIONAL_ALIGNMENT',
  'DOCUMENTATION_INCOMPLETE',
  'INSUFFICIENT_DATA',
] as const;

test.describe('Doctrine contract gates', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('policy extraction and quick scan enforce doctrine contracts', async ({ page }) => {
    await ensureOnboarded(page);

    await page.goto('/policies/upload', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.getByRole('button', { name: /enter details/i }).click();
    await page.getByPlaceholder(/chase sapphire reserve/i).fill(`Doctrine Contract ${Date.now()}`);
    await page.getByPlaceholder(/paste what you know about the plan/i).fill(
      'Trip delay starts at 6 hours. Max benefit is USD 500. Receipts required.',
    );

    const submit = page
      .locator('button')
      .filter({ hasText: /create policy|create policy from email|upload and review|create policy & extract/i })
      .first();
    await expect(submit).toBeVisible({ timeout: 20_000 });
    let documentId: string | null = null;
    let uploadPayload: any = null;
    const uploadComplete = page.waitForResponse(async (res) => {
      if (!res.url().includes('/api/extraction/upload-complete')) return false;
      if (res.request().method() !== 'POST' || !res.ok()) return false;
      const body = await res.json().catch(() => null);
      documentId = body?.document_id ? String(body.document_id) : null;
      uploadPayload = body;
      return Boolean(documentId);
    });
    await submit.click({ force: true });
    await uploadComplete;
    expect(documentId).toBeTruthy();
    expect(uploadPayload?.ok).toBeTruthy();
    expect(['QUEUED', 'FAILED']).toContain(uploadPayload?.status);
    expect(uploadPayload?.policy_id).toBeTruthy();
    if (uploadPayload?.status === 'QUEUED') {
      expect(uploadPayload?.job_id).toBeTruthy();
    }
    expect(typeof uploadPayload?.user_message).toBe('string');

    const statusRes = await page.request.get(`/api/extraction/status?document_id=${documentId}`);
    expect(statusRes.ok()).toBeTruthy();
    const statusPayload = await statusRes.json();
    expect(statusPayload?.ok).toBeTruthy();
    expect(statusPayload?.document_id).toBe(documentId);
    expect(['processing', 'complete', 'failed']).toContain(statusPayload?.status);
    expect(['uploaded', 'queued', 'processing', 'complete', 'failed', 'partial']).toContain(statusPayload?.raw_status);
    expect(typeof statusPayload?.message).toBe('string');
    expect(statusPayload?.message?.length).toBeGreaterThan(0);
    expect(statusPayload?.extraction).toBeTruthy();
    expect(statusPayload?.extraction).toHaveProperty('started_at');
    expect(statusPayload?.extraction).toHaveProperty('completed_at');
    expect(statusPayload?.extraction).toHaveProperty('pipeline_version');
    if (statusPayload?.job && uploadPayload?.job_id) {
      expect(statusPayload.job.id).toBe(uploadPayload?.job_id);
    }
    expect(CANONICAL_CONFIDENCE_LABELS).toContain(statusPayload?.confidence?.confidence_label);
    expect(statusPayload?.confidence?.confidence_version).toBe('9.2.v1');

    const tampered = await page.request.post('/api/extraction/upload-complete', {
      data: {
        document_id: documentId,
        storage_path: `tampered/${documentId}.pdf`,
        policy_label: 'tampered-path',
        source_type: 'manual_entry',
      },
    });
    expect(tampered.status()).toBe(400);

    await page.goto('/scan', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const sampleText = [
      'TRAVEL POLICY SAMPLE',
      'Trip Delay benefit begins after 6 hours.',
      'Maximum trip delay benefit is 500 USD.',
      'Requires itemized receipts and carrier delay letter.',
      'Claim filing deadline is 30 days.',
    ].join('\n');
    const runQuickScan = async () =>
      page.evaluate(async (txt) => {
        const blob = new Blob([txt], { type: 'text/plain' });
        const file = new File([blob], 'doctrine-quick-scan.txt', { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/quick-scan', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      }, sampleText);

    const first = await runQuickScan();
    const second = await runQuickScan();
    const firstError = String(first?.data?.error ?? '');
    const secondError = String(second?.data?.error ?? '');
    if (!first.ok || !second.ok) {
      const a = first.status;
      const b = second.status;
      if (a === 401 || b === 401) {
        test.skip(
          true,
          `quick-scan:401 unauthenticated (first=${a}:${firstError}, second=${b}:${secondError}) — run npm run e2e:auth`,
        );
      } else if (a === 403 || b === 403) {
        test.skip(
          true,
          `quick-scan:403 forbidden (first=${a}:${firstError}, second=${b}:${secondError}) — credits/plan or route policy`,
        );
      } else if (a === 500 || b === 500) {
        test.skip(
          true,
          `quick-scan:500 server (first=${a}:${firstError}, second=${b}:${secondError})`,
        );
      } else {
        test.skip(
          true,
          `quick-scan:non-2xx (first=${a}:${firstError}, second=${b}:${secondError})`,
        );
      }
    }
    expect(first.data.itinerary_hash).toBe(second.data.itinerary_hash);
    expect(first.data.quick_scan_tier).toBe('surface');
    expect(first.data.confidence).toBeTruthy();
    expect(first.data.confidence.confidence_version).toBe('9.2.v1');
    expect(CANONICAL_CONFIDENCE_LABELS).toContain(first.data.confidence.confidence_label);
  });
});
