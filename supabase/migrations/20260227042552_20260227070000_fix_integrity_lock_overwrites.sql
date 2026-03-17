/*
  # Fix Integrity Lock Overwrites

  ## Summary
  The previous migration (canonical_emit_itr_and_battery_contract) correctly established
  the integrity lock pieces but displaced the full Option A scoped battery checks when it
  rewrote release_battery_failures(). This overlay migration fixes that without touching
  migration history.

  ## What is PRESERVED (not changed):
  - check_interpretive_trace_id_required CHECK constraint on event_ledger
  - trg_validate_interpretive_trace_ref BEFORE INSERT trigger + validate_interpretive_trace_reference()
  - emit_itr() 9-arg canonical form (already correct: guard → ITR insert → emit_event)

  ## What is FIXED:

  ### A. emit_itr() 4-arg overload
  The 4-arg overload introduced by canonical_emit_itr_and_battery_contract is a clean
  delegate (calls 9-arg, no direct ledger insert). It is kept as-is — it is NOT the
  "bad overload" (which was the original pre-lock version that directly inserted into
  event_ledger). That bad version was already dropped. No action needed here.

  ### B. release_battery_failures() — full restore
  Restores ALL Option A scoped checks that were displaced, plus the required ITR checks.
  The itr_dangling_trace WARNING is now scoped to traces created AFTER the integrity
  lock was applied, using a dynamic lookup of the schema_migration_applied event for
  'integrity_lock_v1' (emitted at the bottom of this migration). Falls back gracefully
  if the event is not found (returns no dangling warnings, which is safe).

  Checks restored:
  1. CRITICAL: unregistered_event_type
  2. CRITICAL: legacy_state_changed_bypass (post ledger-takeover only)
  3. CRITICAL: missing_envelope_fields (post ledger-takeover only)
  4. CRITICAL: invalid_actor_type
  5. WARNING:  missing_checksum_emit_event (post ledger-takeover only)
  6. INFO:     missing_region_state
  7. CRITICAL: itr_event_missing_trace_id
  8. CRITICAL: itr_event_broken_trace_reference
  9. WARNING:  itr_dangling_trace (scoped to post-integrity-lock traces only,
                                   via schema_migration_applied event lookup)

  ### C. schema_migration_applied event
  Emitted at end of migration so future migrations and release_battery_failures()
  can anchor the integrity_lock_v1 timestamp dynamically.
*/

-- =====================================================
-- SECTION A: Neutralize the bad 4-arg emit_itr overload
-- The previous "bad" version (pre-lock) that directly inserted into event_ledger
-- was already dropped in canonical_emit_itr_and_battery_contract.
-- The current 4-arg overload is a clean delegate — keep it.
-- Confirm by replacing it explicitly to ensure the delegate contract is locked in.
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
-- SECTION B: Restore release_battery_failures() with full Option A checks + ITR checks
-- itr_dangling_trace WARNING scoped to post-integrity-lock traces via event lookup
-- =====================================================

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
DECLARE
  v_ledger_takeover_at  timestamptz;
  v_integrity_lock_at   timestamptz;
