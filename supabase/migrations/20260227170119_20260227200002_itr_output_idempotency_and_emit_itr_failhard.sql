/*
  # ITR Output Idempotency + emit_itr() Fail-Hard Semantics

  ## Summary
  Two hardening changes applied together.

  ## A. Partial Unique Index: one interpretive_output_emitted per trace_id (post-lock only)
  The pre-existing duplicate event for trace ce14a494 was created before the
  integrity lock (2026-02-27 04:26:56) and cannot be deleted (append-only ledger).
  The unique index is therefore scoped to rows created AFTER the integrity lock timestamp,
  which covers all future emit_itr() calls while not conflicting with the pre-lock duplicate.

  Index: idx_event_ledger_itr_trace_id_unique
  - ON event_ledger (((metadata->>'trace_id')::uuid))
  - WHERE event_type = 'interpretive_output_emitted'
      AND created_at > '2026-02-27 04:26:56.555662+00'
  - UNIQUE

  This is the tightest constraint possible without violating append-only semantics.
  All post-lock emit_itr() calls produce trace_ids that are new (freshly inserted into
  interpretive_trace_records), so the index will enforce uniqueness for all future writes.

  ## B. emit_itr() 9-arg: Remove outer EXCEPTION swallowing → RAISE EXCEPTION
  Previously the outer EXCEPTION handler returned a JSON error object, which:
  - Silently rolled back the ITR insert (correct)
  - BUT returned a success=false JSON, enabling ambiguous retries without exception
  Rewritten to propagate as RAISE EXCEPTION so all callers get a true exception on failure.
*/

-- =====================================================
-- A. Partial unique index: one interpretive_output_emitted per trace_id (post-lock)
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_ledger_itr_trace_id_unique
  ON event_ledger (((metadata->>'trace_id')::uuid))
  WHERE event_type = 'interpretive_output_emitted'
    AND created_at > '2026-02-27 04:26:56.555662+00';

-- =====================================================
-- B. Rewrite 9-arg emit_itr() to RAISE EXCEPTION instead of swallowing
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
  v_guard := precheck_mutation_guard(p_region_id, 'incidents', 'itr_emit');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
      'mutation_class', 'itr_emit'
    );
  END IF;

  IF p_decision_fingerprint IS NULL OR p_decision_fingerprint = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'decision_fingerprint required');
  END IF;
  IF p_constraints_profile_hash IS NULL OR p_constraints_profile_hash = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'constraints_profile_hash required');
  END IF;
  IF p_confidence_enum NOT IN ('high', 'medium', 'low') THEN
    RETURN jsonb_build_object('success', false, 'error', 'confidence_enum must be high/medium/low');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incident not found');
  END IF;

  INSERT INTO interpretive_trace_records (
    incident_id, feature_id, decision_fingerprint, constraints_profile_hash,
    confidence_enum, branch_id, ambiguity_type, metadata
  ) VALUES (
    p_incident_id, p_feature_id, p_decision_fingerprint, p_constraints_profile_hash,
    p_confidence_enum, p_branch_id, p_ambiguity_type, COALESCE(p_metadata, '{}')
  )
  RETURNING trace_id INTO v_trace_id;

  v_emit_result := emit_event(
    p_event_type      := 'interpretive_output_emitted',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := NULL,
    p_actor_type      := 'system',
    p_reason_code     := 'itr_emitted',
    p_metadata        := jsonb_build_object(
      'trace_id',                 v_trace_id,
      'decision_fingerprint',     p_decision_fingerprint,
      'constraints_profile_hash', p_constraints_profile_hash,
      'confidence_enum',          p_confidence_enum,
      'branch_id',                p_branch_id,
      'ambiguity_type',           p_ambiguity_type
    )
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for interpretive_output_emitted: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'trace_id',        v_trace_id,
    'event_id',        v_emit_result->>'event_id',
    'confidence_enum', p_confidence_enum
  );
END;
$$;
