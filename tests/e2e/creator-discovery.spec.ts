import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { E2E_AUTH_SKIP_REASON, hasSupabaseEnv, readAccessTokenFromStorageState, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';
import { hasServiceRoleKey, serviceRoleDelete, serviceRoleGet, serviceRolePatch, serviceRolePost } from './utils/serviceRoleRest';

type TripRow = { trip_id: string; account_id: string; paid_unlock: boolean | null };

async function ensureFeatureEnabled(request: any) {
  // Enable globally (FOCL region 0000...)
  await serviceRolePatch(
    request,
    'feature_activation_state',
    'feature_id=eq.F-6.6.11&region_id=eq.00000000-0000-0000-0000-000000000000',
    { enabled: true, reason_code: 'e2e_enabled' },
  );
}

async function ensureTestTrip(request: any, userId: string): Promise<string> {
  // RLS reads use created_by = auth.uid(); reuse only trips the signed-in user can see.
  const existing = await serviceRoleGet<TripRow[]>(
    request,
    'trips',
    `select=trip_id,account_id,paid_unlock&account_id=eq.${userId}&created_by=eq.${userId}&limit=1`,
  );
  if (existing?.[0]?.trip_id) return existing[0].trip_id;
  const { data, status } = await serviceRolePost(request, 'trips', {
    account_id: userId,
    created_by: userId,
    destination_summary: 'E2E Creator Discovery Trip',
    departure_date: new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10),
    return_date: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
    travel_mode_primary: 'air',
    paid_unlock: false,
  });
  if (status >= 300) throw new Error(`failed to create trip: ${status} ${JSON.stringify(data)}`);
  const created = (data as any[])?.[0];
  if (!created?.trip_id) throw new Error('trip_id missing from create');
  return created.trip_id as string;
}

async function forceAllTripsFree(request: any, userId: string) {
  const trips = await serviceRoleGet<TripRow[]>(request, 'trips', `select=trip_id,paid_unlock&account_id=eq.${userId}&limit=200`);
  for (const t of trips || []) {
    await serviceRolePatch(request, 'trips', `trip_id=eq.${t.trip_id}`, { paid_unlock: false });
  }
}

async function unlockTrip(request: any, tripId: string) {
  await serviceRolePatch(request, 'trips', `trip_id=eq.${tripId}`, { paid_unlock: true, paid_unlock_at: new Date().toISOString() });
}

