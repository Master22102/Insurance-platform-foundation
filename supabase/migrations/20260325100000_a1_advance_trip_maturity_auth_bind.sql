/*
  A1 — Bind advance_trip_maturity to the authenticated subject (pass12-style).

  Prior: SECURITY DEFINER + COALESCE(p_actor_id, v_trip.created_by) allowed any
  authenticated caller to supply an arbitrary p_actor_id for event emission.

  Now: require auth.uid(); trip must be owned by auth.uid(); p_actor_id must be
  null or equal to auth.uid() (same pattern as other self-service RPCs).
*/

CREATE OR REPLACE FUNCTION advance_trip_maturity(
  p_trip_id uuid,
  p_target_state trip_maturity_state,
  p_actor_id uuid DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id text DEFAULT 'trips'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard jsonb;
  v_trip trips%ROWTYPE;
  v_emit_result jsonb;
  v_existing_event uuid;
  v_actor uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_actor_id IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT event_id INTO v_existing_event
    FROM event_ledger
    WHERE idempotency_key = p_idempotency_key
      AND event_type = 'trip_maturity_advanced'
    LIMIT 1;

    IF v_existing_event IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'event_id', v_existing_event,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Governance guard
  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'trip_state_transition');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'trip_state_transition'
    );
  END IF;

  -- Load trip
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip not found');
  END IF;

  IF v_trip.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_actor := auth.uid();

  -- Validate state transition
  IF p_target_state = v_trip.maturity_state THEN
    RETURN jsonb_build_object('success', false, 'error', 'already in target state');
  END IF;

  UPDATE trips
  SET maturity_state = p_target_state,
      updated_at = now()
  WHERE trip_id = p_trip_id;

  v_emit_result := emit_event(
    p_event_type := 'trip_maturity_advanced',
    p_feature_id := p_feature_id,
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := v_actor,
    p_actor_type := 'user',
    p_reason_code := COALESCE(p_reason_code, 'state_transition'),
    p_previous_state := jsonb_build_object('maturity_state', v_trip.maturity_state),
    p_resulting_state := jsonb_build_object('maturity_state', p_target_state),
    p_metadata := jsonb_build_object(
      'trip_id', p_trip_id,
      'previous_state', v_trip.maturity_state,
      'new_state', p_target_state
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for trip_maturity_advanced: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'previous_state', v_trip.maturity_state,
    'new_state', p_target_state,
    'event_id', v_emit_result->>'event_id',
    'idempotent', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'advance_trip_maturity failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION advance_trip_maturity(uuid, trip_maturity_state, uuid, text, text, uuid, text) TO authenticated;
