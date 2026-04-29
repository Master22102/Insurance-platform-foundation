import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey, serviceRolePost } from './utils/serviceRoleRest';
import { hasSupabaseEnv, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

function logSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[group-authority-ui E2E] SKIPPED — ${reason}${tail}\n\n`);
}

async function createGroupTrip(request: import('@playwright/test').APIRequestContext, actorId: string, label: string) {
  const stamp = Date.now();
  const t = await serviceRolePost(request, 'trips', {
    trip_name: `${label} ${stamp}`,
    created_by: actorId,
    account_id: actorId,
    maturity_state: 'PRE_TRIP_STRUCTURED',
    jurisdiction_ids: [],
    travel_mode_primary: 'air',
    is_group_trip: true,
    lifecycle_flags: { e2e: true, suite: 'group-authority-ui' },
    destination_summary: 'Test Destination',
    departure_date: new Date().toISOString().slice(0, 10),
    return_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
  });
  if (t.status !== 201) return { ok: false as const, data: t.data };
  const row = (Array.isArray(t.data) ? t.data[0] : t.data) as { trip_id?: string };
  const tripId = row.trip_id as string;
  await serviceRolePost(request, 'group_participants', {
    trip_id: tripId,
    account_id: actorId,
    role: 'organizer',
    status: 'active',
    metadata: {},
    created_by: actorId,
  });
  return { ok: true as const, tripId };
}

test.describe.serial('Group authority UI (Section 2.0)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY.');
  test.use({ storageState: getStorageStatePath() });

  let actorId: string | null;
  /** Per browser project — avoids two workers overwriting one `tripId` while running this file in parallel. */
  const tripIdByProject: Record<string, string> = {};

  test.beforeAll(() => {
    actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) logSkip('No user id in storageState (run npm run e2e:auth)');
  });

  test('setup: group trip + participant row for actor', async ({ request }, testInfo) => {
    test.skip(!actorId, 'No actor');
    const r = await createGroupTrip(request, actorId!, 'E2E Group UI');
    if (!r.ok) {
      logSkip('trip insert failed', r.data);
      test.skip();
    }
    const tripId = r.tripId as string;
    tripIdByProject[testInfo.project.name] = tripId;
    await serviceRolePost(request, 'group_coverage_summary', {
      trip_id: tripId,
      account_id: actorId,
      has_any_policy: true,
      coverage_gap_count: 0,
      checklist_completion_pct: 100,
    });
  });

  test('organizer dashboard: group page shows coverage badges', async ({ page }, testInfo) => {
    const tripId = tripIdByProject[testInfo.project.name];
    test.skip(!actorId || !tripId, 'Prereq');
    await page.goto(`/trips/${tripId}/group`);
    await expect(page.getByTestId('group-authority-root')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('group-page-data-ready')).toBeAttached({ timeout: 45_000 });
    await expect(page.getByTestId('group-dashboard-participant-readiness')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('group-trip-title')).toContainText(/E2E Group UI|Trip|Loading/, { timeout: 5_000 });
    await expect(page.getByText('Policy attached', { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Checklist 100%', { exact: false })).toBeVisible();
  });

  test('coverage recommendation API creates row + notification (smoke)', async ({ request }, testInfo) => {
    const tripId = tripIdByProject[testInfo.project.name];
    test.skip(!actorId || !tripId, 'Prereq');
    const res = await request.post('/api/group/recommend-coverage', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        trip_id: tripId,
        recommended_policy_label: 'E2E Catalog Policy',
        coverage_domains: ['medical'],
        requirement_level: 'suggestion',
        recipient_account_ids: [actorId],
        add_on_notes: {},
      },
    });
    if (res.status() === 503) {
      logSkip('recommend-coverage 503 (service role / migration not applied)');
      test.skip();
    }
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = (await res.json()) as { recommendation_id?: string };
    expect(body.recommendation_id).toBeTruthy();
  });

  test('participant response: have_equivalent (pending review)', async ({ request }, testInfo) => {
    const tripId = tripIdByProject[testInfo.project.name];
    test.skip(!actorId || !tripId, 'Prereq');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
    test.skip(!url || !sr, 'Supabase REST env');
    const list = await request.get(
      `${url}/rest/v1/group_coverage_recommendations?trip_id=eq.${tripId}&select=recommendation_id&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${sr}`,
        },
      },
    );
    if (!list.ok()) {
      logSkip('Could not list recommendations (table missing?)');
      test.skip();
    }
    const rows = (await list.json()) as { recommendation_id: string }[];
    const rid = rows[0]?.recommendation_id;
    test.skip(!rid, 'No recommendation row');

    const res = await request.post('/api/group/coverage-requirement-response', {
      headers: { 'Content-Type': 'application/json' },
      data: { recommendation_id: rid, response: 'have_equivalent' },
    });
    if (res.status() === 503) {
      logSkip('coverage-requirement-response 503');
      test.skip();
    }
    expect(res.ok(), await res.text()).toBeTruthy();
    const j = (await res.json()) as { pending_organizer_review?: boolean };
    expect(j.pending_organizer_review).toBeTruthy();
  });

  test('refresh coverage summary API', async ({ request }, testInfo) => {
    const tripId = tripIdByProject[testInfo.project.name];
    test.skip(!actorId || !tripId, 'Prereq');
    const res = await request.post('/api/group/refresh-coverage-summary', {
      headers: { 'Content-Type': 'application/json' },
      data: { trip_id: tripId },
    });
    if (res.status() === 503) {
      logSkip('refresh-coverage-summary 503');
      test.skip();
    }
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('school trip: verification row shows dual-consent fields in UI', async ({ page, request }) => {
    test.skip(!actorId, 'No actor');
    const r = await createGroupTrip(request, actorId!, 'E2E School');
    if (!r.ok) {
      logSkip('school trip create failed', r.data);
      test.skip();
    }
    const schoolTripId = r.tripId;
    const ins = await serviceRolePost(request, 'relationship_verification_requests', {
      requester_id: actorId,
      subject_id: actorId,
      trip_id: schoolTripId,
      trip_type: 'school',
      status: 'pending',
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      requires_dual_approval: true,
      subject_approved: true,
      guardian_approved: false,
      guardian_id: actorId,
    });
    if (ins.status !== 201) {
      logSkip('could not seed verification request', ins.data);
      test.skip();
    }
    await page.goto(`/trips/${schoolTripId}/group`);
    await expect(page.getByTestId('group-page-data-ready')).toBeAttached({ timeout: 30_000 });
    const schoolPanel = page.getByTestId('school-trip-panel');
    await expect(schoolPanel).toBeVisible({ timeout: 15_000 });
    await expect(schoolPanel.getByRole('heading', { name: 'School trip' })).toBeVisible();
    await expect(page.getByText('Student approved, awaiting guardian', { exact: false })).toBeVisible();
  });

  test('corporate trip: panel shows 168hr window', async ({ page, request }) => {
    test.skip(!actorId, 'No actor');
    const r = await createGroupTrip(request, actorId!, 'E2E Corporate');
    if (!r.ok) {
      logSkip('corporate trip create failed', r.data);
      test.skip();
    }
    const corpTripId = r.tripId;
    await serviceRolePost(request, 'relationship_verification_requests', {
      requester_id: actorId,
      subject_id: actorId,
      trip_id: corpTripId,
      trip_type: 'corporate',
      status: 'pending',
      expires_at: new Date(Date.now() + 168 * 3600 * 1000).toISOString(),
      requires_dual_approval: false,
      subject_approved: false,
      guardian_approved: false,
    });
    await page.goto(`/trips/${corpTripId}/group`);
    await expect(page.getByTestId('group-page-data-ready')).toBeAttached({ timeout: 35_000 });
    const corpPanel = page.getByTestId('corporate-trip-panel');
    await expect(corpPanel).toBeVisible({ timeout: 15_000 });
    await expect(corpPanel.getByText('168 hours', { exact: false })).toBeVisible();
    await expect(corpPanel.getByText('No guardian consent', { exact: false })).toBeVisible();
  });
});
