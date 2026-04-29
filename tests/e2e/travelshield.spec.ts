import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey, serviceRolePatch, serviceRolePost } from './utils/serviceRoleRest';
import { hasSupabaseEnv, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

function logSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[travelshield E2E] SKIPPED — ${reason}${tail}\n\n`);
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function row(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

async function createTripForActor(
  request: import('@playwright/test').APIRequestContext,
  actorId: string,
  stamp: number,
): Promise<string> {
  const t = await serviceRolePost(request, 'trips', {
    trip_name: `E2E TravelShield ${stamp}`,
    created_by: actorId,
    account_id: actorId,
    maturity_state: 'PRE_TRIP_STRUCTURED',
    jurisdiction_ids: [],
    travel_mode_primary: 'air',
    is_group_trip: false,
    lifecycle_flags: { e2e: true, suite: 'travelshield' },
    destination_summary: 'Oslo, NO',
    departure_date: iso(addDays(new Date(), 1)),
    return_date: iso(addDays(new Date(), 8)),
  });
  expect(t.status, JSON.stringify(t.data)).toBe(201);
  const tripId = row(t.data).trip_id as string;
  expect(tripId).toBeTruthy();
  return tripId;
}

test.describe.serial('TravelShield (F-6.6.13)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY.');
  test.use({ storageState: getStorageStatePath() });

  let actorId: string | null;
  let tripId: string;
  let groupId: string;
  let inviteToken: string;

  test.beforeAll(() => {
    actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logSkip('No user id in storageState (run npm run e2e:auth)');
  });

  test('group creation + validate-token + duplicate join rejected', async ({ request }) => {
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    const stamp = Date.now();
    tripId = await createTripForActor(request, actorId!, stamp);

    const createRes = await request.post('/api/travelshield/create-group', {
      data: { trip_id: tripId },
      headers: { 'Content-Type': 'application/json' },
    });
    if (createRes.status() === 503) {
      logSkip('Next server missing SUPABASE_SERVICE_ROLE_KEY (503 on create-group)');
      test.skip();
    }
    expect(createRes.status(), await createRes.text()).toBe(200);
    const created = (await createRes.json()) as { group_id: string; token: string };
    groupId = created.group_id;
    inviteToken = created.token;
    expect(groupId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(inviteToken.length).toBeGreaterThan(10);

    const v = await request.get(`/api/travelshield/validate-token?token=${encodeURIComponent(inviteToken)}`);
    expect(v.status()).toBe(200);
    const vj = (await v.json()) as { valid: boolean; member_count?: number };
    expect(vj.valid).toBe(true);
    expect(typeof vj.member_count).toBe('number');

    const joinDup = await request.post('/api/travelshield/join', {
      data: { token: inviteToken },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(joinDup.status()).toBe(409);
  });

  test('trip Overview shows ActiveGroupCard when group linked', async ({ page }) => {
    test.skip(!actorId || !tripId, 'Prereq missing');
    await page.goto(`/trips/${tripId}?tab=Overview`, { waitUntil: 'domcontentloaded' });
    // Trip detail fetches after auth/session hydrate; wait for shell before TravelShield panel.
    await expect(page.getByRole('heading', { name: /E2E TravelShield/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Overview' }).click();
    const card = page.getByTestId('travelshield-active-card');
    await expect(card).toBeVisible({ timeout: 35_000 });
    await expect(card).toContainText(/TravelShield|Safety group/i);
  });

  test('settings update persisted', async ({ request }) => {
    test.skip(!actorId || !groupId, 'Prereq missing');
    const res = await request.put(`/api/travelshield/${groupId}/settings`, {
      data: {
        trust_level: 'just_met',
        check_in_interval_hours: 3,
        deactivation_requires_code: false,
        duration_type: 'indefinite',
        activate: true,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const j = (await res.json()) as { settings?: { trust_level?: string } };
    expect(j.settings?.trust_level).toBe('just_met');
  });

  test('expired token fails validation', async ({ request }) => {
    test.skip(!actorId || !inviteToken, 'Prereq missing');
    const past = new Date(Date.now() - 60_000).toISOString();
    const patch = await serviceRolePatch(
      request,
      'travelshield_join_tokens',
      `token=eq.${encodeURIComponent(inviteToken)}`,
      { expires_at: past, is_active: true },
    );
    expect(patch.status, JSON.stringify(patch.data)).toBeLessThan(300);

    const v = await request.get(`/api/travelshield/validate-token?token=${encodeURIComponent(inviteToken)}`);
    expect(v.status()).toBe(200);
    const vj = (await v.json()) as { valid: boolean; reason?: string };
    expect(vj.valid).toBe(false);
    expect(vj.reason).toMatch(/expired|inactive/);
  });

  test('leave group dissolves when last member', async ({ request }) => {
    test.skip(!actorId || !groupId, 'Prereq missing');
    const res = await request.post(`/api/travelshield/${groupId}/leave`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const j = (await res.json()) as { group_dissolved?: boolean };
    expect(j.group_dissolved).toBe(true);

    const g = await request.get(`/api/travelshield/${groupId}`);
    expect(g.status()).toBe(403);
  });
});
