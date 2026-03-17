/*
  # Option A: Ledger Takeover

  ## Overview
  All mutating RPCs now:
  (a) call precheck_mutation_guard() and reject if not allowed
  (b) emit events only through emit_event() with registered event_type, envelope fields, and checksum chain
  (c) RAISE EXCEPTION (rollback) if emit_event() fails

  ## Bypasses Fixed
  - change_incident_status: was using emit_event('status_changed') but no guard call; upgraded to incident_status_changed
  - change_connector_state: was INSERT INTO event_logs with legacy 'state_changed'; now guarded + emit_event('connector_state_changed')
  - approve_connector_manual_review: was INSERT INTO event_logs 'manual_review_approved'; now guarded + emit_event('connector_manual_review_approved')
  - log_connector_failure: was INSERT INTO event_logs 'connector_failure'; now guarded + emit_event('connector_failure_logged') + guarded auto-downgrade events
  - run_connector_health_check_job: was INSERT INTO event_logs; now guarded + emit_event
  - get_connector_failures_24h: only counted 'connector_failure'; now counts both 'connector_failure_logged' and 'connector_failure' (legacy)

  ## New Mutation Classes
  incident_status_change, connector_state_change_manual, connector_manual_review_approve,
  connector_failure_log, connector_auto_downgrade, connector_health_check_job

  ## Backward Compatibility
  - Compatibility view (event_logs) unchanged
  - No schema changes to domain tables
  - Legacy 'connector_failure' event_type kept registered for backward read compatibility
*/

-- =====================================================
-- STEP 1: Register new canonical event types
-- =====================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('incident_status_changed',           1, 'incidents',  'info'),
  ('connector_manual_review_approved',  1, 'connectors', 'info'),
  ('connector_health_check_completed',  1, 'connectors', 'info')
ON CONFLICT (event_type) DO NOTHING;

-- Ensure all event types used by patched RPCs are registered
-- (connector_failure_logged, auto_downgrade_to_degraded, auto_downgrade_to_manual_only,
--  connector_state_changed, manual_review_approved, connector_failure already registered in v1)
-- Add 'state_changed' as deprecated legacy type so existing rows don't break battery check
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class, deprecated_at)
VALUES
  ('state_changed', 1, 'connectors', 'info', now())
ON CONFLICT (event_type) DO UPDATE SET deprecated_at = COALESCE(event_type_registry.deprecated_at, now());

