/*
  # ITR Storage + FOCL Explanation Proof

  ## Overview
  Implements Interpretive Trace Records (ITR) storage with hard-block UPDATE/DELETE triggers,
  emit_itr() RPC with governance guard + emit_event, and founder_readable_explanation()
  function to extract provably unbiased explanations from event_ledger without predictive language.

  ## Tables
  - interpretive_trace_records: insert-only audit trail of all interpretive decisions
    - Fields: trace_id (PK), incident_id (FK), feature_id, decision_fingerprint (hash),
              constraints_profile_hash (hash), confidence_enum, branch_id, ambiguity_type,
              metadata, created_at
    - Triggers: hard-block UPDATE/DELETE; log attempts to audit_trace_violations

  ## RPC: emit_itr()
  - Requires: precheck_mutation_guard(mutation_class='itr_emit')
  - Validates: decision_fingerprint, constraints_profile_hash, confidence_enum present
  - Inserts: ITR row
  - Emits: event(event_type='interpretive_output_emitted', scope_type='incident')
  - Rollback: RAISE EXCEPTION on any failure (atomic)

  ## Function: founder_readable_explanation(event_id uuid)
  - Returns: text explanation extracted ONLY from event_ledger fields
  - No predictive language: never use "likely", "probable", "guarantee", "entitled"
  - Use only: facts from previous_state, resulting_state, metadata, reason_code

  ## Battery Enhancements
  - CRITICAL: any ITR missing decision_fingerprint or constraints_profile_hash
  - CRITICAL: any interpretive_output_emitted missing feature_id/scope_type/scope_id
*/

-- =====================================================
-- STEP 1: Create interpretive_trace_records table
-- =====================================================

CREATE TABLE IF NOT EXISTS interpretive_trace_records (
  trace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  feature_id text NOT NULL,
  decision_fingerprint text NOT NULL,
  constraints_profile_hash text NOT NULL,
  confidence_enum text NOT NULL CHECK (confidence_enum IN ('high', 'medium', 'low')),
  branch_id text,
  ambiguity_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for incident_id lookups (high query volume expected)
CREATE INDEX IF NOT EXISTS idx_itr_incident_id ON interpretive_trace_records(incident_id);
CREATE INDEX IF NOT EXISTS idx_itr_feature_id ON interpretive_trace_records(feature_id);
CREATE INDEX IF NOT EXISTS idx_itr_created_at ON interpretive_trace_records(created_at);

-- =====================================================
-- STEP 2: Hard-block triggers for UPDATE/DELETE on ITR
-- =====================================================

CREATE OR REPLACE FUNCTION block_itr_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the attempt to audit_trace_violations if table exists
  INSERT INTO audit_trace_violations (table_name, operation, attempted_at, metadata)
  SELECT 'interpretive_trace_records', 'UPDATE', now(), jsonb_build_object(
    'trace_id', OLD.trace_id,
    'incident_id', OLD.incident_id
  )
  ON CONFLICT DO NOTHING;

  RAISE EXCEPTION 'interpretive_trace_records is immutable: UPDATE blocked';
END;
$$;

CREATE OR REPLACE FUNCTION block_itr_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the attempt
  INSERT INTO audit_trace_violations (table_name, operation, attempted_at, metadata)
  SELECT 'interpretive_trace_records', 'DELETE', now(), jsonb_build_object(
    'trace_id', OLD.trace_id,
    'incident_id', OLD.incident_id
  )
  ON CONFLICT DO NOTHING;

  RAISE EXCEPTION 'interpretive_trace_records is immutable: DELETE blocked';
END;
$$;

DROP TRIGGER IF EXISTS block_itr_update_trigger ON interpretive_trace_records;
CREATE TRIGGER block_itr_update_trigger
BEFORE UPDATE ON interpretive_trace_records
FOR EACH ROW
EXECUTE FUNCTION block_itr_update();

DROP TRIGGER IF EXISTS block_itr_delete_trigger ON interpretive_trace_records;
CREATE TRIGGER block_itr_delete_trigger
BEFORE DELETE ON interpretive_trace_records
FOR EACH ROW
EXECUTE FUNCTION block_itr_delete();

-- =====================================================
-- STEP 3: Register interpretive_output_emitted event type
-- =====================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES ('interpretive_output_emitted', 1, 'incidents', 'info')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- STEP 4: emit_itr() RPC
-- =====================================================

CREATE OR REPLACE FUNCTION emit_itr(
  p_incident_id uuid,
  p_feature_id text,
  p_decision_fingerprint text,
  p_constraints_profile_hash text,
  p_confidence_enum text,
  p_branch_id text DEFAULT NULL,
  p_ambiguity_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard jsonb;
  v_trace_id uuid;
  v_emit_result jsonb;
BEGIN
  -- (a) Guard check: itr_emit mutation class
  v_guard := precheck_mutation_guard(p_region_id, 'incidents', 'itr_emit');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'itr_emit'
    );
  END IF;

  -- Validate required fields
  IF p_decision_fingerprint IS NULL OR p_decision_fingerprint = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'decision_fingerprint required');
  END IF;
  IF p_constraints_profile_hash IS NULL OR p_constraints_profile_hash = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'constraints_profile_hash required');
  END IF;
  IF p_confidence_enum NOT IN ('high', 'medium', 'low') THEN
    RETURN jsonb_build_object('success', false, 'error', 'confidence_enum must be high/medium/low');
  END IF;

  -- Verify incident exists
  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incident not found');
  END IF;

  -- (b) Insert ITR row
  INSERT INTO interpretive_trace_records (
    incident_id, feature_id, decision_fingerprint, constraints_profile_hash,
    confidence_enum, branch_id, ambiguity_type, metadata
  ) VALUES (
    p_incident_id, p_feature_id, p_decision_fingerprint, p_constraints_profile_hash,
    p_confidence_enum, p_branch_id, p_ambiguity_type, COALESCE(p_metadata, '{}')
  )
  RETURNING trace_id INTO v_trace_id;

  -- (c) Emit event: interpretive_output_emitted
  v_emit_result := emit_event(
    p_event_type     := 'interpretive_output_emitted',
    p_feature_id     := p_feature_id,
    p_scope_type     := 'incident',
    p_scope_id       := p_incident_id,
    p_actor_id       := NULL,
    p_actor_type     := 'system',
    p_reason_code    := 'itr_emitted',
    p_metadata       := jsonb_build_object(
      'trace_id', v_trace_id,
      'decision_fingerprint', p_decision_fingerprint,
      'constraints_profile_hash', p_constraints_profile_hash,
      'confidence_enum', p_confidence_enum,
      'branch_id', p_branch_id,
      'ambiguity_type', p_ambiguity_type
    )
  );

  -- (d) Atomic rollback on emit failure
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trace_id', v_trace_id,
    'event_id', v_emit_result->>'event_id',
    'confidence_enum', p_confidence_enum
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- STEP 5: founder_readable_explanation() function
-- =====================================================

