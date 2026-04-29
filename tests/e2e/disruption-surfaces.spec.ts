import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { E2E_AUTH_SKIP_REASON, hasSupabaseEnv, readAccessTokenFromStorageState, supabaseRestSelect, supabaseRpc } from './utils/supabaseRest';
import { hasServiceRoleKey, serviceRolePatch, serviceRolePost } from './utils/serviceRoleRest';

type Setup = { actorId: string; tripId: string; incidentId: string };

async function createTripAndIncident(
  request: import('@playwright/test').APIRequestContext,
  accessToken: string,
  stamp: number,
  disruptionType: 'flight_delay' | 'trip_cancellation' | 'baggage_delay',
): Promise<Setup> {
  const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, accessToken, 'user_profiles', 'select=user_id&limit=1');
  const actorId = me[0]?.user_id as string;

  const createTrip = await supabaseRpc(request, accessToken, 'create_trip', {
    p_trip_name: `E2E disrupt ${stamp}`,
    p_account_id: actorId,
    p_maturity_state: 'DRAFT',
    p_jurisdiction_ids: [],
    p_travel_mode_primary: 'air',
    p_is_group_trip: false,
    p_group_id: null,
    p_metadata: { e2e: true, suite: 'disruption-surfaces' },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-disrupt-trip-${stamp}-${disruptionType}`,
    p_destination_summary: 'Paris, FR',
    p_departure_date: '2026-05-10',
    p_return_date: '2026-05-15',
  });
  expect(createTrip.status, JSON.stringify(createTrip.error)).toBe(200);
  const tripId = (createTrip.data as Record<string, unknown>).trip_id as string;
  expect(tripId).toBeTruthy();

  const createIncident = await supabaseRpc(request, accessToken, 'create_incident', {
    p_trip_id: tripId,
    p_title: `E2E incident ${stamp}`,
    p_description: 'E2E disruption event',
    p_classification: 'External',
    p_control_type: 'External',
    p_metadata: { disruption_type: disruptionType, e2e: true },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-disrupt-incident-${stamp}-${disruptionType}`,
  });
  expect(createIncident.status, JSON.stringify(createIncident.error)).toBe(200);
  const incidentId = (createIncident.data as Record<string, unknown>).incident_id as string;
  expect(incidentId).toBeTruthy();

  const normalized = disruptionType.includes('cancel')
    ? 'cancellation'
    : disruptionType.includes('baggage')
      ? 'baggage'
      : 'delay';
  const patched = await serviceRolePatch(request, 'incidents', `id=eq.${incidentId}`, { disruption_type: normalized });
  expect([200, 204], JSON.stringify(patched.data)).toContain(patched.status);

  return { actorId, tripId, incidentId };
}

