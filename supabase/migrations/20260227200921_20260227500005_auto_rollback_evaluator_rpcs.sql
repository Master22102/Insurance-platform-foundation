/*
  # Auto-Rollback Evaluator RPCs (D)

  ## Summary
  Background job RPCs that:
  1. Evaluate feature rollout health by observing metrics in time windows
  2. Trigger automatic rollback when rules' thresholds are exceeded (respecting cooldown)

  ## New RPCs

  ### evaluate_feature_rollout_health(feature_id, region_id, window_minutes)
  - Computes metrics from event_ledger + action_inbox_items + release_battery_failures
  - Writes/updates feature_rollout_health_state row
  - Emits feature_rollout_health_evaluated event
  - Returns: health_status (HEALTHY|DEGRADED|UNHEALTHY)

  ### run_feature_rollout_auto_rollback(batch_size)
  - Scans enabled rules for features with health_state=UNHEALTHY
  - Checks cooldown_minutes since last_rollback_at
  - Triggers rollback action (ROLLBACK_TO_PERCENT or ROLLBACK_DISABLE)
  - Emits: feature_auto_rollback_triggered + feature_auto_rollback_completed
  - Creates action inbox item (directly, bypassing projector for urgency)
  - Returns: count of rollbacks triggered

  ## Event Types (register)
  - feature_rollout_health_evaluated
  - feature_auto_rollback_triggered
  - feature_auto_rollback_completed

  ## Metrics Computed
  - suppression_rate: (suppression events in window) / (total events in window)
  - error_rate: (error events in window) / (total events in window)
  - battery_warning_count: count of warnings from release_battery_failures
  - inbox_open_count: count of open action_inbox_items for this feature

  ## Health Status Logic
  - HEALTHY: all metrics below thresholds
  - DEGRADED: 1+ metrics between 50-100% of threshold
  - UNHEALTHY: 1+ metrics >= threshold (triggers rollback)

  ## Security
  - SECURITY DEFINER
  - EXECUTE granted to authenticated (intended for background job runner)
*/

-- Register event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('feature_rollout_health_evaluated',   1, 'governance'),
  ('feature_auto_rollback_triggered',    1, 'governance'),
  ('feature_auto_rollback_completed',    1, 'governance')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- evaluate_feature_rollout_health
-- =====================================================

