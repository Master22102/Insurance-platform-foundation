/*
  # Option A: Battery Checks Scoped to Post-Ledger-Takeover Rows

  ## Problem
  Historical rows (pre-2026-02-27) were written by un-patched RPCs using legacy event types
  (state_changed, status_changed without envelope fields). These pre-date the Ledger Takeover
  migration and should not count as active bypass violations.

  ## Solution
  Scope the legacy_state_changed_bypass and missing_envelope_fields CRITICAL checks to rows
  created after the option_a_ledger_takeover migration was applied.
  Any NEW state_changed or missing-envelope row after that timestamp IS a real bypass violation.

  ## No schema changes — only release_battery_failures() updated.
*/

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
  -- Rows created before this timestamp are pre-patch legacy data; not counted as active bypasses
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

  -- Check 2 (CRITICAL): 'state_changed' used AFTER Ledger Takeover = active bypass
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
      'note', 'state_changed emitted after Ledger Takeover is a bypass; use connector_state_changed'
    )
  FROM event_ledger el
  WHERE el.event_type = 'state_changed'
    AND el.created_at > v_ledger_takeover_at;

  -- Check 3 (CRITICAL): connector_state_changed / incident_status_changed missing envelope fields (post-patch only)
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

  -- Check 5 (WARNING): Missing checksums in emit_event-generated rows (post-patch only)
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