/*
  # Feature Activation State RPC (12.4)

  ## Summary
  Founder-only SECURITY DEFINER RPC for toggling feature activation per region.
  Uses mutation_class 'feature_gate' which is reserved for founder-level governance.

  ## RPC
  set_feature_activation_state(p_feature_id, p_region_id, p_enabled, p_reason_code, p_actor_id)
  - Guards: precheck_mutation_guard(region_id, 'governance', 'feature_gate')
  - UPSERT feature_activation_state
  - Emits: feature_activation_changed
  - Returns: success, feature_id, region_id, enabled, previous_enabled

  ## Event Type
  feature_activation_changed registered in event_type_registry
*/

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('feature_activation_changed', 1, 'governance')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION set_feature_activation_state(
  p_feature_id  text,
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_enabled     boolean DEFAULT true,
  p_reason_code text    DEFAULT 'feature_activated_ok',
  p_actor_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard           jsonb;
  v_previous        boolean;
  v_emit_result     jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Blocked by governance guard',
      'mode',    v_guard->>'mode'
    );
  END IF;

  IF NOT EXISTS(SELECT 1 FROM feature_registry WHERE feature_id = p_feature_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_id not found in registry');
  END IF;

  SELECT enabled INTO v_previous
  FROM feature_activation_state
  WHERE feature_id = p_feature_id AND region_id = p_region_id;

  IF v_previous IS NOT DISTINCT FROM p_enabled THEN
    RETURN jsonb_build_object(
      'success',          true,
      'feature_id',       p_feature_id,
      'region_id',        p_region_id,
      'enabled',          p_enabled,
      'previous_enabled', v_previous,
      'no_op',            true
    );
  END IF;

  INSERT INTO feature_activation_state (feature_id, region_id, enabled, activated_by, reason_code)
  VALUES (p_feature_id, p_region_id, p_enabled, p_actor_id, p_reason_code)
  ON CONFLICT (feature_id, region_id) DO UPDATE
    SET enabled      = EXCLUDED.enabled,
        activated_by = EXCLUDED.activated_by,
        reason_code  = EXCLUDED.reason_code,
        updated_at   = now();

  v_emit_result := emit_event(
    p_event_type      := 'feature_activation_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'feature_activated_ok'),
    p_previous_state  := jsonb_build_object('enabled', v_previous),
    p_resulting_state := jsonb_build_object('enabled', p_enabled, 'feature_id', p_feature_id),
    p_metadata        := jsonb_build_object(
      'feature_id', p_feature_id,
      'region_id',  p_region_id,
      'enabled',    p_enabled
    )
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for feature_activation_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'feature_id',       p_feature_id,
    'region_id',        p_region_id,
    'enabled',          p_enabled,
    'previous_enabled', v_previous,
    'event_id',         v_emit_result->>'event_id',
    'no_op',            false
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_feature_activation_state(text, uuid, boolean, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_feature_activation_state(text, uuid, boolean, text, uuid) FROM anon;
