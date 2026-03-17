/*
  # Fix set_region_operational_mode: use scope_type 'system' for emit_event

  ## Summary
  emit_event casts p_scope_type to the entity_type enum for related_entity_type.
  'region' is not a valid entity_type value. The scope_type must be 'system'
  (the correct catch-all for non-domain governance events).

  ## Change
  set_region_operational_mode() updated:
  - p_scope_type := 'system' (was 'region')
  - p_scope_id remains p_region_id (allows scoped event history queries)
*/

CREATE OR REPLACE FUNCTION set_region_operational_mode(
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_target_mode text    DEFAULT 'NORMAL',
  p_reason_code text    DEFAULT NULL,
  p_actor_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_mode text;
  v_emit_result   jsonb;
  v_valid_modes   text[] := ARRAY['NORMAL', 'ELEVATED', 'PROTECTIVE', 'RECOVERY'];
BEGIN
  IF NOT (p_target_mode = ANY(v_valid_modes)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'target_mode must be one of: NORMAL, ELEVATED, PROTECTIVE, RECOVERY'
    );
  END IF;

  SELECT mode INTO v_previous_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_previous_mode = p_target_mode THEN
    RETURN jsonb_build_object(
      'success',       true,
      'region_id',     p_region_id,
      'previous_mode', v_previous_mode,
      'current_mode',  p_target_mode,
      'no_op',         true
    );
  END IF;

  INSERT INTO region_operational_state (region_id, mode, updated_at, metadata)
  VALUES (p_region_id, p_target_mode, now(), '{}'::jsonb)
  ON CONFLICT (region_id) DO UPDATE
    SET mode       = EXCLUDED.mode,
        updated_at = now();

  v_emit_result := emit_event(
    p_event_type      := 'region_mode_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := p_reason_code,
    p_previous_state  := jsonb_build_object('mode', COALESCE(v_previous_mode, 'none')),
    p_resulting_state := jsonb_build_object('mode', p_target_mode),
    p_metadata        := jsonb_build_object(
      'region_id',     p_region_id,
      'previous_mode', COALESCE(v_previous_mode, 'none'),
      'target_mode',   p_target_mode,
      'reason_code',   p_reason_code
    )
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for region_mode_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'region_id',     p_region_id,
    'previous_mode', COALESCE(v_previous_mode, 'none'),
    'current_mode',  p_target_mode,
    'event_id',      v_emit_result->>'event_id',
    'no_op',         false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_region_operational_mode(uuid, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_region_operational_mode(uuid, text, text, uuid) FROM anon;