-- =====================================================
-- STEP 2: Expand precheck_mutation_guard() matrix
-- =====================================================

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
  -- Get region operational mode (default to PROTECTIVE if missing)
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_mode IS NULL THEN
    v_mode := 'PROTECTIVE';
  END IF;

  IF v_mode = 'NORMAL' THEN
    -- NORMAL: all mutation classes allowed
    v_allowed := true;

  ELSIF v_mode = 'ELEVATED' THEN
    -- ELEVATED: block only registry edits and threshold overrides
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );

  ELSIF v_mode = 'PROTECTIVE' THEN
    -- PROTECTIVE: allow safety self-protection writes + minimal incident capture
    -- Blocks manual connector ops and registry changes
    v_allowed := p_mutation_class IN (
      'trip_create',
      'incident_create',
      'evidence_upload',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job'
    );

  ELSIF v_mode = 'RECOVERY' THEN
    -- RECOVERY: allow incident/evidence work + automated connector ops
    -- Blocks manual connector state changes and manual approvals
    v_allowed := p_mutation_class IN (
      'evidence_upload',
      'incident_create',
      'incident_status_change',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job'
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

-- =====================================================
-- STEP 3: get_connector_failures_24h — count both event types
-- =====================================================

CREATE OR REPLACE FUNCTION get_connector_failures_24h(
  p_connector_id uuid,
  p_failure_code_filter failure_code DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count both canonical connector_failure_logged and legacy connector_failure
  -- Prefer scope_type/scope_id; fallback to legacy related_entity fields
  SELECT COUNT(*) INTO v_count
  FROM event_ledger
  WHERE (
    -- Canonical: scope-based lookup
    (scope_type = 'connector' AND scope_id = p_connector_id)
    OR
    -- Legacy: related_entity-based lookup
    (related_entity_type = 'connector' AND related_entity_id = p_connector_id)
  )
  AND event_type IN ('connector_failure_logged', 'connector_failure')
  AND created_at >= now() - interval '24 hours'
  AND (
    p_failure_code_filter IS NULL
    OR failure_code = p_failure_code_filter
    OR (failure_code IS NULL AND event_data->>'failure_code' = p_failure_code_filter::text)
    OR metadata->>'failure_code' = p_failure_code_filter::text
  );

  RETURN v_count;
END;
$$;

-- =====================================================
-- STEP 4: change_incident_status — guard + emit_event + atomic rollback
-- =====================================================

CREATE OR REPLACE FUNCTION change_incident_status(
  p_incident_id uuid,
  p_new_status incident_status,
  p_actor_id uuid,
  p_reason_code text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status incident_status;
  v_evidence_count integer := 0;
  v_guard jsonb;
  v_emit_result jsonb;
BEGIN
  -- (a) Guard check
  v_guard := precheck_mutation_guard(p_region_id, 'incidents', 'incident_status_change');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'incident_status_change'
    );
  END IF;

  -- Get current status
  SELECT status INTO v_current_status
  FROM incidents
  WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incident not found');
  END IF;

  -- Rule A: Capture → Action requires evidence
  IF v_current_status = 'Capture' AND p_new_status = 'Action' THEN
    SELECT COUNT(*) INTO v_evidence_count
    FROM evidence
    WHERE incident_id = p_incident_id;

    IF v_evidence_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot move to Action status without evidence'
      );
    END IF;
  END IF;

  -- (b) Update + emit_event; (c) RAISE on emit failure → atomic rollback
  UPDATE incidents
  SET status = p_new_status, updated_at = now()
  WHERE id = p_incident_id;

  v_emit_result := emit_event(
    p_event_type     := 'incident_status_changed',
    p_feature_id     := 'incidents',
    p_scope_type     := 'incident',
    p_scope_id       := p_incident_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := CASE WHEN p_actor_id IS NOT NULL THEN 'traveler' ELSE 'system' END,
    p_reason_code    := p_reason_code,
    p_previous_state := jsonb_build_object('status', v_current_status::text),
    p_resulting_state:= jsonb_build_object('status', p_new_status::text),
    p_metadata       := jsonb_build_object(
      'from', v_current_status::text,
      'to', p_new_status::text,
      'evidence_count', v_evidence_count
    )
  );

  -- (c) Atomic rollback on emit failure
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'from', v_current_status::text,
    'to', p_new_status::text,
    'event_id', v_emit_result->>'event_id'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 5: approve_connector_manual_review — guard + emit_event
-- =====================================================

CREATE OR REPLACE FUNCTION approve_connector_manual_review(
  p_connector_id uuid,
  p_actor_id uuid,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard jsonb;
  v_emit_result jsonb;
  v_connector_exists boolean;
BEGIN
  -- (a) Guard check
  v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_manual_review_approve');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'connector_manual_review_approve'
    );
  END IF;

  SELECT EXISTS(SELECT 1 FROM connectors WHERE id = p_connector_id) INTO v_connector_exists;
  IF NOT v_connector_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connector not found');
  END IF;

  -- (b) Emit event through emit_event
  v_emit_result := emit_event(
    p_event_type     := 'connector_manual_review_approved',
    p_feature_id     := 'connectors',
    p_scope_type     := 'connector',
    p_scope_id       := p_connector_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := CASE WHEN p_actor_id IS NOT NULL THEN 'support' ELSE 'system' END,
    p_metadata       := jsonb_build_object('approved_at', now())
  );

  -- (c) Atomic rollback on emit failure
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Manual review approved',
    'event_id', v_emit_result->>'event_id'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to approve review: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 6: change_connector_state — guard + emit_event + ManualOnly->Enabled check via event_ledger
-- =====================================================

CREATE OR REPLACE FUNCTION change_connector_state(
  p_connector_id uuid,
  p_new_state connector_state,
  p_actor_id uuid,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state connector_state;
  v_guard jsonb;
  v_emit_result jsonb;
  v_approval_exists boolean;
BEGIN
  -- (a) Guard check
  v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_state_change_manual');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'connector_state_change_manual'
    );
  END IF;

  -- Get current state
  SELECT state INTO v_current_state
  FROM connectors
  WHERE id = p_connector_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connector not found');
  END IF;

  -- Rule B: ManualOnly → Enabled requires manual review approval scoped to this connector
  -- Check event_ledger (canonical) via scope_type/scope_id, fallback to legacy related_entity fields
  IF v_current_state = 'ManualOnly' AND p_new_state = 'Enabled' THEN
    SELECT EXISTS(
      SELECT 1
      FROM event_ledger
      WHERE (
        (scope_type = 'connector' AND scope_id = p_connector_id)
        OR
        (related_entity_type = 'connector' AND related_entity_id = p_connector_id)
      )
      AND event_type IN ('connector_manual_review_approved', 'manual_review_approved')
    ) INTO v_approval_exists;

    IF NOT v_approval_exists THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Manual review approval required before enabling connector'
      );
    END IF;
  END IF;

  -- Update connector state
  UPDATE connectors
  SET state = p_new_state, updated_at = now()
  WHERE id = p_connector_id;

  -- (b) Emit canonical event_type connector_state_changed (NOT state_changed)
  v_emit_result := emit_event(
    p_event_type     := 'connector_state_changed',
    p_feature_id     := 'connectors',
    p_scope_type     := 'connector',
    p_scope_id       := p_connector_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := CASE WHEN p_actor_id IS NOT NULL THEN 'support' ELSE 'system' END,
    p_previous_state := jsonb_build_object('state', v_current_state::text),
    p_resulting_state:= jsonb_build_object('state', p_new_state::text),
    p_metadata       := jsonb_build_object(
      'from', v_current_state::text,
      'to', p_new_state::text,
      'change_type', 'manual'
    )
  );

  -- (c) Atomic rollback on emit failure
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'from', v_current_state::text,
    'to', p_new_state::text,
    'event_id', v_emit_result->>'event_id'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 7: log_connector_failure — guard + emit_event + guarded auto-downgrade
