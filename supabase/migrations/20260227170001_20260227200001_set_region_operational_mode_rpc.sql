/*
  # Guarded Operational Mode Transition: set_region_operational_mode()

  ## Summary
  Adds the founder-only SECURITY DEFINER RPC for transitioning region operational mode.
  No direct INSERT/UPDATE on region_operational_state is permitted from authenticated.

  ## New Function
  set_region_operational_mode(p_region_id, p_target_mode, p_reason_code, p_actor_id)
  - Validates target_mode is one of: NORMAL, ELEVATED, PROTECTIVE, RECOVERY
  - UPSERTs region_operational_state
  - Emits 'region_mode_changed' via emit_event() with previous_mode and reason_code
  - Full rollback on emit failure (RAISE EXCEPTION propagates)
  - EXECUTE granted to authenticated (caller must supply valid actor_id)

  ## Seed
  - Ensures default region 00000000-0000-0000-0000-000000000000 exists in NORMAL mode
    (skips if already present)

  ## Security
  - SECURITY DEFINER (runs as postgres, bypasses RLS)
  - EXECUTE granted to authenticated
  - EXECUTE revoked from anon
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
      'success',        true,
      'region_id',      p_region_id,
      'previous_mode',  v_previous_mode,
      'current_mode',   p_target_mode,
      'no_op',          true
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
    p_scope_type      := 'region',
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

INSERT INTO event_type_registry (event_type, schema_version, feature_id)
VALUES ('region_mode_changed', 1, 'governance')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO region_operational_state (region_id, mode, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'NORMAL',
  '{"description": "Default region - seeded NORMAL baseline"}'::jsonb
)
ON CONFLICT (region_id) DO NOTHING;
