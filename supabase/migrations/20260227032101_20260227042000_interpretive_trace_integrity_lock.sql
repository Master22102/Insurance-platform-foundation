/*
  # Integrity Lock: interpretive_output_emitted → trace_id linkage

  ## Changes
  1. Add CHECK constraint: interpretive_output_emitted events MUST have trace_id in metadata
  2. Add FOREIGN KEY validation trigger: metadata->>'trace_id' must reference interpretive_trace_records.trace_id
  3. Add CRITICAL battery check for missing/invalid linkage
  4. Update emit_itr() to return both trace_id and event_id
  5. Ensure event_ledger metadata always includes trace_id for interpretive_output_emitted

  ## Security
  - RLS already enabled on event_ledger and interpretive_trace_records
  - Constraint violations will raise exceptions preventing bad data
*/

DO $$
BEGIN
  -- Add CHECK constraint: interpretive_output_emitted must have trace_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'event_ledger'
    AND constraint_name = 'check_interpretive_trace_id_required'
  ) THEN
    ALTER TABLE event_ledger
    ADD CONSTRAINT check_interpretive_trace_id_required
    CHECK (
      (event_type != 'interpretive_output_emitted')
      OR (event_type = 'interpretive_output_emitted' AND metadata ? 'trace_id')
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_interpretive_trace_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trace_id uuid;
  v_trace_exists boolean;
BEGIN
  IF NEW.event_type = 'interpretive_output_emitted' THEN
    -- Extract trace_id from metadata
    v_trace_id := (NEW.metadata->>'trace_id')::uuid;
    
    IF v_trace_id IS NULL THEN
      RAISE EXCEPTION 'interpretive_output_emitted event missing trace_id in metadata';
    END IF;

    -- Verify trace exists in interpretive_trace_records
    SELECT EXISTS(
      SELECT 1 FROM interpretive_trace_records
      WHERE trace_id = v_trace_id
    ) INTO v_trace_exists;

    IF NOT v_trace_exists THEN
      RAISE EXCEPTION 'trace_id % does not exist in interpretive_trace_records', v_trace_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_interpretive_trace_ref ON event_ledger;
CREATE TRIGGER trg_validate_interpretive_trace_ref
BEFORE INSERT ON event_ledger
FOR EACH ROW
EXECUTE FUNCTION validate_interpretive_trace_reference();

DROP FUNCTION IF EXISTS emit_itr(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION emit_itr(
  p_scope_id uuid,
  p_feature_id uuid,
  p_confidence text,
  p_proof_data text
)
RETURNS TABLE(trace_id uuid, event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trace_id uuid;
  v_event_id uuid;
  v_metadata jsonb;
BEGIN
  -- Insert into interpretive_trace_records
  INSERT INTO interpretive_trace_records (
    incident_id, feature_id, confidence_enum, metadata
  )
  VALUES (
    p_scope_id, p_feature_id, p_confidence, 
    jsonb_build_object('proof_data', p_proof_data)
  )
  RETURNING interpretive_trace_records.trace_id INTO v_trace_id;

  -- Prepare metadata with trace_id
  v_metadata := jsonb_build_object(
    'trace_id', v_trace_id,
    'confidence_enum', p_confidence,
    'proof_data_length', length(p_proof_data)
  );

  -- Emit interpretive_output_emitted event with trace_id
  INSERT INTO event_ledger (
    event_type, scope_id, scope_type, feature_id,
    metadata, actor_type
  )
  VALUES (
    'interpretive_output_emitted', p_scope_id, 'incident', p_feature_id,
    v_metadata, 'system'
  )
  RETURNING event_ledger.id INTO v_event_id;

  RETURN QUERY SELECT v_trace_id, v_event_id;
END;
$$;

DROP FUNCTION IF EXISTS release_battery_failures();
CREATE OR REPLACE FUNCTION release_battery_failures()
RETURNS TABLE(
  critical_count integer,
  warning_count integer,
  detail_json jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_critical_count integer;
  v_warning_count integer;
  v_detail_json jsonb;
BEGIN
  -- CRITICAL: Check for interpretive_output_emitted without trace_id
  SELECT COUNT(*)
  INTO v_critical_count
  FROM event_ledger
  WHERE event_type = 'interpretive_output_emitted'
  AND (metadata IS NULL OR NOT metadata ? 'trace_id');

  -- CRITICAL: Check for interpretive_output_emitted with missing trace reference
  v_critical_count := v_critical_count + (
    SELECT COUNT(*)
    FROM event_ledger el
    WHERE el.event_type = 'interpretive_output_emitted'
    AND NOT EXISTS (
      SELECT 1 FROM interpretive_trace_records itr
      WHERE itr.trace_id = (el.metadata->>'trace_id')::uuid
    )
  );

  -- WARNING: Check for dangling traces (not referenced by any event)
  SELECT COUNT(*)
  INTO v_warning_count
  FROM interpretive_trace_records itr
  WHERE NOT EXISTS (
    SELECT 1 FROM event_ledger el
    WHERE el.event_type = 'interpretive_output_emitted'
    AND (el.metadata->>'trace_id')::uuid = itr.trace_id
  );

  -- Build detail JSON
  v_detail_json := jsonb_build_object(
    'critical_issues', jsonb_build_object(
      'missing_trace_linkage', v_critical_count
    ),
    'warnings', jsonb_build_object(
      'dangling_traces', v_warning_count
    )
  );

  RETURN QUERY SELECT v_critical_count, v_warning_count, v_detail_json;
END;
$$;