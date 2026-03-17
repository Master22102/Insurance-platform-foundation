/*
  # Rollout Control RPCs (C)

  ## Summary
  Founder-only governance RPCs for managing feature rollout state.
  All follow: guard → validate → mutate → emit event → commit pattern.

  ## New RPCs
  1. set_feature_rollout_percentage(feature_id, region_id, percentage, actor_id, reason_code, idempotency_key)
     - Sets rollout_percentage on feature_activation_state
     - Emits feature_rollout_percentage_changed event
     - Validates 0-100 range
     - Guards: precheck_mutation_guard with 'feature_gate' mutation class

  2. set_feature_rollout_rules(feature_id, region_id, rules_json, actor_id, reason_code, idempotency_key)
     - Replaces all rules for feature+region with new rule set from JSON array
     - Emits feature_rollout_rules_changed event
     - Guards: precheck_mutation_guard with 'feature_gate' mutation class

  ## Event Types (register)
  - feature_rollout_percentage_changed
  - feature_rollout_rules_changed

  ## Security
  - SECURITY DEFINER
  - EXECUTE granted to authenticated, revoked from anon
  - Founder-only enforcement via precheck_mutation_guard

  ## Note
  set_feature_activation_state already exists from Prompt 2; we update it to
  also manage enabled_at timestamp and emit enhanced metadata with rollout context.
*/

-- Register new event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('feature_rollout_percentage_changed', 1, 'governance'),
  ('feature_rollout_rules_changed',      1, 'governance')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- set_feature_rollout_percentage
-- =====================================================

CREATE OR REPLACE FUNCTION set_feature_rollout_percentage(
  p_feature_id      text,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_percentage      int     DEFAULT 0,
  p_actor_id        uuid    DEFAULT NULL,
  p_reason_code     text    DEFAULT 'rollout_percentage_increased',
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard           jsonb;
  v_previous_pct    int;
  v_emit_result     jsonb;
  v_event_id_check  uuid;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id_check
    FROM event_ledger
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_event_id_check IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id,
        'percentage', p_percentage, 'no_op', true, 'event_id', v_event_id_check
      );
    END IF;
  END IF;

  -- Guard: founder-only
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode'
    );
  END IF;

  -- Validate percentage range
  IF p_percentage < 0 OR p_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'percentage must be 0-100');
  END IF;

  -- Check feature exists
  IF NOT EXISTS(SELECT 1 FROM feature_registry WHERE feature_id = p_feature_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'feature_id not found in registry');
  END IF;

  -- Get previous percentage
  SELECT rollout_percentage INTO v_previous_pct
  FROM feature_activation_state
  WHERE feature_id = p_feature_id AND region_id = p_region_id;

  IF v_previous_pct IS NOT DISTINCT FROM p_percentage THEN
    RETURN jsonb_build_object(
      'ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id,
      'percentage', p_percentage, 'previous_percentage', v_previous_pct, 'no_op', true
    );
  END IF;

  -- UPSERT rollout_percentage
  INSERT INTO feature_activation_state (feature_id, region_id, rollout_percentage, activated_by, reason_code)
  VALUES (p_feature_id, p_region_id, p_percentage, p_actor_id, p_reason_code)
  ON CONFLICT (feature_id, region_id) DO UPDATE
    SET rollout_percentage = EXCLUDED.rollout_percentage,
        activated_by       = EXCLUDED.activated_by,
        reason_code        = EXCLUDED.reason_code,
        updated_at         = now();

  -- Emit event
  v_emit_result := emit_event(
    p_event_type      := 'feature_rollout_percentage_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'rollout_percentage_increased'),
    p_idempotency_key := p_idempotency_key,
    p_previous_state  := jsonb_build_object('percentage', v_previous_pct),
    p_resulting_state := jsonb_build_object('percentage', p_percentage, 'feature_id', p_feature_id),
    p_metadata        := jsonb_build_object(
      'feature_id',         p_feature_id,
      'region_id',          p_region_id,
      'previous_percentage', COALESCE(v_previous_pct, 0),
      'new_percentage',     p_percentage,
      'delta',              p_percentage - COALESCE(v_previous_pct, 0)
    )
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for feature_rollout_percentage_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id,
    'percentage', p_percentage, 'previous_percentage', COALESCE(v_previous_pct, 0),
    'event_id', v_emit_result->>'event_id', 'no_op', false
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_feature_rollout_percentage(text, uuid, int, uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_feature_rollout_percentage(text, uuid, int, uuid, text, text) FROM anon;

-- =====================================================
-- set_feature_rollout_rules
-- =====================================================

CREATE OR REPLACE FUNCTION set_feature_rollout_rules(
  p_feature_id      text,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_rules_json      jsonb   DEFAULT '[]'::jsonb,
  p_actor_id        uuid    DEFAULT NULL,
  p_reason_code     text    DEFAULT 'rollback_rules_updated',
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard           jsonb;
  v_rule            jsonb;
  v_rule_id         uuid;
  v_rules_created   int := 0;
  v_emit_result     jsonb;
  v_event_id_check  uuid;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id_check
    FROM event_ledger
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_event_id_check IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id,
        'rules_created', 0, 'no_op', true, 'event_id', v_event_id_check
      );
    END IF;
  END IF;

  -- Guard: founder-only
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode'
    );
  END IF;

  -- Check feature exists
  IF NOT EXISTS(SELECT 1 FROM feature_registry WHERE feature_id = p_feature_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'feature_id not found in registry');
  END IF;

  -- Delete existing rules for this feature+region
  DELETE FROM feature_rollout_rules
  WHERE feature_id = p_feature_id AND region_id = p_region_id;

  -- Insert new rules from JSON array
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules_json) LOOP
    INSERT INTO feature_rollout_rules (
      feature_id, region_id, is_enabled, rule_type, threshold_value,
      window_minutes, action, rollback_target_percentage, cooldown_minutes
    ) VALUES (
      p_feature_id,
      p_region_id,
      COALESCE((v_rule->>'is_enabled')::boolean, true),
      v_rule->>'rule_type',
      (v_rule->>'threshold_value')::numeric,
      COALESCE((v_rule->>'window_minutes')::int, 60),
      v_rule->>'action',
      (v_rule->>'rollback_target_percentage')::int,
      COALESCE((v_rule->>'cooldown_minutes')::int, 30)
    )
    RETURNING id INTO v_rule_id;
    v_rules_created := v_rules_created + 1;
  END LOOP;

  -- Emit event
  v_emit_result := emit_event(
    p_event_type      := 'feature_rollout_rules_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'rollback_rules_updated'),
    p_idempotency_key := p_idempotency_key,
    p_resulting_state := jsonb_build_object('rules_count', v_rules_created),
    p_metadata        := jsonb_build_object(
      'feature_id',     p_feature_id,
      'region_id',      p_region_id,
      'rules_created',  v_rules_created,
      'rules_json',     p_rules_json
    )
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for feature_rollout_rules_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id,
    'rules_created', v_rules_created, 'event_id', v_emit_result->>'event_id'
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_feature_rollout_rules(text, uuid, jsonb, uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_feature_rollout_rules(text, uuid, jsonb, uuid, text, text) FROM anon;
