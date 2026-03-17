/*
  # Guarded Write RPC: create_trip()
  
  1. Purpose
    - SECURITY DEFINER RPC providing the only legal write path for trips table
    - Follows governance substrate pattern used by create_incident()
    - Replaces direct INSERT via RLS policies
  
  2. Governance Integration
    - Calls precheck_mutation_guard(region_id, feature_id, 'trip_create')
    - Blocks mutation if region is in DEGRADED or LOCKDOWN mode
    - Supports idempotency via idempotency_key
  
  3. Event Emission
    - Emits 'trip_created' event via emit_event()
    - Full rollback on emit failure (RAISE EXCEPTION propagates)
    - Event carries trip_id, maturity_state, jurisdiction_ids
  
  4. Security
    - SECURITY DEFINER (runs as postgres, bypasses RLS)
    - EXECUTE granted to authenticated only
    - EXECUTE revoked from anon
  
  5. Parameters
    - p_trip_name: required, non-empty
    - p_account_id: required, must be auth.uid() or valid user
    - p_maturity_state: defaults to 'DRAFT'
    - p_jurisdiction_ids: array of jurisdiction UUIDs
    - p_travel_mode_primary: defaults to 'air'
    - p_is_group_trip: defaults to false
    - p_metadata: arbitrary trip metadata
    - p_actor_id: for audit trail
    - p_idempotency_key: for idempotent operations
    - p_region_id: operational region for governance
    - p_feature_id: defaults to 'trips'
*/

-- Register event type
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES ('trip_created', 1, 'trips', 'info')
ON CONFLICT (event_type) DO NOTHING;

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
  p_feature_id           text                DEFAULT 'trips'
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

  -- Determine actor (use p_actor_id if provided, otherwise account_id)
  v_actor := COALESCE(p_actor_id, p_account_id);

  -- Insert trip
  INSERT INTO trips (
    trip_name,
    created_by,
    maturity_state,
    jurisdiction_ids,
    travel_mode_primary,
    is_group_trip,
    group_id,
    lifecycle_flags
  ) VALUES (
    p_trip_name,
    p_account_id,
    p_maturity_state,
    COALESCE(p_jurisdiction_ids, '{}'),
    p_travel_mode_primary,
    p_is_group_trip,
    p_group_id,
    COALESCE(p_metadata, '{}')
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_trip(
  text, uuid, trip_maturity_state, uuid[], text, boolean, uuid, jsonb, uuid, text, uuid, text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION create_trip(
  text, uuid, trip_maturity_state, uuid[], text, boolean, uuid, jsonb, uuid, text, uuid, text
) FROM anon;

-- Drop old create_incident with p_project_id parameter
DROP FUNCTION IF EXISTS create_incident(uuid, text, text, text, text, uuid, jsonb, uuid, text, uuid, text);

-- Recreate create_incident to reference trips instead of projects
CREATE OR REPLACE FUNCTION create_incident(
  p_trip_id         uuid,
  p_title           text,
  p_description     text    DEFAULT '',
  p_classification  text    DEFAULT 'Unknown',
  p_control_type    text    DEFAULT 'Internal',
  p_assigned_to     uuid    DEFAULT NULL,
  p_metadata        jsonb   DEFAULT '{}'::jsonb,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id      text    DEFAULT 'incidents'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_incident_id uuid;
  v_emit_result jsonb;
  v_existing_id uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'incident_id')::uuid
    INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key
      AND el.event_type = 'incident_created'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success',     true,
        'incident_id', v_existing_id,
        'idempotent',  true
      );
    END IF;
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'incident_create');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
      'mutation_class', 'incident_create'
    );
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'title is required');
  END IF;
  IF p_trip_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_id is required');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM trips WHERE trip_id = p_trip_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip not found');
  END IF;

  INSERT INTO incidents (
    trip_id, title, description,
    classification, control_type,
    assigned_to, metadata,
    created_by, status
  ) VALUES (
    p_trip_id, p_title, COALESCE(p_description, ''),
    p_classification::classification, p_control_type::control_type,
    p_assigned_to, COALESCE(p_metadata, '{}'),
    p_actor_id, 'Capture'
  )
  RETURNING id INTO v_incident_id;

  v_emit_result := emit_event(
    p_event_type      := 'incident_created',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'incident',
    p_scope_id        := v_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'incident_create',
    p_previous_state  := '{}'::jsonb,
    p_resulting_state := jsonb_build_object(
      'incident_id', v_incident_id,
      'status',      'Capture',
      'trip_id',     p_trip_id
    ),
    p_metadata        := jsonb_build_object(
      'incident_id',    v_incident_id,
      'title',          p_title,
      'classification', p_classification,
      'control_type',   p_control_type
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for incident_created: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'incident_id', v_incident_id,
    'event_id',    v_emit_result->>'event_id',
    'idempotent',  false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION create_incident(
  uuid, text, text, text, text, uuid, jsonb, uuid, text, uuid, text
) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_incident(
  uuid, text, text, text, text, uuid, jsonb, uuid, text, uuid, text
) FROM anon;