import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import {
  hasServiceRoleKey,
  serviceRoleGet,
  serviceRolePatch,
  serviceRolePost,
  serviceRoleRpc,
} from './utils/serviceRoleRest';
import { hasSupabaseEnv, readAccessTokenFromStorageState, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

const GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';

function logSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[travelshield-phase2 E2E] SKIPPED — ${reason}${tail}\n\n`);
}

function row(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

async function enableTravelShieldPhase2Features(request: import('@playwright/test').APIRequestContext) {
  for (const fid of ['F-6.6.13-location', 'F-6.6.13-checkin']) {
    await serviceRolePatch(request, 'feature_activation_state', `feature_id=eq.${fid}&region_id=eq.${GLOBAL_REGION}`, {
      enabled: true,
    });
  }
}

test.describe.serial('TravelShield Phase 2 (F-6.6.13)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY.');
  test.use({ storageState: getStorageStatePath() });

  let actorId: string | null;
  let tripId: string;
  let groupId: string;

  test.beforeAll(() => {
    actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logSkip('No user id in storageState (run npm run e2e:auth)');
  });

  test('bridge: create group with trip_id yields group_participants', async ({ request }) => {
    test.skip(!actorId, 'No actor');

    await enableTravelShieldPhase2Features(request);

    const stamp = Date.now();
    const t = await serviceRolePost(request, 'trips', {
      trip_name: `E2E TS2 ${stamp}`,
      created_by: actorId,
      account_id: actorId,
      maturity_state: 'PRE_TRIP_STRUCTURED',
      jurisdiction_ids: [],
      travel_mode_primary: 'air',
      is_group_trip: false,
      lifecycle_flags: { e2e: true, suite: 'travelshield-phase2' },
      destination_summary: 'Test',
      departure_date: new Date().toISOString().slice(0, 10),
      return_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    });
    expect(t.status, JSON.stringify(t.data)).toBe(201);
    tripId = row(t.data).trip_id as string;

    const createRes = await request.post('/api/travelshield/create-group', {
      data: { trip_id: tripId },
      headers: { 'Content-Type': 'application/json' },
    });
    if (createRes.status() === 503) {
      logSkip('create-group 503');
      test.skip();
    }
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const created = (await createRes.json()) as { group_id: string };
    groupId = created.group_id;

    const parts = await serviceRoleGet<Array<{ account_id: string; trip_id: string }>>(
      request,
      'group_participants',
      `select=account_id,trip_id&trip_id=eq.${tripId}`,
    );
    expect(parts.some((p) => p.account_id === actorId && p.trip_id === tripId)).toBeTruthy();
  });

  test('RLS: participant can select trip row via REST (trips_select_group_participant)', async ({ request }) => {
    test.skip(!actorId || !tripId, 'Prereq');
    const token = readAccessTokenFromStorageState();
    test.skip(!token, 'No access token');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(!url, 'No supabase url');
    const res = await request.get(`${url}/rest/v1/trips?trip_id=eq.${tripId}&select=trip_id`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = (await res.json()) as Array<{ trip_id: string }>;
    expect(data.some((r) => r.trip_id === tripId)).toBeTruthy();
  });

  test('location ping + locations aggregate', async ({ request }) => {
    test.skip(!actorId || !groupId, 'Prereq');
    const ping = await request.post(`/api/travelshield/${groupId}/ping`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        latitude: 59.9139,
        longitude: 10.7522,
        accuracy_meters: 12,
        battery_level: 80,
        is_moving: false,
      },
    });
    expect(ping.ok(), await ping.text()).toBeTruthy();

    const loc = await request.get(`/api/travelshield/${groupId}/locations`);
    expect(loc.ok(), await loc.text()).toBeTruthy();
    const lj = (await loc.json()) as { locations: Array<{ account_id: string }> };
    expect(lj.locations.some((x) => x.account_id === actorId)).toBeTruthy();
  });

  test('check-in API rejects self-target', async ({ request }) => {
    test.skip(!actorId || !groupId, 'Prereq');
    const post = await request.post(`/api/travelshield/${groupId}/checkin`, {
      headers: { 'Content-Type': 'application/json' },
      data: { target_account_id: actorId },
    });
    expect(post.status()).toBe(400);
  });

  test('check-in PUT safe responds as target (seeded row)', async ({ request }) => {
    test.skip(!actorId || !groupId, 'Prereq');
    const { data: ins, status } = await serviceRolePost(request, 'travelshield_checkins', {
      group_id: groupId,
      requested_by: actorId,
      requested_of: actorId,
      checkin_type: 'manual',
      status: 'pending',
      escalation_level: 0,
      metadata: { e2e_seeded: true },
    });
    expect(status).toBe(201);
    const cid = row(ins).checkin_id as string;

    const put = await request.put(`/api/travelshield/${groupId}/checkin`, {
      headers: { 'Content-Type': 'application/json' },
      data: { checkin_id: cid, response: 'safe' },
    });
    expect(put.ok(), await put.text()).toBeTruthy();

    const after = await serviceRoleGet<Array<{ status: string; responded_at: string | null }>>(
      request,
      'travelshield_checkins',
      `select=status,responded_at&checkin_id=eq.${cid}`,
    );
    expect(after[0].status).toBe('safe');
    expect(after[0].responded_at).toBeTruthy();
  });

  test('escalation processor advances pending check-in', async ({ request }) => {
    test.skip(!groupId || !actorId, 'Prereq');
    const { data: ins, status } = await serviceRolePost(request, 'travelshield_checkins', {
      group_id: groupId,
      requested_by: actorId,
      requested_of: actorId,
      checkin_type: 'manual',
      status: 'pending',
      escalation_level: 0,
      metadata: {},
    });
    expect(status).toBe(201);
    const cid = row(ins).checkin_id as string;
    const old = new Date(Date.now() - 50 * 60_000).toISOString();
    await serviceRolePatch(request, 'travelshield_checkins', `checkin_id=eq.${cid}`, {
      created_at: old,
    });

    const proc = await request.post('/api/travelshield/escalation-processor', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(proc.ok(), await proc.text()).toBeTruthy();

    const rows = await serviceRoleGet<Array<{ escalation_level: number; reminder_sent_at: string | null }>>(
      request,
      'travelshield_checkins',
      `select=escalation_level,reminder_sent_at,second_reminder_sent_at,emergency_contact_notified_at&checkin_id=eq.${cid}`,
    );
    const r = rows[0];
    expect(r.reminder_sent_at).toBeTruthy();
    expect(r.escalation_level).toBeGreaterThanOrEqual(1);
  });

  test('battery saver pause emits via ping API', async ({ request }) => {
    test.skip(!groupId, 'Prereq');
    const res = await request.post(`/api/travelshield/${groupId}/ping`, {
      headers: { 'Content-Type': 'application/json' },
      data: { pause_for_battery_saver: true },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('cleanup_old_location_pings RPC returns integer', async ({ request }) => {
    const { data, status } = await serviceRoleRpc(request, 'cleanup_old_location_pings', {});
    expect(status).toBe(200);
    const n = typeof data === 'number' ? data : Number(data);
    expect(Number.isFinite(n)).toBeTruthy();
  });

  test('organizer coverage summary GET', async ({ request }) => {
    test.skip(!actorId || !tripId || !groupId, 'Prereq');
    await serviceRolePost(request, 'group_coverage_summary', {
      trip_id: tripId,
      account_id: actorId,
      has_any_policy: true,
      coverage_gap_count: 0,
      checklist_completion_pct: 80,
      last_evaluated_at: new Date().toISOString(),
    }).catch(() => {});

    const res = await request.get(`/api/travelshield/${groupId}/coverage-summary`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const j = (await res.json()) as {
      summaries: Array<{ account_id?: string; has_any_policy?: boolean; coverage_gap_count?: number }>;
    };
    expect(Array.isArray(j.summaries)).toBeTruthy();
    const mine = j.summaries.find((s) => s.account_id === actorId);
    expect(mine?.has_any_policy).toBeTruthy();
    expect(typeof mine?.coverage_gap_count).toBe('number');
  });
});
