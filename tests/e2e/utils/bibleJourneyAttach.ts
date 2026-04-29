import type { TestInfo } from '@playwright/test';

export type BibleStepStatus = 'pass' | 'skip' | 'fail';

export type BibleStepPayload = {
  bibleStep: string;
  surface: string;
  status: BibleStepStatus;
  note: string;
};

/**
 * Attach structured metadata for bible journey CI artifacts (flow truth: docs/SYSTEM_TRUTH_HIERARCHY_AND_SECTION5_RECONCILIATION.md).
 */
export async function attachBibleStep(testInfo: TestInfo, params: BibleStepPayload): Promise<void> {
  const safeName = params.bibleStep.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'step';
  const body = JSON.stringify({ ...params, ts: new Date().toISOString() });
  await testInfo.attach(`bible-${safeName}`, {
    body: Buffer.from(body, 'utf-8'),
    contentType: 'application/json',
  });
}
