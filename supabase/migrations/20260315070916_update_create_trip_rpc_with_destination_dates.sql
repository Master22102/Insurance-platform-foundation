/*
  # Update create_trip RPC to accept destination and dates

  1. Changes
    - Add p_destination_summary, p_departure_date, p_return_date parameters
    - Persist them to the trips table on insert
    - Also sets account_id = p_account_id on insert
    - All new parameters are optional/nullable for backward compatibility
*/

CREATE OR REPLACE FUNCTION create_trip(
  p_trip_name            text,
  p_account_id           uuid,
  p_maturity_state       trip_maturity_state DEFAULT 'DRAFT',
  p_jurisdiction_ids     uuid[]              DEFAULT '{}',
  p_travel_mode_primary  text                DEFAULT 'air',
  p_is_group_trip        boolean             DEFAULT false,
  p_group_id             uuid                DEFAULT NULL,
  p_metadata             jsonb               DEFAULT '{}'::jsonb,
  p_actor_id             uuid                DEFAULT NULL,
  p_idempotency_key      text                DEFAULT NULL,
  p_region_id            uuid                DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id           text                DEFAULT 'trips',
  p_destination_summary  text                DEFAULT NULL,
  p_departure_date       date                DEFAULT NULL,
  p_return_date          date                DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_trip_id     uuid;
  v_emit_result jsonb;
  v_existing_id uuid;
  v_actor       uuid;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'trip_id')::uuid
    INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key
      AND el.event_type = 'trip_created'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success',    true,
        'trip_id',    v_existing_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Governance guard precheck
  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'trip_create');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
      'mutation_class', 'trip_create',
      'guard_details',  v_guard
    );
  END IF;

  -- Validation
  IF p_trip_name IS NULL OR trim(p_trip_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_name is required');
  END IF;
  
  IF p_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_id is required');
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_account_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_id does not exist');
  END IF;

  -- Determine actor
  v_actor := COALESCE(p_actor_id, p_account_id);

  -- Insert trip
  INSERT INTO trips (
    trip_name,
    created_by,
    account_id,
    maturity_state,
    jurisdiction_ids,
    travel_mode_primary,
    is_group_trip,
    group_id,
    lifecycle_flags,
    destination_summary,
    departure_date,
    return_date
  ) VALUES (
    p_trip_name,
    p_account_id,
    p_account_id,
    p_maturity_state,
    COALESCE(p_jurisdiction_ids, '{}'),
    p_travel_mode_primary,
    p_is_group_trip,
    p_group_id,
    COALESCE(p_metadata, '{}'),
    p_destination_summary,
    p_departure_date,
    p_return_date
  )
  RETURNING trip_id INTO v_trip_id;

  -- Emit trip_created event
  v_emit_result := emit_event(
    p_event_type      := 'trip_created',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'trip',
    p_scope_id        := v_trip_id,
    p_actor_id        := v_actor,
    p_actor_type      := 'user',
    p_reason_code     := 'trip_create',
    p_previous_state  := '{}'::jsonb,
    p_resulting_state := jsonb_build_object(
      'trip_id',         v_trip_id,
      'maturity_state',  p_maturity_state,
      'jurisdiction_ids', COALESCE(p_jurisdiction_ids, '{}')
    ),
    p_metadata        := jsonb_build_object(
      'trip_id',             v_trip_id,
      'trip_name',           p_trip_name,
      'travel_mode_primary', p_travel_mode_primary,
      'is_group_trip',       p_is_group_trip,
      'group_id',            p_group_id
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for trip_created: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',    true,
    'trip_id',    v_trip_id,
    'event_id',   v_emit_result->>'event_id',
    'idempotent', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_trip failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip(
  text, uuid, trip_maturity_state, uuid[], text, boolean, uuid, jsonb, uuid, text, uuid, text, text, date, date
) TO authenticated;

REVOKE EXECUTE ON FUNCTION create_trip(
  text, uuid, trip_maturity_state, uuid[], text, boolean, uuid, jsonb, uuid, text, uuid, text, text, date, date
) FROM anon;
