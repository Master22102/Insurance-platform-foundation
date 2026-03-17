/*
  # Governance Substrate v1.1 PATCH

  ## Changes
  1. Structural append-only enforcement (BEFORE trigger, not just RLS)
  2. Checksum hashing for emit_event() emissions
  3. Actor type discipline (CHECK constraint + normalization)
  4. Enhanced release_battery_failures() diagnostics

  ## Backward Compatibility
  - Compatibility view unchanged
  - Legacy inserts continue to work
  - No breaking changes to existing functions
*/

-- =====================================================
-- A. Structural Append-Only Enforcement
-- =====================================================

-- Create trigger function that blocks UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_event_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'event_ledger is append-only: % operations are forbidden', TG_OP;
END;
$$;

-- Attach BEFORE trigger (blocks at structural level, before RLS)
DROP TRIGGER IF EXISTS event_ledger_immutable_trigger ON event_ledger;
CREATE TRIGGER event_ledger_immutable_trigger
  BEFORE UPDATE OR DELETE ON event_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_event_ledger_mutation();

-- =====================================================
-- B. Actor Type Discipline
-- =====================================================

-- Add CHECK constraint for allowed actor types
ALTER TABLE event_ledger
  DROP CONSTRAINT IF EXISTS event_ledger_actor_type_check;

ALTER TABLE event_ledger
  ADD CONSTRAINT event_ledger_actor_type_check
  CHECK (actor_type IN ('traveler', 'support', 'founder', 'system', 'user'));

-- =====================================================
-- C. Enable pgcrypto for checksums
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- D. Updated emit_event with Checksum Hashing
-- =====================================================

CREATE OR REPLACE FUNCTION emit_event(
  p_event_type text,
  p_feature_id text,
  p_scope_type text DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_actor_type text DEFAULT 'system',
  p_reason_code text DEFAULT NULL,
  p_previous_state jsonb DEFAULT '{}'::jsonb,
  p_resulting_state jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_registered boolean;
  v_previous_checksum text;
  v_checksum_hash text;
  v_created_at timestamptz;
  v_normalized_actor_type text;
  v_checksum_input text;
BEGIN
  -- Validate event_type is registered
  SELECT EXISTS(
    SELECT 1 FROM event_type_registry
    WHERE event_type = p_event_type
    AND deprecated_at IS NULL
  ) INTO v_registered;

  IF NOT v_registered THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unregistered event_type: ' || p_event_type
    );
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM event_ledger
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Normalize actor_type: 'user' -> 'traveler'
  v_normalized_actor_type := CASE
    WHEN p_actor_type = 'user' THEN 'traveler'
    ELSE p_actor_type
  END;

  -- Get previous checksum for this scope
  IF p_scope_type IS NOT NULL AND p_scope_id IS NOT NULL THEN
    SELECT checksum_hash INTO v_previous_checksum
    FROM event_ledger
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id
      AND checksum_hash IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Set created_at
  v_created_at := now();

  -- Compute checksum_hash
  -- Deterministic concatenation: previous_checksum + event_type + feature_id + scope_type + scope_id + actor_type + actor_id + reason_code + previous_state + resulting_state + metadata + created_at
  v_checksum_input := COALESCE(v_previous_checksum, '') ||
    '|' || p_event_type ||
    '|' || p_feature_id ||
    '|' || COALESCE(p_scope_type, '') ||
    '|' || COALESCE(p_scope_id::text, '') ||
    '|' || v_normalized_actor_type ||
    '|' || COALESCE(p_actor_id::text, '') ||
    '|' || COALESCE(p_reason_code, '') ||
    '|' || (p_previous_state::text) ||
    '|' || (p_resulting_state::text) ||
    '|' || (p_metadata::text) ||
    '|' || v_created_at::text;

  v_checksum_hash := encode(digest(v_checksum_input, 'sha256'), 'hex');

  -- Insert event
  INSERT INTO event_ledger (
    event_type,
    feature_id,
    scope_type,
    scope_id,
    actor_id,
    actor_type,
    reason_code,
    previous_state,
    resulting_state,
    metadata,
    idempotency_key,
    schema_version,
    related_entity_type,
    related_entity_id,
    event_data,
    created_at,
    previous_checksum_hash,
    checksum_hash
  ) VALUES (
    p_event_type,
    p_feature_id,
    p_scope_type,
    p_scope_id,
    p_actor_id,
    v_normalized_actor_type,
    p_reason_code,
    p_previous_state,
    p_resulting_state,
    p_metadata,
    p_idempotency_key,
    1,
    p_scope_type::entity_type,
    p_scope_id,
    '{}'::jsonb,
    v_created_at,
    v_previous_checksum,
    v_checksum_hash
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'idempotent', false,
    'checksum_hash', v_checksum_hash
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to emit event: ' || SQLERRM
    );