test.describe.serial('Disruption surfaces', () => {
  test.skip(!hasStorageState(), 'Missing storage state');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY');
  test.use({ storageState: getStorageStatePath() });

  const t = readAccessTokenFromStorageState();
  test.skip(!t, E2E_AUTH_SKIP_REASON);
  const token = t as string;

  test('resolution tracker renders with documented step', async ({ page, request }) => {
    const setup = await createTripAndIncident(request, token, Date.now(), 'flight_delay');
    await page.goto(`/trips/${setup.tripId}/incidents/${setup.incidentId}`);
    await expect(page.getByTestId('resolution-tracker')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('resolution-tracker').getByText('Delay documented', { exact: false })).toBeVisible();
  });

  test('step progression moves after expense evidence is added', async ({ page, request }) => {
    const stamp = Date.now();
    const setup = await createTripAndIncident(request, token, stamp, 'trip_cancellation');

    const snapshot = await serviceRolePost(request, 'coverage_graph_snapshots', {
      trip_id: setup.tripId,
      input_hash: `e2e-${stamp}`,
      graph_status: 'COMPLETE',
    });
    expect([200, 201], JSON.stringify(snapshot.data)).toContain(snapshot.status);
    const snapshotRow = (Array.isArray(snapshot.data) ? snapshot.data[0] : snapshot.data) as { snapshot_id?: string };
    const snapshotId = snapshotRow.snapshot_id as string;
    expect(snapshotId).toBeTruthy();

    const summary = await serviceRolePost(request, 'coverage_summaries', {
      snapshot_id: snapshotId,
      trip_id: setup.tripId,
      benefit_type: 'trip_cancellation',
      shortest_waiting_period_hours: 0,
      combined_limit: 1200,
      combined_currency: 'USD',
    });
    expect([200, 201], JSON.stringify(summary.data)).toContain(summary.status);

    const carrier = await serviceRolePost(request, 'carrier_responses', {
      incident_id: setup.incidentId,
      trip_id: setup.tripId,
      account_id: setup.actorId,
      action_type: 'rebooking_offered',
      action_label: 'Rebooking offered',
    });
    expect([200, 201], JSON.stringify(carrier.data)).toContain(carrier.status);

    await page.goto(`/trips/${setup.tripId}/incidents/${setup.incidentId}`);
    await expect(page.getByTestId('resolution-tracker').getByText('Expenses captured', { exact: false })).toBeVisible();
    await expect(page.getByTestId('resolution-tracker').getByRole('button', { name: 'Upload receipt' })).toBeVisible();

    const addEvidence = await supabaseRpc(request, token, 'register_evidence', {
      p_incident_id: setup.incidentId,
      p_type: 'other',
      p_name: `E2E receipt ${stamp}`,
      p_description: 'Meal receipt',
      p_metadata: { category: 'receipt', e2e: true },
      p_actor_id: setup.actorId,
      p_idempotency_key: `e2e-receipt-${stamp}`,
    });
    expect(addEvidence.status, JSON.stringify(addEvidence.error)).toBe(200);

    await page.reload();
    await expect(page.getByTestId('resolution-tracker').getByRole('button', { name: 'Route claim' })).toBeVisible({ timeout: 10_000 });
  });

  test('disruption options panel shows delay guidance', async ({ page, request }) => {
    const setup = await createTripAndIncident(request, token, Date.now(), 'flight_delay');
    await page.goto(`/trips/${setup.tripId}/incidents/${setup.incidentId}`);
    await expect(page.getByTestId('disruption-options-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Your flight is delayed.', { exact: false })).toBeVisible();
  });

  test('coverage values appear in guidance when present', async ({ page, request }) => {
    const stamp = Date.now();
    const setup = await createTripAndIncident(request, token, stamp, 'flight_delay');
    const snapshot = await serviceRolePost(request, 'coverage_graph_snapshots', {
      trip_id: setup.tripId,
      input_hash: `e2e-delay-${stamp}`,
      graph_status: 'COMPLETE',
    });
    expect([200, 201], JSON.stringify(snapshot.data)).toContain(snapshot.status);
    const snapshotRow = (Array.isArray(snapshot.data) ? snapshot.data[0] : snapshot.data) as { snapshot_id?: string };
    const snapshotId = snapshotRow.snapshot_id as string;
    expect(snapshotId).toBeTruthy();

    const summary = await serviceRolePost(request, 'coverage_summaries', {
      snapshot_id: snapshotId,
      trip_id: setup.tripId,
      benefit_type: 'trip_delay',
      shortest_waiting_period_hours: 3,
      combined_limit: 450,
      combined_currency: 'USD',
    });
    expect([200, 201], JSON.stringify(summary.data)).toContain(summary.status);

    await page.goto(`/trips/${setup.tripId}/incidents/${setup.incidentId}`);
    await expect(page.getByTestId('disruption-options-panel')).toContainText('after 3 hours', { timeout: 15_000 });
    await expect(page.getByTestId('disruption-options-panel')).toContainText('USD 450');
  });

  test('statutory rights page renders sections', async ({ page }) => {
    await page.goto('/rights');
    await expect(page.getByTestId('rights-page-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'EU Regulation 261/2004 - Air Passenger Rights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Montreal Convention - International Baggage Liability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'US Department of Transportation - Passenger Protections' })).toBeVisible();
  });

  test('deep link from disruption panel to EU261 works', async ({ page, request }) => {
    const setup = await createTripAndIncident(request, token, Date.now(), 'flight_delay');
    await page.goto(`/trips/${setup.tripId}/incidents/${setup.incidentId}`);
    await page.getByRole('link', { name: 'View EU261 rights' }).click();
    await expect(page).toHaveURL(/\/rights#eu261$/);
    await expect(page.getByRole('heading', { name: 'EU Regulation 261/2004 - Air Passenger Rights' })).toBeVisible();
  });
});
