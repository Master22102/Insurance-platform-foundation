/*
  F-6.6.2 Protective Safety Mode (PSM) foundation.
  - Regional trigger log for PSM episodes
  - Deterministic enter/exit helpers with cooldown
  - Read-model helper for blocked operations messaging
  - Expanded PROTECTIVE allowlist in precheck_mutation_guard
*/

CREATE TABLE IF NOT EXISTS protective_mode_triggers (
  trigger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  trigger_reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_psm_triggers_region_detected
  ON protective_mode_triggers(region_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_psm_triggers_region_unresolved
  ON protective_mode_triggers(region_id)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS protective_mode_resource_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  resource_type text NOT NULL,
  allocation_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NULL,
  allocated_by uuid NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_psm_allocations_region_active
  ON protective_mode_resource_allocations(region_id, allocated_at DESC);

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('protective_mode_entered', 1, 'F-6.6.2', 'critical'),
  ('protective_mode_exited', 1, 'F-6.6.2', 'info'),
  ('protective_mode_resource_allocated', 1, 'F-6.6.2', 'warning'),
  ('psm_flapping_detected', 1, 'F-6.6.2', 'warning'),
  ('psm_activation_failure', 1, 'F-6.6.2', 'critical')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION enter_protective_safety_mode(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trigger_reason text DEFAULT 'unknown_trigger',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_mode text;
  v_mode_result jsonb;
  v_emit jsonb;
  v_trigger_id uuid;
BEGIN
  SELECT mode INTO v_prev_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  v_mode_result := set_region_operational_mode(
    p_region_id := p_region_id,
    p_target_mode := 'PROTECTIVE',
    p_reason_code := p_trigger_reason,
    p_actor_id := p_actor_id
  );
  IF COALESCE((v_mode_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_mode_result->>'error', 'mode_transition_failed'));
  END IF;

  INSERT INTO protective_mode_triggers (region_id, trigger_reason, metadata)
  VALUES (
    p_region_id,
    p_trigger_reason,
    jsonb_build_object(
      'entered_from_mode', COALESCE(v_prev_mode, 'UNKNOWN'),
      'mode_event_id', v_mode_result->>'event_id'
    ) || COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING trigger_id INTO v_trigger_id;

  -- Disable high-risk features while region is in protective posture.
  UPDATE feature_activation_state
  SET enabled = false,
      reason_code = 'protective_mode_active',
      activated_by = COALESCE(p_actor_id, activated_by)
  WHERE region_id = p_region_id
    AND feature_id IN ('F-6.5.13', 'F-10.3', 'F-6.5.14');

  v_emit := emit_event(
    p_event_type := 'protective_mode_entered',
    p_feature_id := 'F-6.6.2',
    p_scope_type := 'system',
    p_scope_id := p_region_id,
    p_actor_id := p_actor_id,
    p_actor_type := CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    p_reason_code := p_trigger_reason,
    p_metadata := jsonb_build_object(
      'region_id', p_region_id,
      'trigger_id', v_trigger_id,
      'previous_mode', COALESCE(v_prev_mode, 'UNKNOWN')
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'region_id', p_region_id,
    'trigger_id', v_trigger_id,
    'previous_mode', COALESCE(v_prev_mode, 'UNKNOWN'),
    'current_mode', 'PROTECTIVE',
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION resolve_protective_mode_trigger(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trigger_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE protective_mode_triggers
  SET resolved_at = now()
  WHERE region_id = p_region_id
    AND resolved_at IS NULL
    AND (p_trigger_reason IS NULL OR trigger_reason = p_trigger_reason);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION evaluate_protective_safety_mode_exit(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_unresolved integer;
  v_last_resolved timestamptz;
  v_entered_at timestamptz;
  v_duration_minutes numeric := NULL;
  v_mode_result jsonb;
  v_emit jsonb;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF COALESCE(v_mode, 'NORMAL') <> 'PROTECTIVE' THEN
    RETURN jsonb_build_object('success', true, 'no_op', true, 'reason', 'region_not_in_protective');
  END IF;

  SELECT count(*)::int INTO v_unresolved
  FROM protective_mode_triggers
  WHERE region_id = p_region_id
    AND resolved_at IS NULL;

  IF v_unresolved > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'unresolved_triggers',
      'unresolved_trigger_count', v_unresolved
    );
  END IF;

  SELECT max(resolved_at) INTO v_last_resolved
  FROM protective_mode_triggers
  WHERE region_id = p_region_id;

  IF v_last_resolved IS NULL OR now() - v_last_resolved < interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cooldown_not_elapsed',
      'cooldown_seconds_remaining',
      GREATEST(0, (300 - EXTRACT(EPOCH FROM (now() - COALESCE(v_last_resolved, now()))))::int)
    );
  END IF;

  SELECT min(detected_at) INTO v_entered_at
  FROM protective_mode_triggers
  WHERE region_id = p_region_id;

  IF v_entered_at IS NOT NULL THEN
    v_duration_minutes := EXTRACT(EPOCH FROM (now() - v_entered_at)) / 60.0;
  END IF;

  v_mode_result := set_region_operational_mode(
    p_region_id := p_region_id,
    p_target_mode := 'NORMAL',
    p_reason_code := 'protective_conditions_cleared',
    p_actor_id := p_actor_id
  );
  IF COALESCE((v_mode_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_mode_result->>'error', 'mode_transition_failed'));
  END IF;

  UPDATE feature_activation_state
  SET enabled = true,
      reason_code = 'protective_mode_exited',
      activated_by = COALESCE(p_actor_id, activated_by)
  WHERE region_id = p_region_id
    AND feature_id IN ('F-6.5.13', 'F-10.3', 'F-6.5.14');

  v_emit := emit_event(
    p_event_type := 'protective_mode_exited',
    p_feature_id := 'F-6.6.2',
    p_scope_type := 'system',
    p_scope_id := p_region_id,
    p_actor_id := p_actor_id,
    p_actor_type := CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    p_reason_code := 'auto_recovery',
    p_metadata := jsonb_build_object(
      'region_id', p_region_id,
      'duration_minutes', v_duration_minutes,
      'trigger_count', (SELECT count(*) FROM protective_mode_triggers WHERE region_id = p_region_id)
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'region_id', p_region_id,
    'current_mode', 'NORMAL',
    'duration_minutes', v_duration_minutes,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION psm_operation_availability(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_operation text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_op text := lower(coalesce(p_operation, ''));
  v_blocked boolean := false;
  v_message text := null;
  v_alt text := null;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;
  v_mode := COALESCE(v_mode, 'PROTECTIVE');

  IF v_mode = 'PROTECTIVE' THEN
    v_blocked := v_op = ANY(ARRAY[
      'deep_scan_create',
      'paid_unlock',
      'claim_packet_generation',
      'identity_mutation',
      'evidence_delete',
      'policy_attachment',
      'group_invite_accept',
      'coverage_graph_snapshot',
      'financial_modeling',
      'activity_ai_suggestions'
    ]);

    IF v_blocked THEN
      IF v_op = 'deep_scan_create' THEN
        v_message := 'Deep Scan is temporarily unavailable while we stabilize the platform.';
        v_alt := 'You can still add details manually.';
      ELSIF v_op = 'paid_unlock' THEN
        v_message := 'Upgrades are paused for now while safe mode is active.';
        v_alt := 'You can continue using the free tier.';
      ELSIF v_op = 'claim_packet_generation' THEN
        v_message := 'Claim packet generation is temporarily unavailable in safe mode.';
        v_alt := 'You can still upload and export documentation.';
      ELSE
        v_message := 'This action is temporarily unavailable while safe mode protects your data.';
        v_alt := 'Core workflows are still available.';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'region_id', p_region_id,
    'mode', v_mode,
    'operation', p_operation,
    'blocked', v_blocked,
    'message', v_message,
    'alternative_path', v_alt
  );
END;
$$;

CREATE OR REPLACE FUNCTION precheck_mutation_guard(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id text DEFAULT 'unknown',
  p_mutation_class text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
  v_allowed boolean := false;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_mode IS NULL THEN
    v_mode := 'PROTECTIVE';
  END IF;

  IF v_mode = 'PROTECTIVE' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'trip_draft_edit',
      'itinerary_confirm',
      'incident_create',
      'evidence_upload',
      'evidence_export',
      'voice_narration_capture',
      'account_auth'
    );
  ELSIF v_mode = 'NORMAL' THEN
    v_allowed := true;
  ELSIF v_mode = 'ELEVATED' THEN
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );
  ELSIF v_mode = 'RECOVERY' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'trip_draft_edit',
      'incident_create',
      'evidence_upload',
      'evidence_export'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'mode', v_mode,
    'mutation_class', p_mutation_class,
    'region_id', p_region_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enter_protective_safety_mode(uuid, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_protective_mode_trigger(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION evaluate_protective_safety_mode_exit(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION psm_operation_availability(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION precheck_mutation_guard(uuid, text, text) TO authenticated, service_role;