END;
$$;

-- =====================================================
-- E. Enhanced release_battery_failures
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
  -- Check 1: Unregistered event types in event_ledger
  RETURN QUERY
  SELECT
    'unregistered_event_type'::text as failure_type,
    'critical'::text as severity,
    el.id as entity_id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'feature_id', el.feature_id
    ) as details
  FROM event_ledger el
  LEFT JOIN event_type_registry etr ON el.event_type = etr.event_type
  WHERE etr.event_type IS NULL;

  -- Check 2: Invalid actor_type (CRITICAL)
  RETURN QUERY
  SELECT
    'invalid_actor_type'::text as failure_type,
    'critical'::text as severity,
    el.id as entity_id,
    jsonb_build_object(
      'actor_type', el.actor_type,
      'event_type', el.event_type,
      'created_at', el.created_at,
      'allowed_values', '["traveler","support","founder","system","user"]'
    ) as details
  FROM event_ledger el
  WHERE el.actor_type NOT IN ('traveler', 'support', 'founder', 'system', 'user');

  -- Check 3: Missing checksums in emit_event-generated rows (WARNING)
  -- Heuristic: rows with schema_version=1 and feature_id != 'unknown' were likely emit_event calls
  RETURN QUERY
  SELECT
    'missing_checksum_emit_event'::text as failure_type,
    'warning'::text as severity,
    el.id as entity_id,
    jsonb_build_object(
      'event_type', el.event_type,
      'feature_id', el.feature_id,
      'created_at', el.created_at,
      'note', 'emit_event should always set checksum_hash'
    ) as details
  FROM event_ledger el
  WHERE el.checksum_hash IS NULL
    AND el.schema_version = 1
    AND el.feature_id != 'unknown'
    AND el.scope_type IS NOT NULL
  LIMIT 10;

  -- Check 4: Missing region operational state (info-level)
  RETURN QUERY
  SELECT
    'missing_region_state'::text as failure_type,
    'info'::text as severity,
    NULL::uuid as entity_id,
    jsonb_build_object(
      'message', 'No explicit region operational state configured',
      'default_behavior', 'Defaulting to PROTECTIVE mode'
    ) as details
  WHERE NOT EXISTS (
    SELECT 1 FROM region_operational_state
    WHERE region_id != '00000000-0000-0000-0000-000000000000'::uuid
  );

  RETURN;
END;
$$;

-- =====================================================
-- Migration Event
-- =====================================================

SELECT emit_event(
  p_event_type := 'schema_migration_applied',
  p_feature_id := 'system',
  p_scope_type := 'system',
  p_scope_id := gen_random_uuid(),
  p_actor_type := 'system',
  p_metadata := jsonb_build_object(
    'migration', 'governance_substrate_v1_1_patch',
    'changes', jsonb_build_array(
      'added BEFORE trigger for structural append-only enforcement',
      'added actor_type CHECK constraint',
      'implemented checksum hashing in emit_event',
      'enhanced release_battery_failures with actor_type and checksum validations'
    )
  )
);