CREATE OR REPLACE FUNCTION founder_readable_explanation(
  p_event_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event record;
  v_explanation text := '';
  v_prev_state jsonb;
  v_result_state jsonb;
  v_metadata jsonb;
BEGIN
  -- Fetch the event from event_ledger
  SELECT el.event_type, el.scope_id, el.scope_type, el.reason_code,
         el.previous_state, el.resulting_state, el.metadata, el.actor_type
  INTO v_event
  FROM event_ledger el
  WHERE el.id = p_event_id;

  IF NOT FOUND THEN
    RETURN 'No event found with ID ' || p_event_id;
  END IF;

  v_prev_state := COALESCE(v_event.previous_state, '{}'::jsonb);
  v_result_state := COALESCE(v_event.resulting_state, '{}'::jsonb);
  v_metadata := COALESCE(v_event.metadata, '{}'::jsonb);

  -- Build explanation from facts only (no predictive language)
  IF v_event.event_type = 'incident_status_changed' THEN
    v_explanation := 'Incident status changed from ' ||
      COALESCE(v_prev_state->>'status', 'unknown') || ' to ' ||
      COALESCE(v_result_state->>'status', 'unknown');
    IF v_event.reason_code IS NOT NULL THEN
      v_explanation := v_explanation || ' (reason: ' || v_event.reason_code || ')';
    END IF;

  ELSIF v_event.event_type = 'connector_state_changed' THEN
    v_explanation := 'Connector transitioned from ' ||
      COALESCE(v_prev_state->>'state', 'unknown') || ' to ' ||
      COALESCE(v_result_state->>'state', 'unknown');
    IF v_metadata->>'change_type' IS NOT NULL THEN
      v_explanation := v_explanation || ' via ' || v_metadata->>'change_type';
    END IF;

  ELSIF v_event.event_type = 'connector_failure_logged' THEN
    v_explanation := 'Connector failure recorded. Code: ' ||
      COALESCE(v_metadata->>'failure_code', 'unspecified');
    IF v_metadata->>'error_details' IS NOT NULL THEN
      v_explanation := v_explanation || '. Details: ' || v_metadata->>'error_details';
    END IF;

  ELSIF v_event.event_type IN ('auto_downgrade_to_degraded', 'auto_downgrade_to_manual_only') THEN
    v_explanation := 'Automatic state transition: ' ||
      COALESCE(v_metadata->>'from', 'unknown') || ' to ' ||
      COALESCE(v_metadata->>'to', 'unknown') || '. Reason: ' ||
      COALESCE(v_metadata->>'reason', 'threshold exceeded');

  ELSIF v_event.event_type = 'interpretive_output_emitted' THEN
    v_explanation := 'Interpretive trace emitted for incident. ' ||
      'Feature: ' || COALESCE(v_metadata->>'feature_id', v_event.scope_id::text) || '. ' ||
      'Confidence: ' || COALESCE(v_metadata->>'confidence_enum', 'unspecified') || '.';

  ELSE
    v_explanation := 'Event type ' || v_event.event_type || ' recorded';
    IF v_event.reason_code IS NOT NULL THEN
      v_explanation := v_explanation || ' (reason: ' || v_event.reason_code || ')';
    END IF;
  END IF;

  -- Append actor info if available
  IF v_event.actor_type IS NOT NULL AND v_event.actor_type != 'system' THEN
    v_explanation := v_explanation || ' [by ' || v_event.actor_type || ']';
  END IF;

  RETURN v_explanation;
END;
$$;

-- =====================================================
-- STEP 6: Strengthen release_battery_failures() with ITR checks
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
DECLARE
  v_ledger_takeover_at timestamptz := '2026-02-27T03:04:12Z'::timestamptz;
BEGIN
  -- Check 1 (CRITICAL): Unregistered event types
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

  -- Check 2 (CRITICAL): 'state_changed' used AFTER Ledger Takeover
  RETURN QUERY
  SELECT
    'legacy_state_changed_bypass'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'note', 'state_changed emitted after Ledger Takeover is a bypass'
    )
  FROM event_ledger el
  WHERE el.event_type = 'state_changed'
    AND el.created_at > v_ledger_takeover_at;

  -- Check 3 (CRITICAL): connector_state_changed / incident_status_changed missing envelope
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
      'note', 'Required envelope fields missing (post-patch row)'
    )
  FROM event_ledger el
  WHERE el.event_type IN ('connector_state_changed', 'incident_status_changed', 'status_changed')
    AND el.created_at > v_ledger_takeover_at
    AND (
      el.feature_id IS NULL
      OR el.feature_id = 'unknown'
      OR el.scope_type IS NULL
      OR el.scope_id IS NULL
    );

  -- Check 4 (CRITICAL): ITR missing decision_fingerprint or constraints_profile_hash
  RETURN QUERY
  SELECT
    'itr_missing_critical_hash'::text,
    'critical'::text,
    itr.trace_id,
    jsonb_build_object(
      'trace_id', itr.trace_id,
      'incident_id', itr.incident_id,
      'decision_fingerprint_null', itr.decision_fingerprint IS NULL,
      'constraints_profile_hash_null', itr.constraints_profile_hash IS NULL
    )
  FROM interpretive_trace_records itr
  WHERE itr.decision_fingerprint IS NULL
     OR itr.constraints_profile_hash IS NULL;

  -- Check 5 (CRITICAL): interpretive_output_emitted missing feature_id or scope fields
  RETURN QUERY
  SELECT
    'itr_event_missing_envelope'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'scope_type', el.scope_type,
      'scope_id', el.scope_id,
      'note', 'interpretive_output_emitted missing envelope fields'
    )
  FROM event_ledger el
  WHERE el.event_type = 'interpretive_output_emitted'
    AND (
      el.feature_id IS NULL
      OR el.feature_id = 'unknown'
      OR el.scope_type IS NULL
      OR el.scope_id IS NULL
    );

  -- Check 6 (CRITICAL): Invalid actor_type
  RETURN QUERY
  SELECT
    'invalid_actor_type'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'actor_type', el.actor_type,
      'event_type', el.event_type,
      'allowed_values', '["traveler","support","founder","system","user"]'
    )
  FROM event_ledger el
  WHERE el.actor_type NOT IN ('traveler', 'support', 'founder', 'system', 'user');

  -- Check 7 (WARNING): Missing checksums in emit_event rows (post-patch)
  RETURN QUERY
  SELECT
    'missing_checksum_emit_event'::text,
    'warning'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'note', 'emit_event should always set checksum_hash'
    )
  FROM event_ledger el
  WHERE el.checksum_hash IS NULL
    AND el.schema_version = 1
    AND el.feature_id != 'unknown'
    AND el.scope_type IS NOT NULL
    AND el.created_at > v_ledger_takeover_at
  LIMIT 10;

  -- Check 8 (INFO): Missing region operational state
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
-- STEP 7: Add itr_emit to precheck_mutation_guard
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
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_mode IS NULL THEN
    v_mode := 'PROTECTIVE';
  END IF;

  IF v_mode = 'NORMAL' THEN
    v_allowed := true;

  ELSIF v_mode = 'ELEVATED' THEN
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );

  ELSIF v_mode = 'PROTECTIVE' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'incident_create',
      'evidence_upload',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job',
      'itr_emit'
    );

  ELSIF v_mode = 'RECOVERY' THEN
    v_allowed := p_mutation_class IN (
      'evidence_upload',
      'incident_create',
      'incident_status_change',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job',
      'itr_emit'
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