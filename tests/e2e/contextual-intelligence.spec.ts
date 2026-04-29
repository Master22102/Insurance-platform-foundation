import { expect, test, type APIRequestContext } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey, serviceRoleGet, serviceRolePatch, serviceRolePost } from './utils/serviceRoleRest';
import { hasSupabaseEnv, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

const GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';
const FEATURE_CI = 'F-6.6.14';

function logCtxSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[contextual-intelligence E2E] SKIPPED — ${reason}${tail}\n\n`);
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

async function ensureCiFeature(request: APIRequestContext, enabled: boolean) {
  const { status } = await serviceRolePatch(
    request,
    'feature_activation_state',
    `feature_id=eq.${FEATURE_CI}&region_id=eq.${GLOBAL_REGION}`,
    { enabled, reason_code: enabled ? 'e2e_on' : 'e2e_off' },
  );
  expect(status, 'patch F-6.6.14').toBeLessThan(300);
}

function row(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

/** Service-role insert (avoids short-lived JWT on `create_trip` RPC during E2E). */
async function createPreTripStructuredTrip(
  request: APIRequestContext,
  actorId: string,
  stamp: number,
  departure: string,
  ret: string,
  tag: string,
): Promise<string> {
  const t = await serviceRolePost(request, 'trips', {
    trip_name: `E2E CI ${tag} ${stamp}`,
    created_by: actorId,
    account_id: actorId,
    maturity_state: 'PRE_TRIP_STRUCTURED',
    jurisdiction_ids: [],
    travel_mode_primary: 'air',
    is_group_trip: false,
    lifecycle_flags: { e2e: true, suite: `ci-${tag}` },
    destination_summary: 'Oslo, NO',
    departure_date: departure,
    return_date: ret,
  });
  expect(t.status, JSON.stringify(t.data)).toBe(201);
  const tripId = row(t.data).trip_id as string;
  expect(tripId).toBeTruthy();
  return tripId;
}

test.describe('Contextual intelligence (F-6.6.14)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY for FOCL + profile patch.');
  test.use({ storageState: getStorageStatePath() });

  test('pre-trip panel shows departure countdown', async ({ page, request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logCtxSkip('No user id in storageState (run npm run e2e:auth)');
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');
    const safeActorId = actorId as string;

    await ensureCiFeature(request, true);
    const stamp = Date.now();
    const dep = iso(addDays(new Date(), 2));
    const ret = iso(addDays(new Date(), 9));
    const tripId = await createPreTripStructuredTrip(request, safeActorId, stamp, dep, ret, 'pretrip');

    await page.goto(`/trips/${tripId}?tab=Overview`);
    const panel = page.getByTestId('right-now-panel');
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).toContainText(/starts in 2 days|starts in/i);
  });

  test('quiet day when in-trip with no incidents', async ({ page, request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logCtxSkip('No user id in storageState (run npm run e2e:auth)');
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');
    const safeActorId = actorId as string;

    await ensureCiFeature(request, true);
    const stamp = Date.now();
    const dep = iso(addDays(new Date(), -2));
    const ret = iso(addDays(new Date(), 7));
    const tripId = await createPreTripStructuredTrip(request, safeActorId, stamp, dep, ret, 'quiet');

    await page.goto(`/trips/${tripId}?tab=Overview`);
    const panel = page.getByTestId('right-now-panel');
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).toContainText(/Day \d+ in/i);
  });

  test('open incident with no evidence shows evidence prompt', async ({ page, request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logCtxSkip('No user id in storageState (run npm run e2e:auth)');
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');
    const safeActorId = actorId as string;

    await ensureCiFeature(request, true);
    const stamp = Date.now();
    const dep = iso(addDays(new Date(), -1));
    const ret = iso(addDays(new Date(), 5));
    const tripId = await createPreTripStructuredTrip(request, safeActorId, stamp, dep, ret, 'evidence');

    const inc = await serviceRolePost(request, 'incidents', {
      trip_id: tripId,
      title: 'E2E contextual evidence only',
      description: 'No disruption keywords',
      status: 'Capture',
      canonical_status: 'OPEN',
      classification: 'External',
      control_type: 'External',
      created_by: safeActorId,
      metadata: {},
    });
    expect(inc.status, JSON.stringify(inc.data)).toBe(201);

    await page.goto(`/trips/${tripId}?tab=Overview`);
    const panel = page.getByTestId('right-now-panel');
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).toContainText(/evidence items/i);
  });

  test('dismiss persists for pre-trip prompt', async ({ page, request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logCtxSkip('No user id in storageState (run npm run e2e:auth)');
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');
    const safeActorId = actorId as string;

    await ensureCiFeature(request, true);
    const stamp = Date.now();
    const dep = iso(addDays(new Date(), 2));
    const ret = iso(addDays(new Date(), 9));
    const tripId = await createPreTripStructuredTrip(request, safeActorId, stamp, dep, ret, 'dismiss');

    await page.goto(`/trips/${tripId}?tab=Overview`);
    const panel = page.getByTestId('right-now-panel');
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).toContainText(/starts in/i);

    await page.getByTestId('right-now-dismiss').click();
    await page.reload();
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).not.toContainText(/starts in 2 days/i);
  });

  test('master toggle off shows contextual prompts off', async ({ page, request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logCtxSkip('No user id in storageState (run npm run e2e:auth)');
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');
    const safeActorId = actorId as string;

    await ensureCiFeature(request, true);

    const rows = await serviceRoleGet<Array<{ preferences: Record<string, unknown> }>>(
      request,
      'user_profiles',
      `user_id=eq.${safeActorId}&select=preferences`,
    );
    const prev = rows[0]?.preferences && typeof rows[0].preferences === 'object' ? rows[0].preferences : {};

    const { status } = await serviceRolePatch(request, 'user_profiles', `user_id=eq.${safeActorId}`, {
      preferences: {
        ...prev,
        contextual_intelligence: {
          enabled: false,
          preparation_prompts: true,
          evidence_suggestions: true,
          disruption_guidance: true,
          filing_deadline_warnings: true,
        },
      },
    });
    expect(status).toBeLessThan(300);

    const stamp = Date.now();
    const dep = iso(addDays(new Date(), 2));
    const ret = iso(addDays(new Date(), 9));
    const tripId = await createPreTripStructuredTrip(request, safeActorId, stamp, dep, ret, 'master-off');

    await page.goto(`/trips/${tripId}?tab=Overview`);
    const panel = page.getByTestId('right-now-panel');
    await panel.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(panel).toContainText(/Contextual prompts are off/i);

    await serviceRolePatch(request, 'user_profiles', `user_id=eq.${safeActorId}`, {
      preferences: {
        ...prev,
        contextual_intelligence: {
          enabled: true,
          preparation_prompts: true,
          evidence_suggestions: true,
          disruption_guidance: true,
          filing_deadline_warnings: true,
        },
      },
    });
  });
});