-- =====================================================

CREATE OR REPLACE FUNCTION log_connector_failure(
  p_connector_id uuid,
  p_failure_code failure_code,
  p_actor_id uuid,
  p_error_details text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state connector_state;
  v_total_failures integer;
  v_structure_failures integer;
  v_new_state connector_state;
  v_downgrade_reason text;
  v_guard jsonb;
  v_emit_result jsonb;
BEGIN
  -- (a) Guard check for failure logging
  v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_failure_log');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'connector_failure_log'
    );
  END IF;

  SELECT state INTO v_current_state
  FROM connectors
  WHERE id = p_connector_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connector not found');
  END IF;

  -- (b) Log failure via emit_event (canonical: connector_failure_logged)
  v_emit_result := emit_event(
    p_event_type     := 'connector_failure_logged',
    p_feature_id     := 'connectors',
    p_scope_type     := 'connector',
    p_scope_id       := p_connector_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := CASE WHEN p_actor_id IS NOT NULL THEN 'system' ELSE 'system' END,
    p_metadata       := jsonb_build_object(
      'error_details', COALESCE(p_error_details, ''),
      'failure_code', p_failure_code::text
    )
  );

  -- (c) Atomic rollback on emit failure
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  -- Get failure counts (counts both connector_failure_logged + connector_failure legacy)
  v_total_failures := get_connector_failures_24h(p_connector_id, NULL);
  v_structure_failures := get_connector_failures_24h(p_connector_id, 'structure_changed'::failure_code);

  UPDATE connectors
  SET failure_count_24h = v_total_failures, updated_at = now()
  WHERE id = p_connector_id;

  v_new_state := v_current_state;

  -- Auto-downgrade: guard with connector_auto_downgrade class
  -- (These are system-initiated safety writes, allowed in PROTECTIVE mode)

  -- Rule C1: structure_changed threshold → ManualOnly
  IF v_structure_failures >= 3 AND v_current_state != 'ManualOnly' THEN
    v_new_state := 'ManualOnly';
    v_downgrade_reason := 'structure_changed failures exceeded threshold';

    -- Guard auto-downgrade (safety self-protection; allowed in PROTECTIVE)
    v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_auto_downgrade');
    IF (v_guard->>'allowed')::boolean THEN
      UPDATE connectors
      SET state = v_new_state, updated_at = now()
      WHERE id = p_connector_id;

      v_emit_result := emit_event(
        p_event_type     := 'auto_downgrade_to_manual_only',
        p_feature_id     := 'connectors',
        p_scope_type     := 'connector',
        p_scope_id       := p_connector_id,
        p_actor_id       := NULL,
        p_actor_type     := 'system',
        p_reason_code    := 'structure_changed_threshold',
        p_previous_state := jsonb_build_object('state', v_current_state::text),
        p_resulting_state:= jsonb_build_object('state', v_new_state::text),
        p_metadata       := jsonb_build_object(
          'reason', v_downgrade_reason,
          'structure_failures_24h', v_structure_failures,
          'threshold', 3,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );
      IF NOT (v_emit_result->>'success')::boolean THEN
        RAISE EXCEPTION 'emit_event (auto_downgrade_to_manual_only) failed: %', v_emit_result->>'error';
      END IF;
    ELSE
      v_new_state := v_current_state; -- guard blocked auto-downgrade
    END IF;

  -- Rule C2: total failure threshold (50+) → ManualOnly from Degraded
  ELSIF v_total_failures >= 50 AND v_current_state = 'Degraded' THEN
    v_new_state := 'ManualOnly';
    v_downgrade_reason := 'total failures exceeded manual review threshold';

    v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_auto_downgrade');
    IF (v_guard->>'allowed')::boolean THEN
      UPDATE connectors
      SET state = v_new_state, updated_at = now()
      WHERE id = p_connector_id;

      v_emit_result := emit_event(
        p_event_type     := 'auto_downgrade_to_manual_only',
        p_feature_id     := 'connectors',
        p_scope_type     := 'connector',
        p_scope_id       := p_connector_id,
        p_actor_id       := NULL,
        p_actor_type     := 'system',
        p_reason_code    := 'total_failure_threshold_degraded',
        p_previous_state := jsonb_build_object('state', v_current_state::text),
        p_resulting_state:= jsonb_build_object('state', v_new_state::text),
        p_metadata       := jsonb_build_object(
          'reason', v_downgrade_reason,
          'total_failures_24h', v_total_failures,
          'threshold', 50,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );
      IF NOT (v_emit_result->>'success')::boolean THEN
        RAISE EXCEPTION 'emit_event (auto_downgrade_to_manual_only C2) failed: %', v_emit_result->>'error';
      END IF;
    ELSE
      v_new_state := v_current_state;
    END IF;

  -- Rule C3: total failure threshold (10+) → Degraded from Enabled
  ELSIF v_total_failures >= 10 AND v_current_state = 'Enabled' THEN
    v_new_state := 'Degraded';
    v_downgrade_reason := 'total failures exceeded threshold';

    v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_auto_downgrade');
    IF (v_guard->>'allowed')::boolean THEN
      UPDATE connectors
      SET state = v_new_state, updated_at = now()
      WHERE id = p_connector_id;

      v_emit_result := emit_event(
        p_event_type     := 'auto_downgrade_to_degraded',
        p_feature_id     := 'connectors',
        p_scope_type     := 'connector',
        p_scope_id       := p_connector_id,
        p_actor_id       := NULL,
        p_actor_type     := 'system',
        p_reason_code    := 'total_failure_threshold_enabled',
        p_previous_state := jsonb_build_object('state', v_current_state::text),
        p_resulting_state:= jsonb_build_object('state', v_new_state::text),
        p_metadata       := jsonb_build_object(
          'reason', v_downgrade_reason,
          'total_failures_24h', v_total_failures,
          'threshold', 10,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );
      IF NOT (v_emit_result->>'success')::boolean THEN
        RAISE EXCEPTION 'emit_event (auto_downgrade_to_degraded) failed: %', v_emit_result->>'error';
      END IF;
    ELSE
      v_new_state := v_current_state;
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'failure_logged', true,
    'total_failures_24h', v_total_failures,
    'structure_failures_24h', v_structure_failures,
    'state_changed', v_new_state != v_current_state,
    'previous_state', v_current_state::text,
    'current_state', v_new_state::text,
    'downgrade_reason', v_downgrade_reason
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 8: run_connector_health_check_job — guard + emit_event
-- =====================================================

CREATE OR REPLACE FUNCTION run_connector_health_check_job(
  p_actor_id uuid DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connector record;
  v_total_failures integer;
  v_structure_failures integer;
  v_processed_count integer := 0;
  v_downgraded_count integer := 0;
  v_guard jsonb;
  v_guard_downgrade jsonb;
  v_emit_result jsonb;
BEGIN
  -- (a) Guard check for health check job
  v_guard := precheck_mutation_guard(p_region_id, 'connectors', 'connector_health_check_job');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'connector_health_check_job'
    );
  END IF;

  -- Guard for auto-downgrade (checked once; same region/mode)
  v_guard_downgrade := precheck_mutation_guard(p_region_id, 'connectors', 'connector_auto_downgrade');

  FOR v_connector IN
    SELECT id, state
    FROM connectors
    WHERE state IN ('Enabled', 'Degraded')
  LOOP
    v_total_failures := get_connector_failures_24h(v_connector.id, NULL);
    v_structure_failures := get_connector_failures_24h(v_connector.id, 'structure_changed'::failure_code);

    UPDATE connectors
    SET failure_count_24h = v_total_failures, updated_at = now()
    WHERE id = v_connector.id;

    -- Downgrade only if auto_downgrade is allowed
    IF (v_guard_downgrade->>'allowed')::boolean THEN

      IF v_structure_failures >= 3 AND v_connector.state != 'ManualOnly' THEN
        UPDATE connectors
        SET state = 'ManualOnly', updated_at = now()
        WHERE id = v_connector.id;

        v_emit_result := emit_event(
          p_event_type     := 'auto_downgrade_to_manual_only',
          p_feature_id     := 'connectors',
          p_scope_type     := 'connector',
          p_scope_id       := v_connector.id,
          p_actor_id       := NULL,
          p_actor_type     := 'system',
          p_reason_code    := 'health_check_structure_threshold',
          p_previous_state := jsonb_build_object('state', v_connector.state::text),
          p_resulting_state:= jsonb_build_object('state', 'ManualOnly'),
          p_metadata       := jsonb_build_object(
            'reason', 'structure_changed failures exceeded threshold',
            'structure_failures_24h', v_structure_failures,
            'threshold', 3,
            'from', v_connector.state::text,
            'to', 'ManualOnly'
          )
        );
        IF NOT (v_emit_result->>'success')::boolean THEN
          RAISE EXCEPTION 'emit_event failed in health check job: %', v_emit_result->>'error';
        END IF;
        v_downgraded_count := v_downgraded_count + 1;

      ELSIF v_total_failures >= 10 AND v_connector.state = 'Enabled' THEN
        UPDATE connectors
        SET state = 'Degraded', updated_at = now()
        WHERE id = v_connector.id;

        v_emit_result := emit_event(
          p_event_type     := 'auto_downgrade_to_degraded',
          p_feature_id     := 'connectors',
          p_scope_type     := 'connector',
          p_scope_id       := v_connector.id,
          p_actor_id       := NULL,
          p_actor_type     := 'system',
          p_reason_code    := 'health_check_total_threshold',
          p_previous_state := jsonb_build_object('state', v_connector.state::text),
          p_resulting_state:= jsonb_build_object('state', 'Degraded'),
          p_metadata       := jsonb_build_object(
            'reason', 'total failures exceeded threshold',
            'total_failures_24h', v_total_failures,
            'threshold', 10,
            'from', v_connector.state::text,
            'to', 'Degraded'
          )
        );
        IF NOT (v_emit_result->>'success')::boolean THEN
          RAISE EXCEPTION 'emit_event failed in health check job: %', v_emit_result->>'error';
        END IF;
        v_downgraded_count := v_downgraded_count + 1;
      END IF;

    END IF;

    -- (b) Emit health check completed event
    v_emit_result := emit_event(
      p_event_type  := 'connector_health_check_completed',
      p_feature_id  := 'connectors',
      p_scope_type  := 'connector',
      p_scope_id    := v_connector.id,
      p_actor_id    := NULL,
      p_actor_type  := 'system',
      p_metadata    := jsonb_build_object(
        'total_failures_24h', v_total_failures,
        'structure_failures_24h', v_structure_failures
      )
    );
    IF NOT (v_emit_result->>'success')::boolean THEN
      RAISE EXCEPTION 'emit_event (health_check_completed) failed: %', v_emit_result->>'error';
    END IF;

    v_processed_count := v_processed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'downgraded_count', v_downgraded_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Health check failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 9: Strengthen release_battery_failures()
-- =====================================================

CREATE OR REPLACE FUNCTION release_battery_failures()
RETURNS TABLE (
  failure_type text,
  severity text,
  entity_id uuid,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check 1 (CRITICAL): Unregistered event types in event_ledger
  RETURN QUERY
  SELECT
    'unregistered_event_type'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'feature_id', el.feature_id
    )
  FROM event_ledger el
  LEFT JOIN event_type_registry etr ON el.event_type = etr.event_type
  WHERE etr.event_type IS NULL;

  -- Check 2 (CRITICAL): Legacy 'state_changed' event_type present and NOT deprecated
  -- Any row with event_type='state_changed' is a bypass of the canonical connector_state_changed
  RETURN QUERY
  SELECT
    'legacy_state_changed_bypass'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'feature_id', el.feature_id,
      'scope_type', el.scope_type,
      'scope_id', el.scope_id,
      'note', 'state_changed is a legacy bypass; use connector_state_changed'
    )
  FROM event_ledger el
  WHERE el.event_type = 'state_changed';

  -- Check 3 (CRITICAL): connector_state_changed or incident_status_changed rows missing feature_id or scope fields
  RETURN QUERY
  SELECT
    'missing_envelope_fields'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'scope_type', el.scope_type,
      'scope_id', el.scope_id,
      'created_at', el.created_at,
      'note', 'Required envelope fields missing for this event_type'
    )
  FROM event_ledger el
  WHERE el.event_type IN ('connector_state_changed', 'incident_status_changed', 'status_changed')
    AND (
      el.feature_id IS NULL
      OR el.feature_id = 'unknown'
      OR el.scope_type IS NULL
      OR el.scope_id IS NULL
    );

  -- Check 4 (CRITICAL): Invalid actor_type
  RETURN QUERY
  SELECT
    'invalid_actor_type'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'actor_type', el.actor_type,
      'event_type', el.event_type,
      'created_at', el.created_at,
      'allowed_values', '["traveler","support","founder","system","user"]'
    )
  FROM event_ledger el
  WHERE el.actor_type NOT IN ('traveler', 'support', 'founder', 'system', 'user');

  -- Check 5 (WARNING): Missing checksums in emit_event-generated rows
  RETURN QUERY
  SELECT
    'missing_checksum_emit_event'::text,
    'warning'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'created_at', el.created_at,
      'note', 'emit_event should always set checksum_hash'
    )
  FROM event_ledger el
  WHERE el.checksum_hash IS NULL
    AND el.schema_version = 1
    AND el.feature_id != 'unknown'
    AND el.scope_type IS NOT NULL
  LIMIT 10;

  -- Check 6 (INFO): Missing region operational state
  RETURN QUERY
  SELECT
    'missing_region_state'::text,
    'info'::text,
    NULL::uuid,
    jsonb_build_object(
      'message', 'No explicit region operational state configured',
      'default_behavior', 'Defaulting to PROTECTIVE mode'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM region_operational_state
    WHERE region_id != '00000000-0000-0000-0000-000000000000'::uuid
  );

  RETURN;
END;
$$;

-- =====================================================
-- STEP 10: Migration event
-- =====================================================

SELECT emit_event(
  p_event_type := 'schema_migration_applied',
  p_feature_id := 'system',
  p_scope_type := 'system',
  p_scope_id   := gen_random_uuid(),
  p_actor_type := 'system',
  p_metadata   := jsonb_build_object(
    'migration', 'option_a_ledger_takeover',
    'rpcs_patched', jsonb_build_array(
      'change_incident_status',
      'approve_connector_manual_review',
      'change_connector_state',
      'log_connector_failure',
      'run_connector_health_check_job',
      'get_connector_failures_24h'
    ),
    'mutation_classes_added', jsonb_build_array(
      'incident_status_change',
      'connector_state_change_manual',
      'connector_manual_review_approve',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job'
    ),
    'event_types_registered', jsonb_build_array(
      'incident_status_changed',
      'connector_manual_review_approved',
      'connector_health_check_completed',
      'state_changed (deprecated)'
    )
  )
);