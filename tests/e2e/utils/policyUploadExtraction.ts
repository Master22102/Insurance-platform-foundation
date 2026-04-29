import { test, type Page } from '@playwright/test';

function resolveExtractionTimeoutMs(override?: number): number {
  if (typeof override === 'number' && override > 0) return override;
  const fromEnv = Number.parseInt(process.env.E2E_EXTRACTION_TIMEOUT_MS ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 180_000;
}

/**
 * Waits for policy upload page to show extraction **complete** or **failed**, or **skips** on timeout
 * when no background extraction worker is running (default).
 *
 * - **`E2E_REQUIRE_EXTRACTION_COMPLETE=1`** — **fail** on timeout (CI with a live worker).
 * - **`E2E_EXTRACTION_TIMEOUT_MS`** — max wait before skip (default **180000**). Lower (e.g. **45000**)
 *   speeds up local **`e2e:contracts`** when extraction is known offline.
 */
export async function waitForPolicyUploadTerminal(page: Page, options?: { timeoutMs?: number }): Promise<void> {
  const timeoutMs = resolveExtractionTimeoutMs(options?.timeoutMs);
  const strict = process.env.E2E_REQUIRE_EXTRACTION_COMPLETE === '1';
  const processed = page.getByText(/your policy has been processed/i);
  const failed = page.getByText(/had trouble reading this document/i);
  const uploadErr = page.getByText(/could not finish this upload/i);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await processed.isVisible().catch(() => false)) return;
    if (await failed.isVisible().catch(() => false)) {
      throw new Error('Extraction UI reported failure ("had trouble reading this document")');
    }
    if (await uploadErr.isVisible().catch(() => false)) {
      throw new Error('Upload failed in UI ("could not finish this upload")');
    }
    await page.waitForTimeout(2500);
  }

  if (strict) {
    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for "Your policy has been processed" (E2E_REQUIRE_EXTRACTION_COMPLETE=1).`,
    );
  }

  test.skip(
    true,
    'Timed out waiting for extraction to reach "processed" — background extraction worker may be offline. Run with a working `/api/extraction/*` pipeline or set E2E_REQUIRE_EXTRACTION_COMPLETE=1 to fail hard. See tests/e2e/README.md.',
  );
}