CREATE OR REPLACE FUNCTION evaluate_feature_rollout_health(
  p_feature_id     text,
  p_region_id      uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_window_minutes int  DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start          timestamptz;
  v_total_events          bigint;
  v_suppression_events    bigint;
  v_error_events          bigint;
  v_battery_warnings      bigint;
  v_inbox_open_count      bigint;
  v_suppression_rate      numeric;
  v_error_rate            numeric;
  v_health_status         text := 'HEALTHY';
  v_metrics               jsonb;
  v_emit_result           jsonb;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;

  -- Count total events for this feature in window
  SELECT COUNT(*)
  INTO v_total_events
  FROM event_ledger
  WHERE feature_id = p_feature_id
    AND created_at >= v_window_start;

  -- Count suppression events
  SELECT COUNT(*)
  INTO v_suppression_events
  FROM event_ledger
  WHERE feature_id = p_feature_id
    AND event_type LIKE '%_suppressed'
    AND created_at >= v_window_start;

  -- Count error events (event_type contains 'error' or 'failed')
  SELECT COUNT(*)
  INTO v_error_events
  FROM event_ledger
  WHERE feature_id = p_feature_id
    AND (event_type ILIKE '%error%' OR event_type ILIKE '%failed%')
    AND created_at >= v_window_start;

  -- Count battery warnings
  SELECT COUNT(*)
  INTO v_battery_warnings
  FROM release_battery_failures()
  WHERE severity = 'warning';

  -- Count open inbox items for this feature
  SELECT COUNT(*)
  INTO v_inbox_open_count
  FROM action_inbox_items
  WHERE feature_id = p_feature_id
    AND status = 'open';

  -- Compute rates
  v_suppression_rate := CASE WHEN v_total_events > 0
    THEN v_suppression_events::numeric / v_total_events::numeric
    ELSE 0
  END;

  v_error_rate := CASE WHEN v_total_events > 0
    THEN v_error_events::numeric / v_total_events::numeric
    ELSE 0
  END;

  -- Simple health status: if any metric looks bad, flag as UNHEALTHY
  -- (Threshold checks happen in auto_rollback evaluator per rule)
  -- Here we just set a basic status for observability
  IF v_suppression_rate > 0.5 OR v_error_rate > 0.1 OR v_battery_warnings > 5 OR v_inbox_open_count > 20 THEN
    v_health_status := 'UNHEALTHY';
  ELSIF v_suppression_rate > 0.2 OR v_error_rate > 0.05 OR v_battery_warnings > 2 OR v_inbox_open_count > 10 THEN
    v_health_status := 'DEGRADED';
  ELSE
    v_health_status := 'HEALTHY';
  END IF;

  -- Build metrics JSON
  v_metrics := jsonb_build_object(
    'total_events',        v_total_events,
    'suppression_events',  v_suppression_events,
    'error_events',        v_error_events,
    'battery_warnings',    v_battery_warnings,
    'inbox_open_count',    v_inbox_open_count,
    'suppression_rate',    v_suppression_rate,
    'error_rate',          v_error_rate,
    'window_minutes',      p_window_minutes,
    'window_start',        v_window_start
  );

  -- UPSERT health_state
  INSERT INTO feature_rollout_health_state (
    feature_id, region_id, window_minutes, last_evaluated_at, metrics, health_status
  ) VALUES (
    p_feature_id, p_region_id, p_window_minutes, now(), v_metrics, v_health_status
  )
  ON CONFLICT (feature_id, region_id, window_minutes) DO UPDATE
    SET last_evaluated_at = now(),
        metrics           = EXCLUDED.metrics,
        health_status     = EXCLUDED.health_status,
        updated_at        = now();

  -- Emit event
  v_emit_result := emit_event(
    p_event_type      := 'feature_rollout_health_evaluated',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := NULL,
    p_actor_type      := 'system',
    p_reason_code     := 'health_evaluated_ok',
    p_metadata        := jsonb_build_object(
      'feature_id',     p_feature_id,
      'region_id',      p_region_id,
      'health_status',  v_health_status,
      'metrics',        v_metrics
    )
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'feature_id',    p_feature_id,
    'region_id',     p_region_id,
    'health_status', v_health_status,
    'metrics',       v_metrics,
    'event_id',      v_emit_result->>'event_id'
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION evaluate_feature_rollout_health(text, uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION evaluate_feature_rollout_health(text, uuid, int) FROM anon;

-- =====================================================
-- run_feature_rollout_auto_rollback
-- =====================================================

CREATE OR REPLACE FUNCTION run_feature_rollout_auto_rollback(
  p_batch_size int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule                  record;
  v_health                record;
  v_metric_value          numeric;
  v_threshold_exceeded    boolean;
  v_rollbacks_triggered   int := 0;
  v_emit_trigger          jsonb;
  v_emit_complete         jsonb;
  v_new_percentage        int;
  v_new_enabled           boolean;
  v_inbox_item_id         uuid;
  v_cooldown_ok           boolean;
BEGIN
  -- Scan enabled rules with associated health_state=UNHEALTHY
  FOR v_rule IN
    SELECT
      r.*,
      h.metrics,
      h.last_rollback_at,
      h.health_status
    FROM feature_rollout_rules r
    INNER JOIN feature_rollout_health_state h
      ON h.feature_id = r.feature_id
      AND h.region_id = r.region_id
      AND h.window_minutes = r.window_minutes
    WHERE r.is_enabled = true
      AND h.health_status = 'UNHEALTHY'
    ORDER BY r.feature_id, r.region_id
    LIMIT p_batch_size
  LOOP
    -- Check cooldown: must be NULL or > cooldown_minutes ago
    v_cooldown_ok := (
      v_rule.last_rollback_at IS NULL
      OR v_rule.last_rollback_at < (now() - (v_rule.cooldown_minutes || ' minutes')::interval)
    );

    IF NOT v_cooldown_ok THEN
      CONTINUE;  -- Skip this rule, still in cooldown
    END IF;

    -- Extract metric value based on rule_type
    v_metric_value := CASE v_rule.rule_type
      WHEN 'ERROR_RATE'        THEN (v_rule.metrics->>'error_rate')::numeric
      WHEN 'BATTERY_WARNING'   THEN (v_rule.metrics->>'battery_warnings')::numeric
      WHEN 'SUPPRESSION_SPIKE' THEN (v_rule.metrics->>'suppression_events')::numeric
      WHEN 'INBOX_SPIKE'       THEN (v_rule.metrics->>'inbox_open_count')::numeric
      ELSE 0
    END;

    -- Check if threshold exceeded
    v_threshold_exceeded := (v_metric_value >= v_rule.threshold_value);

    IF NOT v_threshold_exceeded THEN
      CONTINUE;  -- Metric below threshold, no rollback needed
    END IF;

    -- Emit rollback triggered event
    v_emit_trigger := emit_event(
      p_event_type := 'feature_auto_rollback_triggered',
      p_feature_id := 'governance',
      p_scope_type := 'system',
      p_scope_id   := v_rule.region_id,
      p_actor_id   := NULL,
      p_actor_type := 'system',
      p_reason_code := CASE v_rule.rule_type
        WHEN 'ERROR_RATE'        THEN 'rollback_error_rate_exceeded'
        WHEN 'BATTERY_WARNING'   THEN 'rollback_battery_warning_exceeded'
        WHEN 'SUPPRESSION_SPIKE' THEN 'rollback_suppression_spike'
        WHEN 'INBOX_SPIKE'       THEN 'rollback_inbox_spike'
        ELSE 'rollback_threshold_exceeded'
      END,
      p_metadata := jsonb_build_object(
        'feature_id',       v_rule.feature_id,
        'region_id',        v_rule.region_id,
        'rule_id',          v_rule.id,
        'rule_type',        v_rule.rule_type,
        'threshold_value',  v_rule.threshold_value,
        'observed_value',   v_metric_value,
        'action',           v_rule.action,
        'rollback_target',  v_rule.rollback_target_percentage,
        'metrics_snapshot', v_rule.metrics
      )
    );

    -- Execute rollback action
    IF v_rule.action = 'ROLLBACK_TO_PERCENT' THEN
      v_new_percentage := v_rule.rollback_target_percentage;
      UPDATE feature_activation_state
      SET rollout_percentage = v_new_percentage,
          reason_code        = 'auto_rollback_triggered',
          updated_at         = now()
      WHERE feature_id = v_rule.feature_id
        AND region_id  = v_rule.region_id;

    ELSIF v_rule.action = 'ROLLBACK_DISABLE' THEN
      v_new_enabled    := false;
      v_new_percentage := 0;
      UPDATE feature_activation_state
      SET enabled            = false,
          rollout_percentage = 0,
          reason_code        = 'auto_rollback_disabled',
          updated_at         = now()
      WHERE feature_id = v_rule.feature_id
        AND region_id  = v_rule.region_id;
    END IF;

    -- Update last_rollback_at on health_state
    UPDATE feature_rollout_health_state
    SET last_rollback_at = now(),
        updated_at       = now()
    WHERE feature_id     = v_rule.feature_id
      AND region_id      = v_rule.region_id
      AND window_minutes = v_rule.window_minutes;

    -- Emit rollback completed event
    v_emit_complete := emit_event(
      p_event_type := 'feature_auto_rollback_completed',
      p_feature_id := 'governance',
      p_scope_type := 'system',
      p_scope_id   := v_rule.region_id,
      p_actor_id   := NULL,
      p_actor_type := 'system',
      p_reason_code := 'auto_rollback_completed',
      p_resulting_state := jsonb_build_object(
        'enabled',            COALESCE(v_new_enabled, true),
        'rollout_percentage', v_new_percentage
      ),
      p_metadata := jsonb_build_object(
        'feature_id',  v_rule.feature_id,
        'region_id',   v_rule.region_id,
        'rule_id',     v_rule.id,
        'action',      v_rule.action,
        'new_percentage', v_new_percentage,
        'trigger_event_id', v_emit_trigger->>'event_id'
      )
    );

    -- Create action inbox item (directly, bypassing projector for urgency)
    INSERT INTO action_inbox_items (
      feature_id, incident_id, source_event_id,
      item_type, status, priority,
      title, body,
      reason_code, next_step_hint,
      idempotency_key, metadata
    ) VALUES (
      'governance',
      NULL,
      (v_emit_trigger->>'event_id')::uuid,
      'escalation',
      'open',
      'critical',
      'Auto-rollback triggered: ' || v_rule.feature_id,
      'Feature ' || v_rule.feature_id || ' auto-rolled back due to ' || v_rule.rule_type || ' threshold exceeded. Observed: ' || v_metric_value || ', Threshold: ' || v_rule.threshold_value || '. Action: ' || v_rule.action || '.',
      CASE v_rule.rule_type
        WHEN 'ERROR_RATE'        THEN 'rollback_error_rate_exceeded'
        WHEN 'BATTERY_WARNING'   THEN 'rollback_battery_warning_exceeded'
        WHEN 'SUPPRESSION_SPIKE' THEN 'rollback_suppression_spike'
        WHEN 'INBOX_SPIKE'       THEN 'rollback_inbox_spike'
        ELSE 'rollback_threshold_exceeded'
      END,
      'Review health metrics, investigate root cause, and re-enable rollout when safe. Check event ledger for trigger details.',
      'rollback:' || (v_emit_trigger->>'event_id'),
      jsonb_build_object(
        'rule_id',         v_rule.id,
        'feature_id',      v_rule.feature_id,
        'region_id',       v_rule.region_id,
        'trigger_event_id', v_emit_trigger->>'event_id',
        'complete_event_id', v_emit_complete->>'event_id',
        'metrics_snapshot', v_rule.metrics
      )
    )
    RETURNING item_id INTO v_inbox_item_id;

    v_rollbacks_triggered := v_rollbacks_triggered + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',                  true,
    'rollbacks_triggered', v_rollbacks_triggered,
    'batch_size',          p_batch_size
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION run_feature_rollout_auto_rollback(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION run_feature_rollout_auto_rollback(int) FROM anon;
