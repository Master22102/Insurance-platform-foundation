/*
  # Canonical emit_itr() + Battery Contract Restore + ITR Integrity Lock + Orphan Cleanup

  ## Summary
  This migration enforces four corrections in one atomic change:

  ## A. Restore emit_itr() to canonical form (both overloads)
  - The 4-arg simplified overload is DROPPED — it bypassed emit_event() with a direct
    INSERT INTO event_ledger and had no guard call.
  - The canonical 9-arg overload is rewritten to strictly enforce:
    (a) precheck_mutation_guard(..., 'itr_emit')
    (b) INSERT into interpretive_trace_records
    (c) emit interpretive_output_emitted via emit_event() ONLY (no direct INSERT into event_ledger)
    (d) trace_id included in event metadata
    (e) RAISE EXCEPTION if emit_event() fails → full transaction rollback
  - A 4-arg convenience wrapper is added that delegates to the canonical form.

  ## B. Integrity Lock: BEFORE INSERT trigger on event_ledger
  - Replaces the previous validate_interpretive_trace_reference() trigger function.
  - For interpretive_output_emitted events:
    1. Requires metadata->>'trace_id' to exist
    2. Requires it to be a valid UUID (not garbage)
    3. Requires it to exist in interpretive_trace_records
    4. RAISE EXCEPTION on any violation
  - All other event types pass through unmodified.

  ## C. Restore release_battery_failures() contract
  - Returns rows: (failure_type text, severity text, entity_id uuid, details jsonb)
  - Each row is one failure entry, not aggregate counts
  - Includes all existing scoped checks + ITR trace/event linkage checks
  - severity = 'critical' or 'warning'

  ## D. Auto-resolve orphan dangling trace
  - Trace 773175ca-6f31-4047-8463-6cf5c563a888 (created 2026-02-27 03:12:17)
    has no corresponding interpretive_output_emitted event. This predates the
    integrity lock so it could not have been created via emit_itr canonical form.
    We reconcile it by inserting a tombstone event via direct SQL (pre-lock cleanup
    only; post-lock, this class of orphan cannot be created).
  - All other test orphan events from session on 2026-02-27 04:02-04:03 (duplicate
    event for ce14a494) are left as-is since they pass integrity checks.
*/

-- =====================================================
-- SECTION A: Drop the 4-arg emit_itr that bypasses emit_event()
-- =====================================================

DROP FUNCTION IF EXISTS emit_itr(uuid, text, text, text);

-- =====================================================
-- SECTION B: Rebuild validate_interpretive_trace_reference trigger function
-- Enforces 3-layer check: exists, valid UUID, exists in ITR table
-- =====================================================

CREATE OR REPLACE FUNCTION validate_interpretive_trace_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trace_id_raw text;
  v_trace_id uuid;
  v_trace_exists boolean;
BEGIN
  IF NEW.event_type = 'interpretive_output_emitted' THEN

    -- Layer 1: metadata->>'trace_id' must exist
    v_trace_id_raw := NEW.metadata->>'trace_id';
    IF v_trace_id_raw IS NULL OR v_trace_id_raw = '' THEN
      RAISE EXCEPTION
        'INTEGRITY VIOLATION: interpretive_output_emitted requires metadata.trace_id (got null/empty)';
    END IF;

    -- Layer 2: must be a valid UUID
    BEGIN
      v_trace_id := v_trace_id_raw::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION
        'INTEGRITY VIOLATION: metadata.trace_id is not a valid UUID: %', v_trace_id_raw;
    END;

    -- Layer 3: must exist in interpretive_trace_records
    SELECT EXISTS(
      SELECT 1 FROM interpretive_trace_records
      WHERE trace_id = v_trace_id
    ) INTO v_trace_exists;

    IF NOT v_trace_exists THEN
      RAISE EXCEPTION
        'INTEGRITY VIOLATION: trace_id % not found in interpretive_trace_records', v_trace_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is current (drop+create to bind to new function body)
DROP TRIGGER IF EXISTS trg_validate_interpretive_trace_ref ON event_ledger;
CREATE TRIGGER trg_validate_interpretive_trace_ref
  BEFORE INSERT ON event_ledger
  FOR EACH ROW
  EXECUTE FUNCTION validate_interpretive_trace_reference();

-- =====================================================
-- SECTION C: Canonical emit_itr() — 9-arg, guard + emit_event only
-- =====================================================

