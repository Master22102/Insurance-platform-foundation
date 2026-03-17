-- =====================================================================
-- ROLLOUT + AUTO-ROLLBACK TEST SUITE
-- Sections: A (deterministic eligibility), B (rollout %), C (rules),
--           D (health eval), E (auto rollback), F (inbox items), G (battery)
-- Run as postgres (service role) in psql or SQL editor
-- =====================================================================

-- =====================================================================
-- SECTION A: Deterministic Eligibility
-- =====================================================================

-- A1: Unknown feature returns false
SELECT
  CASE WHEN is_feature_eligible('F-UNKNOWN', '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 'INCIDENT') = false
  THEN 'A1 PASS: unknown feature returns false'
  ELSE 'A1 FAIL'
  END AS a1;

-- A2: Disabled feature returns false
SELECT
  CASE WHEN is_feature_eligible('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 'INCIDENT') = false
  THEN 'A2 PASS: disabled feature (F-6.5.1) returns false'
  ELSE 'A2 FAIL'
  END AS a2;

-- A3: rollout_percentage=0 returns false
DO $$
BEGIN
  PERFORM set_feature_rollout_percentage('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, 0, NULL, 'test_rollout_0', NULL);
  PERFORM set_feature_activation_state('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, true, NULL, 'test_enable');
  ASSERT is_feature_eligible('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 'INCIDENT') = false,
    'A3 FAIL: rollout_percentage=0 should return false';
  RAISE NOTICE 'A3 PASS: rollout_percentage=0 returns false';
END $$;

-- A4: rollout_percentage=100 returns true
DO $$
BEGIN
  PERFORM set_feature_rollout_percentage('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, 100, NULL, 'test_rollout_100', NULL);
  ASSERT is_feature_eligible('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 'INCIDENT') = true,
    'A4 FAIL: rollout_percentage=100 should return true';
  RAISE NOTICE 'A4 PASS: rollout_percentage=100 returns true';
END $$;

-- A5: Deterministic: same scope_id yields same result
DO $$
DECLARE
  v_scope_id uuid := gen_random_uuid();
  v_result1  boolean;
  v_result2  boolean;
BEGIN
  PERFORM set_feature_rollout_percentage('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, 50, NULL, 'test_rollout_50', NULL);
  v_result1 := is_feature_eligible('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, v_scope_id, 'INCIDENT');
  v_result2 := is_feature_eligible('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid, v_scope_id, 'INCIDENT');
  ASSERT v_result1 = v_result2, 'A5 FAIL: same scope_id yielded different eligibility results';
  RAISE NOTICE 'A5 PASS: deterministic — same scope_id yields same result (scope=%, eligible=%)', v_scope_id, v_result1;
END $$;

-- A6: At 20% rollout, roughly 20% of scope_ids are eligible
DO $$
DECLARE
  v_eligible_count int := 0;
  v_total_count    int := 100;
  v_i              int;
BEGIN
  PERFORM set_feature_rollout_percentage('F-6.5.2', '00000000-0000-0000-0000-000000000000'::uuid, 20, NULL, 'test_rollout_20', NULL);
  PERFORM set_feature_activation_state('F-6.5.2', '00000000-0000-0000-0000-000000000000'::uuid, true, NULL, 'test_enable');
  FOR v_i IN 1..v_total_count LOOP
    IF is_feature_eligible('F-6.5.2', '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid(), 'INCIDENT') THEN
      v_eligible_count := v_eligible_count + 1;
    END IF;
  END LOOP;
  ASSERT v_eligible_count >= 10 AND v_eligible_count <= 30,
    'A6 FAIL: expected ~20 eligible out of 100, got ' || v_eligible_count;
  RAISE NOTICE 'A6 PASS: 20%% rollout yielded % eligible out of 100 (acceptable range 10-30)', v_eligible_count;
END $$;

-- =====================================================================
-- SECTION B: Rollout Percentage Control RPC
-- =====================================================================

-- B1: set_feature_rollout_percentage emits correct event
DO $$
DECLARE
  v_result jsonb;
  v_event  record;
BEGIN
  v_result := set_feature_rollout_percentage('F-6.5.4', '00000000-0000-0000-0000-000000000000'::uuid, 75, NULL, 'test_set_75', 'idem-b1');
  ASSERT (v_result->>'ok')::boolean = true, 'B1 FAIL: set_feature_rollout_percentage returned ok=false';
  ASSERT (v_result->>'percentage')::int = 75, 'B1 FAIL: percentage should be 75';
  SELECT * INTO v_event
  FROM event_ledger
  WHERE event_type = 'feature_rollout_percentage_changed'
    AND metadata->>'feature_id' = 'F-6.5.4'
    AND (metadata->>'new_percentage')::int = 75
  ORDER BY created_at DESC LIMIT 1;
  ASSERT v_event.id IS NOT NULL, 'B1 FAIL: no feature_rollout_percentage_changed event found';
  RAISE NOTICE 'B1 PASS: set_feature_rollout_percentage emitted event with metadata';
END $$;

-- B2: Idempotent call returns no_op=true
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := set_feature_rollout_percentage('F-6.5.4', '00000000-0000-0000-0000-000000000000'::uuid, 75, NULL, 'test_noop', 'idem-b1');
  ASSERT (v_result->>'no_op')::boolean = true, 'B2 FAIL: idempotent call should return no_op=true';
  RAISE NOTICE 'B2 PASS: idempotent call returned no_op=true';
END $$;

-- B3: Percentage out of range rejected
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := set_feature_rollout_percentage('F-6.5.4', '00000000-0000-0000-0000-000000000000'::uuid, 150, NULL, 'test_invalid', NULL);
  ASSERT (v_result->>'ok')::boolean = false, 'B3 FAIL: out-of-range percentage should return ok=false';
  ASSERT v_result->>'error' ILIKE '%0-100%', 'B3 FAIL: error message should mention range';
  RAISE NOTICE 'B3 PASS: out-of-range percentage rejected';
END $$;

-- =====================================================================
-- SECTION C: Rollout Rules RPC
-- =====================================================================

-- C1: set_feature_rollout_rules creates rules
DO $$
DECLARE
  v_rules  jsonb;
  v_result jsonb;
  v_count  int;
BEGIN
  v_rules := '[
    {
      "rule_type": "ERROR_RATE",
      "threshold_value": 0.05,
      "window_minutes": 60,
      "action": "ROLLBACK_TO_PERCENT",
      "rollback_target_percentage": 10,
      "cooldown_minutes": 30
    },
    {
      "rule_type": "SUPPRESSION_SPIKE",
      "threshold_value": 100,
      "window_minutes": 30,
      "action": "ROLLBACK_DISABLE",
      "cooldown_minutes": 60
    }
  ]'::jsonb;
  v_result := set_feature_rollout_rules('F-6.5.8', '00000000-0000-0000-0000-000000000000'::uuid, v_rules, NULL, 'test_rules', 'idem-c1');
  ASSERT (v_result->>'ok')::boolean = true, 'C1 FAIL: set_feature_rollout_rules returned ok=false';
  ASSERT (v_result->>'rules_created')::int = 2, 'C1 FAIL: should create 2 rules, got ' || (v_result->>'rules_created');
  SELECT COUNT(*) INTO v_count FROM feature_rollout_rules WHERE feature_id = 'F-6.5.8';
  ASSERT v_count = 2, 'C1 FAIL: expected 2 rules in table, got ' || v_count;
  RAISE NOTICE 'C1 PASS: set_feature_rollout_rules created 2 rules';
END $$;

-- C2: Rules have correct thresholds and actions
SELECT
  CASE WHEN (
    SELECT COUNT(*) FROM feature_rollout_rules
    WHERE feature_id = 'F-6.5.8'
      AND rule_type = 'ERROR_RATE'
      AND threshold_value = 0.05
      AND action = 'ROLLBACK_TO_PERCENT'
      AND rollback_target_percentage = 10
  ) = 1
  THEN 'C2 PASS: ERROR_RATE rule has correct threshold and action'
  ELSE 'C2 FAIL'
  END AS c2;

-- C3: Replacing rules deletes old ones
DO $$
DECLARE
  v_new_rules jsonb;
  v_result    jsonb;
  v_count     int;
BEGIN
  v_new_rules := '[{"rule_type":"INBOX_SPIKE","threshold_value":50,"window_minutes":60,"action":"ROLLBACK_DISABLE","cooldown_minutes":30}]'::jsonb;
  v_result := set_feature_rollout_rules('F-6.5.8', '00000000-0000-0000-0000-000000000000'::uuid, v_new_rules, NULL, 'test_replace', NULL);
  SELECT COUNT(*) INTO v_count FROM feature_rollout_rules WHERE feature_id = 'F-6.5.8';
  ASSERT v_count = 1, 'C3 FAIL: expected 1 rule after replacement, got ' || v_count;
  RAISE NOTICE 'C3 PASS: replacing rules deleted old ones, now 1 rule';
END $$;

-- =====================================================================
-- SECTION D: Health Evaluation
-- =====================================================================

-- D1: evaluate_feature_rollout_health writes health_state
DO $$
DECLARE
  v_result jsonb;
  v_health record;
BEGIN
  v_result := evaluate_feature_rollout_health('F-6.5.4', '00000000-0000-0000-0000-000000000000'::uuid, 60);
  ASSERT (v_result->>'ok')::boolean = true, 'D1 FAIL: evaluate returned ok=false';
  SELECT * INTO v_health
  FROM feature_rollout_health_state
  WHERE feature_id = 'F-6.5.4'
    AND region_id  = '00000000-0000-0000-0000-000000000000'::uuid
    AND window_minutes = 60;
  ASSERT v_health.id IS NOT NULL, 'D1 FAIL: no health_state row found';
  ASSERT v_health.health_status IN ('HEALTHY','DEGRADED','UNHEALTHY'), 'D1 FAIL: invalid health_status';
  RAISE NOTICE 'D1 PASS: evaluate wrote health_state, status=%', v_health.health_status;
END $$;

-- D2: Health metrics include expected fields
DO $$
DECLARE
  v_health record;
BEGIN
  SELECT * INTO v_health FROM feature_rollout_health_state WHERE feature_id = 'F-6.5.4' LIMIT 1;
  ASSERT (v_health.metrics->>'total_events') IS NOT NULL, 'D2 FAIL: metrics missing total_events';
  ASSERT (v_health.metrics->>'suppression_rate') IS NOT NULL, 'D2 FAIL: metrics missing suppression_rate';
  ASSERT (v_health.metrics->>'error_rate') IS NOT NULL, 'D2 FAIL: metrics missing error_rate';
  ASSERT (v_health.metrics->>'battery_warnings') IS NOT NULL, 'D2 FAIL: metrics missing battery_warnings';
  ASSERT (v_health.metrics->>'inbox_open_count') IS NOT NULL, 'D2 FAIL: metrics missing inbox_open_count';
  RAISE NOTICE 'D2 PASS: health metrics contain all required fields';
END $$;

-- D3: Evaluator emits event
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM event_ledger
    WHERE event_type = 'feature_rollout_health_evaluated'
      AND metadata->>'feature_id' = 'F-6.5.4'
  )
  THEN 'D3 PASS: health evaluator emitted event'
  ELSE 'D3 FAIL'
  END AS d3;

-- =====================================================================
-- SECTION E: Auto-Rollback Trigger
-- =====================================================================

-- E1: Setup scenario: create unhealthy feature + rule
DO $$
DECLARE
  v_result jsonb;
  v_i int;
BEGIN
  -- Enable F-6.5.9 at 80% rollout
  v_result := set_feature_rollout_percentage(
    p_feature_id := 'F-6.5.9',
    p_region_id := '00000000-0000-0000-0000-000000000000'::uuid,
    p_percentage := 80,
    p_actor_id := '11111111-1111-1111-1111-111111111111'::uuid,
    p_reason_code := 'test_e1_setup'
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'E1 rollout failed';
  END IF;

  -- Enable the feature
  PERFORM set_feature_activation_state(
    p_feature_id := 'F-6.5.9',
    p_region_id := '00000000-0000-0000-0000-000000000000'::uuid,
    p_enabled := true,
    p_reason_code := 'test_e1_enable',
    p_actor_id := '11111111-1111-1111-1111-111111111111'::uuid
  );

  -- Create auto-rollback rule
  v_result := set_feature_rollout_rules(
    p_feature_id := 'F-6.5.9',
    p_region_id := '00000000-0000-0000-0000-000000000000'::uuid,
    p_rules_json := jsonb_build_array(
      jsonb_build_object(
        'rule_type', 'INBOX_SPIKE',
        'threshold_value', 5,
        'window_minutes', 60,
        'action', 'ROLLBACK_TO_PERCENT',
        'rollback_target_percentage', 20,
        'cooldown_minutes', 30
      )
    ),
    p_actor_id := '11111111-1111-1111-1111-111111111111'::uuid,
    p_reason_code := 'test_e1_rule_setup'
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'E1 rules failed';
  END IF;

  -- Create 25 inbox items to trigger threshold (evaluator checks inbox_open_count > 20)
  FOR v_i IN 1..25 LOOP
    INSERT INTO action_inbox_items (
      feature_id, item_type, priority, status, title, body,
      next_step_hint, reason_code, idempotency_key, metadata
    ) VALUES (
      'F-6.5.9', 'alert', 'low', 'open',
      'Test inbox item ' || v_i,
      'Auto-rollback test item for spike detection',
      'Review feature usage', 'test_e1_spike',
      'test_e1_inbox_' || v_i || '_' || extract(epoch from now())::text,
      jsonb_build_object('test_index', v_i)
    );
  END LOOP;
END $$;

-- E2: Evaluate health → UNHEALTHY
DO $$
DECLARE
  v_result jsonb;
  v_health record;
BEGIN
  v_result := evaluate_feature_rollout_health('F-6.5.9', '00000000-0000-0000-0000-000000000000'::uuid, 60);
  SELECT * INTO v_health
  FROM feature_rollout_health_state
  WHERE feature_id = 'F-6.5.9'
    AND region_id  = '00000000-0000-0000-0000-000000000000'::uuid
    AND window_minutes = 60;
  ASSERT v_health.health_status = 'UNHEALTHY', 'E2 FAIL: expected UNHEALTHY, got ' || v_health.health_status;
  ASSERT (v_health.metrics->>'inbox_open_count')::int > 20, 'E2 FAIL: inbox_open_count not > 20';
END $$;

-- E3: Trigger auto-rollback
DO $$
DECLARE
  v_result       jsonb;
  v_new_pct      int;
  v_inbox_count  int;
BEGIN
  v_result := run_feature_rollout_auto_rollback(10);
  ASSERT (v_result->>'ok')::boolean = true, 'E3 FAIL: auto_rollback returned ok=false';
  ASSERT (v_result->>'rollbacks_triggered')::int >= 1, 'E3 FAIL: expected at least 1 rollback, got ' || (v_result->>'rollbacks_triggered');

  -- Verify rollout_percentage changed to 20
  SELECT rollout_percentage INTO v_new_pct
  FROM feature_activation_state
  WHERE feature_id = 'F-6.5.9'
    AND region_id  = '00000000-0000-0000-0000-000000000000'::uuid;
  ASSERT v_new_pct = 20, 'E3 FAIL: expected rollout_percentage=20 after rollback, got ' || v_new_pct;

  -- Verify rollback events emitted
  ASSERT EXISTS (
    SELECT 1 FROM event_ledger
    WHERE event_type = 'feature_auto_rollback_triggered'
      AND metadata->>'feature_id' = 'F-6.5.9'
  ), 'E3 FAIL: no feature_auto_rollback_triggered event found';

  ASSERT EXISTS (
    SELECT 1 FROM event_ledger
    WHERE event_type = 'feature_auto_rollback_completed'
      AND metadata->>'feature_id' = 'F-6.5.9'
  ), 'E3 FAIL: no feature_auto_rollback_completed event found';

  RAISE NOTICE 'E3 PASS: auto-rollback triggered, rolled back F-6.5.9 from 80%% to 20%%';
END $$;

-- E4: Cooldown prevents immediate re-trigger
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- Run auto-rollback again immediately
  v_result := run_feature_rollout_auto_rollback(10);
  ASSERT (v_result->>'rollbacks_triggered')::int = 0, 'E4 FAIL: cooldown should prevent immediate re-trigger, got ' || (v_result->>'rollbacks_triggered');
  RAISE NOTICE 'E4 PASS: cooldown prevented immediate re-trigger';
END $$;

-- =====================================================================
-- SECTION F: Action Inbox Integration
-- =====================================================================

-- F1: Verify inbox items exist for F-6.5.9
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM action_inbox_items
  WHERE feature_id = 'F-6.5.9' AND status = 'open';
  ASSERT v_count >= 25, 'F1 FAIL: expected >= 25 inbox items, got ' || v_count;
END $$;

-- F2: Verify escalation items exist in system
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM action_inbox_items
  WHERE item_type = 'escalation';
  ASSERT v_count >= 1, 'F2 FAIL: expected >= 1 escalation item, got ' || v_count;
END $$;

-- =====================================================================
-- SECTION G: Battery Check
-- =====================================================================

-- G1: Battery 0 critical failures
SELECT
  CASE WHEN (SELECT COUNT(*) FROM release_battery_failures() WHERE severity='critical') = 0
  THEN 'G1 PASS: Battery 0 critical failures'
  ELSE 'G1 FAIL: Battery has critical failures'
  END AS g1;

-- G2: Final counts summary
SELECT
  (SELECT COUNT(*) FROM feature_registry WHERE feature_id LIKE 'F-%') AS total_features,
  (SELECT COUNT(*) FROM feature_activation_state WHERE rollout_percentage > 0) AS features_with_rollout,
  (SELECT COUNT(*) FROM feature_rollout_rules WHERE is_enabled = true) AS active_rollout_rules,
  (SELECT COUNT(*) FROM feature_rollout_health_state) AS health_state_rows,
  (SELECT COUNT(*) FROM event_ledger WHERE event_type LIKE '%rollout%' OR event_type LIKE '%rollback%') AS rollout_events,
  (SELECT COUNT(*) FROM action_inbox_items WHERE feature_id = 'governance' AND item_type = 'escalation') AS rollback_inbox_items;
