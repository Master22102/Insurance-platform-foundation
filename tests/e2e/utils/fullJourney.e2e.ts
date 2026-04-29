import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  acceptTermsGateIfPresent,
  ensureOnboarded,
  gotoAuthPathWithRecovery,
  recoverSessionLoadingIfPresent,
} from './ensureOnboarded';
import { setupRoutingReadyIncident } from './routingReadyIncident';
import { supabaseRestSelect, supabaseRpc } from './supabaseRest';

async function waitForIncidentRoutingReady(
  request: APIRequestContext,
  token: string,
  incidentId: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const rows = await supabaseRestSelect<Array<{ canonical_status: string | null }>>(
          request,
          token,
          'incidents',
          `id=eq.${incidentId}&select=canonical_status`,
        );
        return rows[0]?.canonical_status ?? '';
      },
      { timeout: 60_000 },
    )
    .toBe('CLAIM_ROUTING_READY');
}

/**
 * Happy path: seeded coverage → graph → route UI → packet → PDF bytes.
 */
export async function runFullJourneyToClaimPacket(
  page: Page,
  request: APIRequestContext,
  token: string,
  stamp: number,
): Promise<void> {
  await ensureOnboarded(page);
  const { actorId, tripId, incidentId } = await setupRoutingReadyIncident(request, token, stamp, {
    suiteTag: 'full-journey',
  });
  const g = await supabaseRpc(request, token, 'compute_coverage_graph', {
    p_trip_id: tripId,
    p_actor_id: actorId,
  });
  expect(g.status).toBe(200);
  expect((g.data as { ok?: boolean }).ok).toBe(true);

  await waitForIncidentRoutingReady(request, token, incidentId);

  // Another worker may call `reopenOnboarding` on the same user while RPCs run — re-sync shell.
  await ensureOnboarded(page);
  await gotoAuthPathWithRecovery(page, '/trips');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  await gotoAuthPathWithRecovery(page, `/trips/${tripId}/incidents/${incidentId}/route`);
  await expect(page).toHaveURL(new RegExp(`/incidents/${incidentId}/route`), { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // Deep links can render behind a terms overlay; dismiss it then wait for the route UI.
  for (let attempt = 0; attempt < 3; attempt++) {
    await recoverSessionLoadingIfPresent(page);
    await acceptTermsGateIfPresent(page);
    const routeUi = page.getByText(/Route this claim/i).first();
    try {
      await expect(routeUi).toBeVisible({ timeout: 35_000 });
      break;
    } catch {
      if (attempt === 2) throw new Error('Route claim UI did not appear after overlays + reloads');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    }
  }

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
  const recipient = `E2E Journey ${stamp}`;
  await page.getByPlaceholder(/allianz travel insurance/i).fill(recipient);
  await page.getByRole('button', { name: /save routing details/i }).click();

  // Success UI uses h2 "Claim packet prepared" (no separate "routing details saved" heading).
  await expect(page.getByRole('heading', { name: /claim packet prepared/i })).toBeVisible({ timeout: 120_000 });

  const packets = await supabaseRestSelect<Array<{ packet_id: string }>>(
    request,
    token,
    'claim_packets',
    `incident_id=eq.${incidentId}&select=packet_id&limit=3`,
  );
  expect(packets.length).toBeGreaterThan(0);
  const pdf = await page.request.get(`/api/claim-packet/generate?packet_id=${packets[0]!.packet_id}`);
  expect(pdf.status()).toBe(200);
  expect((pdf.headers()['content-type'] || '').toLowerCase()).toContain('pdf');
  const buf = await pdf.body();
  expect(buf.byteLength).toBeGreaterThan(500);
}
