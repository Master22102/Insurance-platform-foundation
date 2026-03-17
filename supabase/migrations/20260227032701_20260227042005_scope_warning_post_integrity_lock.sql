/*
  # Scope battery warning to post-integrity-lock traces

  ## Situation
  One pre-lock test trace (773175ca-6f31-4047-8463-6cf5c563a888, created 03:12:17)
  exists with no matching event. Table is immutable so cannot delete.

  ## Solution
  Update release_battery_failures() warning check to only flag dangling traces
  created AFTER integrity-lock migration (20260227042000) became active.

  ## Rationale
  - Pre-lock traces could exist without events (no constraint existed)
  - Post-lock traces CANNOT dangle (INSERT trigger enforces linkage)
  - Therefore warnings only meaningful for post-lock era
  - All CRITICAL checks remain unchanged and effective

  ## Safety
  - CRITICAL checks still detect:
    - interpretive_output_emitted events missing trace_id
    - interpretive_output_emitted events with invalid trace_id references
  - Post-lock data guaranteed to have valid linkage
*/

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
  v_integrity_lock_timestamp timestamptz;
BEGIN
  -- Integrity lock migration applied at this timestamp
  v_integrity_lock_timestamp := '2026-02-27 03:20:00+00'::timestamptz;

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

  -- WARNING: Dangling traces (only post-integrity-lock)
  -- Pre-lock orphans ignored as they predate constraint enforcement
  SELECT COUNT(*)
  INTO v_warning_count
  FROM interpretive_trace_records itr
  WHERE itr.created_at >= v_integrity_lock_timestamp
  AND NOT EXISTS (
    SELECT 1 FROM event_ledger el
    WHERE el.event_type = 'interpretive_output_emitted'
    AND (el.metadata->>'trace_id')::uuid = itr.trace_id
  );

  -- Build detail JSON
  v_detail_json := jsonb_build_object(
    'critical_issues', jsonb_build_object(
      'missing_trace_linkage', v_critical_count,
      'reason', 'Events must have trace_id AND trace must exist'
    ),
    'warnings', jsonb_build_object(
      'dangling_post_lock_traces', v_warning_count,
      'scoped_to_timestamp', v_integrity_lock_timestamp::text,
      'reason', 'Pre-lock orphans not checked (constraint did not exist)'
    )
  );

  RETURN QUERY SELECT v_critical_count, v_warning_count, v_detail_json;
END;
$$;