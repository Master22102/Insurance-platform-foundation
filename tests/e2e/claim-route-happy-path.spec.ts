import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';
import { setupRoutingReadyIncident } from './utils/routingReadyIncident';

/**
 * Browser + Supabase client: claim routing page loads when incident is CLAIM_ROUTING_READY.
 * RPC setup mirrors `claim-packet-contract.spec.ts` (shared util).
 */
test.describe('Claim route page (browser happy path)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('shows Route this claim after RPC seeds routing-ready incident', async ({ page, request }) => {
    test.setTimeout(120_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const stamp = Date.now();
    const { tripId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'claim-route-happy-path',
    });

    await page.goto(`/trips/${tripId}/incidents/${incidentId}/route`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', { name: /route this claim/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/tell us who you.re filing with/i)).toBeVisible();
  });

  test('submits routing form and shows success state with packet', async ({ page, request }) => {
    test.setTimeout(180_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const stamp = Date.now();
    const { tripId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'claim-route-submit',
    });

    await page.goto(`/trips/${tripId}/incidents/${incidentId}/route`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /route this claim/i })).toBeVisible({ timeout: 30_000 });

    // Label + select share a wrapper div; a broad ancestor matches many <select> (strict mode violation).
    await page
      .getByText('Which option best matches what happened?', { exact: true })
      .locator('..')
      .locator('select')
      .selectOption('airline_clear');

    await page
      .getByText('Recipient type', { exact: true })
      .locator('..')
      .locator('select')
      .selectOption('travel_insurer');

    const recipient = `E2E Routing ${stamp}`;
    await page.getByPlaceholder(/allianz travel insurance/i).fill(recipient);

    await page.getByRole('button', { name: /save routing details/i }).click();

    await expect(page.getByRole('heading', { name: /claim packet prepared/i })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(recipient, { exact: true })).toBeVisible();

    const incidentRows = await supabaseRestSelect<Array<{ canonical_status: string }>>(
      request,
      accessToken,
      'incidents',
      `id=eq.${incidentId}&select=canonical_status&limit=1`,
    );
    expect(incidentRows.length).toBe(1);
    expect(incidentRows[0]?.canonical_status).toBe('SUBMITTED');

    const packetRows = await supabaseRestSelect<Array<{ packet_id: string; incident_id: string }>>(
      request,
      accessToken,
      'claim_packets',
      `incident_id=eq.${incidentId}&select=packet_id,incident_id&limit=5`,
    );
    expect(packetRows.length).toBeGreaterThan(0);
  });
});