BEGIN
  -- Anchor 1: Option A ledger takeover timestamp (dynamic lookup)
  SELECT created_at INTO v_ledger_takeover_at
  FROM event_ledger
  WHERE event_type = 'schema_migration_applied'
    AND metadata->>'migration' = 'option_a_ledger_takeover'
  LIMIT 1;

  -- Fall back to a known safe floor if somehow missing
  IF v_ledger_takeover_at IS NULL THEN
    v_ledger_takeover_at := '2026-02-27T03:04:12Z'::timestamptz;
  END IF;

  -- Anchor 2: Integrity lock timestamp (dynamic lookup of this migration's marker event)
  SELECT created_at INTO v_integrity_lock_at
  FROM event_ledger
  WHERE event_type = 'schema_migration_applied'
    AND metadata->>'migration' = 'integrity_lock_v1'
  LIMIT 1;

  -- If integrity_lock_v1 marker not yet written (first run of this migration),
  -- use NOW() so no traces are falsely flagged as dangling during the migration run itself.
  IF v_integrity_lock_at IS NULL THEN
    v_integrity_lock_at := now();
  END IF;

  -- -------------------------------------------------------
  -- Check 1 (CRITICAL): Unregistered event types
  -- -------------------------------------------------------
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

  -- -------------------------------------------------------
  -- Check 2 (CRITICAL): 'state_changed' used AFTER Ledger Takeover = active bypass
  -- -------------------------------------------------------
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
      'scope_id',   el.scope_id,
      'note', 'state_changed emitted after Ledger Takeover is a bypass; use connector_state_changed'
    )
  FROM event_ledger el
  WHERE el.event_type = 'state_changed'
    AND el.created_at > v_ledger_takeover_at;

  -- -------------------------------------------------------
  -- Check 3 (CRITICAL): Missing envelope fields on patched event types (post-takeover only)
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'missing_envelope_fields'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'scope_type', el.scope_type,
      'scope_id',   el.scope_id,
      'created_at', el.created_at,
      'note', 'Required envelope fields missing for this event_type (post-patch row)'
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

  -- -------------------------------------------------------
  -- Check 4 (CRITICAL): Invalid actor_type
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'invalid_actor_type'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'actor_type',     el.actor_type,
      'event_type',     el.event_type,
      'created_at',     el.created_at,
      'allowed_values', '["traveler","support","founder","system","user"]'::jsonb
    )
  FROM event_ledger el
  WHERE el.actor_type NOT IN ('traveler', 'support', 'founder', 'system', 'user');

  -- -------------------------------------------------------
  -- Check 5 (WARNING): Missing checksums in emit_event-generated rows (post-takeover only)
  -- -------------------------------------------------------
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
    AND el.created_at > v_ledger_takeover_at
  LIMIT 10;

  -- -------------------------------------------------------
  -- Check 6 (INFO): Missing region operational state
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'missing_region_state'::text,
    'info'::text,
    NULL::uuid,
    jsonb_build_object(
      'message',          'No explicit region operational state configured',
      'default_behavior', 'Defaulting to PROTECTIVE mode'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM region_operational_state
    WHERE region_id != '00000000-0000-0000-0000-000000000000'::uuid
  );

  -- -------------------------------------------------------
  -- Check 7 (CRITICAL): interpretive_output_emitted events with no trace_id in metadata
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'itr_event_missing_trace_id'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_id',   el.id,
      'event_type', el.event_type,
      'created_at', el.created_at,
      'reason',     'interpretive_output_emitted has no trace_id in metadata'
    )
  FROM event_ledger el
  WHERE el.event_type = 'interpretive_output_emitted'
    AND (el.metadata IS NULL OR NOT el.metadata ? 'trace_id');

  -- -------------------------------------------------------
  -- Check 8 (CRITICAL): interpretive_output_emitted trace_id not in ITR table
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'itr_event_broken_trace_reference'::text,
    'critical'::text,
    el.id,
    jsonb_build_object(
      'event_id',   el.id,
      'event_type', el.event_type,
      'trace_id',   el.metadata->>'trace_id',
      'created_at', el.created_at,
      'reason',     'trace_id in metadata does not exist in interpretive_trace_records'
    )
  FROM event_ledger el
  WHERE el.event_type = 'interpretive_output_emitted'
    AND (el.metadata ? 'trace_id')
    AND NOT EXISTS (
      SELECT 1 FROM interpretive_trace_records itr
      WHERE itr.trace_id = (el.metadata->>'trace_id')::uuid
    );

  -- -------------------------------------------------------
  -- Check 9 (WARNING): Dangling ITR traces — scoped to post-integrity-lock only
  -- Traces created before the lock could not have been enforced; not a live failure.
  -- -------------------------------------------------------
  RETURN QUERY
  SELECT
    'itr_dangling_trace'::text,
    'warning'::text,
    itr.trace_id,
    jsonb_build_object(
      'trace_id',    itr.trace_id,
      'incident_id', itr.incident_id,
      'feature_id',  itr.feature_id,
      'created_at',  itr.created_at,
      'reason',      'interpretive_trace_record has no interpretive_output_emitted event (post-lock trace)'
    )
  FROM interpretive_trace_records itr
  WHERE itr.created_at > v_integrity_lock_at
    AND NOT EXISTS (
      SELECT 1 FROM event_ledger el
      WHERE el.event_type = 'interpretive_output_emitted'
        AND (el.metadata->>'trace_id')::uuid = itr.trace_id
    );

END;
$$;

-- =====================================================
-- SECTION C: Emit schema_migration_applied marker so future calls
-- to release_battery_failures() can anchor the integrity lock timestamp
-- dynamically via event_ledger lookup (not a hard-coded timestamp).
-- =====================================================

DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := emit_event(
    p_event_type  := 'schema_migration_applied',
    p_feature_id  := 'system',
    p_actor_type  := 'system',
    p_reason_code := 'migration_applied',
    p_metadata    := jsonb_build_object(
      'migration',   'integrity_lock_v1',
      'description', 'ITR integrity lock + canonical emit_itr + full battery checks restored',
      'fixes',       jsonb_build_array(
        'emit_itr canonical: guard → ITR insert → emit_event only',
        'trg_validate_interpretive_trace_ref: 3-layer UUID + ITR existence check',
        'check_interpretive_trace_id_required: metadata.trace_id required',
        'release_battery_failures: Option A checks + ITR checks + post-lock dangling scope'
      )
    )
  );

  IF NOT (v_result->>'success')::boolean THEN
    RAISE WARNING 'Could not emit schema_migration_applied marker: %', v_result->>'error';
  END IF;
END $$;