test.describe('Creator discovery (F-6.6.11)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing service role key.');
  test.use({ storageState: getStorageStatePath() });

  test('search limits (free), video detail, add-to-trip (paid trip), rate limit', async ({ page, request }) => {
    const token = readAccessTokenFromStorageState();
    test.skip(!token, E2E_AUTH_SKIP_REASON);
    const userId = readSupabaseUserIdFromStorageState();
    test.skip(!userId, 'Missing user id in storage state');
    const uid = userId as string;

    // This spec runs alone (playwright `creator-discovery` project); safe to reset quota for a clean run.
    await serviceRoleDelete(request, 'creator_search_log', `account_id=eq.${uid}`);

    await ensureFeatureEnabled(request);
    await forceAllTripsFree(request, uid);
    const tripId = await ensureTestTrip(request, uid);

    const profRows = await serviceRoleGet<Array<{ membership_tier: string }>>(
      request,
      'user_profiles',
      `select=membership_tier&user_id=eq.${uid}&limit=1`,
    );
    const tier = profRows[0]?.membership_tier ?? 'FREE';
    const isPaidMembership = tier === 'CORPORATE' || tier === 'FOUNDER';
    const expectedVideoCards = isPaidMembership ? 3 : 2;
    const expectedTagCards = isPaidMembership ? 3 : 2;

    // Seed creator + videos (manual) — unique handle avoids collisions across parallel Playwright projects
    const handleSuffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const { data: cData, status: cStatus } = await serviceRolePost(request, 'creators', {
      creator_name: 'E2E Bangkok Bites',
      platform: 'youtube',
      platform_handle: `e2e_bangkok_${handleSuffix}`,
      region_focus: ['Thailand'],
      travel_style: ['food'],
      subscriber_count: 12345,
      is_verified: true,
      is_active: true,
    });
    if (cStatus >= 300) throw new Error(`creator insert failed: ${cStatus} ${JSON.stringify(cData)}`);
    const creatorId = (cData as any[])?.[0]?.creator_id as string;
    expect(creatorId).toBeTruthy();

    const videoIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data: vData } = await serviceRolePost(request, 'creator_videos', {
        creator_id: creatorId,
        title: `Bangkok street food ep ${i + 1}`,
        description: 'Manual tagged spots in Bangkok',
        platform_video_id: 'dQw4w9WgXcQ',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: null,
        view_count: 1000 + i,
        is_active: true,
      });
      const vid = (vData as any[])?.[0]?.video_id as string;
      expect(vid).toBeTruthy();
      videoIds.push(vid);

      // 3 tags per video (free should show 2)
      for (let t = 0; t < 3; t++) {
        await serviceRolePost(request, 'video_location_tags', {
          video_id: vid,
          timestamp_seconds: t * 30,
          sort_order: t,
          country_code: 'TH',
          city: 'Bangkok',
          place_name: `Spot ${t + 1}`,
          metadata: {},
        });
      }
      await serviceRolePost(request, 'video_activity_extractions', {
        video_id: vid,
        tag_id: null,
        activity_name: 'Try a street food stall',
        activity_description: 'Manual extraction',
        extraction_method: 'manual',
        confidence_score: 1.0,
        metadata: {},
      });
      await serviceRolePost(request, 'video_activity_extractions', {
        video_id: vid,
        tag_id: null,
        activity_name: 'Visit a night market',
        activity_description: 'Manual extraction',
        extraction_method: 'manual',
        confidence_score: 1.0,
        metadata: {},
      });
      await serviceRolePost(request, 'video_activity_extractions', {
        video_id: vid,
        tag_id: null,
        activity_name: 'Temple stop (bonus)',
        activity_description: 'Manual extraction',
        extraction_method: 'manual',
        confidence_score: 1.0,
        metadata: {},
      });
    }

    // Open draft activities and search
    await page.goto(`/trips/${tripId}/draft/activities`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('button', { name: /Discover activities \(creators\)/i })).toBeVisible();
    await page.getByRole('button', { name: /Discover activities \(creators\)/i }).click();
    await expect(page.getByPlaceholder(/Try: Bangkok/i)).toBeVisible();
    await page.getByPlaceholder(/Try: Bangkok/i).fill('Bangkok');
    await page.getByRole('button', { name: /^Search$/ }).click();

    // Free-tier: only 2 videos per search
    await expect(page.getByText(/Showing/i)).toBeVisible();
    const openButtons = page.getByRole('link', { name: /Open details/i });
    await expect(openButtons).toHaveCount(expectedVideoCards);

    // Open details for first result
    await openButtons.first().click();
    await page.waitForURL(/\/discover\/.+\?trip_id=/, { timeout: 30_000 });
    await expect(page.getByText('Location tags', { exact: true })).toBeVisible();

    const discoverUrl = new URL(page.url());
    const openedVideoId = discoverUrl.pathname.split('/').pop() || '';
    expect(openedVideoId).toMatch(/[0-9a-f-]{36}/i);
    const detailRes = await page.request.get(
      `/api/creators/videos/${encodeURIComponent(openedVideoId)}?trip_id=${encodeURIComponent(tripId)}`,
    );
    expect(detailRes.ok()).toBeTruthy();
    const detailJson = (await detailRes.json()) as { location_tags?: unknown[] };
    expect((detailJson.location_tags || []).length).toBe(expectedTagCards);

    // Unlock trip → should allow add-to-trip (wait until API sees paid_unlock)
    await unlockTrip(request, tripId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(async () => {
      const r = await page.request.get(
        `/api/creators/videos/${encodeURIComponent(openedVideoId)}?trip_id=${encodeURIComponent(tripId)}`,
      );
      const j = (await r.json()) as { can_add_to_trip?: boolean };
      expect(j.can_add_to_trip).toBe(true);
    }).toPass({ timeout: 20_000 });

    const addBtn = page.getByRole('button', { name: /Add to trip/i }).first();
    await expect(addBtn).toBeEnabled();

    const uniqueActivity = `E2E creator-linked ${randomUUID().slice(0, 8)}`;
    const addRes = await page.request.post(`/api/creators/videos/${encodeURIComponent(openedVideoId)}/add-to-trip`, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({
        trip_id: tripId,
        activity_name: uniqueActivity,
        city: 'Bangkok',
        country_code: 'TH',
      }),
    });
    const addBody = await addRes.text();
    if (![200, 201].includes(addRes.status())) {
      throw new Error(`add-to-trip ${addRes.status()}: ${addBody}`);
    }

    // Verify activity candidate created with creator_linked source
    const candidates = await serviceRoleGet<any[]>(
      request,
      'activity_candidates',
      `select=candidate_id,source,source_reference_id,trip_id,activity_name&trip_id=eq.${tripId}&source=eq.creator_linked&activity_name=eq.${encodeURIComponent(uniqueActivity)}`,
    );
    expect(candidates.length).toBe(1);
    expect(String(candidates[0].source_reference_id)).toMatch(/[0-9a-f-]{36}/i);

    // Rate limit (dedicated Playwright project runs this file with workers: 1 — see playwright.config.ts).
    {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const iso = start.toISOString().replace('+00:00', 'Z');
      const existing = await serviceRoleGet<Array<{ log_id: string }>>(
        request,
        'creator_search_log',
        `select=log_id&account_id=eq.${uid}&created_at=gte.${encodeURIComponent(iso)}&limit=500`,
      );
      const used = existing.length;
      for (let i = 0; i < Math.max(0, 100 - used); i++) {
        await serviceRolePost(
          request,
          'creator_search_log',
          {
            account_id: uid,
            query_text: 'Bangkok',
            result_count: 3,
            filters: { e2e: true },
            created_at: new Date().toISOString(),
          },
          'return=minimal',
        );
      }

      await page.goto(`/trips/${tripId}/draft/activities`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.getByRole('button', { name: /Discover activities \(creators\)/i }).click();
      await page.getByPlaceholder(/Try: Bangkok/i).fill('Bangkok');
      await page.getByRole('button', { name: /^Search$/ }).click();
      await expect(page.getByText(/creator search daily limit|daily limit/i)).toBeVisible();
    }
  });
});