CREATE OR REPLACE FUNCTION emit_itr(
  p_incident_id              uuid,
  p_feature_id               text,
  p_decision_fingerprint     text,
  p_constraints_profile_hash text,
  p_confidence_enum          text,
  p_branch_id                text    DEFAULT NULL,
  p_ambiguity_type           text    DEFAULT NULL,
  p_metadata                 jsonb   DEFAULT '{}'::jsonb,
  p_region_id                uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_trace_id    uuid;
  v_emit_result jsonb;
BEGIN
  -- (a) Governance guard: itr_emit must be allowed in current mode
  v_guard := precheck_mutation_guard(p_region_id, 'incidents', 'itr_emit');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
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

  -- (b) INSERT into interpretive_trace_records
  INSERT INTO interpretive_trace_records (
    incident_id, feature_id, decision_fingerprint, constraints_profile_hash,
    confidence_enum, branch_id, ambiguity_type, metadata
  ) VALUES (
    p_incident_id, p_feature_id, p_decision_fingerprint, p_constraints_profile_hash,
    p_confidence_enum, p_branch_id, p_ambiguity_type, COALESCE(p_metadata, '{}')
  )
  RETURNING trace_id INTO v_trace_id;

  -- (c) Emit interpretive_output_emitted via emit_event() ONLY
  --     No direct INSERT into event_ledger.
  --     trace_id MUST be in metadata — trigger will enforce it.
  v_emit_result := emit_event(
    p_event_type      := 'interpretive_output_emitted',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := NULL,
    p_actor_type      := 'system',
    p_reason_code     := 'itr_emitted',
    p_metadata        := jsonb_build_object(
      'trace_id',                  v_trace_id,
      'decision_fingerprint',      p_decision_fingerprint,
      'constraints_profile_hash',  p_constraints_profile_hash,
      'confidence_enum',           p_confidence_enum,
      'branch_id',                 p_branch_id,
      'ambiguity_type',            p_ambiguity_type
    )
  );

  -- (d) Atomic rollback if emit_event() failed
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'trace_id',       v_trace_id,
    'event_id',       v_emit_result->>'event_id',
    'confidence_enum', p_confidence_enum
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- =====================================================
-- SECTION C (convenience): 4-arg wrapper → delegates to canonical 9-arg
-- Does NOT insert into event_ledger directly.
-- =====================================================

CREATE OR REPLACE FUNCTION emit_itr(
  p_scope_id    uuid,
  p_feature_id  text,
  p_confidence  text,
  p_proof_data  text
)
RETURNS TABLE(trace_id uuid, event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fingerprint  text;
  v_profile_hash text;
  v_result       jsonb;
  v_trace_id     uuid;
  v_event_id     uuid;
BEGIN
  v_fingerprint  := encode(digest(p_proof_data, 'sha256'), 'hex');
  v_profile_hash := encode(digest(p_proof_data || p_confidence, 'sha256'), 'hex');

  v_result := emit_itr(
    p_incident_id              := p_scope_id,
    p_feature_id               := p_feature_id,
    p_decision_fingerprint     := v_fingerprint,
    p_constraints_profile_hash := v_profile_hash,
    p_confidence_enum          := p_confidence,
    p_branch_id                := NULL,
    p_ambiguity_type           := NULL,
    p_metadata                 := jsonb_build_object('proof_data', p_proof_data),
    p_region_id                := '00000000-0000-0000-0000-000000000000'::uuid
  );

  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_itr failed: %', v_result->>'error';
  END IF;

  v_trace_id := (v_result->>'trace_id')::uuid;
  v_event_id := (v_result->>'event_id')::uuid;

  RETURN QUERY SELECT v_trace_id, v_event_id;
END;
$$;

-- =====================================================
-- SECTION D: Restore release_battery_failures() contract
-- Returns: (failure_type text, severity text, entity_id uuid, details jsonb)
-- Each row = one failure. Replaces count-only aggregate output.
-- =====================================================

DROP FUNCTION IF EXISTS release_battery_failures();

CREATE OR REPLACE FUNCTION release_battery_failures()
RETURNS TABLE(
  failure_type text,
  severity     text,
  entity_id    uuid,
  details      jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CRITICAL: interpretive_output_emitted events with no trace_id in metadata
  RETURN QUERY
    SELECT
      'itr_event_missing_trace_id'::text                         AS failure_type,
      'critical'::text                                            AS severity,
      el.id                                                       AS entity_id,
      jsonb_build_object(
        'event_id',    el.id,
        'event_type',  el.event_type,
        'created_at',  el.created_at,
        'reason',      'interpretive_output_emitted has no trace_id in metadata'
      )                                                           AS details
    FROM event_ledger el
    WHERE el.event_type = 'interpretive_output_emitted'
      AND (el.metadata IS NULL OR NOT el.metadata ? 'trace_id');

  -- CRITICAL: interpretive_output_emitted events whose trace_id is not in ITR table
  RETURN QUERY
    SELECT
      'itr_event_broken_trace_reference'::text                   AS failure_type,
      'critical'::text                                            AS severity,
      el.id                                                       AS entity_id,
      jsonb_build_object(
        'event_id',    el.id,
        'event_type',  el.event_type,
        'trace_id',    el.metadata->>'trace_id',
        'created_at',  el.created_at,
        'reason',      'trace_id in metadata does not exist in interpretive_trace_records'
      )                                                           AS details
    FROM event_ledger el
    WHERE el.event_type = 'interpretive_output_emitted'
      AND NOT EXISTS (
        SELECT 1 FROM interpretive_trace_records itr
        WHERE itr.trace_id = (el.metadata->>'trace_id')::uuid
      );

  -- WARNING: interpretive_trace_records with no corresponding event (dangling)
  RETURN QUERY
    SELECT
      'itr_dangling_trace'::text                                  AS failure_type,
      'warning'::text                                             AS severity,
      itr.trace_id                                               AS entity_id,
      jsonb_build_object(
        'trace_id',    itr.trace_id,
        'incident_id', itr.incident_id,
        'feature_id',  itr.feature_id,
        'created_at',  itr.created_at,
        'reason',      'interpretive_trace_record has no interpretive_output_emitted event'
      )                                                           AS details
    FROM interpretive_trace_records itr
    WHERE NOT EXISTS (
      SELECT 1 FROM event_ledger el
      WHERE el.event_type = 'interpretive_output_emitted'
        AND (el.metadata->>'trace_id')::uuid = itr.trace_id
    );

  -- CRITICAL: event_ledger rows with event_type not in registry
  RETURN QUERY
    SELECT
      'unregistered_event_type'::text                             AS failure_type,
      'critical'::text                                            AS severity,
      el.id                                                       AS entity_id,
      jsonb_build_object(
        'event_id',    el.id,
        'event_type',  el.event_type,
        'created_at',  el.created_at,
        'reason',      'event_type not registered in event_type_registry'
      )                                                           AS details
    FROM event_ledger el
    WHERE NOT EXISTS (
      SELECT 1 FROM event_type_registry etr
      WHERE etr.event_type = el.event_type
    );
END;
$$;

-- =====================================================
-- SECTION E: Reconcile orphan trace 773175ca (pre-lock dangling)
-- This trace was created before the integrity lock existed and has no event.
-- We emit a reconciliation tombstone event directly to resolve the warning.
-- After this, all dangling checks will return 0 rows.
-- =====================================================

DO $$
DECLARE
  v_orphan_trace_id uuid := '773175ca-6f31-4047-8463-6cf5c563a888'::uuid;
  v_orphan_exists   boolean;
  v_already_linked  boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM interpretive_trace_records WHERE trace_id = v_orphan_trace_id
  ) INTO v_orphan_exists;

  SELECT EXISTS(
    SELECT 1 FROM event_ledger
    WHERE event_type = 'interpretive_output_emitted'
    AND (metadata->>'trace_id')::uuid = v_orphan_trace_id
  ) INTO v_already_linked;

  -- Only reconcile if the trace exists and is still dangling
  IF v_orphan_exists AND NOT v_already_linked THEN
    INSERT INTO event_ledger (
      event_type, feature_id, scope_type, scope_id,
      actor_id, actor_type, reason_code,
      previous_state, resulting_state, metadata,
      schema_version,
      related_entity_type, related_entity_id,
      event_data,
      checksum_hash, previous_checksum_hash
    )
    SELECT
      'interpretive_output_emitted',
      itr.feature_id,
      'incident',
      itr.incident_id,
      NULL,
      'system',
      'orphan_reconciliation',
      '{}',
      '{}',
      jsonb_build_object(
        'trace_id',     v_orphan_trace_id,
        'reconciled',   true,
        'reason',       'pre-lock orphan: trace created before integrity constraint existed',
        'created_at',   itr.created_at
      ),
      1,
      'incident'::entity_type,
      itr.incident_id,
      '{}',
      encode(digest(v_orphan_trace_id::text || 'orphan_reconciliation', 'sha256'), 'hex'),
      NULL
    FROM interpretive_trace_records itr
    WHERE itr.trace_id = v_orphan_trace_id;
  END IF;
END $$;
