import { expect, test } from '@playwright/test';
import { erasureDisposableUserId, hasServiceRoleKey } from './utils/e2eEnv';
import {
  insertErasureContractFixture,
  runProcessErasure,
  teardownErasureFixture,
} from './utils/erasureContract.e2e';
import { serviceRoleGet, serviceRolePatch } from './utils/serviceRoleRest';

test.describe('GDPR erasure contract', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!hasServiceRoleKey(), 'Set SUPABASE_SERVICE_ROLE_KEY to run erasure DB contracts.');
  const uid = erasureDisposableUserId();
  test.skip(!uid, 'Set E2E_ERASURE_DISPOSABLE_USER_ID (auth.users uuid) for destructive erasure tests.');

  test('process_erasure_request nullifies PII across trips, incidents, evidence, contacts, carrier_responses', async ({
    request,
  }) => {
    const stamp = Date.now();
    const ids = await insertErasureContractFixture(request, uid!, stamp);
    const res = await runProcessErasure(request, uid!, uid!);
    expect(res.status).toBe(200);
    expect((res.data as { ok?: boolean }).ok).toBe(true);

    const trips = await serviceRoleGet<Array<{ trip_name: string; destination_summary: string | null }>>(
      request,
      'trips',
      `trip_id=eq.${ids.tripId}&select=trip_name,destination_summary`,
    );
    expect(trips[0]?.trip_name).toBe('[ERASED]');
    expect(trips[0]?.destination_summary).toBeNull();

    const inc = await serviceRoleGet<Array<{ title: string; description: string }>>(
      request,
      'incidents',
      `id=eq.${ids.incidentId}&select=title,description`,
    );
    expect(inc[0]?.title).toBe('[ERASED]');
    expect(inc[0]?.description).toBe('[ERASED]');

    const ev = await serviceRoleGet<Array<{ name: string; description: string; file_path: string | null }>>(
      request,
      'evidence',
      `id=eq.${ids.evidenceId}&select=name,description,file_path`,
    );
    expect(ev[0]?.name).toBe('[ERASED]');
    expect(ev[0]?.description).toBe('[ERASED]');
    expect(ev[0]?.file_path).toBeNull();

    const ct = await serviceRoleGet<Array<{ name: string | null; phone: string | null; email: string | null }>>(
      request,
      'contacts',
      `contact_id=eq.${ids.contactId}&select=name,phone,email`,
    );
    expect(ct[0]?.name).toBe('[ERASED]');
    expect(ct[0]?.phone).toBeNull();
    expect(ct[0]?.email).toBeNull();

    const cr = await serviceRoleGet<Array<{ notes: string | null }>>(
      request,
      'carrier_responses',
      `response_id=eq.${ids.responseId}&select=notes`,
    );
    expect(cr[0]?.notes).toBeNull();

    await teardownErasureFixture(request, ids, uid!);
  });

  test('erasure preserves structural fields (ids, timestamps, maturity_state)', async ({ request }) => {
    const stamp = Date.now() + 1;
    const ids = await insertErasureContractFixture(request, uid!, stamp);
    await runProcessErasure(request, uid!, uid!);
    const trips = await serviceRoleGet<Array<{ trip_id: string; created_at: string; maturity_state: string }>>(
      request,
      'trips',
      `trip_id=eq.${ids.tripId}&select=trip_id,created_at,maturity_state`,
    );
    expect(trips[0]?.trip_id).toBe(ids.tripId);
    expect(trips[0]?.created_at).toBeTruthy();
    expect(trips[0]?.maturity_state).toBe('DRAFT');
    const inc = await serviceRoleGet<Array<{ id: string; canonical_status: string }>>(
      request,
      'incidents',
      `id=eq.${ids.incidentId}&select=id,canonical_status`,
    );
    expect(inc[0]?.id).toBe(ids.incidentId);
    expect(inc[0]?.canonical_status).toBeTruthy();
    const el = await serviceRoleGet<Array<{ id: string }>>(request, 'event_ledger', 'select=id&limit=1');
    expect(el.length).toBeGreaterThan(0);
    await teardownErasureFixture(request, ids, uid!);
  });

  test('erasure strips preferences.signal_profile', async ({ request }) => {
    await serviceRolePatch(request, 'user_profiles', `user_id=eq.${uid}`, {
      preferences: {
        signal_profile: {
          places: ['Lisbon'],
          activities: ['hiking'],
          food_interests: ['wine'],
          travel_style: 'solo',
          detail_preference: 'balanced',
          interests_other: [],
          capture_rounds: 1,
          last_updated: new Date().toISOString(),
        },
      },
    });
    const res = await runProcessErasure(request, uid!, uid!);
    expect(res.status).toBe(200);
    const rows = await serviceRoleGet<Array<{ preferences: Record<string, unknown> }>>(
      request,
      'user_profiles',
      `user_id=eq.${uid}&select=preferences`,
    );
    expect(rows[0]?.preferences?.signal_profile).toBeUndefined();
  });

  test('process_erasure_request is idempotent', async ({ request }) => {
    const a = await runProcessErasure(request, uid!, uid!);
    expect(a.status).toBe(200);
    const b = await runProcessErasure(request, uid!, uid!);
    expect(b.status).toBe(200);
    expect((b.data as { ok?: boolean }).ok).toBe(true);
  });
});
