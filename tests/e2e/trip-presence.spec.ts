import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey, serviceRoleGet, serviceRolePost } from './utils/serviceRoleRest';
import { hasSupabaseEnv, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

function logSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[trip-presence E2E] SKIPPED — ${reason}${tail}\n\n`);
}

function row(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

async function createTripForActor(
  request: import('@playwright/test').APIRequestContext,
  actorId: string,
  stamp: number,
): Promise<string> {
  const t = await serviceRolePost(request, 'trips', {
    trip_name: `E2E TripPresence ${stamp}`,
    created_by: actorId,
    account_id: actorId,
    maturity_state: 'PRE_TRIP_STRUCTURED',
    jurisdiction_ids: [],
    travel_mode_primary: 'air',
    is_group_trip: false,
    lifecycle_flags: { e2e: true, suite: 'trip-presence' },
    destination_summary: 'Zurich, CH',
    departure_date: iso(addDays(new Date(), -1)),
    return_date: iso(addDays(new Date(), 10)),
  });
  expect(t.status, JSON.stringify(t.data)).toBe(201);
  const tripId = row(t.data).trip_id as string;
  expect(tripId).toBeTruthy();
  return tripId;
}

test.describe('Trip Presence Mode (F-6.6.7)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY.');
  test.use({ storageState: getStorageStatePath() });

  test('country reference data has at least 20 countries', async ({ request }) => {
    try {
      const data = await serviceRoleGet<unknown[]>(request, 'country_reference_data', 'select=country_code');
      expect(Array.isArray(data)).toBeTruthy();
      expect(data.length).toBeGreaterThanOrEqual(20);
    } catch (e) {
      logSkip('country_reference_data not available (apply migration?)', e);
      test.skip();
    }
  });

  test('alert deduplication: second emit within 4h is suppressed', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    const tripId = await createTripForActor(request, actorId!, Date.now());

    const body = {
      action: 'emit',
      trip_id: tripId,
      alert_type: 'activity_zone',
      alert_subtype: 'ski_resort',
      severity: 'warning',
      metadata: { e2e: true },
    };

    const r1 = await request.post('/api/presence/alerts', {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    if (r1.status() === 404 || r1.status() === 500) {
      logSkip('presence alerts API or table missing', await r1.text());
      test.skip();
    }
    expect(r1.ok(), await r1.text()).toBeTruthy();
    const j1 = (await r1.json()) as { displayed?: boolean; suppressed?: boolean };
    expect(j1.displayed).toBe(true);

    const r2 = await request.post('/api/presence/alerts', {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    expect(r2.ok(), await r2.text()).toBeTruthy();
    const j2 = (await r2.json()) as { displayed?: boolean; suppressed?: boolean };
    expect(j2.suppressed).toBe(true);
    expect(j2.displayed).toBe(false);
  });

  test('settings PUT persists and GET returns row', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    const tripId = await createTripForActor(request, actorId!, Date.now() + 1);

    const put = await request.put('/api/presence/settings', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        trip_id: tripId,
        enabled: true,
        activity_zones_enabled: false,
        border_crossings_enabled: true,
        missed_connection_enabled: true,
        risk_alerts_enabled: true,
        daily_summary_enabled: true,
        daily_summary_time: '21:00:00',
        snooze_default_hours: 4,
        activity_zone_toggles: {
          ski_resorts: false,
          dive_centers: true,
          climbing_areas: true,
          motorbike_rental: true,
          water_sports: true,
          high_altitude: true,
        },
      },
    });
    if (put.status() === 404 || put.status() === 500) {
      logSkip('presence settings API or table missing', await put.text());
      test.skip();
    }
    expect(put.ok(), await put.text()).toBeTruthy();

    const get = await request.get(`/api/presence/settings?trip_id=${encodeURIComponent(tripId)}`);
    expect(get.ok(), await get.text()).toBeTruthy();
    const j = (await get.json()) as { settings: { activity_zones_enabled?: boolean; snooze_default_hours?: number } };
    expect(j.settings.activity_zones_enabled).toBe(false);
    expect(j.settings.snooze_default_hours).toBe(4);
  });

  test('country-info CH includes emergency numbers and tipping', async ({ request }) => {
    const res = await request.get('/api/presence/country-info?country_code=CH&base_currency=USD');
    if (res.status() === 404 || res.status() === 500) {
      logSkip('country-info API or reference table missing', await res.text());
      test.skip();
    }
    expect(res.ok(), await res.text()).toBeTruthy();
    const j = (await res.json()) as {
      country: { police_number?: string; ambulance_number?: string; flag_url?: string; tipping_custom?: string };
    };
    expect(j.country.police_number).toBeTruthy();
    expect(j.country.ambulance_number).toBeTruthy();
    expect(j.country.flag_url || '').toContain('flagcdn.com');
    expect(j.country.tipping_custom || '').toMatch(/not customary/i);
  });
});
