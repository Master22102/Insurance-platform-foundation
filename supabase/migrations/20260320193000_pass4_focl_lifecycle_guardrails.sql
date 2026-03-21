/*
  Pass 4 lifecycle guardrails:
  - Plain blocked-attempt governance events for protective posture
  - Auth-bound actor enforcement for feature governance RPCs
  - Append-only protection for feature registry rows
*/

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('feature_activation_blocked_protective', 1, 'governance', 'warning'),
  ('feature_rollout_blocked_protective', 1, 'governance', 'warning')
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
  v_actor_id        uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id <> v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_emit_result := emit_event(
      p_event_type  := 'feature_activation_blocked_protective',
      p_feature_id  := 'governance',
      p_scope_type  := 'system',
      p_scope_id    := p_region_id,
      p_actor_id    := v_actor_id,
      p_actor_type  := 'user',
      p_reason_code := 'protective_mode_active',
      p_metadata    := jsonb_build_object(
        'feature_id', p_feature_id,
        'mode', v_guard->>'mode',
        'mutation_class', 'feature_gate'
      )
    );
    IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed for feature_activation_blocked_protective: %', v_emit_result->>'error';
    END IF;
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
  VALUES (p_feature_id, p_region_id, p_enabled, v_actor_id, p_reason_code)
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
    p_actor_id        := v_actor_id,
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
  IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
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
  v_actor_id        uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id <> v_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id_check FROM event_ledger WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_event_id_check IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id, 'percentage', p_percentage, 'no_op', true, 'event_id', v_event_id_check);
    END IF;
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_emit_result := emit_event(
      p_event_type  := 'feature_rollout_blocked_protective',
      p_feature_id  := 'governance',
      p_scope_type  := 'system',
      p_scope_id    := p_region_id,
      p_actor_id    := v_actor_id,
      p_actor_type  := 'user',
      p_reason_code := 'protective_mode_active',
      p_metadata    := jsonb_build_object('feature_id', p_feature_id, 'mode', v_guard->>'mode')
    );
    IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed for feature_rollout_blocked_protective: %', v_emit_result->>'error';
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF p_percentage < 0 OR p_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'percentage must be 0-100');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM feature_registry WHERE feature_id = p_feature_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'feature_id not found in registry');
  END IF;

  SELECT rollout_percentage INTO v_previous_pct
  FROM feature_activation_state
  WHERE feature_id = p_feature_id AND region_id = p_region_id;

  IF v_previous_pct IS NOT DISTINCT FROM p_percentage THEN
    RETURN jsonb_build_object('ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id, 'percentage', p_percentage, 'previous_percentage', v_previous_pct, 'no_op', true);
  END IF;

  INSERT INTO feature_activation_state (feature_id, region_id, rollout_percentage, activated_by, reason_code)
  VALUES (p_feature_id, p_region_id, p_percentage, v_actor_id, p_reason_code)
  ON CONFLICT (feature_id, region_id) DO UPDATE
    SET rollout_percentage = EXCLUDED.rollout_percentage,
        activated_by       = EXCLUDED.activated_by,
        reason_code        = EXCLUDED.reason_code,
        updated_at         = now();

  v_emit_result := emit_event(
    p_event_type      := 'feature_rollout_percentage_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := v_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'rollout_percentage_increased'),
    p_idempotency_key := p_idempotency_key,
    p_previous_state  := jsonb_build_object('percentage', v_previous_pct),
    p_resulting_state := jsonb_build_object('percentage', p_percentage, 'feature_id', p_feature_id),
    p_metadata        := jsonb_build_object('feature_id', p_feature_id, 'region_id', p_region_id, 'previous_percentage', COALESCE(v_previous_pct, 0), 'new_percentage', p_percentage)
  );
  IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed for feature_rollout_percentage_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id, 'percentage', p_percentage, 'previous_percentage', COALESCE(v_previous_pct, 0), 'event_id', v_emit_result->>'event_id', 'no_op', false);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

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
  v_actor_id        uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id <> v_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id_check FROM event_ledger WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_event_id_check IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id, 'rules_created', 0, 'no_op', true, 'event_id', v_event_id_check);
    END IF;
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'feature_gate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_emit_result := emit_event(
      p_event_type  := 'feature_rollout_blocked_protective',
      p_feature_id  := 'governance',
      p_scope_type  := 'system',
      p_scope_id    := p_region_id,
      p_actor_id    := v_actor_id,
      p_actor_type  := 'user',
      p_reason_code := 'protective_mode_active',
      p_metadata    := jsonb_build_object('feature_id', p_feature_id, 'mode', v_guard->>'mode')
    );
    IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed for feature_rollout_blocked_protective: %', v_emit_result->>'error';
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM feature_registry WHERE feature_id = p_feature_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'feature_id not found in registry');
  END IF;

  DELETE FROM feature_rollout_rules
  WHERE feature_id = p_feature_id AND region_id = p_region_id;

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

  v_emit_result := emit_event(
    p_event_type      := 'feature_rollout_rules_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := v_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'rollback_rules_updated'),
    p_idempotency_key := p_idempotency_key,
    p_resulting_state := jsonb_build_object('rules_count', v_rules_created),
    p_metadata        := jsonb_build_object('feature_id', p_feature_id, 'region_id', p_region_id, 'rules_created', v_rules_created)
  );
  IF COALESCE((v_emit_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed for feature_rollout_rules_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'feature_id', p_feature_id, 'region_id', p_region_id, 'rules_created', v_rules_created, 'event_id', v_emit_result->>'event_id');
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION feature_registry_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'feature_registry is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_registry_immutable_update ON feature_registry;
CREATE TRIGGER trg_feature_registry_immutable_update
BEFORE UPDATE ON feature_registry
FOR EACH ROW
EXECUTE FUNCTION feature_registry_immutable();

DROP TRIGGER IF EXISTS trg_feature_registry_immutable_delete ON feature_registry;
CREATE TRIGGER trg_feature_registry_immutable_delete
BEFORE DELETE ON feature_registry
FOR EACH ROW
EXECUTE FUNCTION feature_registry_immutable();
