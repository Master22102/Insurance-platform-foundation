import { expect, type APIRequestContext } from '@playwright/test';
import { supabaseRpc } from './supabaseRest';

export type Step4TripCtx = { actorId: string; tripId: string };

export type Step4TripMaturity = 'DRAFT' | 'PRE_TRIP_STRUCTURED';

/**
 * Creates a solo trip with itinerary fields for step-4 E2E.
 * Use **`PRE_TRIP_STRUCTURED`** when the UI must leave Draft Home (Deep Scan / coverage tab).
 */
export async function createDraftTripForStep4(
  request: APIRequestContext,
  accessToken: string,
  actorId: string,
  stamp: number,
  tag: string,
  options?: { maturityState?: Step4TripMaturity },
): Promise<string> {
  const maturityState = options?.maturityState ?? 'DRAFT';
  const createTrip = await supabaseRpc(request, accessToken, 'create_trip', {
    p_trip_name: `E2E step4 ${tag} ${stamp}`,
    p_account_id: actorId,
    p_maturity_state: maturityState,
    p_jurisdiction_ids: [],
    p_travel_mode_primary: 'air',
    p_is_group_trip: false,
    p_group_id: null,
    p_metadata: { e2e: true, suite: `step4-${tag}` },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-step4-trip-${tag}-${stamp}`,
    p_destination_summary: 'Lisbon, Portugal',
    p_departure_date: '2026-05-10',
    p_return_date: '2026-05-18',
  });
  expect(createTrip.status, JSON.stringify(createTrip.error)).toBe(200);
  const tripData = createTrip.data as Record<string, unknown>;
  expect(tripData?.success).toBe(true);
  const tripId = tripData.trip_id as string;
  expect(tripId).toBeTruthy();
  return tripId;
}

/** Prefer **`createDraftTripForStep4(..., { maturityState: 'PRE_TRIP_STRUCTURED' })`** in E2E. */
export async function advanceTripToPreTripStructured(
  request: APIRequestContext,
  accessToken: string,
  tripId: string,
  actorId: string,
  stamp: number,
  tag: string,
): Promise<void> {
  const adv = await supabaseRpc(request, accessToken, 'advance_trip_maturity', {
    p_trip_id: tripId,
    p_target_state: 'PRE_TRIP_STRUCTURED',
    p_actor_id: actorId,
    p_reason_code: 'e2e_step4',
    p_idempotency_key: `e2e-step4-maturity-${tag}-${stamp}`,
  });
  expect(adv.status, JSON.stringify(adv.error)).toBe(200);
  const a = adv.data as Record<string, unknown>;
  expect(a?.success === true || a?.idempotent === true, JSON.stringify(adv.data)).toBe(true);
}

export async function unlockTripForStep4(
  request: APIRequestContext,
  accessToken: string,
  tripId: string,
  actorId: string,
  paymentRef: string,
): Promise<void> {
  const unlock = await supabaseRpc(request, accessToken, 'unlock_trip', {
    p_trip_id: tripId,
    p_actor_id: actorId,
    p_credits_to_add: 2,
    p_payment_ref: paymentRef,
  });
  expect(unlock.status, JSON.stringify(unlock.error)).toBe(200);
  expect((unlock.data as Record<string, unknown>)?.success).toBe(true);
}
