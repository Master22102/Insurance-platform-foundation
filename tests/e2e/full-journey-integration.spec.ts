import { test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { runFullJourneyToClaimPacket } from './utils/fullJourney.e2e';
import { E2E_AUTH_SKIP_REASON, hasSupabaseEnv, readAccessTokenFromStorageState } from './utils/supabaseRest';

test.describe('Full journey integration', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('authenticated: trip → policy seed → graph → route → claim packet PDF', async ({ page, request }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Claim-route UI + packet flow is validated on Chromium desktop (layout/timing).',
    );
    test.setTimeout(180_000);
    const token = readAccessTokenFromStorageState();
    test.skip(!token, E2E_AUTH_SKIP_REASON);
    await runFullJourneyToClaimPacket(page, request, token as string, Date.now());
  });
});
